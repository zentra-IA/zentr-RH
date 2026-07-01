"use client";

import { useEffect, useMemo, useState } from "react";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function agendaLink(token: string) {
  if (typeof window === "undefined") return `/agenda/${token}`;
  return `${window.location.origin}/agenda/${token}`;
}

export default function AvailabilityPage() {
  const [slots, setSlots] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [filters, setFilters] = useState({
    status: "all",
  });

  const [form, setForm] = useState({
    mode: "range",
    jobId: "",
    date: today(),
    startTime: "09:00",
    endTime: "17:00",
    duration: "30",
    title: "",
    location: "",
    meetingUrl: "",
    agendaType: "individual",
    maxCandidates: "30",
    recruiterName: "",
    recruiterPhone: "",
    notes: "",
  });


  async function loadJobs() {
    try {
      const res = await fetch("/api/rh/jobs", {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.warn("Erro ao carregar vagas:", data);
        return;
      }

      const list = Array.isArray(data)
        ? data
        : data.jobs || data.data || data.items || [];

      setJobs(list);
    } catch (error) {
      console.warn("Erro ao carregar vagas:", error);
    }
  }

  function jobLabel(job: any) {
    const title = job.title || job.name || job.cargo || "Vaga sem título";
    const city = job.city || job.cidade || "";
    const state = job.state || job.uf || job.estado || "";
    const place = [city, state].filter(Boolean).join(" / ");

    return place ? `${title} - ${place}` : title;
  }

  async function loadSlots() {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (filters.status !== "all") {
        params.set("status", filters.status);
      }

      const res = await fetch(`/api/rh/interviews/availability?${params}`, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao carregar horários.");
        return;
      }

      setSlots(data.slots || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJobs();
    loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    return {
      total: slots.length,
      available: slots.filter((slot) => slot.status === "available").length,
      reserved: slots.filter((slot) => slot.status === "reserved").length,
      cancelled: slots.filter((slot) => slot.status === "cancelled").length,
    };
  }, [slots]);

  async function createSlots() {
    if (!form.jobId) {
      alert("Selecione uma vaga para vincular a agenda.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/rh/interviews/availability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao gerar horários.");
        return;
      }

      await loadSlots();
      alert(`${data.created || 0} horário(s) criado(s).`);
    } finally {
      setSaving(false);
    }
  }

  async function cancelSlot(slot: any) {
    if (!confirm("Cancelar este horário?")) return;

    const res = await fetch(`/api/rh/interviews/availability?id=${slot.id}`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao cancelar horário.");
      return;
    }

    await loadSlots();
  }

  async function copyLink(slot: any) {
    await navigator.clipboard.writeText(agendaLink(slot.token));
    alert("Link copiado.");
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.kicker}>Zentra RH</p>
          <h1 style={styles.title}>Disponibilidade de entrevistas</h1>
          <p style={styles.subtitle}>
            Crie horários disponíveis para candidatos escolherem. Crie horários individuais ou compartilhados por vaga. Na agenda compartilhada, vários candidatos podem confirmar o mesmo horário.
          </p>
        </div>

        <button style={styles.primaryButton} onClick={loadSlots}>
          Atualizar
        </button>
      </section>

      <section style={styles.statsGrid}>
        <Metric label="Total" value={stats.total} />
        <Metric label="Disponíveis" value={stats.available} />
        <Metric label="Reservados" value={stats.reserved} />
        <Metric label="Cancelados" value={stats.cancelled} />
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Gerar horários</h2>

        <div style={styles.formGrid}>
          <input style={styles.input} placeholder="Título da agenda (opcional)" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />

          <select
            style={styles.input}
            value={form.jobId}
            onChange={(event) => {
              const selectedJob = jobs.find((job) => String(job.id) === String(event.target.value));
              setForm({
                ...form,
                jobId: event.target.value,
                title: selectedJob ? jobLabel(selectedJob) : form.title,
              });
            }}
          >
            <option value="">Selecione a vaga vinculada</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {jobLabel(job)}
              </option>
            ))}
          </select>
          <input type="date" style={styles.input} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
          <input type="time" style={styles.input} value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} />
          <input type="time" style={styles.input} value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} />

          <select style={styles.input} value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })}>
            <option value="15">15 minutos</option>
            <option value="30">30 minutos</option>
            <option value="45">45 minutos</option>
            <option value="60">60 minutos</option>
          </select>

          <input style={styles.input} placeholder="Local" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
          <input style={styles.input} placeholder="Link Google Meet/Teams" value={form.meetingUrl} onChange={(event) => setForm({ ...form, meetingUrl: event.target.value })} />

          <select
            style={styles.input}
            value={form.agendaType}
            onChange={(event) =>
              setForm({
                ...form,
                agendaType: event.target.value,
              })
            }
          >
            <option value="individual">Agenda individual</option>
            <option value="shared">Agenda compartilhada por lote</option>
          </select>

          {form.agendaType === "shared" && (
            <input
              type="number"
              min={1}
              max={300}
              style={styles.input}
              placeholder="Máximo de candidatos no mesmo horário"
              value={form.maxCandidates}
              onChange={(event) =>
                setForm({
                  ...form,
                  maxCandidates: event.target.value,
                })
              }
            />
          )}
          <input style={styles.input} placeholder="Recrutador responsável" value={form.recruiterName} onChange={(event) => setForm({ ...form, recruiterName: event.target.value })} />
          <input style={styles.input} placeholder="WhatsApp do recrutador" value={form.recruiterPhone} onChange={(event) => setForm({ ...form, recruiterPhone: event.target.value })} />

          <textarea style={{ ...styles.input, gridColumn: "1 / -1", minHeight: 90 }} placeholder="Observações internas" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </div>

        <button style={styles.primaryButton} onClick={createSlots} disabled={saving}>
          {saving ? "Gerando..." : "Gerar horários"}
        </button>
      </section>

      <section style={styles.card}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.sectionTitle}>Horários</h2>
            <p style={styles.smallText}>Copie qualquer link disponível e envie ao candidato.</p>
          </div>

          <select style={styles.inputSmall} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="all">Todos</option>
            <option value="available">Disponíveis</option>
            <option value="reserved">Reservados</option>
            <option value="cancelled">Cancelados</option>
          </select>

          <button style={styles.secondaryButton} onClick={loadSlots}>
            Filtrar
          </button>
        </div>

        {loading && <p style={styles.smallText}>Carregando horários...</p>}

        {!loading && !slots.length && <div style={styles.empty}>Nenhum horário criado.</div>}

        <div style={styles.cardsGrid}>
          {slots.map((slot) => (
            <article key={slot.id} style={styles.slotCard}>
              <div style={styles.cardTop}>
                <div>
                  <strong>{slot.title || "Entrevista"}</strong>
                  <p>{formatDate(slot.start_at)}</p>
                </div>

                <span style={slot.status === "reserved" ? styles.badgeReserved : slot.status === "cancelled" ? styles.badgeCancelled : styles.badge}>
                  {slot.status === "available" ? "Disponível" : slot.status === "reserved" ? "Reservado" : "Cancelado"}
                </span>
              </div>

              {slot.reserved_name && (
                <div style={styles.reservedBox}>
                  <b>{slot.reserved_name}</b>
                  <span>{slot.reserved_phone || "-"}</span>
                  <span>{slot.reserved_email || "-"}</span>
                </div>
              )}

              <div style={styles.info}>
                {(slot.job_id || slot.id_do_trabalho) && <span>Vaga vinculada: {slot.job_id || slot.id_do_trabalho}</span>}
                {(slot.agenda_type || slot.agendaType) === "shared" && (
                  <span>
                    Agenda compartilhada: {slot.reserved_count || 0}/{slot.max_candidates || 1} confirmados
                  </span>
                )}
                {slot.location && <span>Local: {slot.location}</span>}
                {slot.meeting_url && <span>Link: {slot.meeting_url}</span>}
                {slot.recruiter_name && <span>Recrutador: {slot.recruiter_name}</span>}
                {slot.recruiter_phone && <span>WhatsApp recrutador: {slot.recruiter_phone}</span>}
              </div>

              <div style={styles.actions}>
                <button style={styles.primarySmallButton} disabled={slot.status !== "available"} onClick={() => copyLink(slot)}>
                  Copiar link
                </button>

                <a style={styles.secondaryButton} href={`/agenda/${slot.token}`} target="_blank" rel="noreferrer">
                  Abrir
                </a>

                <button style={styles.dangerButton} disabled={slot.status === "cancelled"} onClick={() => cancelSlot(slot)}>
                  Cancelar
                </button>
              </div>
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
  page: { minHeight: "100vh", padding: 20, background: "linear-gradient(135deg, #eff6ff, #ffffff, #dbeafe)", color: "#0f172a" },
  hero: { background: "#fff", border: "1px solid #bfdbfe", borderRadius: 28, padding: 24, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", boxShadow: "0 18px 50px rgba(37,99,235,.08)" },
  kicker: { margin: 0, color: "#2563eb", fontWeight: 900, letterSpacing: ".22em", fontSize: 12, textTransform: "uppercase" },
  title: { margin: "8px 0", fontSize: 36, fontWeight: 950 },
  subtitle: { margin: 0, color: "#64748b", fontSize: 14, maxWidth: 760 },
  primaryButton: { border: 0, borderRadius: 16, padding: "13px 18px", background: "linear-gradient(135deg, #38bdf8, #2563eb)", color: "#fff", fontWeight: 900, cursor: "pointer", boxShadow: "0 12px 24px rgba(37,99,235,.20)" },
  statsGrid: { marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 },
  metric: { background: "#fff", border: "1px solid #bfdbfe", borderRadius: 20, padding: 16, display: "grid", gap: 8 },
  card: { marginTop: 18, background: "#fff", border: "1px solid #bfdbfe", borderRadius: 28, padding: 22, boxShadow: "0 18px 50px rgba(37,99,235,.06)" },
  sectionTitle: { margin: 0, fontSize: 22, fontWeight: 950 },
  smallText: { margin: "4px 0", color: "#64748b", fontSize: 12 },
  formGrid: { marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 },
  input: { width: "100%", boxSizing: "border-box", borderRadius: 16, border: "1px solid #bfdbfe", background: "#f8fafc", padding: "13px 14px", outline: "none", fontSize: 14, color: "#0f172a" },
  inputSmall: { borderRadius: 14, border: "1px solid #bfdbfe", background: "#f8fafc", padding: "10px 12px", outline: "none", fontSize: 14, color: "#0f172a" },
  headerRow: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "space-between" },
  secondaryButton: { border: "1px solid #bfdbfe", borderRadius: 14, padding: "10px 12px", background: "#fff", color: "#2563eb", fontWeight: 900, cursor: "pointer", textDecoration: "none", textAlign: "center" },
  empty: { marginTop: 16, border: "1px dashed #93c5fd", borderRadius: 20, padding: 24, textAlign: "center", color: "#64748b" },
  cardsGrid: { marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 14 },
  slotCard: { border: "1px solid #dbeafe", background: "#f8fafc", borderRadius: 22, padding: 16, display: "grid", gap: 12 },
  cardTop: { display: "flex", justifyContent: "space-between", gap: 12 },
  badge: { border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 999, padding: "6px 10px", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" },
  badgeReserved: { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#15803d", borderRadius: 999, padding: "6px 10px", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" },
  badgeCancelled: { border: "1px solid #fecaca", background: "#fff1f2", color: "#dc2626", borderRadius: 999, padding: "6px 10px", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" },
  reservedBox: { border: "1px solid #bbf7d0", background: "#f0fdf4", borderRadius: 14, padding: 12, display: "grid", gap: 4, color: "#166534", fontSize: 13 },
  info: { display: "grid", gap: 4, color: "#475569", fontSize: 13 },
  actions: { display: "flex", gap: 8, flexWrap: "wrap" },
  primarySmallButton: { border: 0, borderRadius: 14, padding: "10px 12px", background: "#2563eb", color: "#fff", fontWeight: 900, cursor: "pointer" },
  dangerButton: { border: 0, borderRadius: 14, padding: "10px 12px", background: "#ef4444", color: "#fff", fontWeight: 900, cursor: "pointer" },
};
