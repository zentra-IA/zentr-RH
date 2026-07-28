"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type BiData = {
  success: boolean;
  period: string;
  summary: Record<string, number>;
  funnel: Record<string, number>;
  distributions: {
    jobsByStatus: Group[];
    candidatesByStatus: Group[];
    candidatesByOrigin: Group[];
    interviewsByStatus: Group[];
    tasksByStatus: Group[];
    tasksByPriority: Group[];
    tasksByResponsible: Group[];
  };
  jobs: JobRow[];
  users: UserRow[];
  daily: DailyRow[];
  diagnostics: Diagnostic[];
  errors: string[];
  generatedAt: string;
};

type Group = {
  label: string;
  value: number;
};

type JobRow = {
  id: string;
  title: string;
  status: string;
  department?: string | null;
  city?: string | null;
  state?: string | null;
  ageDays: number;
  applications: number;
  interviews: number;
  approved: number;
  hired: number;
  applicationToInterviewRate: number;
  interviewToHiringRate: number;
  responsibleName?: string | null;
  clientName?: string | null;
  openings: number;
  lastMovementAt?: string | null;
};

type UserRow = {
  userId: string;
  name: string;
  role?: string | null;
  tasks: number;
  completedTasks: number;
  overdueTasks: number;
  completionRate: number;
};

type DailyRow = {
  date: string;
  label: string;
  clients: number;
  jobs: number;
  candidates: number;
  interviews: number;
  hirings: number;
  tasks: number;
  messages: number;
};

type Diagnostic = {
  severity:
    | "info"
    | "warning"
    | "critical"
    | "success";
  title: string;
  description: string;
  recommendation: string;
};

const PERIODS = [
  ["today", "Hoje"],
  ["yesterday", "Ontem"],
  ["7d", "7 dias"],
  ["15d", "15 dias"],
  ["30d", "30 dias"],
  ["90d", "90 dias"],
  ["1y", "1 ano"],
];

function formatNumber(value?: number) {
  return new Intl.NumberFormat(
    "pt-BR"
  ).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      dateStyle: "short",
      timeStyle: "short",
    }
  ).format(new Date(value));
}

function severityIcon(
  severity: Diagnostic["severity"]
) {
  if (severity === "critical") return "🔴";
  if (severity === "warning") return "🟠";
  if (severity === "success") return "🟢";

  return "🔵";
}

export default function CommandCenterBiPage() {
  const [period, setPeriod] =
    useState("30d");
  const [data, setData] =
    useState<BiData | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState("");
  const [jobSearch, setJobSearch] =
    useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/command-center/bi/overview?period=${encodeURIComponent(
          period
        )}`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );

      const payload =
        await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Erro ao carregar BI."
        );
      }

      setData(payload);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Erro ao carregar BI."
      );
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  const jobs = useMemo(() => {
    const search =
      jobSearch.toLowerCase().trim();

    if (!search) {
      return data?.jobs || [];
    }

    return (data?.jobs || []).filter(
      (job) =>
        [
          job.title,
          job.clientName,
          job.responsibleName,
          job.department,
          job.city,
          job.state,
          job.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search)
    );
  }, [data?.jobs, jobSearch]);

  const maxDaily = useMemo(() => {
    return Math.max(
      ...(data?.daily || []).map(
        (day) =>
          day.clients +
          day.jobs +
          day.candidates +
          day.interviews +
          day.hirings
      ),
      1
    );
  }, [data?.daily]);

  const summary = data?.summary || {};

  return (
    <main className="bi-page">
      <header className="page-header">
        <div>
          <Link
            href="/crm/dashboard/command-center"
            className="back-link"
          >
            ← Voltar ao Centro de Comando
          </Link>

          <p className="eyebrow">
            Business Intelligence operacional
          </p>

          <h1>BI e Indicadores</h1>

          <p className="subtitle">
            Números reais de clientes,
            vagas, candidatos, entrevistas,
            contratações, tarefas e
            mensagens.
          </p>
        </div>

        <div className="header-actions">
          <select
            value={period}
            onChange={(event) =>
              setPeriod(event.target.value)
            }
          >
            {PERIODS.map(
              ([value, label]) => (
                <option
                  key={value}
                  value={value}
                >
                  {label}
                </option>
              )
            )}
          </select>

          <button
            type="button"
            onClick={load}
            disabled={loading}
          >
            {loading
              ? "Atualizando..."
              : "Atualizar BI"}
          </button>
        </div>
      </header>

      {error && (
        <div className="error-box">
          {error}
        </div>
      )}

      {data?.errors?.length ? (
        <div className="warning-box">
          Algumas fontes não responderam:
          {" "}
          {data.errors.join(" · ")}
        </div>
      ) : null}

      <section className="kpi-grid">
        <Kpi
          icon="🏢"
          label="Clientes totais"
          value={summary.clientsTotal}
          detail={`${formatNumber(
            summary.clientsNew
          )} novos no período`}
        />
        <Kpi
          icon="💼"
          label="Vagas abertas"
          value={summary.jobsOpen}
          detail={`${formatNumber(
            summary.jobsNew
          )} novas · ${formatNumber(
            summary.jobsStagnant
          )} paradas`}
          tone={
            summary.jobsStagnant > 0
              ? "warning"
              : "default"
          }
        />
        <Kpi
          icon="👤"
          label="Candidatos"
          value={summary.candidatesTotal}
          detail={`${formatNumber(
            summary.candidatesNew
          )} novos · ${formatNumber(
            summary.applicationsNew
          )} vínculos`}
        />
        <Kpi
          icon="📅"
          label="Entrevistas"
          value={summary.interviewsNew}
          detail={`${formatNumber(
            summary.interviewsCompleted
          )} concluídas · ${formatNumber(
            summary.interviewsApproved
          )} aprovadas`}
        />
        <Kpi
          icon="✅"
          label="Contratações"
          value={summary.hiringsNew}
          detail={`${formatNumber(
            summary.hiringsCompleted
          )} concluídas`}
          tone="success"
        />
        <Kpi
          icon="📋"
          label="Tarefas"
          value={summary.tasksTotal}
          detail={`${formatNumber(
            summary.tasksCompleted
          )} concluídas · ${formatNumber(
            summary.tasksOverdue
          )} atrasadas`}
          tone={
            summary.tasksOverdue > 0
              ? "danger"
              : "default"
          }
        />
        <Kpi
          icon="💬"
          label="Mensagens enviadas"
          value={summary.messagesSent}
          detail={`${formatNumber(
            summary.messagesReceived
          )} respostas · ${
            summary.responseRate || 0
          }%`}
        />
        <Kpi
          icon="📣"
          label="Campanhas"
          value={summary.campaignsNew}
          detail={`${formatNumber(
            summary.campaignsTotal
          )} cadastradas`}
        />
      </section>

      <section className="top-grid">
        <article className="panel funnel-panel">
          <PanelHeader
            eyebrow="Funil completo"
            title="Recrutamento e contratação"
          />

          <div className="funnel">
            <FunnelStep
              label="Candidatos"
              value={data?.funnel.candidates}
              rate={100}
            />
            <FunnelStep
              label="Vinculados às vagas"
              value={data?.funnel.applications}
              rate={
                data?.funnel
                  .candidateToApplicationRate
              }
            />
            <FunnelStep
              label="Entrevistas"
              value={data?.funnel.interviews}
              rate={
                data?.funnel
                  .applicationToInterviewRate
              }
            />
            <FunnelStep
              label="Aprovados"
              value={data?.funnel.approved}
              rate={
                data?.funnel
                  .interviewToApprovalRate
              }
            />
            <FunnelStep
              label="Contratados"
              value={data?.funnel.hirings}
              rate={
                data?.funnel
                  .approvalToHiringRate
              }
            />
          </div>
        </article>

        <article className="panel diagnostic-panel">
          <PanelHeader
            eyebrow="Diagnóstico inteligente"
            title="O que exige atenção"
          />

          <div className="diagnostics">
            {(data?.diagnostics || []).map(
              (diagnostic, index) => (
                <div
                  className={`diagnostic ${diagnostic.severity}`}
                  key={`${diagnostic.title}-${index}`}
                >
                  <strong>
                    <span>
                      {severityIcon(
                        diagnostic.severity
                      )}
                    </span>
                    {diagnostic.title}
                  </strong>

                  <p>
                    {diagnostic.description}
                  </p>

                  <small>
                    {diagnostic.recommendation}
                  </small>
                </div>
              )
            )}
          </div>
        </article>
      </section>

      <section className="panel evolution-panel">
        <PanelHeader
          eyebrow="Evolução diária"
          title="Produção do período"
        />

        <div className="chart">
          {(data?.daily || []).map(
            (day) => {
              const total =
                day.clients +
                day.jobs +
                day.candidates +
                day.interviews +
                day.hirings;

              const height = Math.max(
                5,
                Math.round(
                  (total / maxDaily) * 100
                )
              );

              return (
                <div
                  className="chart-column"
                  key={day.date}
                  title={`${day.label}: ${total} movimentações`}
                >
                  <div className="bar-area">
                    <div
                      className="bar"
                      style={{
                        height: `${height}%`,
                      }}
                    >
                      <span>{total}</span>
                    </div>
                  </div>

                  <small>{day.label}</small>
                </div>
              );
            }
          )}
        </div>

        <div className="chart-legend">
          <span>
            Clientes:{" "}
            {formatNumber(
              summary.clientsNew
            )}
          </span>
          <span>
            Vagas:{" "}
            {formatNumber(
              summary.jobsNew
            )}
          </span>
          <span>
            Candidatos:{" "}
            {formatNumber(
              summary.candidatesNew
            )}
          </span>
          <span>
            Entrevistas:{" "}
            {formatNumber(
              summary.interviewsNew
            )}
          </span>
          <span>
            Contratações:{" "}
            {formatNumber(
              summary.hiringsNew
            )}
          </span>
        </div>
      </section>

      <section className="distribution-grid">
        <Distribution
          title="Vagas por status"
          items={
            data?.distributions
              .jobsByStatus || []
          }
        />
        <Distribution
          title="Candidatos por status"
          items={
            data?.distributions
              .candidatesByStatus || []
          }
        />
        <Distribution
          title="Entrevistas por status"
          items={
            data?.distributions
              .interviewsByStatus || []
          }
        />
        <Distribution
          title="Tarefas por responsável"
          items={
            data?.distributions
              .tasksByResponsible || []
          }
        />
      </section>

      <section className="panel jobs-panel">
        <div className="panel-header with-search">
          <div>
            <span>Análise por vaga</span>
            <h2>
              Conversão, volume e tempo parado
            </h2>
          </div>

          <input
            value={jobSearch}
            onChange={(event) =>
              setJobSearch(
                event.target.value
              )
            }
            placeholder="Buscar vaga, cliente ou responsável..."
          />
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Vaga</th>
                <th>Status</th>
                <th>Dias aberta</th>
                <th>Candidatos</th>
                <th>Entrevistas</th>
                <th>Aprovados</th>
                <th>Contratados</th>
                <th>Cand. → Entrev.</th>
                <th>Entrev. → Contr.</th>
                <th>Cliente</th>
                <th>Responsável</th>
                <th>Última movimentação</th>
              </tr>
            </thead>

            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <strong>
                      {job.title}
                    </strong>
                    <small>
                      {[
                        job.department,
                        job.city,
                        job.state,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </small>
                  </td>
                  <td>
                    <StatusBadge
                      status={job.status}
                    />
                  </td>
                  <td>{job.ageDays}</td>
                  <td>{job.applications}</td>
                  <td>{job.interviews}</td>
                  <td>{job.approved}</td>
                  <td>{job.hired}</td>
                  <td>
                    {
                      job.applicationToInterviewRate
                    }
                    %
                  </td>
                  <td>
                    {
                      job.interviewToHiringRate
                    }
                    %
                  </td>
                  <td>
                    {job.clientName || "—"}
                  </td>
                  <td>
                    {job.responsibleName ||
                      "—"}
                  </td>
                  <td>
                    {formatDate(
                      job.lastMovementAt
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bottom-grid">
        <article className="panel">
          <PanelHeader
            eyebrow="Equipe"
            title="Produção por responsável"
          />

          <div className="user-list">
            {(data?.users || []).map(
              (user) => (
                <div
                  className="user-row"
                  key={user.userId}
                >
                  <div>
                    <strong>
                      {user.name}
                    </strong>
                    <span>
                      {user.role || "Usuário"}
                    </span>
                  </div>

                  <div>
                    <strong>
                      {user.completedTasks}/
                      {user.tasks}
                    </strong>
                    <span>
                      tarefas concluídas
                    </span>
                  </div>

                  <div>
                    <strong>
                      {user.completionRate}%
                    </strong>
                    <span>
                      taxa de conclusão
                    </span>
                  </div>

                  <div>
                    <strong
                      className={
                        user.overdueTasks > 0
                          ? "danger-text"
                          : ""
                      }
                    >
                      {user.overdueTasks}
                    </strong>
                    <span>atrasadas</span>
                  </div>
                </div>
              )
            )}
          </div>
        </article>

        <article className="panel">
          <PanelHeader
            eyebrow="Origem"
            title="Entrada de candidatos"
          />

          <div className="origin-list">
            {(
              data?.distributions
                .candidatesByOrigin || []
            ).map((item) => (
              <ProgressRow
                key={item.label}
                label={item.label}
                value={item.value}
                max={
                  data?.distributions
                    .candidatesByOrigin?.[0]
                    ?.value || 1
                }
              />
            ))}
          </div>
        </article>
      </section>

      <footer>
        <span>
          Última atualização:{" "}
          {formatDate(data?.generatedAt)}
        </span>

        <Link href="/crm/dashboard/command-center">
          Voltar à operação ao vivo
        </Link>
      </footer>

      <style jsx>{`
        .bi-page {
          min-height: 100vh;
          padding: 28px;
          color: #e2e8f0;
          background:
            radial-gradient(
              circle at 5% 0%,
              rgba(37, 99, 235, 0.2),
              transparent 28%
            ),
            radial-gradient(
              circle at 100% 0%,
              rgba(8, 145, 178, 0.14),
              transparent 22%
            ),
            #07101f;
        }

        .page-header {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 24px;
          max-width: 1800px;
          margin: 0 auto 18px;
        }

        .back-link {
          display: inline-block;
          margin-bottom: 18px;
          color: #7dd3fc;
          font-weight: 850;
          text-decoration: none;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #67e8f9;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        h1 {
          margin: 0;
          color: white;
          font-size: clamp(
            36px,
            5vw,
            58px
          );
          line-height: 1;
        }

        .subtitle {
          max-width: 850px;
          margin: 12px 0 0;
          color: #94a3b8;
          line-height: 1.6;
        }

        .header-actions {
          display: flex;
          gap: 10px;
        }

        .header-actions select,
        .header-actions button {
          min-height: 44px;
          border: 1px solid
            rgba(148, 163, 184, 0.2);
          border-radius: 13px;
          padding: 0 14px;
          color: #e2e8f0;
          background: #111c30;
          font-weight: 850;
        }

        .header-actions button {
          border: 0;
          color: white;
          background: linear-gradient(
            135deg,
            #2563eb,
            #0891b2
          );
          cursor: pointer;
        }

        .error-box,
        .warning-box {
          max-width: 1800px;
          margin: 0 auto 14px;
          padding: 13px 15px;
          border-radius: 14px;
          font-size: 12px;
        }

        .error-box {
          border: 1px solid
            rgba(248, 113, 113, 0.35);
          color: #fecaca;
          background: rgba(
            127,
            29,
            29,
            0.28
          );
        }

        .warning-box {
          border: 1px solid
            rgba(245, 158, 11, 0.35);
          color: #fde68a;
          background: rgba(
            120,
            53,
            15,
            0.22
          );
        }

        .kpi-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 10px;
          max-width: 1800px;
          margin: 0 auto 14px;
        }

        .top-grid,
        .bottom-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 14px;
          max-width: 1800px;
          margin: 0 auto 14px;
        }

        .panel {
          overflow: hidden;
          border: 1px solid
            rgba(148, 163, 184, 0.14);
          border-radius: 20px;
          background: rgba(
            15,
            23,
            42,
            0.78
          );
          box-shadow: 0 20px 55px
            rgba(0, 0, 0, 0.12);
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 16px 18px;
          border-bottom: 1px solid
            rgba(148, 163, 184, 0.1);
        }

        .panel-header > div > span {
          color: #67e8f9;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .panel-header h2 {
          margin: 4px 0 0;
          color: white;
          font-size: 17px;
        }

        .with-search input {
          width: min(420px, 45vw);
          min-height: 40px;
          border: 1px solid
            rgba(148, 163, 184, 0.2);
          border-radius: 11px;
          padding: 0 12px;
          color: #e2e8f0;
          background: #111c30;
          outline: none;
        }

        .funnel {
          display: grid;
          grid-template-columns:
            repeat(5, minmax(0, 1fr));
          align-items: stretch;
          gap: 8px;
          padding: 18px;
        }

        .diagnostics {
          display: grid;
          gap: 10px;
          padding: 14px;
        }

        .diagnostic {
          display: grid;
          gap: 7px;
          padding: 12px;
          border: 1px solid
            rgba(148, 163, 184, 0.11);
          border-left: 3px solid #38bdf8;
          border-radius: 13px;
          background: rgba(
            7,
            16,
            31,
            0.68
          );
        }

        .diagnostic.warning {
          border-left-color: #f59e0b;
        }

        .diagnostic.critical {
          border-left-color: #fb7185;
        }

        .diagnostic.success {
          border-left-color: #22c55e;
        }

        .diagnostic strong {
          display: flex;
          gap: 7px;
          color: white;
          font-size: 11px;
        }

        .diagnostic p {
          margin: 0;
          color: #94a3b8;
          font-size: 10px;
          line-height: 1.5;
        }

        .diagnostic small {
          color: #67e8f9;
          font-size: 9px;
          line-height: 1.45;
        }

        .evolution-panel,
        .jobs-panel {
          max-width: 1800px;
          margin: 0 auto 14px;
        }

        .chart {
          display: flex;
          align-items: end;
          gap: 5px;
          min-height: 260px;
          overflow-x: auto;
          padding: 18px 18px 8px;
        }

        .chart-column {
          display: grid;
          grid-template-rows:
            220px auto;
          justify-items: center;
          gap: 7px;
          min-width: 34px;
          flex: 1;
        }

        .bar-area {
          display: flex;
          align-items: end;
          width: 100%;
          height: 220px;
        }

        .bar {
          position: relative;
          width: 100%;
          min-height: 5px;
          border-radius: 7px 7px 2px 2px;
          background: linear-gradient(
            180deg,
            #22d3ee,
            #2563eb
          );
        }

        .bar span {
          position: absolute;
          top: -17px;
          left: 50%;
          transform: translateX(-50%);
          color: #94a3b8;
          font-size: 8px;
        }

        .chart-column small {
          color: #64748b;
          font-size: 8px;
        }

        .chart-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 12px 18px 18px;
        }

        .chart-legend span {
          border-radius: 999px;
          padding: 5px 8px;
          color: #94a3b8;
          background: rgba(
            30,
            41,
            59,
            0.65
          );
          font-size: 9px;
        }

        .distribution-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 14px;
          max-width: 1800px;
          margin: 0 auto 14px;
        }

        .table-scroll {
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 1450px;
          border-collapse: collapse;
        }

        th,
        td {
          padding: 11px 12px;
          border-bottom: 1px solid
            rgba(148, 163, 184, 0.08);
          text-align: left;
          font-size: 10px;
        }

        th {
          color: #64748b;
          font-size: 8px;
          font-weight: 950;
          text-transform: uppercase;
        }

        td {
          color: #cbd5e1;
        }

        td strong,
        td small {
          display: block;
        }

        td strong {
          color: white;
          font-size: 10px;
        }

        td small {
          margin-top: 3px;
          color: #64748b;
          font-size: 8px;
        }

        .user-list,
        .origin-list {
          display: grid;
          gap: 9px;
          padding: 14px;
        }

        .user-row {
          display: grid;
          grid-template-columns:
            minmax(150px, 1.4fr)
            repeat(3, minmax(90px, 1fr));
          gap: 10px;
          align-items: center;
          padding: 11px;
          border: 1px solid
            rgba(148, 163, 184, 0.1);
          border-radius: 12px;
          background: rgba(
            7,
            16,
            31,
            0.62
          );
        }

        .user-row strong,
        .user-row span {
          display: block;
        }

        .user-row strong {
          color: white;
          font-size: 10px;
        }

        .user-row span {
          margin-top: 3px;
          color: #64748b;
          font-size: 8px;
        }

        .danger-text {
          color: #fca5a5 !important;
        }

        footer {
          display: flex;
          justify-content: space-between;
          max-width: 1800px;
          margin: 14px auto 0;
          color: #64748b;
          font-size: 9px;
        }

        footer a {
          color: #7dd3fc;
          text-decoration: none;
        }

        @media (max-width: 1200px) {
          .kpi-grid,
          .distribution-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .top-grid,
          .bottom-grid {
            grid-template-columns: 1fr;
          }

          .funnel {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .bi-page {
            padding: 20px 14px 80px;
          }

          .page-header {
            align-items: stretch;
            flex-direction: column;
          }

          .header-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .kpi-grid,
          .distribution-grid {
            grid-template-columns: 1fr;
          }

          .funnel {
            grid-template-columns: 1fr;
          }

          .with-search {
            align-items: stretch;
            flex-direction: column;
          }

          .with-search input {
            width: 100%;
          }

          .user-row {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </main>
  );
}

function Kpi({
  icon,
  label,
  value,
  detail,
  tone = "default",
}: {
  icon: string;
  label: string;
  value?: number;
  detail: string;
  tone?:
    | "default"
    | "success"
    | "warning"
    | "danger";
}) {
  return (
    <div className={`kpi ${tone}`}>
      <span className="icon">{icon}</span>
      <strong>
        {formatNumber(value)}
      </strong>
      <span>{label}</span>
      <small>{detail}</small>

      <style jsx>{`
        .kpi {
          display: grid;
          padding: 15px;
          border: 1px solid
            rgba(148, 163, 184, 0.14);
          border-radius: 18px;
          background: rgba(
            15,
            23,
            42,
            0.78
          );
        }

        .kpi.warning {
          border-color: rgba(
            245,
            158,
            11,
            0.3
          );
        }

        .kpi.danger {
          border-color: rgba(
            248,
            113,
            113,
            0.32
          );
        }

        .kpi.success {
          border-color: rgba(
            34,
            197,
            94,
            0.26
          );
        }

        .icon {
          font-size: 20px;
        }

        strong {
          margin-top: 10px;
          color: white;
          font-size: 29px;
          line-height: 1;
        }

        .kpi > span:not(.icon) {
          margin-top: 6px;
          color: #cbd5e1;
          font-size: 11px;
          font-weight: 900;
        }

        small {
          margin-top: 5px;
          color: #64748b;
          font-size: 9px;
        }
      `}</style>
    </div>
  );
}

function PanelHeader({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="panel-title">
      <span>{eyebrow}</span>
      <h2>{title}</h2>

      <style jsx>{`
        .panel-title {
          padding: 16px 18px;
          border-bottom: 1px solid
            rgba(148, 163, 184, 0.1);
        }

        span {
          color: #67e8f9;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        h2 {
          margin: 4px 0 0;
          color: white;
          font-size: 17px;
        }
      `}</style>
    </div>
  );
}

function FunnelStep({
  label,
  value,
  rate,
}: {
  label: string;
  value?: number;
  rate?: number;
}) {
  return (
    <div className="funnel-step">
      <span>{label}</span>
      <strong>
        {formatNumber(value)}
      </strong>
      <small>
        {rate || 0}% de conversão
      </small>

      <style jsx>{`
        .funnel-step {
          display: grid;
          gap: 6px;
          padding: 14px;
          border: 1px solid
            rgba(34, 211, 238, 0.15);
          border-radius: 14px;
          background: linear-gradient(
            135deg,
            rgba(37, 99, 235, 0.09),
            rgba(8, 145, 178, 0.05)
          );
        }

        span {
          color: #94a3b8;
          font-size: 9px;
          font-weight: 850;
        }

        strong {
          color: white;
          font-size: 25px;
        }

        small {
          color: #67e8f9;
          font-size: 8px;
        }
      `}</style>
    </div>
  );
}

function Distribution({
  title,
  items,
}: {
  title: string;
  items: Group[];
}) {
  const max =
    items[0]?.value || 1;

  return (
    <article className="distribution">
      <h3>{title}</h3>

      <div>
        {items.slice(0, 8).map((item) => (
          <ProgressRow
            key={item.label}
            label={item.label}
            value={item.value}
            max={max}
          />
        ))}
      </div>

      <style jsx>{`
        .distribution {
          overflow: hidden;
          border: 1px solid
            rgba(148, 163, 184, 0.14);
          border-radius: 18px;
          background: rgba(
            15,
            23,
            42,
            0.78
          );
        }

        h3 {
          margin: 0;
          padding: 14px;
          border-bottom: 1px solid
            rgba(148, 163, 184, 0.1);
          color: white;
          font-size: 12px;
        }

        .distribution > div {
          display: grid;
          gap: 11px;
          padding: 14px;
        }
      `}</style>
    </article>
  );
}

function ProgressRow({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  return (
    <div className="progress-row">
      <div>
        <strong>{label}</strong>
        <span>{value}</span>
      </div>

      <div className="track">
        <span
          style={{
            width: `${Math.max(
              3,
              (value / Math.max(max, 1)) *
                100
            )}%`,
          }}
        />
      </div>

      <style jsx>{`
        .progress-row {
          display: grid;
          gap: 6px;
        }

        .progress-row > div:first-child {
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }

        strong {
          color: #cbd5e1;
          font-size: 9px;
          text-transform: capitalize;
        }

        .progress-row > div:first-child span {
          color: #67e8f9;
          font-size: 9px;
          font-weight: 900;
        }

        .track {
          overflow: hidden;
          height: 5px;
          border-radius: 999px;
          background: rgba(
            51,
            65,
            85,
            0.7
          );
        }

        .track span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(
            90deg,
            #2563eb,
            #22d3ee
          );
        }
      `}</style>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized =
    String(status || "").toLowerCase();

  const active = [
    "open",
    "published",
    "active",
  ].includes(normalized);

  return (
    <span
      style={{
        display: "inline-flex",
        borderRadius: 999,
        padding: "4px 7px",
        color: active
          ? "#bbf7d0"
          : "#cbd5e1",
        background: active
          ? "rgba(22,101,52,.34)"
          : "rgba(51,65,85,.5)",
        fontSize: 8,
        fontWeight: 900,
        textTransform: "uppercase",
      }}
    >
      {status || "—"}
    </span>
  );
}
