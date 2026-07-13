"use client";

import { useEffect, useMemo, useState } from "react";

type Candidate = {
  id: string;
  candidate_name: string;
  candidate_phone?: string | null;
  candidate_email?: string | null;
  job_title?: string | null;
  status: string;
  client_notes?: string | null;
  interview_at?: string | null;
};

type WorkflowStatus = "in_progress" | "paused" | "finished" | "cancelled";

type Presentation = {
  id: string;
  token: string;
  title?: string | null;
  job_id: string;
  status: string;
  workflow_status?: WorkflowStatus | null;
  created_at: string;
  viewed_at?: string | null;
  sent_at?: string | null;
  candidates?: Candidate[];
};

const COLUMNS: Array<{
  id: WorkflowStatus;
  title: string;
  subtitle: string;
  color: string;
}> = [
  {
    id: "in_progress",
    title: "Processo em andamento",
    subtitle: "Apresentações ativas e aguardando retorno",
    color: "#2563eb",
  },
  {
    id: "paused",
    title: "Processo pausado",
    subtitle: "Processos temporariamente suspensos",
    color: "#d97706",
  },
  {
    id: "finished",
    title: "Processo finalizado",
    subtitle: "Apresentações concluídas",
    color: "#16a34a",
  },
  {
    id: "cancelled",
    title: "Processo cancelado",
    subtitle: "Processos encerrados sem continuidade",
    color: "#dc2626",
  },
];

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Rascunho",
    sent: "Enviado",
    viewed: "Visualizado",
    finished: "Finalizado",
    waiting_client: "Aguardando cliente",
    approved_by_client: "Aprovado pelo cliente",
    rejected_by_client: "Reprovado pelo cliente",
    sent_to_hiring: "Enviado para contratação",
  };

  return labels[status] || status;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getWorkflowStatus(presentation: Presentation): WorkflowStatus {
  if (
    presentation.workflow_status &&
    ["in_progress", "paused", "finished", "cancelled"].includes(
      presentation.workflow_status
    )
  ) {
    return presentation.workflow_status;
  }

  return presentation.status === "finished" ? "finished" : "in_progress";
}

export default function CandidatePresentationsPage() {
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [q, setQ] = useState("");
  const [workflowFilter, setWorkflowFilter] = useState("all");
  const [draggedId, setDraggedId] = useState("");
  const [editing, setEditing] = useState<Presentation | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  const filteredPresentations = useMemo(() => {
    const normalized = q.trim().toLowerCase();

    return presentations.filter((presentation) => {
      const workflow = getWorkflowStatus(presentation);

      if (workflowFilter !== "all" && workflow !== workflowFilter) {
        return false;
      }

      if (!normalized) return true;

      const candidateText = (presentation.candidates || [])
        .flatMap((candidate) => [
          candidate.candidate_name,
          candidate.candidate_phone,
          candidate.candidate_email,
          candidate.job_title,
        ])
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return [
        presentation.title,
        presentation.token,
        candidateText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [presentations, q, workflowFilter]);

  async function loadPresentations() {
    try {
      setLoading(true);

      const res = await fetch("/api/rh/candidate-presentations", {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao carregar apresentações.");
        return;
      }

      setPresentations(data.presentations || []);
    } finally {
      setLoading(false);
    }
  }

  async function patchPresentation(
    id: string,
    payload: Record<string, unknown>
  ) {
    setSavingId(id);

    try {
      const res = await fetch("/api/rh/candidate-presentations", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, ...payload }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao atualizar apresentação.");
        return null;
      }

      setPresentations((current) =>
        current.map((item) =>
          item.id === id ? { ...item, ...data.presentation } : item
        )
      );

      return data.presentation as Presentation;
    } finally {
      setSavingId("");
    }
  }

  async function movePresentation(
    presentation: Presentation,
    workflowStatus: WorkflowStatus
  ) {
    const previousStatus = getWorkflowStatus(presentation);

    if (previousStatus === workflowStatus) return;

    setPresentations((current) =>
      current.map((item) =>
        item.id === presentation.id
          ? { ...item, workflow_status: workflowStatus }
          : item
      )
    );

    const updated = await patchPresentation(presentation.id, {
      workflow_status: workflowStatus,
    });

    if (!updated) {
      setPresentations((current) =>
        current.map((item) =>
          item.id === presentation.id
            ? { ...item, workflow_status: previousStatus }
            : item
        )
      );
    }
  }

  async function saveEdit() {
    if (!editing) return;

    const title = editTitle.trim();

    if (!title) {
      alert("Informe o nome da vaga/apresentação.");
      return;
    }

    const updated = await patchPresentation(editing.id, { title });

    if (updated) {
      setEditing(null);
      setEditTitle("");
    }
  }

  async function deletePresentation(presentation: Presentation) {
    const confirmed = confirm(
      `Excluir definitivamente a apresentação "${presentation.title || "Vaga"}"?\n\nO link público e os candidatos vinculados a esta apresentação também serão removidos.`
    );

    if (!confirmed) return;

    setSavingId(presentation.id);

    try {
      const res = await fetch(
        `/api/rh/candidate-presentations?id=${encodeURIComponent(
          presentation.id
        )}`,
        {
          method: "DELETE",
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao excluir apresentação.");
        return;
      }

      setPresentations((current) =>
        current.filter((item) => item.id !== presentation.id)
      );
    } finally {
      setSavingId("");
    }
  }

  async function copyLink(presentation: Presentation) {
    const link = `${baseUrl}/cliente/vaga/${presentation.token}`;
    await navigator.clipboard.writeText(link).catch(() => null);
    alert("Link copiado.");
  }

  function whatsappLink(presentation: Presentation) {
    const link = `${baseUrl}/cliente/vaga/${presentation.token}`;
    const title = presentation.title || "a vaga";
    const text = `Olá! Segue o link com os candidatos pré-selecionados para ${title}: ${link}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  useEffect(() => {
    loadPresentations();
  }, []);

  return (
    <main className="page">
      <header className="header">
        <div>
          <span className="eyebrow">RH → Cliente</span>
          <h1>Apresentação de Candidatos</h1>
          <p>
            Organize os processos enviados aos clientes e acompanhe cada etapa.
          </p>
        </div>

        <button className="primary" onClick={loadPresentations}>
          Atualizar
        </button>
      </header>

      <section className="filters">
        <input
          placeholder="Buscar vaga, candidato, telefone ou e-mail"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />

        <select
          value={workflowFilter}
          onChange={(event) => setWorkflowFilter(event.target.value)}
        >
          <option value="all">Todos os processos</option>
          {COLUMNS.map((column) => (
            <option key={column.id} value={column.id}>
              {column.title}
            </option>
          ))}
        </select>

        <button
          className="secondary"
          onClick={() => {
            setQ("");
            setWorkflowFilter("all");
          }}
        >
          Limpar filtros
        </button>
      </section>

      {loading && <div className="empty">Carregando apresentações...</div>}

      {!loading && presentations.length === 0 && (
        <div className="empty">
          Nenhuma apresentação encontrada. Quando o RH aprovar um candidato,
          ele aparecerá aqui.
        </div>
      )}

      {!loading && presentations.length > 0 && (
        <section className="kanban">
          {COLUMNS.map((column) => {
            const items = filteredPresentations.filter(
              (presentation) => getWorkflowStatus(presentation) === column.id
            );

            return (
              <section
                className="column"
                key={column.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  const presentation = presentations.find(
                    (item) => item.id === draggedId
                  );

                  if (presentation) {
                    movePresentation(presentation, column.id);
                  }

                  setDraggedId("");
                }}
              >
                <header className="column-header">
                  <div>
                    <strong style={{ color: column.color }}>
                      {column.title}
                    </strong>
                    <small>{column.subtitle}</small>
                  </div>
                  <span>{items.length}</span>
                </header>

                <div className="column-body">
                  {items.map((presentation) => {
                    const candidates = presentation.candidates || [];
                    const approved = candidates.filter((candidate) =>
                      ["approved_by_client", "sent_to_hiring"].includes(
                        candidate.status
                      )
                    ).length;
                    const rejected = candidates.filter(
                      (candidate) =>
                        candidate.status === "rejected_by_client"
                    ).length;

                    return (
                      <article
                        key={presentation.id}
                        className={`card ${
                          savingId === presentation.id ? "saving" : ""
                        }`}
                        draggable
                        onDragStart={() => setDraggedId(presentation.id)}
                        onDragEnd={() => setDraggedId("")}
                      >
                        <div className="card-top">
                          <div>
                            <h2>{presentation.title || "Vaga"}</h2>
                            <p>
                              Criado em {formatDate(presentation.created_at)}
                            </p>
                          </div>

                          <span className={`badge ${presentation.status}`}>
                            {statusLabel(presentation.status)}
                          </span>
                        </div>

                        <div className="stats">
                          <span>
                            <strong>{candidates.length}</strong>
                            candidato(s)
                          </span>
                          <span>
                            <strong>{approved}</strong>
                            aprovado(s)
                          </span>
                          <span>
                            <strong>{rejected}</strong>
                            reprovado(s)
                          </span>
                        </div>

                        <div className="candidate-list">
                          {candidates.slice(0, 5).map((candidate) => (
                            <div key={candidate.id} className="candidate">
                              <div>
                                <strong>{candidate.candidate_name}</strong>
                                <small>
                                  {candidate.candidate_phone ||
                                    candidate.candidate_email ||
                                    "-"}
                                </small>
                              </div>

                              <em className={candidate.status}>
                                {statusLabel(candidate.status)}
                              </em>
                            </div>
                          ))}

                          {candidates.length > 5 && (
                            <small className="more">
                              + {candidates.length - 5} candidato(s)
                            </small>
                          )}
                        </div>

                        <label className="mobile-status">
                          Mover processo
                          <select
                            value={getWorkflowStatus(presentation)}
                            onChange={(event) =>
                              movePresentation(
                                presentation,
                                event.target.value as WorkflowStatus
                              )
                            }
                          >
                            {COLUMNS.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.title}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div className="actions">
                          <button
                            onClick={() => copyLink(presentation)}
                            className="blue"
                          >
                            Copiar link
                          </button>

                          <a
                            className="blue"
                            href={`/cliente/vaga/${presentation.token}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Abrir link
                          </a>

                          <a
                            className="green"
                            href={whatsappLink(presentation)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Enviar WhatsApp
                          </a>

                          <button
                            className="outline"
                            onClick={() => {
                              setEditing(presentation);
                              setEditTitle(presentation.title || "");
                            }}
                          >
                            Editar
                          </button>

                          <button
                            className="danger"
                            onClick={() => deletePresentation(presentation)}
                          >
                            Excluir
                          </button>
                        </div>
                      </article>
                    );
                  })}

                  {items.length === 0 && (
                    <div className="column-empty">
                      Arraste um processo para esta etapa.
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </section>
      )}

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <section
            className="modal"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="eyebrow">Editar processo</span>
                <h2>Editar apresentação</h2>
              </div>
              <button
                className="close"
                onClick={() => setEditing(null)}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            <label>
              Nome da vaga/apresentação
              <input
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                autoFocus
              />
            </label>

            <label>
              Etapa do processo
              <select
                value={getWorkflowStatus(editing)}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    workflow_status: event.target.value as WorkflowStatus,
                  })
                }
              >
                {COLUMNS.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.title}
                  </option>
                ))}
              </select>
            </label>

            <footer>
              <button
                className="secondary"
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>
              <button
                className="primary"
                onClick={async () => {
                  if (!editing) return;

                  const titleUpdated = await patchPresentation(editing.id, {
                    title: editTitle.trim(),
                    workflow_status: getWorkflowStatus(editing),
                  });

                  if (titleUpdated) {
                    setEditing(null);
                    setEditTitle("");
                  }
                }}
              >
                Salvar alterações
              </button>
            </footer>
          </section>
        </div>
      )}

      <style jsx>{`
        .page {
          display: grid;
          gap: 18px;
          min-width: 0;
        }

        .header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 22px;
          border-radius: 28px;
          background: #ffffff;
          border: 1px solid #dbeafe;
          box-shadow: 0 18px 50px rgba(37, 99, 235, 0.08);
        }

        .eyebrow {
          display: inline-flex;
          padding: 7px 12px;
          border-radius: 999px;
          background: #dbeafe;
          color: #1d4ed8;
          font-size: 12px;
          font-weight: 950;
          margin-bottom: 10px;
        }

        h1,
        h2,
        p {
          margin: 0;
        }

        h1 {
          font-size: clamp(28px, 5vw, 44px);
          letter-spacing: -0.05em;
        }

        .header p {
          color: #64748b;
          font-weight: 750;
          margin-top: 8px;
        }

        .filters {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) 220px auto;
          gap: 10px;
          padding: 14px;
          border-radius: 22px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
        }

        input,
        select {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 14px;
          padding: 11px 13px;
          font: inherit;
          font-weight: 750;
          background: #ffffff;
          box-sizing: border-box;
        }

        button,
        .actions a {
          border: 0;
          border-radius: 14px;
          padding: 11px 13px;
          font: inherit;
          font-weight: 900;
          cursor: pointer;
          text-decoration: none;
          text-align: center;
          box-sizing: border-box;
        }

        .primary,
        .blue {
          background: #2563eb;
          color: #ffffff;
        }

        .secondary,
        .outline {
          background: #ffffff;
          color: #334155;
          border: 1px solid #cbd5e1;
        }

        .green {
          background: #16a34a;
          color: #ffffff;
        }

        .danger {
          background: #fff1f2;
          color: #be123c;
          border: 1px solid #fecdd3;
        }

        .kanban {
          display: grid;
          grid-template-columns: repeat(4, minmax(300px, 1fr));
          gap: 14px;
          overflow-x: auto;
          padding-bottom: 12px;
          scroll-snap-type: x proximity;
        }

        .column {
          min-width: 300px;
          min-height: 520px;
          display: flex;
          flex-direction: column;
          border: 1px solid #dbeafe;
          border-radius: 22px;
          background: #f8fafc;
          overflow: hidden;
          scroll-snap-align: start;
        }

        .column-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 15px;
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
        }

        .column-header strong,
        .column-header small {
          display: block;
        }

        .column-header strong {
          font-size: 15px;
          font-weight: 950;
        }

        .column-header small {
          margin-top: 4px;
          color: #64748b;
          line-height: 1.35;
        }

        .column-header > span {
          display: grid;
          place-items: center;
          min-width: 28px;
          height: 28px;
          border-radius: 999px;
          background: #e2e8f0;
          color: #334155;
          font-weight: 950;
        }

        .column-body {
          display: grid;
          align-content: start;
          gap: 12px;
          padding: 12px;
          min-height: 450px;
        }

        .column-empty {
          padding: 24px 14px;
          border: 1px dashed #cbd5e1;
          border-radius: 16px;
          color: #94a3b8;
          text-align: center;
          font-weight: 800;
        }

        .card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 14px;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
          cursor: grab;
          transition: opacity 0.2s ease, transform 0.2s ease;
        }

        .card:active {
          cursor: grabbing;
        }

        .card.saving {
          opacity: 0.55;
          pointer-events: none;
        }

        .card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .card h2 {
          font-size: 18px;
          letter-spacing: -0.03em;
        }

        .card-top p {
          margin-top: 4px;
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
        }

        .badge {
          padding: 6px 9px;
          border-radius: 999px;
          background: #dbeafe;
          color: #1d4ed8;
          font-size: 10px;
          font-weight: 950;
          white-space: nowrap;
        }

        .badge.viewed {
          background: #fef3c7;
          color: #92400e;
        }

        .badge.finished {
          background: #dcfce7;
          color: #166534;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 7px;
          margin: 14px 0;
        }

        .stats span {
          display: grid;
          gap: 2px;
          padding: 9px 5px;
          border-radius: 13px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          font-size: 10px;
          font-weight: 850;
          text-align: center;
        }

        .stats strong {
          font-size: 15px;
          color: #0f172a;
        }

        .candidate-list {
          display: grid;
          gap: 7px;
        }

        .candidate {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 9px;
          border-radius: 14px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .candidate strong,
        .candidate small {
          display: block;
        }

        .candidate strong {
          font-size: 13px;
        }

        .candidate small {
          color: #64748b;
          margin-top: 2px;
          font-size: 10px;
        }

        .candidate em {
          font-style: normal;
          font-size: 9px;
          font-weight: 950;
          color: #0369a1;
          text-align: right;
        }

        .candidate em.sent_to_hiring,
        .candidate em.approved_by_client {
          color: #166534;
        }

        .candidate em.rejected_by_client {
          color: #991b1b;
        }

        .more {
          color: #64748b;
          font-weight: 900;
          padding: 6px;
        }

        .mobile-status {
          display: none;
          gap: 5px;
          margin-top: 12px;
          color: #64748b;
          font-size: 11px;
          font-weight: 900;
        }

        .actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 7px;
          margin-top: 14px;
        }

        .actions a,
        .actions button {
          min-width: 0;
          padding: 9px 7px;
          font-size: 11px;
        }

        .actions .green {
          grid-column: 1 / -1;
        }

        .empty {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 22px;
          padding: 22px;
          color: #64748b;
          font-weight: 900;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 2000;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(5px);
        }

        .modal {
          width: min(520px, 100%);
          display: grid;
          gap: 16px;
          padding: 22px;
          border-radius: 24px;
          background: #ffffff;
          box-shadow: 0 28px 80px rgba(15, 23, 42, 0.3);
        }

        .modal header,
        .modal footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .modal label {
          display: grid;
          gap: 7px;
          color: #334155;
          font-weight: 900;
        }

        .close {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          padding: 0;
          border-radius: 12px;
          background: #f1f5f9;
          color: #334155;
          font-size: 22px;
        }

        @media (max-width: 720px) {
          .header {
            display: grid;
            padding: 17px;
            border-radius: 20px;
          }

          .header .primary {
            width: 100%;
          }

          .filters {
            grid-template-columns: 1fr;
          }

          .kanban {
            grid-template-columns: repeat(4, minmax(88vw, 88vw));
          }

          .column {
            min-width: 88vw;
            min-height: auto;
          }

          .mobile-status {
            display: grid;
          }

          .card {
            cursor: default;
          }

          .actions {
            grid-template-columns: 1fr;
          }

          .actions .green {
            grid-column: auto;
          }

          .modal footer {
            display: grid;
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
