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
    const { companyId } = await requireCompany(req);
    const { searchParams } = new URL(req.url);
    const hiringId = searchParams.get("hiringId");

    if (!hiringId) {
      return NextResponse.json(
        { error: "hiringId obrigatório." },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data: events, error } = await supabase
      .from("rh_hiring_events")
      .select("*")
      .eq("company_id", companyId)
      .eq("hiring_id", hiringId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    const actorIds = [
      ...new Set(
        (events || [])
          .map((event: any) => event.actor_user_id)
          .filter(Boolean)
      ),
    ];

    let actorMap = new Map<string, string>();

    if (actorIds.length > 0) {
      const { data: users } = await supabase
        .from("company_users")
        .select("user_id, name, email")
        .eq("company_id", companyId)
        .in("user_id", actorIds);

      actorMap = new Map(
        (users || []).map((user: any) => [
          user.user_id,
          user.name || user.email || "Usuário",
        ])
      );
    }

    return NextResponse.json({
      success: true,
      events: (events || []).map((event: any) => ({
        ...event,
        actor_name: event.actor_user_id
          ? actorMap.get(event.actor_user_id) || null
          : null,
      })),
    });
  } catch (error: any) {
    console.error("GET /api/rh/hirings/timeline:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao carregar linha do tempo." },
      { status: 500 }
    );
  }
}
