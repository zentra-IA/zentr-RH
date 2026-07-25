import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase não configurado.");
  }

  return createClient(url, key);
}

export async function GET(req: NextRequest) {
  try {
    const { companyId, userId } = await requireCompany(req);
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("company_users")
      .select("id, user_id, name, email, role, active")
      .eq("company_id", companyId)
      .eq("active", true)
      .order("name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      currentUserId: userId,
      users: data || [],
    });
  } catch (error: any) {
    console.error("GET /api/rh/hirings/users:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao carregar colaboradores." },
      { status: 500 }
    );
  }
}
