import { prisma } from "@/lib/prisma";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}


function inferIntent(message: string) {
  const source = normalize(message);

  const rules: Array<[string, string[]]> = [
    ["ATENDIMENTO_HUMANO", ["atendente", "humano", "recrutador", "recrutadora", "falar com alguem", "falar com alguém"]],
    ["ENTREVISTA", ["entrevista", "horario da entrevista", "horário da entrevista", "reuniao", "reunião"]],
    ["PROCESSO", ["processo", "status", "etapa", "andamento", "resultado"]],
    ["CURRICULO", ["curriculo", "currículo", "cadastro", "meu perfil"]],
    ["DOCUMENTOS", ["documento", "documentos", "contrato", "assinatura"]],
    ["SEM_INTERESSE", ["nao tenho interesse", "não tenho interesse", "desistir", "desistencia", "desistência"]],
    ["VAGA", ["vaga", "vagas", "oportunidade", "emprego", "trabalho"]],
    ["SAUDACAO", ["oi", "ola", "olá", "bom dia", "boa tarde", "boa noite"]],
  ];

  for (const [intent, terms] of rules) {
    if (terms.some((term) => source.includes(normalize(term)))) {
      return intent;
    }
  }

  return null;
}

function matchesKeyword(
  message: string,
  keyword: string,
  matchType: string
) {
  const source = normalize(message);
  const target = normalize(keyword);

  if (!target) return false;
  if (matchType === "exact") return source === target;
  if (matchType === "starts_with") return source.startsWith(target);
  return source.includes(target);
}

export async function findCandidateChatAutomation(
  companyId: string,
  message: string
) {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT *
    FROM "candidate_portal_automations"
    WHERE "company_id" = ${companyId}::uuid
      AND "active" = true
    ORDER BY
      "is_fallback" ASC,
      "priority" DESC,
      "updated_at" DESC
  `;

  const fallback = rows.find((item) => item.is_fallback);
  const inferredIntent = inferIntent(message);

  for (const item of rows) {
    if (item.is_fallback) continue;

    const keywords = Array.isArray(item.trigger_keywords)
      ? item.trigger_keywords
      : [];

    const keywordMatch = keywords.some((keyword: string) =>
      matchesKeyword(message, keyword, item.match_type || "contains")
    );

    const intentMatch =
      Boolean(item.intent) &&
      Boolean(inferredIntent) &&
      String(item.intent).toUpperCase() === inferredIntent;

    if (keywordMatch || intentMatch) {
      return item;
    }
  }

  return fallback || null;
}

export function renderCandidateAutomationResponse(
  automation: any,
  profile: any
) {
  const pool = [
    automation?.response_text,
    ...(Array.isArray(automation?.response_variations)
      ? automation.response_variations
      : []),
  ].filter(Boolean);

  const base = String(pool[0] || "");
  const firstName = String(profile?.full_name || "candidato")
    .trim()
    .split(/\s+/)[0];

  return base
    .replace(/\{\{nome\}\}/gi, firstName)
    .replace(/\{\{candidato\}\}/gi, firstName)
    .replace(/\{\{cliente\}\}/gi, firstName);
}
