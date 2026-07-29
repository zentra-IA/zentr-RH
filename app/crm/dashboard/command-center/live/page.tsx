"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type LiveSession = {
  id: string;
  company_id: string;
  company_name: string;
  user_id: string;
  user_name: string;
  user_email?: string | null;
  user_role?: string | null;
  login_at: string;
  last_activity: string;
  last_activity_seconds?: number | null;
  online: boolean;
  idle_seconds?: number;
  current_module?: string | null;
  current_page?: string | null;
  current_route?: string | null;
  ip?: string | null;
  browser?: string | null;
  os?: string | null;
  device?: string | null;
  screen_width?: number | null;
  screen_height?: number | null;
};

type LiveResponse = {
  success: boolean;
  globalAccess: boolean;
  summary: {
    online: number;
    active: number;
    idle: number;
    sessions: number;
  };
  modules: Record<string, number>;
  sessions: LiveSession[];
  companies: Array<{
    id: string;
    name: string;
  }>;
};

function formatDuration(seconds?: number | null) {
  if (seconds == null) return "—";

  if (seconds < 60) {
    return `${seconds}s`;
  }

  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}min`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(
    (seconds % 3600) / 60
  );

  return `${hours}h ${minutes}min`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function simplifyBrowser(value?: string | null) {
  if (!value) return "Não identificado";

  if (value.includes("Edg/")) return "Microsoft Edge";
  if (value.includes("Chrome/")) return "Google Chrome";
  if (value.includes("Firefox/")) return "Mozilla Firefox";
  if (value.includes("Safari/")) return "Safari";

  return value.slice(0, 80);
}

export default function CommandCenterLivePage() {
  const [data, setData] =
    useState<LiveResponse | null>(null);
  const [companyId, setCompanyId] =
    useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] =
    useState("all");
  const [loading, setLoading] =
    useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      if (companyId) {
        params.set("companyId", companyId);
      }

      const response = await fetch(
        `/api/command-center/live?${params}`,
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
            "Erro ao carregar usuários online."
        );
      }

      setData(payload);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Erro ao carregar usuários online."
      );
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();

    const intervalId = window.setInterval(
      load,
      15_000
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, [load]);

  const filteredSessions = useMemo(() => {
    const normalizedSearch = search
      .toLowerCase()
      .trim();

    return (data?.sessions || []).filter(
      (session) => {
        const isIdle =
          Number(session.idle_seconds || 0) >= 60;

        if (
          status === "online" &&
          !session.online
        ) {
          return false;
        }

        if (
          status === "active" &&
          (!session.online || isIdle)
        ) {
          return false;
        }

        if (
          status === "idle" &&
          (!session.online || !isIdle)
        ) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const searchable = [
          session.user_name,
          session.user_email,
          session.current_page,
          session.current_module,
          session.current_route,
          session.company_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(
          normalizedSearch
        );
      }
    );
  }, [data, search, status]);

  return (
    <main className="live-page">
      <header className="page-header">
        <div>
          <Link
            href="/crm/dashboard/command-center"
            className="back-link"
          >
            ← Voltar ao Centro de Comando
          </Link>

          <p className="eyebrow">
            Presença operacional
          </p>

          <h1>Usuários Online</h1>

          <p className="subtitle">
            Veja quem está conectado, qual tela está
            aberta e há quanto tempo ocorreu a última
            interação.
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
            : "Atualizar agora"}
        </button>
      </header>

      <section className="summary-grid">
        <SummaryCard
          label="Online"
          value={data?.summary.online}
          tone="online"
        />
        <SummaryCard
          label="Ativos agora"
          value={data?.summary.active}
          tone="active"
        />
        <SummaryCard
          label="Ociosos"
          value={data?.summary.idle}
          tone="idle"
        />
        <SummaryCard
          label="Sessões"
          value={data?.summary.sessions}
        />
      </section>

      <section className="filters">
        <label>
          <span>Buscar</span>
          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Usuário, tela ou módulo..."
          />
        </label>

        <label>
          <span>Status</span>
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value)
            }
          >
            <option value="all">
              Todos
            </option>
            <option value="online">
              Online
            </option>
            <option value="active">
              Ativos
            </option>
            <option value="idle">
              Ociosos
            </option>
          </select>
        </label>

        {data?.globalAccess && (
          <label>
            <span>Empresa</span>
            <select
              value={companyId}
              onChange={(event) =>
                setCompanyId(event.target.value)
              }
            >
              <option value="">
                Todas as empresas
              </option>

              {(data.companies || []).map(
                (company) => (
                  <option
                    key={company.id}
                    value={company.id}
                  >
                    {company.name}
                  </option>
                )
              )}
            </select>
          </label>
        )}
      </section>

      {error && (
        <div className="error-box">
          {error}
        </div>
      )}

      <section className="content-grid">
        <div className="session-list">
          {filteredSessions.map(
            (session) => {
              const idleSeconds = Number(
                session.idle_seconds || 0
              );

              const isIdle =
                idleSeconds >= 60;

              return (
                <article
                  className="session-card"
                  key={session.id}
                >
                  <div className="session-top">
                    <div className="identity">
                      <span
                        className={`presence-dot ${
                          session.online
                            ? isIdle
                              ? "idle"
                              : "active"
                            : "offline"
                        }`}
                      />

                      <div>
                        <h2>
                          {session.user_name}
                        </h2>

                        <p>
                          {session.user_email ||
                            session.user_role ||
                            "Usuário"}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`status-badge ${
                        session.online
                          ? isIdle
                            ? "idle"
                            : "active"
                          : "offline"
                      }`}
                    >
                      {session.online
                        ? isIdle
                          ? "Ocioso"
                          : "Ativo"
                        : "Offline"}
                    </div>
                  </div>

                  <div className="current-screen">
                    <span>Tela atual</span>
                    <strong>
                      {session.current_page ||
                        "Não identificada"}
                    </strong>
                    <small>
                      {session.current_route ||
                        "Rota não identificada"}
                    </small>
                  </div>

                  <dl>
                    {data?.globalAccess && (
                      <>
                        <dt>Empresa</dt>
                        <dd>
                          {session.company_name}
                        </dd>
                      </>
                    )}

                    <dt>Módulo</dt>
                    <dd>
                      {session.current_module ||
                        "Dashboard"}
                    </dd>

                    <dt>Última interação</dt>
                    <dd>
                      há{" "}
                      {formatDuration(
                        session.last_activity_seconds
                      )}
                    </dd>

                    <dt>Tempo ocioso</dt>
                    <dd>
                      {formatDuration(
                        idleSeconds
                      )}
                    </dd>

                    <dt>Login</dt>
                    <dd>
                      {formatDate(
                        session.login_at
                      )}
                    </dd>

                    <dt>IP</dt>
                    <dd>
                      {session.ip ||
                        "Não identificado"}
                    </dd>

                    <dt>Navegador</dt>
                    <dd>
                      {simplifyBrowser(
                        session.browser
                      )}
                    </dd>

                    <dt>Tela</dt>
                    <dd>
                      {session.screen_width &&
                      session.screen_height
                        ? `${session.screen_width} × ${session.screen_height}`
                        : "Não identificada"}
                    </dd>
                  </dl>
                </article>
              );
            }
          )}

          {!loading &&
            filteredSessions.length === 0 && (
              <div className="empty-state">
                <span>👥</span>
                <h2>
                  Nenhuma sessão encontrada
                </h2>
                <p>
                  Não existem usuários compatíveis
                  com os filtros selecionados.
                </p>
              </div>
            )}
        </div>

        <aside className="module-panel">
          <div className="panel-title">
            <p>Módulos em uso</p>
            <span>
              {Object.keys(
                data?.modules || {}
              ).length}
            </span>
          </div>

          <div className="module-list">
            {Object.entries(
              data?.modules || {}
            )
              .sort(
                ([, countA], [, countB]) =>
                  countB - countA
              )
              .map(([moduleName, count]) => {
                const total = Math.max(
                  data?.summary.sessions || 1,
                  1
                );

                const percentage = Math.round(
                  (count / total) * 100
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
                        {count} usuário(s)
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
          </div>

          <Link
            href="/crm/dashboard/command-center/navigation"
            className="audit-link"
          >
            Abrir auditoria de navegação →
          </Link>
        </aside>
      </section>

      <style jsx>{`
        .live-page {
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
          min-width: 180px;
        }

        .filters label:first-child {
          flex: 1;
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
          align-items: start;
          gap: 16px;
          max-width: 1600px;
          margin: 0 auto;
        }

        .session-list {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .session-card {
          padding: 18px;
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

        .session-top {
          display: flex;
          align-items: start;
          justify-content: space-between;
          gap: 12px;
        }

        .identity {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .presence-dot {
          width: 11px;
          height: 11px;
          flex: 0 0 auto;
          border-radius: 999px;
          box-shadow:
            0 0 0 5px
            rgba(34, 197, 94, 0.08);
        }

        .presence-dot.active {
          background: #22c55e;
        }

        .presence-dot.idle {
          background: #f59e0b;
        }

        .presence-dot.offline {
          background: #64748b;
        }

        .identity h2 {
          overflow: hidden;
          margin: 0;
          color: white;
          font-size: 17px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .identity p {
          overflow: hidden;
          margin: 4px 0 0;
          color: #64748b;
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .status-badge {
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .status-badge.active {
          color: #bbf7d0;
          background: rgba(
            22,
            101,
            52,
            0.38
          );
        }

        .status-badge.idle {
          color: #fde68a;
          background: rgba(
            146,
            64,
            14,
            0.38
          );
        }

        .status-badge.offline {
          color: #cbd5e1;
          background: rgba(
            51,
            65,
            85,
            0.55
          );
        }

        .current-screen {
          display: grid;
          gap: 4px;
          margin: 16px 0;
          padding: 14px;
          border: 1px solid
            rgba(34, 211, 238, 0.15);
          border-radius: 14px;
          background: rgba(
            8,
            145,
            178,
            0.06
          );
        }

        .current-screen span {
          color: #67e8f9;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .current-screen strong {
          color: white;
          font-size: 15px;
        }

        .current-screen small {
          overflow: hidden;
          color: #64748b;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        dl {
          display: grid;
          grid-template-columns:
            minmax(110px, 0.45fr) 1fr;
          gap: 8px 12px;
          margin: 0;
        }

        dt {
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
        }

        dd {
          overflow-wrap: anywhere;
          margin: 0;
          color: #cbd5e1;
          font-size: 12px;
          font-weight: 750;
        }

        .module-panel {
          position: sticky;
          top: 18px;
          padding: 18px;
          border: 1px solid
            rgba(148, 163, 184, 0.15);
          border-radius: 20px;
          background: rgba(
            15,
            23,
            42,
            0.82
          );
        }

        .panel-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }

        .panel-title p {
          margin: 0;
          color: white;
          font-weight: 900;
        }

        .panel-title span {
          border-radius: 999px;
          padding: 4px 8px;
          color: #67e8f9;
          background: rgba(
            8,
            145,
            178,
            0.18
          );
          font-size: 11px;
          font-weight: 900;
        }

        .module-list {
          display: grid;
          gap: 14px;
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
          color: #64748b;
          font-size: 11px;
        }

        .progress {
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

        .progress div {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(
            90deg,
            #2563eb,
            #22d3ee
          );
        }

        .audit-link {
          display: block;
          margin-top: 22px;
          padding-top: 18px;
          border-top: 1px solid
            rgba(148, 163, 184, 0.12);
          color: #7dd3fc;
          font-size: 12px;
          font-weight: 900;
          text-decoration: none;
        }

        .empty-state {
          grid-column: 1 / -1;
          padding: 70px 24px;
          text-align: center;
          border: 1px solid
            rgba(148, 163, 184, 0.14);
          border-radius: 20px;
          background: rgba(
            15,
            23,
            42,
            0.72
          );
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
          max-width: 1100px
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
          .live-page {
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

          .session-list {
            grid-template-columns: 1fr;
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

        .online strong {
          color: #22c55e;
        }

        .active strong {
          color: #38bdf8;
        }

        .idle strong {
          color: #f59e0b;
        }
      `}</style>
    </div>
  );
}
