import { NextRequest, NextResponse } from "next/server";
import {
  callOpenAIJson,
  clean,
  findJobByInterviewToken,
  jobInterviewConfig,
  prisma,
} from "@/lib/ai-interview";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const job = await findJobByInterviewToken(token);

    if (!job) {
      return NextResponse.json({ error: "Entrevista não encontrada." }, { status: 404 });
    }

    const body = await req.json();
    const sessionToken = clean(body.sessionToken);
    const answers = Array.isArray(body.answers) ? body.answers : [];

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT *
      FROM candidate_ai_interview_sessions
      WHERE session_token = $1
        AND company_id = $2::uuid
        AND job_id = $3
      LIMIT 1
      `,
      sessionToken,
      job.company_id,
      job.id
    );

    const session = rows[0];
    if (!session) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 404 });
    }

    const config = jobInterviewConfig(job);

    const report = await callOpenAIJson(`
Avalie esta pré-entrevista como APOIO ao recrutador.

VAGA:
${JSON.stringify({
  title: job.title,
  description: job.description,
  workMode: job.workMode,
  contractType: job.contractType,
  requirements: job.requirements,
  filters: job.filters,
}, null, 2)}

PERFIL DESEJADO:
${config.profile || ""}

SINAIS PROFISSIONAIS POSITIVOS:
${config.positiveSignals || ""}

PONTOS PROFISSIONAIS DE ATENÇÃO:
${config.attentionSignals || ""}

CURRÍCULO:
${JSON.stringify(session.resume_data || {}, null, 2)}

PERGUNTAS:
${JSON.stringify(session.questions || [], null, 2)}

RESPOSTAS:
${JSON.stringify(answers, null, 2)}

TRANSCRIÇÃO DO ÁUDIO:
${session.audio_transcript || ""}

TRANSCRIÇÃO DO VÍDEO:
${session.video_transcript || ""}

Regras obrigatórias:
- Use somente critérios profissionais e relacionados à função.
- Não infira personalidade clínica, saúde mental, ansiedade, depressão, condição médica, deficiência, religião, raça/etnia, orientação sexual, gravidez, situação familiar, filhos, situação financeira ou outros atributos sensíveis.
- Não avalie rosto, aparência, linguagem corporal, emoção vocal ou biometria.
- Áudio e vídeo servem apenas para analisar o CONTEÚDO verbal e a clareza da comunicação.
- Não tome decisão final de contratação.
- Separe fatos/evidências de inferências.
- Se faltar evidência, diga que falta evidência.

Retorne:
{
  "resumeScore": 0,
  "interviewScore": 0,
  "overallScore": 0,
  "recommendation": "forte_aderencia | aderencia | avaliar | baixa_aderencia",
  "summary": "",
  "strengths": [
    {"title": "", "evidence": ""}
  ],
  "attentionPoints": [
    {"title": "", "evidence": ""}
  ],
  "dimensions": {
    "experiencia_relevante": 0,
    "comunicacao_profissional": 0,
    "autonomia_organizacao": 0,
    "aderencia_modelo_trabalho": 0,
    "orientacao_resultados": 0,
    "consistencia_curriculo_respostas": 0
  },
  "suggestedHumanFollowUps": [],
  "limitations": []
}

Scores de 0 a 100. Dê nota somente quando houver evidência suficiente.
`);

    const clamp = (value: any) =>
      Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

    const resumeScore = clamp(report.resumeScore);
    const interviewScore = clamp(report.interviewScore);
    const overallScore = clamp(report.overallScore);
    const recommendation = clean(report.recommendation) || "avaliar";

    await prisma.$executeRawUnsafe(
      `
      UPDATE candidate_ai_interview_sessions
      SET
        answers = $1::jsonb,
        resume_score = $2,
        interview_score = $3,
        overall_score = $4,
        recommendation = $5,
        ai_report = $6::jsonb,
        status = 'completed',
        completed_at = now(),
        updated_at = now()
      WHERE session_token = $7
      `,
      JSON.stringify(answers),
      resumeScore,
      interviewScore,
      overallScore,
      recommendation,
      JSON.stringify(report),
      sessionToken
    );

    if (session.candidate_id) {
      await prisma.jobApplication.upsert({
        where: {
          jobId_candidateId: {
            jobId: job.id,
            candidateId: session.candidate_id,
          },
        },
        update: {
          source: "entrevista_ia",
          stage: "entrevista",
          status: "active",
          notes: `Pré-entrevista IA concluída. Score de apoio: ${overallScore}%.`,
        },
        create: {
          company_id: job.company_id,
          jobId: job.id,
          candidateId: session.candidate_id,
          source: "entrevista_ia",
          stage: "entrevista",
          status: "active",
          notes: `Pré-entrevista IA concluída. Score de apoio: ${overallScore}%.`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Entrevista concluída.",
    });
  } catch (error: any) {
    console.error("PUBLIC AI INTERVIEW SUBMIT:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao concluir entrevista." },
      { status: 500 }
    );
  }
}
