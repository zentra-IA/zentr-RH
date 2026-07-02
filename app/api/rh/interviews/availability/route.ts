import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";

export const dynamic = "force-dynamic";

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
  if (!digits) return null;
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function makeToken() {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  return random.replace(/-/g, "").slice(0, 24);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function buildSlotsFromRange({
  date,
  startTime,
  endTime,
  duration,
}: {
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
}) {
  const slots: { startAt: Date; endAt: Date }[] = [];
  const start = new Date(`${date}T${startTime}:00`);
  const end = new Date(`${date}T${endTime}:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return slots;

  let cursor = start;

  while (cursor < end) {
    const slotEnd = addMinutes(cursor, duration);
    if (slotEnd <= end) slots.push({ startAt: cursor, endAt: slotEnd });
    cursor = slotEnd;
  }

  return slots;
}

async function getJob(supabase: any, companyId: string, jobId: string) {
  if (!jobId) return null;

  const tries = [
    supabase.from("Job").select("*").eq("company_id", companyId).eq("id", jobId).maybeSingle(),
    supabase.from("jobs").select("*").eq("company_id", companyId).eq("id", jobId).maybeSingle(),
    supabase.from("rh_jobs").select("*").eq("company_id", companyId).eq("id", jobId).maybeSingle(),
  ];

  for (const promise of tries) {
    try {
      const { data, error } = await promise;
      if (!error && data) return data;
    } catch {}
  }

  return null;
}

async function getJobTitle(supabase: any, companyId: string, jobId: string) {
  const job = await getJob(supabase, companyId, jobId);
  if (!job) return "";

  const location = [job.city, job.state].filter(Boolean).join("/");
  return `${job.title || job.name || "Vaga"}${location ? ` - ${location}` : ""}`;
}

async function upsertLeadFromSlot(supabase: any, slot: any, status: string) {
  const leadStatusMap: Record<string, string> = {
    confirmed: "entrevista_confirmada",
    approved: "contratado",
    rejected: "nao_aprovado",
    no_show: "nao_compareceu",
  };

  const leadStatus = leadStatusMap[status];
  if (!leadStatus) return null;

  const normalizedPhone = normalizePhone(slot.reserved_phone);

  if (!normalizedPhone && !slot.lead_id) return null;

  try {
    if (slot.lead_id) {
      const { data } = await supabase
        .from("leads")
        .update({
          status: leadStatus,
          job_id: slot.job_id || null,
          current_job_id: slot.job_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", slot.lead_id)
        .eq("company_id", slot.company_id)
        .select("*")
        .maybeSingle();

      return data;
    }

    const { data: existing } = await supabase
      .from("leads")
      .select("*")
      .eq("company_id", slot.company_id)
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (existing?.id) {
      const { data } = await supabase
        .from("leads")
        .update({
          name: existing.name || slot.reserved_name || "Candidato",
          email: existing.email || slot.reserved_email || null,
          status: leadStatus,
          job_id: slot.job_id || existing.job_id || null,
          current_job_id: slot.job_id || existing.current_job_id || existing.job_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("company_id", slot.company_id)
        .select("*")
        .maybeSingle();

      return data || existing;
    }

    const { data, error } = await supabase
      .from("leads")
      .insert({
        company_id: slot.company_id,
        branch_id: slot.branch_id || null,
        name: slot.reserved_name || "Candidato",
        phone: normalizedPhone,
        email: slot.reserved_email || null,
        status: leadStatus,
        job_id: slot.job_id || null,
        current_job_id: slot.job_id || null,
        conversation_stage: "new",
        ai_paused: false,
        paused: false,
        opt_out: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      console.error("LEAD UPSERT FROM SLOT ERROR:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("LEAD UPSERT FROM SLOT FAILED:", error);
    return null;
  }
}


function normalizeText(value: any) {
  return clean(value).toLowerCase();
}

function slotJobId(slot: any) {
  return slot?.job_id || slot?.id_do_trabalho || "";
}

function slotStart(slot: any) {
  return slot?.start_at || slot?.comecar_em || "";
}

function slotEnd(slot: any) {
  return slot?.end_at || slot?.fim_em || "";
}

function interviewJobId(interview: any) {
  return interview?.job_id || interview?.id_do_trabalho || "";
}

function interviewStart(interview: any) {
  return interview?.start_at || interview?.comecar_em || "";
}

function sameDateTime(a: any, b: any) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return da.getTime() === db.getTime();
}

function interviewBelongsToSlot(interview: any, slot: any) {
  const notes = String(interview?.notes || interview?.notas || "");
  if (slot?.id && notes.includes(`Slot: ${slot.id}`)) return true;

  const sameStart = sameDateTime(interviewStart(interview), slotStart(slot));
  const sameJob =
    !slotJobId(slot) ||
    !interviewJobId(interview) ||
    String(interviewJobId(interview)) === String(slotJobId(slot));

  return sameStart && sameJob;
}

function attendeeFromInterview(interview: any) {
  return {
    id: `interview-${interview.id}`,
    interview_id: interview.id,
    lead_id: interview.lead_id || null,
    candidate_id: interview.candidate_id || null,
    name:
      interview.candidate_name ||
      interview.nome_candidato ||
      interview.name ||
      "Candidato",
    phone:
      interview.candidate_phone ||
      interview.telefone_candidato ||
      interview.phone ||
      null,
    email:
      interview.candidate_email ||
      interview.email_candidato ||
      interview.email ||
      null,
    status: interview.status || "scheduled",
    source: "rh_interviews",
  };
}

function fallbackAttendeeFromSlot(slot: any) {
  if (!slot?.reserved_name && !slot?.reserved_phone && !slot?.reserved_email && !slot?.lead_id) {
    return null;
  }

  return {
    id: `slot-${slot.id}`,
    interview_id: null,
    lead_id: slot.lead_id || null,
    candidate_id: slot.candidate_id || null,
    name: slot.reserved_name || "Candidato",
    phone: slot.reserved_phone || null,
    email: slot.reserved_email || null,
    status: slot.status || "reserved",
    source: "slot",
  };
}

async function attachAttendeesToSlots(supabase: any, companyId: string, slots: any[]) {
  if (!slots.length) return slots;

  const sharedSlots = slots.filter(
    (slot) => clean(slot.agenda_type || slot.agendaType) === "shared"
  );
  const sharedSlotIds = sharedSlots.map((slot) => slot.id).filter(Boolean);

  let sharedAttendees: any[] = [];

  if (sharedSlotIds.length) {
    try {
      const { data, error } = await supabase
        .from("rh_shared_interview_attendees")
        .select("*")
        .in("slot_id", sharedSlotIds)
        .order("created_at", { ascending: true })
        .limit(3000);

      if (error) {
        console.error("ATTACH SHARED ATTENDEES ERROR:", error);
      } else {
        sharedAttendees = data || [];
      }
    } catch (error) {
      console.error("ATTACH SHARED ATTENDEES FAILED:", error);
    }
  }

  return slots.map((slot) => {
    const isShared = clean(slot.agenda_type || slot.agendaType) === "shared";

    if (isShared) {
      const attendees = sharedAttendees
        .filter((row: any) => String(row.slot_id) === String(slot.id))
        .filter((row: any) => String(row.status || "").toLowerCase() !== "cancelled")
        .map((row: any) => ({
          id: row.id,
          attendee_id: row.id,
          lead_id: row.lead_id || null,
          candidate_id: null,
          name: row.name || "Candidato",
          phone: row.phone || null,
          email: row.email || null,
          status: row.status || "confirmed",
          source: "rh_shared_interview_attendees",
        }));

      return {
        ...slot,
        reserved_count: attendees.length,
        attendees,
        confirmed_candidates: attendees,
      };
    }

    const fallback = fallbackAttendeeFromSlot(slot);

    return {
      ...slot,
      attendees: fallback ? [fallback] : [],
      confirmed_candidates: fallback ? [fallback] : [],
    };
  });
}

async function updateLeadStatusForInterview({
  supabase,
  companyId,
  leadId,
  phone,
  email,
  status,
  jobId,
}: {
  supabase: any;
  companyId: string;
  leadId?: string | null;
  phone?: string | null;
  email?: string | null;
  status: string;
  jobId?: string | null;
}) {
  const leadStatusMap: Record<string, string> = {
    confirmed: "entrevista_confirmada",
    approved: "contratado",
    rejected: "nao_aprovado",
    no_show: "nao_compareceu",
    reschedule: "quer_agendar_entrevista",
  };

  const leadStatus = leadStatusMap[status] || status;
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = normalizeText(email);

  let found: any = null;

  // 1. Caminho mais seguro: por ID real do lead.
  if (leadId) {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("company_id", companyId)
      .eq("id", leadId)
      .maybeSingle();

    if (error) console.error("FIND LEAD BY ID ERROR:", error);
    found = data || null;
  }

  // 2. Fallback seguro: busca por empresa e filtra em memória.
  // Evita quebrar se o banco usa phone/celular/telefone/e-mail com nomes diferentes.
  if (!found && (normalizedPhone || normalizedEmail)) {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("company_id", companyId)
      .limit(1000);

    if (error) {
      console.error("FIND LEADS FALLBACK ERROR:", error);
    }

    found =
      (data || []).find((item: any) => {
        const phones = [
          item.phone,
          item.telefone,
          item.celular,
          item.whatsapp,
          item.remote_jid,
          item.remoteJid,
        ]
          .map(normalizePhone)
          .filter(Boolean);

        const emails = [
          item.email,
          item.e_mail,
          item["e-mail"],
          item.candidate_email,
        ]
          .map(normalizeText)
          .filter(Boolean);

        const samePhone = normalizedPhone && phones.includes(normalizedPhone);
        const sameEmail = normalizedEmail && emails.includes(normalizedEmail);

        return samePhone || sameEmail;
      }) || null;
  }

  if (!found?.id) {
    console.warn("LEAD NAO ENCONTRADO PARA STATUS DE ENTREVISTA:", {
      companyId,
      leadId,
      phone,
      normalizedPhone,
      email,
      normalizedEmail,
      status,
      jobId,
    });
    return null;
  }

  const { data, error } = await supabase
    .from("leads")
    .update({
      status: leadStatus,
      job_id: jobId || found.job_id || null,
      current_job_id: jobId || found.current_job_id || found.job_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", found.id)
    .eq("company_id", companyId)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("UPDATE LEAD STATUS FROM INTERVIEW ERROR:", error);
    return found;
  }

  return data || found;
}


async function createOrUpdateHiringFromInterviewAction({
  supabase,
  companyId,
  slot,
  candidate,
  lead,
  status,
}: {
  supabase: any;
  companyId: string;
  slot: any;
  candidate?: any;
  lead?: any;
  status: string;
}) {
  if (status !== "approved") return null;

  const jobId = slotJobId(slot) || lead?.job_id || lead?.current_job_id || candidate?.job_id || null;
  const candidatePhone = normalizePhone(candidate?.phone || lead?.phone || slot?.reserved_phone || "");
  const candidateEmail = normalizeText(candidate?.email || lead?.email || slot?.reserved_email || "");
  const candidateName =
    clean(candidate?.name || lead?.name || slot?.reserved_name) || "Candidato";

  if (!candidateName && !candidatePhone && !candidateEmail && !lead?.id) {
    return null;
  }

  let jobTitle = clean(slot?.title || "");
  if (!jobTitle && jobId) {
    jobTitle = await getJobTitle(supabase, companyId, jobId);
  }
  if (!jobTitle) jobTitle = "Sem vaga informada";

  const payload: any = {
    company_id: companyId,
    branch_id: slot?.branch_id || lead?.branch_id || null,
    lead_id: lead?.id || candidate?.lead_id || null,
    candidate_id: candidate?.candidate_id || null,
    job_id: jobId,
    batch_id: slot?.batch_id || lead?.batch_id || candidate?.batch_id || null,
    interview_id: candidate?.interview_id || null,
    candidate_name: candidateName,
    candidate_phone: candidatePhone || null,
    candidate_email: candidateEmail || null,
    phone: candidatePhone || null,
    email: candidateEmail || null,
    job_title: jobTitle,
    status: "approved",
    hired_at: new Date().toISOString(),
    start_date: new Date().toISOString().slice(0, 10),
    meeting_url: slot?.meeting_url || null,
    notes: "Criado automaticamente ao aprovar entrevista.",
    updated_at: new Date().toISOString(),
  };

  // Busca contratação existente sem depender de campos instáveis.
  let existing: any = null;

  if (payload.lead_id) {
    const { data } = await supabase
      .from("rh_hirings")
      .select("*")
      .eq("company_id", companyId)
      .eq("lead_id", payload.lead_id)
      .limit(1)
      .maybeSingle();
    existing = data || null;
  }

  if (!existing && payload.candidate_phone) {
    const { data } = await supabase
      .from("rh_hirings")
      .select("*")
      .eq("company_id", companyId)
      .eq("candidate_phone", payload.candidate_phone)
      .limit(1)
      .maybeSingle();
    existing = data || null;
  }

  if (!existing && payload.candidate_email) {
    const { data } = await supabase
      .from("rh_hirings")
      .select("*")
      .eq("company_id", companyId)
      .ilike("candidate_email", payload.candidate_email)
      .limit(1)
      .maybeSingle();
    existing = data || null;
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from("rh_hirings")
      .update(payload)
      .eq("id", existing.id)
      .eq("company_id", companyId)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("UPDATE HIRING FROM INTERVIEW ACTION ERROR:", error);
      return null;
    }

    return data || existing;
  }

  const { data, error } = await supabase
    .from("rh_hirings")
    .insert({
      ...payload,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("CREATE HIRING FROM INTERVIEW ACTION ERROR:", error);
    return null;
  }

  return data || null;
}

async function updateSharedAttendeeStatus({
  supabase,
  companyId,
  slot,
  body,
}: {
  supabase: any;
  companyId: string;
  slot: any;
  body: any;
}) {
  const status = clean(body.status);
  const attendeeId = clean(
    body.attendeeId ||
      body.attendee_id ||
      body.interviewId ||
      body.interview_id
  );

  const allowed = ["confirmed", "approved", "rejected", "no_show", "reschedule"];
  if (!allowed.includes(status)) {
    return { error: "Status de candidato inválido.", statusCode: 400 };
  }

  // Se for participante novo da tabela compartilhada, usamos o ID do attendee.
  // Se for um horário antigo/fallback gravado direto no slot, não existe attendee_id.
  // Nesse caso atualizamos o lead pelo telefone/e-mail/lead_id e não quebramos a operação.
  if (!attendeeId) {
    const lead = await updateLeadStatusForInterview({
      supabase,
      companyId,
      leadId: clean(body.leadId || body.lead_id) || slot.lead_id || null,
      phone: body.candidatePhone || body.phone || slot.reserved_phone || null,
      email: body.candidateEmail || body.email || slot.reserved_email || null,
      status,
      jobId: slotJobId(slot) || null,
    });

    const hiring = await createOrUpdateHiringFromInterviewAction({
      supabase,
      companyId,
      slot,
      candidate: {
        name: slot.reserved_name,
        phone: slot.reserved_phone,
        email: slot.reserved_email,
        lead_id: slot.lead_id || null,
      },
      lead,
      status,
    });

    return {
      success: true,
      attendee: null,
      lead,
      hiring,
      fallback: true,
    };
  }

  const attendeeStatus = status === "reschedule" ? "confirmed" : status;

  const { data: attendee, error } = await supabase
    .from("rh_shared_interview_attendees")
    .update({
      status: attendeeStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", attendeeId)
    .eq("company_id", companyId)
    .eq("slot_id", slot.id)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("UPDATE SHARED ATTENDEE STATUS ERROR:", error);
    return { error: error.message || "Erro ao atualizar participante.", statusCode: 500 };
  }

  if (!attendee?.id) {
    return { error: "Participante não encontrado.", statusCode: 404 };
  }

  const lead = await updateLeadStatusForInterview({
    supabase,
    companyId,
    leadId: attendee.lead_id || null,
    phone: attendee.phone || null,
    email: attendee.email || null,
    status,
    jobId: slotJobId(slot) || null,
  });

  const hiring = await createOrUpdateHiringFromInterviewAction({
    supabase,
    companyId,
    slot,
    candidate: attendee,
    lead,
    status,
  });

  return {
    success: true,
    attendee,
    lead,
    hiring,
  };
}

async function updateCandidateInterviewStatus({
  supabase,
  companyId,
  slot,
  body,
}: {
  supabase: any;
  companyId: string;
  slot: any;
  body: any;
}) {
  const isShared = clean(slot.agenda_type || slot.agendaType) === "shared";

  if (isShared) {
    return updateSharedAttendeeStatus({ supabase, companyId, slot, body });
  }

  const status = clean(body.status);
  const leadId = clean(body.leadId || body.lead_id);
  const phone = normalizePhone(body.candidatePhone || body.phone);
  const email = clean(body.candidateEmail || body.email);
  const jobId = slotJobId(slot) || null;

  const allowed = ["confirmed", "approved", "rejected", "no_show", "reschedule"];
  if (!allowed.includes(status)) {
    return { error: "Status de candidato inválido.", statusCode: 400 };
  }

  const lead = await updateLeadStatusForInterview({
    supabase,
    companyId,
    leadId: leadId || slot.lead_id || null,
    phone: phone || slot.reserved_phone || null,
    email: email || slot.reserved_email || null,
    status,
    jobId,
  });

  const hiring = await createOrUpdateHiringFromInterviewAction({
    supabase,
    companyId,
    slot,
    candidate: {
      name: slot.reserved_name,
      phone: phone || slot.reserved_phone || null,
      email: email || slot.reserved_email || null,
      lead_id: leadId || slot.lead_id || null,
    },
    lead,
    status,
  });

  const slotStatusMap: Record<string, string> = {
    confirmed: "confirmed",
    approved: "approved",
    rejected: "rejected",
    no_show: "no_show",
    reschedule: "available",
  };

  const slotUpdate: any = {
    status: slotStatusMap[status] || slot.status,
    updated_at: new Date().toISOString(),
  };

  if (status === "reschedule") {
    slotUpdate.reserved_name = null;
    slotUpdate.reserved_phone = null;
    slotUpdate.reserved_email = null;
    slotUpdate.reserved_at = null;
    slotUpdate.lead_id = null;
    slotUpdate.reserved_count = 0;
  }

  const { error: slotError } = await supabase
    .from("rh_interview_slots")
    .update(slotUpdate)
    .eq("id", slot.id)
    .eq("company_id", companyId);

  if (slotError) {
    console.error("UPDATE SLOT STATUS FROM CANDIDATE ACTION ERROR:", slotError);
    return { error: slotError.message || "Erro ao atualizar horário.", statusCode: 500 };
  }

  return {
    success: true,
    interview: null,
    lead,
    hiring,
  };
}


export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId } = await requireCompany(req);
    const { searchParams } = new URL(req.url);

    const status = clean(searchParams.get("status"));
    const jobId = clean(searchParams.get("jobId") || searchParams.get("job_id"));

    let query = supabase
      .from("rh_interview_slots")
      .select("*")
      .eq("company_id", companyId)
      .order("start_at", { ascending: true })
      .limit(1000);

    if (status && status !== "all") query = query.eq("status", status);
    if (jobId) query = query.eq("job_id", jobId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const slotsWithAttendees = await attachAttendeesToSlots(
      supabase,
      companyId,
      data || []
    );

    return NextResponse.json({ success: true, slots: slotsWithAttendees });
  } catch (error: any) {
    console.error("GET /api/rh/interviews/availability:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao carregar horários." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId, branchId } = await requireCompany(req);
    const body = await req.json();

    const mode = clean(body.mode || "range");
    const jobId = clean(body.jobId || body.job_id) || null;
    const batchId = clean(body.batchId || body.batch_id) || null;
    const jobTitle = jobId ? await getJobTitle(supabase, companyId, jobId) : "";

    const title = clean(body.title || body.jobTitle) || jobTitle || "Entrevista";
    const location = clean(body.location) || null;
    const meetingUrl = clean(body.meetingUrl || body.meeting_url) || null;
    const agendaType =
      clean(body.agendaType || body.agenda_type) === "shared" ? "shared" : "individual";
    const maxCandidates =
      agendaType === "shared"
        ? Math.max(1, Math.min(500, Number(body.maxCandidates || body.max_candidates || 30)))
        : 1;
    const recruiterName = clean(body.recruiterName || body.recruiter_name) || null;
    const recruiterPhone = normalizePhone(body.recruiterPhone || body.recruiter_phone);
    const notes = clean(body.notes) || null;

    let slots: { startAt: Date; endAt: Date }[] = [];

    if (mode === "range") {
      const date = clean(body.date);
      const startTime = clean(body.startTime || "09:00");
      const endTime = clean(body.endTime || "17:00");
      const duration = Math.max(10, Math.min(180, Number(body.duration || 30)));

      if (!date) {
        return NextResponse.json({ error: "Data obrigatória." }, { status: 400 });
      }

      slots = buildSlotsFromRange({ date, startTime, endTime, duration });
    } else {
      const startAt = new Date(body.startAt || body.start_at);
      const duration = Math.max(10, Math.min(180, Number(body.duration || 30)));

      if (Number.isNaN(startAt.getTime())) {
        return NextResponse.json({ error: "Horário inicial obrigatório." }, { status: 400 });
      }

      slots = [{ startAt, endAt: addMinutes(startAt, duration) }];
    }

    if (!slots.length) {
      return NextResponse.json({ error: "Nenhum horário válido gerado." }, { status: 400 });
    }

    const rows = slots.map((slot) => ({
      company_id: companyId,
      branch_id: branchId || null,
      job_id: jobId,
      batch_id: batchId,
      token: makeToken(),
      title,
      location,
      meeting_url: meetingUrl,
      recruiter_name: recruiterName,
      recruiter_phone: recruiterPhone,
      start_at: slot.startAt.toISOString(),
      end_at: slot.endAt.toISOString(),
      status: "available",
      agenda_type: agendaType,
      max_candidates: maxCandidates,
      reserved_count: 0,
      notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from("rh_interview_slots")
      .insert(rows)
      .select("*");

    if (error) {
      console.error("SUPABASE SLOT INSERT ERROR:", error);
      return NextResponse.json(
        {
          error: error.message,
          details: error.details || null,
          hint: error.hint || null,
          code: error.code || null,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      created: data?.length || 0,
      slots: data || [],
    });
  } catch (error: any) {
    console.error("POST /api/rh/interviews/availability:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao criar horários." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId } = await requireCompany(req);
    const body = await req.json();

    const id = clean(body.id);
    if (!id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });

    const { data: currentSlot, error: currentSlotError } = await supabase
      .from("rh_interview_slots")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();

    if (currentSlotError) {
      console.error("FIND SLOT BEFORE PATCH ERROR:", currentSlotError);
    }

    if (!currentSlot) {
      return NextResponse.json({ error: "Horário não encontrado." }, { status: 404 });
    }

    if (body.candidateAction === true) {
      const result: any = await updateCandidateInterviewStatus({
        supabase,
        companyId,
        slot: currentSlot,
        body,
      });

      if (result?.error) {
        return NextResponse.json(
          { error: result.error },
          { status: result.statusCode || 500 }
        );
      }

      return NextResponse.json({ success: true, ...result });
    }

    const update: any = { updated_at: new Date().toISOString() };

    if (body.status !== undefined) {
      const status = clean(body.status);

      if (
        ![
          "available",
          "reserved",
          "cancelled",
          "confirmed",
          "approved",
          "rejected",
          "no_show",
        ].includes(status)
      ) {
        return NextResponse.json({ error: "Status inválido." }, { status: 400 });
      }

      update.status = status;

      if (body.clearReservation === true && status === "available") {
        update.reserved_name = null;
        update.reserved_phone = null;
        update.reserved_email = null;
        update.reserved_at = null;
        update.lead_id = null;
      }
    }

    if (body.jobId !== undefined || body.job_id !== undefined) {
      update.job_id = clean(body.jobId || body.job_id) || null;
    }
    if (body.batchId !== undefined || body.batch_id !== undefined) {
      update.batch_id = clean(body.batchId || body.batch_id) || null;
    }
    if (body.title !== undefined) update.title = clean(body.title) || null;
    if (body.location !== undefined) update.location = clean(body.location) || null;
    if (body.meetingUrl !== undefined || body.meeting_url !== undefined) {
      update.meeting_url = clean(body.meetingUrl || body.meeting_url) || null;
    }
    if (body.agendaType !== undefined || body.agenda_type !== undefined) {
      const agendaType =
        clean(body.agendaType || body.agenda_type) === "shared" ? "shared" : "individual";
      update.agenda_type = agendaType;

      if (agendaType === "individual") {
        update.max_candidates = 1;
      }
    }
    if (body.maxCandidates !== undefined || body.max_candidates !== undefined) {
      update.max_candidates = Math.max(
        1,
        Math.min(500, Number(body.maxCandidates || body.max_candidates || 1))
      );
    }
    if (body.recruiterName !== undefined || body.recruiter_name !== undefined) {
      update.recruiter_name = clean(body.recruiterName || body.recruiter_name) || null;
    }
    if (body.recruiterPhone !== undefined || body.recruiter_phone !== undefined) {
      update.recruiter_phone = normalizePhone(body.recruiterPhone || body.recruiter_phone);
    }
    if (body.notes !== undefined) update.notes = clean(body.notes) || null;

    const { data, error } = await supabase
      .from("rh_interview_slots")
      .update(update)
      .eq("id", id)
      .eq("company_id", companyId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    let lead = null;

    if (update.status && ["confirmed", "approved", "rejected", "no_show"].includes(update.status)) {
      lead = await upsertLeadFromSlot(supabase, data, update.status);

      if (lead?.id && !data.lead_id) {
        await supabase
          .from("rh_interview_slots")
          .update({ lead_id: lead.id, updated_at: new Date().toISOString() })
          .eq("id", data.id)
          .eq("company_id", companyId);
      }
    }

    return NextResponse.json({ success: true, slot: data, lead });
  } catch (error: any) {
    console.error("PATCH /api/rh/interviews/availability:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar horário." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId } = await requireCompany(req);
    const { searchParams } = new URL(req.url);

    const id = clean(searchParams.get("id"));
    const hard = clean(searchParams.get("hard")) === "1";

    if (!id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });

    if (hard) {
      const { error } = await supabase
        .from("rh_interview_slots")
        .delete()
        .eq("id", id)
        .eq("company_id", companyId);

      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true, deleted: true });
    }

    const { error } = await supabase
      .from("rh_interview_slots")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, cancelled: true });
  } catch (error: any) {
    console.error("DELETE /api/rh/interviews/availability:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao excluir/cancelar horário." },
      { status: 500 }
    );
  }
}
