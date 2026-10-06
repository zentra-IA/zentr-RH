import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/server-company";
import {
  buildCandidatePortalUrl,
  cleanPortalText,
} from "@/lib/candidate-portal-access";
import { processCandidatePushQueue } from "@/lib/candidate-push-dispatch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function ensureConversation(companyId: string, profileId: string) {
  const profileRows = await prisma.$queryRaw<any[]>`
    SELECT *
    FROM "candidate_portal_profiles"
    WHERE "id" = ${profileId}::uuid
      AND "company_id" = ${companyId}::uuid
    LIMIT 1
  `;

  const profile = profileRows[0];
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  const rows = await prisma.$queryRaw<any[]>`
    INSERT INTO "candidate_chat_conversations" (
      "company_id","profile_id","candidate_id"
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

  return { profile, conversation: rows[0] };
}

async function listConversations(companyId: string) {
  const conversations = await prisma.$queryRaw<any[]>`
    SELECT
      c."id",
      c."profile_id",
      c."candidate_id",
      c."last_message_text",
      c."last_message_at",
      c."candidate_unread",
      c."rh_unread",
      c."automation_paused",
      p."full_name",
      p."cpf_normalized",
      p."phone_normalized",
      p."email_normalized",
      p."portal_status",
      p."push_status",
      EXISTS (
        SELECT 1
        FROM "candidate_push_subscriptions" s
        WHERE s."profile_id" = p."id"
          AND s."active" = true
      ) AS "push_active"
    FROM "candidate_chat_conversations" c
    INNER JOIN "candidate_portal_profiles" p
      ON p."id" = c."profile_id"
    WHERE c."company_id" = ${companyId}::uuid
    ORDER BY
      c."rh_unread" DESC,
      c."last_message_at" DESC NULLS LAST,
      c."updated_at" DESC
    LIMIT 1000
  `;

  const profilesWithoutConversation = await prisma.$queryRaw<any[]>`
    SELECT
      NULL::uuid AS "id",
      p."id" AS "profile_id",
      p."candidate_id",
      NULL::text AS "last_message_text",
      NULL::timestamptz AS "last_message_at",
      0::int AS "candidate_unread",
      0::int AS "rh_unread",
      false AS "automation_paused",
      p."full_name",
      p."cpf_normalized",
      p."phone_normalized",
      p."email_normalized",
      p."portal_status",
      p."push_status",
      EXISTS (
        SELECT 1
        FROM "candidate_push_subscriptions" s
        WHERE s."profile_id" = p."id"
          AND s."active" = true
      ) AS "push_active"
    FROM "candidate_portal_profiles" p
    WHERE p."company_id" = ${companyId}::uuid
      AND p."access_active" = true
      AND NOT EXISTS (
        SELECT 1
        FROM "candidate_chat_conversations" c
        WHERE c."profile_id" = p."id"
      )
    ORDER BY p."created_at" DESC
    LIMIT 1000
  `;

  return [...conversations, ...profilesWithoutConversation];
}

export async function GET(req: NextRequest) {
  try {
    const { companyId } = await requireCompany(req);
    const mode = cleanPortalText(req.nextUrl.searchParams.get("mode"), 30);
    const profileId = cleanPortalText(
      req.nextUrl.searchParams.get("profileId"),
      100
    );

    if (mode === "summary") {
      const rows = await prisma.$queryRaw<any[]>`
        SELECT
          COALESCE(SUM(c."rh_unread"),0)::int AS "unread_total",
          COUNT(*) FILTER (WHERE c."rh_unread" > 0)::int AS "unread_conversations"
        FROM "candidate_chat_conversations" c
        WHERE c."company_id" = ${companyId}::uuid
      `;

      const recent = await prisma.$queryRaw<any[]>`
        SELECT
          c."profile_id",
          c."last_message_text",
          c."last_message_at",
          c."rh_unread",
          p."full_name"
        FROM "candidate_chat_conversations" c
        INNER JOIN "candidate_portal_profiles" p
          ON p."id" = c."profile_id"
        WHERE c."company_id" = ${companyId}::uuid
          AND c."rh_unread" > 0
        ORDER BY c."last_message_at" DESC NULLS LAST
        LIMIT 5
      `;

      return NextResponse.json({
        success: true,
        unreadTotal: Number(rows[0]?.unread_total || 0),
        unreadConversations: Number(rows[0]?.unread_conversations || 0),
        recent,
      });
    }

    if (profileId) {
      const { profile, conversation } =
        await ensureConversation(companyId, profileId);

      const messages = await prisma.$queryRaw<any[]>`
        SELECT
          "id",
          "sender_type",
          "sender_user_id",
          "body",
          "read_at",
          "created_at"
        FROM "candidate_chat_messages"
        WHERE "conversation_id" = ${conversation.id}::uuid
          AND "company_id" = ${companyId}::uuid
        ORDER BY "created_at" ASC
        LIMIT 500
      `;

      await prisma.$executeRaw`
        UPDATE "candidate_chat_messages"
        SET "read_at" = COALESCE("read_at", now())
        WHERE "conversation_id" = ${conversation.id}::uuid
          AND "company_id" = ${companyId}::uuid
          AND "sender_type" = 'CANDIDATE'
      `;

      await prisma.$executeRaw`
        UPDATE "candidate_chat_conversations"
        SET "rh_unread" = 0, "updated_at" = now()
        WHERE "id" = ${conversation.id}::uuid
      `;

      return NextResponse.json({
        success: true,
        conversation,
        profile: {
          id: profile.id,
          name: profile.full_name,
          cpf: profile.cpf_normalized,
          phone: profile.phone_normalized,
          email: profile.email_normalized,
          pushStatus: profile.push_status,
          portalStatus: profile.portal_status,
        },
        messages,
      });
    }

    return NextResponse.json({
      success: true,
      conversations: await listConversations(companyId),
    });
  } catch (error: any) {
    console.error("[CANDIDATE_CHAT_ADMIN_GET]", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error?.message === "PROFILE_NOT_FOUND"
            ? "Candidato não encontrado."
            : error?.message || "Erro ao carregar chat.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, userId } = await requireCompany(req);
    const body = await req.json().catch(() => ({}));

    const profileId = cleanPortalText(body?.profileId, 100);
    const message = cleanPortalText(body?.message, 5000);

    if (!profileId || !message) {
      return NextResponse.json(
        { success: false, error: "Informe o candidato e a mensagem." },
        { status: 400 }
      );
    }

    const { profile, conversation } =
      await ensureConversation(companyId, profileId);

    const messageRows = await prisma.$queryRaw<any[]>`
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
      RETURNING *
    `;

    await prisma.$executeRaw`
      UPDATE "candidate_chat_conversations"
      SET
        "candidate_id" = COALESCE(
          ${profile.candidate_id || null},
          "candidate_id"
        ),
        "last_message_text" = ${message.slice(0, 500)},
        "last_message_at" = now(),
        "candidate_unread" = "candidate_unread" + 1,
        "automation_paused" = true,
        "automation_paused_at" = now(),
        "automation_paused_by" = ${userId || "RH"},
        "updated_at" = now()
      WHERE "id" = ${conversation.id}::uuid
    `;

    const portalLink = buildCandidatePortalUrl(req.nextUrl.origin, profile);
    const deepLink = `${portalLink}?tab=chat`;

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

    await prisma.$executeRaw`
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

    const push = await processCandidatePushQueue({
      companyId,
      limit: 30,
    });

    return NextResponse.json({
      success: true,
      message: messageRows[0],
      automationPaused: true,
      push,
    });
  } catch (error: any) {
    console.error("[CANDIDATE_CHAT_ADMIN_POST]", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error?.message === "PROFILE_NOT_FOUND"
            ? "Candidato não encontrado."
            : error?.message || "Erro ao enviar mensagem.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { companyId, userId } = await requireCompany(req);
    const body = await req.json().catch(() => ({}));
    const profileId = cleanPortalText(body?.profileId, 100);
    const action = cleanPortalText(body?.action, 50);

    if (!profileId || !["pause_automation", "resume_automation"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Ação inválida." },
        { status: 400 }
      );
    }

    const { conversation } = await ensureConversation(companyId, profileId);
    const paused = action === "pause_automation";

    await prisma.$executeRaw`
      UPDATE "candidate_chat_conversations"
      SET
        "automation_paused" = ${paused},
        "automation_paused_at" = ${paused ? new Date() : null},
        "automation_paused_by" = ${paused ? userId || "RH" : null},
        "updated_at" = now()
      WHERE "id" = ${conversation.id}::uuid
        AND "company_id" = ${companyId}::uuid
    `;

    return NextResponse.json({
      success: true,
      automationPaused: paused,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao atualizar automação." },
      { status: 500 }
    );
  }
}
