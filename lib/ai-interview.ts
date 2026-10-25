import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export function clean(value: unknown) {
  return String(value ?? "").trim();
}

export function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export function responseOutputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload?.output) ? payload.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === "string") return part.text;
    }
  }
  return "";
}

export async function callOpenAIJson(prompt: string, maxTokens = 2200) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada.");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "Você é uma IA de apoio a recrutamento. Use somente critérios profissionais relacionados à vaga. Não infira nem avalie saúde mental, condição médica, deficiência, religião, raça/etnia, orientação sexual, situação familiar, gravidez, opinião política ou outros atributos sensíveis. Não tome decisão final de contratação. Responda somente JSON válido.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.15,
      max_output_tokens: maxTokens,
    }),
  });

  const text = await response.text();
  if (!response.ok) throw new Error(text);

  const payload = safeJson(text) || {};
  const parsed = safeJson(responseOutputText(payload));
  if (!parsed) throw new Error("A IA não retornou JSON válido.");
  return parsed;
}

export async function findJobByInterviewToken(token: string) {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT *
      FROM "Job"
      WHERE COALESCE(("aiCriteria"->'aiInterview'->>'enabled')::boolean, false) = true
        AND "aiCriteria"->'aiInterview'->>'publicToken' = $1
      LIMIT 1
    `,
    token
  );
  return rows[0] || null;
}

export function jobInterviewConfig(job: any) {
  const ai =
    job?.aiCriteria && typeof job.aiCriteria === "object"
      ? job.aiCriteria
      : {};
  return ai?.aiInterview && typeof ai.aiInterview === "object"
    ? ai.aiInterview
    : {};
}

export function compactJob(job: any) {
  return {
    id: job.id,
    title: job.title,
    description: job.description,
    city: job.city,
    state: job.state,
    workMode: job.workMode,
    contractType: job.contractType,
    educationRequired: job.educationRequired,
    experienceRequired: job.experienceRequired,
    skillsRequired: job.skillsRequired || [],
    requirements: job.requirements || {},
    filters: job.filters || {},
    aiCriteria: job.aiCriteria || {},
  };
}
