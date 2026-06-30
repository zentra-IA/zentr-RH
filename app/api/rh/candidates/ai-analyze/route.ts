import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireCompany } from "@/lib/server-company";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

function clean(value: any) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeScore(value: any) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalizeStatus(value: any, fallback = "novo") {
  const status = clean(value);
  const allowed = [
    "novo",
    "triagem",
    "entrevista",
    "aprovado",
    "banco_de_talentos",
    "reprovado",
  ];

  return allowed.includes(status) ? status : fallback;
}

function compactCandidateText(candidate: any) {
  const experiences = candidate.experiences || {};
  const raw = candidate.rawImportData || {};

  return `
Nome: ${clean(candidate.name)}
Telefone: ${clean(candidate.phone)}
Celular: ${clean(candidate.mobile)}
Email: ${clean(candidate.email)}
Cidade: ${clean(candidate.city)}
Estado: ${clean(candidate.state)}
Bairro: ${clean(candidate.neighborhood)}
Origem: ${clean(candidate.resumeOrigin)}
Status atual: ${clean(candidate.status)}

Formação: ${clean(candidate.education || raw["Formação"] || raw["Treinamento"])}
Curso: ${clean(candidate.course)}
Cargo atual: ${clean(candidate.lastRole || raw["Título"])}
Idiomas: ${Array.isArray(candidate.languages) ? candidate.languages.join(", ") : clean(raw["Idiomas"])}

Experiência:
${clean(experiences.texto || raw["Experiência profissional"]).slice(0, 3500)}

Histórico:
${clean(experiences.historico || raw["Histórico de candidatura na empresa"] || raw["Histórico de aplicação na empresa"]).slice(0, 1000)}
`;
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOpenAI(payload: any, apiKey: string) {
  let lastErrorText = "";

  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();

    if (response.ok) {
      return text;
    }

    lastErrorText = text;

    const retryable =
      response.status === 429 ||
      response.status === 500 ||
      response.status === 502 ||
      response.status === 503 ||
      response.status === 504;

    console.error(`OPENAI ERROR tentativa ${attempt}:`, text);

    if (!retryable || attempt === 3) {
      throw new Error(text);
    }

    await wait(800 * attempt);
  }

  throw new Error(lastErrorText || "Erro desconhecido ao chamar OpenAI.");
}

export async function POST(req: NextRequest) {
  try {
    const { companyId } = await requireCompany(req);
    const body = await req.json();

    const candidateId = clean(body.candidateId);

    if (!candidateId) {
      return NextResponse.json(
        { error: "candidateId é obrigatório." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY não configurada no .env.local." },
        { status: 500 }
      );
    }

    const candidate = await prisma.candidateProfile.findFirst({
      where: {
        id: candidateId,
        company_id: companyId,
        active: true,
      },
    });

    if (!candidate) {
      return NextResponse.json(
        { error: "Candidato não encontrado." },
        { status: 404 }
      );
    }

    const prompt = `
Analise este candidato para recrutamento.

Retorne APENAS JSON válido, sem markdown, neste formato:
{
  "aiSummary": "resumo curto",
  "professionalSummary": "resumo profissional objetivo",
  "mainRole": "cargo principal ou null",
  "educationLevel": "formação resumida ou null",
  "course": "curso principal ou null",
  "skills": ["habilidade"],
  "languages": ["idioma"],
  "strengths": ["ponto forte"],
  "attentionPoints": ["ponto de atenção"],
  "recommendedStatus": "novo",
  "score": 0,
  "tags": ["tag"]
}

Status permitido:
novo, triagem, entrevista, aprovado, banco_de_talentos, reprovado.

Não invente dados. Se não souber, use null ou [].

Candidato:
${compactCandidateText(candidate)}
`;

    const payload = {
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "Você é uma IA especialista em RH. Responda somente JSON válido.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_output_tokens: 900,
    };

    const responseText = await callOpenAI(payload, apiKey);
    const responseJson = safeJsonParse(responseText);

    const outputText =
      responseJson?.output_text ||
      responseJson?.output?.[0]?.content?.[0]?.text ||
      responseJson?.output?.[0]?.content?.[0]?.content ||
      "";

    const parsed = safeJsonParse(outputText);

    if (!parsed) {
      console.error("IA SEM JSON VÁLIDO:");
      console.error(outputText || responseText);

      return NextResponse.json(
        {
          error: "A IA não retornou JSON válido.",
          raw: outputText || responseText,
        },
        { status: 500 }
      );
    }

    const previousAi =
      candidate.aiExtractedData && typeof candidate.aiExtractedData === "object"
        ? candidate.aiExtractedData
        : {};

    const recommendedStatus = normalizeStatus(
      parsed.recommendedStatus,
      candidate.status || "novo"
    );

    const updated = await prisma.candidateProfile.update({
      where: { id: candidate.id },
      data: {
        aiSummary: clean(parsed.aiSummary) || candidate.aiSummary,
        professionalSummary:
          clean(parsed.professionalSummary) || candidate.professionalSummary,
        lastRole: clean(parsed.mainRole) || candidate.lastRole,
        education: clean(parsed.educationLevel) || candidate.education,
        course: clean(parsed.course) || candidate.course,
        skills: Array.isArray(parsed.skills)
          ? parsed.skills.map(String).filter(Boolean)
          : candidate.skills,
        languages: Array.isArray(parsed.languages)
          ? parsed.languages.map(String).filter(Boolean)
          : candidate.languages,
        status: recommendedStatus,
        aiExtractedData: {
          ...(previousAi as any),
          analyzedAt: new Date().toISOString(),
          aiSummary: clean(parsed.aiSummary),
          professionalSummary: clean(parsed.professionalSummary),
          cargoPrincipal:
            clean(parsed.mainRole) ||
            (previousAi as any)?.cargoPrincipal ||
            candidate.lastRole ||
            null,
          formacao:
            clean(parsed.educationLevel) ||
            (previousAi as any)?.formacao ||
            candidate.education ||
            null,
          curso:
            clean(parsed.course) ||
            (previousAi as any)?.curso ||
            candidate.course ||
            null,
          skills: Array.isArray(parsed.skills) ? parsed.skills : [],
          languages: Array.isArray(parsed.languages) ? parsed.languages : [],
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
          attentionPoints: Array.isArray(parsed.attentionPoints)
            ? parsed.attentionPoints
            : [],
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
          score: normalizeScore(parsed.score),
          status: recommendedStatus,
        },
      },
    });

    return NextResponse.json({
      success: true,
      candidate: updated,
      analysis: parsed,
    });
  } catch (error: any) {
    console.error("ERRO COMPLETO AI ANALYZE:");
    console.error(error);

    return NextResponse.json(
      {
        error: "Erro ao analisar candidato com IA.",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
