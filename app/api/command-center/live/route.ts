import { NextRequest, NextResponse } from "next/server";

import {
  getCommandCenterAdminClient,
  getCommandCenterContext,
} from "@/lib/command-center-auth";

export const dynamic = "force-dynamic";

function secondsSince(value?: string | null) {
  if (!value) return null;

  const time = new Date(value).getTime();

  if (Number.isNaN(time)) return null;

  return Math.max(0, Math.floor((Date.now() - time) / 1000));
}

function isSessionOnline(
  lastActivity?: string | null,
  online?: boolean | null
) {
  const seconds = secondsSince(lastActivity);

  return Boolean(online) && seconds !== null && seconds <= 90;
}

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
    const requestedCompanyId = params.get("companyId");

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

    const supabase = getCommandCenterAdminClient();

    let sessionsQuery = supabase
      .from("user_sessions")
      .select(
        [
          "id",
          "company_id",
          "branch_id",
          "user_id",
          "login_at",
          "last_activity",
          "logout_at",
          "online",
          "idle_seconds",
          "ip",
          "browser",
          "os",
          "device",
          "screen_width",
          "screen_height",
          "current_module",
          "current_page",
          "current_route",
          "created_at",
          "updated_at",
        ].join(",")
      )
      .is("logout_at", null)
      .order("last_activity", {
        ascending: false,
      })
      .limit(500);

    if (context.globalAccess) {
      if (requestedCompanyId) {
        sessionsQuery = sessionsQuery.eq(
          "company_id",
          requestedCompanyId
        );
      }
    } else {
      sessionsQuery = sessionsQuery.eq(
        "company_id",
        context.companyId
      );
    }

    const { data: sessions, error: sessionsError } =
      await sessionsQuery;

    if (sessionsError) {
      throw new Error(sessionsError.message);
    }

    const companyIds = Array.from(
      new Set(
        (sessions || [])
          .map((session: any) => session.company_id)
          .filter(Boolean)
      )
    );

    const userIds = Array.from(
      new Set(
        (sessions || [])
          .map((session: any) => session.user_id)
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
      let companiesQuery = supabase
        .from("companies")
        .select("id,name")
        .order("name")
        .limit(1000);

      if (requestedCompanyId) {
        companiesQuery = companiesQuery.eq(
          "id",
          requestedCompanyId
        );
      }

      const companiesResult = await companiesQuery;

      if (companiesResult.error) {
        throw new Error(companiesResult.error.message);
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

    const enrichedSessions = (sessions || []).map(
      (session: any) => {
        const user = userMap.get(
          `${session.company_id}:${session.user_id}`
        );

        const lastActivitySeconds = secondsSince(
          session.last_activity
        );

        const online = isSessionOnline(
          session.last_activity,
          session.online
        );

        return {
          ...session,
          online,
          last_activity_seconds:
            lastActivitySeconds,
          user_name:
            user?.name ||
            user?.email ||
            "Usuário não identificado",
          user_email: user?.email || null,
          user_role: user?.role || null,
          company_name:
            companyMap.get(session.company_id) ||
            (session.company_id === context.companyId
              ? "Empresa atual"
              : "Empresa"),
        };
      }
    );

    const latestSessionByUser = new Map<string, any>();

    for (const session of enrichedSessions) {
      const key = `${session.company_id}:${session.user_id}`;
      const current = latestSessionByUser.get(key);

      if (
        !current ||
        new Date(session.last_activity).getTime() >
          new Date(current.last_activity).getTime()
      ) {
        latestSessionByUser.set(key, session);
      }
    }

    const uniqueSessions = Array.from(
      latestSessionByUser.values()
    );

    const onlineUsers = uniqueSessions.filter(
      (session) => session.online
    );

    const idleUsers = onlineUsers.filter(
      (session) =>
        Number(session.idle_seconds || 0) >= 60
    );

    const activeUsers = onlineUsers.filter(
      (session) =>
        Number(session.idle_seconds || 0) < 60
    );

    const modules = uniqueSessions.reduce(
      (
        accumulator: Record<string, number>,
        session: any
      ) => {
        const moduleName =
          session.current_module || "sem_modulo";

        accumulator[moduleName] =
          (accumulator[moduleName] || 0) + 1;

        return accumulator;
      },
      {}
    );

    return NextResponse.json({
      success: true,
      role: context.role,
      globalAccess: context.globalAccess,
      summary: {
        online: onlineUsers.length,
        active: activeUsers.length,
        idle: idleUsers.length,
        sessions: uniqueSessions.length,
      },
      modules,
      sessions: uniqueSessions,
      companies,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "[COMMAND CENTER LIVE]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao carregar usuários online.",
      },
      { status: 500 }
    );
  }
}
