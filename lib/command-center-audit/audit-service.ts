import { createClient } from "@supabase/supabase-js";

export interface AuditLogInput {
  companyId: string;
  branchId?: string | null;

  userId: string;

  sessionId?: string | null;

  module: string;

  page?: string;

  route?: string;

  action: string;

  entityType?: string;

  entityId?: string;

  entityName?: string;

  description?: string;

  status?: string;

  before?: Record<string, any> | null;

  after?: Record<string, any> | null;

  metadata?: Record<string, any>;

  ip?: string;

  browser?: string;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class AuditService {
  async log(data: AuditLogInput) {
    //--------------------------------------------------------
    // 1) Cria atividade
    //--------------------------------------------------------

    const { data: activity, error } = await supabase
      .from("user_activity")
      .insert({
        company_id: data.companyId,

        branch_id: data.branchId,

        session_id: data.sessionId,

        user_id: data.userId,

        module: data.module,

        page: data.page,

        route: data.route,

        action: data.action,

        entity_type: data.entityType,

        entity_id: data.entityId,

        entity_name: data.entityName,

        description: data.description,

        status: data.status,

        metadata: data.metadata,

        ip: data.ip,

        browser: data.browser,
      })
      .select()
      .single();

    if (error) throw error;

    //--------------------------------------------------------
    // 2) Salva diferenças
    //--------------------------------------------------------

    if (data.before && data.after) {
      const changes: any[] = [];

      const keys = new Set([
        ...Object.keys(data.before),
        ...Object.keys(data.after),
      ]);

      for (const key of keys) {
        const oldValue = data.before[key];

        const newValue = data.after[key];

        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          changes.push({
            activity_id: activity.id,

            field_name: key,

            old_value:
              oldValue === undefined
                ? null
                : JSON.stringify(oldValue),

            new_value:
              newValue === undefined
                ? null
                : JSON.stringify(newValue),
          });
        }
      }

      if (changes.length) {
        await supabase
          .from("activity_changes")
          .insert(changes);
      }
    }

    //--------------------------------------------------------
    // 3) Alimenta Event Bus
    //--------------------------------------------------------

    await supabase.rpc(
      "command_center_emit_event",
      {
        p_company_id: data.companyId,

        p_branch_id: data.branchId,

        p_user_id: data.userId,

        p_module: data.module,

        p_entity_type: data.entityType,

        p_entity_id: data.entityId,

        p_action: data.action,

        p_description: data.description,

        p_metadata: {
          activityId: activity.id,

          entityName: data.entityName,

          status: data.status,
        },

        p_source: "audit_service",
      }
    );

    return activity;
  }
}

export const audit = new AuditService();