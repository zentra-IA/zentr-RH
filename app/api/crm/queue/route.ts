import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";

export const dynamic = "force-dynamic";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase não configurado.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

const WHATSAPP_SERVER =
  process.env.NEXT_PUBLIC_WHATSAPP_SERVER || "http://localhost:3011";

const SESSIONS = [1, 2, 3, 4, 5];

const MAX_PER_SESSION_DAY = Number(process.env.CRM_MAX_PER_SESSION_DAY || 80);

const ALLOWED_INTENTS = [
  "RH_ABERTURA",
  "RH_ENTREVISTA",
  "RH_RELEMBRETE",
  "RH_REAGENDAMENTO",
  "RH_BANCO_TALENTOS",

  "OPENING",
  "REATIVACAO",
  "POS_VENDA",
  "RECUPERACAO",
  "CARDAPIO",
  "PROMOCAO",
  "PEDIDO",
  "ENTREGA",
  "PAGAMENTO",
  "HORARIO",
  "ENDERECO",
];

const BLOCKED_LEAD_STATUSES = [
  "entrevista_agendada",
  "entrevista_confirmada",
  "entrevista_realizada",
  "aprovado",
  "approved",
  "contratado",
  "hired",
  "reprovado",
  "rejected",
  "nao_aprovado",
  "nao_compareceu",
  "sem_interesse",
  "finalizado",
];

const PRESERVE_STATUSES = [
  "entrevista_agendada",
  "entrevista_confirmada",
  "entrevista_realizada",
  "aprovado",
  "approved",
  "contratado",
  "hired",
];

function clean(value: any) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function buildSessionId(companyId: string, sessionId: number) {
  return `${companyId}_${sessionId}`;
}

async function isSessionOnline(companyId: string, sessionId: number) {
  try {
    const finalSessionId = buildSessionId(companyId, sessionId);

    const res = await fetch(`${WHATSAPP_SERVER}/status/${finalSessionId}`, {
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    return data.status === "online" && Boolean(data?.me?.id || data?.me);
  } catch {
    return false;
  }
}

async function countSentToday(
  supabase: any,
  companyId: string,
  sessionId: number
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("automation_queue")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("session_id", sessionId)
    .eq("status", "sent")
    .gte("sent_at", today.toISOString());

  return count || 0;
}

async function getSessionStats(supabase: any, companyId: string) {
  const stats: Record<number, any> = {};

  for (const sessionId of SESSIONS) {
    const [online, used] = await Promise.all([
      isSessionOnline(companyId, sessionId),
      countSentToday(supabase, companyId, sessionId),
    ]);

    stats[sessionId] = {
      online,
      used,
      remaining: Math.max(0, MAX_PER_SESSION_DAY - used),
      limit: MAX_PER_SESSION_DAY,
    };
  }

  return stats;
}

async function chooseBestSession(supabase: any, companyId: string) {
  const stats = await getSessionStats(supabase, companyId);

  const available = Object.entries(stats)
    .map(([sessionId, data]) => ({
      sessionId: Number(sessionId),
      ...data,
    }))
    .filter((item) => item.online && item.remaining > 0)
    .sort((a, b) => {
      if (b.remaining !== a.remaining) return b.remaining - a.remaining;
      return a.used - b.used;
    });

  return available[0]?.sessionId || null;
}

function normalizePhone(value: any) {
  const phone = String(value || "").replace(/\D/g, "");

  if (!phone) return null;
  if (phone.startsWith("55")) return phone;
  if (phone.length === 10 || phone.length === 11) return `55${phone}`;

  return phone;
}

function normalizeIntent(value: any) {
  const intent = String(value || "RH_ABERTURA").trim();

  if (intent === "OPENING") return "RH_ABERTURA";

  return ALLOWED_INTENTS.includes(intent) ? intent : "RH_ABERTURA";
}

function nextSafeScheduleDate() {
  const seconds = 25 + Math.floor(Math.random() * 55);
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function statusByIntent(intent: string) {
  if (intent === "RH_ABERTURA" || intent === "OPENING") return "enviado";
  if (intent === "RH_ENTREVISTA") return "quer_agendar_entrevista";
  if (intent === "RH_REAGENDAMENTO") return "reagendar_futuro";
  if (intent === "RH_BANCO_TALENTOS") return "reagendar_futuro";
  return "campanha";
}

function isBlockedLead(lead: any) {
  const status = String(lead?.status || "").toLowerCase();

  return (
    lead?.paused === true ||
    BLOCKED_LEAD_STATUSES.includes(status)
  );
}

async function hasActiveQueueItem({
  supabase,
  companyId,
  leadId,
  intent,
}: {
  supabase: any;
  companyId: string;
  leadId: string;
  intent: string;
}) {
  const { data, error } = await supabase
    .from("automation_queue")
    .select("id,status")
    .eq("company_id", companyId)
    .eq("lead_id", leadId)
    .eq("intent", intent)
    .in("status", ["pending", "paused", "processing"])
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("QUEUE DUPLICATE CHECK ERROR:", error);
    return null;
  }

  return data || null;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId } = await requireCompany(req);

    const stats = await getSessionStats(supabase, companyId);

    const { count: pending } = await supabase
      .from("automation_queue")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "pending");

    const { count: paused } = await supabase
      .from("automation_queue")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "paused");

    return NextResponse.json({
      success: true,
      antiban: {
        maxPerSessionDay: MAX_PER_SESSION_DAY,
        sessions: SESSIONS,
      },
      pending: pending || 0,
      paused: paused || 0,
      stats,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao carregar status da fila" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId, branchId } = await requireCompany(req);
    const body = await req.json();

    const leadId = clean(body?.lead_id || body?.leadId);
    const intent = normalizeIntent(body?.intent);

    const requestedSessionId = Number(body?.session_id ?? body?.sessionId ?? 0);

    if (!leadId) {
      return NextResponse.json(
        { error: "lead_id é obrigatório" },
        { status: 400 }
      );
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (leadError) throw new Error(leadError.message);

    if (!lead) {
      return NextResponse.json(
        { error: "Contato não encontrado nesta empresa" },
        { status: 404 }
      );
    }

    if (isBlockedLead(lead)) {
      return NextResponse.json(
        {
          success: false,
          blocked: true,
          status: lead.status,
          ai_paused: lead.ai_paused === true,
          paused: lead.paused === true,
          error:
            "Este candidato já está em outra etapa do processo seletivo ou está com IA pausada. Não pode entrar novamente na fila.",
        },
        { status: 409 }
      );
    }

    const phone = normalizePhone(lead.phone || lead.telefone || lead.mobile);

    if (!phone) {
      return NextResponse.json(
        { error: "Contato sem telefone" },
        { status: 400 }
      );
    }

    const existingQueue = await hasActiveQueueItem({
      supabase,
      companyId,
      leadId: lead.id,
      intent,
    });

    if (existingQueue?.id) {
      return NextResponse.json(
        {
          success: false,
          duplicated: true,
          item: existingQueue,
          error: "Este candidato já possui um disparo ativo na fila.",
        },
        { status: 409 }
      );
    }

    let finalSessionId =
      Number.isNaN(requestedSessionId) || requestedSessionId < 0
        ? 0
        : requestedSessionId;

    const smartDispatch = finalSessionId === 0;

    if (smartDispatch) {
      const bestSession = await chooseBestSession(supabase, companyId);

      if (!bestSession) {
        return NextResponse.json(
          {
            error:
              "Nenhum WhatsApp online com limite disponível hoje. Conecte uma sessão ou aguarde o limite diário.",
          },
          { status: 429 }
        );
      }

      finalSessionId = bestSession;
    } else {
      if (!SESSIONS.includes(finalSessionId)) {
        return NextResponse.json(
          { error: "Sessão inválida." },
          { status: 400 }
        );
      }

      const [online, used] = await Promise.all([
        isSessionOnline(companyId, finalSessionId),
        countSentToday(supabase, companyId, finalSessionId),
      ]);

      if (!online) {
        return NextResponse.json(
          { error: `WhatsApp ${finalSessionId} não está online.` },
          { status: 400 }
        );
      }

      if (used >= MAX_PER_SESSION_DAY) {
        return NextResponse.json(
          {
            error: `WhatsApp ${finalSessionId} atingiu o limite diário de ${MAX_PER_SESSION_DAY} disparos.`,
          },
          { status: 429 }
        );
      }
    }

    const jobId =
      clean(body?.job_id || body?.jobId || lead.job_id || lead.current_job_id) ||
      null;

    const batchId =
      clean(body?.batch_id || body?.batchId || lead.batch_id) || null;

    const { data: item, error: queueError } = await supabase
      .from("automation_queue")
      .insert({
        company_id: companyId,
        branch_id: branchId || lead.branch_id || null,
        lead_id: lead.id,
        phone,
        session_id: finalSessionId,
        type: "campaign",
        intent,
        status: "pending",
        scheduled_at: nextSafeScheduleDate(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        attempts: 0,
        error: null,
        job_id: jobId,
        batch_id: batchId,
      })
      .select("*")
      .single();

    if (queueError) throw new Error(queueError.message);

    const currentStatus = String(lead.status || "").toLowerCase();

    const nextStatus = PRESERVE_STATUSES.includes(currentStatus)
      ? lead.status
      : statusByIntent(intent);

    const leadUpdate: any = {
      status: nextStatus,
      conversation_stage: intent,
      campaign_status: "pending",
      campaign_error: null,
      campaign_sent_at: null,
      updated_at: new Date().toISOString(),
    };

    if (jobId) {
      leadUpdate.job_id = jobId;
      leadUpdate.current_job_id = jobId;
    }

    if (batchId) {
      leadUpdate.batch_id = batchId;
    }

    await supabase
      .from("leads")
      .update(leadUpdate)
      .eq("id", lead.id)
      .eq("company_id", companyId);

    return NextResponse.json({
      success: true,
      smart_dispatch: smartDispatch,
      selected_session_id: finalSessionId,
      max_per_session_day: MAX_PER_SESSION_DAY,
      item,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao adicionar na fila" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId } = await requireCompany(req);
    const body = await req.json();

    const action = String(body?.action || "").trim();

    if (!["pause", "resume"].includes(action)) {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }

    const currentStatus = action === "pause" ? "pending" : "paused";
    const nextStatus = action === "pause" ? "paused" : "pending";

    const { data, error } = await supabase
      .from("automation_queue")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", companyId)
      .eq("status", currentStatus)
      .select("id");

    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      updated: data?.length || 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar fila" },
      { status: 500 }
    );
  }
}
