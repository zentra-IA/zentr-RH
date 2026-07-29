import { NextResponse } from "next/server";
import {
  applyCommandCenterCompanyScope,
  getCommandCenterAdminClient,
  getCommandCenterContext,
} from "@/lib/command-center-auth";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["open", "acknowledged", "resolved", "dismissed"];
const VALID_SEVERITIES = ["low", "medium", "high", "critical"];

export async function GET(request: Request) {
  try {
    const context = await getCommandCenterContext();

    if (!context) {
      return NextResponse.json(
        { success: false, error: "Acesso não autorizado." },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "open";
    const severity = url.searchParams.get("severity") || "all";
    const type = url.searchParams.get("type") || "all";
    const companyId = url.searchParams.get("companyId");
    const supabase = getCommandCenterAdminClient();

    let query = supabase
      .from("command_center_alerts")
      .select(
        "id,company_id,type,severity,title,description,status,entity_type,entity_id,assigned_user_id,responsible_user_id,recommended_action,metadata,detected_at,last_seen_at,acknowledged_at,resolved_at,occurrence_count"
      )
      .order("detected_at", { ascending: false })
      .limit(300);

    query = applyCommandCenterCompanyScope(query, context);

    if (context.globalAccess && companyId) {
      query = query.eq("company_id", companyId);
    }

    if (status !== "all") {
      query = query.eq("status", status);
    }

    if (severity !== "all" && VALID_SEVERITIES.includes(severity)) {
      query = query.eq("severity", severity);
    }

    if (type !== "all") {
      query = query.eq("type", type);
    }

    const [alertsResult, companiesResult, membersResult] = await Promise.all([
      query,
      context.globalAccess
        ? supabase.from("companies").select("id,name").order("name").limit(500)
        : Promise.resolve({ data: [], error: null }),
      context.globalAccess
        ? supabase
            .from("company_users")
            .select("company_id,user_id,name,email")
            .limit(5000)
        : supabase
            .from("company_users")
            .select("company_id,user_id,name,email")
            .eq("company_id", context.companyId),
    ]);

    const firstError =
      alertsResult.error || companiesResult.error || membersResult.error;

    if (firstError) throw new Error(firstError.message);

    const companies = companiesResult.data || [];
    const companyMap = new Map(
      companies.map((company: any) => [company.id, company.name])
    );

    const members = membersResult.data || [];
    const memberMap = new Map(
      members.map((member: any) => [
        `${member.company_id}:${member.user_id}`,
        member.name || member.email || "Usuário",
      ])
    );

    const alerts = (alertsResult.data || []).map((alert: any) => ({
      ...alert,
      company_name:
        companyMap.get(alert.company_id) ||
        (alert.company_id === context.companyId ? "Empresa atual" : "Empresa"),
      responsible_name: alert.responsible_user_id
        ? memberMap.get(`${alert.company_id}:${alert.responsible_user_id}`) ||
          "Usuário não identificado"
        : null,
    }));

    const summary = {
      total: alerts.length,
      critical: alerts.filter((item: any) => item.severity === "critical").length,
      high: alerts.filter((item: any) => item.severity === "high").length,
      medium: alerts.filter((item: any) => item.severity === "medium").length,
      low: alerts.filter((item: any) => item.severity === "low").length,
    };

    return NextResponse.json({
      success: true,
      role: context.role,
      globalAccess: context.globalAccess,
      alerts,
      companies,
      summary,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("COMMAND CENTER ALERTS GET:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Erro ao carregar os alertas.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCommandCenterContext();

    if (!context) {
      return NextResponse.json(
        { success: false, error: "Acesso não autorizado." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const requestedCompanyId = body.companyId || null;

    if (
      !context.globalAccess &&
      requestedCompanyId &&
      requestedCompanyId !== context.companyId
    ) {
      return NextResponse.json(
        { success: false, error: "Empresa fora do escopo permitido." },
        { status: 403 }
      );
    }

    const targetCompanyId = context.globalAccess
      ? requestedCompanyId
      : context.companyId;

    const supabase = getCommandCenterAdminClient();
    const { data, error } = await supabase.rpc(
      "command_center_generate_alerts",
      {
        p_company_id: targetCompanyId || null,
      }
    );

    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      result: data,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("COMMAND CENTER ALERTS POST:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Erro ao atualizar os alertas.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await getCommandCenterContext();

    if (!context) {
      return NextResponse.json(
        { success: false, error: "Acesso não autorizado." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const alertId = String(body.id || "");
    const status = String(body.status || "");

    if (!alertId || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos para atualizar o alerta." },
        { status: 400 }
      );
    }

    const supabase = getCommandCenterAdminClient();

    let ownershipQuery = supabase
      .from("command_center_alerts")
      .select("id,company_id")
      .eq("id", alertId)
      .maybeSingle();

    const { data: alert, error: ownershipError } = await ownershipQuery;

    if (ownershipError || !alert) {
      return NextResponse.json(
        { success: false, error: "Alerta não encontrado." },
        { status: 404 }
      );
    }

    if (!context.globalAccess && alert.company_id !== context.companyId) {
      return NextResponse.json(
        { success: false, error: "Alerta fora do escopo permitido." },
        { status: 403 }
      );
    }

    const updatePayload: Record<string, any> = { status };

    if (status === "acknowledged") {
      updatePayload.acknowledged_at = new Date().toISOString();
    }

    if (status === "resolved") {
      updatePayload.resolved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("command_center_alerts")
      .update(updatePayload)
      .eq("id", alertId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("COMMAND CENTER ALERTS PATCH:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Erro ao atualizar o alerta.",
      },
      { status: 500 }
    );
  }
}
