"use client";

import { useEffect, useState } from "react";

const INTENTS = [
  { value: "RH_ABERTURA", label: "Abertura de vaga" },
  { value: "RH_ENTREVISTA", label: "Convite entrevista" },
  { value: "RH_RELEMBRETE", label: "Lembrete entrevista" },
  { value: "RH_REAGENDAMENTO", label: "Reagendamento" },
  { value: "RH_BANCO_TALENTOS", label: "Banco de talentos" },
];

function statusLabel(status: string) {
  const map: Record<string, string> = {
    created: "Criado",
    queued: "Na fila",
    sending: "Enviando",
    sent: "Enviado",
    paused: "Pausado",
    finished: "Finalizado",
    cancelled: "Cancelado",
  };

  return map[status] || status || "-";
}

function formatDate(value: any) {
  if (!value) return "-";

  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RecruitmentBatchesPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [active, setActive] = useState<any | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [job, setJob] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [intent, setIntent] = useState("RH_ABERTURA");
  const [editingName, setEditingName] = useState("");

  async function loadBatches() {
    setLoading(true);

    try {
      const res = await fetch("/api/rh/recruitment-batches", {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao carregar lotes.");
        return;
      }

      setBatches(data.batches || []);
    } finally {
      setLoading(false);
    }
  }

  async function openBatch(batch: any) {
    const res = await fetch(`/api/rh/recruitment-batches?id=${batch.id}`, {
      cache: "no-store",
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao abrir lote.");
      return;
    }

    setActive(data.batch);
    setEditingName(data.batch?.name || "");
    setMembers(data.candidates || []);
    setJob(data.job || null);
  }

  async function saveBatch() {
    if (!active?.id) return;

    const res = await fetch("/api/rh/recruitment-batches", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        id: active.id,
        name: editingName,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao editar lote.");
      return;
    }

    setActive(data.batch);
    await loadBatches();
    alert("Lote atualizado.");
  }

  async function enqueueBatch(batch: any) {
    if (!confirm(`Enviar WhatsApp para o lote "${batch.name}"?`)) return;

    const res = await fetch("/api/rh/recruitment-batches", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        id: batch.id,
        action: "enqueue",
        intent,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao enfileirar lote.");
      return;
    }

    await loadBatches();

    if (active?.id === batch.id) {
      await openBatch(batch);
    }

    alert(`${data.queued || 0} candidato(s) entraram na fila automática.`);
  }

  async function deleteBatch(batch: any) {
    if (!confirm(`Excluir o lote "${batch.name}"? Itens pendentes/falhas da fila também serão removidos.`)) return;

    const res = await fetch(`/api/rh/recruitment-batches?id=${batch.id}`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao excluir lote.");
      return;
    }

    if (active?.id === batch.id) {
      setActive(null);
      setMembers([]);
      setJob(null);
    }

    await loadBatches();
    alert("Lote excluído.");
  }

  useEffect(() => {
    loadBatches();
  }, []);

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.kicker}>Zentra RH</p>
          <h1 style={styles.title}>Lotes de Recrutamento</h1>
          <p style={styles.subtitle}>
            Gerencie candidatos vinculados a uma vaga, envie WhatsApp pelo antiban e acompanhe o contexto da vaga.
          </p>
        </div>

        <button style={styles.primaryButton} onClick={loadBatches}>
          Atualizar
        </button>
      </section>

      <section style={styles.toolbar}>
        <select style={styles.input} value={intent} onChange={(e) => setIntent(e.target.value)}>
          {INTENTS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <span style={styles.smallText}>
          O envio entra na fila automática, respeitando limite por WhatsApp e delay antiban.
        </span>
      </section>

      <section style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Lotes</h2>

          {loading && <p style={styles.smallText}>Carregando...</p>}

          {!loading && !batches.length && (
            <div style={styles.empty}>Nenhum lote criado ainda.</div>
          )}

          <div style={styles.list}>
            {batches.map((batch) => (
              <div key={batch.id} style={styles.batchItem}>
                <div>
                  <strong>{batch.name || "Lote sem nome"}</strong>
                  <p style={styles.smallText}>
                    Vaga: {batch.job?.title || batch.job_id || "-"} • {formatDate(batch.created_at)}
                  </p>
                  <div style={styles.meta}>
                    <span>{statusLabel(batch.status)}</span>
                    <span>{batch.total_candidates || 0} candidatos</span>
                    <span>{batch.total_answered || 0} respostas</span>
                    <span>{batch.total_interviews || 0} entrevistas</span>
                  </div>
                </div>

                <div style={styles.actions}>
                  <button style={styles.secondaryButton} onClick={() => openBatch(batch)}>
                    Ver
                  </button>

                  <button style={styles.successButton} onClick={() => enqueueBatch(batch)}>
                    Enviar WhatsApp
                  </button>

                  <button style={styles.dangerButton} onClick={() => deleteBatch(batch)}>
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.card}>
          {!active && (
            <div style={styles.empty}>Selecione um lote para visualizar os candidatos.</div>
          )}

          {active && (
            <>
              <div style={styles.detailHeader}>
                <div>
                  <p style={styles.kicker}>Detalhes do lote</p>
                  <h2 style={styles.sectionTitle}>{active.name}</h2>
                  <p style={styles.smallText}>
                    Vaga: {job?.title || active.job_id || "-"}
                  </p>
                </div>

                <button style={styles.successButton} onClick={() => enqueueBatch(active)}>
                  Enviar lote
                </button>
              </div>

              <div style={styles.formRow}>
                <input
                  style={styles.input}
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  placeholder="Nome do lote"
                />

                <button style={styles.primaryButton} onClick={saveBatch}>
                  Salvar nome
                </button>
              </div>

              <div style={styles.statsGrid}>
                <Metric label="Candidatos" value={active.total_candidates || members.length} />
                <Metric label="Respondidos" value={active.total_answered || 0} />
                <Metric label="Entrevistas" value={active.total_interviews || 0} />
                <Metric label="Contratados" value={active.total_hired || 0} />
              </div>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Nome</th>
                      <th style={styles.th}>Telefone</th>
                      <th style={styles.th}>E-mail</th>
                      <th style={styles.th}>Score</th>
                      <th style={styles.th}>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {members.map((member) => {
                      const person = member.lead || member.candidate || {};

                      return (
                        <tr key={member.id}>
                          <td style={styles.td}>{person.name || person.nome || "Candidato"}</td>
                          <td style={styles.td}>{member.phone || person.phone || person.mobile || "-"}</td>
                          <td style={styles.td}>{member.email || person.email || "-"}</td>
                          <td style={styles.td}>{member.score ? `${member.score}%` : "-"}</td>
                          <td style={styles.td}><span style={styles.badge}>{member.status || "-"}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
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
  page: { minHeight: "100vh", padding: 20, background: "linear-gradient(135deg, #eff6ff, #ffffff, #dbeafe)", color: "#0f172a" },
  hero: { background: "#fff", border: "1px solid #bfdbfe", borderRadius: 28, padding: 24, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", boxShadow: "0 18px 50px rgba(37,99,235,.08)" },
  kicker: { margin: 0, color: "#2563eb", fontWeight: 950, letterSpacing: ".22em", fontSize: 12, textTransform: "uppercase" },
  title: { margin: "8px 0", fontSize: 36, fontWeight: 950 },
  subtitle: { margin: 0, color: "#64748b", fontSize: 14, maxWidth: 760 },
  toolbar: { marginTop: 16, background: "#fff", border: "1px solid #bfdbfe", borderRadius: 22, padding: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" },
  grid: { marginTop: 18, display: "grid", gridTemplateColumns: "minmax(320px, .9fr) minmax(360px, 1.1fr)", gap: 18 },
  card: { background: "#fff", border: "1px solid #bfdbfe", borderRadius: 28, padding: 20, boxShadow: "0 18px 50px rgba(37,99,235,.06)", minWidth: 0 },
  sectionTitle: { margin: 0, fontSize: 22, fontWeight: 950 },
  smallText: { margin: "4px 0", color: "#64748b", fontSize: 12 },
  input: { width: "100%", boxSizing: "border-box", borderRadius: 16, border: "1px solid #bfdbfe", background: "#f8fafc", padding: "13px 14px", outline: "none", fontSize: 14, color: "#0f172a", maxWidth: 380 },
  primaryButton: { border: 0, borderRadius: 16, padding: "12px 16px", background: "linear-gradient(135deg, #38bdf8, #2563eb)", color: "#fff", fontWeight: 900, cursor: "pointer" },
  secondaryButton: { border: "1px solid #bfdbfe", borderRadius: 14, padding: "10px 12px", background: "#fff", color: "#2563eb", fontWeight: 900, cursor: "pointer" },
  successButton: { border: 0, borderRadius: 14, padding: "10px 12px", background: "#16a34a", color: "#fff", fontWeight: 900, cursor: "pointer" },
  dangerButton: { border: 0, borderRadius: 14, padding: "10px 12px", background: "#ef4444", color: "#fff", fontWeight: 900, cursor: "pointer" },
  list: { marginTop: 16, display: "grid", gap: 12 },
  batchItem: { border: "1px solid #dbeafe", background: "#f8fafc", borderRadius: 20, padding: 14, display: "grid", gap: 12 },
  meta: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 },
  actions: { display: "flex", gap: 8, flexWrap: "wrap" },
  detailHeader: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" },
  formRow: { marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" },
  statsGrid: { marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 },
  metric: { background: "#f8fafc", border: "1px solid #dbeafe", borderRadius: 18, padding: 14, display: "grid", gap: 6 },
  empty: { border: "1px dashed #93c5fd", borderRadius: 20, padding: 24, textAlign: "center", color: "#64748b" },
  tableWrap: { marginTop: 16, overflowX: "auto", border: "1px solid #dbeafe", borderRadius: 18 },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 720 },
  th: { background: "#eff6ff", color: "#1e3a8a", padding: 12, textAlign: "left", borderBottom: "1px solid #bfdbfe", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" },
  td: { padding: 12, borderBottom: "1px solid #e2e8f0", fontSize: 13, verticalAlign: "top" },
  badge: { display: "inline-block", border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 999, padding: "6px 10px", fontSize: 11, fontWeight: 900 },
};
