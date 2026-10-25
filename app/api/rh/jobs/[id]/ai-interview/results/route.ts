import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireCompany } from "@/lib/server-company";
import { prisma } from "@/lib/ai-interview";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompany(req);
    const { id: jobId } = await context.params;

    const job = await prisma.job.findFirst({
      where: { id: jobId, company_id: companyId },
      select: { id: true, title: true, department: true },
    });
    if (!job) {
      return NextResponse.json({ error: "Vaga não encontrada." }, { status: 404 });
    }

    const results = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM "candidate_ai_interview_sessions"
      WHERE "company_id"::text = ${companyId}::text
        AND "job_id"::text = ${jobId}::text
        AND "deleted_at" IS NULL
      ORDER BY
        CASE WHEN "status" = 'completed' THEN 0 ELSE 1 END,
        "overall_score" DESC NULLS LAST,
        "created_at" DESC
      LIMIT 500
    `;

    return NextResponse.json({ success: true, job, results });
  } catch (error: any) {
    console.error("AI INTERVIEW RESULTS GET:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao buscar entrevistas." },
      { status: 500 }
    );
  }
}

// Exclui APENAS a sessão da lista de entrevistas da vaga (soft delete).
// Não apaga CandidateProfile, currículo, JobMatch, apresentação do cliente ou contratação.
// POST com {sessionIds:string[]} deliberadamente evita DELETE com body em proxies legados.
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId, userId } = await requireCompany(req);
    const { id: jobId } = await context.params;
    const body = await req.json().catch(() => ({}));

    const input: unknown[] = Array.isArray(body?.sessionIds) ? body.sessionIds : [];
    const sessionIds: string[] = Array.from(
      new Set<string>(input.map((value) => String(value ?? "").trim()))
    );

    if (!sessionIds.length || sessionIds.length > 200 || sessionIds.some((id) => !UUID.test(id))) {
      return NextResponse.json(
        { error: "Selecione entre 1 e 200 entrevistas válidas para excluir." },
        { status: 400 }
      );
    }

    const job = await prisma.job.findFirst({
      where: { id: jobId, company_id: companyId },
      select: { id: true },
    });
    if (!job) {
      return NextResponse.json({ error: "Vaga não encontrada." }, { status: 404 });
    }

    // IDs explicitamente convertidos em UUID: só parâmetros validados,
    // listagem parametrizada pelo Prisma (sem interpolação insegura).
    const ids = Prisma.join(sessionIds.map((id) => Prisma.sql`${id}::uuid`));

    const removed = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "candidate_ai_interview_sessions"
      SET "deleted_at" = now(),
          "deleted_by" = ${userId || null}::text,
          "updated_at" = now()
      WHERE "company_id"::text = ${companyId}::text
        AND "job_id"::text = ${jobId}::text
        AND "id" IN (${ids})
        AND "deleted_at" IS NULL
      RETURNING "id"
    `);

    return NextResponse.json({
      success: true,
      removedCount: removed.length,
      removedIds: removed.map((row) => String(row.id)),
      // Os perfis de candidatos e registros do cliente NÃO são alterados.
      preservedCandidateProfiles: true,
      preservedClientPresentations: true,
    });
  } catch (error: any) {
    console.error("AI INTERVIEW RESULTS DELETE:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao excluir entrevistas." },
      { status: 500 }
    );
  }
}
