import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  hiringId: z.string().min(1),
  templateName: z.string().min(1),
  templateType: z.string().min(1),
  renderedText: z.string().min(1),
  variables: z.record(z.string(), z.any()).optional().default({}),
});

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) throw new Error("Supabase não configurado.");
  return createClient(url, key);
}

async function assertHiring(
  supabase: ReturnType<typeof supabaseAdmin>,
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

    const supabase = supabaseAdmin();
    await assertHiring(supabase, companyId, hiringId);

    const { data, error } = await supabase
      .from("rh_generated_contracts")
      .select("*")
      .eq("company_id", companyId)
      .eq("hiring_id", hiringId)
      .order("version", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      contracts: data || [],
    });
  } catch (error: any) {
    console.error("GET GENERATED CONTRACTS ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao carregar contratos." },
      { status: error?.message === "Contratação não encontrada." ? 404 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, userId } = await requireCompany(req);
    const body = createSchema.parse(await req.json());
    const supabase = supabaseAdmin();

    await assertHiring(supabase, companyId, body.hiringId);

    const { data: lastVersion, error: versionError } = await supabase
      .from("rh_generated_contracts")
      .select("version")
      .eq("company_id", companyId)
      .eq("hiring_id", body.hiringId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (versionError) throw versionError;

    const version = Number(lastVersion?.version || 0) + 1;

    const { data, error } = await supabase
      .from("rh_generated_contracts")
      .insert({
        company_id: companyId,
        hiring_id: body.hiringId,
        version,
        template_name: body.templateName,
        template_type: body.templateType,
        rendered_text: body.renderedText,
        variables: body.variables,
        status: "draft",
        created_by: userId,
      })
      .select("*")
      .single();

    if (error) throw error;

    await supabase.from("rh_hiring_events").insert({
      company_id: companyId,
      hiring_id: body.hiringId,
      actor_user_id: userId,
      event_type: "contract_generated",
      title: `Contrato gerado — versão ${version}`,
      description: body.templateName,
      metadata: {
        contract_id: data.id,
        version,
        template_type: body.templateType,
      },
    });

    return NextResponse.json({
      success: true,
      contract: data,
    });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json(
        { error: "Dados inválidos.", details: error.issues },
        { status: 400 }
      );
    }

    console.error("POST GENERATED CONTRACT ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao salvar contrato." },
      { status: error?.message === "Contratação não encontrada." ? 404 : 500 }
    );
  }
}
