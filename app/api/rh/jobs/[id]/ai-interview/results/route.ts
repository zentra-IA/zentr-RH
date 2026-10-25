import { NextRequest, NextResponse } from "next/server";
import { requireCompany } from "@/lib/server-company";
import { prisma } from "@/lib/ai-interview";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompany(req);
    const { id } = await context.params;

    const job = await prisma.job.findFirst({
      where: { id, company_id: companyId },
    });

    if (!job) {
      return NextResponse.json({ error: "Vaga não encontrada." }, { status: 404 });
    }

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT *
      FROM candidate_ai_interview_sessions
      WHERE company_id = $1::uuid
        AND job_id = $2
      ORDER BY
        CASE WHEN status = 'completed' THEN 0 ELSE 1 END,
        overall_score DESC NULLS LAST,
        created_at DESC
      LIMIT 500
      `,
      companyId,
      id
    );

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        title: job.title,
        department: job.department,
      },
      results: rows,
    });
  } catch (error: any) {
    console.error("AI INTERVIEW RESULTS:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao buscar resultados." },
      { status: 500 }
    );
  }
}
