import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/server-company";
import {
  buildCandidatePortalUrl,
  cleanPortalText,
} from "@/lib/candidate-portal-access";
import {
  CANDIDATE_MEDIA_BUCKET,
  CANDIDATE_MEDIA_MAX_BYTES,
  CANDIDATE_MEDIA_MIME,
  deleteCandidateMedia,
  sanitizeCandidateMediaName,
  uploadCandidateMedia,
} from "@/lib/candidate-portal-media";
import { processCandidatePushQueue } from "@/lib/candidate-push-dispatch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const AUDIENCE_MODES = new Set([
  "ALL_PORTAL",
  "PUSH_ACTIVE",
  "SELECTED",
]);

const CONTENT_TYPES = new Set([
  "VAGA",
  "PROCESSO",
  "ENTREVISTA",
  "NOVIDADE",
]);

const NOTIFICATION_TYPE_BY_CONTENT: Record<string, string> = {
  VAGA: "JOB_OPPORTUNITY",
  PROCESSO: "PROCESS_UPDATE",
  ENTREVISTA: "INTERVIEW",
  NOVIDADE: "MESSAGE",
};

function parseSelected(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return Array.from(
      new Set(
        parsed
          .map((item) => cleanPortalText(item, 100))
          .filter(Boolean)
      )
    ).slice(0, 2000);
  } catch {
    return [];
  }
}

async function profileTargets(
  companyId: string,
  audienceMode: string,
  selectedProfileIds: string[]
) {
  if (audienceMode === "PUSH_ACTIVE") {
    return prisma.$queryRaw<any[]>`
      SELECT DISTINCT
        p.*,
        COALESCE(pref."messages_enabled", true) AS "messages_enabled",
        true AS "push_active"
      FROM "candidate_portal_profiles" p
      INNER JOIN "candidate_push_subscriptions" s
        ON s."profile_id" = p."id"
       AND s."active" = true
      LEFT JOIN "candidate_push_preferences" pref
        ON pref."profile_id" = p."id"
      WHERE p."company_id" = ${companyId}::uuid
        AND p."access_active" = true
      ORDER BY p."created_at" DESC
      LIMIT 5000
    `;
  }

  if (audienceMode === "SELECTED" && selectedProfileIds.length) {
    return prisma.$queryRaw<any[]>`
      SELECT
        p.*,
        COALESCE(pref."messages_enabled", true) AS "messages_enabled",
        EXISTS (
          SELECT 1
          FROM "candidate_push_subscriptions" s
          WHERE s."profile_id" = p."id"
            AND s."active" = true
        ) AS "push_active"
      FROM "candidate_portal_profiles" p
      LEFT JOIN "candidate_push_preferences" pref
        ON pref."profile_id" = p."id"
      WHERE p."company_id" = ${companyId}::uuid
        AND p."access_active" = true
        AND p."id" IN (${Prisma.join(selectedProfileIds)})
      ORDER BY p."created_at" DESC
    `;
  }

  return prisma.$queryRaw<any[]>`
    SELECT
      p.*,
      COALESCE(pref."messages_enabled", true) AS "messages_enabled",
      EXISTS (
        SELECT 1
        FROM "candidate_push_subscriptions" s
        WHERE s."profile_id" = p."id"
          AND s."active" = true
      ) AS "push_active"
    FROM "candidate_portal_profiles" p
    LEFT JOIN "candidate_push_preferences" pref
      ON pref."profile_id" = p."id"
    WHERE p."company_id" = ${companyId}::uuid
      AND p."access_active" = true
    ORDER BY p."created_at" DESC
    LIMIT 5000
  `;
}

export async function GET(req: NextRequest) {
  try {
    const { companyId } = await requireCompany(req);
    const reportPostId = cleanPortalText(
      req.nextUrl.searchParams.get("reportPostId"),
      100
    );

    if (reportPostId) {
      const reportRows = await prisma.$queryRaw<any[]>`
        SELECT
          r."profile_id",
          prof."full_name",
          prof."cpf_normalized",
          prof."phone_normalized",
          prof."email_normalized",
          r."created_at" AS "recipient_created_at",
          r."viewed_at",
          EXISTS (
            SELECT 1
            FROM "candidate_push_subscriptions" s
            WHERE s."profile_id" = r."profile_id"
              AND s."active" = true
          ) AS "push_active",
          COALESCE(
            BOOL_OR(
              d."sent_at" IS NOT NULL
              OR d."status" IN ('sent','clicked','opened','viewed')
            ),
            false
          ) AS "push_sent",
          COALESCE(BOOL_OR(d."clicked_at" IS NOT NULL), false)
            AS "push_clicked",
          COALESCE(BOOL_OR(d."opened_at" IS NOT NULL), false)
            AS "push_opened",
          COALESCE(
            BOOL_OR(
              d."failed_at" IS NOT NULL
              OR d."status" = 'failed'
            ),
            false
          ) AS "push_failed",
          MAX(d."sent_at") AS "push_sent_at",
          MAX(d."clicked_at") AS "push_clicked_at",
          MAX(d."opened_at") AS "push_opened_at",
          MAX(d."failed_at") AS "push_failed_at",
          MAX(d."error_message") FILTER (
            WHERE d."error_message" IS NOT NULL
          ) AS "error_message"
        FROM "candidate_portal_post_recipients" r
        INNER JOIN "candidate_portal_profiles" prof
          ON prof."id" = r."profile_id"
        INNER JOIN "candidate_portal_posts" post
          ON post."id" = r."post_id"
        LEFT JOIN "candidate_notifications" n
          ON n."campaign_id" = post."campaign_id"
         AND n."profile_id" = r."profile_id"
        LEFT JOIN "candidate_notification_deliveries" d
          ON d."notification_id" = n."id"
        WHERE r."post_id" = ${reportPostId}::uuid
          AND r."company_id" = ${companyId}::uuid
        GROUP BY
          r."profile_id",
          prof."full_name",
          prof."cpf_normalized",
          prof."phone_normalized",
          prof."email_normalized",
          r."created_at",
          r."viewed_at"
        ORDER BY prof."full_name" ASC
      `;

      return NextResponse.json({
        success: true,
        report: reportRows,
      });
    }

    const posts = await prisma.$queryRaw<any[]>`
      SELECT
        p.*,
        (
          SELECT COUNT(*)::int
          FROM "candidate_portal_post_recipients" r
          WHERE r."post_id" = p."id"
        ) AS "recipient_count",
        (
          SELECT COUNT(*)::int
          FROM "candidate_portal_post_recipients" r
          WHERE r."post_id" = p."id"
            AND r."viewed_at" IS NOT NULL
        ) AS "viewed_count",
        (
          SELECT COUNT(DISTINCT n."profile_id")::int
          FROM "candidate_notifications" n
          INNER JOIN "candidate_notification_deliveries" d
            ON d."notification_id" = n."id"
          WHERE n."campaign_id" = p."campaign_id"
            AND (
              d."sent_at" IS NOT NULL
              OR d."status" IN ('sent','clicked','opened','viewed')
            )
        ) AS "push_sent_count",
        (
          SELECT COUNT(DISTINCT n."profile_id")::int
          FROM "candidate_notifications" n
          INNER JOIN "candidate_notification_deliveries" d
            ON d."notification_id" = n."id"
          WHERE n."campaign_id" = p."campaign_id"
            AND (
              d."failed_at" IS NOT NULL
              OR d."status" = 'failed'
            )
        ) AS "push_failed_count"
      FROM "candidate_portal_posts" p
      WHERE p."company_id" = ${companyId}::uuid
      ORDER BY p."published_at" DESC
      LIMIT 100
    `;

    return NextResponse.json({
      success: true,
      posts,
    });
  } catch (error: any) {
    console.error("[CANDIDATE_PORTAL_POSTS_GET]", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Erro ao carregar publicações.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let uploadedPath: string | null = null;
  let postId: string | null = null;

  try {
    const { companyId, userId } = await requireCompany(req);
    const form = await req.formData();

    const title = cleanPortalText(form.get("title"), 120);
    const body = cleanPortalText(form.get("body"), 5000);

    const contentTypeRaw = cleanPortalText(
      form.get("contentType"),
      40
    ).toUpperCase();

    const contentType = CONTENT_TYPES.has(contentTypeRaw)
      ? contentTypeRaw
      : "NOVIDADE";

    const expiresRaw = cleanPortalText(
      form.get("expiresAt"),
      20
    );

    const expiresAt =
      /^\d{4}-\d{2}-\d{2}$/.test(expiresRaw)
        ? `${expiresRaw}T23:59:59-03:00`
        : null;

    const audienceModeRaw = cleanPortalText(
      form.get("audienceMode"),
      40
    ).toUpperCase();

    const audienceMode = AUDIENCE_MODES.has(audienceModeRaw)
      ? audienceModeRaw
      : "ALL_PORTAL";

    const selectedProfileIds = parseSelected(
      form.get("selectedProfileIds")
    );

    if (!title || !body) {
      return NextResponse.json(
        {
          success: false,
          error: "Informe título e mensagem da publicação.",
        },
        { status: 400 }
      );
    }

    if (!expiresAt) {
      return NextResponse.json(
        {
          success: false,
          error: "Informe até que dia a publicação ficará disponível no Portal.",
        },
        { status: 400 }
      );
    }

    if (new Date(expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        {
          success: false,
          error: "A data final da publicação precisa ser hoje ou uma data futura.",
        },
        { status: 400 }
      );
    }

    if (
      audienceMode === "SELECTED" &&
      !selectedProfileIds.length
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Selecione pelo menos um candidato.",
        },
        { status: 400 }
      );
    }

    const file = form.get("image");
    let mediaMime: string | null = null;
    let mediaName: string | null = null;

    if (file instanceof File && file.size > 0) {
      if (!CANDIDATE_MEDIA_MIME.has(file.type)) {
        return NextResponse.json(
          {
            success: false,
            error: "A imagem deve ser JPG, PNG ou WEBP.",
          },
          { status: 400 }
        );
      }

      if (file.size > CANDIDATE_MEDIA_MAX_BYTES) {
        return NextResponse.json(
          {
            success: false,
            error: "A imagem deve ter no máximo 10 MB.",
          },
          { status: 400 }
        );
      }

      mediaMime = file.type;
      mediaName = file.name;
    }

    const targets = await profileTargets(
      companyId,
      audienceMode,
      selectedProfileIds
    );

    if (!targets.length) {
      return NextResponse.json(
        {
          success: false,
          error: "Nenhum candidato encontrado para este público.",
        },
        { status: 409 }
      );
    }

    const postRows = await prisma.$queryRaw<any[]>`
      INSERT INTO "candidate_portal_posts" (
        "company_id",
        "title",
        "body",
        "content_type",
        "expires_at",
        "audience_mode",
        "created_by"
      )
      VALUES (
        ${companyId}::uuid,
        ${title},
        ${body},
        ${contentType},
        ${expiresAt}::timestamptz,
        ${audienceMode},
        ${userId || null}
      )
      RETURNING *
    `;

    const post = postRows[0];
    postId = post.id;

    if (file instanceof File && file.size > 0) {
      const safeName = sanitizeCandidateMediaName(file.name);
      uploadedPath = `${companyId}/${post.id}/${Date.now()}_${safeName}`;

      await uploadCandidateMedia({
        path: uploadedPath,
        mimeType: file.type,
        bytes: await file.arrayBuffer(),
      });

      await prisma.$executeRaw`
        UPDATE "candidate_portal_posts"
        SET
          "media_bucket" = ${CANDIDATE_MEDIA_BUCKET},
          "media_path" = ${uploadedPath},
          "media_mime" = ${mediaMime},
          "media_original_name" = ${mediaName},
          "updated_at" = now()
        WHERE "id" = ${post.id}::uuid
      `;
    }

    const campaignRows = await prisma.$queryRaw<any[]>`
      INSERT INTO "candidate_push_campaigns" (
        "company_id",
        "source",
        "title",
        "message",
        "target_count",
        "eligible_count",
        "created_by"
      )
      VALUES (
        ${companyId}::uuid,
        'portal_post',
        ${title},
        ${body.slice(0, 500)},
        ${targets.length},
        0,
        ${userId || null}
      )
      RETURNING *
    `;

    const campaign = campaignRows[0];

    await prisma.$executeRaw`
      UPDATE "candidate_portal_posts"
      SET
        "campaign_id" = ${campaign.id}::uuid,
        "updated_at" = now()
      WHERE "id" = ${post.id}::uuid
    `;

    let pushEligible = 0;
    let deliveriesCreated = 0;

    for (const profile of targets) {
      await prisma.$executeRaw`
        INSERT INTO "candidate_portal_post_recipients" (
          "company_id",
          "post_id",
          "profile_id"
        )
        VALUES (
          ${companyId}::uuid,
          ${post.id}::uuid,
          ${profile.id}::uuid
        )
        ON CONFLICT ("post_id","profile_id") DO NOTHING
      `;

      const portalLink = buildCandidatePortalUrl(
        req.nextUrl.origin,
        profile
      );

      const deepLink = `${portalLink}?tab=novidades&post=${encodeURIComponent(
        post.id
      )}`;

      const notificationRows = await prisma.$queryRaw<any[]>`
        INSERT INTO "candidate_notifications" (
          "company_id",
          "profile_id",
          "candidate_id",
          "campaign_id",
          "type",
          "title",
          "body",
          "deep_link"
        )
        VALUES (
          ${companyId}::uuid,
          ${profile.id}::uuid,
          ${profile.candidate_id || null},
          ${campaign.id}::uuid,
          ${NOTIFICATION_TYPE_BY_CONTENT[contentType] || "MESSAGE"},
          ${title},
          ${body.slice(0, 500)},
          ${deepLink}
        )
        RETURNING "id"
      `;

      if (
        profile.push_active === true &&
        profile.messages_enabled !== false
      ) {
        pushEligible += 1;

        const created = await prisma.$executeRaw`
          INSERT INTO "candidate_notification_deliveries" (
            "company_id",
            "notification_id",
            "subscription_id"
          )
          SELECT
            ${companyId}::uuid,
            ${notificationRows[0].id}::uuid,
            s."id"
          FROM "candidate_push_subscriptions" s
          WHERE s."profile_id" = ${profile.id}::uuid
            AND s."active" = true
          ON CONFLICT (
            "notification_id",
            "subscription_id"
          ) DO NOTHING
        `;

        deliveriesCreated += Number(created || 0);
      }
    }

    await prisma.$executeRaw`
      UPDATE "candidate_push_campaigns"
      SET
        "eligible_count" = ${pushEligible},
        "queued_count" = ${deliveriesCreated},
        "skipped_count" = ${Math.max(
          0,
          targets.length - pushEligible
        )},
        "updated_at" = now()
      WHERE "id" = ${campaign.id}::uuid
    `;

    const processing = await processCandidatePushQueue({
      companyId,
      limit: 150,
    });

    return NextResponse.json({
      success: true,
      postId: post.id,
      recipients: targets.length,
      pushEligible,
      deliveriesCreated,
      processing,
    });
  } catch (error: any) {
    console.error("[CANDIDATE_PORTAL_POSTS_POST]", error);

    if (uploadedPath) {
      await deleteCandidateMedia(uploadedPath).catch(() => null);
    }

    if (postId) {
      await prisma.$executeRaw`
        DELETE FROM "candidate_portal_posts"
        WHERE "id" = ${postId}::uuid
      `.catch(() => null);
    }

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Erro ao publicar conteúdo.",
      },
      { status: 500 }
    );
  }
}
