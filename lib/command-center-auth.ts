import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export type CommandCenterRole = "admin" | "administrador";

export type CommandCenterContext = {
  userId: string;
  companyId: string;
  branchId: string | null;
  role: CommandCenterRole;
  globalAccess: boolean;
};

/**
 * Cria o cliente administrativo do Supabase.
 *
 * IMPORTANTE:
 * - Use apenas no backend.
 * - Nunca importe este arquivo em componentes client-side.
 * - A SUPABASE_SERVICE_ROLE_KEY não pode ser exposta no navegador.
 */
function createCommandCenterAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "Variável NEXT_PUBLIC_SUPABASE_URL não configurada."
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Variável SUPABASE_SERVICE_ROLE_KEY não configurada."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Export usado pelas rotas do Centro de Comando.
 */
export function getCommandCenterAdminClient() {
  return createCommandCenterAdminClient();
}

/**
 * Recupera o usuário, empresa e papel atual a partir dos cookies do Zentra RH.
 *
 * Regras:
 * - admin: acesso global a todas as empresas.
 * - administrador: acesso somente à própria empresa.
 * - outros papéis: sem acesso ao Centro de Comando.
 */
export async function getCommandCenterContext(): Promise<CommandCenterContext | null> {
  const cookieStore = await cookies();

  const userId =
    cookieStore.get("zentra_user_id")?.value ||
    cookieStore.get("user_id")?.value ||
    null;

  const companyId =
    cookieStore.get("zentra_company_id")?.value ||
    cookieStore.get("company_id")?.value ||
    null;

  const branchId =
    cookieStore.get("zentra_branch_id")?.value ||
    cookieStore.get("branch_id")?.value ||
    null;

  if (!userId || !companyId) {
    return null;
  }

  const supabase = createCommandCenterAdminClient();

  const { data: membership, error } = await supabase
    .from("company_users")
    .select("user_id, company_id, role, active")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    console.error(
      "[COMMAND CENTER AUTH] Erro ao consultar usuário:",
      error
    );

    return null;
  }

  if (!membership || membership.active === false) {
    return null;
  }

  const normalizedRole = String(membership.role || "")
    .toLowerCase()
    .trim();

  if (
    normalizedRole !== "admin" &&
    normalizedRole !== "administrador"
  ) {
    return null;
  }

  return {
    userId,
    companyId,
    branchId,
    role: normalizedRole as CommandCenterRole,
    globalAccess: normalizedRole === "admin",
  };
}

/**
 * Aplica o escopo de empresa nas consultas do Centro de Comando.
 *
 * - admin: mantém a consulta global.
 * - administrador: adiciona company_id = empresa atual.
 *
 * Compatível com os builders do Supabase usados nas APIs.
 */
export function applyCommandCenterCompanyScope<T>(
  query: T,
  context: CommandCenterContext
): T {
  if (context.globalAccess) {
    return query;
  }

  return (query as T & {
    eq: (column: string, value: string) => T;
  }).eq("company_id", context.companyId);
}
