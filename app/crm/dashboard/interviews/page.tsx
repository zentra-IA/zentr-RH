"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
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

function formatOnlyDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function agendaLink(token: string) {
  if (!token) return "";
  if (typeof window === "undefined") return `/agenda/${token}`;
  return `${window.location.origin}/agenda/${token}`;
}

function statusLabel(status?: string) {
  const map: Record<string, string> = {
    available: "Disponível",
    reserved: "Reservado",
    cancelled: "Cancelado",
    confirmed: "Confirmado",
    approved: "Aprovado",
    rejected: "Reprovado",
    no_show: "Não compareceu",
  };

  return map[String(status || "")] || status || "-";
}

function getSlotJobId(slot: any) {
  return slot.job_id || slot.id_do_trabalho || "";
}

function getSlotAgendaType(slot: any) {
  return slot.agenda_type || slot.agendaType || "individual";
}

function getSlotAttendees(slot: any) {
  if (Array.isArray(slot.attendees)) return slot.attendees;
  if (Array.isArray(slot.confirmed_candidates)) return slot.confirmed_candidates;
  return [];
}

function getConfirmedCount(slot: any) {
  const attendees = getSlotAttendees(slot);
  const reservedCount = Number(slot.reserved_count || slot.reservedCount || 0);
  if (getSlotAgendaType(slot) === "shared") {
    return Math.max(reservedCount, attendees.length);
  }
  return attendees.length || (slot.reserved_name ? 1 : 0);
}

export default function AvailabilityPage() {
  const [slots, setSlots] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [filters, setFilters] = useState({
    status: "all",
    jobId: "",
    date: "",
    search: "",
  });

  const [form, setForm] = useState({
    mode: "range",
    jobId: "",
    date: today(),
    startTime: "09:00",
    endTime: "17:00",
    manualTime: "09:00",
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

  const [editingSlot, setEditingSlot] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    jobId: "",
    title: "",
    status: "available",
    location: "",
    meetingUrl: "",
    agendaType: "individual",
    maxCandidates: "1",
    recruiterName: "",
    recruiterPhone: "",
    notes: "",
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
    const title = job.title || job.titulo || job.name || job.cargo || "Vaga sem título";
    const city = job.city || job.cidade || "";
    const state = job.state || job.uf || job.estado || "";
    const place = [city, state].filter(Boolean).join(" / ");

    return place ? `${title} - ${place}` : title;
  }

  function jobNameById(jobId?: string | null) {
    if (!jobId) return "";
    const job = jobs.find((item) => String(item.id) === String(jobId));
    return job ? jobLabel(job) : String(jobId);
  }

  async function loadSlots() {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (filters.status !== "all") {
        params.set("status", filters.status);
      }

      if (filters.jobId) {
        params.set("jobId", filters.jobId);
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

  const visibleSlots = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return slots.filter((slot) => {
      const slotJobId = getSlotJobId(slot);
      const slotDate = formatOnlyDate(slot.start_at);

      if (filters.date && slotDate !== filters.date) return false;

      if (search) {
        const text = [
          slot.title,
          slot.location,
          slot.meeting_url,
          slot.recruiter_name,
          slot.recruiter_phone,
          slot.reserved_name,
          slot.reserved_phone,
          slot.reserved_email,
          jobNameById(slotJobId),
          slotJobId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!text.includes(search)) return false;
      }

      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, filters, jobs]);

  const stats = useMemo(() => {
    return {
      total: visibleSlots.length,
      available: visibleSlots.filter((slot) => slot.status === "available").length,
      reserved: visibleSlots.filter((slot) => slot.status === "reserved").length,
      cancelled: visibleSlots.filter((slot) => slot.status === "cancelled").length,
    };
  }, [visibleSlots]);

  async function createSlots() {
    if (!form.jobId) {
      alert("Selecione uma vaga para vincular a agenda.");
      return;
    }

    if (form.mode === "range" && (!form.date || !form.startTime || !form.endTime)) {
      alert("Preencha data, início e fim.");
      return;
    }

    if (form.mode === "single" && (!form.date || !form.manualTime)) {
      alert("Preencha data e horário manual.");
      return;
    }

    setSaving(true);

    try {
      const body =
        form.mode === "single"
          ? {
              ...form,
              startAt: `${form.date}T${form.manualTime}:00`,
            }
          : form;

      const res = await fetch("/api/rh/interviews/availability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(body),
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

  function openEdit(slot: any) {
    setEditingSlot(slot);
    setEditForm({
      jobId: getSlotJobId(slot),
      title: slot.title || "",
      status: slot.status || "available",
      location: slot.location || "",
      meetingUrl: slot.meeting_url || "",
      agendaType: getSlotAgendaType(slot),
      maxCandidates: String(slot.max_candidates || 1),
      recruiterName: slot.recruiter_name || "",
      recruiterPhone: slot.recruiter_phone || "",
      notes: slot.notes || "",
    });
  }

  async function saveEdit() {
    if (!editingSlot?.id) return;

    const res = await fetch("/api/rh/interviews/availability", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        id: editingSlot.id,
        jobId: editForm.jobId || null,
        title: editForm.title,
        status: editForm.status,
        location: editForm.location,
        meetingUrl: editForm.meetingUrl,
        agendaType: editForm.agendaType,
        maxCandidates: Number(editForm.maxCandidates || 1),
        recruiterName: editForm.recruiterName,
        recruiterPhone: editForm.recruiterPhone,
        notes: editForm.notes,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao editar horário.");
      return;
    }

    setEditingSlot(null);
    await loadSlots();
  }

  async function cancelSlot(slot: any) {
    if (!confirm("Cancelar este horário? Ele ficará marcado como cancelado.")) return;

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

  async function deleteSlot(slot: any) {
    if (!confirm("Excluir definitivamente este horário? Essa ação não pode ser desfeita.")) return;

    const res = await fetch(`/api/rh/interviews/availability?id=${slot.id}&hard=1`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao excluir horário.");
      return;
    }

    await loadSlots();
  }

  async function restoreSlot(slot: any) {
    const res = await fetch("/api/rh/interviews/availability", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        id: slot.id,
        status: "available",
        clearReservation: true,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao reativar horário.");
      return;
    }

    await loadSlots();
  }

  async function updateSlotStatus(slot: any, status: string) {
    const confirmText: Record<string, string> = {
      approved: "Marcar este candidato como aprovado?",
      rejected: "Marcar este candidato como não aprovado?",
      no_show: "Marcar como não compareceu?",
      available: "Reabrir este horário para reagendamento?",
    };

    if (!confirm(confirmText[status] || "Atualizar status deste horário?")) return;

    const res = await fetch("/api/rh/interviews/availability", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        id: slot.id,
        status,
        clearReservation: status === "available",
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao atualizar status.");
      return;
    }

    await loadSlots();
  }

  async function updateCandidateStatus(slot: any, person: any, status: string) {
    const confirmText: Record<string, string> = {
      approved: `Aprovar ${person?.name || "este candidato"}?`,
      rejected: `Marcar ${person?.name || "este candidato"} como não aprovado?`,
      no_show: `Marcar ${person?.name || "este candidato"} como não compareceu?`,
      reschedule: `Reagendar ${person?.name || "este candidato"}?`,
    };

    if (!confirm(confirmText[status] || "Atualizar candidato?")) return;

    const interviewId = person?.interview_id || person?.id;
    const leadId = person?.lead_id || person?.candidate_id || null;

    if (status === "reschedule") {
      const res = await fetch("/api/rh/interviews/availability", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          id: slot.id,
          status: getSlotAgendaType(slot) === "shared" ? slot.status : "available",
          clearReservation: getSlotAgendaType(slot) !== "shared",
          leadId,
          interviewId,
          candidatePhone: person?.phone || null,
          candidateEmail: person?.email || null,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao reagendar candidato.");
        return;
      }

      await loadSlots();
      return;
    }

    if (!interviewId && !leadId) {
      alert("Não encontrei o ID deste candidato para atualizar. Recarregue a página e tente novamente.");
      return;
    }

    const res = await fetch("/api/rh/interviews", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        id: interviewId,
        leadId,
        slotId: slot.id,
        status,
        candidatePhone: person?.phone || null,
        candidateEmail: person?.email || null,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao atualizar candidato.");
      return;
    }

    await loadSlots();
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function toggleSelectAllVisible() {
    const visibleIds = visibleSlots.map((slot) => String(slot.id));
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

    setSelectedIds((current) => {
      if (allSelected) return current.filter((id) => !visibleIds.includes(id));
      return Array.from(new Set([...current, ...visibleIds]));
    });
  }

  async function bulkDeleteSelected() {
    if (!selectedIds.length) {
      alert("Selecione pelo menos um horário.");
      return;
    }

    if (!confirm(`Excluir definitivamente ${selectedIds.length} horário(s) selecionado(s)?`)) return;

    for (const id of selectedIds) {
      const res = await fetch(`/api/rh/interviews/availability?id=${id}&hard=1`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || `Erro ao excluir horário ${id}.`);
        return;
      }
    }

    setSelectedIds([]);
    await loadSlots();
  }

  async function bulkCancelSelected() {
    if (!selectedIds.length) {
      alert("Selecione pelo menos um horário.");
      return;
    }

    if (!confirm(`Cancelar ${selectedIds.length} horário(s) selecionado(s)?`)) return;

    for (const id of selectedIds) {
      const res = await fetch(`/api/rh/interviews/availability?id=${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || `Erro ao cancelar horário ${id}.`);
        return;
      }
    }

    setSelectedIds([]);
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
            Crie horários individuais ou compartilhados, vinculados à vaga correta. Use filtros para localizar, editar, cancelar ou excluir horários.
          </p>
        </div>

        <button style={styles.primaryButton} onClick={loadSlots}>
          Atualizar
        </button>
      </section>

      <section style={styles.statsGrid}>
        <Metric label="Total filtrado" value={stats.total} />
        <Metric label="Disponíveis" value={stats.available} />
        <Metric label="Reservados" value={stats.reserved} />
        <Metric label="Cancelados" value={stats.cancelled} />
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Gerar horários</h2>
        <p style={styles.smallText}>
          Gere uma grade em lote ou adicione um único horário manualmente. A agenda sempre fica vinculada à vaga selecionada.
        </p>

        <div style={styles.modeRow}>
          <button
            type="button"
            style={form.mode === "range" ? styles.tabActive : styles.tab}
            onClick={() => setForm({ ...form, mode: "range" })}
          >
            Criar em lote
          </button>
          <button
            type="button"
            style={form.mode === "single" ? styles.tabActive : styles.tab}
            onClick={() => setForm({ ...form, mode: "single" })}
          >
            Adicionar horário manual
          </button>
        </div>

        <div style={styles.formGrid}>
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

          <input
            style={styles.input}
            placeholder="Título da agenda (opcional)"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />

          <input
            type="date"
            style={styles.input}
            value={form.date}
            onChange={(event) => setForm({ ...form, date: event.target.value })}
          />

          {form.mode === "range" ? (
            <>
              <input
                type="time"
                style={styles.input}
                value={form.startTime}
                onChange={(event) => setForm({ ...form, startTime: event.target.value })}
              />
              <input
                type="time"
                style={styles.input}
                value={form.endTime}
                onChange={(event) => setForm({ ...form, endTime: event.target.value })}
              />
            </>
          ) : (
            <input
              type="time"
              style={styles.input}
              value={form.manualTime}
              onChange={(event) => setForm({ ...form, manualTime: event.target.value })}
            />
          )}

          <select
            style={styles.input}
            value={form.duration}
            onChange={(event) => setForm({ ...form, duration: event.target.value })}
          >
            <option value="15">15 minutos</option>
            <option value="30">30 minutos</option>
            <option value="45">45 minutos</option>
            <option value="60">60 minutos</option>
            <option value="90">90 minutos</option>
            <option value="120">120 minutos</option>
          </select>

          <input
            style={styles.input}
            placeholder="Local presencial"
            value={form.location}
            onChange={(event) => setForm({ ...form, location: event.target.value })}
          />

          <input
            style={styles.input}
            placeholder="Link Google Meet/Teams"
            value={form.meetingUrl}
            onChange={(event) => setForm({ ...form, meetingUrl: event.target.value })}
          />

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

          <input
            style={styles.input}
            placeholder="Recrutador responsável"
            value={form.recruiterName}
            onChange={(event) => setForm({ ...form, recruiterName: event.target.value })}
          />

          <input
            style={styles.input}
            placeholder="WhatsApp do recrutador"
            value={form.recruiterPhone}
            onChange={(event) => setForm({ ...form, recruiterPhone: event.target.value })}
          />

          <textarea
            style={{ ...styles.input, gridColumn: "1 / -1", minHeight: 90 }}
            placeholder="Observações internas"
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
          />
        </div>

        <button style={styles.primaryButton} onClick={createSlots} disabled={saving}>
          {saving ? "Salvando..." : form.mode === "single" ? "Adicionar horário" : "Gerar horários"}
        </button>
      </section>

      <section style={styles.card}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.sectionTitle}>Horários</h2>
            <p style={styles.smallText}>
              Filtre por vaga, data, status ou termo. Você pode copiar, abrir, editar, cancelar ou excluir horários.
            </p>
          </div>
        </div>

        <div style={styles.filtersGrid}>
          <input
            style={styles.input}
            placeholder="Buscar por vaga, candidato, telefone, local..."
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
          />

          <select
            style={styles.input}
            value={filters.jobId}
            onChange={(event) => setFilters({ ...filters, jobId: event.target.value })}
          >
            <option value="">Todas as vagas</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {jobLabel(job)}
              </option>
            ))}
          </select>

          <input
            type="date"
            style={styles.input}
            value={filters.date}
            onChange={(event) => setFilters({ ...filters, date: event.target.value })}
          />

          <select
            style={styles.input}
            value={filters.status}
            onChange={(event) => setFilters({ ...filters, status: event.target.value })}
          >
            <option value="all">Todos os status</option>
            <option value="available">Disponíveis</option>
            <option value="reserved">Reservados</option>
            <option value="confirmed">Confirmados</option>
            <option value="cancelled">Cancelados</option>
            <option value="approved">Aprovados</option>
            <option value="rejected">Reprovados</option>
            <option value="no_show">Não compareceu</option>
          </select>

          <button style={styles.secondaryButton} onClick={loadSlots}>
            Filtrar
          </button>

          <button
            style={styles.secondaryButton}
            onClick={() => {
              setFilters({ status: "all", jobId: "", date: "", search: "" });
              setTimeout(loadSlots, 0);
            }}
          >
            Limpar filtros
          </button>
        </div>

        <div style={styles.bulkBar}>
          <label style={styles.checkLabel}>
            <input
              type="checkbox"
              checked={
                visibleSlots.length > 0 &&
                visibleSlots.every((slot) => selectedIds.includes(String(slot.id)))
              }
              onChange={toggleSelectAllVisible}
            />
            Selecionar todos
          </label>

          <span style={styles.smallText}>{selectedIds.length} selecionado(s)</span>

          <button style={styles.secondaryButton} onClick={() => setSelectedIds([])}>
            Limpar seleção
          </button>

          <button style={styles.warningButton} onClick={bulkCancelSelected}>
            Cancelar selecionados
          </button>

          <button style={styles.dangerButton} onClick={bulkDeleteSelected}>
            Excluir selecionados
          </button>
        </div>

        {loading && <p style={styles.smallText}>Carregando horários...</p>}

        {!loading && !visibleSlots.length && <div style={styles.empty}>Nenhum horário encontrado.</div>}

        <div style={styles.cardsGrid}>
          {visibleSlots.map((slot) => {
            const slotJobId = getSlotJobId(slot);
            const isShared = getSlotAgendaType(slot) === "shared";
            const attendees = getSlotAttendees(slot);
            const confirmedCount = getConfirmedCount(slot);

            return (
              <article key={slot.id} style={styles.slotCard}>
                <div style={styles.cardTop}>
                  <label style={styles.cardCheck}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(String(slot.id))}
                      onChange={() => toggleSelected(String(slot.id))}
                    />
                  </label>

                  <div>
                    <strong>{slot.title || "Entrevista"}</strong>
                    <p>{formatDate(slot.start_at)}</p>
                    {slot.end_at && <p style={styles.smallText}>Fim: {formatDate(slot.end_at)}</p>}
                  </div>

                  <span
                    style={
                      slot.status === "reserved" || slot.status === "confirmed"
                        ? styles.badgeReserved
                        : slot.status === "cancelled"
                          ? styles.badgeCancelled
                          : styles.badge
                    }
                  >
                    {statusLabel(slot.status)}
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
                  {slotJobId && <span>Vaga: {jobNameById(slotJobId)}</span>}
                  <span>Tipo: {isShared ? "Compartilhada por lote" : "Individual"}</span>
                  {isShared && (
                    <span>
                      Confirmados: {confirmedCount}/{slot.max_candidates || 1}
                    </span>
                  )}
                  {slot.location && <span>Local: {slot.location}</span>}
                  {slot.meeting_url && <span>Link reunião: {slot.meeting_url}</span>}
                  {slot.recruiter_name && <span>Recrutador: {slot.recruiter_name}</span>}
                  {slot.recruiter_phone && <span>WhatsApp recrutador: {slot.recruiter_phone}</span>}
                </div>

                {attendees.length > 0 && (
                  <div style={styles.attendeesBox}>
                    <div style={styles.attendeesHeader}>
                      <strong>{isShared ? "Candidatos agendados" : "Candidato agendado"}</strong>
                      <span style={styles.attendeesCount}>{attendees.length}</span>
                    </div>

                    {attendees.map((person: any, index: number) => {
                      const personStatus = String(person.status || "").toLowerCase();

                      return (
                        <div key={person.id || person.lead_id || person.phone || index} style={styles.attendeeCard}>
                          <div style={styles.attendeeInfo}>
                            <strong>{person.name || "Candidato"}</strong>
                            <span>{person.phone || "Telefone não informado"}</span>
                            <span>{person.email || "E-mail não informado"}</span>
                            {personStatus && (
                              <small style={styles.smallText}>Status: {statusLabel(personStatus)}</small>
                            )}
                          </div>

                          <div style={styles.attendeeActions}>
                            <button
                              style={styles.successButton}
                              onClick={() => updateCandidateStatus(slot, person, "approved")}
                            >
                              Aprovar
                            </button>

                            <button
                              style={styles.secondaryButton}
                              onClick={() => updateCandidateStatus(slot, person, "reschedule")}
                            >
                              Reagendar
                            </button>

                            <button
                              style={styles.dangerButton}
                              onClick={() => updateCandidateStatus(slot, person, "rejected")}
                            >
                              Não aprovado
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={styles.actions}>
                  <button
                    style={styles.primarySmallButton}
                    disabled={!slot.token || slot.status === "cancelled"}
                    onClick={() => copyLink(slot)}
                  >
                    Copiar link
                  </button>

                  {slot.token && (
                    <a style={styles.secondaryButton} href={`/agenda/${slot.token}`} target="_blank" rel="noreferrer">
                      Abrir
                    </a>
                  )}

                  <button style={styles.secondaryButton} onClick={() => openEdit(slot)}>
                    Editar
                  </button>

                  {!isShared && (slot.status === "reserved" || slot.status === "confirmed") && (
                    <>
                      <button style={styles.successButton} onClick={() => updateSlotStatus(slot, "approved")}>
                        Aprovado
                      </button>

                      <button style={styles.secondaryButton} onClick={() => updateSlotStatus(slot, "available")}>
                        Reagendar
                      </button>

                      <button style={styles.dangerButton} onClick={() => updateSlotStatus(slot, "rejected")}>
                        Não aprovado
                      </button>
                    </>
                  )}

                  {slot.status === "cancelled" ? (
                    <button style={styles.primarySmallButton} onClick={() => restoreSlot(slot)}>
                      Reativar
                    </button>
                  ) : (
                    <button style={styles.warningButton} onClick={() => cancelSlot(slot)}>
                      Cancelar
                    </button>
                  )}

                  <button style={styles.dangerButton} onClick={() => deleteSlot(slot)}>
                    Excluir
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {editingSlot && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.headerRow}>
              <div>
                <h2 style={styles.sectionTitle}>Editar horário</h2>
                <p style={styles.smallText}>{formatDate(editingSlot.start_at)}</p>
              </div>

              <button style={styles.secondaryButton} onClick={() => setEditingSlot(null)}>
                Fechar
              </button>
            </div>

            <div style={styles.formGrid}>
              <select
                style={styles.input}
                value={editForm.jobId}
                onChange={(event) => setEditForm({ ...editForm, jobId: event.target.value })}
              >
                <option value="">Selecione a vaga vinculada</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {jobLabel(job)}
                  </option>
                ))}
              </select>

              <input
                style={styles.input}
                placeholder="Título"
                value={editForm.title}
                onChange={(event) => setEditForm({ ...editForm, title: event.target.value })}
              />

              <select
                style={styles.input}
                value={editForm.status}
                onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}
              >
                <option value="available">Disponível</option>
                <option value="reserved">Reservado</option>
                <option value="confirmed">Confirmado</option>
                <option value="cancelled">Cancelado</option>
                <option value="approved">Aprovado</option>
                <option value="rejected">Reprovado</option>
                <option value="no_show">Não compareceu</option>
              </select>

              <input
                style={styles.input}
                placeholder="Local"
                value={editForm.location}
                onChange={(event) => setEditForm({ ...editForm, location: event.target.value })}
              />

              <input
                style={styles.input}
                placeholder="Link Google Meet/Teams"
                value={editForm.meetingUrl}
                onChange={(event) => setEditForm({ ...editForm, meetingUrl: event.target.value })}
              />

              <select
                style={styles.input}
                value={editForm.agendaType}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    agendaType: event.target.value,
                    maxCandidates: event.target.value === "individual" ? "1" : editForm.maxCandidates,
                  })
                }
              >
                <option value="individual">Agenda individual</option>
                <option value="shared">Agenda compartilhada por lote</option>
              </select>

              {editForm.agendaType === "shared" && (
                <input
                  type="number"
                  min={1}
                  max={300}
                  style={styles.input}
                  placeholder="Máximo de candidatos"
                  value={editForm.maxCandidates}
                  onChange={(event) => setEditForm({ ...editForm, maxCandidates: event.target.value })}
                />
              )}

              <input
                style={styles.input}
                placeholder="Recrutador responsável"
                value={editForm.recruiterName}
                onChange={(event) => setEditForm({ ...editForm, recruiterName: event.target.value })}
              />

              <input
                style={styles.input}
                placeholder="WhatsApp do recrutador"
                value={editForm.recruiterPhone}
                onChange={(event) => setEditForm({ ...editForm, recruiterPhone: event.target.value })}
              />

              <textarea
                style={{ ...styles.input, gridColumn: "1 / -1", minHeight: 90 }}
                placeholder="Observações"
                value={editForm.notes}
                onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })}
              />
            </div>

            <div style={styles.actions}>
              <button style={styles.primaryButton} onClick={saveEdit}>
                Salvar alterações
              </button>

              <button style={styles.secondaryButton} onClick={() => setEditingSlot(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
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

const styles: Record<string, CSSProperties> = {
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
  filtersGrid: { marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, alignItems: "center" },
  input: { width: "100%", boxSizing: "border-box", borderRadius: 16, border: "1px solid #bfdbfe", background: "#f8fafc", padding: "13px 14px", outline: "none", fontSize: 14, color: "#0f172a" },
  headerRow: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "space-between" },
  modeRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 },
  tab: { border: "1px solid #bfdbfe", borderRadius: 14, padding: "10px 12px", background: "#fff", color: "#2563eb", fontWeight: 900, cursor: "pointer" },
  tabActive: { border: "1px solid #2563eb", borderRadius: 14, padding: "10px 12px", background: "#eff6ff", color: "#1d4ed8", fontWeight: 950, cursor: "pointer" },
  secondaryButton: { border: "1px solid #bfdbfe", borderRadius: 14, padding: "10px 12px", background: "#fff", color: "#2563eb", fontWeight: 900, cursor: "pointer", textDecoration: "none", textAlign: "center" },
  empty: { marginTop: 16, border: "1px dashed #93c5fd", borderRadius: 20, padding: 24, textAlign: "center", color: "#64748b" },
  cardsGrid: { marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 14 },
  slotCard: { border: "1px solid #dbeafe", background: "#f8fafc", borderRadius: 22, padding: 16, display: "grid", gap: 12 },
  cardTop: { display: "flex", justifyContent: "space-between", gap: 12 },
  badge: { border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 999, padding: "6px 10px", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" },
  badgeReserved: { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#15803d", borderRadius: 999, padding: "6px 10px", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" },
  badgeCancelled: { border: "1px solid #fecaca", background: "#fff1f2", color: "#dc2626", borderRadius: 999, padding: "6px 10px", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" },
  reservedBox: { border: "1px solid #bbf7d0", background: "#f0fdf4", borderRadius: 14, padding: 12, display: "grid", gap: 4, color: "#166534", fontSize: 13 },
  attendeesBox: { border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 14, padding: 12, display: "grid", gap: 10, color: "#1e3a8a", fontSize: 13 },
  attendeesHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  attendeesCount: { border: "1px solid #bfdbfe", background: "#fff", color: "#1d4ed8", borderRadius: 999, padding: "3px 8px", fontSize: 11, fontWeight: 900 },
  attendeeCard: { background: "#fff", border: "1px solid #dbeafe", borderRadius: 14, padding: 12, display: "grid", gap: 10 },
  attendeeInfo: { display: "grid", gap: 3, color: "#1e3a8a" },
  attendeeActions: { display: "flex", gap: 8, flexWrap: "wrap" },
  attendeeLine: { display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", borderTop: "1px solid #dbeafe", paddingTop: 6 },
  info: { display: "grid", gap: 4, color: "#475569", fontSize: 13 },
  actions: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 },
  primarySmallButton: { border: 0, borderRadius: 14, padding: "10px 12px", background: "#2563eb", color: "#fff", fontWeight: 900, cursor: "pointer" },
  warningButton: { border: 0, borderRadius: 14, padding: "10px 12px", background: "#f59e0b", color: "#fff", fontWeight: 900, cursor: "pointer" },
  dangerButton: { border: 0, borderRadius: 14, padding: "10px 12px", background: "#ef4444", color: "#fff", fontWeight: 900, cursor: "pointer" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "grid", placeItems: "center", padding: 18, zIndex: 50 },
  modal: { width: "min(980px, 100%)", maxHeight: "90vh", overflow: "auto", background: "#fff", borderRadius: 24, border: "1px solid #bfdbfe", padding: 22, boxShadow: "0 24px 80px rgba(15,23,42,.25)" },
  bulkBar: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "14px 0" },
  checkLabel: { display: "flex", alignItems: "center", gap: 8, fontWeight: 900, color: "#1d4ed8" },
  cardCheck: { display: "flex", alignItems: "center", marginRight: 8 },
  successButton: { border: 0, borderRadius: 14, padding: "10px 12px", background: "#16a34a", color: "#fff", fontWeight: 900, cursor: "pointer" },
};
