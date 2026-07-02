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

function normalizeWhatsappRecipient(value: any) {
  const raw = clean(value);

  // Se vier JID/LID do WhatsApp, preserva o identificador.
  // Isso é importante para leads que não possuem telefone comum salvo,
  // mas possuem remote_jid ou whatsapp_lid.
  if (raw.includes("@lid") || raw.includes("@s.whatsapp.net")) {
    return raw;
  }

  return normalizePhone(raw);
}

function leadWhatsappRecipient(lead: any, fallback?: any) {
  return (
    normalizeWhatsappRecipient(lead?.phone) ||
    normalizeWhatsappRecipient(lead?.remote_jid) ||
    normalizeWhatsappRecipient(lead?.whatsapp_lid) ||
    normalizeWhatsappRecipient(fallback)
  );
}

function buildSession(companyId: string) {
  // O WhatsApp Server deste projeto trabalha com sessionId numérico (ex: 1).
  // Usar `${companyId}_1` impede o envio da confirmação em alguns ambientes.
  return RH_REMINDER_SESSION;
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
    timeZone: "America/Sao_Paulo",
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
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
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
        companyId,
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

  // IMPORTANTE:
  // A identificação da agenda individual vem pelo leadId na URL.
  // Não filtramos por company_id aqui porque em alguns bancos antigos a coluna
  // pode estar como companyId/id_da_empresa ou o cache da API pode não reconhecer.
  // O ID do lead já é UUID único e resolve o candidato correto.
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("GET LEAD BY ID ERROR:", error);
    return null;
  }

  if (!data?.id) {
    console.error("GET LEAD BY ID NOT FOUND:", { leadId: id, companyId });
    return null;
  }

  return data;
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
  const agendaType = clean(selectedSlot.agenda_type || selectedSlot.agendaType) || "individual";
  const isSharedAgenda = agendaType === "shared";

  let lead =
    // O leadId vindo do link/post tem prioridade máxima na agenda individual.
    // Sem isso, o sistema pode cair no candidato errado quando vários candidatos usam a mesma vaga.
    (await getLeadById(supabase, companyId, bodyLeadId)) ||
    (await getLeadById(supabase, companyId, selectedSlot.lead_id)) ||
    (await getLeadById(supabase, companyId, contextSlot?.lead_id));

  if (lead?.id) return lead;

  const phoneFromBody =
    body.phone ||
    body.telefone ||
    selectedSlot.reserved_phone ||
    contextSlot?.reserved_phone;

  const emailFromBody =
    body.email ||
    selectedSlot.reserved_email ||
    contextSlot?.reserved_email;

  lead = await findLeadByFallbacks({
    supabase,
    companyId,
    phone: phoneFromBody,
    email: emailFromBody,
  });

  if (lead?.id) return lead;

  if (isSharedAgenda) {
    const name = clean(body.name || body.nome) || "Candidato";
    const phone = normalizePhone(phoneFromBody);
    const email = clean(emailFromBody).toLowerCase();

    if (!phone && !email) return null;

    try {
      const { data, error } = await supabase
        .from("leads")
        .insert({
          company_id: companyId,
          name,
          phone: phone || null,
          email: email || null,
          status: "entrevista_confirmada",
          job_id: selectedSlot.job_id || contextSlot?.job_id || null,
          current_job_id: selectedSlot.job_id || contextSlot?.job_id || null,
          batch_id: selectedSlot.batch_id || contextSlot?.batch_id || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .maybeSingle();

      if (error) {
        console.error("CREATE LEAD FOR SHARED BOOKING ERROR:", error);
        return {
          id: null,
          company_id: companyId,
          name,
          phone,
          email,
          job_id: selectedSlot.job_id || contextSlot?.job_id || null,
          current_job_id: selectedSlot.job_id || contextSlot?.job_id || null,
          batch_id: selectedSlot.batch_id || contextSlot?.batch_id || null,
        };
      }

      return data || null;
    } catch (error) {
      console.error("CREATE LEAD FOR SHARED BOOKING FAILED:", error);
      return null;
    }
  }

  // Fallback antigo fica APENAS para agenda individual.
  // Na agenda compartilhada ele causava o erro de puxar Gregory no link da Julia.
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
  // Mantido como no-op seguro.
  // A tabela rh_interviews do projeto atual não possui colunas como lead_id/start_at.
  // A confirmação da agenda já atualiza o lead e o slot.
  // Para agenda compartilhada, os participantes são salvos em rh_shared_interview_attendees.
  return;
}

async function createOrUpdateSharedAttendee(supabase: any, slot: any, lead: any) {
  const phone = normalizePhone(lead.phone || slot.reserved_phone || "");
  const email = clean(lead.email || slot.reserved_email || "").toLowerCase();

  try {
    const { data: existingRows, error: findError } = await supabase
      .from("rh_shared_interview_attendees")
      .select("*")
      .eq("company_id", slot.company_id)
      .eq("slot_id", slot.id)
      .limit(500);

    if (findError) {
      console.error("FIND SHARED ATTENDEE ERROR:", findError);
    }

    const existing =
      (existingRows || []).find((row: any) => {
        const sameLead = row.lead_id && lead.id && String(row.lead_id) === String(lead.id);
        const samePhone = phone && normalizePhone(row.phone) === phone;
        const sameEmail = email && clean(row.email).toLowerCase() === email;
        return sameLead || samePhone || sameEmail;
      }) || null;

    const payload = {
      company_id: slot.company_id,
      slot_id: slot.id,
      job_id: slot.job_id || lead.job_id || lead.current_job_id || null,
      batch_id: slot.batch_id || lead.batch_id || null,
      lead_id: lead.id || null,
      name: lead.name || slot.reserved_name || "Candidato",
      phone: phone || null,
      email: email || null,
      status: "confirmed",
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error } = await supabase
        .from("rh_shared_interview_attendees")
        .update(payload)
        .eq("id", existing.id)
        .eq("company_id", slot.company_id);

      if (error) console.error("UPDATE SHARED ATTENDEE ERROR:", error);
      return existing.id;
    }

    const { data, error } = await supabase
      .from("rh_shared_interview_attendees")
      .insert({
        ...payload,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("INSERT SHARED ATTENDEE ERROR:", error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error("CREATE SHARED ATTENDEE FAILED:", error);
    return null;
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
    const leadIdFromUrl = clean(
      searchParams.get("leadId") ||
        searchParams.get("lead_id") ||
        searchParams.get("candidateId") ||
        searchParams.get("candidate_id")
    );

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
      // Agenda individual precisa respeitar o leadId que veio no link.
      // Isso evita abrir o link da Júlia mostrando Gregory por causa do fallback da fila.
      lead =
        (await getLeadById(supabase, slot.company_id, leadIdFromUrl)) ||
        (slot.lead_id
          ? await getLeadById(supabase, slot.company_id, slot.lead_id)
          : null);

      // Fallback mantido apenas para links antigos sem leadId.
      if (!lead?.id && !leadIdFromUrl) {
        lead = await findLeadFromQueueContext({
          supabase,
          companyId: slot.company_id,
          jobId: slot.job_id,
          batchId: slot.batch_id,
        });
      }

      if (!lead?.id && leadIdFromUrl) {
        return NextResponse.json(
          {
            error:
              "Não foi possível identificar o candidato pelo link. Envie novamente o convite pelo WhatsApp.",
            code: "LEAD_CONTEXT_NOT_FOUND",
          },
          { status: 400 }
        );
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

    if (isSharedAgenda) {
      await createOrUpdateSharedAttendee(supabase, slot, updatedLead);
    } else {
      await createInterviewFromSlot(supabase, slot, updatedLead);
    }

    const candidateResult = await safeSendWhatsapp({
      companyId: slot.company_id,
      phone: leadWhatsappRecipient(updatedLead, slot.reserved_phone),
      message: candidateConfirmationMessage(slot, updatedLead),
    });

    if (!candidateResult.sent) {
      console.error("CANDIDATE CONFIRMATION WHATSAPP NOT SENT:", {
        leadId: updatedLead?.id,
        leadName: updatedLead?.name,
        phone: updatedLead?.phone,
        remote_jid: updatedLead?.remote_jid,
        whatsapp_lid: updatedLead?.whatsapp_lid,
        fallback: slot.reserved_phone,
        error: candidateResult.error,
      });
    }

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
