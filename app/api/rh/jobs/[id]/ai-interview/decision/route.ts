import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireCompany } from "@/lib/server-company";
import { prisma } from "@/lib/ai-interview";

export const dynamic = "force-dynamic";

// Em Job e nas tabelas do fluxo de apresentação, job_id e candidate_id
// são TEXT; ids de sessões e apresentações são UUID.
// Comparações explícitas de texto evitam o erro PostgreSQL 42883 (text = uuid).
const uuidRE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function asObject(value: any): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function evidence(items: any): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .slice(0, 4)
    .map((item) => clean(
      typeof item === "string" ? item
      : item?.title || item?.evidence || item?.description
    ))
    .filter(Boolean);
}

function buildNotes(session: any): string {
  const r = asObject(session.ai_report);
  const strengths = evidence(r.strengths);
  const attention = evidence(r.attentionPoints);
  return [
    "ENTREVISTA INTELIGENTE POR IA — apoio ao RH",
    session.overall_score != null ? `Aderência geral estimada: ${session.overall_score}%` : "",
    session.resume_score != null ? `Currículo: ${session.resume_score}%` : "",
    session.interview_score != null ? `Entrevista: ${session.interview_score}%` : "",
    clean(r.summary) ? `Resumo: ${clean(r.summary)}` : "",
    strengths.length ? `Evidências favoráveis: ${strengths.join("; ")}` : "",
    attention.length ? `Pontos para confirmar: ${attention.join("; ")}` : "",
    "Avaliação automatizada não substitui análise humana.",
  ].filter(Boolean).join("\n");
}

function clientUrl(req: NextRequest, token: string): string {
  const base = clean(process.env.NEXT_PUBLIC_APP_URL)
    || clean(process.env.NEXT_PUBLIC_SITE_URL)
    || new URL(req.url).origin;
  return `${base.replace(/\/$/, "")}/cliente/vaga/${encodeURIComponent(token)}`;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId, branchId } = await requireCompany(req);
    const { id: jobId } = await context.params;
    const body = await req.json();
    const sessionId = clean(body.sessionId || body.session_id);
    const decision = clean(body.decision);

    if (!uuidRE.test(sessionId) || !["approved", "rejected", "reset"].includes(decision)) {
      return NextResponse.json({ error: "Entrevista ou decisão inválida." }, { status: 400 });
    }

    // Job usa ID cuid()/TEXT, consultado pela API Prisma já presente no sistema.
    const job = await prisma.job.findFirst({
      where: { id: jobId, company_id: companyId },
      select: { id: true, title: true, branch_id: true },
    });
    if (!job) {
      return NextResponse.json({ error: "Vaga não encontrada para esta empresa." }, { status: 404 });
    }

    type DecisionResult = {
      decision: string | null;
      clientLink?: string;
      presentationId?: string;
    };

    const result = await prisma.$transaction(async (tx): Promise<DecisionResult> => {
      const sessions = await tx.$queryRaw<any[]>`
        SELECT *
        FROM "candidate_ai_interview_sessions"
        WHERE "id"::text = ${sessionId}::text
          AND "company_id"::text = ${companyId}::text
          AND "job_id"::text = ${jobId}::text
          AND "deleted_at" IS NULL
        LIMIT 1
        FOR UPDATE
      `;
      const session = sessions[0];
      if (!session) throw new Error("Entrevista não encontrada ou removida.");

      if (decision === "reset") {
        if (session.rh_decision === "approved") {
          throw new Error(
            "Este candidato já foi encaminhado ao cliente. Para alterar o envio, use 'Candidatos enviados a cliente'."
          );
        }
        await tx.$executeRaw`
          UPDATE "candidate_ai_interview_sessions"
          SET "rh_decision" = NULL, "rh_decided_at" = NULL, "updated_at" = now()
          WHERE "id"::text = ${sessionId}::text
            AND "company_id"::text = ${companyId}::text
            AND "job_id"::text = ${jobId}::text
        `;
        return { decision: null };
      }

      if (session.status !== "completed") {
        throw new Error("A entrevista ainda não foi concluída.");
      }

      if (session.rh_decision === "approved" && decision === "rejected") {
        throw new Error(
          "O candidato já foi encaminhado ao cliente. Gerencie a alteração na apresentação do cliente."
        );
      }

      if (decision === "rejected") {
        await tx.$executeRaw`
          UPDATE "candidate_ai_interview_sessions"
          SET "rh_decision" = 'rejected', "rh_decided_at" = now(), "updated_at" = now()
          WHERE "id"::text = ${sessionId}::text
            AND "company_id"::text = ${companyId}::text
            AND "job_id"::text = ${jobId}::text
        `;
        return { decision: "rejected" };
      }

      // Reenvio idempotente: não duplica um candidato já encaminhado.
      if (session.rh_decision === "approved" && session.client_presentation_id) {
        const linked = await tx.$queryRaw<any[]>`
          SELECT "id", "token"
          FROM "rh_client_presentations"
          WHERE "id"::text = ${session.client_presentation_id}::text
            AND "company_id"::text = ${companyId}::text
          LIMIT 1
        `;
        if (linked[0]) {
          return {
            decision: "approved",
            presentationId: String(linked[0].id),
            clientLink: clientUrl(req, String(linked[0].token)),
          };
        }
      }

      // Reaproveita o funil existente da mesma vaga.
      const previous = await tx.$queryRaw<any[]>`
        SELECT *
        FROM "rh_client_presentations"
        WHERE "company_id"::text = ${companyId}::text
          AND "job_id"::text = ${jobId}::text
          AND COALESCE("workflow_status", 'in_progress') IN ('in_progress', 'paused')
        ORDER BY "created_at" DESC
        LIMIT 1
        FOR UPDATE
      `;

      let presentation = previous[0];
      if (!presentation) {
        const created = await tx.$queryRaw<any[]>`
          INSERT INTO "rh_client_presentations" (
            "company_id", "branch_id", "job_id", "token", "title",
            "status", "workflow_status", "created_at", "updated_at"
          )
          VALUES (
            ${companyId}::uuid,
            ${branchId || job.branch_id || null}::uuid,
            ${jobId}::text,
            ${randomBytes(24).toString("hex")}::text,
            ${job.title}::text,
            'draft', 'in_progress',
            now(), now()
          )
          RETURNING *
        `;
        presentation = created[0];
      }

      // candidate_id é TEXT, não UUID, conforme esquema do funil.
      // Se não tiver ID, tenta reaproveitar por telefone normalizado.
      let linkedCandidate: any | null = null;
      if (session.candidate_id) {
        const byId = await tx.$queryRaw<any[]>`
          SELECT *
          FROM "rh_client_presentation_candidates"
          WHERE "presentation_id"::text = ${presentation.id}::text
            AND "company_id"::text = ${companyId}::text
            AND "candidate_id"::text = ${String(session.candidate_id)}::text
          LIMIT 1
          FOR UPDATE
        `;
        linkedCandidate = byId[0] || null;
      }
      const phoneDigits = clean(session.candidate_phone).replace(/\D/g, "");
      if (!linkedCandidate && phoneDigits.length >= 8) {
        const byPhone = await tx.$queryRaw<any[]>`
          SELECT *
          FROM "rh_client_presentation_candidates"
          WHERE "presentation_id"::text = ${presentation.id}::text
            AND "company_id"::text = ${companyId}::text
            AND regexp_replace(COALESCE("candidate_phone", ''), '[^0-9]', '', 'g')
                = ${phoneDigits}::text
          LIMIT 1
          FOR UPDATE
        `;
        linkedCandidate = byPhone[0] || null;
      }
      if (linkedCandidate &&
          ["approved_by_client", "rejected_by_client", "sent_to_hiring"].includes(linkedCandidate.status)) {
        throw new Error(
          "Este candidato já recebeu uma decisão do cliente. Revise em 'Candidatos enviados a cliente'."
        );
      }

      const generatedNotes = buildNotes(session);
      const fullNotes = linkedCandidate?.rh_notes &&
          !clean(linkedCandidate.rh_notes).includes("ENTREVISTA INTELIGENTE POR IA")
        ? `${clean(linkedCandidate.rh_notes)}\n\n${generatedNotes}`
        : generatedNotes;

      let member: any;
      if (linkedCandidate) {
        const updated = await tx.$queryRaw<any[]>`
          UPDATE "rh_client_presentation_candidates"
          SET "candidate_id" = COALESCE(${session.candidate_id || null}::text, "candidate_id"),
              "candidate_name" = ${session.candidate_name || "Candidato"}::text,
              "candidate_phone" = COALESCE(NULLIF(${session.candidate_phone || ""}::text, ''), "candidate_phone"),
              "candidate_email" = COALESCE(NULLIF(${session.candidate_email || ""}::text, ''), "candidate_email"),
              "job_title" = ${job.title}::text,
              "rh_notes" = ${fullNotes}::text,
              "status" = 'waiting_client',
              "ai_interview_session_id" = ${session.id}::uuid,
              "ai_resume_score" = ${session.resume_score},
              "ai_interview_score" = ${session.interview_score},
              "ai_overall_score" = ${session.overall_score},
              "ai_recommendation" = ${session.recommendation || null}::text,
              "ai_report" = ${JSON.stringify(session.ai_report || {})}::jsonb,
              "ai_resume_data" = ${JSON.stringify(session.resume_data || {})}::jsonb,
              "updated_at" = now()
          WHERE "id"::text = ${linkedCandidate.id}::text
            AND "company_id"::text = ${companyId}::text
          RETURNING *
        `;
        member = updated[0];
      } else {
        const added = await tx.$queryRaw<any[]>`
          INSERT INTO "rh_client_presentation_candidates" (
            "presentation_id", "company_id", "branch_id", "job_id",
            "candidate_id", "candidate_name", "candidate_phone",
            "candidate_email", "job_title", "interview_at", "rh_notes",
            "status", "ai_interview_session_id", "ai_resume_score",
            "ai_interview_score", "ai_overall_score", "ai_recommendation",
            "ai_report", "ai_resume_data", "created_at", "updated_at"
          )
          VALUES (
            ${presentation.id}::uuid,
            ${companyId}::uuid,
            ${branchId || job.branch_id || null}::uuid,
            ${jobId}::text,
            ${session.candidate_id || null}::text,
            ${session.candidate_name || "Candidato"}::text,
            ${session.candidate_phone || null}::text,
            ${session.candidate_email || null}::text,
            ${job.title}::text,
            ${session.completed_at || null}::timestamptz,
            ${generatedNotes}::text,
            'waiting_client',
            ${session.id}::uuid,
            ${session.resume_score},
            ${session.interview_score},
            ${session.overall_score},
            ${session.recommendation || null}::text,
            ${JSON.stringify(session.ai_report || {})}::jsonb,
            ${JSON.stringify(session.resume_data || {})}::jsonb,
            now(), now()
          )
          RETURNING *
        `;
        member = added[0];
      }

      await tx.$executeRaw`
        UPDATE "candidate_ai_interview_sessions"
        SET "rh_decision" = 'approved',
            "rh_decided_at" = now(),
            "client_presentation_id" = ${presentation.id}::uuid,
            "client_presentation_candidate_id" = ${member.id}::uuid,
            "updated_at" = now()
        WHERE "id"::text = ${sessionId}::text
          AND "company_id"::text = ${companyId}::text
          AND "job_id"::text = ${jobId}::text
      `;

      return {
        decision: "approved",
        presentationId: String(presentation.id),
        clientLink: clientUrl(req, String(presentation.token)),
      };
    }, { timeout: 15000, maxWait: 10000 });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("AI INTERVIEW RH DECISION:", error);
    const message = clean(error?.message) || "Erro ao salvar decisão.";
    const status = /(não encontrad|não concluíd)/i.test(message) ? 404
      : /(já foi|já recebeu|ainda não)/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
