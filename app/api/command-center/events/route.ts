import { NextRequest, NextResponse } from "next/server";
import {
  emitCommandCenterEvent,
} from "@/lib/command-center-events";
import {
  applyCommandCenterCompanyScope,
  getCommandCenterAdminClient,
  getCommandCenterContext,
} from "@/lib/command-center-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const context = await getCommandCenterContext();

    if (!context) {
      return NextResponse.json(
        { success: false, error: "Acesso não autorizado." },
        { status: 403 }
      );
    }

    const params = request.nextUrl.searchParams;
    const limit = Math.min(
      Math.max(Number(params.get("limit") || 100), 1),
      500
    );
    const moduleFilter = params.get("module");
    const companyId = params.get("companyId");

    const supabase = getCommandCenterAdminClient();

    let query = supabase
      .from("command_center_timeline")
      .select(
        "id,company_id,branch_id,user_id,module,entity_type,entity_id,action,display_description,metadata,source,occurred_at,created_at"
      )
      .order("occurred_at", { ascending: false })
      .limit(limit);

    query = applyCommandCenterCompanyScope(query, context);

    if (context.globalAccess && companyId) {
      query = query.eq("company_id", companyId);
    }

    if (moduleFilter && moduleFilter !== "all") {
      query = query.eq("module", moduleFilter);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      events: data || [],
      globalAccess: context.globalAccess,
    });
  } catch (error) {
    console.error("GET /api/command-center/events:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro ao buscar eventos.",
      },
      { status: 500 }
    );
  }
}

/**
 * Endpoint de teste e integrações controladas.
 * Somente admin/administrador autenticado pode emitir manualmente.
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getCommandCenterContext();

    if (!context) {
      return NextResponse.json(
        { success: false, error: "Acesso não autorizado." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const targetCompanyId = context.globalAccess
      ? body.companyId || context.companyId
      : context.companyId;

    const result = await emitCommandCenterEvent(
      {
        companyId: targetCompanyId,
        branchId: context.branchId,
        userId: context.userId,
        module: String(body.module || "sistema"),
        entityType: String(body.entityType || "command_center"),
        entityId: body.entityId ? String(body.entityId) : null,
        action: String(body.action || "command_center_tested"),
        description: String(
          body.description || "Testou o Event Bus do Centro de Comando"
        ),
        metadata: {
          ...(body.metadata || {}),
          environment: process.env.NODE_ENV || "development",
        },
        eventKey:
          body.eventKey ||
          `manual-test:${context.userId}:${Date.now()}`,
      },
      {
        request,
        throwOnError: true,
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/command-center/events:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro ao emitir evento.",
      },
      { status: 500 }
    );
  }
}
