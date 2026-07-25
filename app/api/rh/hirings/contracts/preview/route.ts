import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  hiringId: z.string().min(1),
});

const DEFAULT_INTERNSHIP_TEMPLATE = `CONTRATO DE ESTÁGIO

EMPRESA CONTRATANTE

Razão Social: {{company_name}}
CNPJ: {{company_cnpj}}
Endereço: {{company_address}}
Representante Legal: {{company_representative}}
Telefone: {{company_phone}}
E-mail: {{company_email}}

ESTAGIÁRIO

Nome: {{candidate_name}}
CPF: {{candidate_cpf}}
RG: {{candidate_rg}}
Órgão Emissor: {{candidate_rg_issuer}}
Nascimento: {{candidate_birth}}
Nacionalidade: {{candidate_nationality}}
Naturalidade: {{candidate_birth_city}}
Estado Civil: {{candidate_marital_status}}
Endereço: {{candidate_address}}
CEP: {{candidate_zip}}
Telefone: {{candidate_phone}}
E-mail: {{candidate_email}}
Nome da Mãe: {{mother_name}}
Nome do Pai: {{father_name}}

RESPONSÁVEL LEGAL

Nome: {{guardian_name}}
CPF: {{guardian_cpf}}
RG: {{guardian_rg}}
Parentesco: {{guardian_relationship}}

INSTITUIÇÃO DE ENSINO

Nome: {{institution_name}}
CNPJ: {{institution_cnpj}}
Curso: {{course_name}}
Semestre: {{semester}}
Matrícula: {{enrollment_number}}
Tipo de Ensino: {{education_level}}

DADOS DO ESTÁGIO

Cargo: {{job_title}}
Departamento: {{department}}
Supervisor: {{supervisor_name}}
Bolsa Auxílio: R$ {{salary}}
Auxílio Transporte: {{transport}}
Carga Horária: {{workload}}
Horário: {{schedule}}
Início: {{start_date}}
Fim: {{end_date}}

CLÁUSULA PRIMEIRA

O presente contrato regula a realização de estágio entre as partes acima identificadas.

CLÁUSULA SEGUNDA

O estágio terá início em {{start_date}} e término previsto em {{end_date}}.

CLÁUSULA TERCEIRA

A bolsa auxílio será de R$ {{salary}}.

CLÁUSULA QUARTA

A jornada será de {{workload}}.

CLÁUSULA QUINTA

O estagiário desenvolverá as atividades relacionadas ao cargo de {{job_title}}.

CLÁUSULA SEXTA

O presente contrato poderá ser rescindido conforme a legislação vigente.

ASSINATURAS

EMPRESA

_____________________________________
{{company_representative}}

ESTAGIÁRIO

_____________________________________
{{candidate_name}}

RESPONSÁVEL LEGAL

_____________________________________
{{guardian_name}}

INSTITUIÇÃO DE ENSINO

_____________________________________
{{institution_name}}

Data da emissão: {{generated_date}}`;

const DEFAULT_CLT_TEMPLATE = `FICHA DE ADMISSÃO — CLT

EMPRESA

Razão Social: {{company_name}}
CNPJ: {{company_cnpj}}
Endereço: {{company_address}}
Representante: {{company_representative}}

COLABORADOR

Nome: {{candidate_name}}
CPF: {{candidate_cpf}}
RG: {{candidate_rg}}
Órgão Emissor: {{candidate_rg_issuer}}
Data de Nascimento: {{candidate_birth}}
Nacionalidade: {{candidate_nationality}}
Naturalidade: {{candidate_birth_city}}
Estado Civil: {{candidate_marital_status}}
Nome da Mãe: {{mother_name}}
Nome do Pai: {{father_name}}
Endereço: {{candidate_address}}
Telefone: {{candidate_phone}}
E-mail: {{candidate_email}}

DADOS DA CONTRATAÇÃO

Cargo: {{job_title}}
Departamento: {{department}}
Salário: R$ {{salary}}
Jornada: {{workload}}
Horário: {{schedule}}
Data de Início: {{start_date}}

DADOS BANCÁRIOS

Banco: {{bank_name}}
Agência: {{bank_branch}}
Conta: {{bank_account}}
Tipo de Conta: {{bank_account_type}}

DECLARAÇÃO

Declaro que os dados acima foram conferidos e correspondem às informações fornecidas para o processo de admissão.

_____________________________________
{{candidate_name}}

_____________________________________
{{company_representative}}

Data da emissão: {{generated_date}}`;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) throw new Error("Supabase não configurado.");
  return createClient(url, key);
}

function value(...values: any[]) {
  return values.find(
    (item) =>
      item !== null &&
      item !== undefined &&
      String(item).trim() !== ""
  ) ?? "";
}

function formatDate(valueToFormat: any) {
  if (!valueToFormat) return "";
  const parsed = new Date(valueToFormat);
  if (Number.isNaN(parsed.getTime())) return String(valueToFormat);
  return parsed.toLocaleDateString("pt-BR");
}

function renderTemplate(template: string, variables: Record<string, any>) {
  const missing = new Set<string>();

  const rendered = template.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_, key) => {
      const resolved = variables[key];

      if (
        resolved === null ||
        resolved === undefined ||
        String(resolved).trim() === ""
      ) {
        missing.add(key);
        return `[PREENCHER: ${key}]`;
      }

      return String(resolved);
    }
  );

  return {
    rendered,
    missingVariables: Array.from(missing),
  };
}

export async function POST(req: NextRequest) {
  try {
    const { companyId } = await requireCompany(req);
    const body = bodySchema.parse(await req.json());
    const supabase = supabaseAdmin();

    const { data: hiring, error: hiringError } = await supabase
      .from("rh_hirings")
      .select("*")
      .eq("company_id", companyId)
      .eq("id", body.hiringId)
      .maybeSingle();

    if (hiringError) throw hiringError;
    if (!hiring) {
      return NextResponse.json(
        { error: "Contratação não encontrada." },
        { status: 404 }
      );
    }

    const { data: contractDataRow, error: contractError } = await supabase
      .from("rh_hiring_contract_data")
      .select("data")
      .eq("company_id", companyId)
      .eq("hiring_id", body.hiringId)
      .maybeSingle();

    if (contractError) throw contractError;

    const contractData = contractDataRow?.data || {};
    const hiringType = String(
      value(
        contractData.hiring_type,
        hiring.contract_type,
        hiring.contractType
      )
    );

    const isInternship =
      hiringType.toLowerCase().includes("estágio") ||
      hiringType.toLowerCase().includes("estagio");

    const subtype = value(contractData.internship_subtype, "");

    let templateQuery = supabase
      .from("rh_contract_templates")
      .select("*")
      .eq("company_id", companyId)
      .eq("active", true)
      .eq("contract_type", isInternship ? "internship" : "clt");

    if (isInternship && subtype) {
      templateQuery = templateQuery.eq("subtype", subtype);
    }

    const { data: savedTemplate } = await templateQuery
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const templateText =
      savedTemplate?.template_text ||
      (isInternship
        ? DEFAULT_INTERNSHIP_TEMPLATE
        : DEFAULT_CLT_TEMPLATE);

    const candidate = hiring.candidate || hiring.candidate_data || {};
    const job = hiring.job || hiring.job_data || {};
    const company = hiring.company || hiring.company_data || {};

    const variables: Record<string, any> = {
      company_name: value(
        hiring.company_name,
        company.name,
        company.company_name
      ),
      company_cnpj: value(
        hiring.company_cnpj,
        company.cnpj,
        company.document
      ),
      company_address: value(
        hiring.company_address,
        company.address,
        company.full_address
      ),
      company_representative: value(
        hiring.company_representative,
        company.representative,
        company.responsible_name
      ),
      company_phone: value(hiring.company_phone, company.phone),
      company_email: value(hiring.company_email, company.email),

      candidate_name: value(
        hiring.candidate_name,
        candidate.name,
        candidate.full_name
      ),
      candidate_cpf: value(
        hiring.candidate_cpf,
        candidate.cpf,
        contractData.cpf
      ),
      candidate_rg: value(contractData.rg_number, candidate.rg),
      candidate_rg_issuer: value(
        contractData.rg_issuer,
        candidate.rg_issuer
      ),
      candidate_birth: formatDate(
        value(
          hiring.candidate_birth,
          candidate.birth_date,
          candidate.birthDate
        )
      ),
      candidate_nationality: value(contractData.nationality),
      candidate_birth_city: value(contractData.birth_city),
      candidate_marital_status: value(contractData.marital_status),
      candidate_address: value(
        hiring.candidate_address,
        candidate.address,
        candidate.full_address
      ),
      candidate_zip: value(
        hiring.candidate_zip,
        candidate.zip,
        candidate.cep
      ),
      candidate_phone: value(
        hiring.phone,
        hiring.candidate_phone,
        candidate.phone,
        candidate.mobile
      ),
      candidate_email: value(
        hiring.email,
        hiring.candidate_email,
        candidate.email
      ),

      mother_name: value(contractData.mother_name),
      father_name: value(contractData.father_name),

      guardian_name: value(contractData.guardian_name),
      guardian_cpf: value(contractData.guardian_cpf),
      guardian_rg: value(contractData.guardian_rg),
      guardian_relationship: value(
        contractData.guardian_relationship
      ),

      institution_name: value(contractData.institution_name),
      institution_cnpj: value(contractData.institution_cnpj),
      course_name: value(contractData.course_name),
      semester: value(contractData.semester),
      enrollment_number: value(contractData.enrollment_number),
      education_level: value(contractData.education_level),

      job_title: value(
        hiring.job_title,
        job.title,
        job.name
      ),
      department: value(
        hiring.department,
        job.department,
        job.area
      ),
      supervisor_name: value(
        hiring.supervisor_name,
        job.supervisor_name
      ),
      salary: value(
        hiring.salary,
        hiring.scholarship,
        job.salary,
        job.scholarship
      ),
      transport: value(
        hiring.transport,
        job.transport,
        job.transport_benefit
      ),
      workload: value(
        hiring.workload,
        job.workload,
        job.work_hours
      ),
      schedule: value(hiring.schedule, job.schedule),
      start_date: formatDate(
        value(
          hiring.start_date,
          hiring.startDate,
          job.start_date
        )
      ),
      end_date: formatDate(
        value(
          hiring.end_date,
          hiring.endDate,
          job.end_date
        )
      ),

      bank_name: value(contractData.bank_name),
      bank_branch: value(contractData.bank_branch),
      bank_account: value(contractData.bank_account),
      bank_account_type: value(contractData.bank_account_type),
      generated_date: new Date().toLocaleDateString("pt-BR"),
    };

    const { rendered, missingVariables } = renderTemplate(
      templateText,
      variables
    );

    return NextResponse.json({
      success: true,
      templateId: savedTemplate?.id || null,
      templateName:
        savedTemplate?.name ||
        (isInternship
          ? "Contrato de Estágio — Modelo Inicial"
          : "Ficha de Admissão CLT — Modelo Inicial"),
      templateType: isInternship ? "internship" : "clt",
      renderedText: rendered,
      variables,
      missingVariables,
    });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json(
        { error: "Dados inválidos.", details: error.issues },
        { status: 400 }
      );
    }

    console.error("CONTRACT PREVIEW ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao gerar contrato." },
      { status: 500 }
    );
  }
}
