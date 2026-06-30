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

    return NextResponse.json({ success: true, slots: data || [] });
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
