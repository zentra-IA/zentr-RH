import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireCompany } from "@/lib/server-company";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

const ALLOWED_STATUS = [
  "scheduled",
  "confirmed",
  "done",
  "canceled",
  "no_show",
  "approved",
  "rejected",
  "hired",
];

function clean(value: any) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeStatus(value: any) {
  const status = clean(value || "scheduled");
  return ALLOWED_STATUS.includes(status) ? status : "scheduled";
}

function parseDate(value: any) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

async function createOrUpdateHiringFromInterview({
  companyId,
  branchId,
  interview,
  targetStatus = "pending_documents",
}: {
  companyId: string;
  branchId?: string | null;
  interview: any;
  targetStatus?: "pending_documents" | "hired";
}) {
  if (!interview?.candidateId) return null;

  const existingHiring = await prisma.hiringProcess.findFirst({
    where: {
      company_id: companyId,
      candidateId: interview.candidateId,
      jobId: interview.jobId || null,
    },
  });

  const position =
    interview?.job?.title ||
    interview?.position ||
    "Admissão RH";

  const notes =
    targetStatus === "hired"
      ? `Contratação gerada automaticamente a partir da entrevista ${interview.id}.`
      : `Admissão criada automaticamente após aprovação na entrevista ${interview.id}.`;

  if (existingHiring) {
    const hiring = await prisma.hiringProcess.update({
      where: {
        id: existingHiring.id,
      },
      data: {
        status: targetStatus,
        position: existingHiring.position || position,
        notes: existingHiring.notes || notes,
      },
      include: {
        candidate: true,
        job: true,
      },
    });

    return hiring;
  }

  const hiring = await prisma.hiringProcess.create({
    data: {
      company_id: companyId,
      branch_id: branchId || interview.branch_id || null,
      candidateId: interview.candidateId,
      jobId: interview.jobId || null,
      position,
      salary: null,
      contractType: null,
      status: targetStatus,
      startDate: null,
      notes,
    },
    include: {
      candidate: true,
      job: true,
    },
  });

  return hiring;
}

export async function GET(req: NextRequest) {
  try {
    const { companyId } = await requireCompany(req);
    const { searchParams } = new URL(req.url);

    const q = clean(searchParams.get("q"));
    const status = clean(searchParams.get("status"));
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: any = {
      company_id: companyId,
    };

    if (status && status !== "all") {
      where.status = normalizeStatus(status);
    }

    if (from || to) {
      where.scheduledAt = {};
      if (from) where.scheduledAt.gte = new Date(from);
      if (to) where.scheduledAt.lte = new Date(to);
    }

    if (q) {
      where.OR = [
        {
          candidate: {
            name: {
              contains: q,
              mode: "insensitive",
            },
          },
        },
        {
          job: {
            title: {
              contains: q,
              mode: "insensitive",
            },
          },
        },
        {
          interviewer: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          location: {
            contains: q,
            mode: "insensitive",
          },
        },
      ];
    }

    const interviews = await prisma.interview.findMany({
      where,
      orderBy: {
        scheduledAt: "asc",
      },
      take: 500,
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            phone: true,
            mobile: true,
            email: true,
            city: true,
            state: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
            city: true,
            state: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      interviews,
    });
  } catch (error: any) {
    console.error("GET /api/rh/interviews:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao carregar entrevistas." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, branchId } = await requireCompany(req);
    const body = await req.json();

    const candidateId = clean(body.candidateId || body.candidate_id);
    const jobId = clean(body.jobId || body.job_id);
    const scheduledAt = parseDate(body.scheduledAt || body.scheduled_at);

    if (!candidateId) {
      return NextResponse.json(
        { error: "candidateId é obrigatório." },
        { status: 400 }
      );
    }

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId é obrigatório." },
        { status: 400 }
      );
    }

    if (!scheduledAt) {
      return NextResponse.json(
        { error: "Data e hora da entrevista são obrigatórias." },
        { status: 400 }
      );
    }

    const candidate = await prisma.candidateProfile.findFirst({
      where: {
        id: candidateId,
        company_id: companyId,
        active: true,
      },
    });

    if (!candidate) {
      return NextResponse.json(
        { error: "Candidato não encontrado." },
        { status: 404 }
      );
    }

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        company_id: companyId,
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Vaga não encontrada." },
        { status: 404 }
      );
    }

    const interview = await prisma.interview.create({
      data: {
        company_id: companyId,
        branch_id: branchId || null,
        candidateId,
        jobId,
        scheduledAt,
        durationMin: Number(body.durationMin || body.duration_min || 30),
        interviewer: clean(body.interviewer) || null,
        meetingUrl: clean(body.meetingUrl || body.meeting_url) || null,
        location: clean(body.location) || null,
        status: normalizeStatus(body.status),
        score:
          body.score !== undefined && body.score !== null && body.score !== ""
            ? Number(body.score)
            : null,
        notes: clean(body.notes) || null,
      },
      include: {
        candidate: true,
        job: true,
      },
    });

    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: {
        status: "entrevista",
        aiExtractedData: {
          ...((candidate.aiExtractedData as any) || {}),
          status: "entrevista",
          lastInterviewAt: scheduledAt.toISOString(),
        },
      },
    });

    await prisma.jobApplication.upsert({
      where: {
        jobId_candidateId: {
          jobId,
          candidateId,
        },
      },
      update: {
        stage: "entrevista",
        status: "active",
      },
      create: {
        company_id: companyId,
        branch_id: branchId || null,
        jobId,
        candidateId,
        source: "Entrevista manual",
        stage: "entrevista",
        status: "active",
        history: {
          createdFrom: "interview",
          interviewId: interview.id,
        },
      },
    });

    return NextResponse.json({
      success: true,
      interview,
    });
  } catch (error: any) {
    console.error("POST /api/rh/interviews:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao criar entrevista." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { companyId, branchId } = await requireCompany(req);
    const body = await req.json();

    const id = clean(body.id);

    if (!id) {
      return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    }

    const existing = await prisma.interview.findFirst({
      where: {
        id,
        company_id: companyId,
      },
      include: {
        candidate: true,
        job: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Entrevista não encontrada." },
        { status: 404 }
      );
    }

    const data: any = {};

    if (body.scheduledAt !== undefined || body.scheduled_at !== undefined) {
      const scheduledAt = parseDate(body.scheduledAt || body.scheduled_at);

      if (!scheduledAt) {
        return NextResponse.json(
          { error: "Data da entrevista inválida." },
          { status: 400 }
        );
      }

      data.scheduledAt = scheduledAt;
    }

    if (body.status !== undefined) data.status = normalizeStatus(body.status);
    if (body.durationMin !== undefined) data.durationMin = Number(body.durationMin);
    if (body.interviewer !== undefined) data.interviewer = clean(body.interviewer) || null;
    if (body.meetingUrl !== undefined) data.meetingUrl = clean(body.meetingUrl) || null;
    if (body.location !== undefined) data.location = clean(body.location) || null;

    if (body.score !== undefined) {
      data.score =
        body.score === null || body.score === "" ? null : Number(body.score);
    }

    if (body.notes !== undefined) data.notes = clean(body.notes) || null;

    const interview = await prisma.interview.update({
      where: { id },
      data,
      include: {
        candidate: true,
        job: true,
      },
    });

    let hiring: any = null;

    if (data.status) {
      const statusMap: Record<string, string> = {
        scheduled: "entrevista",
        confirmed: "entrevista",
        done: "entrevista_realizada",
        no_show: "nao_compareceu",
        approved: "aprovado",
        rejected: "reprovado",
        hired: "contratado",
      };

      const candidateStatus = statusMap[data.status];

      if (candidateStatus) {
        await prisma.candidateProfile.update({
          where: { id: existing.candidateId },
          data: {
            status: candidateStatus,
            aiExtractedData: {
              ...((existing.candidate.aiExtractedData as any) || {}),
              status: candidateStatus,
              lastInterviewStatus: data.status,
              lastInterviewUpdatedAt: new Date().toISOString(),
            },
          },
        });
      }

      if (["approved", "rejected", "hired", "no_show", "done"].includes(data.status)) {
        await prisma.jobApplication.updateMany({
          where: {
            jobId: existing.jobId,
            candidateId: existing.candidateId,
            company_id: companyId,
          },
          data: {
            stage:
              data.status === "approved"
                ? "aprovado"
                : data.status === "hired"
                  ? "contratado"
                  : data.status === "no_show"
                    ? "nao_compareceu"
                    : data.status === "done"
                      ? "entrevistado"
                      : "reprovado",
            status:
              data.status === "rejected"
                ? "rejected"
                : data.status === "hired"
                  ? "hired"
                  : "active",
          },
        });
      }

      if (data.status === "approved") {
        hiring = await createOrUpdateHiringFromInterview({
          companyId,
          branchId,
          interview,
          targetStatus: "pending_documents",
        });
      }

      if (data.status === "hired") {
        hiring = await createOrUpdateHiringFromInterview({
          companyId,
          branchId,
          interview,
          targetStatus: "hired",
        });

        await prisma.candidateProfile.update({
          where: { id: existing.candidateId },
          data: {
            status: "contratado",
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      interview,
      hiringCreated: Boolean(hiring),
      hiring,
    });
  } catch (error: any) {
    console.error("PATCH /api/rh/interviews:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar entrevista." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { companyId } = await requireCompany(req);
    const { searchParams } = new URL(req.url);

    const id = clean(searchParams.get("id"));

    if (!id) {
      return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    }

    const existing = await prisma.interview.findFirst({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Entrevista não encontrada." },
        { status: 404 }
      );
    }

    await prisma.interview.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/rh/interviews:", error);

    return NextResponse.json(
      { error: error?.message || "Erro ao excluir entrevista." },
      { status: 500 }
    );
  }
}
