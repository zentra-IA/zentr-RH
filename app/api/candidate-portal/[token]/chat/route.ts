import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  cleanPortalText,
  resolveCandidatePortalToken,
} from "@/lib/candidate-portal-access";
import {
  findCandidateChatAutomation,
  renderCandidateAutomationResponse,
} from "@/lib/candidate-chat-automation";
import { processCandidatePushQueue } from "@/lib/candidate-push-dispatch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function ensureConversation(profile: any) {
  const rows = await prisma.$queryRaw<any[]>`
    INSERT INTO "candidate_chat_conversations" (
      "company_id",
      "profile_id",
      "candidate_id"
    )
    VALUES (
      ${profile.company_id}::uuid,
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

async function queueCandidateMessagePush(
  profile: any,
  token: string,
  body: string
) {
  const deepLink = `/candidato/${encodeURIComponent(token)}?tab=chat`;

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
      ${profile.company_id}::uuid,
      ${profile.id}::uuid,
      ${profile.candidate_id || null},
      'MESSAGE',
      '💬 Nova mensagem da MOTIVAR RH',
      ${body.slice(0, 500)},
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
      ${profile.company_id}::uuid,
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

  return processCandidatePushQueue({
    companyId: profile.company_id,
    limit: 30,
  });
}

export async function GET(
  req: NextRequest,
  context: { params: { token: string } | Promise<{ token: string }> }
) {
  try {
    const params = await Promise.resolve(context.params);
    const token = decodeURIComponent(params.token);
    const profile = await resolveCandidatePortalToken(token);

    if (!profile.identity_confirmed_at) {
      return NextResponse.json(
        { success: false, error: "Confirme sua identidade primeiro." },
        { status: 401 }
      );
    }

    const conversation = await ensureConversation(profile);
    const mode = cleanPortalText(req.nextUrl.searchParams.get("mode"), 30);

    if (mode === "summary") {
      return NextResponse.json({
        success: true,
        unread: Number(conversation.candidate_unread || 0),
        lastMessage: conversation.last_message_text || null,
        lastMessageAt: conversation.last_message_at || null,
        automationPaused: Boolean(conversation.automation_paused),
      });
    }

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
        AND "company_id" = ${profile.company_id}::uuid
      ORDER BY "created_at" ASC
      LIMIT 500
    `;

    await prisma.$executeRaw`
      UPDATE "candidate_chat_messages"
      SET "read_at" = COALESCE("read_at", now())
      WHERE "conversation_id" = ${conversation.id}::uuid
        AND "company_id" = ${profile.company_id}::uuid
        AND "sender_type" = 'RH'
    `;

    await prisma.$executeRaw`
      UPDATE "candidate_chat_conversations"
      SET
        "candidate_unread" = 0,
        "updated_at" = now()
      WHERE "id" = ${conversation.id}::uuid
    `;

    return NextResponse.json({
      success: true,
      messages,
      automationPaused: Boolean(conversation.automation_paused),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error:
          error?.message === "PORTAL_TOKEN_INVALID" ||
          error?.message === "PORTAL_ACCESS_NOT_FOUND"
            ? "Link inválido ou desativado."
            : error?.message || "Erro ao carregar mensagens.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: { token: string } | Promise<{ token: string }> }
) {
  try {
    const params = await Promise.resolve(context.params);
    const token = decodeURIComponent(params.token);
    const profile = await resolveCandidatePortalToken(token);

    if (!profile.identity_confirmed_at) {
      return NextResponse.json(
        { success: false, error: "Confirme sua identidade primeiro." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const message = cleanPortalText(body?.message, 5000);

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Digite uma mensagem." },
        { status: 400 }
      );
    }

    const conversation = await ensureConversation(profile);

    const rows = await prisma.$queryRaw<any[]>`
      INSERT INTO "candidate_chat_messages" (
        "company_id",
        "conversation_id",
        "profile_id",
        "sender_type",
        "body"
      )
      VALUES (
        ${profile.company_id}::uuid,
        ${conversation.id}::uuid,
        ${profile.id}::uuid,
        'CANDIDATE',
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
        "rh_unread" = "rh_unread" + 1,
        "updated_at" = now()
      WHERE "id" = ${conversation.id}::uuid
    `;

    let automatedMessage: any = null;

    if (!conversation.automation_paused) {
      const automation = await findCandidateChatAutomation(
        profile.company_id,
        message
      );

      if (automation) {
        const responseText = renderCandidateAutomationResponse(
          automation,
          profile
        );

        if (responseText) {
          const autoRows = await prisma.$queryRaw<any[]>`
            INSERT INTO "candidate_chat_messages" (
              "company_id",
              "conversation_id",
              "profile_id",
              "sender_type",
              "sender_user_id",
              "body"
            )
            VALUES (
              ${profile.company_id}::uuid,
              ${conversation.id}::uuid,
              ${profile.id}::uuid,
              'RH',
              ${`AUTOMATION:${automation.id}`},
              ${responseText}
            )
            RETURNING *
          `;

          automatedMessage = autoRows[0];

          await prisma.$executeRaw`
            UPDATE "candidate_chat_conversations"
            SET
              "last_message_text" = ${responseText.slice(0, 500)},
              "last_message_at" = now(),
              "candidate_unread" = "candidate_unread" + 1,
              "updated_at" = now()
            WHERE "id" = ${conversation.id}::uuid
          `;

          await queueCandidateMessagePush(profile, token, responseText);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: rows[0],
      automatedMessage,
    });
  } catch (error: any) {
    console.error("[CANDIDATE_CHAT_PUBLIC_POST]", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message === "PORTAL_TOKEN_INVALID" ||
          error?.message === "PORTAL_ACCESS_NOT_FOUND"
            ? "Link inválido ou desativado."
            : error?.message || "Erro ao enviar mensagem.",
      },
      { status: 500 }
    );
  }
}
