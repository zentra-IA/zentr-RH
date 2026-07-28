import { NextRequest, NextResponse } from "next/server";
import {
  getCommandCenterAdminClient,
  getCommandCenterContext,
} from "@/lib/command-center-auth";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const checks: Record<string, unknown> = {
    checkedAt: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    supabaseUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  try {
    const context = await getCommandCenterContext();

    if (!context) {
      return NextResponse.json(
        {
          success: false,
          ...checks,
          authenticated: false,
          error: "Usuário sem acesso ao Centro de Comando.",
        },
        { status: 403 }
      );
    }

    const supabase = getCommandCenterAdminClient();

    const [
      eventsCount,
      latestEvent,
      alertsCount,
    ] = await Promise.all([
      supabase
        .from("command_center_events")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("command_center_events")
        .select("id,action,source,occurred_at,created_at")
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("command_center_alerts")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "acknowledged"]),
    ]);

    const errors = [
      eventsCount.error,
      latestEvent.error,
      alertsCount.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      throw new Error(errors.map((item) => item?.message).join(" | "));
    }

    return NextResponse.json({
      success: true,
      ...checks,
      authenticated: true,
      role: context.role,
      globalAccess: context.globalAccess,
      companyId: context.companyId,
      eventBus: {
        events: eventsCount.count || 0,
        latestEvent: latestEvent.data || null,
      },
      alerts: {
        openOrAcknowledged: alertsCount.count || 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        ...checks,
        error: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 }
    );
  }
}
