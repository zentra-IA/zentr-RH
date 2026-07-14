"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Candidate = {
  id: string;
  candidate_name: string;
  candidate_phone?: string | null;
  candidate_email?: string | null;
  job_title?: string | null;
  resume_file_url?: string | null;
  interview_at?: string | null;
  rh_notes?: string | null;
  client_notes?: string | null;
  status: string;
};

type Presentation = {
  id: string;
  token: string;
  title?: string | null;
  status: string;
  candidates?: Candidate[];
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    waiting_client: "Aguardando avaliação",
    approved_by_client: "Aprovado",
    rejected_by_client: "Reprovado",
    sent_to_hiring: "Enviado para contratação",
  };

  return labels[status] || status;
}

export default function PublicCandidatePresentationPage() {
  const params = useParams();
  const token = String(params?.token || "");

  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const candidates = useMemo(() => presentation?.candidates || [], [presentation]);

  async function loadPresentation() {
    if (!token) {
      setError("Token do link não encontrado.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await fetch(`/api/public/candidate-presentation?token=${encodeURIComponent(token)}`, {
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Não foi possível carregar os candidatos.");
        return;
      }

      setPresentation(data.presentation);
    } finally {
      setLoading(false);
    }
  }

  async function decide(candidate: Candidate, decision: "approved" | "rejected") {
    const text = decision === "approved" ? "aprovar" : "reprovar";

    if (!confirm(`Deseja ${text} ${candidate.candidate_name}?`)) return;

    try {
      setSavingId(candidate.id);

      const res = await fetch("/api/public/candidate-presentation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          candidateId: candidate.id,
          decision,
          notes: notes[candidate.id] || "",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao salvar decisão.");
        return;
      }

      await loadPresentation();
    } finally {
      setSavingId(null);
    }
  }

  useEffect(() => {
    loadPresentation();
  }, [token]);

  return (
    <main className="client-page">
      <section className="hero">
        <div className="badge">Seleção de candidatos</div>
        <h1>{presentation?.title || "Candidatos indicados"}</h1>
        <p>
          Avalie os candidatos abaixo e informe quem deve seguir para contratação.
        </p>
      </section>

      {loading && <div className="empty">Carregando candidatos...</div>}

      {!loading && error && <div className="error">{error}</div>}

      {!loading && !error && candidates.length === 0 && (
        <div className="empty">Nenhum candidato disponível neste link.</div>
      )}

      <section className="grid">
        {candidates.map((candidate) => {
          const decided = ["approved_by_client", "rejected_by_client", "sent_to_hiring"].includes(
            candidate.status
          );

          return (
            <article key={candidate.id} className="card">
              <div className="card-header">
                <div>
                  <h2>{candidate.candidate_name || "Candidato"}</h2>
                  <p>{candidate.job_title || presentation?.title || "Vaga"}</p>
                </div>

                <span className={`status ${candidate.status}`}>{statusLabel(candidate.status)}</span>
              </div>

              <div className="info">
                {candidate.candidate_phone ? (
                  <a
                    className="contact-link whatsapp"
                    href={`https://wa.me/${candidate.candidate_phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp: {candidate.candidate_phone}
                  </a>
                ) : (
                  <span className="missing-info">WhatsApp não informado</span>
                )}

                {candidate.candidate_email ? (
                  <a
                    className="contact-link email"
                    href={`mailto:${candidate.candidate_email}`}
                  >
                    E-mail: {candidate.candidate_email}
                  </a>
                ) : (
                  <span className="missing-info">E-mail não informado</span>
                )}
                <span>Entrevista RH: {formatDate(candidate.interview_at)}</span>
                {candidate.resume_file_url ? (
                  <a
                    className="resume-link"
                    href={candidate.resume_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver currículo
                  </a>
                ) : (
                  <span className="resume-unavailable">
                    Currículo não disponível
                  </span>
                )}
              </div>

              {candidate.rh_notes && (
                <div className="notes">
                  <strong>Observação do RH</strong>
                  <p>{candidate.rh_notes}</p>
                </div>
              )}

              <textarea
                disabled={decided}
                placeholder="Observação para o RH, se necessário"
                value={notes[candidate.id] ?? candidate.client_notes ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({
                    ...current,
                    [candidate.id]: event.target.value,
                  }))
                }
              />

              <div className="actions">
                <button
                  disabled={decided || savingId === candidate.id}
                  className="approve"
                  onClick={() => decide(candidate, "approved")}
                >
                  Aprovar
                </button>

                <button
                  disabled={decided || savingId === candidate.id}
                  className="reject"
                  onClick={() => decide(candidate, "rejected")}
                >
                  Reprovar
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <style jsx>{`
        .client-page {
          min-height: 100vh;
          padding: 24px;
          background: linear-gradient(135deg, #f8fafc, #eff6ff, #ffffff);
          color: #0f172a;
        }

        .hero {
          max-width: 980px;
          margin: 0 auto 22px;
          padding: 24px;
          background: #ffffff;
          border: 1px solid #dbeafe;
          border-radius: 26px;
          box-shadow: 0 20px 60px rgba(37, 99, 235, 0.08);
        }

        .badge {
          display: inline-flex;
          padding: 7px 12px;
          border-radius: 999px;
          background: #dbeafe;
          color: #1d4ed8;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 12px;
        }

        h1 {
          margin: 0;
          font-size: clamp(26px, 5vw, 42px);
          line-height: 1.05;
          letter-spacing: -0.04em;
        }

        .hero p {
          color: #64748b;
          font-weight: 700;
          margin: 10px 0 0;
        }

        .grid {
          max-width: 980px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }

        .card,
        .empty,
        .error {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          padding: 18px;
          box-shadow: 0 15px 40px rgba(15, 23, 42, 0.06);
        }

        .empty,
        .error {
          max-width: 980px;
          margin: 0 auto;
          font-weight: 900;
        }

        .error {
          border-color: #fecaca;
          color: #b91c1c;
          background: #fef2f2;
        }

        .card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 14px;
        }

        h2 {
          margin: 0;
          font-size: 20px;
          letter-spacing: -0.03em;
        }

        .card-header p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 13px;
          font-weight: 800;
        }

        .status {
          flex: 0 0 auto;
          padding: 7px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 950;
          background: #e0f2fe;
          color: #0369a1;
        }

        .status.approved_by_client,
        .status.sent_to_hiring {
          background: #dcfce7;
          color: #166534;
        }

        .status.rejected_by_client {
          background: #fee2e2;
          color: #991b1b;
        }

        .info {
          display: grid;
          gap: 7px;
          color: #334155;
          font-size: 13px;
          font-weight: 750;
          margin-bottom: 14px;
        }

        .info a {
          font-weight: 950;
        }

        .contact-link {
          display: inline-flex;
          width: fit-content;
          align-items: center;
          gap: 6px;
          padding: 7px 10px;
          border-radius: 10px;
          text-decoration: none;
        }

        .contact-link.whatsapp {
          background: #dcfce7;
          color: #166534;
        }

        .contact-link.email {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .missing-info {
          color: #94a3b8;
          font-weight: 800;
        }

        .resume-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          margin-top: 6px;
          padding: 10px 14px;
          border-radius: 12px;
          background: #2563eb;
          color: #ffffff;
          font-weight: 900;
          text-decoration: none;
          transition: transform 0.15s ease, background 0.15s ease;
        }

        .resume-link:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
        }

        .resume-unavailable {
          display: inline-flex;
          width: fit-content;
          margin-top: 6px;
          padding: 9px 12px;
          border-radius: 12px;
          background: #f1f5f9;
          color: #64748b;
          font-size: 13px;
          font-weight: 800;
        }

        .notes {
          padding: 12px;
          border-radius: 18px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          margin-bottom: 12px;
        }

        .notes strong {
          font-size: 12px;
        }

        .notes p {
          margin: 6px 0 0;
          color: #475569;
          font-size: 13px;
          line-height: 1.5;
        }

        textarea {
          width: 100%;
          min-height: 88px;
          resize: vertical;
          border: 1px solid #cbd5e1;
          border-radius: 18px;
          padding: 12px;
          font: inherit;
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
        }

        textarea:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
        }

        .actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 12px;
        }

        button {
          border: 0;
          border-radius: 16px;
          padding: 12px 14px;
          font-weight: 950;
          cursor: pointer;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .approve {
          background: #16a34a;
          color: #ffffff;
        }

        .reject {
          background: #ef4444;
          color: #ffffff;
        }

        @media (max-width: 640px) {
          .client-page {
            padding: 14px;
          }

          .hero,
          .card {
            border-radius: 20px;
          }

          .actions {
            grid-template-columns: 1fr;
          }

          .card-header {
            display: grid;
          }
        }
      `}</style>
    </main>
  );
}
