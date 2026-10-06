import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildCandidatePortalUrl } from "@/lib/candidate-portal-access";
import { processCandidatePushQueue } from "@/lib/candidate-push-dispatch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

async function addDeliveries(
  companyId: string,
  profileId: string,
  notificationId: string,
  preferenceColumn:
    | "jobs_enabled"
    | "interviews_enabled"
    | "process_updates_enabled"
    | "messages_enabled"
    | "documents_enabled"
) {
  // A coluna vem apenas de uma união fechada definida pelo código.
  await prisma.$executeRawUnsafe(
    `INSERT INTO "candidate_notification_deliveries" (
       "company_id",
       "notification_id",
       "subscription_id"
     )
     SELECT
       $1::uuid,
       $2::uuid,
       s."id"
     FROM "candidate_push_subscriptions" s
     LEFT JOIN "candidate_push_preferences" p
       ON p."profile_id" = s."profile_id"
     WHERE s."profile_id" = $3::uuid
       AND s."active" = true
       AND COALESCE(p."${preferenceColumn}", true) = true
     ON CONFLICT ("notification_id","subscription_id") DO NOTHING`,
    companyId,
    notificationId,
    profileId
  );
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json(
      { success: false, error: "Não autorizado." },
      { status: 401 }
    );
  }

  try {
    let interviewNotifications = 0;
    let processNotifications = 0;

    const upcomingInterviews = await prisma.$queryRaw<any[]>`
      SELECT
        i."id" AS interview_id,
        i."company_id",
        i."candidateId" AS candidate_id,
        i."scheduledAt" AS scheduled_at,
        i."meetingUrl" AS meeting_url,
        i."location",
        j."title" AS job_title,
        p."id" AS profile_id,
        p."token_version"
      FROM "Interview" i
      INNER JOIN "Job" j
        ON j."id" = i."jobId"
      INNER JOIN "candidate_portal_profiles" p
        ON p."candidate_id" = i."candidateId"
       AND p."company_id" = i."company_id"
       AND p."access_active" = true
       AND p."identity_confirmed_at" IS NOT NULL
      WHERE i."status" IN ('scheduled','confirmed')
        AND i."scheduledAt" >= now()
        AND i."scheduledAt" <= now() + interval '36 hours'
        AND NOT EXISTS (
          SELECT 1
          FROM "candidate_notifications" n
          WHERE n."profile_id" = p."id"
            AND n."interview_id" = i."id"
            AND n."type" = 'INTERVIEW'
        )
      ORDER BY i."scheduledAt" ASC
      LIMIT 500
    `;

    for (const item of upcomingInterviews) {
      const portalLink = buildCandidatePortalUrl(req.nextUrl.origin, {
        id: item.profile_id,
        company_id: item.company_id,
        token_version: Number(item.token_version || 1),
      });

      const when = new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(item.scheduled_at));

      const rows = await prisma.$queryRaw<any[]>`
        INSERT INTO "candidate_notifications" (
          "company_id",
          "profile_id",
          "candidate_id",
          "interview_id",
          "type",
          "title",
          "body",
          "deep_link"
        )
        VALUES (
          ${item.company_id}::uuid,
          ${item.profile_id}::uuid,
          ${item.candidate_id},
          ${item.interview_id},
          'INTERVIEW',
          '📅 Sua entrevista está agendada',
          ${`${item.job_title} • ${when}`},
          ${`${portalLink}?tab=entrevistas`}
        )
        RETURNING "id"
      `;

      await addDeliveries(
        item.company_id,
        item.profile_id,
        rows[0].id,
        "interviews_enabled"
      );

      interviewNotifications += 1;
    }

    const recentApplications = await prisma.$queryRaw<any[]>`
      SELECT
        a."id" AS application_id,
        a."company_id",
        a."candidateId" AS candidate_id,
        a."jobId" AS job_id,
        a."stage",
        a."updatedAt" AS updated_at,
        j."title" AS job_title,
        p."id" AS profile_id,
        p."token_version"
      FROM "JobApplication" a
      INNER JOIN "Job" j
        ON j."id" = a."jobId"
      INNER JOIN "candidate_portal_profiles" p
        ON p."candidate_id" = a."candidateId"
       AND p."company_id" = a."company_id"
       AND p."access_active" = true
       AND p."identity_confirmed_at" IS NOT NULL
      WHERE a."updatedAt" >= now() - interval '20 minutes'
        AND NOT EXISTS (
          SELECT 1
          FROM "candidate_notifications" n
          WHERE n."profile_id" = p."id"
            AND n."job_id" = a."jobId"
            AND n."type" = 'PROCESS_UPDATE'
            AND n."created_at" >= a."updatedAt"
        )
      ORDER BY a."updatedAt" ASC
      LIMIT 500
    `;

    const stageLabel: Record<string, string> = {
      triagem: "Triagem",
      entrevista: "Entrevista",
      aprovado: "Aprovado",
      reprovado: "Não aprovado",
      contratado: "Contratado",
    };

    for (const item of recentApplications) {
      const portalLink = buildCandidatePortalUrl(req.nextUrl.origin, {
        id: item.profile_id,
        company_id: item.company_id,
        token_version: Number(item.token_version || 1),
      });

      const stage = stageLabel[item.stage] || item.stage || "Em andamento";

      const rows = await prisma.$queryRaw<any[]>`
        INSERT INTO "candidate_notifications" (
          "company_id",
          "profile_id",
          "candidate_id",
          "job_id",
          "type",
          "title",
          "body",
          "deep_link"
        )
        VALUES (
          ${item.company_id}::uuid,
          ${item.profile_id}::uuid,
          ${item.candidate_id},
          ${item.job_id},
          'PROCESS_UPDATE',
          '🎯 Atualização no seu processo',
          ${`${item.job_title}: ${stage}`},
          ${`${portalLink}?tab=processos`}
        )
        RETURNING "id"
      `;

      await addDeliveries(
        item.company_id,
        item.profile_id,
        rows[0].id,
        "process_updates_enabled"
      );

      processNotifications += 1;
    }

    const queue = await processCandidatePushQueue({ limit: 300 });

    return NextResponse.json({
      success: true,
      interviewNotifications,
      processNotifications,
      queue,
    });
  } catch (error: any) {
    console.error("[CANDIDATE_PORTAL_CRON]", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Erro no cron do Portal.",
      },
      { status: 500 }
    );
  }
}
