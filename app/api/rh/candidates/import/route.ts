import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireCompany } from "@/lib/server-company";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

const DATE_OF_BIRTH_KEYS = [
  "Data de nascimento",
  "Data de Nascimento",
  "Nascimento",
  "Data Nascimento",
  "Dt Nascimento",
  "Dt. Nascimento",
  "Data nasc.",
  "Data nasc",
];

const APPLICATION_DATE_KEYS = [
  "Data da candidatura",
  "Data de candidatura",
  "Data de Inscrição",
  "Data de Inscricao",
  "Data inscrição",
  "Data inscricao",
];

function clean(value: any) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeText(value: any) {
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

function normalizeCpf(value: any) {
  const digits = onlyDigits(value);
  if (!digits) return null;
  if (digits.length > 11) return digits.slice(-11);
  return digits.padStart(11, "0");
}

function normalizePhone(value: any) {
  const digits = onlyDigits(value);

  if (!digits) return null;

  if (digits.startsWith("55") && digits.length >= 12) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  if (digits.length > 11 && !digits.startsWith("55")) {
    return `55${digits}`;
  }

  return digits;
}

function parseDate(value: any) {
  if (!value) return null;

  if (value instanceof Date) {
    if (
      Number.isNaN(value.getTime()) ||
      value.getFullYear() < 1900 ||
      value.getFullYear() > 2100
    ) {
      return null;
    }

    return value;
  }

  if (typeof value === "number") {
    if (value < 20000 || value > 60000) return null;

    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const result = new Date(excelEpoch.getTime() + value * 86400000);

    if (
      Number.isNaN(result.getTime()) ||
      result.getFullYear() < 1900 ||
      result.getFullYear() > 2100
    ) {
      return null;
    }

    return result;
  }

  const text = clean(value);
  if (!text) return null;

  const numericText = Number(text);
  if (Number.isFinite(numericText) && numericText >= 20000 && numericText <= 60000) {
    return parseDate(numericText);
  }

  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const [, day, month, year] = br;
    const result = new Date(Number(year), Number(month) - 1, Number(day));

    if (
      Number.isNaN(result.getTime()) ||
      result.getFullYear() < 1900 ||
      result.getFullYear() > 2100
    ) {
      return null;
    }

    return result;
  }

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, year, month, day] = iso;
    const result = new Date(Number(year), Number(month) - 1, Number(day));

    if (
      Number.isNaN(result.getTime()) ||
      result.getFullYear() < 1900 ||
      result.getFullYear() > 2100
    ) {
      return null;
    }

    return result;
  }

  const date = new Date(text);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() < 1900 ||
    date.getFullYear() > 2100
  ) {
    return null;
  }

  return date;
}

function calculateAge(date: Date | null) {
  if (!date) return null;

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

function formatDateBR(date: Date | null) {
  if (!date) return null;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

function parseMoney(value: any) {
  const text = clean(value);
  if (!text) return null;

  const number = Number(
    text
      .replace(/[^\d,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
  );

  return Number.isFinite(number) ? number : null;
}

function splitName(fullName: string) {
  const parts = clean(fullName).split(" ").filter(Boolean);

  return {
    firstName: parts[0] || null,
    lastName: parts.slice(1).join(" ") || null,
  };
}

function splitCityState(value: any, stateValue?: any) {
  const rawCity = clean(value);
  const rawState = clean(stateValue);

  if (!rawCity) {
    return {
      city: null,
      state: rawState || null,
    };
  }

  const match = rawCity.match(/^(.+?)\s*-\s*([A-Z]{2})$/i);

  if (match) {
    return {
      city: clean(match[1]),
      state: rawState || clean(match[2]).toUpperCase(),
    };
  }

  return {
    city: rawCity,
    state: rawState || null,
  };
}

function findHeaderIndex(matrix: any[][]) {
  return matrix.findIndex((row) => {
    const normalized = row.map((cell) => normalizeText(cell));

    const hasName = normalized.some((h) => h === "nome");
    const hasContact = normalized.some(
      (h) =>
        h === "email" ||
        h === "e mail" ||
        h.includes("telefone") ||
        h.includes("celular")
    );

    return hasName && hasContact;
  });
}

function buildRows(matrix: any[][], headerIndex: number) {
  const headers = matrix[headerIndex].map((h) => clean(h));
  const dataRows = matrix.slice(headerIndex + 1);

  return dataRows.map((line) => {
    const row: Record<string, any> = {};

    headers.forEach((header, index) => {
      if (header) row[header] = line[index];
    });

    return row;
  });
}

function get(row: Record<string, any>, keys: string[]) {
  const rowKeys = Object.keys(row);

  for (const key of keys) {
    const wanted = normalizeText(key);

    const found = rowKeys.find((k) => normalizeText(k) === wanted);

    if (found && clean(row[found])) {
      return clean(row[found]);
    }
  }

  return null;
}

function getRaw(row: Record<string, any>, keys: string[]) {
  const rowKeys = Object.keys(row);

  for (const key of keys) {
    const wanted = normalizeText(key);

    const found = rowKeys.find((k) => normalizeText(k) === wanted);

    if (found && row[found] !== undefined && row[found] !== null && clean(row[found])) {
      return row[found];
    }
  }

  return null;
}

function detectImportType(matrix: any[][], headerIndex: number) {
  const firstRowsText = matrix
    .slice(0, 8)
    .flat()
    .map(normalizeText)
    .join(" ");

  if (
    headerIndex >= 4 ||
    firstRowsText.includes("nome da vaga") ||
    firstRowsText.includes("referencia da vaga") ||
    firstRowsText.includes("nome da etapa")
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
    const joined = row.map(clean).join(" ").trim();
    const normalized = normalizeText(joined);

    if (normalized.includes("nome da vaga")) {
      title = joined.replace(/nome da vaga:?/i, "").trim();
    }

    if (normalized.includes("referencia da vaga")) {
      reference = joined
        .replace(/referência da vaga:?/i, "")
        .replace(/referencia da vaga:?/i, "")
        .trim();
    }

    if (normalized.includes("nome da etapa")) {
      stage = joined.replace(/nome da etapa:?/i, "").trim();
    }
  }

  return {
    title: title || "Vaga importada",
    reference: reference || null,
    stage: stage || "triagem",
  };
}

function extractCandidate(row: Record<string, any>, type: string) {
  const nome = get(row, ["Nome", "Nome completo", "Candidato"]);
  const sobrenome = get(row, ["Sobrenome"]);
  const fullName = [nome, sobrenome].filter(Boolean).join(" ").trim();

  const mobileRaw = get(row, ["Celular", "Telefone celular", "WhatsApp"]);
  const phoneRaw = get(row, [
    "Telefone",
    "Telefone 1",
    "Telefone principal",
    "Telefone fixo",
  ]);

  const normalizedMobile = normalizePhone(mobileRaw);
  const normalizedPhone = normalizePhone(phoneRaw);

  const birthDateRaw = getRaw(row, DATE_OF_BIRTH_KEYS);
  const birthDate = parseDate(birthDateRaw);
  const age = calculateAge(birthDate);

  const experience =
    get(row, [
      "Experiência profissional",
      "Experiencias profissionais",
      "Experiência",
      "Experiencia",
      "Histórico profissional",
      "Historico profissional",
      "Resumo profissional",
      "TEDs do currículo do candidato",
      "TEDS do currículo do candidato",
    ]) || "";

  const education =
    get(row, [
      "Formação",
      "Formacao",
      "Escolaridade",
      "Formação acadêmica",
      "Formacao academica",
      "Grau de instrução",
      "Nivel de escolaridade",
      "Nível de escolaridade",
      "Treinamento",
      "Treinamentos",
    ]) || null;

  const course =
    get(row, ["Curso", "Cursos", "Treinamento", "Treinamentos"]) || null;

  const languages = get(row, ["Idiomas"]) || "";

  const lastRole =
    get(row, [
      "Título",
      "Titulo",
      "Cargo pretendido",
      "Cargo atual",
      "Cargo",
      "Último cargo",
      "Ultimo cargo",
      "Profissão",
      "Profissao",
    ]) || null;

  const source =
    get(row, ["Origem da candidatura", "Origem", "Fonte", "Inscrito desde"]) ||
    (type === "INFOJOBS_POR_VAGA" ? "InfoJobs - Por vaga" : "InfoJobs - Geral");

  const location = splitCityState(get(row, ["Cidade"]), get(row, ["Estado", "UF"]));

  const neighborhood = get(row, ["Bairro"]);
  const salaryMin = parseMoney(get(row, ["Salário mínimo", "Salario minimo"]));
  const salaryMax = parseMoney(get(row, ["Salário máximo", "Salario maximo"]));
  const salaryExpectation = salaryMax || salaryMin || null;

  const status =
    type === "INFOJOBS_POR_VAGA" ? "triagem" : "banco_de_talentos";

  const finalEducation = education || null;
  const finalCourse = course || education || null;
  const finalRole = lastRole || null;

  const applicationDate = parseDate(getRaw(row, APPLICATION_DATE_KEYS));

  const aiExtractedData = {
    status,
    sourceType: type,
    cargoPrincipal: finalRole,
    cidade: location.city,
    estado: location.state,
    bairro: neighborhood,
    formacao: finalEducation,
    curso: finalCourse,
    idiomasTexto: languages,
    experienciaTexto: experience,
    origem: source,
    telefone: normalizedPhone,
    celular: normalizedMobile,
    nascimento: formatDateBR(birthDate),
    birthDate: birthDate ? birthDate.toISOString() : null,
    idade: age,
    age,
    salarioMinimo: salaryMin,
    salarioMaximo: salaryMax,
    dataCandidatura: applicationDate ? applicationDate.toISOString() : null,
  };

  const aiSummary = [
    fullName ? `Candidato: ${fullName}.` : "",
    age !== null ? `Idade: ${age} anos.` : "",
    birthDate ? `Nascimento: ${formatDateBR(birthDate)}.` : "",
    location.city
      ? `Cidade: ${location.city}${location.state ? `/${location.state}` : ""}.`
      : "",
    neighborhood ? `Bairro: ${neighborhood}.` : "",
    finalEducation ? `Formação: ${finalEducation}.` : "",
    finalRole ? `Último cargo/título: ${finalRole}.` : "",
    experience ? "Experiência informada disponível no currículo." : "",
  ]
    .filter(Boolean)
    .join(" ");

  const nameParts = splitName(fullName || nome || "");

  return {
    name: fullName || nome || "Sem nome",
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,

    cpf: normalizeCpf(
      get(row, ["CPF", "Número de identificação", "Numero de identificacao"])
    ),
    birthDate,
    gender: get(row, ["Sexo", "Gênero", "Genero"]),

    phone: normalizedPhone,
    mobile: normalizedMobile || normalizedPhone,
    email: get(row, ["E-mail", "Email"]),

    city: location.city,
    state: location.state,
    neighborhood,
    zipCode: get(row, ["CEP"]),
    address: get(row, ["Endereço", "Endereco"]),

    education: finalEducation,
    course: finalCourse,
    courseStatus: get(row, ["Status do curso", "Situação do curso"]),
    institution: get(row, ["Instituição", "Instituicao"]),
    lastRole: finalRole,

    experiences: {
      texto: experience,
      treinamentos: get(row, ["Treinamento", "Treinamentos"]),
      historico: get(row, [
        "Histórico de candidatura",
        "Histórico de candidatura na empresa",
        "Histórico de aplicação na empresa",
        "Historico de aplicacao na empresa",
      ]),
    },

    professionalSummary: experience ? experience.slice(0, 1500) : null,

    languages: languages
      ? languages
          .split(/[,;|]/)
          .map((i) => i.trim())
          .filter(Boolean)
      : [],

    salaryExpectation,

    resumeOrigin: source,
    rawImportData: row,
    aiExtractedData,
    aiSummary,
    status,
    active: true,
  };
}

async function findExistingCandidate(companyId: string, data: any) {
  if (data.cpf) {
    const found = await prisma.candidateProfile.findFirst({
      where: {
        company_id: companyId,
        cpf: data.cpf,
      },
    });

    if (found) return found;
  }

  if (data.email) {
    const found = await prisma.candidateProfile.findFirst({
      where: {
        company_id: companyId,
        email: {
          equals: data.email,
          mode: "insensitive",
        },
      },
    });

    if (found) return found;
  }

  if (data.mobile && data.name) {
    const found = await prisma.candidateProfile.findFirst({
      where: {
        company_id: companyId,
        mobile: data.mobile,
        name: {
          equals: data.name,
          mode: "insensitive",
        },
      },
    });

    if (found) return found;
  }

  if (data.phone && data.name) {
    const found = await prisma.candidateProfile.findFirst({
      where: {
        company_id: companyId,
        phone: data.phone,
        name: {
          equals: data.name,
          mode: "insensitive",
        },
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
    return {
      candidate: await prisma.candidateProfile.update({
        where: { id: existing.id },
        data: payload,
      }),
      updated: true,
    };
  }

  return {
    candidate: await prisma.candidateProfile.create({
      data: payload,
    }),
    updated: false,
  };
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
    let applicationsCreated = 0;
    const errors: string[] = [];

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];

      try {
        const candidateData = extractCandidate(row, type);

        if (
          !candidateData.name &&
          !candidateData.email &&
          !candidateData.phone &&
          !candidateData.mobile &&
          !candidateData.cpf
        ) {
          ignored++;
          continue;
        }

        const result = await upsertCandidate(
          companyId,
          branchId || null,
          candidateData
        );

        if (result.updated) updated++;
        else created++;

        if (type === "INFOJOBS_POR_VAGA" && job?.id) {
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
                applicationDate:
                  parseDate(getRaw(row, APPLICATION_DATE_KEYS)) || new Date(),
                stage: "triagem",
                status: "active",
                history: {
                  importType: type,
                  jobInfo,
                  raw: row,
                  birthDate: candidateData.birthDate
                    ? candidateData.birthDate.toISOString()
                    : null,
                  idade: candidateData.aiExtractedData?.idade || null,
                },
              },
            });

            applicationsCreated++;
          }
        }
      } catch (error: any) {
        errors.push(
          `Linha ${headerIndex + index + 2}: ${error?.message || "erro"}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      type,
      job,
      totalRows: rows.length,
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
