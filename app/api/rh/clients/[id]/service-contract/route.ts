import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";
import { createLegalPdf } from "@/lib/rh-pdf";
import { buildClientInternshipServiceContractText } from "@/lib/internship-document-templates";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase não configurado.");
  return createClient(url, key);
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

async function getClient(supabase: ReturnType<typeof supabaseAdmin>, companyId: string, clientId: string) {
  const { data, error } = await supabase
    .from("company_contacts")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", clientId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Cliente não encontrado.");
  return data;
}

async function getContract(supabase: ReturnType<typeof supabaseAdmin>, companyId: string, clientId: string) {
  const { data, error } = await supabase
    .from("rh_client_service_contracts")
    .select("*")
    .eq("company_id", companyId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

function defaultData(client: any) {
  return {
    client_name: client?.company_name || client?.restaurant_name || "",
    client_cnpj: client?.cnpj || client?.document || "",
    client_address: [
      client?.address,
      client?.city,
      client?.state,
      client?.cep ? `CEP ${client.cep}` : "",
    ]
      .filter(Boolean)
      .join(", "),
    honorarium_amount: "",
    payment_day: "",
    contract_date: new Date().toISOString().slice(0, 10),
    representative_name:
      client?.responsible_name || client?.owner_name || "",
  };
}

export async function GET(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompany(req);
    const { id } = await Promise.resolve(context.params);
    const supabase = supabaseAdmin();
    const client = await getClient(supabase, companyId, id);
    const contract = await getContract(supabase, companyId, id);

    return NextResponse.json({
      success: true,
      status: contract?.status || "not_generated",
      data: {
        ...defaultData(client),
        ...(contract?.data || {}),
      },
      generatedAt: contract?.generated_at || null,
      sentAt: contract?.sent_at || null,
      signedAt: contract?.signed_at || null,
    });
  } catch (error: any) {
    console.error("GET CLIENT SERVICE CONTRACT ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao carregar contrato do cliente." },
      { status: error?.message === "Cliente não encontrado." ? 404 : 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { companyId, userId } = await requireCompany(req);
    const { id } = await Promise.resolve(context.params);
    const body = await req.json();
    const supabase = supabaseAdmin();
    const client = await getClient(supabase, companyId, id);

    const current = await getContract(supabase, companyId, id);
    const nextData = {
      ...defaultData(client),
      ...(current?.data || {}),
      ...(body.data || {}),
    };

    const status = clean(body.status || current?.status || "draft") || "draft";
    const now = new Date().toISOString();

    const row: any = {
      company_id: companyId,
      client_id: id,
      status,
      data: nextData,
      updated_by: userId,
      updated_at: now,
    };

    if (status === "sent" && !current?.sent_at) row.sent_at = now;
    if (status === "signed" && !current?.signed_at) row.signed_at = now;

    const { data, error } = await supabase
      .from("rh_client_service_contracts")
      .upsert(row, { onConflict: "company_id,client_id" })
      .select("*")
      .single();

    if (error) throw error;

    if (status === "signed") {
      await supabase
        .from("company_contacts")
        .update({
          rh_pipeline_stage: "CONTRATO_ASSINADO_ATIVO",
          updated_at: now,
        })
        .eq("company_id", companyId)
        .eq("id", id);
    }

    return NextResponse.json({
      success: true,
      status: data.status,
      data: data.data,
      generatedAt: data.generated_at,
      sentAt: data.sent_at,
      signedAt: data.signed_at,
    });
  } catch (error: any) {
    console.error("PATCH CLIENT SERVICE CONTRACT ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao salvar contrato do cliente." },
      { status: error?.message === "Cliente não encontrado." ? 404 : 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { companyId, userId } = await requireCompany(req);
    const { id } = await Promise.resolve(context.params);
    const body = await req.json().catch(() => ({}));
    const supabase = supabaseAdmin();
    const client = await getClient(supabase, companyId, id);
    const current = await getContract(supabase, companyId, id);

    const data = {
      ...defaultData(client),
      ...(current?.data || {}),
      ...(body.data || {}),
    };

    const content = buildClientInternshipServiceContractText(client, data);
    const pdfBytes = await createLegalPdf(content);
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("rh_client_service_contracts")
      .upsert(
        {
          company_id: companyId,
          client_id: id,
          status: "generated",
          data,
          template_version: "2026-10-19",
          content_text: content,
          generated_at: now,
          updated_by: userId,
          updated_at: now,
        },
        { onConflict: "company_id,client_id" }
      );

    if (error) throw error;

    const safeName = clean(client.company_name || client.restaurant_name || "cliente")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_");

    return new Response(Uint8Array.from(pdfBytes).buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="contrato_prestacao_estagio_${safeName || id}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error: any) {
    console.error("POST CLIENT SERVICE CONTRACT ERROR:", error);
    return new Response(
      error?.message || "Erro ao gerar contrato do cliente.",
      { status: error?.message === "Cliente não encontrado." ? 404 : 500 }
    );
  }
}
