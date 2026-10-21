import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const contractDataSchema = z.object({
  hiring_type: z.string().optional().default(""),
  internship_subtype: z.string().optional().default(""),
  father_name: z.string().optional().default(""),
  mother_name: z.string().optional().default(""),
  marital_status: z.string().optional().default(""),
  nationality: z.string().optional().default(""),
  birth_city: z.string().optional().default(""),
  rg_number: z.string().optional().default(""),
  rg_issuer: z.string().optional().default(""),
  rg_issue_date: z.string().optional().default(""),
  bank_name: z.string().optional().default(""),
  bank_branch: z.string().optional().default(""),
  bank_account: z.string().optional().default(""),
  bank_account_type: z.string().optional().default(""),
  institution_name: z.string().optional().default(""),
  institution_cnpj: z.string().optional().default(""),
  course_name: z.string().optional().default(""),
  semester: z.string().optional().default(""),
  enrollment_number: z.string().optional().default(""),
  education_level: z.string().optional().default(""),
  guardian_name: z.string().optional().default(""),
  guardian_cpf: z.string().optional().default(""),
  guardian_rg: z.string().optional().default(""),
  guardian_relationship: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  completion_percent: z.number().int().min(0).max(100).optional().default(0),
}).passthrough();

const patchSchema = z.object({
  hiringId: z.string().min(1),
  contractData: contractDataSchema,
});

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase não configurado.");
  }

  return createClient(url, key);
}

async function assertHiring(
  supabase: ReturnType<typeof getSupabase>,
  companyId: string,
  hiringId: string
) {
  const { data, error } = await supabase
    .from("rh_hirings")
    .select("id")
    .eq("company_id", companyId)
    .eq("id", hiringId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Contratação não encontrada.");
}

function firstValue(...values: any[]) {
  return values.find(
    (value) =>
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
  ) ?? "";
}

function normalizeHiringType(value: any) {
  const raw = String(value || "").trim();
  const lower = raw.toLowerCase();
  if (lower.includes("est")) return "Estágio";
  if (lower.includes("clt")) return "CLT";
  return raw;
}

async function buildAutomaticContractData(
  supabase: ReturnType<typeof getSupabase>,
  companyId: string,
  hiringId: string
) {
  const { data: hiring, error: hiringError } = await supabase
    .from("rh_hirings")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", hiringId)
    .maybeSingle();

  if (hiringError) throw hiringError;
  if (!hiring) throw new Error("Contratação não encontrada.");

  let candidate: any = null;

  if (hiring.candidate_id) {
    candidate = await prisma.candidateProfile.findFirst({
      where: {
        id: hiring.candidate_id,
        company_id: companyId,
      },
    });
  }

  if (!candidate && (hiring.candidate_email || hiring.candidate_phone)) {
    candidate = await prisma.candidateProfile.findFirst({
      where: {
        company_id: companyId,
        OR: [
          ...(hiring.candidate_email
            ? [{ email: { equals: hiring.candidate_email, mode: "insensitive" as const } }]
            : []),
          ...(hiring.candidate_phone
            ? [
                { phone: hiring.candidate_phone },
                { mobile: hiring.candidate_phone },
              ]
            : []),
        ],
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  const job = hiring.job_id
    ? await prisma.job.findFirst({
        where: { id: hiring.job_id, company_id: companyId },
      })
    : null;

  const openingId = firstValue(job?.opening_id, hiring.opening_id);
  const opening = openingId
    ? await prisma.rh_job_openings.findFirst({
        where: { id: openingId, company_id: companyId },
      })
    : null;

  const clientId = firstValue(job?.client_id, opening?.client_id);
  const client = clientId
    ? await prisma.company_contacts.findFirst({
        where: { id: clientId, company_id: companyId },
      })
    : null;

  const activities = Array.isArray(opening?.activities)
    ? opening.activities.filter(Boolean).join("\n")
    : "";

  // A origem da vaga prevalece sobre registros legados de contratação.
  // Isso corrige contratações de estágio antigas que foram gravadas como CLT.
  const contractType = firstValue(
    opening?.contract_type,
    job?.contractType,
    hiring.contract_type
  );

  const openingContractType = String(opening?.contract_type || "").toUpperCase();
  const candidateEducation = String(candidate?.education || "").toLowerCase();

  const internshipSubtype =
    openingContractType.includes("SUPERIOR")
      ? "higher_education"
      : candidateEducation.includes("técn") || candidateEducation.includes("tecn")
        ? "technical"
        : openingContractType.includes("ESTAGIO")
          ? "high_school"
          : "";

  return {
    hiring_type: normalizeHiringType(contractType),
    internship_subtype: internshipSubtype,

    rg_number: firstValue(candidate?.rg),
    candidate_rg: firstValue(candidate?.rg),
    candidate_cpf: firstValue(candidate?.cpf),
    candidate_birth_date: candidate?.birthDate
      ? candidate.birthDate.toISOString().slice(0, 10)
      : "",
    candidate_address: firstValue(candidate?.address),
    candidate_neighborhood: firstValue(candidate?.neighborhood),
    candidate_city: firstValue(candidate?.city),
    candidate_state: firstValue(candidate?.state),
    candidate_zip: firstValue(candidate?.zipCode),

    institution_name: firstValue(candidate?.institution),
    course_name: firstValue(candidate?.course),
    education_level: firstValue(candidate?.education),

    internship_start: firstValue(hiring.contract_start),
    internship_end: firstValue(hiring.contract_end),
    work_schedule: firstValue(opening?.work_schedule),
    break_time: firstValue(opening?.break_time),
    scholarship_amount: firstValue(hiring.salary, opening?.remuneration),
    transport_benefit: firstValue(opening?.transport_benefit),
    activities,

    supervisor_name: firstValue(opening?.direct_manager),

    company_name: firstValue(client?.company_name, client?.restaurant_name),
    company_cnpj: firstValue(client?.cnpj, client?.document),
    company_address: firstValue(client?.address),
    company_city: firstValue(client?.city),
    company_state: firstValue(client?.state),
    company_zip: firstValue(client?.cep),
    company_phone: firstValue(client?.phone, client?.whatsapp),
    company_email: firstValue(client?.email),
    company_representative: firstValue(client?.responsible_name, client?.owner_name),
    company_representative_role: "",
    company_complement: "",
    company_neighborhood: "",

    document_date: new Date().toISOString().slice(0, 10),
    insurance_company: "PORTO SEGURO CIA DE SEGUROS GERAIS",
    insurance_policy: "61.0862.98.000",
  };
}

export async function GET(req: NextRequest) {
  try {
    const { companyId } = await requireCompany(req);
    const hiringId = new URL(req.url).searchParams.get("hiringId");

    if (!hiringId) {
      return NextResponse.json(
        { error: "hiringId obrigatório." },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    await assertHiring(supabase, companyId, hiringId);

    const [automaticData, savedResult] = await Promise.all([
      buildAutomaticContractData(supabase, companyId, hiringId),
      supabase
        .from("rh_hiring_contract_data")
        .select("*")
        .eq("company_id", companyId)
        .eq("hiring_id", hiringId)
        .maybeSingle(),
    ]);

    if (savedResult.error) throw savedResult.error;

    const saved = savedResult.data;
    const mergedData = {
      ...automaticData,
      ...(saved?.data || {}),
    };

    return NextResponse.json({
      success: true,
      contractData: mergedData,
      completionPercent: saved?.completion_percent || 0,
      updatedAt: saved?.updated_at || null,
      autoFilled: automaticData,
    });
  } catch (error: any) {
    console.error("GET CONTRACT DATA ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao carregar dados contratuais." },
      { status: error?.message === "Contratação não encontrada." ? 404 : 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { companyId, userId } = await requireCompany(req);
    const body = patchSchema.parse(await req.json());
    const supabase = getSupabase();

    await assertHiring(supabase, companyId, body.hiringId);

    const { data: previous } = await supabase
      .from("rh_hiring_contract_data")
      .select("data")
      .eq("company_id", companyId)
      .eq("hiring_id", body.hiringId)
      .maybeSingle();

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("rh_hiring_contract_data")
      .upsert(
        {
          company_id: companyId,
          hiring_id: body.hiringId,
          data: body.contractData,
          completion_percent: body.contractData.completion_percent,
          updated_by: userId,
          updated_at: now,
        },
        {
          onConflict: "company_id,hiring_id",
        }
      )
      .select("*")
      .single();

    if (error) throw error;

    const previousData = previous?.data || {};
    const changedFields = Object.keys(body.contractData).filter(
      (key) =>
        JSON.stringify(previousData[key]) !==
        JSON.stringify((body.contractData as any)[key])
    );

    await supabase.from("rh_hiring_events").insert({
      company_id: companyId,
      hiring_id: body.hiringId,
      actor_user_id: userId,
      event_type: "contract_data_updated",
      title: "Dados contratuais atualizados",
      description: `${changedFields.length} campo(s) alterado(s)`,
      metadata: {
        changed_fields: changedFields,
        completion_percent: body.contractData.completion_percent,
      },
    });

    return NextResponse.json({
      success: true,
      contractData: data.data,
      completionPercent: data.completion_percent,
      updatedAt: data.updated_at,
    });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json(
        { error: "Dados inválidos.", details: error.issues },
        { status: 400 }
      );
    }

    console.error("PATCH CONTRACT DATA ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao salvar dados contratuais." },
      { status: error?.message === "Contratação não encontrada." ? 404 : 500 }
    );
  }
}
