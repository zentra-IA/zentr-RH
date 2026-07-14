import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) throw new Error("Supabase não configurado.");

  return createClient(url, key);
}

function clean(value: any) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function toArray(value: any) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value).split(",").map((x) => x.trim()).filter(Boolean);
}

function normalizePhone(value: any) {
  let phone = String(value || "").replace(/\D/g, "");
  if (!phone) return "";
  if (!phone.startsWith("55")) phone = `55${phone}`;
  return phone;
}

function getCandidateScore(candidate: any) {
  const score =
    candidate?.aiExtractedData?.match?.score ||
    candidate?.aiExtractedData?.score ||
    candidate?.score ||
    0;

  return Number(score || 0);
}

async function getJob(supabase: any, companyId: string, jobId: string) {
  const { data, error } = await supabase
    .from("Job")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", jobId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Vaga não encontrada.");

  return data;
}

async function getCandidates(supabase: any, companyId: string, candidateIds: string[]) {
  /*
    A base de currículos é compartilhada entre as empresas.
    O isolamento continua sendo aplicado à vaga, ao lote e aos leads,
    mas não na leitura dos CandidateProfile selecionados.
  */
  const { data, error } = await supabase
    .from("CandidateProfile")
    .select("*")
    .in("id", candidateIds);

  if (error) throw new Error(error.message);

  return data || [];
}

async function findOrCreateLead({
  supabase,
  companyId,
  branchId,
  candidate,
  job,
  batchId,
}: {
  supabase: any;
  companyId: string;
  branchId?: string | null;
  candidate: any;
  job: any;
  batchId: string;
}) {
  const phone = normalizePhone(candidate.mobile || candidate.phone);

  if (!phone) return null;

  const { data: existing } = await supabase
    .from("leads")
    .select("*")
    .eq("company_id", companyId)
    .eq("phone", phone)
    .maybeSingle();

  const payload: any = {
    name: candidate.name || "Candidato",
    phone,
    email: candidate.email || null,
    status: "selecionado_vaga",
    job_id: job.id,
    batch_id: batchId,
    current_job_id: job.id,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { data, error } = await supabase
      .from("leads")
      .update(payload)
      .eq("id", existing.id)
      .eq("company_id", companyId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await supabase
    .from("leads")
    .insert({
      company_id: companyId,
      branch_id: branchId || candidate.branch_id || null,
      ...payload,
      conversation_stage: "new",
      ai_paused: false,
      paused: false,
      opt_out: false,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return data;
}

async function enqueueLead({
  supabase,
  companyId,
  branchId,
  lead,
  candidate,
  job,
  batchId,
  intent,
}: {
  supabase: any;
  companyId: string;
  branchId?: string | null;
  lead: any;
  candidate: any;
  job: any;
  batchId: string;
  intent: string;
}) {
  const phone = normalizePhone(lead?.phone || candidate.mobile || candidate.phone);

  if (!phone) return false;

  const { error } = await supabase.from("automation_queue").insert({
    company_id: companyId,
    branch_id: branchId || candidate.branch_id || null,
    lead_id: lead?.id || null,
    job_id: job.id,
    batch_id: batchId,
    phone,
    type: "campaign",
    intent: intent || "RH_ABERTURA",
    status: "pending",
    paused: false,
    scheduled_at: new Date().toISOString(),
    attempts: 0,
    error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);

  return true;
}

async function getBatchCandidates(supabase: any, companyId: string, batchId: string) {
  const { data, error } = await supabase
    .from("recruitment_batch_candidates")
    .select("*")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const items = data || [];
  const leadIds = items.map((item: any) => item.lead_id).filter(Boolean);
  const candidateIds = items.map((item: any) => item.candidate_id).filter(Boolean);

  let leads: any[] = [];
  let candidates: any[] = [];

  if (leadIds.length) {
    const { data: leadData } = await supabase
      .from("leads")
      .select("*")
      .eq("company_id", companyId)
      .in("id", leadIds);

    leads = leadData || [];
  }

  if (candidateIds.length) {
    const { data: candidateData } = await supabase
      .from("CandidateProfile")
      .select("*")
      .in("id", candidateIds);

    candidates = candidateData || [];
  }

  const leadMap = new Map(leads.map((lead: any) => [String(lead.id), lead]));
  const candidateMap = new Map(candidates.map((candidate: any) => [String(candidate.id), candidate]));

  return items.map((item: any) => ({
    ...item,
    lead: item.lead_id ? leadMap.get(String(item.lead_id)) || null : null,
    candidate: item.candidate_id ? candidateMap.get(String(item.candidate_id)) || null : null,
  }));
}

async function enqueueBatch({
  supabase,
  companyId,
  branchId,
  batchId,
  intent,
}: {
  supabase: any;
  companyId: string;
  branchId?: string | null;
  batchId: string;
  intent: string;
}) {
  const { data: batch, error: batchError } = await supabase
    .from("recruitment_batches")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", batchId)
    .maybeSingle();

  if (batchError) throw new Error(batchError.message);
  if (!batch) throw new Error("Lote não encontrado.");

  const job = await getJob(supabase, companyId, batch.job_id);

  const members = await getBatchCandidates(supabase, companyId, batchId);

  let queued = 0;

  for (const member of members) {
    if (["queued", "sent", "answered", "interview", "hired"].includes(member.status)) {
      continue;
    }

    const lead = member.lead;
    const candidate = member.candidate || {};

    if (!lead?.id && !member.phone) continue;

    const ok = await enqueueLead({
      supabase,
      companyId,
      branchId,
      lead: lead || { id: null, phone: member.phone },
      candidate: {
        ...candidate,
        phone: member.phone || candidate.phone,
        mobile: member.phone || candidate.mobile,
        branch_id: candidate.branch_id || branchId,
      },
      job,
      batchId,
      intent,
    });

    if (ok) {
      queued++;

      await supabase
        .from("recruitment_batch_candidates")
        .update({
          status: "queued",
          contacted_at: new Date().toISOString(),
        })
        .eq("id", member.id);
    }
  }

  await supabase
    .from("recruitment_batches")
    .update({
      status: queued > 0 ? "queued" : batch.status,
      total_sent: Number(batch.total_sent || 0),
      updated_at: new Date().toISOString(),
    })
    .eq("id", batchId)
    .eq("company_id", companyId);

  return { batch, queued };
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId } = await requireCompany(req);
    const { searchParams } = new URL(req.url);

    const id = clean(searchParams.get("id"));
    const jobId = clean(searchParams.get("jobId") || searchParams.get("job_id"));

    if (id) {
      const { data: batch, error } = await supabase
        .from("recruitment_batches")
        .select("*")
        .eq("company_id", companyId)
        .eq("id", id)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!batch) return NextResponse.json({ error: "Lote não encontrado." }, { status: 404 });

      const members = await getBatchCandidates(supabase, companyId, id);

      let job: any = null;

      try {
        job = await getJob(supabase, companyId, batch.job_id);
      } catch {}

      return NextResponse.json({
        success: true,
        batch,
        job,
        candidates: members,
      });
    }

    let query = supabase
      .from("recruitment_batches")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (jobId) query = query.eq("job_id", jobId);

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    const batches = data || [];
    const jobIds = [...new Set(batches.map((item: any) => item.job_id).filter(Boolean))];

    let jobs: any[] = [];

    if (jobIds.length) {
      const { data: jobData } = await supabase
        .from("Job")
        .select("*")
        .eq("company_id", companyId)
        .in("id", jobIds);

      jobs = jobData || [];
    }

    const jobMap = new Map(jobs.map((job: any) => [String(job.id), job]));

    return NextResponse.json({
      success: true,
      batches: batches.map((batch: any) => ({
        ...batch,
        job: batch.job_id ? jobMap.get(String(batch.job_id)) || null : null,
      })),
    });
  } catch (error: any) {
    console.error("GET /api/rh/recruitment-batches:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao carregar lotes." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId, branchId } = await requireCompany(req);
    const body = await req.json();

    const jobId = clean(body.jobId || body.job_id);
    const candidateIds = toArray(body.candidateIds || body.candidate_ids);
    const enqueue = Boolean(body.enqueue);
    const intent = clean(body.intent || "RH_ABERTURA") || "RH_ABERTURA";

    if (!jobId) {
      return NextResponse.json({ error: "jobId obrigatório." }, { status: 400 });
    }

    if (!candidateIds.length) {
      return NextResponse.json(
        { error: "Selecione pelo menos um candidato." },
        { status: 400 }
      );
    }

    const job = await getJob(supabase, companyId, jobId);
    const candidates = await getCandidates(supabase, companyId, candidateIds);

    if (!candidates.length) {
      return NextResponse.json(
        { error: "Nenhum candidato encontrado." },
        { status: 404 }
      );
    }

    const batchName =
      clean(body.batchName || body.name) ||
      `Lote ${job.title || "Vaga"} - ${new Date().toLocaleDateString("pt-BR")}`;

    const { data: batch, error: batchError } = await supabase
      .from("recruitment_batches")
      .insert({
        company_id: companyId,
        branch_id: branchId || null,
        job_id: job.id,
        name: batchName,
        status: enqueue ? "queued" : "created",
        total_candidates: candidates.length,
        total_sent: 0,
        total_answered: 0,
        total_interviews: 0,
        total_hired: 0,
        total_rejected: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (batchError) throw new Error(batchError.message);

    let queued = 0;

    for (const candidate of candidates) {
      const lead = await findOrCreateLead({
        supabase,
        companyId,
        branchId,
        candidate,
        job,
        batchId: batch.id,
      });

      const { error: memberError } = await supabase
        .from("recruitment_batch_candidates")
        .insert({
          batch_id: batch.id,
          candidate_id: candidate.id,
          lead_id: lead?.id || null,
          job_id: job.id,
          phone: normalizePhone(candidate.mobile || candidate.phone),
          email: candidate.email || null,
          score: getCandidateScore(candidate),
          status: enqueue ? "queued" : "selected",
          created_at: new Date().toISOString(),
        });

      if (memberError) throw new Error(memberError.message);

      if (enqueue && lead) {
        const ok = await enqueueLead({
          supabase,
          companyId,
          branchId,
          lead,
          candidate,
          job,
          batchId: batch.id,
          intent,
        });

        if (ok) queued++;
      }
    }

    await supabase
      .from("recruitment_batches")
      .update({
        status: enqueue ? "queued" : "created",
        updated_at: new Date().toISOString(),
      })
      .eq("id", batch.id)
      .eq("company_id", companyId);

    return NextResponse.json({
      success: true,
      batchId: batch.id,
      batch,
      totalCandidates: candidates.length,
      queued,
    });
  } catch (error: any) {
    console.error("POST /api/rh/recruitment-batches:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao criar lote da vaga." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId, branchId } = await requireCompany(req);
    const body = await req.json();

    const id = clean(body.id);
    const action = clean(body.action);

    if (!id) {
      return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    }

    if (action === "enqueue") {
      const result = await enqueueBatch({
        supabase,
        companyId,
        branchId,
        batchId: id,
        intent: clean(body.intent || "RH_ABERTURA") || "RH_ABERTURA",
      });

      return NextResponse.json({
        success: true,
        queued: result.queued,
        batch: result.batch,
      });
    }

    const update: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) update.name = clean(body.name);
    if (body.status !== undefined) update.status = clean(body.status);

    const { data, error } = await supabase
      .from("recruitment_batches")
      .update(update)
      .eq("id", id)
      .eq("company_id", companyId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      batch: data,
    });
  } catch (error: any) {
    console.error("PATCH /api/rh/recruitment-batches:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar lote." },
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

    if (!id) {
      return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    }

    const { error: queueError } = await supabase
      .from("automation_queue")
      .delete()
      .eq("company_id", companyId)
      .eq("batch_id", id)
      .in("status", ["pending", "failed"]);

    if (queueError) throw new Error(queueError.message);

    const { error } = await supabase
      .from("recruitment_batches")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("DELETE /api/rh/recruitment-batches:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao excluir lote." },
      { status: 500 }
    );
  }
}
