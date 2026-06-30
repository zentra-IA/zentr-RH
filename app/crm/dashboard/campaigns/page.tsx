"use client";

import { useEffect, useMemo, useState } from "react";

const SESSIONS = [1, 2, 3, 4, 5];
const MAX_PER_SESSION_DAY = 80;

const CAMPAIGN_TYPES = [
  {
    value: "NAO_RESPONDEU",
    label: "Não respondeu",
    icon: "📭",
    desc: "Candidatos que receberam mensagem, mas ainda não responderam.",
    color: "#2563eb",
  },
  {
    value: "AGENDOU_NAO_COMPARECEU",
    label: "Agendou e não participou",
    icon: "📅",
    desc: "Candidatos que marcaram entrevista e não compareceram.",
    color: "#f97316",
  },
  {
    value: "NAO_APROVADO",
    label: "Não aprovado",
    icon: "📝",
    desc: "Candidatos não aprovados que podem ser reaproveitados futuramente.",
    color: "#dc2626",
  },
  {
    value: "BANCO_TALENTOS",
    label: "Banco de talentos",
    icon: "⭐",
    desc: "Candidatos bons para futuras vagas ou novas oportunidades.",
    color: "#16a34a",
  },
  {
    value: "REAGENDAR_ENTREVISTA",
    label: "Reagendar entrevista",
    icon: "🔄",
    desc: "Candidatos com potencial que precisam remarcar um horário.",
    color: "#7c3aed",
  },
  {
    value: "CONVOCACAO_ENTREVISTA",
    label: "Convocação para entrevista",
    icon: "📲",
    desc: "Candidatos que responderam ou demonstraram interesse.",
    color: "#0891b2",
  },
  {
    value: "FOLLOW_UP_POS_ENTREVISTA",
    label: "Follow-up pós-entrevista",
    icon: "✅",
    desc: "Candidatos entrevistados que precisam receber retorno.",
    color: "#0f766e",
  },
  {
    value: "CONTRATACAO_URGENTE",
    label: "Contratação urgente",
    icon: "🚀",
    desc: "Campanha rápida para candidatos com perfil ativo no funil.",
    color: "#1d4ed8",
  },
];

const DAYS = [0, 1, 2, 3, 4, 5, 7, 10, 15, 30];

function getLastDate(lead: any) {
  return lead.last_message_at || lead.updated_at || lead.created_at;
}

function daysStopped(lead: any) {
  const date = getLastDate(lead);
  if (!date) return 0;

  const diff = Date.now() - new Date(date).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function formatPhone(phone?: string | null) {
  if (!phone) return "-";
  const digits = String(phone).replace(/\D/g, "");
  return digits.startsWith("55") ? `+${digits}` : phone;
}

async function getAvailableSessions(selected: number[]) {
  const online: number[] = [];

  for (const id of selected) {
    try {
      const res = await fetch(`/api/whatsapp/qr?sessionId=${id}`, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (data?.status === "online" || data?.me || data?.connected) {
        online.push(id);
      }
    } catch {}
  }

  return online;
}

export default function CampaignsPage() {
  const [campaignType, setCampaignType] = useState("NAO_RESPONDEU");
  const [targetDays, setTargetDays] = useState(1);
  const [selectedWpp, setSelectedWpp] = useState<number[]>([1, 2, 3, 4, 5]);
  const [previewLeads, setPreviewLeads] = useState<any[]>([]);
  const [sessionStats, setSessionStats] = useState<Record<number, any>>({});
  const [queueStats, setQueueStats] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const currentType =
    CAMPAIGN_TYPES.find((item) => item.value === campaignType) ||
    CAMPAIGN_TYPES[0];

  const totalRemaining = useMemo(() => {
    return Object.values(sessionStats).reduce(
      (sum: number, item: any) => sum + Number(item?.remaining || 0),
      0
    );
  }, [sessionStats]);

  function toggleWpp(id: number) {
    setSelectedWpp((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function loadSessionStats() {
    const stats: Record<number, any> = {};

    try {
      const res = await fetch("/api/crm/queue", {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.stats) {
        setQueueStats(data);

        for (const session of SESSIONS) {
          stats[session] = {
            online: Boolean(data.stats[session]?.online),
            used: data.stats[session]?.used || 0,
            remaining: data.stats[session]?.remaining ?? MAX_PER_SESSION_DAY,
            limit: data.stats[session]?.limit || MAX_PER_SESSION_DAY,
          };
        }

        setSessionStats(stats);
        return;
      }
    } catch {}

    for (const session of SESSIONS) {
      let online = false;

      try {
        const res = await fetch(`/api/whatsapp/qr?sessionId=${session}`, {
          cache: "no-store",
          credentials: "include",
        });

        const data = await res.json().catch(() => ({}));
        online =
          data?.status === "online" ||
          Boolean(data?.me) ||
          Boolean(data?.connected);
      } catch {}

      stats[session] = {
        online,
        used: 0,
        remaining: MAX_PER_SESSION_DAY,
        limit: MAX_PER_SESSION_DAY,
      };
    }

    setSessionStats(stats);
  }

  async function loadPreview() {
    setPreviewLoading(true);

    try {
      const params = new URLSearchParams({
        type: campaignType,
        targetDays: String(targetDays),
        sessions: selectedWpp.join(","),
      });

      const res = await fetch(`/api/crm/campaigns?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao buscar candidatos");
        return;
      }

      setPreviewLeads(data.leads || data || []);
    } finally {
      setPreviewLoading(false);
    }
  }

  useEffect(() => {
    loadSessionStats();
  }, []);

  useEffect(() => {
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignType, targetDays, selectedWpp.join(",")]);

  async function pauseCampaign() {
    const res = await fetch("/api/crm/campaigns", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pause" }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao pausar campanha");
      return;
    }

    alert(`Disparos pendentes pausados: ${data.updated || 0}`);
    await loadSessionStats();
  }

  async function resumeCampaign() {
    const res = await fetch("/api/crm/campaigns", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resume" }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao retomar campanha");
      return;
    }

    alert(`Disparos pendentes retomados: ${data.updated || 0}`);
    await loadSessionStats();
  }

  async function startCampaign() {
    if (!selectedWpp.length) {
      alert("Selecione pelo menos um WhatsApp.");
      return;
    }

    if (!previewLeads.length) {
      alert("Nenhum candidato elegível para esta campanha.");
      return;
    }

    const confirmSend = confirm(
      `Colocar ${previewLeads.length} candidato(s) na fila da campanha "${currentType.label}"?`
    );

    if (!confirmSend) return;

    setLoading(true);

    try {
      const onlineSessions = await getAvailableSessions(selectedWpp);

      if (!onlineSessions.length) {
        alert("Nenhum WhatsApp selecionado está online.");
        return;
      }

      const res = await fetch("/api/crm/campaigns", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignType,
          targetDays,
          selectedWpp: onlineSessions,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao iniciar campanha");
        return;
      }

      alert(`${data.queued || 0} candidato(s) colocados na fila.`);
      await loadPreview();
      await loadSessionStats();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.kicker}>Zentra RH</p>
          <h1 style={styles.title}>Campanhas RH</h1>
          <p style={styles.subtitle}>
            Reative candidatos, reagende entrevistas, convoque perfis e faça
            follow-up automático pelo WhatsApp com controle antiban.
          </p>
        </div>

        <button style={styles.primaryButton} onClick={startCampaign} disabled={loading || !previewLeads.length}>
          {loading ? "Colocando na fila..." : "Iniciar campanha"}
        </button>
      </section>

      <section style={styles.statsGrid}>
        <Metric label="Elegíveis" value={previewLeads.length} />
        <Metric label="WhatsApps online" value={Object.values(sessionStats).filter((s: any) => s?.online).length} />
        <Metric label="Limite disponível" value={totalRemaining} />
        <Metric label="Pendentes" value={queueStats?.pending || 0} />
        <Metric label="Pausados" value={queueStats?.paused || 0} />
      </section>

      <section style={styles.whatsappGrid}>
        {SESSIONS.map((session) => {
          const stat = sessionStats[session];
          const used = stat?.used || 0;
          const limit = stat?.limit || MAX_PER_SESSION_DAY;
          const remaining = stat?.remaining ?? limit;
          const online = stat?.online;
          const percent = Math.min(100, (used / limit) * 100);
          const selected = selectedWpp.includes(session);

          return (
            <button
              key={session}
              onClick={() => toggleWpp(session)}
              style={{
                ...styles.whatsappCard,
                ...(selected ? styles.whatsappCardActive : {}),
              }}
            >
              <div style={styles.cardTop}>
                <strong>WhatsApp {session}</strong>
                <span style={online ? styles.onlineDot : styles.offlineDot} />
              </div>

              <div style={styles.bigNumber}>{used}/{limit}</div>

              <p style={styles.smallText}>
                {online ? "Online" : "Offline"} • Restam {remaining}
              </p>

              <div style={styles.progress}>
                <div style={{ ...styles.progressFill, width: `${percent}%` }} />
              </div>
            </button>
          );
        })}
      </section>

      <section style={styles.card}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.sectionTitle}>Tipo de campanha</h2>
            <p style={styles.smallText}>
              Escolha o comportamento do candidato que será usado no filtro.
            </p>
          </div>

          <button style={styles.secondaryButton} onClick={loadPreview}>
            Atualizar prévia
          </button>
        </div>

        <div style={styles.campaignGrid}>
          {CAMPAIGN_TYPES.map((item) => (
            <button
              key={item.value}
              onClick={() => setCampaignType(item.value)}
              style={{
                ...styles.campaignCard,
                ...(campaignType === item.value ? styles.campaignCardActive : {}),
              }}
            >
              <div style={{ ...styles.campaignIcon, background: `${item.color}18`, color: item.color }}>
                {item.icon}
              </div>

              <h3>{item.label}</h3>
              <p>{item.desc}</p>
            </button>
          ))}
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.controlsGrid}>
          <div>
            <label style={styles.label}>Dias sem atividade</label>

            <select
              value={targetDays}
              onChange={(e) => setTargetDays(Number(e.target.value))}
              style={styles.input}
            >
              {DAYS.map((day) => (
                <option key={day} value={day}>
                  {day === 0 ? "Sem filtro de dias" : `${day}+ dia(s)`}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.summaryBox}>
            <strong>{currentType.label}</strong>
            <span>{previewLeads.length} candidato(s) elegível(is)</span>
          </div>

          <button
            onClick={startCampaign}
            disabled={loading || !previewLeads.length}
            style={styles.primaryButton}
          >
            {loading ? "Colocando na fila..." : "Iniciar campanha"}
          </button>

          <div style={styles.pauseGrid}>
            <button onClick={pauseCampaign} style={styles.dangerButton}>
              Pausar fila
            </button>

            <button onClick={resumeCampaign} style={styles.successButton}>
              Retomar fila
            </button>
          </div>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.sectionTitle}>Candidatos elegíveis</h2>
            <p style={styles.smallText}>
              A prévia mostra até 100 candidatos antes de colocar na fila.
            </p>
          </div>

          <span style={styles.badge}>{previewLeads.length} candidatos</span>
        </div>

        {previewLoading && (
          <div style={styles.empty}>Carregando candidatos...</div>
        )}

        {!previewLoading && !previewLeads.length && (
          <div style={styles.empty}>
            Nenhum candidato encontrado para esse critério.
          </div>
        )}

        <div style={styles.leadGrid}>
          {previewLeads.slice(0, 100).map((lead) => (
            <article key={lead.id} style={styles.leadCard}>
              <div>
                <strong>{lead.name || "Candidato WhatsApp"}</strong>
                <p>{formatPhone(lead.phone)}</p>
              </div>

              <div style={styles.tags}>
                <span>Status: {lead.status || "novo"}</span>
                <span>{daysStopped(lead)} dia(s)</span>
                <span>WhatsApp {lead.session_id || 1}</span>
              </div>

              {lead.last_message && (
                <p style={styles.lastMessage}>{lead.last_message}</p>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div style={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
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
    fontWeight: 900,
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
  secondaryButton: {
    border: "1px solid #bfdbfe",
    borderRadius: 16,
    padding: "12px 16px",
    background: "#fff",
    color: "#2563eb",
    fontWeight: 950,
    cursor: "pointer",
  },
  dangerButton: {
    border: 0,
    borderRadius: 16,
    padding: "12px 16px",
    background: "#ef4444",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
  },
  successButton: {
    border: 0,
    borderRadius: 16,
    padding: "12px 16px",
    background: "#16a34a",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
  },
  statsGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
  },
  metric: {
    background: "#fff",
    border: "1px solid #bfdbfe",
    borderRadius: 20,
    padding: 16,
    display: "grid",
    gap: 8,
  },
  whatsappGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 12,
  },
  whatsappCard: {
    border: "1px solid #bfdbfe",
    background: "#fff",
    borderRadius: 22,
    padding: 16,
    textAlign: "left",
    cursor: "pointer",
    color: "#0f172a",
  },
  whatsappCardActive: {
    border: "1px solid #2563eb",
    background: "linear-gradient(135deg, #eff6ff, #ffffff)",
    boxShadow: "0 12px 30px rgba(37,99,235,.10)",
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  onlineDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "#22c55e",
  },
  offlineDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "#ef4444",
  },
  bigNumber: {
    marginTop: 12,
    fontSize: 26,
    fontWeight: 950,
  },
  progress: {
    marginTop: 12,
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    background: "#dbeafe",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(135deg, #38bdf8, #2563eb)",
  },
  card: {
    marginTop: 18,
    background: "#fff",
    border: "1px solid #bfdbfe",
    borderRadius: 28,
    padding: 22,
    boxShadow: "0 18px 50px rgba(37,99,235,.06)",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 950,
  },
  smallText: {
    margin: "4px 0",
    color: "#64748b",
    fontSize: 12,
  },
  campaignGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: 14,
  },
  campaignCard: {
    border: "1px solid #dbeafe",
    background: "#f8fafc",
    borderRadius: 22,
    padding: 16,
    textAlign: "left",
    cursor: "pointer",
    color: "#0f172a",
  },
  campaignCardActive: {
    border: "1px solid #2563eb",
    background: "linear-gradient(135deg, #eff6ff, #ffffff)",
    boxShadow: "0 14px 34px rgba(37,99,235,.10)",
  },
  campaignIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    fontSize: 20,
    marginBottom: 10,
  },
  controlsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    alignItems: "end",
  },
  label: {
    display: "block",
    marginBottom: 8,
    fontSize: 13,
    fontWeight: 950,
    color: "#334155",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 16,
    border: "1px solid #bfdbfe",
    background: "#f8fafc",
    padding: "13px 14px",
    outline: "none",
    fontSize: 14,
    color: "#0f172a",
  },
  summaryBox: {
    border: "1px solid #bfdbfe",
    borderRadius: 18,
    background: "#f8fafc",
    padding: 14,
    display: "grid",
    gap: 4,
  },
  pauseGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  badge: {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 999,
    padding: "7px 11px",
    fontSize: 12,
    fontWeight: 950,
  },
  empty: {
    marginTop: 16,
    border: "1px dashed #93c5fd",
    borderRadius: 20,
    padding: 24,
    textAlign: "center",
    color: "#64748b",
    background: "#f8fafc",
  },
  leadGrid: {
    marginTop: 16,
    display: "grid",
    gap: 10,
  },
  leadCard: {
    border: "1px solid #dbeafe",
    background: "#f8fafc",
    borderRadius: 20,
    padding: 14,
    display: "grid",
    gap: 8,
  },
  tags: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 900,
  },
  lastMessage: {
    margin: 0,
    color: "#475569",
    fontSize: 13,
    background: "#fff",
    border: "1px solid #e0f2fe",
    borderRadius: 14,
    padding: 10,
  },
};
