import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/server-company";
import {
  buildCandidatePortalUrl,
  candidateVisibleCompanyIds,
  cleanPortalText,
} from "@/lib/candidate-portal-access";
import { processCandidatePushQueue } from "@/lib/candidate-push-dispatch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function listIds(value: unknown, limit = 3000) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => cleanPortalText(item, 100))
        .filter(Boolean)
    )
  ).slice(0, limit);
}

async function ensureConversation(
  companyId: string,
  profile: any
) {
  const rows = await prisma.$queryRaw<any[]>`
    INSERT INTO "candidate_chat_conversations" (
      "company_id",
      "profile_id",
      "candidate_id"
    )
    VALUES (
      ${companyId}::uuid,
      ${profile.id}::uuid,
      ${profile.candidate_id || null}
    )
    ON CONFLICT ("profile_id")
    DO UPDATE SET
      "candidate_id" = COALESCE(
        EXCLUDED."candidate_id",
        "candidate_chat_conversations"."candidate_id"
      ),
      "updated_at" = now()
    RETURNING *
  `;

  return rows[0];
}

async function profileRows(companyId: string) {
  return prisma.$queryRaw<any[]>`
    SELECT
      p.*,
      EXISTS (
        SELECT 1
        FROM "candidate_push_subscriptions" s
        WHERE s."profile_id" = p."id"
          AND s."active" = true
      ) AS "push_active"
    FROM "candidate_portal_profiles" p
    WHERE p."company_id" = ${companyId}::uuid
      AND p."access_active" = true
    ORDER BY p."updated_at" DESC
    LIMIT 5000
  `;
}

async function enrichProfiles(companyId: string, profiles: any[]) {
  const candidateIds = profiles
    .map((item) => item.candidate_id)
    .filter(Boolean);

  const candidates = candidateIds.length
    ? await prisma.candidateProfile.findMany({
        where: {
          id: { in: candidateIds },
          company_id: { in: candidateVisibleCompanyIds(companyId) },
        },
        select: {
          id: true,
          name: true,
          city: true,
          state: true,
          education: true,
          course: true,
          lastRole: true,
          resumeOrigin: true,
          status: true,
          mobile: true,
          phone: true,
          email: true,
        },
      })
    : [];

  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));

  return profiles.map((profile) => {
    const candidate = profile.candidate_id
      ? byId.get(profile.candidate_id)
      : null;

    return {
      ...profile,
      candidate,
      city: candidate?.city || null,
      state: candidate?.state || null,
      education: candidate?.education || null,
      course: candidate?.course || null,
      last_role: candidate?.lastRole || null,
      origin: candidate?.resumeOrigin || null,
      candidate_status: candidate?.status || null,
    };
  });
}

function filterProfiles(rows: any[], req: NextRequest) {
  const q = cleanPortalText(req.nextUrl.searchParams.get("q"), 200).toLowerCase();
  const push = cleanPortalText(req.nextUrl.searchParams.get("push"), 30);
  const portal = cleanPortalText(req.nextUrl.searchParams.get("portal"), 30);
  const city = cleanPortalText(req.nextUrl.searchParams.get("city"), 120).toLowerCase();
  const education = cleanPortalText(req.nextUrl.searchParams.get("education"), 160).toLowerCase();
  const role = cleanPortalText(req.nextUrl.searchParams.get("role"), 160).toLowerCase();
  const origin = cleanPortalText(req.nextUrl.searchParams.get("origin"), 160).toLowerCase();

  return rows.filter((item) => {
    if (push === "active" && !item.push_active) return false;
    if (push === "inactive" && item.push_active) return false;

    if (portal === "active" && item.portal_status !== "ACTIVE") return false;
    if (portal === "inactive" && item.portal_status === "ACTIVE") return false;

    if (
      city &&
      !`${item.city || ""} ${item.state || ""}`.toLowerCase().includes(city)
    ) {
      return false;
    }

    if (
      education &&
      !`${item.education || ""} ${item.course || ""}`
        .toLowerCase()
        .includes(education)
    ) {
      return false;
    }

    if (role && !String(item.last_role || "").toLowerCase().includes(role)) {
      return false;
    }

    if (origin && !String(item.origin || "").toLowerCase().includes(origin)) {
      return false;
    }

    if (q) {
      const haystack = [
        item.full_name,
        item.cpf_normalized,
        item.phone_normalized,
        item.email_normalized,
        item.city,
        item.state,
        item.education,
        item.course,
        item.last_role,
        item.origin,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

export async function GET(req: NextRequest) {
  try {
    const { companyId } = await requireCompany(req);
    const mode = cleanPortalText(req.nextUrl.searchParams.get("mode"), 50);

    if (mode === "bootstrap") {
      const lists = await prisma.$queryRaw<any[]>`
        SELECT
          l.*,
          COUNT(m."id")::int AS "member_count",
          COALESCE(
            ARRAY_AGG(m."profile_id"::text)
              FILTER (WHERE m."profile_id" IS NOT NULL),
            ARRAY[]::text[]
          ) AS "profile_ids"
        FROM "candidate_portal_broadcast_lists" l
        LEFT JOIN "candidate_portal_broadcast_list_members" m
          ON m."list_id" = l."id"
        WHERE l."company_id" = ${companyId}::uuid
        GROUP BY l."id"
        ORDER BY l."updated_at" DESC
      `;

      const enriched = await enrichProfiles(
        companyId,
        await profileRows(companyId)
      );

      const unique = (items: Array<string | null | undefined>) =>
        Array.from(new Set(items.filter(Boolean).map(String))).sort();

      return NextResponse.json({
        success: true,
        lists,
        filters: {
          cities: unique(enriched.map((item) => item.city)),
          education: unique(enriched.map((item) => item.education)),
          roles: unique(enriched.map((item) => item.last_role)),
          origins: unique(enriched.map((item) => item.origin)),
        },
      });
    }

    const enriched = await enrichProfiles(
      companyId,
      await profileRows(companyId)
    );

    return NextResponse.json({
      success: true,
      profiles: filterProfiles(enriched, req),
    });
  } catch (error: any) {
    console.error("[CANDIDATE_BROADCASTS_GET]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao carregar transmissões." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, userId } = await requireCompany(req);
    const body = await req.json().catch(() => ({}));
    const action = cleanPortalText(body?.action, 80);

    if (action === "create_list") {
      const name = cleanPortalText(body?.name, 200);
      const profileIds = listIds(body?.profileIds, 5000);

      if (!name || !profileIds.length) {
        return NextResponse.json(
          { success: false, error: "Informe o nome e os candidatos da lista." },
          { status: 400 }
        );
      }

      const rows = await prisma.$queryRaw<any[]>`
        INSERT INTO "candidate_portal_broadcast_lists" (
          "company_id",
          "name",
          "created_by"
        )
        VALUES (
          ${companyId}::uuid,
          ${name},
          ${userId || null}
        )
        RETURNING *
      `;

      const list = rows[0];

      for (const profileId of profileIds) {
        await prisma.$executeRaw`
          INSERT INTO "candidate_portal_broadcast_list_members" (
            "company_id",
            "list_id",
            "profile_id"
          )
          SELECT
            ${companyId}::uuid,
            ${list.id}::uuid,
            p."id"
          FROM "candidate_portal_profiles" p
          WHERE p."id" = ${profileId}::uuid
            AND p."company_id" = ${companyId}::uuid
          ON CONFLICT ("list_id","profile_id") DO NOTHING
        `;
      }

      return NextResponse.json({
        success: true,
        list: { ...list, member_count: profileIds.length },
      });
    }

    if (action === "replace_list") {
      const listId = cleanPortalText(body?.listId, 100);
      const profileIds = listIds(body?.profileIds, 5000);

      if (!listId) {
        return NextResponse.json(
          { success: false, error: "Lista não informada." },
          { status: 400 }
        );
      }

      await prisma.$executeRaw`
        DELETE FROM "candidate_portal_broadcast_list_members"
        WHERE "list_id" = ${listId}::uuid
          AND "company_id" = ${companyId}::uuid
      `;

      for (const profileId of profileIds) {
        await prisma.$executeRaw`
          INSERT INTO "candidate_portal_broadcast_list_members" (
            "company_id",
            "list_id",
            "profile_id"
          )
          SELECT
            ${companyId}::uuid,
            ${listId}::uuid,
            p."id"
          FROM "candidate_portal_profiles" p
          WHERE p."id" = ${profileId}::uuid
            AND p."company_id" = ${companyId}::uuid
          ON CONFLICT ("list_id","profile_id") DO NOTHING
        `;
      }

      await prisma.$executeRaw`
        UPDATE "candidate_portal_broadcast_lists"
        SET "updated_at" = now()
        WHERE "id" = ${listId}::uuid
          AND "company_id" = ${companyId}::uuid
      `;

      return NextResponse.json({
        success: true,
        member_count: profileIds.length,
      });
    }

    if (action === "send") {
      const listId = cleanPortalText(body?.listId, 100);
      const message = cleanPortalText(body?.message, 5000);
      let profileIds = listIds(body?.profileIds, 5000);

      if (listId) {
        const members = await prisma.$queryRaw<any[]>`
          SELECT m."profile_id"
          FROM "candidate_portal_broadcast_list_members" m
          INNER JOIN "candidate_portal_broadcast_lists" l
            ON l."id" = m."list_id"
          WHERE m."list_id" = ${listId}::uuid
            AND l."company_id" = ${companyId}::uuid
        `;
        profileIds = members.map((item) => String(item.profile_id));
      }

      if (!message || !profileIds.length) {
        return NextResponse.json(
          { success: false, error: "Informe mensagem e destinatários." },
          { status: 400 }
        );
      }

      const profiles = await prisma.$queryRaw<any[]>`
        SELECT
          p.*,
          EXISTS (
            SELECT 1
            FROM "candidate_push_subscriptions" s
            WHERE s."profile_id" = p."id"
              AND s."active" = true
          ) AS "push_active"
        FROM "candidate_portal_profiles" p
        WHERE p."company_id" = ${companyId}::uuid
          AND p."access_active" = true
      `;

      const allowed = profiles.filter((p) => profileIds.includes(String(p.id)));

      let messageDelivered = 0;
      let pushEligible = 0;
      let pushDeliveries = 0;
      let withoutPush = 0;

      for (const profile of allowed) {
        const conversation = await ensureConversation(companyId, profile);

        await prisma.$executeRaw`
          INSERT INTO "candidate_chat_messages" (
            "company_id",
            "conversation_id",
            "profile_id",
            "sender_type",
            "sender_user_id",
            "body"
          )
          VALUES (
            ${companyId}::uuid,
            ${conversation.id}::uuid,
            ${profile.id}::uuid,
            'RH',
            ${userId || null},
            ${message}
          )
        `;

        await prisma.$executeRaw`
          UPDATE "candidate_chat_conversations"
          SET
            "last_message_text" = ${message.slice(0, 500)},
            "last_message_at" = now(),
            "candidate_unread" = "candidate_unread" + 1,
            "updated_at" = now()
          WHERE "id" = ${conversation.id}::uuid
        `;

        messageDelivered += 1;

        if (profile.push_active) {
          pushEligible += 1;

          const deepLink = `${buildCandidatePortalUrl(
            req.nextUrl.origin,
            profile
          )}?tab=chat`;

          const notificationRows = await prisma.$queryRaw<any[]>`
            INSERT INTO "candidate_notifications" (
              "company_id",
              "profile_id",
              "candidate_id",
              "type",
              "title",
              "body",
              "deep_link"
            )
            VALUES (
              ${companyId}::uuid,
              ${profile.id}::uuid,
              ${profile.candidate_id || null},
              'MESSAGE',
              '💬 Nova mensagem da MOTIVAR RH',
              ${message.slice(0, 500)},
              ${deepLink}
            )
            RETURNING "id"
          `;

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
            LEFT JOIN "candidate_push_preferences" pref
              ON pref."profile_id" = s."profile_id"
            WHERE s."profile_id" = ${profile.id}::uuid
              AND s."active" = true
              AND COALESCE(pref."messages_enabled", true) = true
            ON CONFLICT ("notification_id","subscription_id") DO NOTHING
          `;

          pushDeliveries += Number(created || 0);
        } else {
          withoutPush += 1;
        }
      }

      const push = await processCandidatePushQueue({
        companyId,
        limit: 250,
      });

      return NextResponse.json({
        success: true,
        result: {
          selected: profileIds.length,
          eligible: allowed.length,
          message_delivered: messageDelivered,
          push_eligible: pushEligible,
          push_deliveries: pushDeliveries,
          push_sent: push.sent,
          push_failed: push.failed,
          without_push: withoutPush,
          without_portal: Math.max(0, profileIds.length - allowed.length),
          failed: 0,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: "Ação inválida." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[CANDIDATE_BROADCASTS_POST]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Erro na transmissão." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { companyId } = await requireCompany(req);
    const listId = cleanPortalText(req.nextUrl.searchParams.get("listId"), 100);

    if (!listId) {
      return NextResponse.json(
        { success: false, error: "Lista não informada." },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`
      DELETE FROM "candidate_portal_broadcast_lists"
      WHERE "id" = ${listId}::uuid
        AND "company_id" = ${companyId}::uuid
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao excluir lista." },
      { status: 500 }
    );
  }
}
