import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requireCompany } from "@/lib/server-company";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase não configurado.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { userId, companyId, branchId } =
      await requireCompany(request);

    if (!userId || !companyId) {
      return NextResponse.json(
        {
          success: false,
          error: "Usuário ou empresa não identificados.",
        },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: membership } = await supabase
      .from("company_users")
      .select("role,active")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (!membership || membership.active === false) {
      return NextResponse.json(
        {
          success: false,
          error: "Usuário sem vínculo ativo.",
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const currentRoute = String(
      body.route || request.headers.get("referer") || "/crm/dashboard"
    );

    const now = new Date().toISOString();

    const { data: existingSession } = await supabase
      .from("user_sessions")
      .select("id")
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .eq("online", true)
      .is("logout_at", null)
      .order("last_activity", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (existingSession) {
      const { error } = await supabase
        .from("user_sessions")
        .update({
          last_activity: now,
          current_route: currentRoute,
          current_page:
            body.page || getPageName(currentRoute),
          current_module:
            body.module || getModuleFromRoute(currentRoute),
          idle_seconds: Math.max(
            0,
            Number(body.idleSeconds || 0)
          ),
          online: true,
          updated_at: now,
        })
        .eq("id", existingSession.id);

      if (error) {
        throw new Error(error.message);
      }

      return NextResponse.json({
        success: true,
        sessionId: existingSession.id,
        created: false,
      });
    }

    const sessionToken =
      `${companyId}:${userId}:${Date.now()}`;

    const { data: newSession, error } = await supabase
      .from("user_sessions")
      .insert({
        company_id: companyId,
        branch_id: branchId || null,
        user_id: userId,
        session_token: sessionToken,
        ip: getClientIp(request),
        browser: request.headers.get("user-agent"),
        current_route: currentRoute,
        current_page:
          body.page || getPageName(currentRoute),
        current_module:
          body.module || getModuleFromRoute(currentRoute),
        online: true,
        idle_seconds: 0,
        login_at: now,
        last_activity: now,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      sessionId: newSession.id,
      created: true,
    });
  } catch (error) {
    console.error("[COMMAND CENTER HEARTBEAT]", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao atualizar presença.",
      },
      { status: 500 }
    );
  }
}

function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");

  return (
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

function getModuleFromRoute(route: string): string {
  if (route.includes("/clients")) return "clientes";
  if (route.includes("/jobs")) return "vagas";
  if (route.includes("/candidates")) return "candidatos";
  if (route.includes("/interviews")) return "entrevistas";
  if (route.includes("/hirings")) return "contratacoes";
  if (route.includes("/tasks")) return "tarefas";
  if (route.includes("/inbox")) return "inbox";
  if (route.includes("/messages")) return "mensagens";
  if (route.includes("/contacts")) return "disparos";
  if (route.includes("/whatsapp")) return "whatsapp";
  if (route.includes("/command-center")) {
    return "centro_de_comando";
  }

  return "dashboard";
}

function getPageName(route: string): string {
  const names: Array<[string, string]> = [
    ["/clients", "Clientes"],
    ["/jobs", "Vagas"],
    ["/candidates", "Candidatos"],
    ["/interviews", "Entrevistas"],
    ["/hirings", "Contratações"],
    ["/tasks", "Tarefas"],
    ["/inbox", "Inbox"],
    ["/messages", "Mensagens"],
    ["/contacts", "Disparar contatos"],
    ["/command-center", "Centro de Comando"],
    ["/crm/whatsapp", "WhatsApp"],
  ];

  const match = names.find(([fragment]) =>
    route.includes(fragment)
  );

  return match?.[1] || "Dashboard";
}