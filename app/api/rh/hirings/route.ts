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

function normalizeEmail(value: any) {
  const email = clean(value).toLowerCase();
  return email || null;
}

function normalizeStatus(value: any) {
  const status = clean(value || "pending_documents");

  const allowed = [
    "approved",
    "pending_documents",
    "documents_review",
    "documents_approved",
    "admission_scheduled",
    "hired",
    "finished",
    "terminated",
    "canceled",
  ];

  return allowed.includes(status) ? status : "pending_documents";
}

function parseDate(value: any) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function parseDateTime(value: any) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseMoney(value: any) {
  if (value === undefined || value === null || value === "") return null;
  const raw = clean(value).replace(/[^\d,.-]/g, "").replace(",", ".");
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function normalizeHiring(row: any) {
  if (!row) return row;

  return {
    ...row,

    name: row.candidate_name,
    phone: row.candidate_phone,
    email: row.candidate_email,

    candidateName: row.candidate_name,
    candidatePhone: row.candidate_phone,
    candidateEmail: row.candidate_email,

    jobTitle: row.job_title,
    contractType: row.contract_type,
    startDate: row.contract_start,
    endDate: row.contract_end,
  };
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
    console.error("GET LEAD BY ID FOR HIRING ERROR:", error);
    return null;
  }

  return data || null;
}

async function findLeadForHiring({
  supabase,
  companyId,
  body,
}: {
  supabase: any;
  companyId: string;
  body: any;
}) {
  const leadId = clean(body.leadId || body.lead_id);
  const phone = normalizePhone(
    body.candidate_phone ||
      body.candidatePhone ||
      body.phone ||
      body.whatsapp ||
      body.mobile ||
      body.telefone
  );
  const email = normalizeEmail(
    body.candidate_email ||
      body.candidateEmail ||
      body.email
  );
  const lid = clean(body.whatsapp_lid || body.lid || body.remote_jid);

  let lead = await getLeadById(supabase, companyId, leadId);
  if (lead?.id) return lead;

  if (phone) {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("company_id", companyId)
      .eq("phone", phone)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (!error && data?.id) return data;
  }

  if (email) {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("company_id", companyId)
      .ilike("email", email)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (!error && data?.id) return data;
  }

  if (lid) {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("company_id", companyId)
      .or(`whatsapp_lid.eq.${lid},remote_jid.eq.${lid}`)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (!error && data?.id) return data;
  }

  return null;
}

async function getJobTitle(supabase: any, companyId: string, jobId?: string | null) {
  if (!jobId) return "";

  const attempts = [
    () =>
      supabase
        .from("Job")
        .select("*")
        .eq("company_id", companyId)
        .eq("id", jobId)
        .maybeSingle(),
    () =>
      supabase
        .from("jobs")
        .select("*")
        .eq("company_id", companyId)
        .eq("id", jobId)
        .maybeSingle(),
    () =>
      supabase
        .from("rh_jobs")
        .select("*")
        .eq("company_id", companyId)
        .eq("id", jobId)
        .maybeSingle(),
  ];

  for (const attempt of attempts) {
    try {
      const { data, error } = await attempt();
      if (!error && data) return clean(data.title || data.name || data.position);
    } catch {}
  }

  return "";
}

async function updateLeadAfterHiring({
  supabase,
  companyId,
  leadId,
  status,
  jobId,
  batchId,
  name,
  phone,
  email,
}: {
  supabase: any;
  companyId: string;
  leadId?: string | null;
  status: string;
  jobId?: string | null;
  batchId?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  if (!leadId) return null;

  const payload: any = {
    status,
    ai_paused: true,
    paused: true,
    updated_at: new Date().toISOString(),
  };

  if (name) payload.name = name;
  if (phone) payload.phone = phone;
  if (email) payload.email = email;

  if (jobId) {
    payload.job_id = jobId;
    payload.current_job_id = jobId;
  }

  if (batchId) payload.batch_id = batchId;

  const { data, error } = await supabase
    .from("leads")
    .update(payload)
    .eq("id", leadId)
    .eq("company_id", companyId)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("UPDATE LEAD AFTER HIRING ERROR:", error);
    return null;
  }

  return data || null;
}

async function syncInterviewAfterHiring({
  supabase,
  companyId,
  leadId,
  status,
}: {
  supabase: any;
  companyId: string;
  leadId?: string | null;
  status: string;
}) {
  if (!leadId) return;

  const interviewStatus =
    status === "aprovado" || status === "contratado"
      ? "approved"
      : status === "nao_aprovado" || status === "sem_interesse"
        ? "rejected"
        : null;

  if (!interviewStatus) return;

  const { error } = await supabase
    .from("rh_interview_slots")
    .update({
      status: interviewStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", companyId)
    .eq("lead_id", leadId);

  if (error) {
    console.error("SYNC INTERVIEW AFTER HIRING ERROR:", error);
  }
}

function buildPayload({
  body,
  companyId,
  branchId,
  lead,
  jobTitleFallback,
}: {
  body: any;
  companyId: string;
  branchId?: string | null;
  lead?: any;
  jobTitleFallback?: string;
}) {
  const leadId = clean(body.leadId || body.lead_id || lead?.id) || null;
  const candidateId = clean(body.candidateId || body.candidate_id) || null;

  const jobId =
    clean(body.jobId || body.job_id || lead?.job_id || lead?.current_job_id) ||
    null;

  const batchId =
    clean(body.batchId || body.batch_id || lead?.batch_id) || null;

  const candidateName =
    clean(body.candidate_name || body.candidateName || body.name || lead?.name) ||
    "Candidato";

  const candidatePhone =
    normalizePhone(
      body.candidate_phone ||
        body.candidatePhone ||
        body.phone ||
        body.whatsapp ||
        body.mobile ||
        body.telefone ||
        lead?.phone
    ) || null;

  const candidateEmail =
    normalizeEmail(
      body.candidate_email ||
        body.candidateEmail ||
        body.email ||
        lead?.email
    );

  const jobTitle =
    clean(body.job_title || body.jobTitle || body.position) ||
    jobTitleFallback ||
    "Sem vaga informada";

  return {
    company_id: companyId,
    branch_id: branchId || body.branch_id || lead?.branch_id || null,

    lead_id: leadId,
    candidate_id: candidateId,
    job_id: jobId,
    batch_id: batchId,

    candidate_name: candidateName,
    candidate_phone: candidatePhone,
    candidate_email: candidateEmail,
    job_title: jobTitle,

    status: normalizeStatus(body.status),
    salary: parseMoney(body.salary),
    contract_type: clean(body.contractType || body.contract_type) || "CLT",
    contract_start: parseDate(
      body.contractStart ||
        body.contract_start ||
        body.startDate ||
        body.start_date
    ),
    contract_end: parseDate(
      body.contractEnd ||
        body.contract_end ||
        body.endDate ||
        body.end_date
    ),
    hired_at:
      parseDateTime(body.hiredAt || body.hired_at) || new Date().toISOString(),

    notes: clean(body.notes) || null,
    updated_at: new Date().toISOString(),
  };
}

async function findExistingHiring(supabase: any, companyId: string, payload: any) {
  if (payload.lead_id) {
    let query = supabase
      .from("rh_hirings")
      .select("*")
      .eq("company_id", companyId)
      .eq("lead_id", payload.lead_id);

    if (payload.job_id) query = query.eq("job_id", payload.job_id);

    const { data } = await query
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (data?.id) return data;
  }

  if (payload.candidate_phone) {
    let query = supabase
      .from("rh_hirings")
      .select("*")
      .eq("company_id", companyId)
      .eq("candidate_phone", payload.candidate_phone);

    if (payload.job_id) query = query.eq("job_id", payload.job_id);

    const { data } = await query
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (data?.id) return data;
  }

  if (payload.candidate_email) {
    let query = supabase
      .from("rh_hirings")
      .select("*")
      .eq("company_id", companyId)
      .ilike("candidate_email", payload.candidate_email);

    if (payload.job_id) query = query.eq("job_id", payload.job_id);

    const { data } = await query
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (data?.id) return data;
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId } = await requireCompany(req);
    const { searchParams } = new URL(req.url);

    const q = clean(searchParams.get("q"));
    const status = clean(searchParams.get("status"));
    const jobId = clean(searchParams.get("jobId") || searchParams.get("job_id"));
    const leadId = clean(searchParams.get("leadId") || searchParams.get("lead_id"));

    let query = supabase
      .from("rh_hirings")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (status && status !== "all") query = query.eq("status", status);
    if (jobId) query = query.eq("job_id", jobId);
    if (leadId) query = query.eq("lead_id", leadId);

    if (q) {
      query = query.or(
        `candidate_name.ilike.%${q}%,job_title.ilike.%${q}%,candidate_phone.ilike.%${q}%,candidate_email.ilike.%${q}%`
      );
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    const hirings = (data || []).map(normalizeHiring);

    const salaries = hirings
      .map((item: any) => Number(item.salary || 0))
      .filter((n: number) => Number.isFinite(n) && n > 0);

    const totalSalary = salaries.reduce((sum: number, n: number) => sum + n, 0);

    return NextResponse.json({
      success: true,
      hirings,
      stats: {
        total: hirings.length,
        totalSalary,
        averageSalary: salaries.length ? totalSalary / salaries.length : 0,
        pendingDocuments: hirings.filter(
          (item: any) => item.status === "pending_documents"
        ).length,
        hired: hirings.filter((item: any) => item.status === "hired").length,
        terminated: hirings.filter((item: any) => item.status === "terminated")
          .length,
      },
    });
  } catch (error: any) {
    console.error("GET /api/rh/hirings:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao carregar contratações." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId, branchId } = await requireCompany(req);
    const body = await req.json();

    const lead = await findLeadForHiring({
      supabase,
      companyId,
      body,
    });

    if (!lead?.id && !normalizePhone(body.phone || body.candidate_phone) && !normalizeEmail(body.email || body.candidate_email)) {
      return NextResponse.json(
        {
          error:
            "Não foi possível identificar o candidato. Envie lead_id, telefone ou e-mail.",
        },
        { status: 400 }
      );
    }

    const jobId =
      clean(body.jobId || body.job_id || lead?.job_id || lead?.current_job_id) ||
      null;

    const jobTitleFallback = await getJobTitle(supabase, companyId, jobId);

    const payload = buildPayload({
      body,
      companyId,
      branchId,
      lead,
      jobTitleFallback,
    });

    if (!payload.candidate_name && !payload.candidate_phone && !payload.candidate_email) {
      return NextResponse.json(
        { error: "Informe pelo menos nome, telefone ou e-mail do candidato." },
        { status: 400 }
      );
    }

    const existing = await findExistingHiring(supabase, companyId, payload);

    if (existing?.id) {
      const { data, error } = await supabase
        .from("rh_hirings")
        .update(payload)
        .eq("id", existing.id)
        .eq("company_id", companyId)
        .select("*")
        .single();

      if (error) throw new Error(error.message);

      const updatedLead = await updateLeadAfterHiring({
        supabase,
        companyId,
        leadId: payload.lead_id,
        status: "contratado",
        jobId: payload.job_id,
        batchId: payload.batch_id,
        name: payload.candidate_name,
        phone: payload.candidate_phone,
        email: payload.candidate_email,
      });

      await syncInterviewAfterHiring({
        supabase,
        companyId,
        leadId: payload.lead_id,
        status: "contratado",
      });

      return NextResponse.json({
        success: true,
        hiring: normalizeHiring(data),
        lead: updatedLead,
        updated: true,
      });
    }

    const { data, error } = await supabase
      .from("rh_hirings")
      .insert({
        ...payload,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    const updatedLead = await updateLeadAfterHiring({
      supabase,
      companyId,
      leadId: payload.lead_id,
      status: "aprovado",
      jobId: payload.job_id,
      batchId: payload.batch_id,
      name: payload.candidate_name,
      phone: payload.candidate_phone,
      email: payload.candidate_email,
    });

    await syncInterviewAfterHiring({
      supabase,
      companyId,
      leadId: payload.lead_id,
      status: "aprovado",
    });

    return NextResponse.json({
      success: true,
      hiring: normalizeHiring(data),
      lead: updatedLead,
      created: true,
    });
  } catch (error: any) {
    console.error("POST /api/rh/hirings:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao criar admissão." },
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

    if (!id) {
      return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    }

    const update: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.status !== undefined) update.status = normalizeStatus(body.status);

    if (
      body.candidate_name !== undefined ||
      body.candidateName !== undefined ||
      body.name !== undefined
    ) {
      update.candidate_name = clean(
        body.candidate_name || body.candidateName || body.name
      );
    }

    if (
      body.candidate_phone !== undefined ||
      body.candidatePhone !== undefined ||
      body.phone !== undefined
    ) {
      update.candidate_phone = normalizePhone(
        body.candidate_phone || body.candidatePhone || body.phone
      );
    }

    if (
      body.candidate_email !== undefined ||
      body.candidateEmail !== undefined ||
      body.email !== undefined
    ) {
      update.candidate_email =
        normalizeEmail(
          body.candidate_email || body.candidateEmail || body.email
        ) || null;
    }

    if (
      body.job_title !== undefined ||
      body.jobTitle !== undefined ||
      body.position !== undefined
    ) {
      update.job_title = clean(body.job_title || body.jobTitle || body.position);
    }

    if (body.job_id !== undefined || body.jobId !== undefined) {
      update.job_id = clean(body.job_id || body.jobId) || null;
    }

    if (body.batch_id !== undefined || body.batchId !== undefined) {
      update.batch_id = clean(body.batch_id || body.batchId) || null;
    }

    if (body.salary !== undefined) update.salary = parseMoney(body.salary);

    if (body.contractType !== undefined || body.contract_type !== undefined) {
      update.contract_type = clean(body.contractType || body.contract_type) || null;
    }

    if (
      body.contractStart !== undefined ||
      body.contract_start !== undefined ||
      body.startDate !== undefined ||
      body.start_date !== undefined
    ) {
      update.contract_start = parseDate(
        body.contractStart ||
          body.contract_start ||
          body.startDate ||
          body.start_date
      );
    }

    if (
      body.contractEnd !== undefined ||
      body.contract_end !== undefined ||
      body.endDate !== undefined ||
      body.end_date !== undefined
    ) {
      update.contract_end = parseDate(
        body.contractEnd || body.contract_end || body.endDate || body.end_date
      );
    }

    if (body.notes !== undefined) update.notes = clean(body.notes) || null;

    const { data, error } = await supabase
      .from("rh_hirings")
      .update(update)
      .eq("id", id)
      .eq("company_id", companyId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    if (data?.lead_id && update.status) {
      const statusMap: Record<string, string> = {
        hired: "contratado",
        finished: "contratado",
        terminated: "sem_interesse",
        canceled: "sem_interesse",
        approved: "aprovado",
        pending_documents: "aprovado",
        documents_review: "aprovado",
        documents_approved: "aprovado",
        admission_scheduled: "aprovado",
      };

      const leadStatus = statusMap[update.status];

      if (leadStatus) {
        await updateLeadAfterHiring({
          supabase,
          companyId,
          leadId: data.lead_id,
          status: leadStatus,
          jobId: data.job_id,
          batchId: data.batch_id,
          name: data.candidate_name,
          phone: data.candidate_phone,
          email: data.candidate_email,
        });

        await syncInterviewAfterHiring({
          supabase,
          companyId,
          leadId: data.lead_id,
          status: leadStatus,
        });
      }
    }

    return NextResponse.json({
      success: true,
      hiring: normalizeHiring(data),
    });
  } catch (error: any) {
    console.error("PATCH /api/rh/hirings:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar admissão." },
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

    const hard = clean(searchParams.get("hard")) === "1";

    if (hard) {
      const { data: existingHiring, error: findError } = await supabase
        .from("rh_hirings")
        .select("id, lead_id, job_id, batch_id, candidate_name, candidate_phone, candidate_email")
        .eq("id", id)
        .eq("company_id", companyId)
        .maybeSingle();

      if (findError) {
        throw new Error(findError.message);
      }

      if (!existingHiring) {
        return NextResponse.json(
          { error: "Contratação não encontrada ou não pertence à empresa atual." },
          { status: 404 }
        );
      }

      const { data: deletedRows, error: deleteError } = await supabase
        .from("rh_hirings")
        .delete()
        .eq("id", id)
        .eq("company_id", companyId)
        .select("id");

      if (deleteError) {
        console.error("HARD DELETE HIRING ERROR:", deleteError);

        const message =
          deleteError.code === "23503"
            ? "Não foi possível excluir porque esta contratação possui registros vinculados. Exclua os documentos/anexos vinculados e tente novamente."
            : deleteError.message;

        return NextResponse.json({ error: message }, { status: 409 });
      }

      if (!deletedRows?.length) {
        return NextResponse.json(
          { error: "A contratação não foi excluída." },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        deleted: true,
        id,
      });
    }

    const { data, error } = await supabase
      .from("rh_hirings")
      .update({
        status: "canceled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("company_id", companyId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    if (data?.lead_id) {
      await updateLeadAfterHiring({
        supabase,
        companyId,
        leadId: data.lead_id,
        status: "sem_interesse",
        jobId: data.job_id,
        batchId: data.batch_id,
        name: data.candidate_name,
        phone: data.candidate_phone,
        email: data.candidate_email,
      });

      await syncInterviewAfterHiring({
        supabase,
        companyId,
        leadId: data.lead_id,
        status: "sem_interesse",
      });
    }

    return NextResponse.json({ success: true, hiring: normalizeHiring(data) });
  } catch (error: any) {
    console.error("DELETE /api/rh/hirings:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao excluir/cancelar admissão." },
      { status: 500 }
    );
  }
}
