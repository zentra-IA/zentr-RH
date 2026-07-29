import { NextRequest, NextResponse } from "next/server";

import {
  getCommandCenterAdminClient,
  getCommandCenterContext,
} from "@/lib/command-center-auth";

export const dynamic = "force-dynamic";

const VALID_PERIODS = new Map<string, number>([
  ["24h", 1],
  ["7d", 7],
  ["15d", 15],
  ["30d", 30],
  ["90d", 90],
]);

export async function GET(request: NextRequest) {
  try {
    const context = await getCommandCenterContext();

    if (!context) {
      return NextResponse.json(
        {
          success: false,
          error: "Acesso não autorizado.",
        },
        { status: 403 }
      );
    }

    const params = request.nextUrl.searchParams;

    const period = params.get("period") || "24h";
    const moduleFilter = params.get("module") || "all";
    const actionFilter = params.get("action") || "all";
    const userId = params.get("userId") || "";
    const requestedCompanyId =
      params.get("companyId") || "";
    const search = (
      params.get("search") || ""
    ).trim();
    const limit = Math.min(
      Math.max(
        Number(params.get("limit") || 200),
        1
      ),
      1000
    );

    if (
      !context.globalAccess &&
      requestedCompanyId &&
      requestedCompanyId !== context.companyId
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Empresa fora do escopo permitido.",
        },
        { status: 403 }
      );
    }

    const periodDays =
      VALID_PERIODS.get(period) || 1;

    const since = new Date(
      Date.now() -
        periodDays * 24 * 60 * 60 * 1000
    ).toISOString();

    const supabase = getCommandCenterAdminClient();

    let query = supabase
      .from("activity_logs")
      .select(
        "id,company_id,user_id,action,entity,metadata,created_at"
      )
      .gte("created_at", since)
      .order("created_at", {
        ascending: false,
      })
      .limit(limit);

    if (context.globalAccess) {
      if (requestedCompanyId) {
        query = query.eq(
          "company_id",
          requestedCompanyId
        );
      }
    } else {
      query = query.eq(
        "company_id",
        context.companyId
      );
    }

    if (userId) {
      query = query.eq("user_id", userId);
    }

    if (actionFilter !== "all") {
      query = query.eq("action", actionFilter);
    }

    if (moduleFilter !== "all") {
      query = query.contains("metadata", {
        module: moduleFilter,
      });
    }

    if (search) {
      query = query.or(
        `entity.ilike.%${search}%,action.ilike.%${search}%`
      );
    }

    const { data: activities, error } =
      await query;

    if (error) {
      throw new Error(error.message);
    }

    const companyIds = Array.from(
      new Set(
        (activities || [])
          .map((activity: any) => activity.company_id)
          .filter(Boolean)
      )
    );

    const userIds = Array.from(
      new Set(
        (activities || [])
          .map((activity: any) => activity.user_id)
          .filter(Boolean)
      )
    );

    let users: any[] = [];

    if (userIds.length > 0) {
      let usersQuery = supabase
        .from("company_users")
        .select(
          "company_id,user_id,name,email,role,active"
        )
        .in("user_id", userIds)
        .limit(5000);

      if (!context.globalAccess) {
        usersQuery = usersQuery.eq(
          "company_id",
          context.companyId
        );
      } else if (requestedCompanyId) {
        usersQuery = usersQuery.eq(
          "company_id",
          requestedCompanyId
        );
      } else if (companyIds.length > 0) {
        usersQuery = usersQuery.in(
          "company_id",
          companyIds
        );
      }

      const usersResult = await usersQuery;

      if (usersResult.error) {
        throw new Error(usersResult.error.message);
      }

      users = usersResult.data || [];
    }

    let companies: any[] = [];

    if (context.globalAccess) {
      const companiesResult = await supabase
        .from("companies")
        .select("id,name")
        .order("name")
        .limit(1000);

      if (companiesResult.error) {
        throw new Error(
          companiesResult.error.message
        );
      }

      companies = companiesResult.data || [];
    }

    const userMap = new Map(
      users.map((user: any) => [
        `${user.company_id}:${user.user_id}`,
        user,
      ])
    );

    const companyMap = new Map(
      companies.map((company: any) => [
        company.id,
        company.name,
      ])
    );

    const enrichedActivities = (
      activities || []
    ).map((activity: any) => {
      const user = userMap.get(
        `${activity.company_id}:${activity.user_id}`
      );

      const metadata =
        activity.metadata &&
        typeof activity.metadata === "object"
          ? activity.metadata
          : {};

      return {
        ...activity,
        metadata,
        user_name:
          user?.name ||
          user?.email ||
          "Automação do sistema",
        user_email: user?.email || null,
        user_role: user?.role || null,
        company_name:
          companyMap.get(activity.company_id) ||
          (activity.company_id === context.companyId
            ? "Empresa atual"
            : "Empresa"),
        module:
          metadata.module || "dashboard",
        page:
          metadata.page ||
          metadata.route ||
          activity.entity ||
          "Tela não identificada",
        route:
          metadata.route ||
          activity.entity ||
          null,
        duration:
          Number(metadata.duration || 0),
        idle_seconds:
          Number(metadata.idleSeconds || 0),
      };
    });

    const modules = Array.from(
      new Set(
        enrichedActivities
          .map((item: any) => item.module)
          .filter(Boolean)
      )
    ).sort();

    const actions = Array.from(
      new Set(
        enrichedActivities
          .map((item: any) => item.action)
          .filter(Boolean)
      )
    ).sort();

    const availableUsers = Array.from(
      new Map(
        users.map((user: any) => [
          user.user_id,
          {
            user_id: user.user_id,
            name:
              user.name ||
              user.email ||
              "Usuário",
            email: user.email,
          },
        ])
      ).values()
    ).sort((a: any, b: any) =>
      String(a.name).localeCompare(
        String(b.name),
        "pt-BR"
      )
    );

    const totalSeconds = enrichedActivities.reduce(
      (total: number, item: any) =>
        total + Number(item.duration || 0),
      0
    );

    const pagesVisited = enrichedActivities.filter(
      (item: any) =>
        item.action === "page_enter"
    ).length;

    const exits = enrichedActivities.filter(
      (item: any) =>
        item.action === "page_leave"
    ).length;

    return NextResponse.json({
      success: true,
      role: context.role,
      globalAccess: context.globalAccess,
      summary: {
        activities: enrichedActivities.length,
        pagesVisited,
        exits,
        totalSeconds,
      },
      activities: enrichedActivities,
      filters: {
        modules,
        actions,
        users: availableUsers,
        companies,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "[COMMAND CENTER NAVIGATION]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao carregar auditoria de navegação.",
      },
      { status: 500 }
    );
  }
}
