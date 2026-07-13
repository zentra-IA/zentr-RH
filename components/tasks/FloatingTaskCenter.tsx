"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status?: "todo" | "doing" | "waiting" | "done";
  priority?: "urgent" | "high" | "normal" | "low";
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  due_date?: string | null;
  job_id?: string | null;
  source_label?: string | null;
  created_at?: string | null;
};

type CompanyResponse = {
  success?: boolean;
  company?: {
    id: string;
    name?: string;
  };
  currentUser?: {
    id?: string;
    user_id?: string;
    name?: string;
  } | null;
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgente",
  high: "Alta",
  normal: "Normal",
  low: "Baixa",
};

const PRIORITY_CLASS: Record<string, string> = {
  urgent: "task-priority-urgent",
  high: "task-priority-high",
  normal: "task-priority-normal",
  low: "task-priority-low",
};

function formatDate(value?: string | null) {
  if (!value) return "Sem prazo";

  try {
    const date = new Date(value);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    return "Sem prazo";
  }
}

function isOverdue(value?: string | null) {
  if (!value) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const date = new Date(value);
  date.setHours(0, 0, 0, 0);

  return date < today;
}

function sortTasks(tasks: Task[]) {
  const order: Record<string, number> = {
    urgent: 1,
    high: 2,
    normal: 3,
    low: 4,
  };

  return [...tasks].sort((a, b) => {
    const overdueA = isOverdue(a.due_date) ? 0 : 1;
    const overdueB = isOverdue(b.due_date) ? 0 : 1;

    if (overdueA !== overdueB) return overdueA - overdueB;

    const priorityA = order[a.priority || "normal"] || 3;
    const priorityB = order[b.priority || "normal"] || 3;

    if (priorityA !== priorityB) return priorityA - priorityB;

    return new Date(a.due_date || a.created_at || "").getTime() -
      new Date(b.due_date || b.created_at || "").getTime();
  });
}

export default function FloatingTaskCenter() {
  const [open, setOpen] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"mine" | "all" | "urgent">("mine");
  const [error, setError] = useState("");

  async function loadCompany() {
    try {
      const res = await fetch("/api/company/current", { cache: "no-store" });
      const data: CompanyResponse = await res.json();

      if (!data?.success || !data.company?.id) return;

      setCompanyId(data.company.id);
      setCurrentUserId(data.currentUser?.user_id || data.currentUser?.id || "");
    } catch {
      // Silencioso para não atrapalhar telas existentes.
    }
  }

  async function loadTasks(targetCompanyId = companyId) {
    if (!targetCompanyId) return;

    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      params.set("companyId", targetCompanyId);

      const res = await fetch(`/api/rh/tasks?${params.toString()}`, {
        cache: "no-store",
      });

      const data = await res.json();

      if (!data?.success) {
        setError(data?.error || "Erro ao buscar tarefas.");
        return;
      }

      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
    } catch {
      setError("Erro ao carregar tarefas.");
    } finally {
      setLoading(false);
    }
  }

  async function updateTaskStatus(task: Task, status: Task["status"]) {
    if (!companyId || !task.id) return;

    const previous = tasks;

    setTasks((items) =>
      items.map((item) =>
        item.id === task.id ? { ...item, status } : item
      )
    );

    try {
      const res = await fetch("/api/rh/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          companyId,
          status,
        }),
      });

      const data = await res.json();

      if (!data?.success) {
        setTasks(previous);
        alert(data?.error || "Erro ao atualizar tarefa.");
      }
    } catch {
      setTasks(previous);
      alert("Erro ao atualizar tarefa.");
    }
  }

  useEffect(() => {
    loadCompany();
  }, []);

  useEffect(() => {
    if (!companyId) return;

    loadTasks(companyId);
    const interval = window.setInterval(() => loadTasks(companyId), 30000);

    return () => window.clearInterval(interval);
  }, [companyId]);

  const activeTasks = useMemo(
    () => tasks.filter((task) => task.status !== "done"),
    [tasks]
  );

  const myTasks = useMemo(() => {
    if (!currentUserId) return activeTasks;
    return activeTasks.filter(
      (task) => !task.assigned_to || task.assigned_to === currentUserId
    );
  }, [activeTasks, currentUserId]);

  const urgentTasks = useMemo(
    () => activeTasks.filter((task) => task.priority === "urgent" || isOverdue(task.due_date)),
    [activeTasks]
  );

  const visibleTasks = useMemo(() => {
    if (filter === "all") return sortTasks(activeTasks);
    if (filter === "urgent") return sortTasks(urgentTasks);
    return sortTasks(myTasks);
  }, [filter, activeTasks, urgentTasks, myTasks]);

  const badgeCount = myTasks.length || activeTasks.length;
  const overdueCount = activeTasks.filter((task) => isOverdue(task.due_date)).length;

  return (
    <>
      <button
        type="button"
        className="floating-task-button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Abrir central de tarefas"
      >
        <span className="floating-task-icon">✓</span>
        <span className="floating-task-label">Tarefas</span>
        {badgeCount > 0 && <span className="floating-task-badge">{badgeCount}</span>}
      </button>

      {open && (
        <div className="floating-task-panel">
          <div className="floating-task-header">
            <div>
              <strong>Central de tarefas</strong>
              <span>
                {overdueCount > 0
                  ? `${overdueCount} atrasada(s)`
                  : `${activeTasks.length} pendente(s)`}
              </span>
            </div>

            <button type="button" onClick={() => setOpen(false)}>
              ×
            </button>
          </div>

          <div className="floating-task-tabs">
            <button
              type="button"
              className={filter === "mine" ? "active" : ""}
              onClick={() => setFilter("mine")}
            >
              Minhas
            </button>
            <button
              type="button"
              className={filter === "urgent" ? "active" : ""}
              onClick={() => setFilter("urgent")}
            >
              Urgentes
            </button>
            <button
              type="button"
              className={filter === "all" ? "active" : ""}
              onClick={() => setFilter("all")}
            >
              Equipe
            </button>
          </div>

          <div className="floating-task-actions">
            <Link href="/crm/dashboard/tasks" onClick={() => setOpen(false)}>
              Abrir tarefas
            </Link>
            <button type="button" onClick={() => loadTasks()}>
              Atualizar
            </button>
          </div>

          <div className="floating-task-list">
            {loading && <div className="floating-task-empty">Carregando tarefas...</div>}

            {!loading && error && (
              <div className="floating-task-error">{error}</div>
            )}

            {!loading && !error && visibleTasks.length === 0 && (
              <div className="floating-task-empty">
                Nenhuma tarefa pendente nesse filtro.
              </div>
            )}

            {!loading &&
              !error &&
              visibleTasks.slice(0, 12).map((task) => {
                const priority = task.priority || "normal";
                const overdue = isOverdue(task.due_date);

                return (
                  <div key={task.id} className={`floating-task-card ${overdue ? "overdue" : ""}`}>
                    <div className="floating-task-card-top">
                      <span className={PRIORITY_CLASS[priority] || PRIORITY_CLASS.normal}>
                        {PRIORITY_LABEL[priority] || "Normal"}
                      </span>
                      <small>{formatDate(task.due_date)}</small>
                    </div>

                    <strong>{task.title}</strong>

                    <p>
                      {task.assigned_to_name
                        ? `Responsável: ${task.assigned_to_name}`
                        : "Sem responsável"}
                    </p>

                    {(task.source_label || task.job_id) && (
                      <p className="floating-task-source">
                        {task.source_label || "Vaga relacionada"}
                      </p>
                    )}

                    <div className="floating-task-card-actions">
                      <button
                        type="button"
                        onClick={() => updateTaskStatus(task, "doing")}
                      >
                        Em andamento
                      </button>
                      <button
                        type="button"
                        onClick={() => updateTaskStatus(task, "done")}
                      >
                        Concluir
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <style jsx global>{`
        .floating-task-button {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 80;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-height: 54px;
          padding: 12px 18px;
          border: 0;
          border-radius: 999px;
          background: linear-gradient(135deg, #2563eb, #38bdf8);
          color: white;
          box-shadow: 0 22px 55px rgba(37, 99, 235, 0.35);
          cursor: pointer;
          font-weight: 950;
        }

        .floating-task-icon {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.22);
          font-size: 18px;
        }

        .floating-task-label {
          font-size: 14px;
        }

        .floating-task-badge {
          min-width: 24px;
          height: 24px;
          padding: 0 7px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: #ef4444;
          color: white;
          font-size: 12px;
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.4);
        }

        .floating-task-panel {
          position: fixed;
          right: 22px;
          bottom: 90px;
          z-index: 81;
          width: min(420px, calc(100vw - 28px));
          max-height: min(680px, calc(100vh - 120px));
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-radius: 28px;
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid #bfdbfe;
          box-shadow: 0 30px 90px rgba(15, 23, 42, 0.22);
          backdrop-filter: blur(16px);
        }

        .floating-task-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 18px;
          border-bottom: 1px solid #dbeafe;
          background: linear-gradient(135deg, #eff6ff, #ffffff);
        }

        .floating-task-header strong {
          display: block;
          font-size: 17px;
          font-weight: 950;
          color: #0f172a;
        }

        .floating-task-header span {
          display: block;
          margin-top: 3px;
          font-size: 12px;
          font-weight: 800;
          color: #64748b;
        }

        .floating-task-header button {
          width: 34px;
          height: 34px;
          border: 1px solid #bfdbfe;
          background: white;
          color: #1d4ed8;
          border-radius: 999px;
          font-size: 22px;
          cursor: pointer;
        }

        .floating-task-tabs {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          padding: 12px 14px 0;
        }

        .floating-task-tabs button {
          border: 1px solid #dbeafe;
          background: #f8fafc;
          color: #334155;
          border-radius: 999px;
          padding: 9px 10px;
          font-weight: 900;
          cursor: pointer;
          font-size: 12px;
        }

        .floating-task-tabs button.active {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
        }

        .floating-task-actions {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 14px;
        }

        .floating-task-actions a,
        .floating-task-actions button {
          flex: 1;
          text-align: center;
          border: 1px solid #bfdbfe;
          background: white;
          color: #1d4ed8;
          border-radius: 14px;
          padding: 10px 12px;
          font-size: 12px;
          font-weight: 950;
          text-decoration: none;
          cursor: pointer;
        }

        .floating-task-list {
          overflow-y: auto;
          padding: 0 14px 14px;
          display: grid;
          gap: 10px;
        }

        .floating-task-card {
          border-radius: 20px;
          background: #ffffff;
          border: 1px solid #dbeafe;
          padding: 14px;
          box-shadow: 0 12px 28px rgba(37, 99, 235, 0.08);
        }

        .floating-task-card.overdue {
          border-color: #fecaca;
          background: #fff7f7;
        }

        .floating-task-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 9px;
        }

        .floating-task-card-top span {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 950;
        }

        .floating-task-card-top small {
          color: #64748b;
          font-weight: 900;
        }

        .task-priority-urgent {
          background: #fee2e2;
          color: #b91c1c;
        }

        .task-priority-high {
          background: #fef3c7;
          color: #b45309;
        }

        .task-priority-normal {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .task-priority-low {
          background: #e5e7eb;
          color: #374151;
        }

        .floating-task-card strong {
          display: block;
          font-size: 14px;
          font-weight: 950;
          color: #0f172a;
          line-height: 1.25;
        }

        .floating-task-card p {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
        }

        .floating-task-source {
          color: #1d4ed8 !important;
        }

        .floating-task-card-actions {
          margin-top: 12px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .floating-task-card-actions button {
          border: 1px solid #dbeafe;
          background: #f8fafc;
          color: #1e3a8a;
          border-radius: 12px;
          padding: 9px 8px;
          font-size: 11px;
          font-weight: 950;
          cursor: pointer;
        }

        .floating-task-card-actions button:last-child {
          background: #dcfce7;
          border-color: #bbf7d0;
          color: #166534;
        }

        .floating-task-empty,
        .floating-task-error {
          padding: 24px;
          border-radius: 18px;
          text-align: center;
          font-size: 13px;
          font-weight: 900;
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          color: #64748b;
        }

        .floating-task-error {
          background: #fef2f2;
          border-color: #fecaca;
          color: #991b1b;
        }

        @media (max-width: 768px) {
          .floating-task-button {
            right: 14px;
            bottom: 14px;
            min-height: 50px;
            padding: 10px 14px;
          }

          .floating-task-label {
            display: none;
          }

          .floating-task-panel {
            right: 10px;
            left: 10px;
            bottom: 76px;
            width: auto;
            max-height: calc(100vh - 100px);
            border-radius: 24px;
          }
        }
      `}</style>
    </>
  );
}
