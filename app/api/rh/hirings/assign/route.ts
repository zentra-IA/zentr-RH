import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  hiringId: z.string().min(1),
  assignedTo: z.string().nullable(),
});

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase não configurado.");
  }

  return createClient(url, key);
}

export async function PATCH(req: NextRequest) {
  try {
    const { companyId, userId } = await requireCompany(req);
    const body = bodySchema.parse(await req.json());
    const supabase = getSupabase();

    const { data: hiring, error: hiringError } = await supabase
      .from("rh_hirings")
      .select("id, assigned_to")
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

    const { data, error } = await supabase
      .from("rh_hirings")
      .update({
        assigned_to: body.assignedTo,
        assigned_at: body.assignedTo ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", companyId)
      .eq("id", body.hiringId)
      .select("*")
      .single();

    if (error) throw error;

    await supabase.from("rh_hiring_events").insert({
      company_id: companyId,
      hiring_id: body.hiringId,
      actor_user_id: userId,
      event_type: body.assignedTo ? "assigned" : "unassigned",
      title: body.assignedTo
        ? "Responsável atribuído"
        : "Responsável removido",
      metadata: {
        previous_assigned_to: hiring.assigned_to,
        assigned_to: body.assignedTo,
      },
    });

    return NextResponse.json({ hiring: data });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json(
        { error: "Dados inválidos.", details: error.issues },
        { status: 400 }
      );
    }

    console.error("PATCH HIRING ASSIGN ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao atribuir responsável." },
      { status: 500 }
    );
  }
}
