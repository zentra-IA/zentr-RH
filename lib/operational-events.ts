import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { auditLog } from "@/lib/audit";

export type OperationalEventInput = {
  companyId: string;
  branchId?: string | null;
  userId?: string | null;
  module: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityName?: string | null;
  description: string;
  status?: string | null;
  responsibleUserId?: string | null;
  responsibleName?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  eventKey?: string | null;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase não configurado para eventos operacionais.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getClientIp(request?: NextRequest) {
  const forwarded = request?.headers.get("x-forwarded-for");

  return (
    forwarded?.split(",")[0]?.trim() ||
    request?.headers.get("x-real-ip") ||
    null
  );
}

function serialize(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return JSON.parse(JSON.stringify(value));
}

export async function emitOperationalEvent(
  input: OperationalEventInput,
  request?: NextRequest
) {
  const metadata = {
    entityName: input.entityName || null,
    status: input.status || null,
    responsibleUserId: input.responsibleUserId || null,
    responsibleName: input.responsibleName || null,
    route: request?.nextUrl.pathname || null,
    method: request?.method || null,
    source: "zentra_operational_event_bus",
    recordedAt: new Date().toISOString(),
    ...(input.metadata || {}),
  };

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.rpc("command_center_emit_event", {
      p_company_id: input.companyId,
      p_branch_id: input.branchId || null,
      p_user_id: input.userId || null,
      p_module: input.module,
      p_entity_type: input.entityType,
      p_entity_id: input.entityId || null,
      p_action: input.action,
      p_description: input.description,
      p_metadata: metadata,
      p_old_data: serialize(input.before),
      p_new_data: serialize(input.after),
      p_ip_address: getClientIp(request),
      p_user_agent: request?.headers.get("user-agent") || null,
      p_event_key: input.eventKey || null,
      p_source: "zentra_operational_event_bus",
      p_occurred_at: new Date().toISOString(),
    });

    if (error) throw new Error(error.message);

    await auditLog({
      companyId: input.companyId,
      userId: input.userId || null,
      action: input.action,
      entity: input.entityId || input.entityType,
      metadata,
    });

    return { success: true as const, eventId: data as string };
  } catch (error) {
    console.error("[ZENTRA OPERATIONAL EVENT]", error);

    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erro desconhecido.",
    };
  }
}

export function emitOperationalEventAsync(
  input: OperationalEventInput,
  request?: NextRequest
) {
  void emitOperationalEvent(input, request);
}
