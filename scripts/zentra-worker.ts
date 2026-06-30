import dotenv from "dotenv";
import ws from "ws";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    realtime: {
      transport: ws as any,
    },
  }
);

const WHATSAPP_SERVER =
  process.env.NEXT_PUBLIC_WHATSAPP_SERVER ||
  process.env.WHATSAPP_SERVER ||
  "http://localhost:3011";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  "http://localhost:3000";

const DEFAULT_COMPANY_NAME =
  process.env.RH_COMPANY_NAME ||
  process.env.COMPANY_NAME ||
  "Zentra RH";

const SESSIONS = String(process.env.WHATSAPP_SESSIONS || "1,2,3,4,5")
  .split(",")
  .map((item) => Number(item.trim()))
  .filter(Boolean);

const MAX_PER_DAY = Number(process.env.CRM_MAX_PER_SESSION_DAY || 80);
const DELAY_MIN = Number(process.env.CRM_DELAY_MIN_MS || 120000);
const DELAY_MAX = Number(process.env.CRM_DELAY_MAX_MS || 300000);
const LOOP_DELAY = Number(process.env.CRM_WORKER_LOOP_MS || 10000);

const REMINDER_24H_MINUTES = 24 * 60;
const REMINDER_30M_MINUTES = 30;

type QueueItem = any;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function cleanPhone(value: any) {
  let phone = String(value || "").replace(/\D/g, "");
  if (!phone) return "";
  if (!phone.startsWith("55")) phone = `55${phone}`;
  return phone;
}

function buildSessionId(companyId: string, sessionId: number) {
  return `${companyId}_${sessionId}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  return date.toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function applyVariables(text: string, lead: any, extra: any = {}) {
  const jobTitle = extra?.jobTitle || extra?.title || lead?.job_title || "";
  const scheduleLink = extra?.scheduleLink || extra?.linkAgendamento || extra?.meetingUrl || "";
  const companyName = extra?.companyName || extra?.company || DEFAULT_COMPANY_NAME;

  return String(text || "")
    .replaceAll("{nome}", lead?.name || extra?.name || "")
    .replaceAll("{telefone}", lead?.phone || extra?.phone || "")
    .replaceAll("{vaga}", jobTitle)
    .replaceAll("{cargo}", jobTitle)
    .replaceAll("{empresa}", companyName)
    .replaceAll("{recrutador}", extra?.recruiterName || "")
    .replaceAll("{cidade}", extra?.city || "")
    .replaceAll("{estado}", extra?.state || "")
    .replaceAll("{bairro}", extra?.neighborhood || "")
    .replaceAll("{local}", extra?.location || "")
    .replaceAll("{tipo_contrato}", extra?.contractType || "")
    .replaceAll("{salario}", extra?.salary || "")
    .replaceAll("{horario_trabalho}", extra?.workSchedule || "")
    .replaceAll("{beneficios}", extra?.benefits || "")
    .replaceAll("{descricao_vaga}", extra?.description || "")
    .replaceAll("{data}", extra?.date || "")
    .replaceAll("{horario}", extra?.time || "")
    .replaceAll("{data_entrevista}", extra?.interviewDate || extra?.date || "")
    .replaceAll("{link}", scheduleLink)
    .replaceAll("{link_agendamento}", scheduleLink)
    .replaceAll("{link_entrevista}", scheduleLink)
    .trim();
}

async function getJobContext(companyId: string, jobId?: string | null) {
  if (!jobId) return null;

  const tables = ["Job", "jobs", "rh_jobs"];

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("company_id", companyId)
        .eq("id", jobId)
        .maybeSingle();

      if (!error && data) return data;
    } catch {}
  }

  console.log("Vaga não encontrada no contexto:", jobId);
  return null;
}


function formatMoney(value: any) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return "";

  return number.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getJobSalary(job: any) {
  if (!job) return "";

  if (job.salary) return String(job.salary);
  if (job.salaryRange) return String(job.salaryRange);
  if (job.salary_range) return String(job.salary_range);

  const min = formatMoney(job.salaryMin || job.salary_min);
  const max = formatMoney(job.salaryMax || job.salary_max);

  if (min && max) return `${min} a ${max}`;
  if (min) return `A partir de ${min}`;
  if (max) return `Até ${max}`;

  return "";
}

function getJobLocation(job: any) {
  if (!job) return "";

  return [
    job.neighborhood,
    job.city,
    job.state,
  ]
    .filter(Boolean)
    .join(" / ");
}

function getJobWorkSchedule(job: any) {
  return (
    job?.shift ||
    job?.requirements?.shift ||
    job?.filters?.shift ||
    job?.workSchedule ||
    job?.work_schedule ||
    ""
  );
}

function getJobBenefits(job: any) {
  const value =
    job?.benefits ||
    job?.requirements?.benefits ||
    job?.filters?.benefits ||
    job?.aiCriteria?.benefits ||
    "";

  if (Array.isArray(value)) return value.join(", ");
  return String(value || "");
}

async function getScheduleInfoForJob(companyId: string, jobId?: string | null) {
  if (!jobId) return null;

  const { data, error } = await supabase
    .from("rh_interview_slots")
    .select("token,start_at,status,job_id,title")
    .eq("company_id", companyId)
    .eq("job_id", jobId)
    .eq("status", "available")
    .not("token", "is", null)
    .gte("start_at", new Date().toISOString())
    .order("start_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.log("Erro ao buscar link de agenda:", error.message);
    return null;
  }

  if (!data?.token) return null;

  return {
    slot: data,
    link: `${APP_URL}/agenda/${data.token}`,
    interviewDate: formatDateTime(data.start_at),
  };
}

async function getScheduleLinkForJob(companyId: string, jobId?: string | null) {
  const info = await getScheduleInfoForJob(companyId, jobId);
  return info?.link || "";
}

function defaultTemplate(intent: string, lead: any) {
  const name = lead?.name || "tudo bem";

  const templates: Record<string, string> = {
    RH_ABERTURA: `Olá {nome}, tudo bem? Somos do RH e temos uma oportunidade que pode combinar com seu perfil para a vaga de {vaga}. Podemos falar sobre a vaga?`,
    RH_ENTREVISTA: `Olá {nome}, tudo bem? Gostaríamos de seguir com você para a próxima etapa e agendar uma entrevista. Pode confirmar seu interesse?`,
    RH_REAGENDAMENTO: `Olá {nome}, percebemos que você não conseguiu participar da entrevista. Caso ainda tenha interesse, podemos reagendar um novo horário.`,
    RH_BANCO_TALENTOS: `Olá {nome}, seu perfil continua em nosso banco de talentos. Quando surgir uma nova oportunidade compatível, podemos chamar você novamente.`,
    RH_RELEMBRETE: `Olá {nome}, passando para lembrar sobre sua entrevista. Qualquer dúvida, responda esta mensagem.`,
    FOLLOW_UP: `Olá {nome}, tudo bem? Passando para saber se você ainda tem interesse na oportunidade.`,
    REATIVACAO: `Olá {nome}, temos uma nova oportunidade e seu perfil pode combinar. Podemos conversar?`,
  };

  return applyVariables(templates[intent] || templates.RH_ABERTURA, lead || { name });
}

function intentAliases(intent: string) {
  const normalized = String(intent || "").toUpperCase();

  const aliases: Record<string, string[]> = {
    RH_ABERTURA: ["OPENING", "RH_ABERTURA", "ABERTURA", "DISPARO"],
    OPENING: ["OPENING", "RH_ABERTURA", "ABERTURA", "DISPARO"],
    RH_ENTREVISTA: ["RH_ENTREVISTA", "INTERESSE_ENTREVISTA", "AGENDAMENTO", "MENSAGEM_AGENDAMENTO"],
    QUER_ENTREVISTA: ["RH_ENTREVISTA", "INTERESSE_ENTREVISTA", "AGENDAMENTO", "MENSAGEM_AGENDAMENTO"],
    RH_RELEMBRETE: ["RH_RELEMBRETE", "RH_LEMBRETE_24H", "RH_LEMBRETE_30M"],
    FOLLOW_UP: ["FOLLOW_UP"],
    REATIVACAO: ["REATIVACAO"],
    RH_BANCO_TALENTOS: ["RH_BANCO_TALENTOS"],
  };

  return aliases[normalized] || [normalized];
}

async function getTemplateMessage({
  type,
  intent,
  lead,
  companyId,
  extra = {},
}: {
  type: "campaign" | "ai" | "reminder";
  intent: string;
  lead: any;
  companyId: string;
  extra?: any;
}) {
  const intents = intentAliases(intent);
  const typeToSearch = type === "reminder" ? "campaign" : type;

  let template: any = null;

  const { data, error } = await supabase
    .from("message_templates")
    .select("id, base_message, message, caption, intent, type, active, created_at")
    .eq("company_id", companyId)
    .eq("active", true)
    .eq("type", typeToSearch)
    .in("intent", intents)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.log("Template não encontrado/erro:", error.message);
  }

  template = data || null;

  /*
    Regra de produto:
    No disparo inicial do RH, preferir SEMPRE a mensagem OPENING criada na tela Mensagens.
    Isso evita cair em texto antigo/fallback aleatório.
  */
  if (!template && ["RH_ABERTURA", "OPENING"].includes(String(intent || "").toUpperCase())) {
    const { data: openingTemplate } = await supabase
      .from("message_templates")
      .select("id, base_message, message, caption, intent, type, active, created_at")
      .eq("company_id", companyId)
      .eq("active", true)
      .eq("intent", "OPENING")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    template = openingTemplate || null;
  }

  if (!template) {
    const fallback = defaultTemplate(intent, lead);
    return applyVariables(fallback, lead, extra);
  }

  const base = String(
    template.base_message ||
      template.message ||
      template.caption ||
      ""
  ).trim();

  if (!base) {
    const fallback = defaultTemplate(intent, lead);
    return applyVariables(fallback, lead, extra);
  }

  return applyVariables(base, lead, extra);
}

async function isSessionOnline(sessionId: number, companyId: string) {
  try {
    const finalSessionId = buildSessionId(companyId, sessionId);

    const res = await fetch(`${WHATSAPP_SERVER}/status/${finalSessionId}`, {
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    return data.status === "online" && Boolean(data?.me?.id || data?.me);
  } catch (error: any) {
    console.log("Erro ao consultar status:", error?.message || error);
    return false;
  }
}

async function countSentToday(sessionId: number, companyId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("automation_queue")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("session_id", sessionId)
    .eq("status", "sent")
    .gte("sent_at", today.toISOString());

  if (error) {
    console.log("Erro ao contar envios:", error.message);
    return 0;
  }

  return count || 0;
}

async function getBestSession(companyId: string) {
  const available: { sessionId: number; sentToday: number }[] = [];

  for (const sessionId of SESSIONS) {
    const online = await isSessionOnline(sessionId, companyId);
    if (!online) continue;

    const sentToday = await countSentToday(sessionId, companyId);
    if (sentToday >= MAX_PER_DAY) continue;

    available.push({ sessionId, sentToday });
  }

  if (!available.length) {
    throw new Error("Nenhum WhatsApp online disponível para envio");
  }

  available.sort((a, b) => a.sentToday - b.sentToday);

  return available[0].sessionId;
}

async function resolveSession(item: QueueItem) {
  const requestedSession = Number(item.session_id || 0);

  if (requestedSession > 0) return requestedSession;

  return await getBestSession(item.company_id);
}

async function sendText(sessionId: number, companyId: string, number: string, message: string) {
  const finalSessionId = buildSessionId(companyId, sessionId);

  const res = await fetch(`${WHATSAPP_SERVER}/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId: finalSessionId,
      number,
      message,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.success === false) {
    throw new Error(data?.error || "Erro ao enviar WhatsApp");
  }

  return data;
}

function nextLeadStatus(intent: string) {
  const map: Record<string, string> = {
    RH_ABERTURA: "enviado",
    RH_ENTREVISTA: "quer_agendar_entrevista",
    RH_REAGENDAMENTO: "reagendar_futuro",
    RH_BANCO_TALENTOS: "reagendar_futuro",
    RH_RELEMBRETE: "entrevista_agendada",
    FOLLOW_UP: "campanha",
    REATIVACAO: "reativar_futuro",
  };

  return map[intent] || "enviado";
}

async function markLeadProcessing(item: QueueItem, sessionId: number) {
  if (!item.lead_id) return;

  await supabase
    .from("leads")
    .update({
      campaign_status: "processing",
      campaign_error: null,
      session_id: sessionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.lead_id)
    .eq("company_id", item.company_id);
}

async function markLeadFailed(item: QueueItem, errorMessage: string) {
  if (!item.lead_id) return;

  await supabase
    .from("leads")
    .update({
      campaign_status: "failed",
      campaign_error: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.lead_id)
    .eq("company_id", item.company_id);
}

async function markLeadSent({
  item,
  lead,
  intent,
  sessionId,
  message,
}: {
  item: QueueItem;
  lead: any;
  intent: string;
  sessionId: number;
  message: string;
}) {
  if (!lead?.id) return;

  await supabase
    .from("leads")
    .update({
      status: nextLeadStatus(intent),
      campaign_status: "sent",
      campaign_sent_at: new Date().toISOString(),
      campaign_error: null,
      session_id: sessionId,
      job_id: item.job_id || lead?.job_id || null,
      current_job_id: item.job_id || lead?.current_job_id || lead?.job_id || null,
      batch_id: item.batch_id || lead?.batch_id || null,
      last_message: message,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", lead.id)
    .eq("company_id", item.company_id);

  await supabase.from("messages").insert({
    company_id: item.company_id,
    branch_id: item.branch_id || null,
    lead_id: lead.id,
    direction: "sent",
    topic: "whatsapp",
    extension: "text",
    event: "message_sent",
    content: message,
    payload: {
      source: "automation_queue",
      queue_id: item.id,
      intent,
    },
    created_at: new Date().toISOString(),
  });

  if (item.batch_id) {
    await supabase
      .from("recruitment_batch_candidates")
      .update({
        status: "sent",
        contacted_at: new Date().toISOString(),
      })
      .eq("batch_id", item.batch_id)
      .eq("lead_id", lead.id);

    const { count } = await supabase
      .from("recruitment_batch_candidates")
      .select("*", { count: "exact", head: true })
      .eq("batch_id", item.batch_id)
      .eq("status", "sent");

    await supabase
      .from("recruitment_batches")
      .update({
        status: "sending",
        total_sent: count || 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.batch_id)
      .eq("company_id", item.company_id);
  }
}

async function failQueueItem(item: QueueItem, errorMessage: string) {
  await supabase
    .from("automation_queue")
    .update({
      status: "failed",
      error: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id)
    .eq("company_id", item.company_id);

  await markLeadFailed(item, errorMessage);
}

async function processQueue() {
  const now = new Date().toISOString();

  const { data: items, error } = await supabase
    .from("automation_queue")
    .select(`
      *,
      leads (
        id,
        company_id,
        name,
        phone,
        status,
        session_id,
        ai_paused,
        paused,
        opt_out,
        job_id,
        current_job_id,
        batch_id
      )
    `)
    .eq("status", "pending")
    .eq("paused", false)
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(1);

  if (error) {
    console.error("Erro ao buscar fila:", error.message);
    return;
  }

  if (!items?.length) return;

  const item = items[0];

  try {
    const lead = item.leads;

    if (!item.company_id) throw new Error("Item da fila sem company_id");
    if (lead?.company_id && lead.company_id !== item.company_id) {
      throw new Error("Lead pertence a outra empresa");
    }
    if (item.paused || lead?.paused || lead?.opt_out) {
      throw new Error("Lead ou fila pausada/opt-out");
    }

    const sessionId = await resolveSession(item);
    const phone = cleanPhone(item.phone || lead?.phone || "");
    const intent = String(item.intent || item.type || "RH_ABERTURA").toUpperCase();
    const finalSession = buildSessionId(item.company_id, sessionId);

    if (!SESSIONS.includes(sessionId)) {
      throw new Error(`Sessão inválida: ${sessionId}`);
    }

    if (!phone) throw new Error("Lead sem telefone");

    const online = await isSessionOnline(sessionId, item.company_id);
    if (!online) throw new Error(`WhatsApp ${sessionId} offline | sessão real: ${finalSession}`);

    const sentToday = await countSentToday(sessionId, item.company_id);
    if (sentToday >= MAX_PER_DAY) {
      throw new Error(`WhatsApp ${sessionId} atingiu limite diário de ${MAX_PER_DAY}`);
    }

    const jobId = item.job_id || lead?.current_job_id || lead?.job_id || null;
    const job = await getJobContext(item.company_id, jobId);
    const scheduleInfo = await getScheduleInfoForJob(item.company_id, jobId);
    const scheduleLink = scheduleInfo?.link || "";

    const extra = {
      jobTitle: job?.title || job?.name || item.job_title || "",
      title: job?.title || job?.name || item.job_title || "",
      companyName: DEFAULT_COMPANY_NAME,
      city: job?.city || job?.location_city || "",
      state: job?.state || job?.location_state || "",
      neighborhood: job?.neighborhood || "",
      location: getJobLocation(job),
      contractType: job?.contract_type || job?.contractType || "",
      salary: getJobSalary(job),
      workSchedule: getJobWorkSchedule(job),
      benefits: getJobBenefits(job),
      description: job?.description || job?.details || job?.requirements?.text || "",
      recruiterName: job?.recruiter_name || job?.recruiterName || "",
      scheduleLink,
      linkAgendamento: scheduleLink,
      interviewDate: scheduleInfo?.interviewDate || "",
    };

    const templateMessage = await getTemplateMessage({
      type: "campaign",
      intent,
      lead,
      companyId: item.company_id,
      extra,
    });

    const message =
      templateMessage ||
      applyVariables(String(item.message || ""), lead, extra);

    if (!message?.trim()) throw new Error(`Mensagem vazia para ${intent}`);

    await supabase
      .from("automation_queue")
      .update({
        session_id: sessionId,
        status: "processing",
        attempts: Number(item.attempts || 0) + 1,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id)
      .eq("company_id", item.company_id);

    await markLeadProcessing(item, sessionId);

    console.log(`Enviando ${intent} para ${phone} pelo WhatsApp ${sessionId}`);

    await sendText(sessionId, item.company_id, phone, message);

    await supabase
      .from("automation_queue")
      .update({
        session_id: sessionId,
        status: "sent",
        sent_at: new Date().toISOString(),
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id)
      .eq("company_id", item.company_id);

    await markLeadSent({ item, lead, intent, sessionId, message });

    const delay = randomDelay(DELAY_MIN, DELAY_MAX);
    console.log(`Enviado. Aguardando ${Math.round(delay / 1000)}s`);
    await sleep(delay);
  } catch (error: any) {
    console.error("Erro no item:", error.message);
    await failQueueItem(item, error.message);
  }
}

async function enqueueReminder({
  slot,
  type,
  message,
  scheduledAt,
}: {
  slot: any;
  type: "24h" | "30m";
  message: string;
  scheduledAt: string;
}) {
  const sessionId = Number(process.env.RH_REMINDER_SESSION || slot.session_id || 1);

  const { error } = await supabase.from("automation_queue").insert({
    company_id: slot.company_id,
    branch_id: slot.branch_id || null,
    lead_id: slot.lead_id || null,
    phone: cleanPhone(slot.reserved_phone || ""),
    session_id: sessionId,
    type: "reminder",
    intent: type === "24h" ? "RH_LEMBRETE_24H" : "RH_LEMBRETE_30M",
    message,
    status: "pending",
    paused: false,
    scheduled_at: scheduledAt,
    created_at: new Date().toISOString(),
    attempts: 0,
  });

  if (error) throw new Error(error.message);
}

function buildReminderMessage(slot: any, type: "24h" | "30m") {
  const when = formatDateTime(slot.start_at);
  const prefix =
    type === "24h"
      ? "Lembrete: sua entrevista está chegando."
      : "Lembrete rápido: sua entrevista começa em breve.";

  return `${prefix}

👤 ${slot.reserved_name || "Candidato"}
💼 Vaga: ${slot.title || "Entrevista"}
📅 Horário: ${when}${slot.meeting_url ? `\n🎥 Link: ${slot.meeting_url}` : ""}${slot.location ? `\n📍 Local: ${slot.location}` : ""}

Caso não consiga participar, responda esta mensagem.`;
}

async function processInterviewReminders() {
  const now = new Date();
  const future24hStart = new Date(now.getTime() + (REMINDER_24H_MINUTES - 10) * 60 * 1000);
  const future24hEnd = new Date(now.getTime() + (REMINDER_24H_MINUTES + 10) * 60 * 1000);

  const future30mStart = new Date(now.getTime() + (REMINDER_30M_MINUTES - 5) * 60 * 1000);
  const future30mEnd = new Date(now.getTime() + (REMINDER_30M_MINUTES + 5) * 60 * 1000);

  const { data: slots24 } = await supabase
    .from("rh_interview_slots")
    .select("*")
    .in("status", ["reserved", "confirmed"])
    .not("reserved_phone", "is", null)
    .is("reminder_24h_sent_at", null)
    .gte("start_at", future24hStart.toISOString())
    .lte("start_at", future24hEnd.toISOString())
    .limit(50);

  for (const slot of slots24 || []) {
    try {
      await enqueueReminder({
        slot,
        type: "24h",
        message: buildReminderMessage(slot, "24h"),
        scheduledAt: new Date().toISOString(),
      });

      await supabase
        .from("rh_interview_slots")
        .update({ reminder_24h_sent_at: new Date().toISOString() })
        .eq("id", slot.id);

      console.log("Lembrete 24h enfileirado:", slot.id);
    } catch (error: any) {
      console.log("Erro lembrete 24h:", error.message);
    }
  }

  const { data: slots30 } = await supabase
    .from("rh_interview_slots")
    .select("*")
    .in("status", ["reserved", "confirmed"])
    .not("reserved_phone", "is", null)
    .is("reminder_30m_sent_at", null)
    .gte("start_at", future30mStart.toISOString())
    .lte("start_at", future30mEnd.toISOString())
    .limit(50);

  for (const slot of slots30 || []) {
    try {
      await enqueueReminder({
        slot,
        type: "30m",
        message: buildReminderMessage(slot, "30m"),
        scheduledAt: new Date().toISOString(),
      });

      await supabase
        .from("rh_interview_slots")
        .update({ reminder_30m_sent_at: new Date().toISOString() })
        .eq("id", slot.id);

      console.log("Lembrete 30m enfileirado:", slot.id);
    } catch (error: any) {
      console.log("Erro lembrete 30m:", error.message);
    }
  }
}

async function loop() {
  console.log("Worker Zentra RH iniciado");
  console.log({
    WHATSAPP_SERVER,
    SESSIONS,
    MAX_PER_DAY,
    DELAY_MIN,
    DELAY_MAX,
  });

  while (true) {
    await processQueue();
    await processInterviewReminders();
    await sleep(LOOP_DELAY);
  }
}

loop();
