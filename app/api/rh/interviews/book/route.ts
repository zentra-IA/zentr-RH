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

  if (!url || !key) throw new Error("Supabase não configurado.");

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

function publicAgendaLink(slot: any) {
  return `${appBaseUrl()}/agenda/${slot.token}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const finalPhone = normalizePhone(phone);

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

async function getLeadById(supabase: any, companyId: string, leadId?: string | null) {
  const id = clean(leadId);

  if (!id) return null;

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("GET LEAD BY ID ERROR:", error);
    return null;
  }

  return data || null;
}

async function findLeadByFallbacks({
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
  const normalizedEmail = clean(email).toLowerCase();

  if (normalizedPhone) {
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("company_id", companyId)
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (data?.id) return data;
  }

  if (normalizedEmail) {
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("company_id", companyId)
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (data?.id) return data;
  }

  return null;
}


async function findLeadFromQueueContext({
  supabase,
  companyId,
  jobId,
  batchId,
}: {
  supabase: any;
  companyId: string;
  jobId?: string | null;
  batchId?: string | null;
}) {
  const finalJobId = clean(jobId);
  const finalBatchId = clean(batchId);

  if (!finalJobId && !finalBatchId) return null;

  try {
    let queueQuery = supabase
      .from("automation_queue")
      .select("lead_id, job_id, batch_id, sent_at, created_at, status")
      .eq("company_id", companyId)
      .not("lead_id", "is", null)
      .order("sent_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(20);

    if (finalBatchId) {
      queueQuery = queueQuery.eq("batch_id", finalBatchId);
    } else if (finalJobId) {
      queueQuery = queueQuery.eq("job_id", finalJobId);
    }

    const { data: queueRows, error: queueError } = await queueQuery;

    if (queueError) {
      console.error("FIND LEAD FROM QUEUE ERROR:", queueError);
      return null;
    }

    const leadIds = Array.from(
      new Set((queueRows || []).map((row: any) => row.lead_id).filter(Boolean))
    );

    if (!leadIds.length) return null;

    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("*")
      .eq("company_id", companyId)
      .in("id", leadIds);

    if (leadsError) {
      console.error("FIND LEAD FROM QUEUE LEADS ERROR:", leadsError);
      return null;
    }

    const preferredStatuses = [
      "quer_agendar_entrevista",
      "respondeu",
      "enviado",
      "novo",
    ];

    const ordered = (leads || []).sort((a: any, b: any) => {
      const ai = preferredStatuses.indexOf(String(a.status || "").toLowerCase());
      const bi = preferredStatuses.indexOf(String(b.status || "").toLowerCase());

      const arank = ai === -1 ? 99 : ai;
      const brank = bi === -1 ? 99 : bi;

      if (arank !== brank) return arank - brank;

      return (
        new Date(b.updated_at || b.created_at || 0).getTime() -
        new Date(a.updated_at || a.created_at || 0).getTime()
      );
    });

    return ordered[0] || null;
  } catch (error) {
    console.error("FIND LEAD FROM QUEUE FAILED:", error);
    return null;
  }
}

async function resolveLeadForBooking({
  supabase,
  selectedSlot,
  contextSlot,
  body,
}: {
  supabase: any;
  selectedSlot: any;
  contextSlot?: any | null;
  body: any;
}) {
  const companyId = selectedSlot.company_id;
  const bodyLeadId = clean(body.leadId || body.lead_id);

  let lead =
    (await getLeadById(supabase, companyId, selectedSlot.lead_id)) ||
    (await getLeadById(supabase, companyId, contextSlot?.lead_id)) ||
    (await getLeadById(supabase, companyId, bodyLeadId));

  if (lead?.id) return lead;

  lead = await findLeadByFallbacks({
    supabase,
    companyId,
    phone:
      body.phone ||
      body.telefone ||
      selectedSlot.reserved_phone ||
      contextSlot?.reserved_phone,
    email:
      body.email ||
      selectedSlot.reserved_email ||
      contextSlot?.reserved_email,
  });

  if (lead?.id) return lead;

  // Fallback principal para link público gerado por vaga/lote:
  // quando o slot não carrega lead_id, recupera o último lead do lote/fila.
  lead = await findLeadFromQueueContext({
    supabase,
    companyId,
    jobId: selectedSlot.job_id || contextSlot?.job_id,
    batchId: selectedSlot.batch_id || contextSlot?.batch_id,
  });

  return lead || null;
}

async function updateLeadAfterBooking({
  supabase,
  lead,
  selectedSlot,
  contextSlot,
  body,
}: {
  supabase: any;
  lead: any;
  selectedSlot: any;
  contextSlot?: any | null;
  body: any;
}) {
  const name = clean(body.name || body.nome);
  const email = clean(body.email);
  const phone = normalizePhone(body.phone || body.telefone);

  const update: any = {
    status: "entrevista_agendada",
    ai_paused: true,
    paused: true,
    unread_count: 0,
    updated_at: new Date().toISOString(),
  };

  if (name) update.name = name;
  if (email) update.email = email;
  if (phone) update.phone = phone;

  update.job_id =
    selectedSlot.job_id ||
    contextSlot?.job_id ||
    lead.job_id ||
    lead.current_job_id ||
    null;

  update.current_job_id = update.job_id;

  update.batch_id =
    selectedSlot.batch_id ||
    contextSlot?.batch_id ||
    lead.batch_id ||
    null;

  const { data, error } = await supabase
    .from("leads")
    .update(update)
    .eq("id", lead.id)
    .eq("company_id", selectedSlot.company_id)
    .select("*")
    .single();

  if (error) {
    console.error("UPDATE LEAD AFTER BOOKING ERROR:", error);
    return { ...lead, ...update };
  }

  return data;
}

async function createInterviewFromSlot(supabase: any, slot: any, lead: any) {
  try {
    let existingQuery = supabase
      .from("rh_interviews")
      .select("id")
      .eq("company_id", slot.company_id)
      .eq("lead_id", lead.id)
      .eq("start_at", slot.start_at)
      .limit(1);

    if (slot.job_id) existingQuery = existingQuery.eq("job_id", slot.job_id);

    const { data: existing } = await existingQuery.maybeSingle();

    if (existing?.id) return;

    const { error } = await supabase.from("rh_interviews").insert({
      company_id: slot.company_id,
      branch_id: slot.branch_id || lead.branch_id || null,
      candidate_id: slot.candidate_id || null,
      lead_id: lead.id,
      job_id: slot.job_id || lead.job_id || lead.current_job_id || null,
      batch_id: slot.batch_id || lead.batch_id || null,

      title: slot.title || "Entrevista",
      start_at: slot.start_at,
      end_at: slot.end_at,

      candidate_name: lead.name || slot.reserved_name || "Candidato",
      candidate_phone: lead.phone || slot.reserved_phone || null,
      candidate_email: lead.email || slot.reserved_email || null,

      recruiter_name: slot.recruiter_name || null,
      recruiter_phone: slot.recruiter_phone || null,
      meeting_url: slot.meeting_url || null,
      location: slot.location || null,

      status: "scheduled",
      notes: `Criada automaticamente pela agenda pública. Slot: ${slot.id}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) console.error("ERRO AO CRIAR ENTREVISTA PELO SLOT:", error);
  } catch (error) {
    console.error("ERRO IGNORADO AO CRIAR ENTREVISTA PELO SLOT:", error);
  }
}

function candidateConfirmationMessage(slot: any, lead: any) {
  const localOrMeet = slot.meeting_url
    ? `🎥 Link da entrevista: ${slot.meeting_url}`
    : slot.location
      ? `📍 Local: ${slot.location}`
      : "";

  return `🎉 *Sua entrevista foi agendada com sucesso!*

Olá ${lead.name || "candidato"}, tudo certo?

💼 Vaga: ${slot.title || "Entrevista"}
📅 Data: ${formatDate(slot.start_at)}
🕒 Horário: ${formatTime(slot.start_at)}${localOrMeet ? `\n${localOrMeet}` : ""}

Caso precise reagendar ou cancelar, utilize o mesmo link de agendamento enviado anteriormente.

*⚠️ IMPORTANTE: Após concluir o agendamento, não responda esta mensagem. Utilize apenas o link de agendamento para reagendar ou cancelar sua entrevista.*

Boa sorte! 🍀`;
}

function recruiterConfirmationMessage(slot: any, lead: any) {
  return `✅ Nova entrevista agendada.

👤 Candidato: ${lead.name || slot.reserved_name || "Candidato"}
📞 Telefone: ${lead.phone || slot.reserved_phone || "-"}
📧 E-mail: ${lead.email || slot.reserved_email || "-"}
💼 Vaga: ${slot.title || "Entrevista"}
📅 Horário: ${formatDateTime(slot.start_at)}${slot.meeting_url ? `\n🎥 Link: ${slot.meeting_url}` : ""}`;
}

function groupSlotsByDate(slots: any[]) {
  const groups: Record<string, any[]> = {};

  for (const slot of slots || []) {
    const key = new Date(slot.start_at).toISOString().slice(0, 10);

    if (!groups[key]) groups[key] = [];
    groups[key].push(slot);
  }

  return Object.entries(groups).map(([date, items]) => ({
    date,
    label: new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
    }),
    slots: items,
  }));
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
      return NextResponse.json({ error: "Agenda não encontrada." }, { status: 404 });
    }

    const agendaType = clean(slot.agenda_type || slot.agendaType) || "individual";
    const isSharedAgenda = agendaType === "shared";

    let lead = null;

    // Agenda individual mantém o comportamento antigo:
    // tenta identificar o candidato automaticamente pelo slot/link.
    //
    // Agenda compartilhada NÃO deve usar fallback da fila,
    // porque o mesmo link é enviado para vários candidatos.
    // Nesse caso a página pública pede telefone/e-mail para identificar o candidato no POST.
    if (!isSharedAgenda) {
      lead = slot.lead_id
        ? await getLeadById(supabase, slot.company_id, slot.lead_id)
        : null;

      if (!lead?.id) {
        lead = await findLeadFromQueueContext({
          supabase,
          companyId: slot.company_id,
          jobId: slot.job_id,
          batchId: slot.batch_id,
        });
      }
    }

    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 21);

    let query = supabase
      .from("rh_interview_slots")
      .select("*")
      .eq("company_id", slot.company_id)
      .in("status", ["available", "reserved"])
      .gte("start_at", from.toISOString())
      .lte("start_at", to.toISOString())
      .order("start_at", { ascending: true })
      .limit(150);

    if (slot.job_id) query = query.eq("job_id", slot.job_id);

    const { data: rawSlots, error: availableError } = await query;

    if (availableError) throw new Error(availableError.message);

    const available = (rawSlots || []).filter((item: any) => {
      const itemAgendaType = clean(item.agenda_type || item.agendaType) || "individual";
      const itemIsShared = itemAgendaType === "shared";
      const itemStatus = clean(item.status).toLowerCase();

      if (itemIsShared) {
        const maxCandidates = Math.max(
          1,
          Number(item.max_candidates || item.maxCandidates || 1)
        );
        const reservedCount = Math.max(
          0,
          Number(item.reserved_count || item.reservedCount || 0)
        );

        return reservedCount < maxCandidates;
      }

      return itemStatus === "available";
    });

    return NextResponse.json({
      success: true,
      requiresCandidateData: isSharedAgenda && !lead?.id,
      agendaType,
      baseSlot: slot,
      lead: lead
        ? {
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            status: lead.status,
            job_id: lead.job_id || lead.current_job_id || slot.job_id || null,
            batch_id: lead.batch_id || slot.batch_id || null,
          }
        : null,
      publicLink: publicAgendaLink(slot),
      slots: available || [],
      dates: groupSlotsByDate(available || []),
    });
  } catch (error: any) {
    console.error("GET /api/rh/interviews/book:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao carregar agenda." },
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

    const contextToken = clean(
      body.contextToken ||
        body.context_token ||
        body.baseToken ||
        body.base_token ||
        body.inviteToken ||
        body.invite_token
    );

    if (!selectedToken) {
      return NextResponse.json({ error: "Token obrigatório." }, { status: 400 });
    }

    const currentSlot = await getSlotByToken(supabase, selectedToken);

    if (!currentSlot) {
      return NextResponse.json({ error: "Horário não encontrado." }, { status: 404 });
    }

    const contextSlot =
      contextToken && contextToken !== selectedToken
        ? await getSlotByToken(supabase, contextToken)
        : currentSlot;

    const agendaType = clean(currentSlot.agenda_type || currentSlot.agendaType) || "individual";
    const isSharedAgenda = agendaType === "shared";
    const maxCandidates = Math.max(
      1,
      Number(currentSlot.max_candidates || currentSlot.maxCandidates || 1)
    );
    const currentReservedCount = Math.max(
      0,
      Number(currentSlot.reserved_count || currentSlot.reservedCount || 0)
    );

    const currentStatus = clean(currentSlot.status).toLowerCase();

    if (!isSharedAgenda && currentStatus !== "available") {
      return NextResponse.json(
        {
          error: "Este horário já foi reservado. Escolha outro horário.",
          alreadyReserved: true,
        },
        { status: 409 }
      );
    }

    if (isSharedAgenda && currentReservedCount >= maxCandidates) {
      return NextResponse.json(
        {
          error: "Este horário compartilhado atingiu o limite de candidatos.",
          alreadyReserved: true,
        },
        { status: 409 }
      );
    }

    const lead = await resolveLeadForBooking({
      supabase,
      selectedSlot: currentSlot,
      contextSlot,
      body,
    });

    if (!lead?.id) {
      return NextResponse.json(
        {
          error:
            "Não foi possível identificar o candidato pelo link. Envie novamente o convite pelo WhatsApp.",
          code: "LEAD_CONTEXT_NOT_FOUND",
        },
        { status: 400 }
      );
    }

    const updatedLead = await updateLeadAfterBooking({
      supabase,
      lead,
      selectedSlot: currentSlot,
      contextSlot,
      body,
    });

    const nextReservedCount = isSharedAgenda
      ? currentReservedCount + 1
      : 1;

    const shouldCloseSlot =
      !isSharedAgenda || nextReservedCount >= maxCandidates;

    const reservationPayload: any = {
      status: shouldCloseSlot ? "reserved" : "available",
      reserved_name: updatedLead.name || lead.name || "Candidato",
      reserved_phone: updatedLead.phone || lead.phone || null,
      reserved_email: updatedLead.email || lead.email || null,
      lead_id: updatedLead.id,
      reserved_at: new Date().toISOString(),
      reserved_count: nextReservedCount,
      updated_at: new Date().toISOString(),
    };

    reservationPayload.job_id =
      currentSlot.job_id ||
      contextSlot?.job_id ||
      updatedLead.job_id ||
      updatedLead.current_job_id ||
      null;

    reservationPayload.batch_id =
      currentSlot.batch_id ||
      contextSlot?.batch_id ||
      updatedLead.batch_id ||
      null;

    let reserveQuery = supabase
      .from("rh_interview_slots")
      .update(reservationPayload)
      .eq("id", currentSlot.id);

    if (!isSharedAgenda) {
      reserveQuery = reserveQuery.eq("status", "available");
    }

    const { data: slot, error } = await reserveQuery
      .select("*")
      .single();

    if (error) {
      console.error("RESERVE SLOT ERROR:", error);
      return NextResponse.json(
        { error: "Este horário acabou de ser reservado ou atingiu o limite. Escolha outro." },
        { status: 409 }
      );
    }

    await createInterviewFromSlot(supabase, slot, updatedLead);

    const candidateResult = await safeSendWhatsapp({
      companyId: slot.company_id,
      phone: updatedLead.phone || "",
      message: candidateConfirmationMessage(slot, updatedLead),
    });

    let recruiterResult = {
      sent: false,
      error: "Recrutador sem telefone.",
    } as any;

    if (slot.recruiter_phone) {
      recruiterResult = await safeSendWhatsapp({
        companyId: slot.company_id,
        phone: slot.recruiter_phone,
        message: recruiterConfirmationMessage(slot, updatedLead),
      });
    }

    await supabase
      .from("rh_interview_slots")
      .update({
        candidate_confirmation_sent_at: candidateResult.sent
          ? new Date().toISOString()
          : null,
        recruiter_confirmation_sent_at: recruiterResult.sent
          ? new Date().toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", slot.id);

    return NextResponse.json({
      success: true,
      requiresCandidateData: false,
      slot,
      lead: updatedLead,
      candidateNotified: candidateResult.sent,
      recruiterNotified: recruiterResult.sent,
      whatsappWarnings: {
        candidate: candidateResult.error || null,
        recruiter: recruiterResult.error || null,
      },
      message:
        "Entrevista agendada. A IA foi pausada para evitar loop de mensagens.",
    });
  } catch (error: any) {
    console.error("POST /api/rh/interviews/book:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao reservar horário." },
      { status: 500 }
    );
  }
}
