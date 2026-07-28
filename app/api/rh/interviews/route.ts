import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireCompany } from "@/lib/server-company";
import { emitOperationalEvent } from "@/lib/operational-events";

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

  return ALLOWED_STATUS.includes(status)
    ? status
    : "scheduled";
}

function parseDate(value: any) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function toRecord(
  value: unknown
): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return JSON.parse(JSON.stringify(value));
}

function getInterviewAction(
  existing: any,
  interview: any
) {
  const scheduledChanged =
    new Date(existing.scheduledAt).getTime() !==
    new Date(interview.scheduledAt).getTime();

  if (scheduledChanged) {
    return "interview_rescheduled";
  }

  if (existing.status !== interview.status) {
    const actions: Record<string, string> = {
      confirmed: "interview_confirmed",
      done: "interview_completed",
      approved: "interview_approved",
      rejected: "interview_rejected",
      canceled: "interview_canceled",
      no_show: "interview_no_show",
      hired: "interview_hired",
    };

    return (
      actions[interview.status] ||
      "interview_status_changed"
    );
  }

  if (
    existing.notes !== interview.notes ||
    existing.score !== interview.score
  ) {
    return "interview_feedback_added";
  }

  return "interview_updated";
}

function getInterviewDescription(
  action: string,
  existing: any,
  interview: any
) {
  const candidateName =
    interview.candidate?.name ||
    existing.candidate?.name ||
    "candidato";

  const jobTitle =
    interview.job?.title ||
    existing.job?.title ||
    "vaga não identificada";

  if (action === "interview_rescheduled") {
    return `Reagendou a entrevista de ${candidateName} para ${new Date(
      interview.scheduledAt
    ).toLocaleString("pt-BR")}`;
  }

  if (action === "interview_confirmed") {
    return `Confirmou a entrevista de ${candidateName} para a vaga ${jobTitle}`;
  }

  if (action === "interview_completed") {
    return `Concluiu a entrevista de ${candidateName} para a vaga ${jobTitle}`;
  }

  if (action === "interview_approved") {
    return `Aprovou ${candidateName} na entrevista da vaga ${jobTitle}`;
  }

  if (action === "interview_rejected") {
    return `Reprovou ${candidateName} na entrevista da vaga ${jobTitle}`;
  }

  if (action === "interview_canceled") {
    return `Cancelou a entrevista de ${candidateName} para a vaga ${jobTitle}`;
  }

  if (action === "interview_no_show") {
    return `Registrou ausência de ${candidateName} na entrevista da vaga ${jobTitle}`;
  }

  if (action === "interview_hired") {
    return `Marcou ${candidateName} como contratado após a entrevista da vaga ${jobTitle}`;
  }

  if (action === "interview_feedback_added") {
    return `Adicionou feedback à entrevista de ${candidateName}`;
  }

  if (existing.status !== interview.status) {
    return `Alterou a entrevista de ${candidateName} de ${existing.status} para ${interview.status}`;
  }

  return `Atualizou a entrevista de ${candidateName}`;
}

function buildMetadata(interview: any) {
  return {
    candidateId:
      interview.candidateId ||
      interview.candidate?.id ||
      null,

    candidateName:
      interview.candidate?.name || null,

    candidatePhone:
      interview.candidate?.mobile ||
      interview.candidate?.phone ||
      null,

    candidateEmail:
      interview.candidate?.email || null,

    candidateCity:
      interview.candidate?.city || null,

    candidateState:
      interview.candidate?.state || null,

    jobId:
      interview.jobId ||
      interview.job?.id ||
      null,

    jobTitle:
      interview.job?.title || null,

    jobCity:
      interview.job?.city || null,

    jobState:
      interview.job?.state || null,

    scheduledAt: interview.scheduledAt
      ? new Date(
          interview.scheduledAt
        ).toISOString()
      : null,

    durationMin:
      interview.durationMin ?? null,

    interviewer:
      interview.interviewer || null,

    meetingUrl:
      interview.meetingUrl || null,

    location:
      interview.location || null,

    score:
      interview.score ?? null,

    notes:
      interview.notes || null,

    status:
      interview.status || null,
  };
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
  if (!interview?.candidateId) {
    return null;
  }

  const existingHiring =
    await prisma.hiringProcess.findFirst({
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
    return prisma.hiringProcess.update({
      where: {
        id: existingHiring.id,
      },
      data: {
        status: targetStatus,
        position:
          existingHiring.position ||
          position,
        notes:
          existingHiring.notes ||
          notes,
      },
      include: {
        candidate: true,
        job: true,
      },
    });
  }

  return prisma.hiringProcess.create({
    data: {
      company_id: companyId,
      branch_id:
        branchId ||
        interview.branch_id ||
        null,

      candidateId:
        interview.candidateId,

      jobId:
        interview.jobId || null,

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
}

export async function GET(
  req: NextRequest
) {
  try {
    const { companyId } =
      await requireCompany(req);

    const { searchParams } =
      new URL(req.url);

    const q = clean(
      searchParams.get("q")
    );

    const status = clean(
      searchParams.get("status")
    );

    const from =
      searchParams.get("from");

    const to =
      searchParams.get("to");

    const where: any = {
      company_id: companyId,
    };

    if (
      status &&
      status !== "all"
    ) {
      where.status =
        normalizeStatus(status);
    }

    if (from || to) {
      where.scheduledAt = {};

      if (from) {
        where.scheduledAt.gte =
          new Date(from);
      }

      if (to) {
        where.scheduledAt.lte =
          new Date(to);
      }
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

    const interviews =
      await prisma.interview.findMany({
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
    console.error(
      "GET /api/rh/interviews:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Erro ao carregar entrevistas.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
  req: NextRequest
) {
  try {
    const {
      companyId,
      branchId,
      userId,
    } = await requireCompany(req);

    const body =
      await req.json();

    const candidateId = clean(
      body.candidateId ||
        body.candidate_id
    );

    const jobId = clean(
      body.jobId ||
        body.job_id
    );

    const scheduledAt =
      parseDate(
        body.scheduledAt ||
          body.scheduled_at
      );

    if (!candidateId) {
      return NextResponse.json(
        {
          error:
            "candidateId é obrigatório.",
        },
        {
          status: 400,
        }
      );
    }

    if (!jobId) {
      return NextResponse.json(
        {
          error:
            "jobId é obrigatório.",
        },
        {
          status: 400,
        }
      );
    }

    if (!scheduledAt) {
      return NextResponse.json(
        {
          error:
            "Data e hora da entrevista são obrigatórias.",
        },
        {
          status: 400,
        }
      );
    }

    const candidate =
      await prisma.candidateProfile.findFirst(
        {
          where: {
            id: candidateId,
            company_id: companyId,
            active: true,
          },
        }
      );

    if (!candidate) {
      return NextResponse.json(
        {
          error:
            "Candidato não encontrado.",
        },
        {
          status: 404,
        }
      );
    }

    const job =
      await prisma.job.findFirst({
        where: {
          id: jobId,
          company_id: companyId,
        },
      });

    if (!job) {
      return NextResponse.json(
        {
          error:
            "Vaga não encontrada.",
        },
        {
          status: 404,
        }
      );
    }

    const interview =
      await prisma.interview.create({
        data: {
          company_id: companyId,

          branch_id:
            branchId || null,

          candidateId,

          jobId,

          scheduledAt,

          durationMin: Number(
            body.durationMin ||
              body.duration_min ||
              30
          ),

          interviewer:
            clean(
              body.interviewer
            ) || null,

          meetingUrl:
            clean(
              body.meetingUrl ||
                body.meeting_url
            ) || null,

          location:
            clean(
              body.location
            ) || null,

          status:
            normalizeStatus(
              body.status
            ),

          score:
            body.score !==
              undefined &&
            body.score !== null &&
            body.score !== ""
              ? Number(
                  body.score
                )
              : null,

          notes:
            clean(
              body.notes
            ) || null,
        },

        include: {
          candidate: true,
          job: true,
        },
      });

    await prisma.candidateProfile.update({
      where: {
        id: candidateId,
      },

      data: {
        status: "entrevista",

        aiExtractedData: {
          ...((candidate.aiExtractedData as any) ||
            {}),

          status: "entrevista",

          lastInterviewAt:
            scheduledAt.toISOString(),
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

        branch_id:
          branchId || null,

        jobId,

        candidateId,

        source:
          "Entrevista manual",

        stage: "entrevista",

        status: "active",

        history: {
          createdFrom:
            "interview",

          interviewId:
            interview.id,
        },
      },
    });

    await emitOperationalEvent(
      {
        companyId,

        branchId,

        userId,

        module:
          "entrevistas",

        action:
          "interview_scheduled",

        entityType:
          "Interview",

        entityId:
          interview.id,

        entityName:
          interview.candidate
            ?.name ||
          candidate.name ||
          "Candidato",

        description: `Marcou entrevista para ${
          interview.candidate
            ?.name ||
          candidate.name ||
          "candidato"
        } na vaga ${
          interview.job?.title ||
          job.title ||
          "não identificada"
        }`,

        status:
          interview.status,

        responsibleName:
          interview.interviewer ||
          null,

        after:
          toRecord(
            interview
          ),

        metadata:
          buildMetadata(
            interview
          ),

        eventKey:
          `interview-created:${interview.id}`,
      },

      req
    );

    return NextResponse.json({
      success: true,
      interview,
    });
  } catch (error: any) {
    console.error(
      "POST /api/rh/interviews:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Erro ao criar entrevista.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PATCH(
  req: NextRequest
) {
  try {
    const {
      companyId,
      branchId,
      userId,
    } = await requireCompany(req);

    const body =
      await req.json();

    const id =
      clean(body.id);

    if (!id) {
      return NextResponse.json(
        {
          error:
            "ID obrigatório.",
        },
        {
          status: 400,
        }
      );
    }

    const existing =
      await prisma.interview.findFirst({
        where: {
          id,
          company_id:
            companyId,
        },

        include: {
          candidate: true,
          job: true,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          error:
            "Entrevista não encontrada.",
        },
        {
          status: 404,
        }
      );
    }

    const data: any = {};

    if (
      body.scheduledAt !==
        undefined ||
      body.scheduled_at !==
        undefined
    ) {
      const scheduledAt =
        parseDate(
          body.scheduledAt ||
            body.scheduled_at
        );

      if (!scheduledAt) {
        return NextResponse.json(
          {
            error:
              "Data da entrevista inválida.",
          },
          {
            status: 400,
          }
        );
      }

      data.scheduledAt =
        scheduledAt;
    }

    if (
      body.status !==
      undefined
    ) {
      data.status =
        normalizeStatus(
          body.status
        );
    }

    if (
      body.durationMin !==
      undefined
    ) {
      data.durationMin =
        Number(
          body.durationMin
        );
    }

    if (
      body.interviewer !==
      undefined
    ) {
      data.interviewer =
        clean(
          body.interviewer
        ) || null;
    }

    if (
      body.meetingUrl !==
      undefined
    ) {
      data.meetingUrl =
        clean(
          body.meetingUrl
        ) || null;
    }

    if (
      body.location !==
      undefined
    ) {
      data.location =
        clean(
          body.location
        ) || null;
    }

    if (
      body.score !==
      undefined
    ) {
      data.score =
        body.score === null ||
        body.score === ""
          ? null
          : Number(
              body.score
            );
    }

    if (
      body.notes !==
      undefined
    ) {
      data.notes =
        clean(
          body.notes
        ) || null;
    }

    const interview =
      await prisma.interview.update({
        where: {
          id,
        },

        data,

        include: {
          candidate: true,
          job: true,
        },
      });

    let hiring: any =
      null;

    if (data.status) {
      const statusMap: Record<
        string,
        string
      > = {
        scheduled:
          "entrevista",

        confirmed:
          "entrevista",

        done:
          "entrevista_realizada",

        no_show:
          "nao_compareceu",

        approved:
          "contratado",

        rejected:
          "reprovado",

        hired:
          "contratado",
      };

      const candidateStatus =
        statusMap[
          data.status
        ];

      if (candidateStatus) {
        await prisma.candidateProfile.update(
          {
            where: {
              id:
                existing.candidateId,
            },

            data: {
              status:
                candidateStatus,

              aiExtractedData: {
                ...((existing
                  .candidate
                  .aiExtractedData as any) ||
                  {}),

                status:
                  candidateStatus,

                lastInterviewStatus:
                  data.status,

                lastInterviewUpdatedAt:
                  new Date().toISOString(),
              },
            },
          }
        );
      }

      if (
        [
          "approved",
          "rejected",
          "hired",
          "no_show",
          "done",
        ].includes(
          data.status
        )
      ) {
        await prisma.jobApplication.updateMany(
          {
            where: {
              jobId:
                existing.jobId,

              candidateId:
                existing.candidateId,

              company_id:
                companyId,
            },

            data: {
              stage:
                data.status ===
                "approved"
                  ? "contratado"
                  : data.status ===
                    "hired"
                  ? "contratado"
                  : data.status ===
                    "no_show"
                  ? "nao_compareceu"
                  : data.status ===
                    "done"
                  ? "entrevistado"
                  : "reprovado",

              status:
                data.status ===
                "rejected"
                  ? "rejected"
                  : data.status ===
                    "hired"
                  ? "hired"
                  : "active",
            },
          }
        );
      }

      if (
        data.status ===
        "approved"
      ) {
        hiring =
          await createOrUpdateHiringFromInterview(
            {
              companyId,

              branchId,

              interview,

              targetStatus:
                "pending_documents",
            }
          );
      }

      if (
        data.status ===
        "hired"
      ) {
        hiring =
          await createOrUpdateHiringFromInterview(
            {
              companyId,

              branchId,

              interview,

              targetStatus:
                "hired",
            }
          );

        await prisma.candidateProfile.update(
          {
            where: {
              id:
                existing.candidateId,
            },

            data: {
              status:
                "contratado",
            },
          }
        );
      }
    }

    const action =
      getInterviewAction(
        existing,
        interview
      );

    await emitOperationalEvent(
      {
        companyId,

        branchId:
          branchId ||
          interview.branch_id ||
          existing.branch_id ||
          null,

        userId,

        module:
          "entrevistas",

        action,

        entityType:
          "Interview",

        entityId:
          interview.id,

        entityName:
          interview.candidate
            ?.name ||
          "Candidato",

        description:
          getInterviewDescription(
            action,
            existing,
            interview
          ),

        status:
          interview.status,

        responsibleName:
          interview.interviewer ||
          null,

        before:
          toRecord(
            existing
          ),

        after:
          toRecord(
            interview
          ),

        metadata: {
          ...buildMetadata(
            interview
          ),

          previousStatus:
            existing.status,

          currentStatus:
            interview.status,

          previousScheduledAt:
            existing.scheduledAt
              ? new Date(
                  existing.scheduledAt
                ).toISOString()
              : null,

          currentScheduledAt:
            interview.scheduledAt
              ? new Date(
                  interview.scheduledAt
                ).toISOString()
              : null,

          previousScore:
            existing.score ??
            null,

          currentScore:
            interview.score ??
            null,

          hiringCreated:
            Boolean(hiring),

          hiringId:
            hiring?.id ||
            null,

          hiringStatus:
            hiring?.status ||
            null,
        },

        eventKey:
          `interview-${action}:${interview.id}:${Date.now()}`,
      },

      req
    );

    if (hiring) {
      await emitOperationalEvent(
        {
          companyId,

          branchId:
            hiring.branch_id ||
            branchId ||
            null,

          userId,

          module:
            "contratacoes",

          action:
            hiring.status ===
            "hired"
              ? "hiring_completed"
              : "hiring_started",

          entityType:
            "HiringProcess",

          entityId:
            hiring.id,

          entityName:
            hiring.candidate
              ?.name ||
            interview.candidate
              ?.name ||
            "Candidato",

          description:
            hiring.status ===
            "hired"
              ? `Concluiu a contratação de ${
                  hiring.candidate
                    ?.name ||
                  interview
                    .candidate
                    ?.name ||
                  "candidato"
                }`
              : `Iniciou a contratação de ${
                  hiring.candidate
                    ?.name ||
                  interview
                    .candidate
                    ?.name ||
                  "candidato"
                } após aprovação na entrevista`,

          status:
            hiring.status,

          after:
            toRecord(
              hiring
            ),

          metadata: {
            candidateId:
              hiring.candidateId ||
              interview.candidateId,

            candidateName:
              hiring.candidate
                ?.name ||
              interview.candidate
                ?.name ||
              null,

            jobId:
              hiring.jobId ||
              interview.jobId ||
              null,

            jobTitle:
              hiring.job?.title ||
              interview.job?.title ||
              null,

            interviewId:
              interview.id,

            source:
              "interview_status_transition",
          },

          eventKey:
            `hiring-from-interview:${hiring.id}:${hiring.status}`,
        },

        req
      );
    }

    return NextResponse.json({
      success: true,

      interview,

      hiringCreated:
        Boolean(hiring),

      hiring,
    });
  } catch (error: any) {
    console.error(
      "PATCH /api/rh/interviews:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Erro ao atualizar entrevista.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(
  req: NextRequest
) {
  try {
    const {
      companyId,
      branchId,
      userId,
    } = await requireCompany(req);

    const { searchParams } =
      new URL(req.url);

    const id = clean(
      searchParams.get("id")
    );

    if (!id) {
      return NextResponse.json(
        {
          error:
            "ID obrigatório.",
        },
        {
          status: 400,
        }
      );
    }

    const existing =
      await prisma.interview.findFirst({
        where: {
          id,

          company_id:
            companyId,
        },

        include: {
          candidate: true,

          job: true,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          error:
            "Entrevista não encontrada.",
        },
        {
          status: 404,
        }
      );
    }

    await prisma.interview.delete({
      where: {
        id,
      },
    });

    await emitOperationalEvent(
      {
        companyId,

        branchId:
          branchId ||
          existing.branch_id ||
          null,

        userId,

        module:
          "entrevistas",

        action:
          "interview_deleted",

        entityType:
          "Interview",

        entityId:
          existing.id,

        entityName:
          existing.candidate
            ?.name ||
          "Candidato",

        description: `Excluiu a entrevista de ${
          existing.candidate
            ?.name ||
          "candidato"
        } para a vaga ${
          existing.job?.title ||
          "não identificada"
        }`,

        status:
          existing.status,

        responsibleName:
          existing.interviewer ||
          null,

        before:
          toRecord(
            existing
          ),

        metadata:
          buildMetadata(
            existing
          ),

        eventKey:
          `interview-deleted:${existing.id}`,
      },

      req
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error(
      "DELETE /api/rh/interviews:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Erro ao excluir entrevista.",
      },
      {
        status: 500,
      }
    );
  }
}