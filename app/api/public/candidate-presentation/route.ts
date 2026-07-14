import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}


function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase não configurado.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function clean(value: any) {
  return String(value || "").trim();
}

function normalizePhone(value: any) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeLookupPhone(value: any) {
  return String(value || "").replace(/\D/g, "");
}

async function attachCandidateResumes(
  presentations: any[],
  companyId: string
) {
  const presentationCandidates = presentations.flatMap(
    (presentation: any) => presentation.candidates || []
  );

  if (!presentationCandidates.length) return presentations;

  const candidateIds = Array.from(
    new Set(
      presentationCandidates
        .map((candidate: any) => clean(candidate.candidate_id))
        .filter(Boolean)
    )
  );

  const emails = Array.from(
    new Set(
      presentationCandidates
        .map((candidate: any) => clean(candidate.candidate_email).toLowerCase())
        .filter(Boolean)
    )
  );

  const phones = Array.from(
    new Set(
      presentationCandidates
        .flatMap((candidate: any) => [
          normalizeLookupPhone(candidate.candidate_phone),
        ])
        .filter(Boolean)
    )
  );

  const orFilters: any[] = [];

  if (candidateIds.length) {
    orFilters.push({ id: { in: candidateIds } });
  }

  if (emails.length) {
    orFilters.push({ email: { in: emails, mode: "insensitive" } });
  }

  if (phones.length) {
    orFilters.push(
      { phone: { in: phones } },
      { mobile: { in: phones } }
    );
  }

  if (!orFilters.length) return presentations;

  const profiles = await prisma.candidateProfile.findMany({
    where: {
      OR: orFilters,
    },
    select: {
      id: true,
      email: true,
      phone: true,
      mobile: true,
      resumeFileUrl: true,
    },
  });

  function findProfile(candidate: any) {
    const candidateId = clean(candidate.candidate_id);
    const candidateEmail = clean(candidate.candidate_email).toLowerCase();
    const candidatePhone = normalizeLookupPhone(candidate.candidate_phone);

    return profiles.find((profile: any) => {
      if (candidateId && profile.id === candidateId) return true;

      if (
        candidateEmail &&
        clean(profile.email).toLowerCase() === candidateEmail
      ) {
        return true;
      }

      const profilePhone = normalizeLookupPhone(profile.phone);
      const profileMobile = normalizeLookupPhone(profile.mobile);

      return Boolean(
        candidatePhone &&
          (candidatePhone === profilePhone || candidatePhone === profileMobile)
      );
    });
  }

  return presentations.map((presentation: any) => ({
    ...presentation,
    candidates: (presentation.candidates || []).map((candidate: any) => {
      const profile = findProfile(candidate);

      return {
        ...candidate,
        candidate_phone:
          clean(candidate.candidate_phone) ||
          clean(profile?.mobile) ||
          clean(profile?.phone) ||
          null,
        candidate_email:
          clean(candidate.candidate_email) ||
          clean(profile?.email) ||
          null,
        resume_file_url:
          clean(candidate.resume_file_url) ||
          clean(candidate.resume_url) ||
          clean(profile?.resumeFileUrl) ||
          null,
      };
    }),
  }));
}

async function createHiringFromClientApproval({
  supabase,
  presentation,
  candidate,
}: {
  supabase: any;
  presentation: any;
  candidate: any;
}) {
  const candidatePhone = normalizePhone(candidate?.candidate_phone);
  const candidateEmail = clean(candidate?.candidate_email).toLowerCase();

  const companyId = clean(presentation.company_id);
  const jobId = clean(presentation.job_id || candidate.job_id) || null;

  if (!companyId) {
    throw new Error("company_id ausente na apresentação.");
  }

  if (!candidate?.id && !candidate?.lead_id && !candidatePhone && !candidateEmail && !candidate?.candidate_name) {
    throw new Error("Dados do candidato insuficientes para criar contratação.");
  }

  let existing: any = null;

  async function findExisting(queryBuilder: any) {
    const { data, error } = await queryBuilder
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("FIND EXISTING HIRING ERROR:", error);
      return null;
    }

    return data || null;
  }

  if (candidate?.lead_id) {
    let query = supabase
      .from("rh_hirings")
      .select("*")
      .eq("company_id", companyId)
      .eq("lead_id", candidate.lead_id);

    if (jobId) query = query.eq("job_id", jobId);

    existing = await findExisting(query);
  }

  if (!existing && candidate?.candidate_id) {
    let query = supabase
      .from("rh_hirings")
      .select("*")
      .eq("company_id", companyId)
      .eq("candidate_id", candidate.candidate_id);

    if (jobId) query = query.eq("job_id", jobId);

    existing = await findExisting(query);
  }

  if (!existing && candidatePhone) {
    let query = supabase
      .from("rh_hirings")
      .select("*")
      .eq("company_id", companyId)
      .eq("candidate_phone", candidatePhone);

    if (jobId) query = query.eq("job_id", jobId);

    existing = await findExisting(query);
  }

  if (!existing && candidateEmail) {
    let query = supabase
      .from("rh_hirings")
      .select("*")
      .eq("company_id", companyId)
      .ilike("candidate_email", candidateEmail);

    if (jobId) query = query.eq("job_id", jobId);

    existing = await findExisting(query);
  }

  // IMPORTANTE:
  // Usar somente colunas que a tela/API de contratações já usa em rh_hirings.
  // Não enviar phone, email, start_date ou meeting_url, porque podem não existir na tabela.
  const now = new Date().toISOString();

  const payload: any = {
    company_id: companyId,
    branch_id: presentation.branch_id || candidate.branch_id || null,

    lead_id: candidate.lead_id || null,
    candidate_id: candidate.candidate_id || null,
    job_id: jobId,

    candidate_name: candidate.candidate_name || "Candidato",
    candidate_phone: candidatePhone || null,
    candidate_email: candidateEmail || null,

    job_title: candidate.job_title || presentation.title || "Vaga",
    status: "pending_documents",
    contract_type: "CLT",
    hired_at: now,
    notes: [
      "Criado automaticamente após aprovação do cliente na apresentação de candidatos.",
      candidate.client_notes ? `Observação do cliente: ${candidate.client_notes}` : "",
      candidate.resume_file_url ? `Currículo: ${candidate.resume_file_url}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    updated_at: now,
  };

  if (existing?.id) {
    const { data, error } = await supabase
      .from("rh_hirings")
      .update(payload)
      .eq("id", existing.id)
      .eq("company_id", companyId)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("UPDATE HIRING FROM CLIENT APPROVAL ERROR:", error);
      throw new Error(`Erro ao atualizar contratação: ${error.message}`);
    }

    return data || existing;
  }

  const { data, error } = await supabase
    .from("rh_hirings")
    .insert({
      ...payload,
      created_at: now,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("CREATE HIRING FROM CLIENT APPROVAL ERROR:", error);
    throw new Error(`Erro ao criar contratação: ${error.message}`);
  }

  return data || null;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);
    const token = clean(searchParams.get("token"));

    if (!token) return NextResponse.json({ error: "Token obrigatório." }, { status: 400 });

    const { data: presentation, error } = await supabase
      .from("rh_client_presentations")
      .select(`
        *,
        candidates:rh_client_presentation_candidates(*)
      `)
      .eq("token", token)
      .maybeSingle();

    if (error) {
      console.error("PUBLIC PRESENTATION FIND ERROR:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!presentation?.id) {
      return NextResponse.json({ error: "Link não encontrado." }, { status: 404 });
    }

    if (presentation.expires_at && new Date(presentation.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Este link expirou." }, { status: 410 });
    }

    if (presentation.status === "draft") {
      await supabase
        .from("rh_client_presentations")
        .update({
          status: "viewed",
          viewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", presentation.id);
    } else if (!presentation.viewed_at) {
      await supabase
        .from("rh_client_presentations")
        .update({
          viewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", presentation.id);
    }

    const [presentationWithResume] = await attachCandidateResumes(
      [presentation],
      clean(presentation.company_id)
    );

    return NextResponse.json({
      success: true,
      presentation: presentationWithResume || presentation,
    });
  } catch (error: any) {
    console.error("GET /api/public/candidate-presentation:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao carregar candidatos." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();

    const token = clean(body.token);
    const candidateId = clean(body.candidateId || body.candidate_id);
    const decision = clean(body.decision);
    const notes = clean(body.notes);

    if (!token || !candidateId || !["approved", "rejected"].includes(decision)) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const { data: presentation, error: presentationError } = await supabase
      .from("rh_client_presentations")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (presentationError) {
      console.error("PUBLIC PRESENTATION DECISION FIND ERROR:", presentationError);
      return NextResponse.json({ error: presentationError.message }, { status: 500 });
    }

    if (!presentation?.id) {
      return NextResponse.json({ error: "Link não encontrado." }, { status: 404 });
    }

    const nextStatus = decision === "approved" ? "approved_by_client" : "rejected_by_client";

    const { data: candidate, error: candidateError } = await supabase
      .from("rh_client_presentation_candidates")
      .update({
        status: nextStatus,
        client_notes: notes || null,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", candidateId)
      .eq("presentation_id", presentation.id)
      .select("*")
      .maybeSingle();

    if (candidateError) {
      console.error("PUBLIC CANDIDATE DECISION ERROR:", candidateError);
      return NextResponse.json({ error: candidateError.message }, { status: 500 });
    }

    let hiring = null;

    if (decision === "approved" && candidate?.id) {
      hiring = await createHiringFromClientApproval({
        supabase,
        presentation,
        candidate,
      });

      if (!hiring?.id) {
        return NextResponse.json(
          { error: "Cliente aprovou, mas a contratação não foi criada." },
          { status: 500 }
        );
      }

      await supabase
        .from("rh_client_presentation_candidates")
        .update({
          status: "sent_to_hiring",
          updated_at: new Date().toISOString(),
        })
        .eq("id", candidate.id);
    }

    return NextResponse.json({
      success: true,
      candidate,
      hiring,
    });
  } catch (error: any) {
    console.error("POST /api/public/candidate-presentation:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao salvar decisão." },
      { status: 500 }
    );
  }
}
