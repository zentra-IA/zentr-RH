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

const MAX_PER_SESSION_DAY = Number(process.env.CRM_MAX_PER_SESSION_DAY || 80);

type CampaignConfig = {
  label: string;
  statuses: string[];
  intent: string;
  nextStatus: string;
};

const CAMPAIGN_TYPES: Record<string, CampaignConfig> = {
  NAO_RESPONDEU: {
    label: "Não respondeu",
    statuses: ["enviado", "campanha"],
    intent: "RH_ABERTURA",
    nextStatus: "campanha",
  },
  AGENDOU_NAO_COMPARECEU: {
    label: "Agendou e não participou",
    statuses: ["no_show", "nao_compareceu", "faltou"],
    intent: "RH_REAGENDAMENTO",
    nextStatus: "reagendar_futuro",
  },
  NAO_APROVADO: {
    label: "Não aprovado",
    statuses: ["nao_aprovado", "reprovado", "rejected"],
    intent: "RH_BANCO_TALENTOS",
    nextStatus: "reagendar_futuro",
  },
  BANCO_TALENTOS: {
    label: "Banco de talentos",
    statuses: ["reagendar_futuro", "banco_talentos"],
    intent: "RH_BANCO_TALENTOS",
    nextStatus: "reagendar_futuro",
  },
  REAGENDAR_ENTREVISTA: {
    label: "Reagendar entrevista",
    statuses: ["quer_agendar_entrevista", "entrevista_agendada", "reschedule"],
    intent: "RH_REAGENDAMENTO",
    nextStatus: "quer_agendar_entrevista",
  },
  CONVOCACAO_ENTREVISTA: {
    label: "Convocação para entrevista",
    statuses: ["respondeu", "respondido", "quer_agendar_entrevista"],
    intent: "RH_ENTREVISTA",
    nextStatus: "quer_agendar_entrevista",
  },
  FOLLOW_UP_POS_ENTREVISTA: {
    label: "Follow-up pós-entrevista",
    statuses: ["done", "entrevistado", "approved", "aprovado"],
    intent: "RH_RELEMBRETE",
    nextStatus: "campanha",
  },
  CONTRATACAO_URGENTE: {
    label: "Contratação urgente",
    statuses: ["novo", "respondeu", "respondido", "quer_agendar_entrevista"],
    intent: "RH_ENTREVISTA",
    nextStatus: "quer_agendar_entrevista",
  },
};

function randomDelay(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizePhone(value: any) {
  const digits = String(value || "").replace(/\D/g, "");

  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;

  return digits;
}

function getLastDate(lead: any) {
  return lead.last_message_at || lead.updated_at || lead.created_at;
}

function daysStopped(lead: any) {
  const date = getLastDate(lead);
  if (!date) return 0;

  const diff = Date.now() - new Date(date).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function getCampaign(type: string) {
  return CAMPAIGN_TYPES[type] || CAMPAIGN_TYPES.NAO_RESPONDEU;
}

async function countSessionToday(supabase: any, companyId: string, session: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("automation_queue")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("session_id", session)
    .in("status", ["pending", "sent"])
    .gte("scheduled_at", today.toISOString());

  return count || 0;
}

function eligibleFilter(lead: any, sessions: number[], targetDays: number) {
  const phone = normalizePhone(lead.phone || lead.telefone || lead.mobile);

  if (!phone) return false;
  if (lead.ai_paused === true) return false;
  if (lead.paused === true) return false;

  if (sessions.length) {
    const session = Number(lead.session_id || 1);
    if (!sessions.includes(session)) return false;
  }

  if (targetDays > 0 && daysStopped(lead) < targetDays) return false;

  return true;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId } = await await requireCompany(req);
    const { searchParams } = new URL(req.url);

    const type = String(searchParams.get("type") || "NAO_RESPONDEU");
    const targetDays = Number(searchParams.get("targetDays") || 1);
    const sessions = String(searchParams.get("sessions") || "1,2,3,4,5")
      .split(",")
      .map(Number)
      .filter(Boolean);

    const campaign = getCampaign(type);

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("company_id", companyId)
      .in("status", campaign.statuses)
      .order("updated_at", { ascending: true })
      .limit(500);

    if (error) throw new Error(error.message);

    const leads = (data || [])
      .filter((lead: any) => eligibleFilter(lead, sessions, targetDays))
      .slice(0, 300);

    return NextResponse.json({
      success: true,
      type,
      label: campaign.label,
      statuses: campaign.statuses,
      leads,
      count: leads.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao carregar campanha" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId, branchId } = await await requireCompany(req);
    const body = await req.json();

    const campaignType = String(body.campaignType || "NAO_RESPONDEU");
    const targetDays = Number(body.targetDays || 1);
    const selectedWpp: number[] = Array.isArray(body.selectedWpp)
      ? body.selectedWpp.map(Number).filter(Boolean)
      : [1, 2, 3, 4, 5];

    const campaignConfig = getCampaign(campaignType);

    const { data: leads, error } = await supabase
      .from("leads")
      .select("*")
      .eq("company_id", companyId)
      .in("status", campaignConfig.statuses)
      .order("updated_at", { ascending: true })
      .limit(1000);

    if (error) throw new Error(error.message);

    const eligible = (leads || []).filter((lead: any) =>
      eligibleFilter(lead, selectedWpp, targetDays)
    );

    if (!eligible.length) {
      return NextResponse.json(
        { error: "Nenhum candidato elegível para esta campanha" },
        { status: 400 }
      );
    }

    const { data: campaign } = await supabase
      .from("promotion_campaigns")
      .insert({
        company_id: companyId,
        branch_id: branchId || null,
        message: campaignConfig.label,
        whatsapp_accounts: selectedWpp,
        status: "running",
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    let queued = 0;
    let scheduledAt = new Date();

    for (const lead of eligible) {
      const session = Number(lead.session_id || selectedWpp[queued % selectedWpp.length] || 1);

      if (!selectedWpp.includes(session)) continue;

      const usedToday = await countSessionToday(supabase, companyId, session);

      if (usedToday >= MAX_PER_SESSION_DAY) continue;

      const phone = normalizePhone(lead.phone || lead.telefone || lead.mobile);

      const { error: queueError } = await supabase
        .from("automation_queue")
        .insert({
          company_id: companyId,
          branch_id: branchId || null,
          lead_id: lead.id,
          phone,
          session_id: session,
          campaign_id: campaign?.id || null,
          type: "campaign",
          intent: campaignConfig.intent,
          status: "pending",
          paused: false,
          scheduled_at: scheduledAt.toISOString(),
          created_at: new Date().toISOString(),
          attempts: 0,
        });

      if (!queueError) {
        queued++;

        await supabase
          .from("leads")
          .update({
            status: campaignConfig.nextStatus,
            conversation_stage: campaignConfig.intent,
            campaign_status: "pending",
            campaign_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", lead.id)
          .eq("company_id", companyId);

        scheduledAt = new Date(
          scheduledAt.getTime() + randomDelay(120000, 300000)
        );
      }
    }

    return NextResponse.json({
      success: true,
      queued,
      campaign,
      intent: campaignConfig.intent,
      nextStatus: campaignConfig.nextStatus,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao iniciar campanha" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId } = await await requireCompany(req);
    const body = await req.json();

    const action = String(body.action || "");

    if (!["pause", "resume"].includes(action)) {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }

    const currentStatus = action === "pause" ? "pending" : "paused";
    const nextStatus = action === "pause" ? "paused" : "pending";

    const { data, error } = await supabase
      .from("automation_queue")
      .update({
        status: nextStatus,
        paused: action === "pause",
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
      { error: error?.message || "Erro ao atualizar campanha" },
      { status: 500 }
    );
  }
}
