import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";
import { z } from "zod";

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
});

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

    const { data, error } = await supabase
      .from("rh_hiring_contract_data")
      .select("*")
      .eq("company_id", companyId)
      .eq("hiring_id", hiringId)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      contractData: data?.data || null,
      completionPercent: data?.completion_percent || 0,
      updatedAt: data?.updated_at || null,
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
