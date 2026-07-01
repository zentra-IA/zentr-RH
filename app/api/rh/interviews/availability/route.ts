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
    approved: "aprovado",
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

  const starts = slots
    .map((slot) => new Date(slotStart(slot)).getTime())
    .filter((time) => !Number.isNaN(time));

  if (!starts.length) {
    return slots.map((slot) => {
      const fallback = fallbackAttendeeFromSlot(slot);
      return {
        ...slot,
        attendees: fallback ? [fallback] : [],
      };
    });
  }

  const from = new Date(Math.min(...starts) - 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(Math.max(...starts) + 24 * 60 * 60 * 1000).toISOString();

  let interviews: any[] = [];

  try {
    const { data, error } = await supabase
      .from("rh_interviews")
      .select("*")
      .eq("company_id", companyId)
      .gte("start_at", from)
      .lte("start_at", to)
      .order("start_at", { ascending: true })
      .limit(3000);

    if (!error && Array.isArray(data)) interviews = data;
    if (error) console.error("ATTACH ATTENDEES rh_interviews ERROR:", error);
  } catch (error) {
    console.error("ATTACH ATTENDEES rh_interviews FAILED:", error);
  }

  return slots.map((slot) => {
    const attendees = interviews
      .filter((interview) => interviewBelongsToSlot(interview, slot))
      .map(attendeeFromInterview);

    const seen = new Set<string>();
    const unique = attendees.filter((person) => {
      const key =
        String(person.interview_id || "") ||
        String(person.lead_id || "") ||
        String(person.phone || "") ||
        String(person.email || "");
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const fallback = fallbackAttendeeFromSlot(slot);
    if (fallback) {
      const hasFallback =
        (fallback.lead_id && unique.some((person) => String(person.lead_id) === String(fallback.lead_id))) ||
        (fallback.phone && unique.some((person) => normalizePhone(person.phone) === normalizePhone(fallback.phone))) ||
        (fallback.email && unique.some((person) => normalizeText(person.email) === normalizeText(fallback.email)));

      if (!hasFallback) unique.unshift(fallback);
    }

    return {
      ...slot,
      attendees: unique,
      confirmed_candidates: unique,
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
    approved: "contratado",
    rejected: "reprovado",
    no_show: "nao_compareceu",
    reschedule: "quer_agendar_entrevista",
  };

  const leadStatus = leadStatusMap[status] || status;

  let query = supabase.from("leads").select("*").eq("company_id", companyId).limit(1);

  if (leadId) {
    query = query.eq("id", leadId);
  } else if (phone) {
    query = query.eq("phone", normalizePhone(phone));
  } else if (email) {
    query = query.eq("email", clean(email));
  } else {
    return null;
  }

  const { data: found } = await query.maybeSingle();

  if (!found?.id) return null;

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
  const status = clean(body.status);
  const interviewId = clean(body.interviewId || body.interview_id);
  const leadId = clean(body.leadId || body.lead_id);
  const phone = normalizePhone(body.candidatePhone || body.phone);
  const email = clean(body.candidateEmail || body.email);
  const jobId = slotJobId(slot) || null;

  const allowed = ["approved", "rejected", "no_show", "reschedule"];
  if (!allowed.includes(status)) {
    return { error: "Status de candidato inválido.", statusCode: 400 };
  }

  let interview: any = null;

  if (interviewId) {
    const { data, error } = await supabase
      .from("rh_interviews")
      .select("*")
      .eq("company_id", companyId)
      .eq("id", interviewId)
      .maybeSingle();

    if (error) console.error("FIND INTERVIEW BY ID ERROR:", error);
    interview = data || null;
  }

  if (!interview && leadId) {
    let query = supabase
      .from("rh_interviews")
      .select("*")
      .eq("company_id", companyId)
      .eq("lead_id", leadId)
      .limit(1);

    if (slotStart(slot)) query = query.eq("start_at", slotStart(slot));
    if (jobId) query = query.eq("job_id", jobId);

    const { data, error } = await query.maybeSingle();

    if (error) console.error("FIND INTERVIEW BY LEAD ERROR:", error);
    interview = data || null;
  }

  if (!interview && (phone || email)) {
    let query = supabase
      .from("rh_interviews")
      .select("*")
      .eq("company_id", companyId)
      .eq("start_at", slotStart(slot))
      .limit(20);

    if (jobId) query = query.eq("job_id", jobId);

    const { data, error } = await query;

    if (error) console.error("FIND INTERVIEW BY PHONE/EMAIL ERROR:", error);

    interview =
      (data || []).find((item: any) => {
        const samePhone =
          phone &&
          normalizePhone(item.candidate_phone || item.telefone_candidato || item.phone) === phone;
        const sameEmail =
          email &&
          normalizeText(item.candidate_email || item.email_candidato || item.email) === normalizeText(email);
        return samePhone || sameEmail;
      }) || null;
  }

  const interviewStatus = status === "reschedule" ? "scheduled" : status;

  if (interview?.id) {
    const { error } = await supabase
      .from("rh_interviews")
      .update({
        status: interviewStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", interview.id)
      .eq("company_id", companyId);

    if (error) {
      console.error("UPDATE INTERVIEW STATUS ERROR:", error);
      return { error: error.message || "Erro ao atualizar entrevista.", statusCode: 500 };
    }
  }

  const finalLeadId = leadId || interview?.lead_id || null;
  const finalPhone = phone || normalizePhone(interview?.candidate_phone || interview?.phone) || null;
  const finalEmail = email || interview?.candidate_email || interview?.email || null;

  const lead = await updateLeadStatusForInterview({
    supabase,
    companyId,
    leadId: finalLeadId,
    phone: finalPhone,
    email: finalEmail,
    status,
    jobId,
  });

  if (!interview?.id && !lead?.id) {
    return {
      error: "Não encontrei esse candidato nos agendados. Atualize a página e tente novamente.",
      statusCode: 404,
    };
  }

  return {
    success: true,
    interview,
    lead,
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
      const result = await updateCandidateInterviewStatus({
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
