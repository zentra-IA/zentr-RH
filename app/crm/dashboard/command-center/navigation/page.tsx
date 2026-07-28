"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type NavigationActivity = {
  id: string;
  company_id: string;
  company_name: string;
  user_id: string;
  user_name: string;
  user_email?: string | null;
  user_role?: string | null;
  action: string;
  entity?: string | null;
  metadata?: Record<string, unknown>;
  module: string;
  page: string;
  route?: string | null;
  duration: number;
  idle_seconds: number;
  created_at: string;
};

type NavigationResponse = {
  success: boolean;
  globalAccess: boolean;
  summary: {
    activities: number;
    pagesVisited: number;
    exits: number;
    totalSeconds: number;
  };
  activities: NavigationActivity[];
  filters: {
    modules: string[];
    actions: string[];
    users: Array<{
      user_id: string;
      name: string;
      email?: string;
    }>;
    companies: Array<{
      id: string;
      name: string;
    }>;
  };
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatDuration(seconds: number) {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}min`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(
    (seconds % 3600) / 60
  );

  return `${hours}h ${minutes}min`;
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    page_enter: "Entrou na página",
    page_leave: "Saiu da página",
    page_activity: "Atividade na página",
  };

  return labels[action] || action;
}

export default function NavigationAuditPage() {
  const [period, setPeriod] =
    useState("24h");
  const [moduleFilter, setModuleFilter] =
    useState("all");
  const [actionFilter, setActionFilter] =
    useState("all");
  const [userId, setUserId] =
    useState("");
  const [companyId, setCompanyId] =
    useState("");
  const [search, setSearch] =
    useState("");
  const [data, setData] =
    useState<NavigationResponse | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        period,
        module: moduleFilter,
        action: actionFilter,
        limit: "500",
      });

      if (userId) {
        params.set("userId", userId);
      }

      if (companyId) {
        params.set("companyId", companyId);
      }

      if (search.trim()) {
        params.set(
          "search",
          search.trim()
        );
      }

      const response = await fetch(
        `/api/command-center/navigation?${params}`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );

      const payload = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Erro ao carregar a auditoria."
        );
      }

      setData(payload);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Erro ao carregar a auditoria."
      );
    } finally {
      setLoading(false);
    }
  }, [
    actionFilter,
    companyId,
    moduleFilter,
    period,
    search,
    userId,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const moduleTime = useMemo(() => {
    return (data?.activities || []).reduce(
      (
        accumulator: Record<string, number>,
        activity
      ) => {
        if (activity.action !== "page_leave") {
          return accumulator;
        }

        accumulator[activity.module] =
          (accumulator[activity.module] || 0) +
          Number(activity.duration || 0);

        return accumulator;
      },
      {}
    );
  }, [data]);

  return (
    <main className="audit-page">
      <header className="page-header">
        <div>
          <Link
            href="/crm/dashboard/command-center/live"
            className="back-link"
          >
            ← Voltar aos usuários online
          </Link>

          <p className="eyebrow">
            Auditoria 360°
          </p>

          <h1>Histórico de Navegação</h1>

          <p className="subtitle">
            Acompanhe as telas acessadas, duração,
            módulo, usuário, empresa e sequência de
            navegação.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="refresh-button"
        >
          {loading
            ? "Atualizando..."
            : "Atualizar"}
        </button>
      </header>

      <section className="summary-grid">
        <SummaryCard
          label="Atividades"
          value={data?.summary.activities}
        />
        <SummaryCard
          label="Entradas"
          value={data?.summary.pagesVisited}
        />
        <SummaryCard
          label="Saídas"
          value={data?.summary.exits}
        />
        <SummaryCard
          label="Tempo registrado"
          value={formatDuration(
            data?.summary.totalSeconds || 0
          )}
        />
      </section>

      <section className="filters">
        <label>
          <span>Período</span>
          <select
            value={period}
            onChange={(event) =>
              setPeriod(event.target.value)
            }
          >
            <option value="24h">
              Últimas 24 horas
            </option>
            <option value="7d">
              7 dias
            </option>
            <option value="15d">
              15 dias
            </option>
            <option value="30d">
              30 dias
            </option>
            <option value="90d">
              90 dias
            </option>
          </select>
        </label>

        <label>
          <span>Módulo</span>
          <select
            value={moduleFilter}
            onChange={(event) =>
              setModuleFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              Todos
            </option>

            {(data?.filters.modules || []).map(
              (moduleName) => (
                <option
                  key={moduleName}
                  value={moduleName}
                >
                  {moduleName}
                </option>
              )
            )}
          </select>
        </label>

        <label>
          <span>Ação</span>
          <select
            value={actionFilter}
            onChange={(event) =>
              setActionFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              Todas
            </option>

            {(data?.filters.actions || []).map(
              (action) => (
                <option
                  key={action}
                  value={action}
                >
                  {actionLabel(action)}
                </option>
              )
            )}
          </select>
        </label>

        <label>
          <span>Usuário</span>
          <select
            value={userId}
            onChange={(event) =>
              setUserId(event.target.value)
            }
          >
            <option value="">
              Todos
            </option>

            {(data?.filters.users || []).map(
              (user) => (
                <option
                  key={user.user_id}
                  value={user.user_id}
                >
                  {user.name}
                </option>
              )
            )}
          </select>
        </label>

        {data?.globalAccess && (
          <label>
            <span>Empresa</span>
            <select
              value={companyId}
              onChange={(event) =>
                setCompanyId(
                  event.target.value
                )
              }
            >
              <option value="">
                Todas
              </option>

              {(
                data?.filters.companies || []
              ).map((company) => (
                <option
                  key={company.id}
                  value={company.id}
                >
                  {company.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="search-field">
          <span>Buscar</span>
          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Rota ou ação..."
          />
        </label>
      </section>

      {error && (
        <div className="error-box">
          {error}
        </div>
      )}

      <section className="content-grid">
        <div className="timeline-panel">
          <div className="panel-header">
            <div>
              <p>Sequência operacional</p>
              <span>
                {data?.activities.length || 0} registro(s)
              </span>
            </div>
          </div>

          <div className="timeline">
            {(data?.activities || []).map(
              (activity) => (
                <article
                  className="timeline-item"
                  key={activity.id}
                >
                  <div
                    className={`timeline-icon ${activity.action}`}
                  >
                    {activity.action ===
                    "page_enter"
                      ? "→"
                      : activity.action ===
                        "page_leave"
                      ? "←"
                      : "•"}
                  </div>

                  <div className="timeline-content">
                    <div className="timeline-top">
                      <div>
                        <strong>
                          {activity.user_name}
                        </strong>

                        <span>
                          {actionLabel(
                            activity.action
                          )}
                        </span>
                      </div>

                      <time>
                        {formatDate(
                          activity.created_at
                        )}
                      </time>
                    </div>

                    <h2>{activity.page}</h2>

                    <p>
                      {activity.route ||
                        "Rota não identificada"}
                    </p>

                    <div className="chips">
                      <span>
                        {activity.module}
                      </span>

                      {activity.duration > 0 && (
                        <span>
                          {formatDuration(
                            activity.duration
                          )}{" "}
                          na tela
                        </span>
                      )}

                      {activity.idle_seconds >
                        0 && (
                        <span>
                          {formatDuration(
                            activity.idle_seconds
                          )}{" "}
                          ocioso
                        </span>
                      )}

                      {data?.globalAccess && (
                        <span>
                          {activity.company_name}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              )
            )}

            {!loading &&
              (data?.activities.length || 0) ===
                0 && (
                <div className="empty-state">
                  <span>🧭</span>
                  <h2>
                    Nenhuma navegação encontrada
                  </h2>
                  <p>
                    Use o sistema e volte para
                    acompanhar as telas acessadas.
                  </p>
                </div>
              )}
          </div>
        </div>

        <aside className="module-panel">
          <div className="panel-header">
            <div>
              <p>Tempo por módulo</p>
              <span>
                Baseado nas saídas de página
              </span>
            </div>
          </div>

          <div className="module-list">
            {Object.entries(moduleTime)
              .sort(
                ([, valueA], [, valueB]) =>
                  valueB - valueA
              )
              .map(([moduleName, seconds]) => {
                const maxSeconds = Math.max(
                  ...Object.values(moduleTime),
                  1
                );

                const percentage = Math.max(
                  3,
                  Math.round(
                    (seconds / maxSeconds) * 100
                  )
                );

                return (
                  <div
                    className="module-item"
                    key={moduleName}
                  >
                    <div>
                      <strong>
                        {moduleName}
                      </strong>

                      <span>
                        {formatDuration(seconds)}
                      </span>
                    </div>

                    <div className="progress">
                      <div
                        style={{
                          width: `${percentage}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}

            {Object.keys(moduleTime).length ===
              0 && (
              <p className="no-module-data">
                Ainda não há duração suficiente
                registrada.
              </p>
            )}
          </div>
        </aside>
      </section>

      <style jsx>{`
        .audit-page {
          min-height: 100vh;
          padding: 32px;
          color: #e2e8f0;
          background:
            radial-gradient(
              circle at 0% 0%,
              rgba(37, 99, 235, 0.18),
              transparent 30%
            ),
            #07101f;
        }

        .page-header {
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
          color: #7dd3fc;
          font-weight: 850;
          text-decoration: none;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #67e8f9;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        h1 {
          margin: 0;
          color: white;
          font-size: clamp(
            34px,
            5vw,
            56px
          );
          line-height: 1;
        }

        .subtitle {
          max-width: 780px;
          margin: 12px 0 0;
          color: #94a3b8;
          line-height: 1.6;
        }

        .refresh-button {
          min-height: 46px;
          border: 0;
          border-radius: 14px;
          padding: 0 18px;
          color: white;
          background: linear-gradient(
            135deg,
            #2563eb,
            #0891b2
          );
          font-weight: 900;
          cursor: pointer;
        }

        .summary-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 12px;
          max-width: 1600px;
          margin: 0 auto 16px;
        }

        .filters {
          display: flex;
          align-items: end;
          flex-wrap: wrap;
          gap: 12px;
          max-width: 1600px;
          margin: 0 auto 18px;
          padding: 16px;
          border: 1px solid
            rgba(148, 163, 184, 0.15);
          border-radius: 20px;
          background: rgba(
            15,
            23,
            42,
            0.76
          );
        }

        .filters label {
          display: grid;
          gap: 6px;
          min-width: 150px;
        }

        .filters .search-field {
          flex: 1;
          min-width: 220px;
        }

        .filters span {
          color: #94a3b8;
          font-size: 12px;
          font-weight: 850;
        }

        .filters input,
        .filters select {
          width: 100%;
          min-height: 42px;
          border: 1px solid
            rgba(148, 163, 184, 0.25);
          border-radius: 12px;
          padding: 0 13px;
          color: #e2e8f0;
          background: #111c30;
          outline: none;
        }

        .error-box {
          max-width: 1600px;
          margin: 0 auto 18px;
          padding: 14px 16px;
          border: 1px solid
            rgba(248, 113, 113, 0.4);
          border-radius: 14px;
          color: #fecaca;
          background: rgba(
            127,
            29,
            29,
            0.3
          );
        }

        .content-grid {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr) 340px;
          gap: 16px;
          max-width: 1600px;
          margin: 0 auto;
        }

        .timeline-panel,
        .module-panel {
          overflow: hidden;
          border: 1px solid
            rgba(148, 163, 184, 0.15);
          border-radius: 20px;
          background: rgba(
            15,
            23,
            42,
            0.78
          );
        }

        .module-panel {
          position: sticky;
          top: 18px;
          height: fit-content;
          padding-bottom: 18px;
        }

        .panel-header {
          padding: 18px;
          border-bottom: 1px solid
            rgba(148, 163, 184, 0.12);
        }

        .panel-header p {
          margin: 0;
          color: white;
          font-weight: 900;
        }

        .panel-header span {
          display: block;
          margin-top: 4px;
          color: #64748b;
          font-size: 11px;
        }

        .timeline {
          display: grid;
        }

        .timeline-item {
          display: grid;
          grid-template-columns:
            38px minmax(0, 1fr);
          gap: 12px;
          padding: 18px;
          border-bottom: 1px solid
            rgba(148, 163, 184, 0.1);
        }

        .timeline-item:last-child {
          border-bottom: 0;
        }

        .timeline-icon {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          border-radius: 12px;
          color: white;
          background: rgba(
            51,
            65,
            85,
            0.7
          );
          font-weight: 950;
        }

        .timeline-icon.page_enter {
          color: #bbf7d0;
          background: rgba(
            22,
            101,
            52,
            0.4
          );
        }

        .timeline-icon.page_leave {
          color: #bae6fd;
          background: rgba(
            3,
            105,
            161,
            0.4
          );
        }

        .timeline-top {
          display: flex;
          align-items: start;
          justify-content: space-between;
          gap: 16px;
        }

        .timeline-top > div {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .timeline-top strong {
          color: white;
          font-size: 13px;
        }

        .timeline-top span {
          color: #94a3b8;
          font-size: 12px;
        }

        time {
          flex: 0 0 auto;
          color: #64748b;
          font-size: 11px;
        }

        .timeline-content h2 {
          margin: 10px 0 3px;
          color: #e2e8f0;
          font-size: 16px;
        }

        .timeline-content > p {
          overflow: hidden;
          margin: 0;
          color: #64748b;
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 12px;
        }

        .chips span {
          border: 1px solid
            rgba(148, 163, 184, 0.15);
          border-radius: 999px;
          padding: 5px 8px;
          color: #94a3b8;
          background: rgba(
            30,
            41,
            59,
            0.65
          );
          font-size: 10px;
          font-weight: 800;
        }

        .module-list {
          display: grid;
          gap: 16px;
          padding: 18px;
        }

        .module-item {
          display: grid;
          gap: 8px;
        }

        .module-item > div:first-child {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .module-item strong {
          color: #cbd5e1;
          font-size: 12px;
          text-transform: capitalize;
        }

        .module-item span {
          color: #67e8f9;
          font-size: 11px;
          font-weight: 850;
        }

        .progress {
          overflow: hidden;
          height: 6px;
          border-radius: 999px;
          background: rgba(
            51,
            65,
            85,
            0.72
          );
        }

        .progress div {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(
            90deg,
            #2563eb,
            #22d3ee
          );
        }

        .no-module-data {
          margin: 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.6;
        }

        .empty-state {
          padding: 70px 24px;
          text-align: center;
        }

        .empty-state span {
          font-size: 38px;
        }

        .empty-state h2 {
          margin: 12px 0 5px;
          color: white;
        }

        .empty-state p {
          margin: 0;
          color: #94a3b8;
        }

        @media (
          max-width: 1050px
        ) {
          .content-grid {
            grid-template-columns: 1fr;
          }

          .module-panel {
            position: static;
          }
        }

        @media (
          max-width: 800px
        ) {
          .audit-page {
            padding: 22px 14px;
          }

          .page-header {
            align-items: stretch;
            flex-direction: column;
          }

          .summary-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (
          max-width: 560px
        ) {
          .filters {
            align-items: stretch;
            flex-direction: column;
          }

          .filters label {
            width: 100%;
          }

          .timeline-top {
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value?: number | string;
}) {
  return (
    <div className="summary-card">
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>

      <style jsx>{`
        .summary-card {
          padding: 17px;
          border: 1px solid
            rgba(148, 163, 184, 0.15);
          border-radius: 18px;
          background: rgba(
            15,
            23,
            42,
            0.78
          );
        }

        span {
          color: #94a3b8;
          font-size: 12px;
          font-weight: 850;
        }

        strong {
          display: block;
          margin-top: 5px;
          color: white;
          font-size: 28px;
        }
      `}</style>
    </div>
  );
}
