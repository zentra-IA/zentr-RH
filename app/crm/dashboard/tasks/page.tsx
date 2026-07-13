"use client";

import { useEffect, useMemo, useState } from "react";

type User = {
  id?: string;
  user_id?: string;
  name?: string;
  email?: string;
};

type Job = {
  id: string;
  title?: string;
  department?: string;
  clientName?: string;
};

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: "todo" | "doing" | "waiting" | "done";
  priority: "urgent" | "high" | "normal" | "low";
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  related_type?: string | null;
  job_id?: string | null;
  due_date?: string | null;
  created_at?: string;
  comments?: any[];
  checklist?: any[];
};

const STATUSES = [
  { key: "todo", label: "A Fazer" },
  { key: "doing", label: "Em andamento" },
  { key: "waiting", label: "Aguardando" },
  { key: "done", label: "Concluída" },
] as const;

const PRIORITIES = [
  { key: "urgent", label: "Urgente", className: "priority-urgent", order: 1 },
  { key: "high", label: "Alta", className: "priority-high", order: 2 },
  { key: "normal", label: "Normal", className: "priority-normal", order: 3 },
  { key: "low", label: "Baixa", className: "priority-low", order: 4 },
] as const;

const INITIAL_FORM = {
  title: "",
  description: "",
  assignedTo: "",
  assignedToName: "",
  priority: "normal",
  status: "todo",
  relatedType: "general",
  jobId: "",
  dueDate: "",
  checklistText: "",
};

function getPriority(priority: string) {
  return PRIORITIES.find((item) => item.key === priority) || PRIORITIES[2];
}

function priorityOrder(priority: string) {
  return getPriority(priority).order;
}

function safeArray(value: any) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.users)) return value.users;
  if (Array.isArray(value?.jobs)) return value.jobs;
  if (Array.isArray(value?.tasks)) return value.tasks;
  return [];
}

export default function TasksPage() {
  const [companyId, setCompanyId] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [commentTask, setCommentTask] = useState<Task | null>(null);
  const [commentText, setCommentText] = useState("");

  const [form, setForm] = useState<any>(INITIAL_FORM);

  const [filters, setFilters] = useState({
    q: "",
    assignedTo: "",
    priority: "",
    status: "",
    jobId: "",
  });

  async function loadBase() {
    try {
      const companyRes = await fetch("/api/company/current", { cache: "no-store" });
      const companyData = await companyRes.json();

      const id = companyData?.company?.id || "";
      setCompanyId(id);
      setCurrentUser(companyData?.currentUser || null);

      if (!id) return;

      const usersRes = await fetch(`/api/admin/users?companyId=${id}`, { cache: "no-store" });
      const usersData = await usersRes.json();
      setUsers(safeArray(usersData));

      try {
        const jobsRes = await fetch("/api/rh/jobs", { cache: "no-store" });
        const jobsData = await jobsRes.json();
        setJobs(safeArray(jobsData));
      } catch {
        setJobs([]);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function loadTasks(id = companyId) {
    if (!id) return;

    try {
      setLoading(true);

      const params = new URLSearchParams();
      params.set("companyId", id);
      if (filters.q) params.set("q", filters.q);
      if (filters.assignedTo) params.set("assignedTo", filters.assignedTo);
      if (filters.priority) params.set("priority", filters.priority);
      if (filters.status) params.set("status", filters.status);
      if (filters.jobId) params.set("jobId", filters.jobId);

      const res = await fetch(`/api/rh/tasks?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();

      if (!data?.success) throw new Error(data?.error || "Erro ao buscar tarefas");

      setTasks(data.tasks || []);
    } catch (error: any) {
      alert(error?.message || "Erro ao buscar tarefas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBase();
  }, []);

  useEffect(() => {
    if (companyId) loadTasks(companyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const filteredTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const p = priorityOrder(a.priority) - priorityOrder(b.priority);
      if (p !== 0) return p;
      const ad = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      return ad - bd;
    });
  }, [tasks]);

  function openCreate() {
    setEditingTask(null);
    setForm(INITIAL_FORM);
    setShowForm(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setForm({
      title: task.title || "",
      description: task.description || "",
      assignedTo: task.assigned_to || "",
      assignedToName: task.assigned_to_name || "",
      priority: task.priority || "normal",
      status: task.status || "todo",
      relatedType: task.related_type || "general",
      jobId: task.job_id || "",
      dueDate: task.due_date ? String(task.due_date).slice(0, 10) : "",
      checklistText: "",
    });
    setShowForm(true);
  }

  async function saveTask(event: React.FormEvent) {
    event.preventDefault();

    if (!companyId) {
      alert("Empresa não identificada.");
      return;
    }

    if (!form.title.trim()) {
      alert("Digite o título da tarefa.");
      return;
    }

    try {
      setSaving(true);

      const selectedUser = users.find((user) => String(user.user_id || user.id) === form.assignedTo);
      const checklist = String(form.checklistText || "")
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((label) => ({ label }));

      const payload = {
        id: editingTask?.id,
        companyId,
        title: form.title,
        description: form.description,
        assignedTo: form.assignedTo || null,
        assignedToName: selectedUser?.name || selectedUser?.email || form.assignedToName || null,
        priority: form.priority,
        status: form.status,
        relatedType: form.relatedType,
        jobId: form.jobId || null,
        dueDate: form.dueDate || null,
        checklist,
        createdBy: currentUser?.user_id || currentUser?.id || null,
        createdByName: currentUser?.name || currentUser?.email || null,
      };

      const res = await fetch("/api/rh/tasks", {
        method: editingTask ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data?.success) throw new Error(data?.error || "Erro ao salvar tarefa");

      setShowForm(false);
      setEditingTask(null);
      setForm(INITIAL_FORM);
      await loadTasks();
    } catch (error: any) {
      alert(error?.message || "Erro ao salvar tarefa");
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(task: Task, patch: any) {
    try {
      const res = await fetch("/api/rh/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, id: task.id, ...patch }),
      });

      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Erro ao atualizar tarefa");

      await loadTasks();
    } catch (error: any) {
      alert(error?.message || "Erro ao atualizar tarefa");
    }
  }

  async function deleteTask(task: Task) {
    if (!confirm("Excluir esta tarefa?")) return;

    try {
      const res = await fetch(`/api/rh/tasks?companyId=${companyId}&id=${task.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Erro ao excluir tarefa");

      await loadTasks();
    } catch (error: any) {
      alert(error?.message || "Erro ao excluir tarefa");
    }
  }

  async function saveComment(event: React.FormEvent) {
    event.preventDefault();

    if (!commentTask || !commentText.trim()) return;

    await updateTask(commentTask, { comment: commentText.trim() });
    setCommentText("");
    setCommentTask(null);
  }

  return (
    <div className="tasks-page">
      <header className="tasks-header">
        <div>
          <span className="eyebrow">Colaboração interna</span>
          <h1>Tarefas</h1>
          <p>Organize pendências por responsável, prioridade, prazo e vaga.</p>
        </div>

        <button className="primary-btn" onClick={openCreate}>
          + Nova tarefa
        </button>
      </header>

      <section className="tasks-filters">
        <input
          placeholder="Buscar tarefa..."
          value={filters.q}
          onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
        />

        <select
          value={filters.assignedTo}
          onChange={(e) => setFilters((prev) => ({ ...prev, assignedTo: e.target.value }))}
        >
          <option value="">Todos responsáveis</option>
          {users.map((user) => {
            const id = String(user.user_id || user.id || "");
            return (
              <option key={id} value={id}>
                {user.name || user.email || "Usuário"}
              </option>
            );
          })}
        </select>

        <select
          value={filters.priority}
          onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value }))}
        >
          <option value="">Todas prioridades</option>
          {PRIORITIES.map((priority) => (
            <option key={priority.key} value={priority.key}>
              {priority.label}
            </option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
        >
          <option value="">Todos status</option>
          {STATUSES.map((status) => (
            <option key={status.key} value={status.key}>
              {status.label}
            </option>
          ))}
        </select>

        <select
          value={filters.jobId}
          onChange={(e) => setFilters((prev) => ({ ...prev, jobId: e.target.value }))}
        >
          <option value="">Todas vagas</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title || job.department || "Vaga sem título"}
            </option>
          ))}
        </select>

        <button className="secondary-btn" onClick={() => loadTasks()}>
          Filtrar
        </button>
      </section>

      {showForm && (
        <section className="task-form-card">
          <div className="form-title">
            <div>
              <h2>{editingTask ? "Editar tarefa" : "Nova tarefa"}</h2>
              <p>{editingTask ? "Atualize as informações da tarefa." : "Crie uma pendência para a equipe."}</p>
            </div>

            <button className="ghost-btn" onClick={() => setShowForm(false)}>
              Fechar
            </button>
          </div>

          <form onSubmit={saveTask} className="task-form">
            <label>
              Título
              <input
                value={form.title}
                onChange={(e) => setForm((prev: any) => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Reagendar entrevista do João"
              />
            </label>

            <label>
              Descrição
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev: any) => ({ ...prev, description: e.target.value }))}
                placeholder="Detalhes da tarefa..."
              />
            </label>

            <label>
              Responsável
              <select
                value={form.assignedTo}
                onChange={(e) => setForm((prev: any) => ({ ...prev, assignedTo: e.target.value }))}
              >
                <option value="">Sem responsável</option>
                {users.map((user) => {
                  const id = String(user.user_id || user.id || "");
                  return (
                    <option key={id} value={id}>
                      {user.name || user.email || "Usuário"}
                    </option>
                  );
                })}
              </select>
            </label>

            <label>
              Status
              <select
                value={form.status}
                onChange={(e) => setForm((prev: any) => ({ ...prev, status: e.target.value }))}
              >
                {STATUSES.map((status) => (
                  <option key={status.key} value={status.key}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="field-label">Prioridade</span>
              <div className="priority-row">
                {PRIORITIES.map((priority) => (
                  <button
                    type="button"
                    key={priority.key}
                    className={`priority-btn ${priority.className} ${form.priority === priority.key ? "selected" : ""}`}
                    onClick={() => setForm((prev: any) => ({ ...prev, priority: priority.key }))}
                  >
                    {priority.label}
                  </button>
                ))}
              </div>
            </div>

            <label>
              Relacionar com vaga
              <select
                value={form.jobId}
                onChange={(e) =>
                  setForm((prev: any) => ({
                    ...prev,
                    jobId: e.target.value,
                    relatedType: e.target.value ? "job" : "general",
                  }))
                }
              >
                <option value="">Tarefa geral</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title || job.department || "Vaga sem título"}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Prazo
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((prev: any) => ({ ...prev, dueDate: e.target.value }))}
              />
            </label>

            {!editingTask && (
              <label className="full">
                Checklist inicial
                <textarea
                  value={form.checklistText}
                  onChange={(e) => setForm((prev: any) => ({ ...prev, checklistText: e.target.value }))}
                  placeholder={"Um item por linha\nEx: Confirmar disponibilidade\nEx: Enviar feedback"}
                />
              </label>
            )}

            <div className="form-actions">
              <button type="button" className="ghost-btn" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              <button type="submit" className="primary-btn" disabled={saving}>
                {saving ? "Salvando..." : editingTask ? "Salvar alterações" : "Criar tarefa"}
              </button>
            </div>
          </form>
        </section>
      )}

      {loading ? (
        <div className="empty-card">Carregando tarefas...</div>
      ) : (
        <section className="tasks-kanban">
          {STATUSES.map((status) => {
            const columnTasks = filteredTasks.filter((task) => task.status === status.key);

            return (
              <div className="task-column" key={status.key}>
                <div className="column-head">
                  <strong>{status.label}</strong>
                  <span>{columnTasks.length}</span>
                </div>

                <div className="column-list">
                  {columnTasks.length === 0 && <div className="empty-column">Nenhuma tarefa</div>}

                  {columnTasks.map((task) => {
                    const priority = getPriority(task.priority);
                    const job = jobs.find((item) => item.id === task.job_id);

                    return (
                      <article className="task-card" key={task.id}>
                        <div className="card-top">
                          <span className={`priority-pill ${priority.className}`}>{priority.label}</span>
                          <button className="tiny-btn" onClick={() => openEdit(task)}>
                            Editar
                          </button>
                        </div>

                        <h3>{task.title}</h3>

                        {task.description && <p className="task-description">{task.description}</p>}

                        <div className="task-meta">
                          <span>👤 {task.assigned_to_name || "Sem responsável"}</span>
                          {task.due_date && <span>📅 {String(task.due_date).slice(0, 10).split("-").reverse().join("/")}</span>}
                          {job && <span>💼 {job.title || job.department}</span>}
                        </div>

                        {task.checklist && task.checklist.length > 0 && (
                          <div className="mini-checklist">
                            {task.checklist.slice(0, 3).map((item: any) => (
                              <label key={item.id}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(item.done)}
                                  onChange={(e) =>
                                    updateTask(task, {
                                      checklistItemId: item.id,
                                      checklistDone: e.target.checked,
                                    })
                                  }
                                />
                                {item.label}
                              </label>
                            ))}
                          </div>
                        )}

                        <div className="status-row">
                          {STATUSES.map((item) => (
                            <button
                              key={item.key}
                              className={task.status === item.key ? "active-status" : ""}
                              onClick={() => updateTask(task, { status: item.key })}
                              title={item.label}
                            >
                              {item.label.split(" ")[0]}
                            </button>
                          ))}
                        </div>

                        <div className="task-actions">
                          <button onClick={() => setCommentTask(task)}>
                            Comentários ({task.comments?.length || 0})
                          </button>
                          <button onClick={() => deleteTask(task)}>Excluir</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {commentTask && (
        <div className="modal-backdrop" onClick={() => setCommentTask(null)}>
          <div className="comment-modal" onClick={(event) => event.stopPropagation()}>
            <div className="form-title">
              <div>
                <h2>Comentários</h2>
                <p>{commentTask.title}</p>
              </div>

              <button className="ghost-btn" onClick={() => setCommentTask(null)}>
                Fechar
              </button>
            </div>

            <div className="comments-list">
              {(commentTask.comments || []).length === 0 && <div className="empty-column">Nenhum comentário ainda.</div>}

              {(commentTask.comments || []).map((comment: any) => (
                <div className="comment-item" key={comment.id}>
                  <strong>{comment.user_name || "Usuário"}</strong>
                  <p>{comment.message}</p>
                  <small>{comment.created_at ? new Date(comment.created_at).toLocaleString("pt-BR") : ""}</small>
                </div>
              ))}
            </div>

            <form onSubmit={saveComment} className="comment-form">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Escreva um comentário..."
              />
              <button className="primary-btn" type="submit">
                Enviar
              </button>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .tasks-page {
          padding: 24px;
          min-height: 100vh;
        }

        .tasks-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 18px;
        }

        .eyebrow {
          display: inline-flex;
          padding: 6px 10px;
          border-radius: 999px;
          background: #dbeafe;
          color: #1d4ed8;
          font-weight: 900;
          font-size: 12px;
        }

        h1 {
          margin: 10px 0 4px;
          font-size: 32px;
          font-weight: 950;
          color: #0f172a;
        }

        h2,
        h3,
        p {
          margin: 0;
        }

        .tasks-header p {
          color: #64748b;
          font-weight: 700;
        }

        .primary-btn,
        .secondary-btn,
        .ghost-btn,
        .tiny-btn {
          border: 0;
          cursor: pointer;
          font-weight: 900;
          border-radius: 14px;
        }

        .primary-btn {
          background: linear-gradient(135deg, #2563eb, #38bdf8);
          color: #fff;
          padding: 12px 16px;
          box-shadow: 0 14px 30px rgba(37, 99, 235, 0.2);
        }

        .secondary-btn {
          background: #eff6ff;
          color: #1d4ed8;
          padding: 11px 14px;
          border: 1px solid #bfdbfe;
        }

        .ghost-btn,
        .tiny-btn {
          background: #fff;
          color: #334155;
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
        }

        .tiny-btn {
          padding: 6px 9px;
          font-size: 12px;
        }

        .tasks-filters,
        .task-form-card,
        .empty-card {
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid #dbeafe;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
          border-radius: 24px;
        }

        .tasks-filters {
          display: grid;
          grid-template-columns: 1.5fr repeat(4, 1fr) auto;
          gap: 10px;
          padding: 14px;
          margin-bottom: 16px;
        }

        input,
        select,
        textarea {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 14px;
          padding: 11px 12px;
          font-weight: 800;
          color: #0f172a;
          background: #fff;
          outline: none;
        }

        textarea {
          min-height: 88px;
          resize: vertical;
        }

        .task-form-card {
          padding: 18px;
          margin-bottom: 18px;
        }

        .form-title {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .form-title h2 {
          font-size: 22px;
          font-weight: 950;
        }

        .form-title p {
          color: #64748b;
          margin-top: 4px;
          font-weight: 700;
        }

        .task-form {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        .task-form label,
        .field-label {
          display: grid;
          gap: 7px;
          font-size: 13px;
          font-weight: 950;
          color: #334155;
        }

        .full {
          grid-column: 1 / -1;
        }

        .priority-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .priority-btn,
        .priority-pill {
          border: 0;
          border-radius: 999px;
          padding: 8px 12px;
          font-weight: 950;
          font-size: 12px;
        }

        .priority-btn {
          cursor: pointer;
          opacity: 0.72;
        }

        .priority-btn.selected {
          opacity: 1;
          outline: 3px solid rgba(37, 99, 235, 0.18);
        }

        .priority-urgent {
          background: #fee2e2;
          color: #b91c1c;
        }

        .priority-high {
          background: #fef3c7;
          color: #b45309;
        }

        .priority-normal {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .priority-low {
          background: #e5e7eb;
          color: #374151;
        }

        .form-actions {
          grid-column: 1 / -1;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .tasks-kanban {
          display: grid;
          grid-template-columns: repeat(4, minmax(280px, 1fr));
          gap: 14px;
          align-items: flex-start;
        }

        .task-column {
          background: rgba(239, 246, 255, 0.8);
          border: 1px solid #bfdbfe;
          border-radius: 24px;
          padding: 12px;
          min-height: 360px;
        }

        .column-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 6px 12px;
        }

        .column-head strong {
          font-size: 15px;
          font-weight: 950;
        }

        .column-head span {
          background: #fff;
          border: 1px solid #dbeafe;
          padding: 4px 9px;
          border-radius: 999px;
          font-weight: 950;
          color: #1d4ed8;
        }

        .column-list {
          display: grid;
          gap: 10px;
        }

        .task-card {
          background: #fff;
          border: 1px solid #dbeafe;
          border-radius: 20px;
          padding: 14px;
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.06);
        }

        .card-top {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: center;
          margin-bottom: 10px;
        }

        .task-card h3 {
          font-size: 16px;
          font-weight: 950;
          color: #0f172a;
          margin-bottom: 7px;
        }

        .task-description {
          color: #64748b;
          font-size: 13px;
          line-height: 1.45;
          font-weight: 700;
          margin-bottom: 10px;
        }

        .task-meta {
          display: grid;
          gap: 6px;
          color: #475569;
          font-size: 12px;
          font-weight: 850;
          margin: 10px 0;
        }

        .mini-checklist {
          display: grid;
          gap: 7px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 10px;
          margin: 10px 0;
        }

        .mini-checklist label {
          display: flex;
          gap: 8px;
          font-size: 12px;
          font-weight: 800;
          color: #334155;
        }

        .status-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          margin-top: 12px;
        }

        .status-row button {
          border: 1px solid #dbeafe;
          background: #eff6ff;
          color: #1d4ed8;
          border-radius: 10px;
          padding: 7px 4px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 950;
        }

        .status-row button.active-status {
          background: #2563eb;
          color: #fff;
          border-color: #2563eb;
        }

        .task-actions {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin-top: 12px;
        }

        .task-actions button {
          border: 0;
          background: transparent;
          color: #2563eb;
          font-weight: 950;
          cursor: pointer;
          padding: 6px 0;
        }

        .task-actions button:last-child {
          color: #dc2626;
        }

        .empty-column,
        .empty-card {
          padding: 18px;
          color: #64748b;
          font-weight: 850;
          text-align: center;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          display: grid;
          place-items: center;
          z-index: 100;
          padding: 18px;
        }

        .comment-modal {
          width: min(720px, 100%);
          max-height: 90vh;
          overflow-y: auto;
          background: #fff;
          border-radius: 24px;
          padding: 18px;
          box-shadow: 0 30px 80px rgba(15, 23, 42, 0.28);
        }

        .comments-list {
          display: grid;
          gap: 10px;
          margin: 14px 0;
        }

        .comment-item {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 12px;
        }

        .comment-item strong {
          display: block;
          font-size: 13px;
          font-weight: 950;
        }

        .comment-item p {
          margin-top: 5px;
          color: #334155;
          font-weight: 750;
        }

        .comment-item small {
          display: block;
          margin-top: 7px;
          color: #94a3b8;
          font-weight: 750;
        }

        .comment-form {
          display: grid;
          gap: 10px;
        }

        @media (max-width: 1024px) {
          .tasks-filters {
            grid-template-columns: repeat(2, 1fr);
          }

          .tasks-kanban {
            display: flex;
            overflow-x: auto;
            padding-bottom: 12px;
          }

          .task-column {
            min-width: 310px;
          }
        }

        @media (max-width: 768px) {
          .tasks-page {
            padding: 14px;
          }

          .tasks-header {
            display: grid;
          }

          h1 {
            font-size: 26px;
          }

          .tasks-filters,
          .task-form {
            grid-template-columns: 1fr;
          }

          .form-actions {
            justify-content: stretch;
            flex-direction: column-reverse;
          }

          .form-actions button,
          .tasks-header button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
