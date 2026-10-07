import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  findCandidateByIdentity,
  normalizeCpf,
  resolveCandidatePortalToken,
} from "@/lib/candidate-portal-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function errorStatus(message: string) {
  if (
    message === "PORTAL_TOKEN_INVALID" ||
    message === "PORTAL_ACCESS_NOT_FOUND"
  ) {
    return 401;
  }

  return 500;
}

async function candidateForProfile(profile: any) {
  if (!profile?.candidate_id) return null;

  return prisma.candidateProfile.findUnique({
    where: { id: profile.candidate_id },
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

    await prisma.$executeRaw`
      UPDATE "candidate_portal_profiles"
      SET
        "last_access_at" = now(),
        "updated_at" = now()
      WHERE "id" = ${profile.id}::uuid
    `;

    if (!profile.identity_confirmed_at) {
      return NextResponse.json({
        success: true,
        requiresIdentity: true,
        profile: {
          name: profile.full_name,
          matchStatus: profile.match_status,
          portalStatus: profile.portal_status,
        },
      });
    }

    const candidate = await candidateForProfile(profile);

    const matches = candidate
      ? await prisma.jobMatch.findMany({
          where: {
            candidateId: candidate.id,
            score: { gte: 50 },
            job: {
              company_id: profile.company_id,
              status: {
                notIn: ["closed", "canceled", "archived", "draft"],
              },
            },
          },
          include: {
            job: true,
          },
          orderBy: {
            score: "desc",
          },
          take: 100,
        })
      : [];

    const applications = candidate
      ? await prisma.jobApplication.findMany({
          where: {
            company_id: profile.company_id,
            candidateId: candidate.id,
          },
          include: {
            job: true,
          },
          orderBy: {
            updatedAt: "desc",
          },
          take: 100,
        })
      : [];

    const interviews = candidate
      ? await prisma.interview.findMany({
          where: {
            company_id: profile.company_id,
            candidateId: candidate.id,
          },
          include: {
            job: true,
          },
          orderBy: {
            scheduledAt: "desc",
          },
          take: 100,
        })
      : [];

    const notifications = await prisma.$queryRaw<any[]>`
      SELECT
        "id",
        "type",
        "title",
        "body",
        "job_id",
        "interview_id",
        "deep_link",
        "read_at",
        "created_at"
      FROM "candidate_notifications"
      WHERE "profile_id" = ${profile.id}::uuid
      ORDER BY "created_at" DESC
      LIMIT 100
    `;

    const interests = await prisma.$queryRaw<any[]>`
      SELECT
        "job_id",
        "interest",
        "updated_at"
      FROM "candidate_job_interests"
      WHERE "profile_id" = ${profile.id}::uuid
    `;

    const interviewResponses = await prisma.$queryRaw<any[]>`
      SELECT
        "interview_id",
        "response",
        "note",
        "updated_at"
      FROM "candidate_interview_responses"
      WHERE "profile_id" = ${profile.id}::uuid
    `;

    const subscriptions = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*)::int AS total
      FROM "candidate_push_subscriptions"
      WHERE "profile_id" = ${profile.id}::uuid
        AND "active" = true
    `;

    const preferences = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM "candidate_push_preferences"
      WHERE "profile_id" = ${profile.id}::uuid
      LIMIT 1
    `;

    return NextResponse.json({
      success: true,
      requiresIdentity: false,
      profile: {
        id: profile.id,
        name: candidate?.name || profile.full_name,
        cpf: candidate?.cpf || profile.cpf_normalized,
        phone:
          candidate?.mobile ||
          candidate?.phone ||
          profile.phone_normalized,
        email: candidate?.email || profile.email_normalized,
        city: candidate?.city || null,
        state: candidate?.state || null,
        education: candidate?.education || null,
        course: candidate?.course || null,
        lastRole: candidate?.lastRole || null,
        professionalSummary: candidate?.professionalSummary || null,
        skills: candidate?.skills || [],
        resumeOrigin: candidate?.resumeOrigin || null,
        portalStatus: profile.portal_status,
        pushStatus: profile.push_status,
        lastAccessAt: profile.last_access_at,
        curriculumLinked: Boolean(candidate),
        matchStatus: profile.match_status,
      },
      push: {
        active: Number(subscriptions[0]?.total || 0) > 0,
        devices: Number(subscriptions[0]?.total || 0),
        preferences: preferences[0] || null,
      },
      jobs: matches.map((match) => ({
        id: match.job.id,
        title: match.job.title,
        description: match.job.description,
        city: match.job.city,
        state: match.job.state,
        neighborhood: match.job.neighborhood,
        workMode: match.job.workMode,
        contractType: match.job.contractType,
        salaryMin: match.job.salaryMin,
        salaryMax: match.job.salaryMax,
        educationRequired: match.job.educationRequired,
        experienceRequired: match.job.experienceRequired,
        skillsRequired: match.job.skillsRequired,
        createdAt: match.job.createdAt,
        updatedAt: match.job.updatedAt,
        matchUpdatedAt: match.updatedAt,
        score: match.score,
        strengths: match.strengths,
        attentionPoints: match.attentionPoints,
        matchStatus: match.status,
      })),
      applications: applications.map((application) => ({
        id: application.id,
        jobId: application.jobId,
        jobTitle: application.job?.title || "Vaga",
        stage: application.stage,
        status: application.status,
        applicationDate: application.applicationDate,
        updatedAt: application.updatedAt,
      })),
      interviews: interviews.map((interview) => ({
        id: interview.id,
        jobId: interview.jobId,
        jobTitle: interview.job?.title || "Vaga",
        scheduledAt: interview.scheduledAt,
        durationMin: interview.durationMin,
        interviewer: interview.interviewer,
        meetingUrl: interview.meetingUrl,
        location: interview.location,
        status: interview.status,
      })),
      notifications,
      interests,
      interviewResponses,
    });
  } catch (error: any) {
    console.error("[CANDIDATE_PORTAL_PUBLIC_GET]", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message === "PORTAL_TOKEN_INVALID" ||
          error?.message === "PORTAL_ACCESS_NOT_FOUND"
            ? "Este link do Portal MOTIVAR não é válido ou foi desativado."
            : error?.message || "Erro ao carregar o Portal MOTIVAR.",
      },
      { status: errorStatus(error?.message || "") }
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
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim();

    if (action === "confirm_identity") {
      const cpf = normalizeCpf(body?.cpf);

      if (!cpf || cpf.length !== 11) {
        return NextResponse.json(
          { success: false, error: "Informe um CPF válido." },
          { status: 400 }
        );
      }

      let candidate = await candidateForProfile(profile);
      const registeredCpf =
        normalizeCpf(candidate?.cpf) ||
        normalizeCpf(profile.cpf_normalized);

      // Se o Portal foi criado com CPF, ele continua sendo a chave de segurança.
      if (registeredCpf && registeredCpf !== cpf) {
        return NextResponse.json(
          {
            success: false,
            error:
              "O CPF informado não corresponde ao cadastro deste Portal.",
          },
          { status: 401 }
        );
      }

      if (!candidate) {
        const match = await findCandidateByIdentity(
          profile.company_id,
          { cpf }
        );

        if (match.status === "MATCHED" && match.candidate) {
          candidate = match.candidate;

          await prisma.$executeRaw`
            UPDATE "candidate_portal_profiles"
            SET
              "candidate_id" = ${candidate.id},
              "full_name" = ${candidate.name},
              "cpf_normalized" = ${cpf},
              "match_status" = 'MATCHED',
              "match_method" = 'CPF',
              "match_confidence" = 100,
              "linked_at" = COALESCE("linked_at", now()),
              "updated_at" = now()
            WHERE "id" = ${profile.id}::uuid
          `;
        } else {
          // IMPORTANTE:
          // não bloquear o Portal apenas porque o currículo ainda não existe.
          // O acesso fica ativo e o RH pode vincular o currículo depois.
          await prisma.$executeRaw`
            UPDATE "candidate_portal_profiles"
            SET
              "cpf_normalized" = COALESCE("cpf_normalized", ${cpf}),
              "match_status" = ${match.status},
              "match_method" = ${match.method},
              "match_confidence" = ${match.confidence},
              "updated_at" = now()
            WHERE "id" = ${profile.id}::uuid
          `;
        }
      }

      await prisma.$executeRaw`
        UPDATE "candidate_portal_profiles"
        SET
          "identity_confirmed_at" = now(),
          "portal_status" = 'ACTIVE',
          "last_access_at" = now(),
          "updated_at" = now()
        WHERE "id" = ${profile.id}::uuid
      `;

      return NextResponse.json({
        success: true,
        linked: Boolean(candidate),
        portalActive: true,
      });
    }

    if (!profile.identity_confirmed_at) {
      return NextResponse.json(
        {
          success: false,
          error: "Confirme sua identidade antes de continuar.",
        },
        { status: 401 }
      );
    }

    if (action === "job_interest") {
      if (!profile.candidate_id) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Seu Portal está ativo, mas o currículo ainda precisa ser vinculado para participar de vagas.",
          },
          { status: 409 }
        );
      }

      const jobId = String(body?.jobId || "").trim();
      const interest =
        body?.interest === "NOT_INTERESTED"
          ? "NOT_INTERESTED"
          : "INTERESTED";

      const match = await prisma.jobMatch.findFirst({
        where: {
          jobId,
          candidateId: profile.candidate_id,
          job: {
            company_id: profile.company_id,
          },
        },
        include: {
          job: true,
        },
      });

      if (!match) {
        return NextResponse.json(
          { success: false, error: "Vaga não encontrada para seu perfil." },
          { status: 404 }
        );
      }

      await prisma.$executeRaw`
        INSERT INTO "candidate_job_interests" (
          "company_id",
          "profile_id",
          "candidate_id",
          "job_id",
          "interest"
        )
        VALUES (
          ${profile.company_id}::uuid,
          ${profile.id}::uuid,
          ${profile.candidate_id},
          ${jobId},
          ${interest}
        )
        ON CONFLICT ("profile_id", "job_id")
        DO UPDATE SET
          "interest" = EXCLUDED."interest",
          "updated_at" = now()
      `;

      if (interest === "INTERESTED") {
        await prisma.jobApplication.upsert({
          where: {
            jobId_candidateId: {
              jobId,
              candidateId: profile.candidate_id,
            },
          },
          update: {
            status: "active",
            source: "candidate_portal",
            notes: "Candidato demonstrou interesse pelo Portal MOTIVAR.",
          },
          create: {
            company_id: profile.company_id,
            branch_id: match.job.branch_id || null,
            jobId,
            candidateId: profile.candidate_id,
            source: "candidate_portal",
            stage: "triagem",
            status: "active",
            notes: "Candidato demonstrou interesse pelo Portal MOTIVAR.",
          },
        });
      }

      return NextResponse.json({
        success: true,
        interest,
      });
    }

    if (action === "interview_response") {
      if (!profile.candidate_id) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Seu Portal está ativo, mas o currículo ainda precisa ser vinculado para responder entrevistas.",
          },
          { status: 409 }
        );
      }

      const interviewId = String(body?.interviewId || "").trim();
      const response =
        body?.response === "DECLINED"
          ? "DECLINED"
          : "CONFIRMED";
      const note = String(body?.note || "").trim().slice(0, 1000) || null;

      const interview = await prisma.interview.findFirst({
        where: {
          id: interviewId,
          company_id: profile.company_id,
          candidateId: profile.candidate_id,
        },
      });

      if (!interview) {
        return NextResponse.json(
          { success: false, error: "Entrevista não encontrada." },
          { status: 404 }
        );
      }

      await prisma.$executeRaw`
        INSERT INTO "candidate_interview_responses" (
          "company_id",
          "profile_id",
          "candidate_id",
          "interview_id",
          "response",
          "note"
        )
        VALUES (
          ${profile.company_id}::uuid,
          ${profile.id}::uuid,
          ${profile.candidate_id},
          ${interviewId},
          ${response},
          ${note}
        )
        ON CONFLICT ("profile_id", "interview_id")
        DO UPDATE SET
          "response" = EXCLUDED."response",
          "note" = EXCLUDED."note",
          "updated_at" = now()
      `;

      if (response === "CONFIRMED") {
        await prisma.interview.update({
          where: { id: interview.id },
          data: { status: "confirmed" },
        });
      }

      return NextResponse.json({
        success: true,
        response,
      });
    }

    if (action === "notification_read") {
      const notificationId = String(body?.notificationId || "").trim();

      await prisma.$executeRaw`
        UPDATE "candidate_notifications"
        SET "read_at" = COALESCE("read_at", now())
        WHERE "id" = ${notificationId}::uuid
          AND "profile_id" = ${profile.id}::uuid
      `;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Ação inválida." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[CANDIDATE_PORTAL_PUBLIC_POST]", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message === "PORTAL_TOKEN_INVALID" ||
          error?.message === "PORTAL_ACCESS_NOT_FOUND"
            ? "Link inválido ou desativado."
            : error?.message || "Erro no Portal MOTIVAR.",
      },
      { status: errorStatus(error?.message || "") }
    );
  }
}
