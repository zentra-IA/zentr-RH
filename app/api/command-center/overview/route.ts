import { NextResponse } from "next/server";
import {
  getCommandCenterAdminClient,
  getCommandCenterContext,
} from "@/lib/command-center-auth";

export const dynamic = "force-dynamic";

function startDateFromPeriod(period: string) {
  const now = new Date();
  const daysByPeriod: Record<string, number> = {
    "7d": 7,
    "15d": 15,
    "30d": 30,
    "90d": 90,
    "1y": 365,
  };

  const days = daysByPeriod[period] || 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function GET(request: Request) {
  try {
    const context = await getCommandCenterContext();

    if (!context) {
      return NextResponse.json(
        { success: false, error: "Acesso permitido somente para administradores." },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const period = url.searchParams.get("period") || "30d";
    const startDate = startDateFromPeriod(period);
    const supabase = getCommandCenterAdminClient();

    const [
      overviewResult,
      eventsResult,
      alertsResult,
      productivityResult,
      membersResult,
    ] = await Promise.all([
      supabase
        .from("command_center_overview")
        .select("*")
        .eq("company_id", context.companyId)
        .maybeSingle(),

      supabase
        .from("command_center_events")
        .select(
          "id,user_id,module,entity_type,entity_id,action,description,metadata,created_at"
        )
        .eq("company_id", context.companyId)
        .gte("created_at", startDate)
        .order("created_at", { ascending: false })
        .limit(40),

      supabase
        .from("command_center_alerts")
        .select(
          "id,type,severity,title,description,status,entity_type,entity_id,assigned_user_id,detected_at"
        )
        .eq("company_id", context.companyId)
        .in("status", ["open", "acknowledged"])
        .order("detected_at", { ascending: false })
        .limit(20),

      supabase
        .from("command_center_user_productivity")
        .select("*")
        .eq("company_id", context.companyId)
        .gte("activity_date", startDate.slice(0, 10)),

      supabase
        .from("company_users")
        .select("user_id,name,email,role,active")
        .eq("company_id", context.companyId),
    ]);

    const firstError =
      overviewResult.error ||
      eventsResult.error ||
      alertsResult.error ||
      productivityResult.error ||
      membersResult.error;

    if (firstError) {
      throw new Error(firstError.message);
    }

    const members = membersResult.data || [];
    const memberMap = new Map(
      members.map((member: any) => [
        member.user_id,
        member.name || member.email || "Usuário",
      ])
    );

    const productivityMap = new Map<string, any>();

    for (const row of productivityResult.data || []) {
      const current = productivityMap.get(row.user_id) || {
        userId: row.user_id,
        name: memberMap.get(row.user_id) || "Usuário",
        totalActions: 0,
        clientActions: 0,
        jobActions: 0,
        candidateActions: 0,
        interviewActions: 0,
        hiringActions: 0,
      };

      current.totalActions += Number(row.total_actions || 0);
      current.clientActions += Number(row.client_actions || 0);
      current.jobActions += Number(row.job_actions || 0);
      current.candidateActions += Number(row.candidate_actions || 0);
      current.interviewActions += Number(row.interview_actions || 0);
      current.hiringActions += Number(row.hiring_actions || 0);

      productivityMap.set(row.user_id, current);
    }

    const productivity = Array.from(productivityMap.values())
      .sort((a, b) => b.totalActions - a.totalActions)
      .slice(0, 10);

    const events = (eventsResult.data || []).map((event: any) => ({
      ...event,
      user_name: event.user_id
        ? memberMap.get(event.user_id) || "Usuário não identificado"
        : "Automação do sistema",
    }));

    const activeMembers = members.filter((member: any) => member.active !== false);

    return NextResponse.json(
      {
        success: true,
        period,
        generatedAt: new Date().toISOString(),
        overview: {
          events24h: Number(overviewResult.data?.events_24h || 0),
          eventsWeek: Number(overviewResult.data?.events_week || 0),
          activeUsers24h: Number(overviewResult.data?.active_users_24h || 0),
          jobsCreated: Number(overviewResult.data?.jobs_created || 0),
          interviewsCreated: Number(
            overviewResult.data?.interviews_created || 0
          ),
          hiringsStarted: Number(overviewResult.data?.hirings_started || 0),
          openAlerts: (alertsResult.data || []).filter(
            (alert: any) => alert.status === "open"
          ).length,
          teamMembers: activeMembers.length,
        },
        events,
        alerts: alertsResult.data || [],
        productivity,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error: any) {
    console.error("COMMAND CENTER OVERVIEW:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Erro ao carregar o Centro de Comando.",
      },
      { status: 500 }
    );
  }
}
