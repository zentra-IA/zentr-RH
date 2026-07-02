import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const WHATSAPP_SERVER =
  process.env.NEXT_PUBLIC_WHATSAPP_SERVER ||
  process.env.WHATSAPP_SERVER ||
  "http://localhost:3011";

const RH_REMINDER_SESSION = Number(process.env.RH_REMINDER_SESSION || 1);

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase não configurado.");
  }

  return createClient(url, key);
}

function clean(value: any) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizePhone(value: any) {
  const digits = clean(value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function normalizeWhatsappRecipient(value: any) {
  const raw = clean(value);
  if (raw.includes("@lid") || raw.includes("@s.whatsapp.net")) return raw;
  return normalizePhone(raw);
}

function normalizeText(value: any) {
  return clean(value).toLowerCase();
}

function buildSession(companyId: string) {
  return `${companyId}_${RH_REMINDER_SESSION}`;
}

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  );
}

function publicSharedAgendaLink(slot: any) {
  return `${appBaseUrl()}/agenda-compartilhada/${slot.token}`;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function safeSendWhatsapp({
  companyId,
  phone,
  message,
}: {
  companyId: string;
  phone: string;
  message: string;
}) {
  const finalPhone = normalizeWhatsappRecipient(phone);

  if (!WHATSAPP_SERVER || !finalPhone) {
    return { sent: false, error: "WhatsApp server ou telefone ausente." };
  }

  try {
    const res = await fetch(`${WHATSAPP_SERVER}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: buildSession(companyId),
        number: finalPhone,
        phone: finalPhone,
        message,
      }),
    });

    const text = await res.text();
    let data: any = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!res.ok || data?.success === false) {
      return {
        sent: false,
        error: data?.error || data?.message || "Falha ao enviar WhatsApp.",
      };
    }

    return { sent: true, data };
  } catch (error: any) {
    console.error("WHATSAPP SEND FAILED:", error);
    return { sent: false, error: error?.message || "fetch failed" };
  }
}

async function getSlotByToken(supabase: any, token: string) {
  if (!token) return null;

  const { data, error } = await supabase
    .from("rh_interview_slots")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data || null;
}

async function countSharedAttendees(supabase: any, slotId: string) {
  const { count, error } = await supabase
    .from("rh_shared_interview_attendees")
    .select("id", { count: "exact", head: true })
    .eq("slot_id", slotId)
    .neq("status", "cancelled");

  if (error) {
    console.error("COUNT SHARED ATTENDEES ERROR:", error);
    return 0;
  }

  return count || 0;
}

async function attachCounts(supabase: any, slots: any[]) {
  if (!slots.length) return [];

  const ids = slots.map((slot) => slot.id).filter(Boolean);

  const { data, error } = await supabase
    .from("rh_shared_interview_attendees")
    .select("slot_id,status")
    .in("slot_id", ids);

  if (error) {
    console.error("ATTACH SHARED COUNTS ERROR:", error);
    return slots;
  }

  const counts = new Map<string, number>();

  for (const row of data || []) {
    if (String(row.status || "").toLowerCase() === "cancelled") continue;
    counts.set(row.slot_id, (counts.get(row.slot_id) || 0) + 1);
  }

  return slots.map((slot) => ({
    ...slot,
    confirmed_count: counts.get(slot.id) || 0,
    reserved_count: counts.get(slot.id) || Number(slot.reserved_count || 0),
  }));
}

async function findLeadByPhoneOrEmail({
  supabase,
  companyId,
  phone,
  email,
}: {
  supabase: any;
  companyId: string;
  phone?: string | null;
  email?: string | null;
}) {
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = normalizeText(email);

  if (!normalizedPhone && !normalizedEmail) return null;

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("company_id", companyId)
    .limit(1000);

  if (error) {
    console.error("FIND LEAD SHARED ERROR:", error);
    return null;
  }

  return (
    (data || []).find((lead: any) => {
      const phones = [
        lead.phone,
        lead.telefone,
        lead.celular,
        lead.whatsapp,
        lead.remote_jid,
        lead.remoteJid,
      ]
        .map(normalizePhone)
        .filter(Boolean);

      const emails = [
        lead.email,
        lead.e_mail,
        lead["e-mail"],
        lead.candidate_email,
      ]
        .map(normalizeText)
        .filter(Boolean);

      return (
        (normalizedPhone && phones.includes(normalizedPhone)) ||
        (normalizedEmail && emails.includes(normalizedEmail))
      );
    }) || null
  );
}

async function updateLeadAsScheduled({
  supabase,
  lead,
  slot,
  name,
  phone,
  email,
}: {
  supabase: any;
  lead: any;
  slot: any;
  name: string;
  phone: string;
  email: string;
}) {
  if (!lead?.id) return null;

  const update: any = {
    status: "entrevista_agendada",
    ai_paused: true,
    paused: true,
    unread_count: 0,
    job_id: slot.job_id || lead.job_id || null,
    current_job_id: slot.job_id || lead.current_job_id || lead.job_id || null,
    batch_id: slot.batch_id || lead.batch_id || null,
    updated_at: new Date().toISOString(),
  };

  if (name) update.name = name;
  if (phone) update.phone = phone;
  if (email) update.email = email;

  const { data, error } = await supabase
    .from("leads")
    .update(update)
    .eq("id", lead.id)
    .eq("company_id", slot.company_id)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("UPDATE LEAD SHARED BOOK ERROR:", error);
    return lead;
  }

  return data || lead;
}

function candidateConfirmationMessage(slot: any, attendee: any) {
  const localOrMeet = slot.meeting_url
    ? `🎥 Link da entrevista: ${slot.meeting_url}`
    : slot.location
      ? `📍 Local: ${slot.location}`
      : "";

  return `🎉 *Sua entrevista foi confirmada!*

Olá ${attendee.name || "candidato"}, tudo certo?

💼 Vaga: ${slot.title || "Entrevista"}
📅 Data: ${formatDate(slot.start_at)}
🕒 Horário: ${formatTime(slot.start_at)}${localOrMeet ? `\n${localOrMeet}` : ""}

Essa é uma entrevista compartilhada. Chegue no horário combinado e aguarde as orientações da recrutadora.

Boa sorte! 🍀`;
}

function recruiterConfirmationMessage(slot: any, attendee: any) {
  return `✅ Novo candidato confirmou presença na entrevista compartilhada.

👤 Candidato: ${attendee.name || "Candidato"}
📞 Telefone: ${attendee.phone || "-"}
📧 E-mail: ${attendee.email || "-"}
💼 Vaga: ${slot.title || "Entrevista"}
📅 Horário: ${formatDate(slot.start_at)} às ${formatTime(slot.start_at)}${slot.meeting_url ? `\n🎥 Link: ${slot.meeting_url}` : ""}`;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);
    const token = clean(searchParams.get("token"));

    if (!token) {
      return NextResponse.json({ error: "Token obrigatório." }, { status: 400 });
    }

    const slot = await getSlotByToken(supabase, token);

    if (!slot) {
      return NextResponse.json({ error: "Agenda compartilhada não encontrada." }, { status: 404 });
    }

    const agendaType = clean(slot.agenda_type || slot.agendaType) || "individual";

    if (agendaType !== "shared") {
      return NextResponse.json(
        { error: "Este link não é de uma agenda compartilhada." },
        { status: 400 }
      );
    }

    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 21);

    let query = supabase
      .from("rh_interview_slots")
      .select("*")
      .eq("company_id", slot.company_id)
      .eq("agenda_type", "shared")
      .in("status", ["available", "reserved"])
      .gte("start_at", from.toISOString())
      .lte("start_at", to.toISOString())
      .order("start_at", { ascending: true })
      .limit(150);

    if (slot.job_id) query = query.eq("job_id", slot.job_id);
    if (slot.batch_id) query = query.eq("batch_id", slot.batch_id);

    const { data: rawSlots, error } = await query;

    if (error) throw new Error(error.message);

    const withCounts = await attachCounts(supabase, rawSlots || []);

    const available = withCounts.filter((item: any) => {
      const maxCandidates = Math.max(1, Number(item.max_candidates || 1));
      const confirmed = Math.max(
        Number(item.confirmed_count || 0),
        Number(item.reserved_count || 0)
      );
      return confirmed < maxCandidates && String(item.status || "") !== "cancelled";
    });

    return NextResponse.json({
      success: true,
      agendaType: "shared",
      baseSlot: slot,
      publicLink: publicSharedAgendaLink(slot),
      slots: available,
    });
  } catch (error: any) {
    console.error("GET /api/rh/interviews/shared/book:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao carregar agenda compartilhada." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();

    const selectedToken = clean(
      body.selectedToken ||
        body.selected_token ||
        body.slotToken ||
        body.slot_token ||
        body.token
    );

    if (!selectedToken) {
      return NextResponse.json({ error: "Token obrigatório." }, { status: 400 });
    }

    const slot = await getSlotByToken(supabase, selectedToken);

    if (!slot) {
      return NextResponse.json({ error: "Horário não encontrado." }, { status: 404 });
    }

    const agendaType = clean(slot.agenda_type || slot.agendaType) || "individual";

    if (agendaType !== "shared") {
      return NextResponse.json(
        { error: "Este horário não pertence a uma agenda compartilhada." },
        { status: 400 }
      );
    }

    const name = clean(body.name || body.nome);
    const phone = normalizePhone(body.phone || body.telefone);
    const email = clean(body.email).toLowerCase();

    if (!name) {
      return NextResponse.json({ error: "Nome obrigatório." }, { status: 400 });
    }

    if (!phone && !email) {
      return NextResponse.json(
        { error: "Informe WhatsApp ou e-mail para confirmar." },
        { status: 400 }
      );
    }

    const maxCandidates = Math.max(1, Number(slot.max_candidates || 1));
    const currentCount = await countSharedAttendees(supabase, slot.id);

    if (currentCount >= maxCandidates) {
      await supabase
        .from("rh_interview_slots")
        .update({
          status: "reserved",
          reserved_count: currentCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", slot.id);

      return NextResponse.json(
        { error: "Este horário compartilhado atingiu o limite de candidatos." },
        { status: 409 }
      );
    }

    // Evita duplicar o mesmo candidato no mesmo horário.
    const { data: existingRows, error: existingError } = await supabase
      .from("rh_shared_interview_attendees")
      .select("*")
      .eq("slot_id", slot.id)
      .limit(200);

    if (existingError) {
      console.error("CHECK DUPLICATE SHARED ATTENDEE ERROR:", existingError);
    }

    const alreadyConfirmed = (existingRows || []).find((row: any) => {
      if (String(row.status || "").toLowerCase() === "cancelled") return false;

      const samePhone = phone && normalizePhone(row.phone) === phone;
      const sameEmail = email && normalizeText(row.email) === normalizeText(email);

      return samePhone || sameEmail;
    });

    if (alreadyConfirmed?.id) {
      return NextResponse.json({
        success: true,
        alreadyConfirmed: true,
        attendee: alreadyConfirmed,
        slot,
        message: "Você já estava confirmado neste horário.",
      });
    }

    const lead = await findLeadByPhoneOrEmail({
      supabase,
      companyId: slot.company_id,
      phone,
      email,
    });

    const { data: attendee, error: insertError } = await supabase
      .from("rh_shared_interview_attendees")
      .insert({
        company_id: slot.company_id,
        slot_id: slot.id,
        job_id: slot.job_id || null,
        batch_id: slot.batch_id || null,
        lead_id: lead?.id || null,
        name,
        phone: phone || null,
        email: email || null,
        status: "confirmed",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("INSERT SHARED ATTENDEE ERROR:", insertError);
      return NextResponse.json(
        { error: insertError.message || "Erro ao confirmar candidato." },
        { status: 500 }
      );
    }

    const updatedLead = await updateLeadAsScheduled({
      supabase,
      lead,
      slot,
      name,
      phone,
      email,
    });

    const nextCount = currentCount + 1;
    const shouldCloseSlot = nextCount >= maxCandidates;

    const { data: updatedSlot } = await supabase
      .from("rh_interview_slots")
      .update({
        status: shouldCloseSlot ? "reserved" : "available",
        reserved_count: nextCount,
        reserved_name: attendee.name,
        reserved_phone: attendee.phone,
        reserved_email: attendee.email,
        lead_id: updatedLead?.id || attendee.lead_id || null,
        reserved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", slot.id)
      .select("*")
      .maybeSingle();

    const finalSlot = updatedSlot || slot;

    const candidateResult = await safeSendWhatsapp({
      companyId: finalSlot.company_id,
      phone: attendee.phone || "",
      message: candidateConfirmationMessage(finalSlot, attendee),
    });

    let recruiterResult = {
      sent: false,
      error: "Recrutador sem telefone.",
    } as any;

    if (finalSlot.recruiter_phone) {
      recruiterResult = await safeSendWhatsapp({
        companyId: finalSlot.company_id,
        phone: finalSlot.recruiter_phone,
        message: recruiterConfirmationMessage(finalSlot, attendee),
      });
    }

    return NextResponse.json({
      success: true,
      attendee,
      lead: updatedLead,
      slot: finalSlot,
      candidateNotified: candidateResult.sent,
      recruiterNotified: recruiterResult.sent,
      whatsappWarnings: {
        candidate: candidateResult.error || null,
        recruiter: recruiterResult.error || null,
      },
    });
  } catch (error: any) {
    console.error("POST /api/rh/interviews/shared/book:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao confirmar agenda compartilhada." },
      { status: 500 }
    );
  }
}
