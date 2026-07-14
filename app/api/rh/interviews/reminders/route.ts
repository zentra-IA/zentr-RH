import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WHATSAPP_SERVER =
  process.env.NEXT_PUBLIC_WHATSAPP_SERVER ||
  process.env.WHATSAPP_SERVER ||
  "http://localhost:3011";

const REMINDER_SESSION = Number(process.env.RH_REMINDER_SESSION || 1);
const CRON_SECRET = process.env.CRON_SECRET || "";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase não configurado.");
  }

  return createClient(url, key);
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizePhone(value: unknown) {
  const raw = clean(value);

  if (raw.includes("@lid") || raw.includes("@s.whatsapp.net")) {
    return raw;
  }

  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;

  return digits;
}

function buildSession(companyId: string) {
  return `${companyId}_${REMINDER_SESSION}`;
}

function formatInterviewDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function candidateReminderMessage(
  type: "24h" | "30m",
  slot: any,
  candidate: any
) {
  const name = candidate.name || candidate.candidate_name || "candidato";
  const job = slot.title || slot.job_title || "entrevista";
  const date = formatInterviewDate(slot.start_at);
  const localOrMeet = slot.meeting_url
    ? `\n🎥 Link: ${slot.meeting_url}`
    : slot.location
      ? `\n📍 Local: ${slot.location}`
      : "";

  if (type === "24h") {
    return `Olá ${name}, tudo bem?

📅 Lembrete: sua entrevista para *${job}* está marcada para ${date}.${localOrMeet}

Por favor, confirme sua presença respondendo esta mensagem.`;
  }

  return `Olá ${name}! Sua entrevista para *${job}* começa em aproximadamente 30 minutos.

🕒 Horário: ${date}${localOrMeet}

Estamos te aguardando. Boa entrevista!`;
}

function recruiterReminderMessage(
  type: "24h" | "30m",
  slot: any,
  candidates: any[]
) {
  const names = candidates
    .map((candidate) => candidate.name || candidate.candidate_name)
    .filter(Boolean)
    .slice(0, 15);

  const extra =
    candidates.length > names.length
      ? `\n+ ${candidates.length - names.length} candidato(s)`
      : "";

  return `${type === "24h" ? "📅 Entrevista amanhã" : "⏰ Entrevista em 30 minutos"}

💼 ${slot.title || "Entrevista"}
🕒 ${formatInterviewDate(slot.start_at)}
👥 ${candidates.length} candidato(s)${
    names.length ? `\n• ${names.join("\n• ")}${extra}` : ""
  }${slot.meeting_url ? `\n🎥 ${slot.meeting_url}` : ""}`;
}

async function sendWhatsapp({
  companyId,
  phone,
  message,
}: {
  companyId: string;
  phone: string;
  message: string;
}) {
  const recipient = normalizePhone(phone);

  if (!recipient) {
    return { sent: false, error: "Telefone ausente." };
  }

  const response = await fetch(`${WHATSAPP_SERVER}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyId,
      sessionId: buildSession(companyId),
      number: recipient,
      phone: recipient,
      lid: recipient.includes("@lid") ? recipient : null,
      jid: recipient.includes("@") ? recipient : null,
      message,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.success === false) {
    return {
      sent: false,
      error: data?.error || data?.message || "Falha no envio.",
    };
  }

  return { sent: true, data };
}

function windowFor(type: "24h" | "30m", now = new Date()) {
  const targetMinutes = type === "24h" ? 24 * 60 : 30;
  const tolerance = type === "24h" ? 20 : 10;

  return {
    from: new Date(now.getTime() + (targetMinutes - tolerance) * 60_000),
    to: new Date(now.getTime() + (targetMinutes + tolerance) * 60_000),
  };
}

async function getCandidatesForSlot(supabase: any, slot: any) {
  const agendaType = clean(slot.agenda_type || slot.agendaType || "individual");

  if (agendaType === "shared") {
    const { data, error } = await supabase
      .from("rh_shared_interview_attendees")
      .select("*")
      .eq("company_id", slot.company_id)
      .eq("slot_id", slot.id)
      .in("status", ["confirmed", "reserved", "scheduled"]);

    if (error) throw new Error(error.message);

    return (data || []).map((candidate: any) => ({
      ...candidate,
      candidate_name: candidate.name,
      candidate_phone: candidate.phone,
      source_table: "rh_shared_interview_attendees",
    }));
  }

  if (!slot.reserved_phone && !slot.lead_id) return [];

  return [
    {
      id: slot.lead_id || slot.id,
      lead_id: slot.lead_id || null,
      candidate_name: slot.reserved_name || "Candidato",
      name: slot.reserved_name || "Candidato",
      candidate_phone: slot.reserved_phone || null,
      phone: slot.reserved_phone || null,
      email: slot.reserved_email || null,
      reminder_24h_sent_at: slot.reminder_24h_sent_at,
      reminder_30m_sent_at: slot.reminder_30m_sent_at,
      source_table: "rh_interview_slots",
    },
  ];
}

async function processType({
  supabase,
  companyId,
  type,
}: {
  supabase: any;
  companyId: string;
  type: "24h" | "30m";
}) {
  const { from, to } = windowFor(type);
  const candidateMarker =
    type === "24h" ? "reminder_24h_sent_at" : "reminder_30m_sent_at";
  const recruiterMarker =
    type === "24h"
      ? "recruiter_reminder_24h_sent_at"
      : "recruiter_reminder_30m_sent_at";

  const { data: slots, error } = await supabase
    .from("rh_interview_slots")
    .select("*")
    .eq("company_id", companyId)
    .in("status", ["reserved", "confirmed"])
    .gte("start_at", from.toISOString())
    .lte("start_at", to.toISOString())
    .order("start_at", { ascending: true })
    .limit(300);

  if (error) throw new Error(error.message);

  let candidateSent = 0;
  let candidateFailed = 0;
  let recruiterSent = 0;
  let recruiterFailed = 0;

  for (const slot of slots || []) {
    const candidates = await getCandidatesForSlot(supabase, slot);

    for (const candidate of candidates) {
      if (candidate[candidateMarker]) continue;

      const phone = normalizePhone(
        candidate.candidate_phone ||
          candidate.phone ||
          slot.reserved_phone
      );

      if (!phone) {
        candidateFailed++;
        continue;
      }

      const result = await sendWhatsapp({
        companyId,
        phone,
        message: candidateReminderMessage(type, slot, candidate),
      });

      if (!result.sent) {
        console.error("CANDIDATE REMINDER FAILED:", {
          type,
          slotId: slot.id,
          candidateId: candidate.id,
          error: result.error,
        });
        candidateFailed++;
        continue;
      }

      const sentAt = new Date().toISOString();

      if (candidate.source_table === "rh_shared_interview_attendees") {
        await supabase
          .from("rh_shared_interview_attendees")
          .update({ [candidateMarker]: sentAt, updated_at: sentAt })
          .eq("id", candidate.id)
          .eq("company_id", companyId);
      } else {
        await supabase
          .from("rh_interview_slots")
          .update({ [candidateMarker]: sentAt, updated_at: sentAt })
          .eq("id", slot.id)
          .eq("company_id", companyId);
      }

      candidateSent++;
    }

    if (slot[recruiterMarker] || !normalizePhone(slot.recruiter_phone)) {
      continue;
    }

    const recruiterResult = await sendWhatsapp({
      companyId,
      phone: slot.recruiter_phone,
      message: recruiterReminderMessage(type, slot, candidates),
    });

    if (!recruiterResult.sent) {
      console.error("RECRUITER REMINDER FAILED:", {
        type,
        slotId: slot.id,
        error: recruiterResult.error,
      });
      recruiterFailed++;
      continue;
    }

    const sentAt = new Date().toISOString();

    await supabase
      .from("rh_interview_slots")
      .update({ [recruiterMarker]: sentAt, updated_at: sentAt })
      .eq("id", slot.id)
      .eq("company_id", companyId);

    recruiterSent++;
  }

  return {
    slotsChecked: slots?.length || 0,
    candidateSent,
    candidateFailed,
    recruiterSent,
    recruiterFailed,
  };
}

async function processCompany(supabase: any, companyId: string) {
  const [day, thirtyMinutes] = await Promise.all([
    processType({ supabase, companyId, type: "24h" }),
    processType({ supabase, companyId, type: "30m" }),
  ]);

  return { companyId, day, thirtyMinutes };
}

function isCronRequest(req: NextRequest) {
  if (!CRON_SECRET) return false;

  const authorization = req.headers.get("authorization") || "";
  return authorization === `Bearer ${CRON_SECRET}`;
}

async function run(req: NextRequest) {
  const supabase = getSupabase();

  if (isCronRequest(req)) {
    const { from, to } = windowFor("24h");
    const { data: rows, error } = await supabase
      .from("rh_interview_slots")
      .select("company_id")
      .gte("start_at", new Date(Date.now() + 10 * 60_000).toISOString())
      .lte("start_at", to.toISOString())
      .in("status", ["reserved", "confirmed"])
      .limit(1000);

    if (error) throw new Error(error.message);

    const companyIds = Array.from(
      new Set((rows || []).map((row: any) => clean(row.company_id)).filter(Boolean))
    );

    const results = [];

    for (const companyId of companyIds) {
      results.push(await processCompany(supabase, companyId));
    }

    return NextResponse.json({
      success: true,
      mode: "cron",
      companiesProcessed: companyIds.length,
      results,
    });
  }

  const { companyId } = await requireCompany(req);
  const result = await processCompany(supabase, companyId);

  return NextResponse.json({
    success: true,
    mode: "manual",
    result,
  });
}

export async function GET(req: NextRequest) {
  try {
    return await run(req);
  } catch (error: any) {
    console.error("GET /api/rh/interviews/reminders:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao processar lembretes." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    return await run(req);
  } catch (error: any) {
    console.error("POST /api/rh/interviews/reminders:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao processar lembretes." },
      { status: 500 }
    );
  }
}
