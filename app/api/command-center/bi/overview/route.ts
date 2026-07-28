import { NextRequest, NextResponse } from "next/server";

import {
  getCommandCenterAdminClient,
  getCommandCenterContext,
} from "@/lib/command-center-auth";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;

const PERIOD_DAYS: Record<string, number> = {
  today: 0,
  yesterday: 1,
  "7d": 7,
  "15d": 15,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

function getPeriodRange(period: string) {
  const now = new Date();

  if (period === "today") {
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    return {
      start: start.toISOString(),
      end: now.toISOString(),
    };
  }

  if (period === "yesterday") {
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1
    );

    const end = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  const days = PERIOD_DAYS[period] || 30;

  return {
    start: new Date(
      now.getTime() - days * 24 * 60 * 60 * 1000
    ).toISOString(),
    end: now.toISOString(),
  };
}

function isBetween(
  value: string | null | undefined,
  start: string,
  end: string
) {
  if (!value) return false;

  const time = new Date(value).getTime();

  return (
    Number.isFinite(time) &&
    time >= new Date(start).getTime() &&
    time < new Date(end).getTime()
  );
}

function ageInDays(value: string | null | undefined) {
  if (!value) return 0;

  const time = new Date(value).getTime();

  if (!Number.isFinite(time)) return 0;

  return Math.max(
    0,
    Math.floor(
      (Date.now() - time) / (24 * 60 * 60 * 1000)
    )
  );
}

function percentage(value: number, total: number) {
  if (!total) return 0;

  return Math.round((value / total) * 1000) / 10;
}

function average(values: number[]) {
  if (!values.length) return 0;

  return (
    Math.round(
      (values.reduce((sum, value) => sum + value, 0) /
        values.length) *
        10
    ) / 10
  );
}

function groupCount(
  rows: Row[],
  key: string,
  fallback = "não informado"
) {
  return rows.reduce<Record<string, number>>(
    (result, row) => {
      const value = String(
        row?.[key] ?? fallback
      );

      result[value] = (result[value] || 0) + 1;

      return result;
    },
    {}
  );
}

function sortGroups(groups: Record<string, number>) {
  return Object.entries(groups)
    .map(([label, value]) => ({
      label,
      value,
    }))
    .sort((a, b) => b.value - a.value);
}

function statusIs(
  value: unknown,
  options: string[]
) {
  const normalized = String(
    value || ""
  ).toLowerCase();

  return options.includes(normalized);
}

function getTaskDate(task: Row) {
  return (
    task.due_date ||
    task.dueDate ||
    null
  );
}

function getTaskCreatedAt(task: Row) {
  return (
    task.created_at ||
    task.createdAt ||
    null
  );
}

function getTaskUpdatedAt(task: Row) {
  return (
    task.updated_at ||
    task.updatedAt ||
    getTaskCreatedAt(task)
  );
}

function getMessageDate(message: Row) {
  return (
    message.created_at ||
    message.createdAt ||
    null
  );
}

function getCampaignDate(campaign: Row) {
  return (
    campaign.created_at ||
    campaign.createdAt ||
    null
  );
}

function getJobCreatedAt(job: Row) {
  return (
    job.createdAt ||
    job.created_at ||
    null
  );
}

function getJobUpdatedAt(job: Row) {
  return (
    job.updatedAt ||
    job.updated_at ||
    getJobCreatedAt(job)
  );
}

function getCandidateCreatedAt(candidate: Row) {
  return (
    candidate.createdAt ||
    candidate.created_at ||
    null
  );
}

function getInterviewCreatedAt(interview: Row) {
  return (
    interview.createdAt ||
    interview.created_at ||
    interview.scheduledAt ||
    null
  );
}

function getHiringCreatedAt(hiring: Row) {
  return (
    hiring.createdAt ||
    hiring.created_at ||
    null
  );
}

async function readTable(
  supabase: ReturnType<
    typeof getCommandCenterAdminClient
  >,
  table: string,
  companyId: string,
  select = "*",
  limit = 10000
) {
  const result = await supabase
    .from(table)
    .select(select)
    .eq("company_id", companyId)
    .limit(limit);

  if (result.error) {
    console.warn(
      `[COMMAND CENTER BI] ${table}:`,
      result.error.message
    );

    return {
      rows: [] as Row[],
      error: result.error.message,
    };
  }

  return {
    rows: (result.data || []) as Row[],
    error: null,
  };
}

export async function GET(
  request: NextRequest
) {
  try {
    const context =
      await getCommandCenterContext();

    if (!context) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Acesso permitido somente para administradores.",
        },
        { status: 403 }
      );
    }

    const period =
      request.nextUrl.searchParams.get("period") ||
      "30d";

    const requestedCompanyId =
      request.nextUrl.searchParams.get(
        "companyId"
      );

    if (
      !context.globalAccess &&
      requestedCompanyId &&
      requestedCompanyId !== context.companyId
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Empresa fora do escopo permitido.",
        },
        { status: 403 }
      );
    }

    const companyId =
      context.globalAccess &&
      requestedCompanyId
        ? requestedCompanyId
        : context.companyId;

    const { start, end } =
      getPeriodRange(period);

    const supabase =
      getCommandCenterAdminClient();

    const [
      clientsResult,
      jobsResult,
      candidatesResult,
      applicationsResult,
      interviewsResult,
      hiringsResult,
      tasksResult,
      leadsResult,
      messagesResult,
      crmMessagesResult,
      campaignsResult,
      usersResult,
    ] = await Promise.all([
      readTable(
        supabase,
        "company_contacts",
        companyId
      ),
      readTable(
        supabase,
        "Job",
        companyId
      ),
      readTable(
        supabase,
        "CandidateProfile",
        companyId
      ),
      readTable(
        supabase,
        "JobApplication",
        companyId
      ),
      readTable(
        supabase,
        "Interview",
        companyId
      ),
      readTable(
        supabase,
        "HiringProcess",
        companyId
      ),
      readTable(
        supabase,
        "rh_tasks",
        companyId
      ),
      readTable(
        supabase,
        "leads",
        companyId
      ),
      readTable(
        supabase,
        "messages",
        companyId
      ),
      readTable(
        supabase,
        "CrmMessage",
        companyId
      ),
      readTable(
        supabase,
        "Campaign",
        companyId
      ),
      readTable(
        supabase,
        "company_users",
        companyId,
        "user_id,name,email,role,active"
      ),
    ]);

    const clients =
      clientsResult.rows;

    const jobs =
      jobsResult.rows;

    const candidates =
      candidatesResult.rows;

    const applications =
      applicationsResult.rows;

    const interviews =
      interviewsResult.rows;

    const hirings =
      hiringsResult.rows;

    const tasks =
      tasksResult.rows;

    const leads =
      leadsResult.rows;

    const messages: Row[] = [
      ...messagesResult.rows.map((row: Row): Row => ({
        ...row,
        source_table: "messages",
      })),
      ...crmMessagesResult.rows.map((row: Row): Row => ({
        ...row,
        source_table: "CrmMessage",
      })),
    ];

    const campaigns =
      campaignsResult.rows;

    const users =
      usersResult.rows;

    const userMap = new Map(
      users.map((user) => [
        user.user_id,
        user.name ||
          user.email ||
          "Usuário",
      ])
    );

    const jobsById = new Map(
      jobs.map((job) => [job.id, job])
    );

    const candidatesById = new Map(
      candidates.map((candidate) => [
        candidate.id,
        candidate,
      ])
    );

    const applicationsByJob =
      applications.reduce<
        Record<string, Row[]>
      >((result, application) => {
        const jobId = application.jobId;

        if (!result[jobId]) {
          result[jobId] = [];
        }

        result[jobId].push(application);

        return result;
      }, {});

    const interviewsByJob =
      interviews.reduce<Record<string, Row[]>>(
        (result, interview) => {
          const jobId = interview.jobId;

          if (!result[jobId]) {
            result[jobId] = [];
          }

          result[jobId].push(interview);

          return result;
        },
        {}
      );

    const hiringsByJob =
      hirings.reduce<Record<string, Row[]>>(
        (result, hiring) => {
          const jobId =
            hiring.jobId || "sem_vaga";

          if (!result[jobId]) {
            result[jobId] = [];
          }

          result[jobId].push(hiring);

          return result;
        },
        {}
      );

    const newClients = clients.filter((client) =>
      isBetween(
        client.created_at ||
          client.createdAt,
        start,
        end
      )
    );

    const activeJobs = jobs.filter((job) =>
      statusIs(job.status, [
        "open",
        "published",
      ])
    );

    const newJobs = jobs.filter((job) =>
      isBetween(
        getJobCreatedAt(job),
        start,
        end
      )
    );

    const newCandidates = candidates.filter(
      (candidate) =>
        isBetween(
          getCandidateCreatedAt(candidate),
          start,
          end
        )
    );

    const newApplications =
      applications.filter((application) =>
        isBetween(
          application.applicationDate ||
            application.createdAt,
          start,
          end
        )
      );

    const periodInterviews =
      interviews.filter((interview) =>
        isBetween(
          getInterviewCreatedAt(interview),
          start,
          end
        )
      );

    const scheduledInterviews =
      periodInterviews.filter((interview) =>
        statusIs(interview.status, [
          "scheduled",
          "confirmed",
        ])
      );

    const completedInterviews =
      periodInterviews.filter((interview) =>
        statusIs(interview.status, [
          "done",
          "approved",
          "rejected",
          "hired",
        ])
      );

    const approvedInterviews =
      periodInterviews.filter((interview) =>
        statusIs(interview.status, [
          "approved",
          "hired",
        ])
      );

    const periodHirings =
      hirings.filter((hiring) =>
        isBetween(
          getHiringCreatedAt(hiring),
          start,
          end
        )
      );

    const completedHirings =
      periodHirings.filter((hiring) =>
        statusIs(hiring.status, [
          "hired",
        ])
      );

    const periodTasks = tasks.filter((task) =>
      isBetween(
        getTaskCreatedAt(task),
        start,
        end
      )
    );

    const completedTasks =
      periodTasks.filter((task) =>
        statusIs(task.status, [
          "done",
          "completed",
          "concluida",
          "concluído",
          "concluido",
        ])
      );

    const overdueTasks =
      tasks.filter((task) => {
        const dueDate = getTaskDate(task);

        return (
          dueDate &&
          new Date(dueDate).getTime() <
            Date.now() &&
          !statusIs(task.status, [
            "done",
            "completed",
            "canceled",
            "cancelled",
          ])
        );
      });

    const periodLeads =
      leads.filter((lead) =>
        isBetween(
          lead.created_at ||
            lead.createdAt,
          start,
          end
        )
      );

    const periodMessages: Row[] =
      messages.filter((message: Row) =>
        isBetween(
          getMessageDate(message),
          start,
          end
        )
      );

    const sentMessages =
      periodMessages.filter((message: Row) =>
        statusIs(message.direction, [
          "outbound",
          "sent",
          "out",
          "saida",
          "saída",
        ])
      );

    const receivedMessages =
      periodMessages.filter((message: Row) =>
        statusIs(message.direction, [
          "inbound",
          "received",
          "in",
          "entrada",
        ])
      );

    const periodCampaigns =
      campaigns.filter((campaign) =>
        isBetween(
          getCampaignDate(campaign),
          start,
          end
        )
      );

    const jobAnalytics = jobs
      .map((job) => {
        const jobApplications =
          applicationsByJob[job.id] || [];

        const jobInterviews =
          interviewsByJob[job.id] || [];

        const jobHirings =
          hiringsByJob[job.id] || [];

        const approved =
          jobInterviews.filter((interview) =>
            statusIs(interview.status, [
              "approved",
              "hired",
            ])
          ).length;

        const hired =
          jobHirings.filter((hiring) =>
            statusIs(hiring.status, [
              "hired",
            ])
          ).length;

        const requirements =
          job.requirements &&
          typeof job.requirements === "object"
            ? job.requirements
            : {};

        return {
          id: job.id,
          title: job.title,
          status: job.status,
          department:
            job.department || null,
          city: job.city || null,
          state: job.state || null,
          createdAt:
            getJobCreatedAt(job),
          updatedAt:
            getJobUpdatedAt(job),
          ageDays:
            ageInDays(
              getJobCreatedAt(job)
            ),
          applications:
            jobApplications.length,
          interviews:
            jobInterviews.length,
          approved,
          hired,
          applicationToInterviewRate:
            percentage(
              jobInterviews.length,
              jobApplications.length
            ),
          interviewToHiringRate:
            percentage(
              hired,
              jobInterviews.length
            ),
          responsibleName:
            requirements.responsibleName ||
            null,
          clientName:
            requirements.clientName ||
            null,
          openings:
            Number(
              requirements.openings || 1
            ),
          lastMovementAt: [
            ...jobApplications.map(
              (item) =>
                item.updatedAt ||
                item.createdAt
            ),
            ...jobInterviews.map(
              (item) =>
                item.updatedAt ||
                item.createdAt ||
                item.scheduledAt
            ),
            ...jobHirings.map(
              (item) =>
                item.updatedAt ||
                item.createdAt
            ),
            getJobUpdatedAt(job),
          ]
            .filter(Boolean)
            .sort(
              (a, b) =>
                new Date(b).getTime() -
                new Date(a).getTime()
            )[0] || null,
        };
      })
      .sort(
        (a, b) =>
          b.applications - a.applications
      );

    const candidateByOrigin =
      sortGroups(
        groupCount(
          newCandidates,
          "resumeOrigin",
          "não informado"
        )
      );

    const candidateByStatus =
      sortGroups(
        groupCount(
          candidates,
          "status",
          "não informado"
        )
      );

    const jobByStatus =
      sortGroups(
        groupCount(
          jobs,
          "status",
          "não informado"
        )
      );

    const interviewByStatus =
      sortGroups(
        groupCount(
          periodInterviews,
          "status",
          "não informado"
        )
      );

    const taskByStatus =
      sortGroups(
        groupCount(
          tasks,
          "status",
          "não informado"
        )
      );

    const taskByPriority =
      sortGroups(
        groupCount(
          tasks,
          "priority",
          "não informado"
        )
      );

    const taskByResponsible =
      sortGroups(
        tasks.reduce<Record<string, number>>(
          (result, task) => {
            const key =
              task.assigned_to_name ||
              userMap.get(
                task.assigned_to
              ) ||
              "Sem responsável";

            result[key] =
              (result[key] || 0) + 1;

            return result;
          },
          {}
        )
      );

    const userProduction =
      users
        .filter(
          (user) =>
            user.active !== false
        )
        .map((user) => {
          const id = user.user_id;

          const userTasks =
            tasks.filter(
              (task) =>
                task.assigned_to === id ||
                task.created_by === id
            );

          const userCompletedTasks =
            userTasks.filter((task) =>
              statusIs(task.status, [
                "done",
                "completed",
              ])
            );

          return {
            userId: id,
            name:
              user.name ||
              user.email ||
              "Usuário",
            role:
              user.role || null,
            tasks:
              userTasks.length,
            completedTasks:
              userCompletedTasks.length,
            overdueTasks:
              userTasks.filter((task) =>
                overdueTasks.some(
                  (overdue) =>
                    overdue.id === task.id
                )
              ).length,
            completionRate:
              percentage(
                userCompletedTasks.length,
                userTasks.length
              ),
          };
        })
        .sort(
          (a, b) =>
            b.completedTasks -
            a.completedTasks
        );

    const stagnantJobs =
      jobAnalytics
        .filter(
          (job) =>
            ["open", "published"].includes(
              String(job.status).toLowerCase()
            ) &&
            ageInDays(
              job.lastMovementAt
            ) >= 7
        )
        .sort(
          (a, b) =>
            ageInDays(
              b.lastMovementAt
            ) -
            ageInDays(
              a.lastMovementAt
            )
        );

    const clientsWithoutJobs =
      clients.filter((client) => {
        const clientName =
          client.company_name ||
          client.restaurant_name ||
          "";

        if (!clientName) return true;

        return !jobs.some((job) => {
          const requirements =
            job.requirements &&
            typeof job.requirements ===
              "object"
              ? job.requirements
              : {};

          return (
            requirements.clientName ===
            clientName
          );
        });
      });

    const daily = [];
    const dailyDays =
      period === "today" ||
      period === "yesterday"
        ? 1
        : Math.min(
            PERIOD_DAYS[period] || 30,
            90
          );

    for (
      let offset = dailyDays - 1;
      offset >= 0;
      offset -= 1
    ) {
      const date = new Date();

      date.setDate(
        date.getDate() - offset
      );

      const dayStart = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );

      const dayEnd = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() + 1
      );

      daily.push({
        date:
          dayStart.toISOString().slice(0, 10),
        label:
          new Intl.DateTimeFormat(
            "pt-BR",
            {
              day: "2-digit",
              month: "2-digit",
            }
          ).format(dayStart),
        clients:
          clients.filter((item) =>
            isBetween(
              item.created_at ||
                item.createdAt,
              dayStart.toISOString(),
              dayEnd.toISOString()
            )
          ).length,
        jobs:
          jobs.filter((item) =>
            isBetween(
              getJobCreatedAt(item),
              dayStart.toISOString(),
              dayEnd.toISOString()
            )
          ).length,
        candidates:
          candidates.filter((item) =>
            isBetween(
              getCandidateCreatedAt(item),
              dayStart.toISOString(),
              dayEnd.toISOString()
            )
          ).length,
        interviews:
          interviews.filter((item) =>
            isBetween(
              getInterviewCreatedAt(item),
              dayStart.toISOString(),
              dayEnd.toISOString()
            )
          ).length,
        hirings:
          hirings.filter((item) =>
            isBetween(
              getHiringCreatedAt(item),
              dayStart.toISOString(),
              dayEnd.toISOString()
            )
          ).length,
        tasks:
          tasks.filter((item) =>
            isBetween(
              getTaskCreatedAt(item),
              dayStart.toISOString(),
              dayEnd.toISOString()
            )
          ).length,
        messages:
          messages.filter((item) =>
            isBetween(
              getMessageDate(item),
              dayStart.toISOString(),
              dayEnd.toISOString()
            )
          ).length,
      });
    }

    const diagnostics: Array<{
      severity:
        | "info"
        | "warning"
        | "critical"
        | "success";
      title: string;
      description: string;
      recommendation: string;
      entityType?: string;
      entityId?: string;
    }> = [];

    if (stagnantJobs.length > 0) {
      diagnostics.push({
        severity: "warning",
        title: `${stagnantJobs.length} vaga(s) sem movimentação há 7 dias ou mais`,
        description:
          stagnantJobs
            .slice(0, 3)
            .map(
              (job) =>
                `${job.title}: ${ageInDays(
                  job.lastMovementAt
                )} dias`
            )
            .join(" · "),
        recommendation:
          "Revisar divulgação, triagem, responsável e aderência da descrição.",
      });
    }

    const jobsWithoutCandidates =
      jobAnalytics.filter(
        (job) =>
          ["open", "published"].includes(
            String(job.status).toLowerCase()
          ) &&
          job.applications === 0
      );

    if (
      jobsWithoutCandidates.length > 0
    ) {
      diagnostics.push({
        severity: "critical",
        title: `${jobsWithoutCandidates.length} vaga(s) aberta(s) sem candidatos vinculados`,
        description:
          jobsWithoutCandidates
            .slice(0, 4)
            .map((job) => job.title)
            .join(" · "),
        recommendation:
          "Revisar fontes de captação, publicação e critérios da vaga.",
      });
    }

    if (
      overdueTasks.length > 0
    ) {
      diagnostics.push({
        severity: "warning",
        title: `${overdueTasks.length} tarefa(s) atrasada(s)`,
        description:
          taskByResponsible
            .filter(
              (item) =>
                item.label !==
                "Sem responsável"
            )
            .slice(0, 3)
            .map(
              (item) =>
                `${item.label}: ${item.value}`
            )
            .join(" · "),
        recommendation:
          "Redistribuir tarefas e revisar prioridades e prazos.",
      });
    }

    const interviewConversion =
      percentage(
        completedHirings.length,
        completedInterviews.length
      );

    if (
      completedInterviews.length >= 5 &&
      interviewConversion < 15
    ) {
      diagnostics.push({
        severity: "warning",
        title:
          "Conversão de entrevistas em contratações abaixo de 15%",
        description: `${completedInterviews.length} entrevistas concluídas e ${completedHirings.length} contratações no período.`,
        recommendation:
          "Revisar aderência dos candidatos, velocidade de feedback e proposta salarial.",
      });
    }

    if (
      sentMessages.length > 0 &&
      percentage(
        receivedMessages.length,
        sentMessages.length
      ) < 5
    ) {
      diagnostics.push({
        severity: "warning",
        title:
          "Taxa de resposta de mensagens abaixo de 5%",
        description: `${sentMessages.length} enviadas e ${receivedMessages.length} recebidas.`,
        recommendation:
          "Revisar texto, público, horário e saúde das sessões do WhatsApp.",
      });
    }

    if (
      diagnostics.length === 0
    ) {
      diagnostics.push({
        severity: "success",
        title:
          "Nenhum gargalo crítico detectado",
        description:
          "Os principais indicadores do período estão dentro de uma faixa operacional estável.",
        recommendation:
          "Continue acompanhando tendências, produtividade e vagas paradas.",
      });
    }

    const errors = [
      clientsResult,
      jobsResult,
      candidatesResult,
      applicationsResult,
      interviewsResult,
      hiringsResult,
      tasksResult,
      leadsResult,
      messagesResult,
      crmMessagesResult,
      campaignsResult,
      usersResult,
    ]
      .filter((result) => result.error)
      .map((result) => result.error);

    return NextResponse.json({
      success: true,
      companyId,
      period,
      range: {
        start,
        end,
      },
      summary: {
        clientsTotal:
          clients.length,
        clientsNew:
          newClients.length,
        clientsWithoutJobs:
          clientsWithoutJobs.length,

        jobsTotal:
          jobs.length,
        jobsOpen:
          activeJobs.length,
        jobsNew:
          newJobs.length,
        jobsStagnant:
          stagnantJobs.length,

        candidatesTotal:
          candidates.length,
        candidatesNew:
          newCandidates.length,
        applicationsNew:
          newApplications.length,

        interviewsTotal:
          interviews.length,
        interviewsNew:
          periodInterviews.length,
        interviewsScheduled:
          scheduledInterviews.length,
        interviewsCompleted:
          completedInterviews.length,
        interviewsApproved:
          approvedInterviews.length,

        hiringsTotal:
          hirings.length,
        hiringsNew:
          periodHirings.length,
        hiringsCompleted:
          completedHirings.length,

        tasksTotal:
          tasks.length,
        tasksNew:
          periodTasks.length,
        tasksCompleted:
          completedTasks.length,
        tasksOverdue:
          overdueTasks.length,

        leadsTotal:
          leads.length,
        leadsNew:
          periodLeads.length,

        messagesTotal:
          messages.length,
        messagesSent:
          sentMessages.length,
        messagesReceived:
          receivedMessages.length,
        responseRate:
          percentage(
            receivedMessages.length,
            sentMessages.length
          ),

        campaignsTotal:
          campaigns.length,
        campaignsNew:
          periodCampaigns.length,
      },
      funnel: {
        candidates:
          candidates.length,
        applications:
          applications.length,
        interviews:
          interviews.length,
        approved:
          interviews.filter(
            (interview) =>
              statusIs(
                interview.status,
                ["approved", "hired"]
              )
          ).length,
        hirings:
          hirings.filter((hiring) =>
            statusIs(
              hiring.status,
              ["hired"]
            )
          ).length,
        candidateToApplicationRate:
          percentage(
            applications.length,
            candidates.length
          ),
        applicationToInterviewRate:
          percentage(
            interviews.length,
            applications.length
          ),
        interviewToApprovalRate:
          percentage(
            interviews.filter(
              (interview) =>
                statusIs(
                  interview.status,
                  ["approved", "hired"]
                )
            ).length,
            interviews.length
          ),
        approvalToHiringRate:
          percentage(
            hirings.filter((hiring) =>
              statusIs(
                hiring.status,
                ["hired"]
              )
            ).length,
            interviews.filter(
              (interview) =>
                statusIs(
                  interview.status,
                  ["approved", "hired"]
                )
            ).length
          ),
      },
      distributions: {
        jobsByStatus:
          jobByStatus,
        candidatesByStatus:
          candidateByStatus,
        candidatesByOrigin:
          candidateByOrigin,
        interviewsByStatus:
          interviewByStatus,
        tasksByStatus:
          taskByStatus,
        tasksByPriority:
          taskByPriority,
        tasksByResponsible:
          taskByResponsible,
      },
      jobs: jobAnalytics,
      users: userProduction,
      daily,
      diagnostics,
      errors,
      generatedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "[COMMAND CENTER BI]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao carregar BI.",
      },
      { status: 500 }
    );
  }
}
