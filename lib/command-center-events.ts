import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { getBranchId, getCompanyId, getUserId } from "@/lib/server-company";

export type CommandCenterEvent = {
  companyId?: string | null;
  branchId?: string | null;
  userId?: string | null;
  module: string;
  entityType: string;
  entityId?: string | null;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  eventKey?: string | null;
  occurredAt?: string | Date;
};

type EmitOptions = {
  request?: NextRequest;
  throwOnError?: boolean;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurada."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getClientIp(request?: NextRequest) {
  if (!request) return null;

  const forwarded = request.headers.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

/**
 * Emite um evento operacional sem bloquear a operação principal por padrão.
 *
 * Uso:
 * await emitCommandCenterEvent({
 *   module: "vagas",
 *   entityType: "Job",
 *   entityId: job.id,
 *   action: "job_created",
 *   description: `Criou a vaga ${job.title}`,
 * }, { request: req });
 */
export async function emitCommandCenterEvent(
  event: CommandCenterEvent,
  options: EmitOptions = {}
) {
  try {
    const request = options.request;

    const [resolvedCompanyId, resolvedBranchId, resolvedUserId] =
      await Promise.all([
        event.companyId ?? getCompanyId(request),
        event.branchId ?? getBranchId(request),
        event.userId ?? getUserId(request),
      ]);

    if (!resolvedCompanyId) {
      throw new Error("Empresa não identificada para o evento.");
    }

    const supabase = getSupabaseAdmin();
    const occurredAt =
      event.occurredAt instanceof Date
        ? event.occurredAt.toISOString()
        : event.occurredAt || new Date().toISOString();

    const { data, error } = await supabase.rpc(
      "command_center_emit_event",
      {
        p_company_id: resolvedCompanyId,
        p_branch_id: resolvedBranchId || null,
        p_user_id: resolvedUserId || null,
        p_module: event.module,
        p_entity_type: event.entityType,
        p_entity_id: event.entityId || null,
        p_action: event.action,
        p_description: event.description,
        p_metadata: event.metadata || {},
        p_old_data: event.oldData || null,
        p_new_data: event.newData || null,
        p_ip_address: getClientIp(request),
        p_user_agent: request?.headers.get("user-agent") || null,
        p_event_key: event.eventKey || null,
        p_source: "application_event_bus",
        p_occurred_at: occurredAt,
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true as const,
      id: data as string,
    };
  } catch (error) {
    console.error("[COMMAND CENTER EVENT BUS]", error);

    if (options.throwOnError) {
      throw error;
    }

    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erro desconhecido.",
    };
  }
}

/**
 * Dispara o evento sem aumentar perceptivelmente o tempo de resposta da API.
 * Útil para eventos não críticos de auditoria e produtividade.
 */
export function emitCommandCenterEventAsync(
  event: CommandCenterEvent,
  options: EmitOptions = {}
) {
  void emitCommandCenterEvent(event, options);
}
