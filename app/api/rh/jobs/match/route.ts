import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireCompany } from "@/lib/server-company";

export const dynamic = "force-dynamic";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

const BLOCKED_MATCH_STATUSES = ["selected", "contacted", "interview", "hired"];

type MatchResult = {
  candidate: any;
  score: number;
  strengths: string[];
  attentionPoints: string[];
  missingRequirements: string[];
  reason: string;
  aiRawResult?: any;
};

function clean(value: any) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalize(value: any) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(value: any) {
  return normalize(value)
    .split(" ")
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);
}

function toArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);

  return String(value)
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeJsonParse(text: string) {
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

function calculateAge(dateValue: any) {
  if (!dateValue) return null;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();

  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < date.getDate())
  ) {
    age--;
  }

  if (age < 0 || age > 120) return null;
  return age;
}

function candidateAge(candidate: any) {
  const ai = candidate.aiExtractedData || {};

  const fromAi = Number(ai.idade || ai.age);
  if (Number.isFinite(fromAi) && fromAi > 0 && fromAi <= 120) {
    return Math.round(fromAi);
  }

  return calculateAge(candidate.birthDate);
}

function candidateText(candidate: any) {
  const ai = candidate.aiExtractedData || {};
  const experiences = candidate.experiences || {};

  return normalize(
    [
      candidate.name,
      candidate.city,
      candidate.state,
      candidate.neighborhood,
      candidate.education,
      candidate.course,
      candidate.lastRole,
      candidate.professionalSummary,
      candidate.aiSummary,
      candidate.resumeOrigin,
      experiences.texto,
      experiences.treinamentos,
      experiences.historico,
      ai.cargoPrincipal,
      ai.formacao,
      ai.curso,
      ai.experienciaTexto,
      ...(candidate.skills || []),
      ...(candidate.languages || []),
      ...(ai.skills || []),
      ...(ai.tags || []),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function jobCriteria(job: any) {
  const filters = job.filters && typeof job.filters === "object" ? job.filters : {};
  const requirements =
    job.requirements && typeof job.requirements === "object" ? job.requirements : {};
  const aiCriteria =
    job.aiCriteria && typeof job.aiCriteria === "object" ? job.aiCriteria : {};

  const ageMin =
    Number(filters.ageMin || requirements.ageMin || aiCriteria.ageMin) || null;
  const ageMax =
    Number(filters.ageMax || requirements.ageMax || aiCriteria.ageMax) || null;

  const skills = [
    ...toArray(job.skillsRequired),
    ...toArray(filters.skillsRequired),
    ...toArray(requirements.skillsRequired),
    ...toArray(aiCriteria.skillsRequired),
    ...toArray(aiCriteria.skills),
  ];

  return {
    title: clean(job.title),
    description: clean(job.description),
    requirementsText: clean(requirements.text || requirements.raw || aiCriteria.raw),
    city: clean(job.city || filters.city || requirements.city),
    state: clean(job.state || filters.state || requirements.state),
    neighborhood: clean(job.neighborhood || filters.neighborhood || requirements.neighborhood),
    region: clean(job.region || filters.region || requirements.region),
    education: clean(job.educationRequired || filters.educationRequired || requirements.educationRequired),
    experience: clean(job.experienceRequired || filters.experienceRequired || requirements.experienceRequired),
    workMode: clean(job.workMode || filters.workMode || requirements.workMode),
    contractType: clean(job.contractType || filters.contractType || requirements.contractType),
    ageMin,
    ageMax,
    skills: Array.from(new Set(skills.map((item) => clean(item)).filter(Boolean))),
  };
}

function containsAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(normalize(term)));
}

function localPreScore(job: any, candidate: any): MatchResult {
  const criteria = jobCriteria(job);
  const text = candidateText(candidate);
  const ai = candidate.aiExtractedData || {};
  const age = candidateAge(candidate);

  let score = 0;
  const strengths: string[] = [];
  const attentionPoints: string[] = [];
  const missingRequirements: string[] = [];

  const jobTitleWords = words(criteria.title);
  const jobRequirementWords = words(
    [criteria.title, criteria.description, criteria.requirementsText, criteria.experience]
      .filter(Boolean)
      .join(" ")
  );

  const candidateRole = normalize(
    candidate.lastRole || ai.cargoPrincipal || candidate.professionalSummary || ""
  );

  const candidateEducation = normalize(
    candidate.education || candidate.course || ai.formacao || ai.curso || ""
  );

  const candidateCity = normalize(candidate.city || ai.cidade || "");
  const candidateState = normalize(candidate.state || ai.estado || "");
  const candidateNeighborhood = normalize(candidate.neighborhood || ai.bairro || "");

  const titleHits = jobTitleWords.filter((word) => text.includes(word));
  if (titleHits.length > 0 || containsAny(candidateRole, jobTitleWords)) {
    const points = Math.min(30, 14 + titleHits.length * 5);
    score += points;
    strengths.push(`Cargo/experiência com sinais de compatibilidade: ${titleHits.join(", ") || criteria.title}.`);
  }

  const requiredSkills = criteria.skills;
  const skillHits = requiredSkills.filter((skill) => text.includes(normalize(skill)));

  if (requiredSkills.length > 0) {
    const ratio = skillHits.length / requiredSkills.length;
    const points = Math.round(ratio * 20);
    score += points;

    if (skillHits.length > 0) {
      strengths.push(`Habilidades encontradas: ${skillHits.join(", ")}.`);
    }
  } else {
    const keywordHits = jobRequirementWords
      .filter((word) => text.includes(word))
      .slice(0, 8);

    if (keywordHits.length > 0) {
      score += Math.min(18, keywordHits.length * 3);
      strengths.push(`Palavras-chave compatíveis: ${keywordHits.join(", ")}.`);
    }
  }

  if (criteria.city && candidateCity.includes(normalize(criteria.city))) {
    score += 12;
    strengths.push(`Mesma cidade da vaga: ${criteria.city}.`);
  }

  if (criteria.state && candidateState.includes(normalize(criteria.state))) {
    score += 5;
  }

  if (
    criteria.neighborhood &&
    candidateNeighborhood.includes(normalize(criteria.neighborhood))
  ) {
    score += 6;
    strengths.push(`Bairro compatível: ${criteria.neighborhood}.`);
  } else if (criteria.region && criteria.region !== "nenhuma") {
    const regionWords = words(criteria.region.replace(/_/g, " "));
    if (containsAny(text, regionWords)) {
      score += 5;
      strengths.push(`Região com indício de compatibilidade: ${criteria.region}.`);
    }
  }

  if (criteria.education) {
    const eduWords = words(criteria.education);
    const eduHits = eduWords.filter((word) => candidateEducation.includes(word) || text.includes(word));

    if (eduHits.length > 0) {
      score += 10;
      strengths.push(`Formação compatível: ${criteria.education}.`);
    }
  } else if (candidateEducation) {
    score += 4;
  }

  if (criteria.ageMin || criteria.ageMax) {
    if (age === null) {
      attentionPoints.push("Idade não encontrada para validar o requisito.");
    } else if (
      (!criteria.ageMin || age >= criteria.ageMin) &&
      (!criteria.ageMax || age <= criteria.ageMax)
    ) {
      score += 10;
      strengths.push(`Idade dentro do perfil: ${age} anos.`);
    } else {
      missingRequirements.push(`Idade fora do perfil desejado: ${age} anos.`);
    }
  } else if (age !== null) {
    score += 3;
  }

  if (candidate.aiSummary || candidate.professionalSummary || ai.score) {
    score += 5;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    candidate,
    score,
    strengths,
    attentionPoints,
    missingRequirements,
    reason:
      score >= 70
        ? "Pré-score local alto."
        : score >= 40
          ? "Pré-score local médio."
          : "Pré-score local baixo.",
    aiRawResult: {
      engine: "local-prefilter",
    },
  };
}

function compactJob(job: any) {
  const c = jobCriteria(job);

  return {
    id: job.id,
    title: c.title,
    description: c.description,
    requirementsText: c.requirementsText,
    city: c.city,
    state: c.state,
    neighborhood: c.neighborhood,
    region: c.region,
    education: c.education,
    experience: c.experience,
    skills: c.skills,
    ageMin: c.ageMin,
    ageMax: c.ageMax,
    workMode: c.workMode,
    contractType: c.contractType,
  };
}

function compactCandidate(candidate: any) {
  const ai = candidate.aiExtractedData || {};
  const experiences = candidate.experiences || {};
  const age = candidateAge(candidate);

  return {
    id: candidate.id,
    name: candidate.name,
    age,
    birthDate: candidate.birthDate,
    phone: candidate.phone,
    mobile: candidate.mobile,
    email: candidate.email,
    city: candidate.city || ai.cidade,
    state: candidate.state || ai.estado,
    neighborhood: candidate.neighborhood || ai.bairro,
    education: candidate.education || ai.formacao,
    course: candidate.course || ai.curso,
    lastRole: candidate.lastRole || ai.cargoPrincipal,
    skills: candidate.skills || ai.skills || [],
    languages: candidate.languages || ai.languages || [],
    aiSummary: candidate.aiSummary || ai.aiSummary,
    professionalSummary: candidate.professionalSummary || ai.professionalSummary,
    experience: clean(experiences.texto || ai.experienciaTexto).slice(0, 1200),
    training: clean(experiences.treinamentos).slice(0, 800),
    origin: candidate.resumeOrigin,
    currentStatus: candidate.status,
  };
}

function buildFallbackReason(local: MatchResult) {
  return [
    local.score >= 70
      ? "Boa aderência inicial pela análise local."
      : local.score >= 45
        ? "Aderência parcial pela análise local."
        : "Baixa aderência inicial pela análise local.",
    local.strengths.slice(0, 2).join(" "),
    local.missingRequirements.slice(0, 2).join(" "),
  ]
    .filter(Boolean)
    .join(" ");
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOpenAI(payload: any, apiKey: string) {
  let lastError = "";

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

    lastError = text;

    const retryable =
      response.status === 429 ||
      response.status === 500 ||
      response.status === 502 ||
      response.status === 503 ||
      response.status === 504;

    console.error(`OPENAI MATCH ERROR tentativa ${attempt}:`, text);

    if (!retryable || attempt === 3) {
      throw new Error(text);
    }

    await wait(900 * attempt);
  }

  throw new Error(lastError || "Erro desconhecido ao chamar OpenAI.");
}

function parseAiMatches(text: string) {
  const responseJson = safeJsonParse(text);

  const outputText =
    responseJson?.output_text ||
    responseJson?.output?.[0]?.content?.[0]?.text ||
    responseJson?.output?.[0]?.content?.[0]?.content ||
    text;

  const parsed = safeJsonParse(outputText);

  if (!parsed) return [];

  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.matches)) return parsed.matches;

  return [];
}

async function aiRankChunk(job: any, candidates: any[], apiKey: string) {
  const payload = {
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "Você é uma IA sênior de recrutamento. Responda somente JSON válido, sem markdown.",
      },
      {
        role: "user",
        content: `
Você vai comparar uma vaga contra candidatos.

OBJETIVO:
Rankear candidatos com inteligência semântica, não apenas por palavra igual.

REGRAS DE SCORE:
- 0 a 100.
- Experiência/cargo compatível pesa muito.
- Região/localidade pesa, mas não elimina sozinho.
- Idade só deve impactar se a vaga tiver idade mínima/máxima.
- Formação deve ser considerada conforme requisito da vaga.
- Explique o motivo de forma prática para recrutador.
- Não invente dados.
- Se faltar informação, coloque em attentionPoints ou missingRequirements.

RETORNE SOMENTE JSON neste formato:
{
  "matches": [
    {
      "candidateId": "id",
      "score": 0,
      "reason": "por que esse candidato recebeu esse score",
      "strengths": ["ponto forte"],
      "attentionPoints": ["ponto de atenção"],
      "missingRequirements": ["requisito ausente"]
    }
  ]
}

VAGA:
${JSON.stringify(compactJob(job), null, 2)}

CANDIDATOS:
${JSON.stringify(candidates.map(compactCandidate), null, 2)}
`,
      },
    ],
    temperature: 0.15,
    max_output_tokens: 2500,
  };

  const responseText = await callOpenAI(payload, apiKey);
  return parseAiMatches(responseText);
}

function mergeAiWithLocal(localItems: MatchResult[], aiItems: any[]) {
  const byCandidateId = new Map<string, any>();

  for (const item of aiItems) {
    const id = clean(item.candidateId || item.id);
    if (!id) continue;

    byCandidateId.set(id, item);
  }

  return localItems.map((local) => {
    const ai = byCandidateId.get(local.candidate.id);

    if (!ai) {
      return {
        ...local,
        reason: buildFallbackReason(local),
        aiRawResult: {
          engine: "local-fallback",
          localScore: local.score,
        },
      };
    }

    const score = Math.max(0, Math.min(100, Math.round(Number(ai.score) || local.score)));

    return {
      candidate: local.candidate,
      score,
      strengths: Array.isArray(ai.strengths) ? ai.strengths.map(String) : local.strengths,
      attentionPoints: Array.isArray(ai.attentionPoints)
        ? ai.attentionPoints.map(String)
        : local.attentionPoints,
      missingRequirements: Array.isArray(ai.missingRequirements)
        ? ai.missingRequirements.map(String)
        : local.missingRequirements,
      reason: clean(ai.reason) || buildFallbackReason(local),
      aiRawResult: {
        engine: "openai-rh-semantic-matcher-v1",
        ai,
        localScore: local.score,
        updatedAt: new Date().toISOString(),
      },
    };
  });
}

async function createOrUpdateJobMatches(job: any, ranked: MatchResult[]) {
  for (const item of ranked) {
    await prisma.jobMatch.upsert({
      where: {
        jobId_candidateId: {
          jobId: job.id,
          candidateId: item.candidate.id,
        },
      },
      update: {
        score: item.score,
        strengths: item.strengths,
        attentionPoints: item.attentionPoints,
        missingRequirements: item.missingRequirements,
        reason: item.reason,
        aiRawResult: item.aiRawResult || {
          engine: "unknown",
          updatedAt: new Date().toISOString(),
        },
        status: item.score >= 75 ? "suggested" : "rejected",
      },
      create: {
        jobId: job.id,
        candidateId: item.candidate.id,
        score: item.score,
        strengths: item.strengths,
        attentionPoints: item.attentionPoints,
        missingRequirements: item.missingRequirements,
        reason: item.reason,
        aiRawResult: item.aiRawResult || {
          engine: "unknown",
          createdAt: new Date().toISOString(),
        },
        status: item.score >= 75 ? "suggested" : "rejected",
      },
    });
  }
}

function responseCandidate(item: MatchResult) {
  const candidate = item.candidate;

  return {
    score: item.score,
    reason: item.reason,
    strengths: item.strengths,
    attentionPoints: item.attentionPoints,
    missingRequirements: item.missingRequirements,
    candidate: {
      id: candidate.id,
      name: candidate.name,
      cpf: candidate.cpf,
      phone: candidate.phone,
      mobile: candidate.mobile,
      email: candidate.email,
      city: candidate.city,
      state: candidate.state,
      neighborhood: candidate.neighborhood,
      birthDate: candidate.birthDate,
      age:
        candidate.aiExtractedData?.idade ||
        candidate.aiExtractedData?.age ||
        calculateAge(candidate.birthDate),
      education: candidate.education,
      course: candidate.course,
      lastRole: candidate.lastRole,
      status: candidate.status,
      aiSummary: candidate.aiSummary,
      professionalSummary: candidate.professionalSummary,
      experiences: candidate.experiences,
      skills: candidate.skills,
      languages: candidate.languages,
      resumeOrigin: candidate.resumeOrigin,
      aiExtractedData: candidate.aiExtractedData,
    },
  };
}


function parseCooldownDays(value: any) {
  const days = Number(value);
  if (!Number.isFinite(days)) return 14;
  return Math.max(1, Math.min(180, Math.round(days)));
}

async function recentlyBlockedCandidateIds(jobId: string, cooldownDays: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - cooldownDays);

  const matches = await prisma.jobMatch.findMany({
    where: {
      jobId,
      status: {
        in: BLOCKED_MATCH_STATUSES,
      },
      updatedAt: {
        gte: cutoff,
      },
    },
    select: {
      candidateId: true,
    },
  });

  return new Set(matches.map((item) => item.candidateId));
}

export async function POST(req: NextRequest) {
  try {
    const { companyId } = await requireCompany(req);
    const body = await req.json();

    const jobId = clean(body.jobId);
    const limit = Math.min(Number(body.limit || 50), 200);
    const useAi = body.useAi !== false;
    const excludeRecentlySelected = body.excludeRecentlySelected !== false;
    const cooldownDays = parseCooldownDays(body.cooldownDays);

    if (!jobId) {
      return NextResponse.json({ error: "jobId obrigatório." }, { status: 400 });
    }

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        company_id: companyId,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Vaga não encontrada." }, { status: 404 });
    }

    const blockedIds = excludeRecentlySelected
      ? await recentlyBlockedCandidateIds(job.id, cooldownDays)
      : new Set<string>();

    const rawCandidates = await prisma.candidateProfile.findMany({
      where: {
        company_id: companyId,
        active: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 1000,
    });

    const candidates = rawCandidates.filter((candidate) => !blockedIds.has(candidate.id));

    const localRanked = candidates
      .map((candidate) => localPreScore(job, candidate))
      .sort((a, b) => b.score - a.score);

    const preselected = localRanked.slice(0, Math.min(80, localRanked.length));

    let finalRanked: MatchResult[] = preselected.map((item) => ({
      ...item,
      reason: buildFallbackReason(item),
    }));

    let engine = "local-fallback";

    if (useAi && process.env.OPENAI_API_KEY && preselected.length > 0) {
      try {
        const chunks: MatchResult[][] = [];

        for (let i = 0; i < preselected.length; i += 8) {
          chunks.push(preselected.slice(i, i + 8));
        }

        const aiResults: any[] = [];

        for (const chunk of chunks) {
          const result = await aiRankChunk(
            job,
            chunk.map((item) => item.candidate),
            process.env.OPENAI_API_KEY
          );

          aiResults.push(...result);
        }

        finalRanked = mergeAiWithLocal(preselected, aiResults)
          .sort((a, b) => b.score - a.score);

        engine = "openai-rh-semantic-matcher-v1";
      } catch (error: any) {
        console.error("ERRO IA MATCH, usando fallback local:", error?.message || error);

        finalRanked = preselected
          .map((item) => ({
            ...item,
            reason: buildFallbackReason(item),
            aiRawResult: {
              engine: "local-fallback-after-ai-error",
              error: error?.message || String(error),
              localScore: item.score,
            },
          }))
          .sort((a, b) => b.score - a.score);

        engine = "local-fallback-after-ai-error";
      }
    }

    const ranked = finalRanked.slice(0, limit);

    await createOrUpdateJobMatches(job, ranked);

    return NextResponse.json({
      success: true,
      engine,
      job,
      totalCandidates: rawCandidates.length,
      availableCandidates: candidates.length,
      excludedRecentlySelected: blockedIds.size,
      cooldownDays,
      preselectedCandidates: preselected.length,
      matches: ranked.map(responseCandidate),
    });
  } catch (error: any) {
    console.error("POST /api/rh/jobs/match:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao gerar matching da vaga." },
      { status: 500 }
    );
  }
}


export async function PATCH(req: NextRequest) {
  try {
    const { companyId } = await requireCompany(req);
    const body = await req.json();

    const jobId = clean(body.jobId);
    const candidateIds = Array.isArray(body.candidateIds)
      ? body.candidateIds.map(clean).filter(Boolean)
      : [];

    const status = clean(body.status || "selected");
    const allowedStatuses = [
      "suggested",
      "selected",
      "rejected",
      "contacted",
      "interview",
      "hired",
    ];

    if (!jobId) {
      return NextResponse.json({ error: "jobId obrigatório." }, { status: 400 });
    }

    if (!candidateIds.length) {
      return NextResponse.json(
        { error: "Nenhum candidato selecionado." },
        { status: 400 }
      );
    }

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        company_id: companyId,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Vaga não encontrada." }, { status: 404 });
    }

    const candidates = await prisma.candidateProfile.findMany({
      where: {
        id: {
          in: candidateIds,
        },
        company_id: companyId,
        active: true,
      },
      select: {
        id: true,
      },
    });

    const validIds = candidates.map((candidate) => candidate.id);

    if (validIds.length !== candidateIds.length) {
      return NextResponse.json(
        {
          error:
            "Um ou mais candidatos não existem, estão inativos ou não pertencem à empresa atual.",
        },
        { status: 403 }
      );
    }

    for (const candidateId of validIds) {
      const existing = await prisma.jobMatch.findUnique({
        where: {
          jobId_candidateId: {
            jobId,
            candidateId,
          },
        },
      });

      await prisma.jobMatch.upsert({
        where: {
          jobId_candidateId: {
            jobId,
            candidateId,
          },
        },
        update: {
          status,
          reason:
            existing?.reason ||
            "Candidato marcado em massa pelo recrutador para esta vaga.",
          aiRawResult: {
            ...(existing?.aiRawResult && typeof existing.aiRawResult === "object"
              ? (existing.aiRawResult as any)
              : {}),
            recruiterAction: status,
            recruiterActionAt: new Date().toISOString(),
          },
        },
        create: {
          jobId,
          candidateId,
          score: 0,
          status,
          strengths: [],
          attentionPoints: [],
          missingRequirements: [],
          reason: "Candidato marcado em massa pelo recrutador para esta vaga.",
          aiRawResult: {
            engine: "manual-bulk-selection",
            recruiterAction: status,
            recruiterActionAt: new Date().toISOString(),
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      jobId,
      status,
      updated: validIds.length,
      candidateIds: validIds,
    });
  } catch (error: any) {
    console.error("PATCH /api/rh/jobs/match:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar candidatos da vaga." },
      { status: 500 }
    );
  }
}
