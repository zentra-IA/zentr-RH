import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { auditLog } from "@/lib/audit";
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

    // O usuário pode ser de qualquer papel, mas precisa estar ativo
    // e vinculado à empresa informada pelo contexto autenticado.
    const { data: membership, error: membershipError } =
      await supabase
        .from("company_users")
        .select("id,user_id,company_id,role,active")
        .eq("user_id", userId)
        .eq("company_id", companyId)
        .maybeSingle();

    if (
      membershipError ||
      !membership ||
      membership.active === false
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Usuário não vinculado à empresa atual.",
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const eventType = String(
      body.event || body.type || "page_activity"
    );

    const route = String(
      body.route || "/crm/dashboard"
    );

    const duration = Math.max(
      0,
      Number(body.duration || body.seconds || 0)
    );

    await auditLog({
      companyId,
      userId,
      action: eventType,
      entity: route,
      metadata: {
        route,
        page: body.page || getPageName(route),
        module: body.module || getModuleFromRoute(route),
        duration,
        enteredAt: body.enteredAt || null,
        leftAt: body.leftAt || null,
        branchId: branchId || null,
        role: membership.role,
        source: "command_center_tracker",
        recordedAt: new Date().toISOString(),
        userAgent: request.headers.get("user-agent"),
        ipAddress: getClientIp(request),
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("[COMMAND CENTER TRACK]", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao registrar atividade.",
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