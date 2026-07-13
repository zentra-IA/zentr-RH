"use client";

import { useEffect, useMemo, useState } from "react";

function formatMoney(value: any) {
  const number = Number(value || 0);
  return number.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function percent(value: any) {
  const number = Number(value || 0);
  return `${number.toFixed(1)}%`;
}

function statusName(status: string) {
  const map: Record<string, string> = {
    open: "Aberta",
    draft: "Rascunho",
    paused: "Pausada",
    closed: "Fechada",
    archived: "Arquivada",
    scheduled: "Agendada",
    confirmed: "Confirmada",
    done: "Realizada",
    approved: "Aprovado",
    rejected: "Reprovado",
    no_show: "Não compareceu",
    pending_documents: "Docs pendentes",
    documents_review: "Docs em análise",
    documents_approved: "Docs aprovados",
    hired: "Contrato ativo",
    canceled: "Cancelado",
    finished: "Finalizado",
    terminated: "Rescindido",
    todo: "A fazer",
    doing: "Em andamento",
    waiting: "Aguardando",
    completed: "Concluída",
    waiting_client: "Aguardando cliente",
  };

  return map[status] || status || "-";
}

export default function BiPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");

  async function loadBI() {
    setLoading(true);

    try {
      const res = await fetch(`/api/bi/overview?period=${period}`, {
        cache: "no-store",
        credentials: "include",
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(json.error || "Erro ao carregar BI.");
        return;
      }

      setData(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBI();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const funnel = useMemo(() => data?.funnel || [], [data]);
  const maxFunnel = Math.max(...funnel.map((item: any) => Number(item.value || 0)), 1);

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.kicker}>Zentra RH</p>
          <h1 style={styles.title}>BI Inteligente de RH</h1>
          <p style={styles.subtitle}>
            Acompanhe vagas, entrevistas, apresentação ao cliente, contratações, tarefas e gargalos da operação.
          </p>
        </div>

        <div style={styles.heroActions}>
          <select style={styles.select} value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="365">Últimos 12 meses</option>
          </select>

          <button style={styles.primaryButton} onClick={loadBI}>
            Atualizar
          </button>
        </div>
      </section>

      {loading && <div style={styles.empty}>Carregando indicadores...</div>}

      {!loading && data && (
        <>
          <section style={styles.statsGrid}>
            <Metric icon="👥" label="Candidatos" value={data.metrics?.candidates || 0} />
            <Metric icon="💼" label="Vagas abertas" value={data.metrics?.openJobs || 0} />
            <Metric icon="📅" label="Entrevistas" value={data.metrics?.interviews || 0} />
            <Metric icon="✅" label="Confirmadas" value={data.metrics?.confirmedInterviews || 0} />
            <Metric icon="🎯" label="Aprovados RH" value={data.metrics?.approved || 0} />
            <Metric icon="📤" label="Enviados cliente" value={data.metrics?.sentToClient || 0} />
            <Metric icon="🏁" label="Aprovados cliente" value={data.metrics?.approvedByClient || 0} />
            <Metric icon="📑" label="Contratações" value={data.metrics?.hirings || 0} />
            <Metric icon="📋" label="Tarefas pendentes" value={data.metrics?.pendingTasks || 0} />
            <Metric icon="🔴" label="Tarefas atrasadas" value={data.metrics?.overdueTasks || 0} />
            <Metric icon="⏳" label="Docs pendentes" value={data.metrics?.pendingDocs || 0} />
            <Metric icon="📈" label="Conversão geral" value={percent(data.metrics?.conversionRate || 0)} />
          </section>

          <section style={styles.gridTwo}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Funil RH</h2>
                  <p style={styles.smallText}>Da captação até contratação.</p>
                </div>
                <span style={styles.badge}>Conversão: {percent(data.metrics?.conversionRate || 0)}</span>
              </div>

              <div style={styles.funnel}>
                {funnel.map((item: any) => (
                  <div key={item.label} style={styles.funnelRow}>
                    <div style={styles.funnelTop}>
                      <strong>{item.label}</strong>
                      <span>{item.value}</span>
                    </div>
                    <div style={styles.bar}>
                      <div
                        style={{
                          ...styles.barFill,
                          width: `${Math.max(4, (Number(item.value || 0) / maxFunnel) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Eficiência operacional</h2>
                  <p style={styles.smallText}>Indicadores de qualidade do processo.</p>
                </div>
              </div>

              <div style={styles.miniGrid}>
                <Metric compact icon="📈" label="Comparecimento" value={percent(data.efficiency?.attendanceRate || 0)} />
                <Metric compact icon="🎯" label="Aprovação RH" value={percent(data.efficiency?.approvalRate || 0)} />
                <Metric compact icon="📑" label="Admissão" value={percent(data.efficiency?.hiringRate || 0)} />
                <Metric compact icon="⏱️" label="Tempo médio" value={`${data.efficiency?.avgDaysToHire || 0} dias`} />
              </div>
            </div>
          </section>

          <section style={styles.gridThree}>
            <ListCard
              title="Top vagas"
              subtitle="Vagas com maior movimento."
              rows={(data.topJobs || []).map((item: any) => ({
                left: item.title || "Vaga",
                right: `${item.total || 0}`,
                meta: `${item.approved || 0} aprovados RH • ${item.hired || 0} contratações`,
              }))}
            />

            <ListCard
              title="Apresentação ao cliente"
              subtitle="Candidatos enviados para decisão da empresa."
              rows={[
                { left: "Apresentações geradas", right: data.presentations?.total || 0, meta: "Links criados para clientes" },
                { left: "Candidatos enviados", right: data.presentations?.candidates || 0, meta: "Aguardando decisão ou avaliados" },
                { left: "Aprovados pelo cliente", right: data.presentations?.approved || 0, meta: "Devem seguir para contratação" },
                { left: "Reprovados pelo cliente", right: data.presentations?.rejected || 0, meta: "Não seguem no processo" },
              ]}
            />

            <ListCard
              title="Tarefas"
              subtitle="Pendências internas da equipe."
              rows={[
                { left: "Total de tarefas", right: data.tasks?.total || 0, meta: "Criadas no sistema" },
                { left: "Pendentes", right: data.tasks?.pending || 0, meta: "Ainda precisam de ação" },
                { left: "Urgentes", right: data.tasks?.urgent || 0, meta: "Prioridade máxima" },
                { left: "Atrasadas", right: data.tasks?.overdue || 0, meta: "Prazo vencido" },
              ]}
            />
          </section>

          <section style={styles.gridTwo}>
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>WhatsApp e Campanhas</h2>
              <p style={styles.smallText}>Volume e resposta do CRM.</p>

              <div style={styles.miniGrid}>
                <Metric compact icon="📤" label="Enviadas" value={data.whatsapp?.sent || 0} />
                <Metric compact icon="📥" label="Recebidas" value={data.whatsapp?.received || 0} />
                <Metric compact icon="💬" label="Taxa resposta" value={percent(data.whatsapp?.responseRate || 0)} />
                <Metric compact icon="🚀" label="Fila pendente" value={data.whatsapp?.queuePending || 0} />
                <Metric compact icon="⏸️" label="IA pausada" value={data.whatsapp?.paused || 0} />
                <Metric compact icon="📭" label="Sem resposta" value={data.whatsapp?.noResponse || 0} />
              </div>
            </div>

            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>Alertas inteligentes</h2>

              <div style={styles.alertList}>
                {(data.alerts || []).length === 0 && (
                  <div style={styles.emptySmall}>Nenhum alerta crítico agora.</div>
                )}

                {(data.alerts || []).map((alert: any, index: number) => (
                  <div key={index} style={styles.alertItem}>
                    <span>{alert.icon || "⚠️"}</span>
                    <div>
                      <strong>{alert.title}</strong>
                      <p>{alert.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section style={styles.gridTwo}>
            <ListCard
              title="Documentos"
              subtitle="Situação da documentação admissional."
              rows={(data.documents || []).map((item: any) => ({
                left: statusName(item.status),
                right: `${item.total || 0}`,
                meta: "Checklist admissional",
              }))}
            />

            <ListCard
              title="Contratos"
              subtitle="Gestão de vínculo e status contratual."
              rows={(data.contracts || []).map((item: any) => ({
                left: statusName(item.status),
                right: `${item.total || 0}`,
                meta: item.status === "hired" ? "Ativos" : "Status contratual",
              }))}
            />
          </section>
        </>
      )}
    </main>
  );
}

function Metric({ icon, label, value, compact }: { icon: string; label: string; value: any; compact?: boolean }) {
  return (
    <div style={compact ? styles.metricCompact : styles.metric}>
      <span style={styles.metricIcon}>{icon}</span>
      <div>
        <span style={styles.metricLabel}>{label}</span>
        <strong style={styles.metricValue}>{value}</strong>
      </div>
    </div>
  );
}

function ListCard({ title, subtitle, rows }: { title: string; subtitle: string; rows: any[] }) {
  return (
    <div style={styles.card}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <p style={styles.smallText}>{subtitle}</p>

      <div style={styles.list}>
        {!rows.length && <div style={styles.emptySmall}>Sem dados ainda.</div>}

        {rows.map((row, index) => (
          <div key={index} style={styles.listRow}>
            <div>
              <strong>{row.left}</strong>
              <p>{row.meta}</p>
            </div>
            <span>{row.right}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 20,
    background: "linear-gradient(135deg, #eff6ff, #ffffff, #dbeafe)",
    color: "#0f172a",
  },
  hero: {
    background: "#fff",
    border: "1px solid #bfdbfe",
    borderRadius: 28,
    padding: 24,
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    boxShadow: "0 18px 50px rgba(37,99,235,.08)",
  },
  kicker: {
    margin: 0,
    color: "#2563eb",
    fontWeight: 950,
    letterSpacing: ".22em",
    fontSize: 12,
    textTransform: "uppercase",
  },
  title: {
    margin: "8px 0",
    fontSize: 38,
    fontWeight: 950,
    letterSpacing: "-.04em",
  },
  subtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: 14,
    maxWidth: 760,
    lineHeight: 1.6,
  },
  heroActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  select: {
    border: "1px solid #bfdbfe",
    borderRadius: 16,
    padding: "12px 14px",
    background: "#f8fafc",
    color: "#0f172a",
    fontWeight: 850,
  },
  primaryButton: {
    border: 0,
    borderRadius: 16,
    padding: "13px 18px",
    background: "linear-gradient(135deg, #38bdf8, #2563eb)",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(37,99,235,.20)",
  },
  statsGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 12,
  },
  metric: {
    background: "#fff",
    border: "1px solid #bfdbfe",
    borderRadius: 22,
    padding: 16,
    display: "flex",
    alignItems: "center",
    gap: 12,
    boxShadow: "0 12px 30px rgba(37,99,235,.05)",
  },
  metricCompact: {
    background: "#f8fafc",
    border: "1px solid #dbeafe",
    borderRadius: 20,
    padding: 14,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  metricIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    background: "#dbeafe",
    fontSize: 20,
    flexShrink: 0,
  },
  metricLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 850,
  },
  metricValue: {
    display: "block",
    marginTop: 4,
    fontSize: 24,
    fontWeight: 950,
    color: "#0f172a",
  },
  gridTwo: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 16,
  },
  gridThree: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
  },
  card: {
    background: "#fff",
    border: "1px solid #bfdbfe",
    borderRadius: 28,
    padding: 20,
    boxShadow: "0 18px 50px rgba(37,99,235,.08)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 950,
    color: "#0f172a",
  },
  smallText: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.5,
  },
  badge: {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 999,
    padding: "8px 12px",
    fontWeight: 950,
    fontSize: 12,
  },
  funnel: {
    marginTop: 16,
    display: "grid",
    gap: 14,
  },
  funnelRow: {
    display: "grid",
    gap: 8,
  },
  funnelTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 13,
  },
  bar: {
    height: 12,
    borderRadius: 999,
    background: "#e2e8f0",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(135deg, #38bdf8, #2563eb)",
  },
  miniGrid: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
  },
  list: {
    marginTop: 14,
    display: "grid",
    gap: 10,
  },
  listRow: {
    border: "1px solid #dbeafe",
    background: "#f8fafc",
    borderRadius: 18,
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "center",
  },
  alertList: {
    marginTop: 14,
    display: "grid",
    gap: 10,
  },
  alertItem: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: 18,
    padding: 14,
  },
  empty: {
    marginTop: 16,
    background: "#fff",
    border: "1px solid #bfdbfe",
    borderRadius: 22,
    padding: 24,
    color: "#64748b",
    fontWeight: 850,
  },
  emptySmall: {
    background: "#f8fafc",
    border: "1px dashed #bfdbfe",
    borderRadius: 18,
    padding: 14,
    color: "#64748b",
    fontWeight: 800,
  },
};
