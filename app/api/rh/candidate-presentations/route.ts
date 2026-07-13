import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";
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
      company_id: companyId,
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
        resume_file_url:
          clean(candidate.resume_file_url) ||
          clean(candidate.resume_url) ||
          clean(profile?.resumeFileUrl) ||
          null,
      };
    }),
  }));
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { companyId } = await requireCompany(req);
    const { searchParams } = new URL(req.url);

    const jobId = clean(searchParams.get("jobId") || searchParams.get("job_id"));
    const status = clean(searchParams.get("status"));
    const workflowStatus = clean(searchParams.get("workflowStatus") || searchParams.get("workflow_status"));
    const q = clean(searchParams.get("q"));

    let query = supabase
      .from("rh_client_presentations")
      .select(`
        *,
        candidates:rh_client_presentation_candidates(*)
      `)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (jobId) query = query.eq("job_id", jobId);
    if (status && status !== "all") query = query.eq("status", status);
    if (workflowStatus && workflowStatus !== "all") {
      query = query.eq("workflow_status", workflowStatus);
    }

    const { data, error } = await query;

    if (error) {
      console.error("GET CLIENT PRESENTATIONS ERROR:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let presentations = await attachCandidateResumes(data || [], companyId);

    if (q) {
      const normalized = q.toLowerCase();

      presentations = presentations.filter((item: any) => {
        const title = String(item.title || "").toLowerCase();
        const token = String(item.token || "").toLowerCase();

        const hasCandidate = (item.candidates || []).some((candidate: any) => {
          return [
            candidate.candidate_name,
            candidate.candidate_phone,
            candidate.candidate_email,
            candidate.job_title,
          ]
            .map((value) => String(value || "").toLowerCase())
            .some((value) => value.includes(normalized));
        });

        return title.includes(normalized) || token.includes(normalized) || hasCandidate;
      });
    }

    return NextResponse.json({ success: true, presentations });
  } catch (error: any) {
    console.error("GET /api/rh/candidate-presentations:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao carregar apresentações." },
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

    const update: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.status !== undefined) {
      const status = clean(body.status);
      if (!["draft", "sent", "viewed", "finished"].includes(status)) {
        return NextResponse.json({ error: "Status inválido." }, { status: 400 });
      }

      update.status = status;
      if (status === "sent") update.sent_at = new Date().toISOString();
    }

    if (body.title !== undefined) update.title = clean(body.title) || null;
    if (body.workflow_status !== undefined || body.workflowStatus !== undefined) {
      const workflowStatus = clean(
        body.workflow_status !== undefined
          ? body.workflow_status
          : body.workflowStatus
      );

      if (!["in_progress", "paused", "finished", "cancelled"].includes(workflowStatus)) {
        return NextResponse.json(
          { error: "Status do processo inválido." },
          { status: 400 }
        );
      }

      update.workflow_status = workflowStatus;

      if (workflowStatus === "finished") {
        update.status = "finished";
      }
    }


    const { data, error } = await supabase
      .from("rh_client_presentations")
      .update(update)
      .eq("id", id)
      .eq("company_id", companyId)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("PATCH CLIENT PRESENTATION ERROR:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Apresentação não encontrada ou não pertence à empresa atual." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, presentation: data });
  } catch (error: any) {
    console.error("PATCH /api/rh/candidate-presentations:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar apresentação." },
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

    const { data: existing, error: findError } = await supabase
      .from("rh_client_presentations")
      .select("id")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json(
        { error: "Apresentação não encontrada ou não pertence à empresa atual." },
        { status: 404 }
      );
    }

    const { data: deleted, error } = await supabase
      .from("rh_client_presentations")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId)
      .select("id");

    if (error) {
      console.error("DELETE CLIENT PRESENTATION ERROR:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!deleted?.length) {
      return NextResponse.json(
        { error: "A apresentação não foi excluída." },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, deleted: true, id });
  } catch (error: any) {
    console.error("DELETE /api/rh/candidate-presentations:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao excluir apresentação." },
      { status: 500 }
    );
  }
}
