import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase não configurado.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function resolveCompanyId(req: NextRequest) {
  return (
    req.cookies.get("zentra_company_id")?.value ||
    req.headers.get("x-company-id") ||
    process.env.DEFAULT_COMPANY_ID ||
    null
  );
}

function getSinceDate(period: string | null) {
  const days = Math.max(1, Number(period || 30));
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function isAfterPeriod(value: any, since: Date) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= since;
}

function norm(value: any) {
  return String(value || "").trim().toLowerCase();
}

function isOpenJob(status: any) {
  const s = norm(status);
  return !["closed", "archived", "cancelada", "cancelado", "concluida", "concluída", "finalizada", "finalizado"].includes(s);
}

function countBy(items: any[], key: string) {
  return Object.values(
    items.reduce((acc: Record<string, any>, item: any) => {
      const value = item?.[key] || "sem_status";
      acc[value] = acc[value] || { status: value, total: 0 };
      acc[value].total += 1;
      return acc;
    }, {})
  );
}

async function safeSelect(supabase: any, table: string, select: string, companyId: string) {
  const { data, error } = await supabase
    .from(table)
    .select(select)
    .eq("company_id", companyId);

  if (error) {
    console.warn(`BI: erro ao buscar ${table}:`, error.message);
    return [];
  }

  return data || [];
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const companyId = resolveCompanyId(req);

    if (!companyId) {
      return NextResponse.json(
        { error: "Empresa não identificada." },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const period = url.searchParams.get("period") || "30";
    const since = getSinceDate(period);

    const [
      candidates,
      jobs,
      interviews,
      hirings,
      documents,
      tasks,
      presentations,
      presentationCandidates,
      leads,
      messages,
      automationQueue,
    ] = await Promise.all([
      safeSelect(supabase, "CandidateProfile", "id,name,status,createdAt,updatedAt", companyId),
      safeSelect(supabase, "Job", "id,title,status,contractType,city,state,createdAt,updatedAt", companyId),
      safeSelect(supabase, "Interview", "id,status,scheduledAt,createdAt,updatedAt,jobId,candidateId", companyId),
      safeSelect(supabase, "HiringProcess", "id,status,createdAt,updatedAt,jobId,candidateId", companyId),
      safeSelect(supabase, "CandidateDocument", "id,status,createdAt,updatedAt,hiringProcessId", companyId),
      safeSelect(supabase, "rh_tasks", "id,title,status,priority,due_date,assigned_to,assigned_to_name,created_at,updated_at", companyId),
      safeSelect(supabase, "rh_client_presentations", "id,status,job_id,created_at,sent_at,viewed_at", companyId),
      safeSelect(supabase, "rh_client_presentation_candidates", "id,status,job_id,created_at,decided_at", companyId),
      safeSelect(supabase, "leads", "id,status,created_at,updated_at", companyId),
      safeSelect(supabase, "messages", "id,direction,created_at,updated_at", companyId),
      safeSelect(supabase, "automation_queue", "id,status,created_at,updated_at", companyId),
    ]);

    const recentCandidates = candidates.filter((i: any) => isAfterPeriod(i.createdAt || i.created_at, since));
    const recentJobs = jobs.filter((i: any) => isAfterPeriod(i.createdAt || i.created_at, since));
    const recentInterviews = interviews.filter((i: any) => isAfterPeriod(i.scheduledAt || i.createdAt, since));
    const recentHirings = hirings.filter((i: any) => isAfterPeriod(i.createdAt || i.created_at, since));
    const recentTasks = tasks.filter((i: any) => isAfterPeriod(i.created_at || i.createdAt, since));

    const confirmedInterviews = interviews.filter((i: any) =>
      ["confirmed", "done", "approved", "approved_by_rh", "sent_to_client", "approved_by_client"].includes(norm(i.status))
    );

    const approvedByRh = interviews.filter((i: any) =>
      ["approved", "approved_by_rh", "sent_to_client", "approved_by_client"].includes(norm(i.status))
    );

    const rejected = interviews.filter((i: any) =>
      ["rejected", "reprovado", "rejected_by_client"].includes(norm(i.status))
    );

    const noShow = interviews.filter((i: any) =>
      ["no_show", "nao_compareceu", "não_compareceu"].includes(norm(i.status))
    );

    const approvedByClient = presentationCandidates.filter((i: any) =>
      ["approved", "approved_by_client", "aprovado"].includes(norm(i.status))
    );

    const rejectedByClient = presentationCandidates.filter((i: any) =>
      ["rejected", "rejected_by_client", "reprovado"].includes(norm(i.status))
    );

    const pendingTasks = tasks.filter((i: any) =>
      !["done", "completed", "concluida", "concluída"].includes(norm(i.status))
    );

    const overdueTasks = pendingTasks.filter((i: any) => {
      if (!i.due_date) return false;
      const due = new Date(i.due_date);
      return !Number.isNaN(due.getTime()) && due < new Date();
    });

    const urgentTasks = pendingTasks.filter((i: any) => norm(i.priority) === "urgente" || norm(i.priority) === "urgent");

    const pendingDocs = documents.filter((i: any) =>
      ["pending", "pendente", "pending_documents"].includes(norm(i.status))
    );

    const approvedDocs = documents.filter((i: any) =>
      ["approved", "aprovado"].includes(norm(i.status))
    );

    const activeContracts = hirings.filter((i: any) =>
      ["hired", "active", "contrato_ativo"].includes(norm(i.status))
    );

    const openJobs = jobs.filter((j: any) => isOpenJob(j.status));

    const funnel = [
      { label: "Candidatos", value: candidates.length },
      { label: "Entrevistas", value: interviews.length },
      { label: "Aprovados RH", value: approvedByRh.length },
      { label: "Enviados Cliente", value: presentationCandidates.length },
      { label: "Aprovados Cliente", value: approvedByClient.length },
      { label: "Contratações", value: hirings.length },
    ];

    const topJobsMap = new Map<string, any>();

    for (const job of jobs) {
      topJobsMap.set(job.id, {
        id: job.id,
        title: job.title || "Vaga",
        total: 0,
        approved: 0,
        hired: 0,
        status: job.status,
      });
    }

    for (const interview of interviews) {
      const row = topJobsMap.get(interview.jobId);
      if (row) {
        row.total += 1;
        if (["approved", "approved_by_rh", "sent_to_client", "approved_by_client"].includes(norm(interview.status))) {
          row.approved += 1;
        }
      }
    }

    for (const hiring of hirings) {
      const row = hiring.jobId ? topJobsMap.get(hiring.jobId) : null;
      if (row) row.hired += 1;
    }

    const topJobs = Array.from(topJobsMap.values())
      .sort((a: any, b: any) => b.total - a.total)
      .slice(0, 8);

    const sentMessages = messages.filter((m: any) => ["sent", "out", "outbound", "enviada", "enviado"].includes(norm(m.direction))).length;
    const receivedMessages = messages.filter((m: any) => ["received", "in", "inbound", "recebida", "recebido"].includes(norm(m.direction))).length;
    const queuePending = automationQueue.filter((q: any) => ["pending", "pendente", "queued"].includes(norm(q.status))).length;
    const paused = leads.filter((l: any) => ["paused", "pausado"].includes(norm(l.status))).length;
    const noResponse = leads.filter((l: any) => ["enviado", "sent", "no_response", "sem_resposta"].includes(norm(l.status))).length;

    const responseRate = sentMessages ? (receivedMessages / sentMessages) * 100 : 0;
    const attendanceRate = interviews.length ? (confirmedInterviews.length / interviews.length) * 100 : 0;
    const approvalRate = interviews.length ? (approvedByRh.length / interviews.length) * 100 : 0;
    const hiringRate = approvedByClient.length ? (hirings.length / approvedByClient.length) * 100 : 0;
    const conversionRate = candidates.length ? (hirings.length / candidates.length) * 100 : 0;

    const alerts: any[] = [];

    if (overdueTasks.length) {
      alerts.push({
        icon: "🔴",
        title: "Tarefas atrasadas",
        message: `${overdueTasks.length} tarefa(s) passaram do prazo.`,
      });
    }

    if (urgentTasks.length) {
      alerts.push({
        icon: "⚠️",
        title: "Prioridades urgentes",
        message: `${urgentTasks.length} tarefa(s) urgente(s) ainda pendente(s).`,
      });
    }

    if (openJobs.length && interviews.length === 0) {
      alerts.push({
        icon: "📅",
        title: "Sem entrevistas",
        message: "Há vagas abertas, mas nenhuma entrevista registrada.",
      });
    }

    if (pendingDocs.length) {
      alerts.push({
        icon: "📑",
        title: "Documentos pendentes",
        message: `${pendingDocs.length} documento(s) aguardando análise.`,
      });
    }

    return NextResponse.json({
      ok: true,
      period,
      metrics: {
        candidates: candidates.length,
        recentCandidates: recentCandidates.length,
        jobs: jobs.length,
        recentJobs: recentJobs.length,
        openJobs: openJobs.length,
        interviews: interviews.length,
        recentInterviews: recentInterviews.length,
        confirmedInterviews: confirmedInterviews.length,
        approved: approvedByRh.length,
        rejected: rejected.length,
        noShow: noShow.length,
        presentations: presentations.length,
        sentToClient: presentationCandidates.length,
        approvedByClient: approvedByClient.length,
        rejectedByClient: rejectedByClient.length,
        hirings: hirings.length,
        recentHirings: recentHirings.length,
        pendingDocs: pendingDocs.length,
        approvedDocs: approvedDocs.length,
        lateDocs: 0,
        activeContracts: activeContracts.length,
        endingContracts: 0,
        tasks: tasks.length,
        recentTasks: recentTasks.length,
        pendingTasks: pendingTasks.length,
        overdueTasks: overdueTasks.length,
        urgentTasks: urgentTasks.length,
        conversionRate,
      },
      funnel,
      whatsapp: {
        sent: sentMessages,
        received: receivedMessages,
        responseRate,
        queuePending,
        paused,
        noResponse,
      },
      documents: countBy(documents, "status"),
      contracts: countBy(hirings, "status"),
      tasks: {
        total: tasks.length,
        pending: pendingTasks.length,
        overdue: overdueTasks.length,
        urgent: urgentTasks.length,
        byStatus: countBy(tasks, "status"),
      },
      presentations: {
        total: presentations.length,
        candidates: presentationCandidates.length,
        approved: approvedByClient.length,
        rejected: rejectedByClient.length,
      },
      topJobs,
      efficiency: {
        attendanceRate,
        approvalRate,
        hiringRate,
        avgDaysToHire: 0,
      },
      alerts,
    });
  } catch (error: any) {
    console.error("BI OVERVIEW ERROR:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Erro ao carregar BI." },
      { status: 500 }
    );
  }
}
