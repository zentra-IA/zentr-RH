import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  findJobByInterviewToken,
  jobInterviewConfig,
  compactJob,
  prisma,
} from "@/lib/ai-interview";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const job = await findJobByInterviewToken(token);

    if (!job) {
      return NextResponse.json(
        { error: "Entrevista não encontrada ou desativada." },
        { status: 404 }
      );
    }

    const config = jobInterviewConfig(job);

    return NextResponse.json({
      success: true,
      interview: {
        job: {
          id: job.id,
          title: job.title,
          department: job.department,
          city: job.city,
          state: job.state,
          workMode: job.workMode,
          contractType: job.contractType,
          description: job.description,
        },
        videoUrl: config.videoUrl || null,
        intro:
          "Esta pré-entrevista usa IA como apoio ao recrutador. O resultado não substitui a avaliação humana.",
      },
    });
  } catch (error: any) {
    console.error("PUBLIC AI INTERVIEW GET:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao carregar entrevista." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const job = await findJobByInterviewToken(token);

    if (!job) {
      return NextResponse.json(
        { error: "Entrevista não encontrada ou desativada." },
        { status: 404 }
      );
    }

    const body = await req.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const consent = body.consent === true;

    if (!name || !phone) {
      return NextResponse.json(
        { error: "Informe nome e telefone." },
        { status: 400 }
      );
    }

    if (!consent) {
      return NextResponse.json(
        { error: "É necessário aceitar o tratamento dos dados desta entrevista." },
        { status: 400 }
      );
    }

    const sessionToken = crypto.randomUUID();
    const config = jobInterviewConfig(job);
    const questions = Array.isArray(config.questions) ? config.questions : [];

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      INSERT INTO candidate_ai_interview_sessions (
        company_id,
        job_id,
        session_token,
        candidate_name,
        candidate_email,
        candidate_phone,
        questions,
        status,
        consent_at
      )
      VALUES (
        $1::uuid,
        $2,
        $3,
        $4,
        NULLIF($5, ''),
        $6,
        $7::jsonb,
        'started',
        now()
      )
      RETURNING id, session_token
      `,
      job.company_id,
      job.id,
      sessionToken,
      name,
      email,
      phone,
      JSON.stringify(questions)
    );

    return NextResponse.json({
      success: true,
      sessionToken: rows[0]?.session_token,
      job: compactJob(job),
    });
  } catch (error: any) {
    console.error("PUBLIC AI INTERVIEW POST:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao iniciar entrevista." },
      { status: 500 }
    );
  }
}
