"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type AlertItem = {
  id: string;
  company_id: string;
  company_name?: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description?: string;
  status: string;
  entity_type?: string;
  entity_id?: string;
  responsible_name?: string | null;
  recommended_action?: string | null;
  occurrence_count?: number;
  metadata?: Record<string, any>;
  detected_at: string;
  last_seen_at?: string;
};

type AlertResponse = {
  success: boolean;
  globalAccess: boolean;
  alerts: AlertItem[];
  companies: Array<{ id: string; name: string }>;
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
};

const SEVERITY_LABELS = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
};

const STATUS_OPTIONS = [
  { value: "open", label: "Abertos" },
  { value: "acknowledged", label: "Reconhecidos" },
  { value: "resolved", label: "Resolvidos" },
  { value: "dismissed", label: "Descartados" },
  { value: "all", label: "Todos" },
];

function formatDate(value?: string) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function entityLabel(value?: string) {
  const labels: Record<string, string> = {
    Job: "Vaga",
    company_contacts: "Cliente",
    HiringProcess: "Contratação",
    Interview: "Entrevista",
    JobApplication: "Processo seletivo",
    company_user: "Usuário",
  };

  return labels[value || ""] || value || "Processo";
}

export default function CommandCenterAlertsPage() {
  const [status, setStatus] = useState("open");
  const [severity, setSeverity] = useState("all");
  const [companyId, setCompanyId] = useState("");
  const [data, setData] = useState<AlertResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({ status, severity });

      if (companyId) params.set("companyId", companyId);

      const response = await fetch(`/api/command-center/alerts?${params}`, {
        credentials: "include",
        cache: "no-store",
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Erro ao carregar os alertas.");
      }

      setData(payload);
    } catch (loadError: any) {
      setError(loadError?.message || "Erro ao carregar os alertas.");
    } finally {
      setLoading(false);
    }
  }, [companyId, severity, status]);

  useEffect(() => {
    load();
  }, [load]);

  const generateAlerts = async () => {
    try {
      setGenerating(true);
      setError("");

      const response = await fetch("/api/command-center/alerts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: companyId || null,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Erro ao atualizar os alertas.");
      }

      await load();
    } catch (generateError: any) {
      setError(generateError?.message || "Erro ao atualizar os alertas.");
    } finally {
      setGenerating(false);
    }
  };

  const updateStatus = async (id: string, nextStatus: string) => {
    try {
      const response = await fetch("/api/command-center/alerts", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Erro ao atualizar o alerta.");
      }

      await load();
    } catch (updateError: any) {
      setError(updateError?.message || "Erro ao atualizar o alerta.");
    }
  };

  const grouped = useMemo(() => {
    const groups = new Map<string, AlertItem[]>();

    for (const alert of data?.alerts || []) {
      const key = alert.entity_type || "other";
      groups.set(key, [...(groups.get(key) || []), alert]);
    }

    return Array.from(groups.entries());
  }, [data]);

  return (
    <main className="alerts-page">
      <header className="alerts-header">
        <div>
          <Link href="/crm/dashboard/command-center" className="back-link">
            ← Voltar ao Centro de Comando
          </Link>
          <p className="eyebrow">Inteligência operacional</p>
          <h1>Alertas e Gargalos</h1>
          <p className="subtitle">
            Processos sem movimentação, usuários inativos e prioridades que
            exigem uma ação administrativa.
          </p>
        </div>

        <button
          type="button"
          className="generate-button"
          disabled={generating}
          onClick={generateAlerts}
        >
          {generating ? "Analisando operação..." : "Analisar operação agora"}
        </button>
      </header>

      <section className="summary-grid">
        <SummaryCard label="Total" value={data?.summary.total} />
        <SummaryCard label="Críticos" value={data?.summary.critical} tone="critical" />
        <SummaryCard label="Altos" value={data?.summary.high} tone="high" />
        <SummaryCard label="Médios" value={data?.summary.medium} tone="medium" />
        <SummaryCard label="Baixos" value={data?.summary.low} tone="low" />
      </section>

      <section className="filters">
        <label>
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {STATUS_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Criticidade</span>
          <select
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
          >
            <option value="all">Todas</option>
            <option value="critical">Crítico</option>
            <option value="high">Alto</option>
            <option value="medium">Médio</option>
            <option value="low">Baixo</option>
          </select>
        </label>

        {data?.globalAccess && (
          <label>
            <span>Empresa</span>
            <select
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
            >
              <option value="">Todas as empresas</option>
              {(data.companies || []).map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <button type="button" onClick={load} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar lista"}
        </button>
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="groups">
        {grouped.map(([entityType, alerts]) => (
          <article className="group" key={entityType}>
            <div className="group-header">
              <div>
                <span>{entityLabel(entityType)}</span>
                <strong>{alerts.length} ocorrência(s)</strong>
              </div>
            </div>

            <div className="alert-list">
              {alerts.map((alert) => (
                <div className={`alert-card ${alert.severity}`} key={alert.id}>
                  <div className="alert-top">
                    <div className={`severity ${alert.severity}`}>
                      {SEVERITY_LABELS[alert.severity]}
                    </div>
                    <small>{formatDate(alert.detected_at)}</small>
                  </div>

                  <h2>{alert.title}</h2>
                  <p>{alert.description || "Requer análise administrativa."}</p>

                  <dl>
                    {data?.globalAccess && (
                      <>
                        <dt>Empresa</dt>
                        <dd>{alert.company_name || "—"}</dd>
                      </>
                    )}

                    <dt>Processo</dt>
                    <dd>{entityLabel(alert.entity_type)}</dd>

                    <dt>Responsável</dt>
                    <dd>{alert.responsible_name || "Não identificado"}</dd>

                    <dt>Tempo parado</dt>
                    <dd>
                      {alert.metadata?.days_without_activity != null
                        ? `${alert.metadata.days_without_activity} dias`
                        : "Sem informação"}
                    </dd>

                    <dt>Ocorrências</dt>
                    <dd>{alert.occurrence_count || 1}</dd>
                  </dl>

                  {alert.recommended_action && (
                    <div className="recommendation">
                      <strong>Próxima ação recomendada</strong>
                      <span>{alert.recommended_action}</span>
                    </div>
                  )}

                  <div className="alert-actions">
                    {alert.status === "open" && (
                      <button
                        type="button"
                        onClick={() => updateStatus(alert.id, "acknowledged")}
                      >
                        Reconhecer
                      </button>
                    )}

                    {["open", "acknowledged"].includes(alert.status) && (
                      <button
                        type="button"
                        className="primary"
                        onClick={() => updateStatus(alert.id, "resolved")}
                      >
                        Marcar como resolvido
                      </button>
                    )}

                    {alert.status !== "dismissed" && (
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => updateStatus(alert.id, "dismissed")}
                      >
                        Descartar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}

        {!loading && grouped.length === 0 && (
          <div className="empty-state">
            <span>🟢</span>
            <h2>Nenhum alerta encontrado</h2>
            <p>
              A operação não possui ocorrências para os filtros selecionados.
            </p>
          </div>
        )}
      </section>

      <style jsx>{`
        .alerts-page {
          min-height: 100vh;
          padding: 32px;
          color: #e2e8f0;
          background:
            radial-gradient(circle at 5% 0%, rgba(37, 99, 235, 0.2), transparent 30%),
            radial-gradient(circle at 100% 0%, rgba(244, 63, 94, 0.12), transparent 26%),
            #07101f;
        }
        .alerts-header {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 24px;
          max-width: 1600px;
          margin: 0 auto 22px;
        }
        .back-link {
          display: inline-block;
          margin-bottom: 20px;
          color: #93c5fd;
          text-decoration: none;
          font-weight: 800;
        }
        .eyebrow {
          margin: 0 0 8px;
          color: #67e8f9;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }
        h1 {
          margin: 0;
          color: #fff;
          font-size: clamp(30px, 4vw, 50px);
          line-height: 1;
        }
        .subtitle {
          max-width: 760px;
          margin: 12px 0 0;
          color: #94a3b8;
          line-height: 1.6;
        }
        .generate-button {
          min-height: 48px;
          border: 1px solid rgba(34, 211, 238, 0.4);
          border-radius: 15px;
          padding: 0 18px;
          color: white;
          background: linear-gradient(135deg, #2563eb, #0891b2);
          font-weight: 900;
          cursor: pointer;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
          max-width: 1600px;
          margin: 0 auto 18px;
        }
        .filters {
          display: flex;
          align-items: end;
          flex-wrap: wrap;
          gap: 12px;
          max-width: 1600px;
          margin: 0 auto 18px;
          padding: 16px;
          border: 1px solid rgba(148, 163, 184, 0.15);
          border-radius: 20px;
          background: rgba(15, 23, 42, 0.72);
        }
        .filters label {
          display: grid;
          gap: 6px;
        }
        .filters span {
          color: #94a3b8;
          font-size: 12px;
          font-weight: 800;
        }
        .filters select,
        .filters button {
          min-height: 42px;
          border: 1px solid rgba(148, 163, 184, 0.25);
          border-radius: 12px;
          padding: 0 14px;
          color: #e2e8f0;
          background: #111c30;
          font-weight: 800;
        }
        .filters button {
          cursor: pointer;
        }
        .error-box {
          max-width: 1600px;
          margin: 0 auto 18px;
          padding: 14px 16px;
          border: 1px solid rgba(248, 113, 113, 0.4);
          border-radius: 14px;
          color: #fecaca;
          background: rgba(127, 29, 29, 0.3);
        }
        .groups {
          display: grid;
          gap: 18px;
          max-width: 1600px;
          margin: 0 auto;
        }
        .group {
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.15);
          border-radius: 24px;
          background: rgba(15, 23, 42, 0.72);
        }
        .group-header {
          padding: 18px 20px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        }
        .group-header div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .group-header span {
          color: #fff;
          font-size: 20px;
          font-weight: 900;
        }
        .group-header strong {
          color: #94a3b8;
          font-size: 13px;
        }
        .alert-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          padding: 16px;
        }
        .alert-card {
          padding: 18px;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-left-width: 4px;
          border-radius: 18px;
          background: rgba(7, 16, 31, 0.82);
        }
        .alert-card.critical { border-left-color: #fb7185; }
        .alert-card.high { border-left-color: #fb923c; }
        .alert-card.medium { border-left-color: #facc15; }
        .alert-card.low { border-left-color: #38bdf8; }
        .alert-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .severity {
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .severity.critical { color: #fecdd3; background: rgba(190, 18, 60, 0.34); }
        .severity.high { color: #fed7aa; background: rgba(194, 65, 12, 0.34); }
        .severity.medium { color: #fef08a; background: rgba(161, 98, 7, 0.34); }
        .severity.low { color: #bae6fd; background: rgba(3, 105, 161, 0.34); }
        .alert-top small {
          color: #64748b;
        }
        .alert-card h2 {
          margin: 14px 0 6px;
          color: #fff;
          font-size: 19px;
        }
        .alert-card > p {
          min-height: 44px;
          margin: 0;
          color: #94a3b8;
          line-height: 1.55;
        }
        dl {
          display: grid;
          grid-template-columns: minmax(100px, 0.42fr) 1fr;
          gap: 8px 12px;
          margin: 16px 0;
          padding: 14px;
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.82);
        }
        dt {
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
        }
        dd {
          margin: 0;
          color: #cbd5e1;
          font-size: 13px;
          font-weight: 800;
        }
        .recommendation {
          display: grid;
          gap: 5px;
          padding: 13px;
          border: 1px solid rgba(34, 211, 238, 0.17);
          border-radius: 14px;
          color: #bae6fd;
          background: rgba(8, 145, 178, 0.08);
        }
        .recommendation strong {
          font-size: 12px;
        }
        .recommendation span {
          color: #cbd5e1;
          font-size: 13px;
          line-height: 1.5;
        }
        .alert-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 16px;
        }
        .alert-actions button {
          min-height: 38px;
          border: 1px solid rgba(148, 163, 184, 0.24);
          border-radius: 11px;
          padding: 0 12px;
          color: #cbd5e1;
          background: rgba(30, 41, 59, 0.8);
          font-weight: 850;
          cursor: pointer;
        }
        .alert-actions .primary {
          border-color: rgba(34, 211, 238, 0.32);
          color: white;
          background: linear-gradient(135deg, #2563eb, #0891b2);
        }
        .alert-actions .ghost {
          color: #94a3b8;
          background: transparent;
        }
        .empty-state {
          padding: 70px 24px;
          text-align: center;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 24px;
          background: rgba(15, 23, 42, 0.72);
        }
        .empty-state span {
          font-size: 40px;
        }
        .empty-state h2 {
          margin: 12px 0 5px;
          color: #fff;
        }
        .empty-state p {
          margin: 0;
          color: #94a3b8;
        }
        @media (max-width: 1000px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .alert-list {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 700px) {
          .alerts-page {
            padding: 20px 14px;
          }
          .alerts-header {
            align-items: stretch;
            flex-direction: column;
          }
          .summary-grid {
            grid-template-columns: 1fr 1fr;
          }
          .filters {
            align-items: stretch;
            flex-direction: column;
          }
          .filters label,
          .filters select,
          .filters button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value?: number;
  tone?: string;
}) {
  return (
    <div className={`summary-card ${tone}`}>
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>

      <style jsx>{`
        .summary-card {
          padding: 17px;
          border: 1px solid rgba(148, 163, 184, 0.15);
          border-radius: 18px;
          background: rgba(15, 23, 42, 0.78);
        }
        span {
          color: #94a3b8;
          font-size: 12px;
          font-weight: 850;
        }
        strong {
          display: block;
          margin-top: 5px;
          color: #fff;
          font-size: 28px;
        }
        .critical strong { color: #fb7185; }
        .high strong { color: #fb923c; }
        .medium strong { color: #facc15; }
        .low strong { color: #38bdf8; }
      `}</style>
    </div>
  );
}
