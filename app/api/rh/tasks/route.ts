import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase não configurado.");
  }

  return createClient(url, key);
}

function getCompanyId(req: NextRequest) {
  return (
    req.cookies.get("zentra_company_id")?.value ||
    req.headers.get("x-company-id") ||
    process.env.DEFAULT_COMPANY_ID ||
    ""
  );
}

function getCurrentUser(req: NextRequest) {
  return {
    id: req.cookies.get("zentra_user_id")?.value || "",
    name: req.cookies.get("zentra_user_name")?.value || "",
  };
}

function cleanString(value: any) {
  return String(value || "").trim();
}

function normalizePriority(value: any) {
  const priority = cleanString(value).toLowerCase();
  if (["urgent", "high", "normal", "low"].includes(priority)) return priority;
  if (priority === "urgente") return "urgent";
  if (priority === "alta") return "high";
  if (priority === "baixa") return "low";
  return "normal";
}

function normalizeStatus(value: any) {
  const status = cleanString(value).toLowerCase();
  if (["todo", "doing", "waiting", "done"].includes(status)) return status;
  return "todo";
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);

    const companyId = searchParams.get("companyId") || getCompanyId(req);
    const status = searchParams.get("status") || "";
    const assignedTo = searchParams.get("assignedTo") || "";
    const priority = searchParams.get("priority") || "";
    const jobId = searchParams.get("jobId") || "";
    const q = searchParams.get("q") || "";

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "Empresa não identificada." },
        { status: 401 }
      );
    }

    let query = supabase
      .from("rh_tasks")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (assignedTo) query = query.eq("assigned_to", assignedTo);
    if (priority) query = query.eq("priority", priority);
    if (jobId) query = query.eq("job_id", jobId);
    if (q) query = query.ilike("title", `%${q}%`);

    const { data: tasks, error } = await query;

    if (error) throw new Error(error.message);

    const ids = (tasks || []).map((task: any) => task.id);

    let comments: any[] = [];
    let checklist: any[] = [];

    if (ids.length > 0) {
      const { data: commentsData } = await supabase
        .from("rh_task_comments")
        .select("*")
        .in("task_id", ids)
        .order("created_at", { ascending: true });

      const { data: checklistData } = await supabase
        .from("rh_task_checklist")
        .select("*")
        .in("task_id", ids)
        .order("sort_order", { ascending: true });

      comments = commentsData || [];
      checklist = checklistData || [];
    }

    const formatted = (tasks || []).map((task: any) => ({
      ...task,
      comments: comments.filter((item: any) => item.task_id === task.id),
      checklist: checklist.filter((item: any) => item.task_id === task.id),
    }));

    return NextResponse.json({ success: true, tasks: formatted });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao buscar tarefas." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();

    const companyId = cleanString(body.companyId) || getCompanyId(req);
    const currentUser = getCurrentUser(req);

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "Empresa não identificada." },
        { status: 401 }
      );
    }

    const title = cleanString(body.title);

    if (!title) {
      return NextResponse.json(
        { success: false, error: "Título da tarefa é obrigatório." },
        { status: 400 }
      );
    }

    const payload = {
      company_id: companyId,
      branch_id: cleanString(body.branchId) || null,
      title,
      description: cleanString(body.description) || null,
      status: normalizeStatus(body.status),
      priority: normalizePriority(body.priority),
      assigned_to: cleanString(body.assignedTo) || null,
      assigned_to_name: cleanString(body.assignedToName) || null,
      created_by: cleanString(body.createdBy) || currentUser.id || null,
      created_by_name: cleanString(body.createdByName) || currentUser.name || null,
      related_type: cleanString(body.relatedType) || "general",
      job_id: cleanString(body.jobId) || null,
      candidate_id: cleanString(body.candidateId) || null,
      client_id: cleanString(body.clientId) || null,
      hiring_id: cleanString(body.hiringId) || null,
      due_date: cleanString(body.dueDate) || null,
      source_type: cleanString(body.sourceType) || "manual",
      source_id: cleanString(body.sourceId) || null,
    };

    const { data: task, error } = await supabase
      .from("rh_tasks")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    const checklistItems = Array.isArray(body.checklist)
      ? body.checklist
          .map((item: any, index: number) => ({
            task_id: task.id,
            company_id: companyId,
            label: cleanString(item?.label || item),
            done: Boolean(item?.done),
            sort_order: index,
          }))
          .filter((item: any) => item.label)
      : [];

    if (checklistItems.length > 0) {
      await supabase.from("rh_task_checklist").insert(checklistItems);
    }

    if (payload.assigned_to) {
      await supabase.from("rh_task_notifications").insert({
        company_id: companyId,
        user_id: payload.assigned_to,
        task_id: task.id,
        title: "Nova tarefa atribuída",
        message: task.title,
      });
    }

    return NextResponse.json({ success: true, task });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao criar tarefa." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();

    const companyId = cleanString(body.companyId) || getCompanyId(req);
    const id = cleanString(body.id);

    if (!companyId || !id) {
      return NextResponse.json(
        { success: false, error: "Empresa e tarefa são obrigatórias." },
        { status: 400 }
      );
    }

    const update: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined) update.title = cleanString(body.title);
    if (body.description !== undefined) update.description = cleanString(body.description) || null;
    if (body.status !== undefined) {
      update.status = normalizeStatus(body.status);
      update.completed_at = update.status === "done" ? new Date().toISOString() : null;
    }
    if (body.priority !== undefined) update.priority = normalizePriority(body.priority);
    if (body.assignedTo !== undefined) update.assigned_to = cleanString(body.assignedTo) || null;
    if (body.assignedToName !== undefined) update.assigned_to_name = cleanString(body.assignedToName) || null;
    if (body.relatedType !== undefined) update.related_type = cleanString(body.relatedType) || "general";
    if (body.jobId !== undefined) update.job_id = cleanString(body.jobId) || null;
    if (body.candidateId !== undefined) update.candidate_id = cleanString(body.candidateId) || null;
    if (body.clientId !== undefined) update.client_id = cleanString(body.clientId) || null;
    if (body.hiringId !== undefined) update.hiring_id = cleanString(body.hiringId) || null;
    if (body.dueDate !== undefined) update.due_date = cleanString(body.dueDate) || null;

    const { data: task, error } = await supabase
      .from("rh_tasks")
      .update(update)
      .eq("id", id)
      .eq("company_id", companyId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    if (body.comment) {
      const currentUser = getCurrentUser(req);
      await supabase.from("rh_task_comments").insert({
        task_id: id,
        company_id: companyId,
        user_id: currentUser.id || null,
        user_name: currentUser.name || "Usuário",
        message: cleanString(body.comment),
      });
    }

    if (body.checklistItemId) {
      await supabase
        .from("rh_task_checklist")
        .update({
          done: Boolean(body.checklistDone),
          updated_at: new Date().toISOString(),
        })
        .eq("id", cleanString(body.checklistItemId))
        .eq("company_id", companyId);
    }

    return NextResponse.json({ success: true, task });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao atualizar tarefa." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);

    const companyId = searchParams.get("companyId") || getCompanyId(req);
    const id = searchParams.get("id") || "";

    if (!companyId || !id) {
      return NextResponse.json(
        { success: false, error: "Empresa e tarefa são obrigatórias." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("rh_tasks")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao excluir tarefa." },
      { status: 500 }
    );
  }
}
