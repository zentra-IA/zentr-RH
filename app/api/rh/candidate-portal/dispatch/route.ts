import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/server-company";
import {
  buildCandidatePortalUrl,
  cleanPortalText,
} from "@/lib/candidate-portal-access";
import { processCandidatePushQueue } from "@/lib/candidate-push-dispatch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function defaultJobMessage(job: any) {
  const location = [job.city, job.state].filter(Boolean).join("/");
  const suffix = location ? ` • ${location}` : "";

  return {
    title: "💼 Nova oportunidade para você",
    message: `${job.title}${suffix}. A MOTIVAR RH encontrou uma oportunidade compatível com seu perfil.`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, userId } = await requireCompany(req);
    const body = await req.json().catch(() => ({}));

    const jobId = cleanPortalText(body?.jobId, 120) || null;
    const source =
      cleanPortalText(body?.source, 80) ||
      (jobId ? "job_match" : "manual");

    const force = body?.force === true;

    const requestedIds: string[] = Array.isArray(body?.candidateIds)
      ? Array.from(
          new Set<string>(
            body.candidateIds
              .map((id: unknown) => cleanPortalText(id, 100))
              .filter(
                (id: string): id is string =>
                  Boolean(id)
              )
          )
        ).slice(0, 2000)
      : [];

    let job: any = null;

    if (jobId) {
      job = await prisma.job.findFirst({
        where: {
          id: jobId,
          company_id: companyId,
        },
      });

      if (!job) {
        return NextResponse.json(
          { success: false, error: "Vaga não encontrada." },
          { status: 404 }
        );
      }
    }

    let candidateIds: string[] = requestedIds;

    if (!candidateIds.length && jobId) {
      const matches = await prisma.jobMatch.findMany({
        where: {
          jobId,
          score: { gte: 60 },
          status: {
            notIn: ["rejected", "hired"],
          },
        },
        select: {
          candidateId: true,
        },
        orderBy: {
          score: "desc",
        },
        take: 2000,
      });

      candidateIds = matches.map((item) => item.candidateId);
    }

    if (!candidateIds.length) {
      return NextResponse.json(
        { success: false, error: "Nenhum candidato selecionado." },
        { status: 400 }
      );
    }

    if (jobId) {
      const matches = await prisma.jobMatch.findMany({
        where: {
          jobId,
          candidateId: { in: candidateIds },
        },
        select: {
          candidateId: true,
        },
      });

      const allowed = new Set(matches.map((item) => item.candidateId));
      candidateIds = candidateIds.filter((id) => allowed.has(id));
    }

    if (!candidateIds.length) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Nenhum dos candidatos selecionados pertence ao matching desta vaga.",
        },
        { status: 400 }
      );
    }

    const profileRows = await prisma.$queryRaw<any[]>`
      SELECT
        p.*,
        prefs."jobs_enabled",
        prefs."interviews_enabled",
        prefs."process_updates_enabled",
        prefs."messages_enabled",
        prefs."documents_enabled",
        EXISTS (
          SELECT 1
          FROM "candidate_push_subscriptions" s
          WHERE s."profile_id" = p."id"
            AND s."active" = true
        ) AS "push_active"
      FROM "candidate_portal_profiles" p
      LEFT JOIN "candidate_push_preferences" prefs
        ON prefs."profile_id" = p."id"
      WHERE p."company_id" = ${companyId}::uuid
        AND p."candidate_id" IN (${Prisma.join(candidateIds)})
        AND p."access_active" = true
    `;

    const title = cleanPortalText(body?.title, 120) ||
      (job ? defaultJobMessage(job).title : "MOTIVAR RH");

    const message = cleanPortalText(body?.message, 500) ||
      (job
        ? defaultJobMessage(job).message
        : "Você recebeu uma nova atualização no Portal MOTIVAR.");

    const type = cleanPortalText(body?.type, 60) ||
      (job ? "JOB_OPPORTUNITY" : "MESSAGE");

    const eligibleProfiles = profileRows.filter((profile) => {
      if (!profile.push_active) return false;

      if (type === "JOB_OPPORTUNITY") {
        return profile.jobs_enabled !== false;
      }

      if (type === "INTERVIEW") {
        return profile.interviews_enabled !== false;
      }

      if (type === "PROCESS_UPDATE") {
        return profile.process_updates_enabled !== false;
      }

      if (type === "DOCUMENT") {
        return profile.documents_enabled !== false;
      }

      return profile.messages_enabled !== false;
    });

    const campaignRows = await prisma.$queryRaw<any[]>`
      INSERT INTO "candidate_push_campaigns" (
        "company_id",
        "job_id",
        "source",
        "title",
        "message",
        "target_count",
        "eligible_count",
        "skipped_count",
        "created_by"
      )
      VALUES (
        ${companyId}::uuid,
        ${jobId},
        ${source},
        ${title},
        ${message},
        ${candidateIds.length},
        ${eligibleProfiles.length},
        ${Math.max(0, candidateIds.length - eligibleProfiles.length)},
        ${userId || null}
      )
      RETURNING *
    `;

    const campaign = campaignRows[0];
    let notificationsCreated = 0;
    let deliveriesCreated = 0;
    let skippedDuplicate = 0;

    for (const profile of eligibleProfiles) {
      if (jobId && !force) {
        const previous = await prisma.$queryRaw<any[]>`
          SELECT "id"
          FROM "candidate_notifications"
          WHERE "profile_id" = ${profile.id}::uuid
            AND "job_id" = ${jobId}
            AND "type" = 'JOB_OPPORTUNITY'
            AND "created_at" > now() - interval '7 days'
          LIMIT 1
        `;

        if (previous.length) {
          skippedDuplicate += 1;
          continue;
        }
      }

      const portalLink = buildCandidatePortalUrl(req.nextUrl.origin, profile);
      const deepLink = jobId
        ? `${portalLink}?tab=vagas&job=${encodeURIComponent(jobId)}`
        : `${portalLink}?tab=notificacoes`;

      const notificationRows = await prisma.$queryRaw<any[]>`
        INSERT INTO "candidate_notifications" (
          "company_id",
          "profile_id",
          "candidate_id",
          "campaign_id",
          "job_id",
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
          ${jobId},
          ${type},
          ${title},
          ${message},
          ${deepLink}
        )
        RETURNING "id"
      `;

      const notificationId = notificationRows[0].id;
      notificationsCreated += 1;

      const created = await prisma.$executeRaw`
        INSERT INTO "candidate_notification_deliveries" (
          "company_id",
          "notification_id",
          "subscription_id"
        )
        SELECT
          ${companyId}::uuid,
          ${notificationId}::uuid,
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

    await prisma.$executeRaw`
      UPDATE "candidate_push_campaigns"
      SET
        "eligible_count" = ${notificationsCreated},
        "queued_count" = ${deliveriesCreated},
        "skipped_count" = ${
          Math.max(0, candidateIds.length - eligibleProfiles.length) +
          skippedDuplicate
        },
        "updated_at" = now()
      WHERE "id" = ${campaign.id}::uuid
    `;

    const processing = await processCandidatePushQueue({
      companyId,
      limit: 120,
    });

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      targetCount: candidateIds.length,
      portalProfiles: profileRows.length,
      pushEligible: eligibleProfiles.length,
      notificationsCreated,
      deliveriesCreated,
      skippedWithoutPush: Math.max(
        0,
        candidateIds.length - eligibleProfiles.length
      ),
      skippedDuplicate,
      processing,
      queueNote:
        deliveriesCreated > processing.processed
          ? "Há notificações pendentes na fila. O processador pode ser executado novamente pela Central Push."
          : null,
    });
  } catch (error: any) {
    console.error("[CANDIDATE_PUSH_DISPATCH]", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Erro ao preparar disparo Push.",
      },
      { status: 500 }
    );
  }
}
