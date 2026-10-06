import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCandidatePortalToken } from "@/lib/candidate-portal-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function clean(value: unknown, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

async function currentPreferences(profileId: string) {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      "jobs_enabled",
      "interviews_enabled",
      "process_updates_enabled",
      "messages_enabled",
      "documents_enabled"
    FROM "candidate_push_preferences"
    WHERE "profile_id" = ${profileId}::uuid
    LIMIT 1
  `;

  return rows[0] || {
    jobs_enabled: true,
    interviews_enabled: true,
    process_updates_enabled: true,
    messages_enabled: true,
    documents_enabled: true,
  };
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

    const endpoint = clean(req.nextUrl.searchParams.get("endpoint"));

    const rows = endpoint
      ? await prisma.$queryRaw<any[]>`
          SELECT "active", "permission"
          FROM "candidate_push_subscriptions"
          WHERE "profile_id" = ${profile.id}::uuid
            AND "endpoint" = ${endpoint}
          LIMIT 1
        `
      : [];

    return NextResponse.json({
      success: true,
      active: Boolean(rows[0]?.active),
      permission: rows[0]?.permission || null,
      preferences: await currentPreferences(profile.id),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error:
          error?.message === "PORTAL_TOKEN_INVALID" ||
          error?.message === "PORTAL_ACCESS_NOT_FOUND"
            ? "Link inválido ou desativado."
            : error?.message || "Erro ao consultar Push.",
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
    const endpoint = clean(body?.endpoint);
    const p256dh = clean(body?.keys?.p256dh);
    const auth = clean(body?.keys?.auth);

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { success: false, error: "Assinatura Push incompleta." },
        { status: 400 }
      );
    }

    const userAgent = clean(req.headers.get("user-agent"), 1000) || null;

    await prisma.$executeRaw`
      INSERT INTO "candidate_push_subscriptions" (
        "company_id",
        "profile_id",
        "candidate_id",
        "endpoint",
        "p256dh",
        "auth_key",
        "permission",
        "active",
        "user_agent",
        "revoked_at",
        "updated_at"
      )
      VALUES (
        ${profile.company_id}::uuid,
        ${profile.id}::uuid,
        ${profile.candidate_id || null},
        ${endpoint},
        ${p256dh},
        ${auth},
        'granted',
        true,
        ${userAgent},
        NULL,
        now()
      )
      ON CONFLICT ("endpoint")
      DO UPDATE SET
        "company_id" = EXCLUDED."company_id",
        "profile_id" = EXCLUDED."profile_id",
        "candidate_id" = EXCLUDED."candidate_id",
        "p256dh" = EXCLUDED."p256dh",
        "auth_key" = EXCLUDED."auth_key",
        "permission" = 'granted',
        "active" = true,
        "user_agent" = EXCLUDED."user_agent",
        "revoked_at" = NULL,
        "updated_at" = now()
    `;

    await prisma.$executeRaw`
      INSERT INTO "candidate_push_preferences" (
        "company_id",
        "profile_id"
      )
      VALUES (
        ${profile.company_id}::uuid,
        ${profile.id}::uuid
      )
      ON CONFLICT ("profile_id") DO NOTHING
    `;

    await prisma.$executeRaw`
      UPDATE "candidate_portal_profiles"
      SET
        "push_status" = 'ACTIVE',
        "portal_status" = 'ACTIVE',
        "updated_at" = now()
      WHERE "id" = ${profile.id}::uuid
    `;

    return NextResponse.json({
      success: true,
      active: true,
      preferences: await currentPreferences(profile.id),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao registrar Push." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: { token: string } | Promise<{ token: string }> }
) {
  try {
    const params = await Promise.resolve(context.params);
    const token = decodeURIComponent(params.token);
    const profile = await resolveCandidatePortalToken(token);
    const body = await req.json().catch(() => ({}));

    const current = await currentPreferences(profile.id);

    const jobsEnabled =
      body?.jobs_enabled === undefined
        ? current.jobs_enabled
        : body.jobs_enabled === true;

    const interviewsEnabled =
      body?.interviews_enabled === undefined
        ? current.interviews_enabled
        : body.interviews_enabled === true;

    const processUpdatesEnabled =
      body?.process_updates_enabled === undefined
        ? current.process_updates_enabled
        : body.process_updates_enabled === true;

    const messagesEnabled =
      body?.messages_enabled === undefined
        ? current.messages_enabled
        : body.messages_enabled === true;

    const documentsEnabled =
      body?.documents_enabled === undefined
        ? current.documents_enabled
        : body.documents_enabled === true;

    const rows = await prisma.$queryRaw<any[]>`
      INSERT INTO "candidate_push_preferences" (
        "company_id",
        "profile_id",
        "jobs_enabled",
        "interviews_enabled",
        "process_updates_enabled",
        "messages_enabled",
        "documents_enabled",
        "updated_at"
      )
      VALUES (
        ${profile.company_id}::uuid,
        ${profile.id}::uuid,
        ${jobsEnabled},
        ${interviewsEnabled},
        ${processUpdatesEnabled},
        ${messagesEnabled},
        ${documentsEnabled},
        now()
      )
      ON CONFLICT ("profile_id")
      DO UPDATE SET
        "jobs_enabled" = EXCLUDED."jobs_enabled",
        "interviews_enabled" = EXCLUDED."interviews_enabled",
        "process_updates_enabled" = EXCLUDED."process_updates_enabled",
        "messages_enabled" = EXCLUDED."messages_enabled",
        "documents_enabled" = EXCLUDED."documents_enabled",
        "updated_at" = now()
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      preferences: rows[0],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao salvar preferências." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: { token: string } | Promise<{ token: string }> }
) {
  try {
    const params = await Promise.resolve(context.params);
    const token = decodeURIComponent(params.token);
    const profile = await resolveCandidatePortalToken(token);
    const endpoint = clean(req.nextUrl.searchParams.get("endpoint"));

    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: "Endpoint não informado." },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`
      UPDATE "candidate_push_subscriptions"
      SET
        "active" = false,
        "permission" = 'revoked',
        "revoked_at" = now(),
        "updated_at" = now()
      WHERE "profile_id" = ${profile.id}::uuid
        AND "endpoint" = ${endpoint}
    `;

    const activeRows = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*)::int AS total
      FROM "candidate_push_subscriptions"
      WHERE "profile_id" = ${profile.id}::uuid
        AND "active" = true
    `;

    if (Number(activeRows[0]?.total || 0) === 0) {
      await prisma.$executeRaw`
        UPDATE "candidate_portal_profiles"
        SET
          "push_status" = 'REVOKED',
          "updated_at" = now()
        WHERE "id" = ${profile.id}::uuid
      `;
    }

    return NextResponse.json({ success: true, active: false });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao desativar Push." },
      { status: 500 }
    );
  }
}
