import { NextRequest, NextResponse } from "next/server";
import { requireCompany } from "@/lib/server-company";
import {
  callOpenAIJson,
  compactJob,
  jobInterviewConfig,
  prisma,
} from "@/lib/ai-interview";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompany(req);
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));

    const job = await prisma.job.findFirst({
      where: { id, company_id: companyId },
    });

    if (!job) {
      return NextResponse.json({ error: "Vaga não encontrada." }, { status: 404 });
    }

    const current = jobInterviewConfig(job);
    const profile = String(body.profile || current.profile || "").trim();
    const positiveSignals = String(
      body.positiveSignals || current.positiveSignals || ""
    ).trim();
    const attentionSignals = String(
      body.attentionSignals || current.attentionSignals || ""
    ).trim();

    if (!profile) {
      return NextResponse.json(
        { error: "Descreva o perfil desejado antes de gerar as perguntas." },
        { status: 400 }
      );
    }

    const result = await callOpenAIJson(`
Crie um roteiro BASE de pré-entrevista para a vaga abaixo.

A entrevista será adaptativa: depois, outra etapa poderá criar perguntas de aprofundamento com base no currículo e nas respostas.

VAGA:
${JSON.stringify(compactJob(job), null, 2)}

PERFIL DESEJADO:
${profile}

SINAIS PROFISSIONAIS POSITIVOS:
${positiveSignals || "não informado"}

PONTOS PROFISSIONAIS DE ATENÇÃO:
${attentionSignals || "não informado"}

Gere 8 a 12 perguntas curtas, naturais e úteis para RH.

Regras:
- Pergunte somente sobre experiência profissional, rotina, metas, situações de trabalho, autonomia, comunicação, disponibilidade e aderência REAL ao modelo da vaga.
- Não faça perguntas sobre saúde, doenças, ansiedade, religião, raça, orientação sexual, gravidez, família, filhos, situação financeira ou outros atributos sensíveis.
- Não use idade como critério comportamental.
- Inclua perguntas situacionais para reduzir respostas ensaiadas.
- Não trate o resultado como decisão final.

Retorne:
{
  "questions": [
    {
      "prompt": "pergunta",
      "purpose": "o que esta pergunta ajuda a observar",
      "type": "text"
    }
  ]
}
`);

    const questions = Array.isArray(result.questions) ? result.questions : [];

    return NextResponse.json({
      success: true,
      questions,
    });
  } catch (error: any) {
    console.error("AI INTERVIEW GENERATE:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao gerar perguntas." },
      { status: 500 }
    );
  }
}
