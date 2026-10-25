import { NextRequest, NextResponse } from "next/server";
import { requireCompany } from "@/lib/server-company";
import { prisma } from "@/lib/ai-interview";

export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value || "").trim();
}

function buildRhNotes(session: any) {
  const report = session.ai_report && typeof session.ai_report === "object"
    ? session.ai_report
    : {};

  const strengths = Array.isArray(report.strengths)
    ? report.strengths
        .slice(0, 4)
        .map((item: any) => item?.title || item?.evidence || String(item || ""))
        .filter(Boolean)
    : [];

  const attention = Array.isArray(report.attentionPoints)
    ? report.attentionPoints
        .slice(0, 3)
        .map((item: any) => item?.title || item?.evidence || String(item || ""))
        .filter(Boolean)
    : [];

  return [
    "Entrevista Inteligente por IA concluída.",
    session.overall_score != null ? `Aderência geral: ${session.overall_score}%` : "",
    session.resume_score != null ? `Currículo: ${session.resume_score}%` : "",
    session.interview_score != null ? `Entrevista: ${session.interview_score}%` : "",
    clean(report.summary) ? `Resumo: ${clean(report.summary)}` : "",
    strengths.length ? `Pontos fortes: ${strengths.join("; ")}` : "",
    attention.length ? `Pontos de atenção: ${attention.join("; ")}` : "",
    "A análise da IA é apoio ao RH; a decisão final permanece humana.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId, branchId, userId } = await requireCompany(req);
    const { id: jobId } = await context.params;
    const body = await req.json();

    const sessionId = clean(body.sessionId || body.session_id);
    const decision = clean(body.decision);

    if (!sessionId || !["approved", "rejected", "reset"].includes(decision)) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const jobs = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT *
      FROM "Job"
      WHERE "id" = $1
        AND "company_id" = $2::uuid
      LIMIT 1
      `,
      jobId,
      companyId
    );

    const job = jobs[0];
    if (!job) {
      return NextResponse.json({ error: "Vaga não encontrada." }, { status: 404 });
    }

    const sessions = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT *
      FROM "candidate_ai_interview_sessions"
      WHERE "id" = $1::uuid
        AND "company_id" = $2::uuid
        AND "job_id" = $3
      LIMIT 1
      `,
      sessionId,
      companyId,
      jobId
    );

    const session = sessions[0];
    if (!session) {
      return NextResponse.json({ error: "Entrevista não encontrada." }, { status: 404 });
    }

    if (decision === "reset") {
      await prisma.$executeRawUnsafe(
        `
        UPDATE "candidate_ai_interview_sessions"
        SET "rh_decision" = NULL,
            "rh_decided_at" = NULL,
            "updated_at" = now()
        WHERE "id" = $1::uuid
        `,
        sessionId
      );

      return NextResponse.json({ success: true, decision: null });
    }

    if (decision === "rejected") {
      await prisma.$executeRawUnsafe(
        `
        UPDATE "candidate_ai_interview_sessions"
        SET "rh_decision" = 'rejected',
            "rh_decided_at" = now(),
            "updated_at" = now()
        WHERE "id" = $1::uuid
        `,
        sessionId
      );

      return NextResponse.json({ success: true, decision: "rejected" });
    }

    // Aprovado pelo RH -> usa a apresentação existente da vaga ou cria uma.
    let presentations = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT *
      FROM "rh_client_presentations"
      WHERE "company_id" = $1::uuid
        AND "job_id" = $2
        AND COALESCE("workflow_status", 'in_progress') <> 'cancelled'
      ORDER BY "created_at" DESC
      LIMIT 1
      `,
      companyId,
      jobId
    );

    let presentation = presentations[0];

    if (!presentation) {
      const created = await prisma.$queryRawUnsafe<any[]>(
        `
        INSERT INTO "rh_client_presentations" (
          "company_id",
          "branch_id",
          "job_id",
          "token",
          "title",
          "status",
          "workflow_status",
          "created_by",
          "created_at",
          "updated_at"
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3,
          encode(gen_random_bytes(18), 'hex'),
          $4,
          'draft',
          'in_progress',
          $5,
          now(),
          now()
        )
        RETURNING *
        `,
        companyId,
        branchId || null,
        jobId,
        job.title || "Vaga",
        userId || null
      );

      presentation = created[0];
    }

    let existingRows: any[] = [];

    if (session.candidate_id) {
      existingRows = await prisma.$queryRawUnsafe<any[]>(
        `
        SELECT *
        FROM "rh_client_presentation_candidates"
        WHERE "presentation_id" = $1::uuid
          AND "company_id" = $2::uuid
          AND "candidate_id" = $3
        LIMIT 1
        `,
        presentation.id,
        companyId,
        session.candidate_id
      );
    }

    if (!existingRows.length && session.candidate_phone) {
      existingRows = await prisma.$queryRawUnsafe<any[]>(
        `
        SELECT *
        FROM "rh_client_presentation_candidates"
        WHERE "presentation_id" = $1::uuid
          AND "company_id" = $2::uuid
          AND regexp_replace(COALESCE("candidate_phone", ''), '\D', '', 'g')
              = regexp_replace($3, '\D', '', 'g')
        LIMIT 1
        `,
        presentation.id,
        companyId,
        session.candidate_phone
      );
    }

    const rhNotes = buildRhNotes(session);
    const existing = existingRows[0];
    let presentationCandidate: any;

    if (existing) {
      const updated = await prisma.$queryRawUnsafe<any[]>(
        `
        UPDATE "rh_client_presentation_candidates"
        SET
          "candidate_id" = COALESCE($1, "candidate_id"),
          "candidate_name" = $2,
          "candidate_phone" = NULLIF($3, ''),
          "candidate_email" = NULLIF($4, ''),
          "job_title" = $5,
          "rh_notes" = $6,
          "status" = 'waiting_client',
          "ai_interview_session_id" = $7::uuid,
          "ai_resume_score" = $8,
          "ai_interview_score" = $9,
          "ai_overall_score" = $10,
          "ai_recommendation" = $11,
          "ai_report" = $12::jsonb,
          "ai_resume_data" = $13::jsonb,
          "updated_at" = now()
        WHERE "id" = $14::uuid
        RETURNING *
        `,
        session.candidate_id || null,
        session.candidate_name || "Candidato",
        session.candidate_phone || "",
        session.candidate_email || "",
        job.title || "Vaga",
        rhNotes,
        session.id,
        session.resume_score,
        session.interview_score,
        session.overall_score,
        session.recommendation || null,
        JSON.stringify(session.ai_report || {}),
        JSON.stringify(session.resume_data || {}),
        existing.id
      );
      presentationCandidate = updated[0];
    } else {
      const created = await prisma.$queryRawUnsafe<any[]>(
        `
        INSERT INTO "rh_client_presentation_candidates" (
          "presentation_id",
          "company_id",
          "branch_id",
          "job_id",
          "candidate_id",
          "candidate_name",
          "candidate_phone",
          "candidate_email",
          "job_title",
          "interview_at",
          "rh_notes",
          "status",
          "ai_interview_session_id",
          "ai_resume_score",
          "ai_interview_score",
          "ai_overall_score",
          "ai_recommendation",
          "ai_report",
          "ai_resume_data",
          "created_at",
          "updated_at"
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4,
          $5,
          $6,
          NULLIF($7, ''),
          NULLIF($8, ''),
          $9,
          COALESCE($10::timestamptz, now()),
          $11,
          'waiting_client',
          $12::uuid,
          $13,
          $14,
          $15,
          $16,
          $17::jsonb,
          $18::jsonb,
          now(),
          now()
        )
        RETURNING *
        `,
        presentation.id,
        companyId,
        branchId || null,
        jobId,
        session.candidate_id || null,
        session.candidate_name || "Candidato",
        session.candidate_phone || "",
        session.candidate_email || "",
        job.title || "Vaga",
        session.completed_at || null,
        rhNotes,
        session.id,
        session.resume_score,
        session.interview_score,
        session.overall_score,
        session.recommendation || null,
        JSON.stringify(session.ai_report || {}),
        JSON.stringify(session.resume_data || {})
      );
      presentationCandidate = created[0];
    }

    await prisma.$executeRawUnsafe(
      `
      UPDATE "candidate_ai_interview_sessions"
      SET
        "rh_decision" = 'approved',
        "rh_decided_at" = now(),
        "client_presentation_id" = $1::uuid,
        "client_presentation_candidate_id" = $2::uuid,
        "updated_at" = now()
      WHERE "id" = $3::uuid
      `,
      presentation.id,
      presentationCandidate.id,
      session.id
    );

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      new URL(req.url).origin;

    return NextResponse.json({
      success: true,
      decision: "approved",
      presentationId: presentation.id,
      presentationCandidateId: presentationCandidate.id,
      clientLink: `${origin}/cliente/vaga/${presentation.token}`,
    });
  } catch (error: any) {
    console.error("AI INTERVIEW RH DECISION:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao salvar decisão do RH." },
      { status: 500 }
    );
  }
}
