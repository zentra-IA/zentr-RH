import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(2),
  contractType: z.enum(["internship", "clt"]),
  subtype: z.string().nullable().optional(),
  templateText: z.string().min(20),
});

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) throw new Error("Supabase não configurado.");
  return createClient(url, key);
}

export async function GET(req: NextRequest) {
  try {
    const { companyId } = await requireCompany(req);
    const supabase = supabaseAdmin();

    const { data, error } = await supabase
      .from("rh_contract_templates")
      .select("*")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      templates: data || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao carregar modelos." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, userId } = await requireCompany(req);
    const body = createSchema.parse(await req.json());
    const supabase = supabaseAdmin();

    const { data, error } = await supabase
      .from("rh_contract_templates")
      .insert({
        company_id: companyId,
        name: body.name,
        contract_type: body.contractType,
        subtype: body.subtype || null,
        template_text: body.templateText,
        active: true,
        created_by: userId,
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      template: data,
    });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json(
        { error: "Dados inválidos.", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error?.message || "Erro ao criar modelo." },
      { status: 500 }
    );
  }
}
