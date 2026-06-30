import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";

export const dynamic = "force-dynamic";

const WHATSAPP_SERVER =
  process.env.NEXT_PUBLIC_WHATSAPP_SERVER ||
  process.env.WHATSAPP_SERVER ||
  "http://localhost:3011";

const REMINDER_SESSION = Number(process.env.RH_REMINDER_SESSION || 1);

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase não configurado.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function normalizePhone(value: any) {
  const digits = String(value || "").replace(/\D/g, "");

  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;

  return digits;
}

function formatInterviewDate(dateValue: string) {
  const date = new Date(dateValue);

  return date.toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildSession(companyId: string) {
  return `${companyId}_${REMINDER_SESSION}`;
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
  const sessionId = buildSession(companyId);

  const res = await fetch(`${WHATSAPP_SERVER}/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId,
      number: phone,
      phone,
      message,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data?.success === false) {
    throw new Error(data?.error || "Erro ao enviar WhatsApp.");
  }

  return data;
}

function reminderMessage(type: "24h" | "1h", interview: any) {
  const name = interview.candidate_name || "Candidato";
  const job = interview.title || interview.job_title || "vaga";
  const date = formatInterviewDate(interview.start_at || interview.scheduled_at);

  if (type === "24h") {
    return `Olá ${name}, tudo bem?\n\nPassando para lembrar que sua entrevista para a vaga ${job} está marcada para ${date}.\n\nPor favor, confirme sua presença respondendo esta mensagem.`;
  }

  return `Olá ${name}, tudo bem?\n\nSua entrevista para a vaga ${job} será em breve: ${date}.\n\nEstamos te aguardando.`;
}

async function processReminderType({
  supabase,
  companyId,
  type,
  from,
  to,
  marker,
}: {
  supabase: any;
  companyId: string;
  type: "24h" | "1h";
  from: Date;
  to: Date;
  marker: string;
}) {
  const { data: interviews, error } = await supabase
    .from("rh_interviews")
    .select("*")
    .eq("company_id", companyId)
    .in("status", ["scheduled", "confirmed"])
    .gte("start_at", from.toISOString())
    .lte("start_at", to.toISOString())
    .limit(200);

  if (error) throw new Error(error.message);

  let sent = 0;
  let failed = 0;

  for (const interview of interviews || []) {
    const notes = String(interview.notes || "");

    if (notes.includes(marker)) continue;

    const phone = normalizePhone(interview.candidate_phone || interview.phone);

    if (!phone) {
      failed++;
      continue;
    }

    try {
      await sendWhatsapp({
        companyId,
        phone,
        message: reminderMessage(type, interview),
      });

      await supabase
        .from("rh_interviews")
        .update({
          notes: `${notes}\n${marker} ${new Date().toISOString()}`.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", interview.id)
        .eq("company_id", companyId);

      sent++;
    } catch (error) {
      console.error("ERRO LEMBRETE ENTREVISTA:", error);
      failed++;
    }
  }

  return {
    checked: interviews?.length || 0,
    sent,
    failed,
  };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId } = await requireCompany(req);

    const now = new Date();

    const tomorrowStart = new Date(now);
    tomorrowStart.setHours(now.getHours() + 20);

    const tomorrowEnd = new Date(now);
    tomorrowEnd.setHours(now.getHours() + 28);

    const hourStart = new Date(now);
    hourStart.setMinutes(now.getMinutes());

    const hourEnd = new Date(now);
    hourEnd.setMinutes(now.getMinutes() + 90);

    const dayReminder = await processReminderType({
      supabase,
      companyId,
      type: "24h",
      from: tomorrowStart,
      to: tomorrowEnd,
      marker: "[REMINDER_24H_SENT]",
    });

    const hourReminder = await processReminderType({
      supabase,
      companyId,
      type: "1h",
      from: hourStart,
      to: hourEnd,
      marker: "[REMINDER_1H_SENT]",
    });

    return NextResponse.json({
      success: true,
      session: REMINDER_SESSION,
      dayReminder,
      hourReminder,
    });
  } catch (error: any) {
    console.error("POST /api/rh/interviews/reminders:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao processar lembretes." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
