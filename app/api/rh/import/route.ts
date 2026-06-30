import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireCompany } from "@/lib/server-company";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

function clean(value: any) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function norm(value: any) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function onlyDigits(value: any) {
  return clean(value).replace(/\D/g, "");
}

function normalizePhone(value: any) {
  const digits = onlyDigits(value);
  if (!digits) return null;

  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length > 11 && !digits.startsWith("55")) return `55${digits}`;

  return digits;
}

function normalizeCpf(value: any) {
  const digits = onlyDigits(value);
  if (!digits) return null;
  return digits.padStart(11, "0").slice(-11);
}

function parseDate(value: any) {
  if (!value) return null;

  if (typeof value === "number") {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!Number.isNaN(date.getTime())) return date;
  }

  const text = clean(value);
  if (!text) return null;

  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) {
    const [, day, month, year] = br;
    const date = new Date(`${year}-${month}-${day}T00:00:00`);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return date;

  return null;
}

function parseMoney(value: any) {
  const text = clean(value);
  if (!text) return null;

  const numeric = text
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const number = Number(numeric);
  return Number.isFinite(number) ? number : null;
}

function splitName(fullName: string) {
  const parts = clean(fullName).split(" ").filter(Boolean);
  return {
    firstName: parts[0] || null,
    lastName: parts.slice(1).join(" ") || null,
  };
}

function get(row: Record<string, any>, keys: string[]) {
  const rowKeys = Object.keys(row);

  for (const key of keys) {
    const wanted = norm(key);
    const found = rowKeys.find((currentKey) => norm(currentKey) === wanted);

    if (found && clean(row[found])) return clean(row[found]);
  }

  return null;
}

function getLoose(row: Record<string, any>, keys: string[]) {
  const rowKeys = Object.keys(row);

  for (const key of keys) {
    const wanted = norm(key);

    const found = rowKeys.find((currentKey) => {
      const current = norm(currentKey);
      return current === wanted || current.includes(wanted);
    });

    if (found && clean(row[found])) return clean(row[found]);
  }

  return null;
}

function findHeaderIndex(matrix: any[][]) {
  return matrix.findIndex((row) => {
    const cols = row.map(norm);

    const hasName = cols.some(
      (col) => col === "nome" || col.includes("nome")
    );

    const hasContact = cols.some(
      (col) =>
        col.includes("email") ||
        col.includes("e mail") ||
        col.includes("telefone") ||
        col.includes("celular")
    );

    return hasName && hasContact;
  });
}

function buildRows(matrix: any[][], headerIndex: number) {
  const headers = matrix[headerIndex].map((header) => clean(header));
  const dataRows = matrix.slice(headerIndex + 1);

  return dataRows.map((line) => {
    const row: Record<string, any> = {};

    headers.forEach((header, index) => {
      if (header) row[header] = line[index];
    });

    return row;
  });
}

function detectImportType(matrix: any[][], headerIndex: number) {
  const firstRowsText = matrix
    .slice(0, 8)
    .flat()
    .map(norm)
    .join(" ");

  if (
    firstRowsText.includes("nome da vaga") ||
    firstRowsText.includes("referencia da vaga") ||
    firstRowsText.includes("nome da etapa") ||
    headerIndex >= 4
  ) {
    return "INFOJOBS_POR_VAGA";
  }

  return "INFOJOBS_GERAL";
}

function extractJobInfo(matrix: any[][]) {
  let title = "";
  let reference = "";
  let stage = "";

  for (const row of matrix.slice(0, 6)) {
    const label = norm(row?.[0]);
    const value = clean(row?.[1]);

    if (label.includes("nome da vaga")) title = value;
    if (label.includes("referencia da vaga")) reference = value;
    if (label.includes("nome da etapa")) stage = value;
  }

  return {
    title: title || "Vaga importada",
    reference: reference || null,
    stage: stage || "Inscritos",
  };
}

function splitCityState(value: string | null) {
  const text = clean(value);
  if (!text) return { city: null, state: null };

  const match = text.match(/^(.+?)\s*-\s*([A-Z]{2})$/i);
  if (match) {
    return {
      city: clean(match[1]),
      state: clean(match[2]).toUpperCase(),
    };
  }

  return {
    city: text,
    state: null,
  };
}

function shortEducation(value: string | null) {
  if (!value) return null;

  const text = clean(value);

  if (/p[oó]s|mba|especializa/i.test(text)) return "Pós-graduação";
  if (/superior|gradua|faculdade|universidade/i.test(text)) {
    return "Ensino Superior";
  }
  if (/t[eé]cnico/i.test(text)) return "Curso Técnico";
  if (/m[eé]dio|2º grau|2 grau/i.test(text)) return "Ensino Médio";
  if (/fundamental/i.test(text)) return "Ensino Fundamental";

  return text.slice(0, 120);
}

function extractMainRole(title: string | null, experience: string) {
  if (title) return title;

  const text = clean(experience);
  if (!text) return null;

  const firstPart = text.split("---------")[0] || text.split("|")[0] || text;
  const possible = firstPart.split(",")[0];

  return clean(possible).slice(0, 80) || null;
}

function hasUsefulData(row: Record<string, any>) {
  return Object.values(row).some((value) => clean(value));
}

function extractCandidate(row: Record<string, any>, type: string) {
  if (!hasUsefulData(row)) return null;

  const nome = get(row, ["Nome", "Nome completo", "Nome do candidato"]);
  const sobrenome = get(row, ["Sobrenome"]);

  const fullName = [nome, sobrenome]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const email = get(row, ["E-mail", "Email", "Correio eletrônico"]);

  const phone = normalizePhone(
    get(row, ["Telefone", "Telefone 1", "Telefone principal"])
  );

  const mobile = normalizePhone(
    get(row, ["Celular", "Telefone celular", "Whatsapp", "WhatsApp"])
  );

  const cpf = normalizeCpf(
    get(row, ["CPF", "Número de identificação", "Numero de identificacao"])
  );

  if (!fullName && !email && !phone && !mobile && !cpf) return null;

  const rawCity = get(row, ["Cidade", "Cidade atual", "Município", "Municipio"]);
  const cityState = splitCityState(rawCity);

  const state =
    get(row, ["Estado", "UF"]) || cityState.state || null;

  const city = cityState.city;

  const experience =
    get(row, [
      "Experiência profissional",
      "Experiencias profissionais",
      "Experiência",
      "Experiencia",
      "Histórico profissional",
      "Historico profissional",
      "Resumo profissional",
      "Currículo",
      "Curriculo",
    ]) || "";

  const educationRaw =
    get(row, [
      "Formação",
      "Formacao",
      "Escolaridade",
      "Formação acadêmica",
      "Formacao academica",
      "Treinamento",
      "Treinamentos",
    ]) || null;

  const education = shortEducation(educationRaw);

  const languagesText = get(row, ["Idiomas"]) || "";

  const title =
    get(row, [
      "Título",
      "Titulo",
      "Último cargo",
      "Ultimo cargo",
      "Cargo atual",
      "Cargo",
    ]) || null;

  const lastRole = extractMainRole(title, experience);

  const source =
    get(row, ["Origem da candidatura", "Origem", "Fonte", "Inscrito desde"]) ||
    (type === "INFOJOBS_POR_VAGA" ? "InfoJobs - Por vaga" : "InfoJobs - Geral");

  const applicationDate =
    parseDate(
      get(row, [
        "Data da candidatura",
        "Data de candidatura",
        "Data de Inscrição",
        "Data de Inscricao",
      ])
    ) || null;

  const birthDate = parseDate(
    get(row, ["Data de nascimento", "Data de Nascimento", "Nascimento"])
  );

  const salaryMin = parseMoney(get(row, ["Salário mínimo", "Salario minimo"]));
  const salaryMax = parseMoney(get(row, ["Salário máximo", "Salario maximo"]));

  const salaryExpectation = salaryMax || salaryMin || null;

  const neighborhood = get(row, ["Bairro"]);
  const zipCode = get(row, ["CEP"]);
  const address = get(row, ["Endereço", "Endereco"]);
  const addressNumber = get(row, ["Número", "Numero"]);
  const complement = get(row, ["Complemento"]);
  const gender = get(row, ["Sexo", "Gênero", "Genero"]);
  const maritalStatus = get(row, ["Estado Civil"]);
  const nationality = get(row, ["Nacionalidade"]);
  const ageText = get(row, ["Idade"]);
  const tags = getLoose(row, ["TAGs do CV", "TAG s do CV", "TAG"]);

  const candidateStatus =
    type === "INFOJOBS_POR_VAGA" ? "triagem" : "banco_de_talentos";

  const nameParts = splitName(fullName);

  const languages = languagesText
    ? languagesText
        .split(/[,;|]/)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  const aiExtractedData = {
    status: candidateStatus,
    sourceType: type,
    applicationDate: applicationDate?.toISOString() || null,
    cargoPrincipal: lastRole,
    cidade: city,
    estado: state,
    bairro: neighborhood,
    formacao: education,
    formacaoOriginal: educationRaw,
    idiomasTexto: languagesText,
    experienciaTexto: experience,
    origem: source,
    telefone: phone,
    celular: mobile,
    salarioMinimo: salaryMin,
    salarioMaximo: salaryMax,
    idadeTexto: ageText,
    estadoCivil: maritalStatus,
    nacionalidade: nationality,
    complemento: complement,
    numero: addressNumber,
    tags,
  };

  const aiSummary = [
    fullName ? `Candidato: ${fullName}.` : "",
    city ? `Cidade: ${city}${state ? `/${state}` : ""}.` : "",
    neighborhood ? `Bairro: ${neighborhood}.` : "",
    education ? `Formação: ${education}.` : "",
    lastRole ? `Último cargo/título: ${lastRole}.` : "",
    experience ? "Possui experiência profissional informada no currículo." : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    name: fullName || email || mobile || phone || "Candidato sem nome",
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,

    cpf,
    birthDate,
    gender,

    phone,
    mobile,
    email,

    city,
    state,
    neighborhood,
    zipCode,
    address,

    education,
    course: get(row, ["Curso"]),
    courseStatus: get(row, ["Status do curso", "Situação do curso"]),
    institution: get(row, ["Instituição", "Instituicao"]),

    lastRole,
    experiences: {
      texto: experience,
      formacaoOriginal: educationRaw,
      treinamento: get(row, ["Treinamento", "Treinamentos"]),
      historico:
        get(row, [
          "Histórico de candidatura",
          "Histórico de candidatura na empresa",
          "Histórico de aplicação na empresa",
          "Historico de aplicacao na empresa",
        ]) || null,
    },

    professionalSummary: experience ? experience.slice(0, 1500) : null,

    languages,
    salaryExpectation,

    resumeOrigin: source,
    rawImportData: row,
    aiExtractedData,
    aiSummary,
    status: candidateStatus,
    active: true,
  };
}

async function findExistingCandidate(companyId: string, data: any) {
  if (data.cpf) {
    const found = await prisma.candidateProfile.findFirst({
      where: { company_id: companyId, cpf: data.cpf },
    });
    if (found) return found;
  }

  if (data.email) {
    const found = await prisma.candidateProfile.findFirst({
      where: {
        company_id: companyId,
        email: { equals: data.email, mode: "insensitive" },
      },
    });
    if (found) return found;
  }

  if (data.mobile && data.name) {
    const found = await prisma.candidateProfile.findFirst({
      where: {
        company_id: companyId,
        mobile: data.mobile,
        name: { equals: data.name, mode: "insensitive" },
      },
    });
    if (found) return found;
  }

  if (data.phone && data.name) {
    const found = await prisma.candidateProfile.findFirst({
      where: {
        company_id: companyId,
        phone: data.phone,
        name: { equals: data.name, mode: "insensitive" },
      },
    });
    if (found) return found;
  }

  return null;
}

async function upsertCandidate(
  companyId: string,
  branchId: string | null,
  data: any
) {
  const existing = await findExistingCandidate(companyId, data);

  const payload = {
    company_id: companyId,
    branch_id: branchId,
    ...data,
  };

  if (existing) {
    const candidate = await prisma.candidateProfile.update({
      where: { id: existing.id },
      data: payload,
    });

    return { candidate, updated: true };
  }

  const candidate = await prisma.candidateProfile.create({
    data: payload,
  });

  return { candidate, updated: false };
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, branchId } = await await requireCompany(req);
    const body = await req.json();

    const matrix = Array.isArray(body.rows) ? body.rows : [];

    if (!matrix.length) {
      return NextResponse.json(
        { error: "Nenhuma linha recebida da planilha." },
        { status: 400 }
      );
    }

    const headerIndex = findHeaderIndex(matrix);

    if (headerIndex === -1) {
      return NextResponse.json(
        { error: "Não encontrei o cabeçalho da planilha." },
        { status: 400 }
      );
    }

    const type = detectImportType(matrix, headerIndex);
    const rows = buildRows(matrix, headerIndex);

    let job: any = null;
    let jobInfo: any = null;

    if (type === "INFOJOBS_POR_VAGA") {
      jobInfo = extractJobInfo(matrix);

      const existingJob = await prisma.job.findFirst({
        where: {
          company_id: companyId,
          title: {
            equals: jobInfo.title,
            mode: "insensitive",
          },
        },
      });

      job =
        existingJob ||
        (await prisma.job.create({
          data: {
            company_id: companyId,
            branch_id: branchId || null,
            title: jobInfo.title,
            description: jobInfo.reference
              ? `Importada do InfoJobs. Referência: ${jobInfo.reference}`
              : "Importada do InfoJobs.",
            status: "open",
            requirements: {
              source: "infojobs",
              reference: jobInfo.reference,
              stage: jobInfo.stage,
            },
          },
        }));
    }

    let created = 0;
    let updated = 0;
    let ignored = 0;
    let processed = 0;
    let applicationsCreated = 0;

    const errors: string[] = [];

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];

      try {
        const candidateData = extractCandidate(row, type);

        if (!candidateData) {
          ignored++;
          continue;
        }

        processed++;

        const result = await upsertCandidate(
          companyId,
          branchId || null,
          candidateData
        );

        if (result.updated) updated++;
        else created++;

        if (type === "INFOJOBS_POR_VAGA" && job?.id) {
          const applicationDate =
            parseDate(
              get(row, [
                "Data de Inscrição",
                "Data de Inscricao",
                "Data da candidatura",
              ])
            ) || new Date();

          const existingApplication = await prisma.jobApplication.findFirst({
            where: {
              jobId: job.id,
              candidateId: result.candidate.id,
            },
          });

          if (!existingApplication) {
            await prisma.jobApplication.create({
              data: {
                company_id: companyId,
                branch_id: branchId || null,
                jobId: job.id,
                candidateId: result.candidate.id,
                source: candidateData.resumeOrigin,
                applicationDate,
                stage: "triagem",
                status: "active",
                history: {
                  importType: type,
                  jobInfo,
                  raw: row,
                },
              },
            });

            applicationsCreated++;
          }
        }
      } catch (error: any) {
        console.error("ERRO LINHA IMPORTAÇÃO:", {
          line: headerIndex + index + 2,
          error: error?.message,
          row,
        });

        errors.push(
          `Linha ${headerIndex + index + 2}: ${
            error?.message || "erro desconhecido"
          }`
        );
      }
    }

    return NextResponse.json({
      success: true,
      type,
      job,
      headerIndex,
      totalRows: rows.length,
      processed,
      created,
      updated,
      ignored,
      applicationsCreated,
      errors,
    });
  } catch (error: any) {
    console.error("ERRO IMPORT CANDIDATES:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao importar candidatos." },
      { status: 500 }
    );
  }
}