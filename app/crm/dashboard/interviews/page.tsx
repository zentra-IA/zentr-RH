"use client";

import { useEffect, useMemo, useState } from "react";

const INTERVIEW_STATUS_OPTIONS = [
  { value: "scheduled", label: "Agendada" },
  { value: "confirmed", label: "Confirmada" },
  { value: "reschedule", label: "Reagendar" },
  { value: "done", label: "Realizada" },
  { value: "no_show", label: "Não compareceu" },
  { value: "approved", label: "Aprovado" },
  { value: "rejected", label: "Reprovado" },
  { value: "hired", label: "Contratado" },
  { value: "cancelled", label: "Cancelada" },
];

const SLOT_STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "available", label: "Disponíveis" },
  { value: "reserved", label: "Reservados" },
  { value: "cancelled", label: "Cancelados" },
];

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function todayInput() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function statusLabel(status: string) {
  return (
    INTERVIEW_STATUS_OPTIONS.find((item) => item.value === status)?.label ||
    status
  );
}

function slotStatusLabel(status: string) {
  if (status === "available") return "Disponível";
  if (status === "reserved") return "Reservado";
  if (status === "cancelled") return "Cancelado";
  return status || "-";
}

function slotBadgeStyle(status: string) {
  if (status === "reserved") return styles.badgeReserved;
  if (status === "cancelled") return styles.badgeCancelled;
  return styles.badge;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSlotDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPhone(phone?: string | null) {
  if (!phone) return "-";
  const digits = String(phone).replace(/\D/g, "");
  return digits.startsWith("55") ? `+${digits}` : phone;
}

function whatsappLink(phone?: string | null, name?: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "#";

  const text = encodeURIComponent(
    `Olá ${name || ""}, tudo bem? Vi sua resposta sobre a vaga e quero confirmar sua entrevista.`
  );

  return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}?text=${text}`;
}

function agendaLink(token?: string | null) {
  if (!token) return "";
  if (typeof window === "undefined") return `/agenda/${token}`;
  return `${window.location.origin}/agenda/${token}`;
}

export default function InterviewsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [whatsappLeads, setWhatsappLeads] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingSlots, setGeneratingSlots] = useState(false);

  const [filters, setFilters] = useState({
    q: "",
    status: "all",
  });

  const [slotFilters, setSlotFilters] = useState({
    status: "all",
  });

  const [availabilityForm, setAvailabilityForm] = useState({
    mode: "range",
    jobId: "",
    title: "",
    date: todayDate(),
    startTime: "09:00",
    endTime: "17:00",
    duration: "30",
    location: "",
    meetingUrl: "",
    recruiterName: "",
    recruiterPhone: "",
    notes: "",
  });

  const [form, setForm] = useState({
    candidate_name: "",
    job_title: "",
    phone: "",
    email: "",
    scheduled_at: todayInput(),
    status: "scheduled",
    notes: "",
  });

  async function loadAll() {
    await Promise.all([loadInterviews(), loadSlots(), loadWhatsappLeads(), loadJobs()]);
  }

  async function loadJobs() {
    try {
      const res = await fetch("/api/rh/jobs", {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setJobs(data.jobs || data || []);
      }
    } catch (error) {
      console.error("Erro ao carregar vagas:", error);
    }
  }

  async function loadInterviews() {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.status !== "all") params.set("status", filters.status);

      const res = await fetch(`/api/rh/interviews?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setItems(data.interviews || []);
      } else {
        alert(data.error || "Erro ao carregar entrevistas.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadSlots() {
    try {
      setLoadingSlots(true);

      const params = new URLSearchParams();
      if (slotFilters.status !== "all") params.set("status", slotFilters.status);

      const res = await fetch(`/api/rh/interviews/availability?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setSlots(data.slots || []);
      } else {
        alert(data.error || "Erro ao carregar horários.");
      }
    } finally {
      setLoadingSlots(false);
    }
  }

  async function loadWhatsappLeads() {
    const statuses = ["quer_agendar_entrevista", "entrevista_agendada"];
    const all: any[] = [];

    for (const status of statuses) {
      const params = new URLSearchParams();
      params.set("status", status);
      params.set("limit", "200");

      const res = await fetch(`/api/crm/leads?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        all.push(...(data.leads || data || []));
      }
    }

    const unique = Array.from(new Map(all.map((lead) => [lead.id, lead])).values());
    setWhatsappLeads(unique);
  }

  useEffect(() => {
    loadAll();

    const interval = setInterval(() => {
      loadSlots();
      loadWhatsappLeads();
    }, 10000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    return {
      total: items.length,
      today: items.filter((item) =>
        String(item.scheduledAt || item.scheduled_at || "").slice(0, 10) === today
      ).length,
      confirmed: items.filter((item) => item.status === "confirmed").length,
      approved: items.filter((item) => item.status === "approved").length,
      hired: items.filter((item) => item.status === "hired").length,
      availableSlots: slots.filter((item) => item.status === "available").length,
      reservedSlots: slots.filter((item) => item.status === "reserved").length,
      whatsapp: whatsappLeads.length,
    };
  }, [items, slots, whatsappLeads]);

  async function generateSlots() {
    setGeneratingSlots(true);

    try {
      const res = await fetch("/api/rh/interviews/availability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(availabilityForm),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao gerar horários.");
        return;
      }

      await loadSlots();
      alert(`${data.created || 0} horário(s) criado(s).`);
    } finally {
      setGeneratingSlots(false);
    }
  }

  async function copySlotLink(slot: any) {
    const link = agendaLink(slot.token);

    if (!link) {
      alert("Este horário ainda não possui link.");
      return;
    }

    await navigator.clipboard.writeText(link);
    alert("Link da agenda copiado.");
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

  function toggleSlot(slotId: string) {
    setSelectedSlots((current) =>
      current.includes(slotId)
        ? current.filter((id) => id !== slotId)
        : [...current, slotId]
    );
  }

  function selectAllVisibleSlots() {
    setSelectedSlots(slots.map((slot) => slot.id));
  }

  function clearSelectedSlots() {
    setSelectedSlots([]);
  }

  async function deleteSelectedSlots() {
    if (!selectedSlots.length) {
      alert("Selecione pelo menos um horário.");
      return;
    }

    if (!confirm(`Excluir ${selectedSlots.length} horário(s) selecionado(s)?`)) return;

    const results = await Promise.all(
      selectedSlots.map(async (id) => {
        const res = await fetch(`/api/rh/interviews/availability?id=${id}&hard=1`, {
          method: "DELETE",
          credentials: "include",
        });

        return res.ok;
      })
    );

    const deleted = results.filter(Boolean).length;

    setSelectedSlots([]);
    await loadSlots();

    alert(`${deleted} horário(s) excluído(s).`);
  }


  async function syncLeadFromSlot(slot: any, status: string) {
    const kanbanStatusMap: Record<string, string> = {
      confirmed: "entrevista_confirmada",
      approved: "aprovado",
      rejected: "nao_aprovado",
      no_show: "nao_compareceu",
    };

    const leadStatus = kanbanStatusMap[status];
    if (!leadStatus) return;

    try {
      if (slot.lead_id) {
        await fetch("/api/crm/leads/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            id: slot.lead_id,
            status: leadStatus,
          }),
        });
        return;
      }

      await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: slot.reserved_name || "Candidato",
          phone: slot.reserved_phone || "",
          email: slot.reserved_email || "",
          status: leadStatus,
          source: "agenda_entrevista",
          job_id: slot.job_id || null,
          job_title: slot.title || "Entrevista",
          notes: `Criado automaticamente pela agenda de entrevistas. Slot: ${slot.id}`,
        }),
      });
    } catch (error) {
      console.error("Não foi possível sincronizar lead/kanban:", error);
    }
  }

  async function createHiringFromSlot(slot: any) {
    try {
      const res = await fetch("/api/rh/hirings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          candidate_name: slot.reserved_name || "Candidato",
          name: slot.reserved_name || "Candidato",
          job_title: slot.title || "Entrevista",
          position: slot.title || "Entrevista",
          phone: slot.reserved_phone || "",
          email: slot.reserved_email || "",
          jobId: slot.job_id || null,
          job_id: slot.job_id || null,
          salary: "",
          contractType: "CLT",
          contract_type: "CLT",
          status: "pending_documents",
          notes: `Admissão criada automaticamente a partir da agenda de entrevistas. Slot: ${slot.id}`,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("HIRING CREATE ERROR:", data);
        alert(
          data.error ||
            "Candidato aprovado, mas não foi possível criar a admissão automática."
        );
      }
    } catch (error) {
      console.error("Não foi possível criar admissão:", error);
      alert("Candidato aprovado, mas ocorreu erro ao criar a admissão.");
    }
  }

  async function updateSlotOutcome(slot: any, status: string) {
    const labels: Record<string, string> = {
      confirmed: "confirmar presença",
      approved: "aprovar candidato",
      rejected: "reprovar candidato",
      no_show: "marcar como não compareceu",
    };

    if (!confirm(`Deseja ${labels[status] || "atualizar"} este candidato?`)) return;

    const res = await fetch("/api/rh/interviews/availability", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        id: slot.id,
        status,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao atualizar horário.");
      return;
    }

    await syncLeadFromSlot(slot, status);

    if (status === "approved") {
      await createHiringFromSlot(slot);
    }

    await Promise.all([loadSlots(), loadInterviews(), loadWhatsappLeads()]);
  }

  async function rescheduleSlot(slot: any) {
    const ok = confirm(
      "Remarcar libera este horário e permite enviar outro link de agenda ao candidato. Deseja continuar?"
    );

    if (!ok) return;

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
      alert(data.error || "Erro ao remarcar.");
      return;
    }

    await loadSlots();
    alert("Horário liberado para reagendamento.");
  }

  async function createInterview(payload = form) {
    if (!payload.candidate_name.trim()) {
      alert("Informe o candidato.");
      return false;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/rh/interviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao criar entrevista.");
        return false;
      }

      setForm({
        candidate_name: "",
        job_title: "",
        phone: "",
        email: "",
        scheduled_at: todayInput(),
        status: "scheduled",
        notes: "",
      });

      await loadInterviews();
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function scheduleFromWhatsappLead(lead: any) {
    const firstAvailable = slots.find((slot) => slot.status === "available");

    if (firstAvailable?.token) {
      await navigator.clipboard.writeText(agendaLink(firstAvailable.token));
      alert(
        "Link da agenda copiado. Envie para o candidato no WhatsApp para ele escolher o horário."
      );
      return;
    }

    alert("Crie pelo menos um horário disponível antes de enviar a agenda.");
  }

  async function updateInterview(item: any, patch: any) {
    const res = await fetch("/api/rh/interviews", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        id: item.id,
        ...patch,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao atualizar entrevista.");
      return;
    }

    await loadInterviews();
  }

  async function deleteInterview(item: any) {
    const candidateName = item.candidate_name || item.candidate?.name || "candidato";

    if (!confirm(`Excluir entrevista de ${candidateName}?`)) return;

    const res = await fetch(`/api/rh/interviews?id=${item.id}`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao excluir entrevista.");
      return;
    }

    await loadInterviews();
  }

  async function hireCandidate(item: any) {
    const candidateName = item.candidate_name || item.candidate?.name;

    if (!confirm(`Enviar ${candidateName} para Contratações?`)) return;

    const res = await fetch("/api/rh/hirings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        candidate_name: candidateName,
        job_title: item.job_title || item.job?.title,
        phone: item.phone || item.candidate?.phone || item.candidate?.mobile,
        email: item.email || item.candidate?.email,
        notes: `Contratado a partir da entrevista ${item.id}`,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao contratar candidato.");
      return;
    }

    await updateInterview(item, { status: "hired" });
    alert("Candidato enviado para Contratações.");
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.kicker}>Zentra RH</p>
          <h1 style={styles.title}>Entrevistas</h1>
          <p style={styles.subtitle}>
            Gere horários, envie link de agenda, bloqueie slots automaticamente e acompanhe as entrevistas.
          </p>
        </div>

        <button style={styles.primaryButton} onClick={loadAll}>
          Atualizar
        </button>
      </section>

      <section style={styles.statsGrid}>
        <Metric label="Entrevistas" value={stats.total} />
        <Metric label="Hoje" value={stats.today} />
        <Metric label="Confirmadas" value={stats.confirmed} />
        <Metric label="Slots disponíveis" value={stats.availableSlots} />
        <Metric label="Slots reservados" value={stats.reservedSlots} />
        <Metric label="WhatsApp aguardando" value={stats.whatsapp} />
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Gerar horários disponíveis</h2>
        <p style={styles.smallText}>
          Crie a agenda do dia. O candidato recebe o link, escolhe um horário e o sistema bloqueia o slot.
        </p>

        <div style={styles.formGrid}>
          <select
            style={styles.input}
            value={availabilityForm.jobId}
            onChange={(e) => {
              const job = jobs.find((item) => String(item.id) === e.target.value);
              setAvailabilityForm({
                ...availabilityForm,
                jobId: e.target.value,
                title: job?.title || job?.name || availabilityForm.title,
              });
            }}
          >
            <option value="">Selecionar vaga criada</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title || job.name || "Vaga sem título"} {job.city ? `- ${job.city}` : ""}
              </option>
            ))}
          </select>

          <input
            style={styles.input}
            placeholder="Título da vaga para exibir ao candidato"
            value={availabilityForm.title}
            onChange={(e) =>
              setAvailabilityForm({ ...availabilityForm, title: e.target.value })
            }
          />

          <input
            type="date"
            style={styles.input}
            value={availabilityForm.date}
            onChange={(e) =>
              setAvailabilityForm({ ...availabilityForm, date: e.target.value })
            }
          />

          <input
            type="time"
            style={styles.input}
            value={availabilityForm.startTime}
            onChange={(e) =>
              setAvailabilityForm({
                ...availabilityForm,
                startTime: e.target.value,
              })
            }
          />

          <input
            type="time"
            style={styles.input}
            value={availabilityForm.endTime}
            onChange={(e) =>
              setAvailabilityForm({ ...availabilityForm, endTime: e.target.value })
            }
          />

          <select
            style={styles.input}
            value={availabilityForm.duration}
            onChange={(e) =>
              setAvailabilityForm({ ...availabilityForm, duration: e.target.value })
            }
          >
            <option value="15">15 minutos</option>
            <option value="30">30 minutos</option>
            <option value="45">45 minutos</option>
            <option value="60">60 minutos</option>
          </select>

          <input
            style={styles.input}
            placeholder="Local presencial"
            value={availabilityForm.location}
            onChange={(e) =>
              setAvailabilityForm({ ...availabilityForm, location: e.target.value })
            }
          />

          <input
            style={styles.input}
            placeholder="Link Google Meet/Teams"
            value={availabilityForm.meetingUrl}
            onChange={(e) =>
              setAvailabilityForm({
                ...availabilityForm,
                meetingUrl: e.target.value,
              })
            }
          />

          <input
            style={styles.input}
            placeholder="Recrutador responsável"
            value={availabilityForm.recruiterName}
            onChange={(e) =>
              setAvailabilityForm({
                ...availabilityForm,
                recruiterName: e.target.value,
              })
            }
          />

          <input
            style={styles.input}
            placeholder="WhatsApp do recrutador"
            value={availabilityForm.recruiterPhone}
            onChange={(e) =>
              setAvailabilityForm({
                ...availabilityForm,
                recruiterPhone: e.target.value,
              })
            }
          />

          <textarea
            style={{ ...styles.input, gridColumn: "1 / -1", minHeight: 88 }}
            placeholder="Observações internas"
            value={availabilityForm.notes}
            onChange={(e) =>
              setAvailabilityForm({ ...availabilityForm, notes: e.target.value })
            }
          />
        </div>

        <button
          style={styles.primaryButton}
          onClick={generateSlots}
          disabled={generatingSlots}
        >
          {generatingSlots ? "Gerando..." : "Gerar horários"}
        </button>
      </section>

      <section style={styles.card}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.sectionTitle}>Horários disponíveis e reservados</h2>
            <p style={styles.smallText}>
              Copie o link de um horário disponível e envie para o candidato escolher na agenda pública.
            </p>
          </div>

          <div style={styles.filtersInline}>
            <select
              style={styles.inputSmall}
              value={slotFilters.status}
              onChange={(e) =>
                setSlotFilters({ ...slotFilters, status: e.target.value })
              }
            >
              {SLOT_STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>

            <button style={styles.secondaryButton} onClick={loadSlots}>
              Filtrar
            </button>
          </div>
        </div>

        {loadingSlots && <p style={styles.smallText}>Carregando horários...</p>}

        {!loadingSlots && !slots.length && (
          <div style={styles.empty}>Nenhum horário criado ainda.</div>
        )}


        {!!slots.length && (
          <div style={styles.bulkActions}>
            <label style={styles.checkLabel}>
              <input
                type="checkbox"
                checked={selectedSlots.length > 0 && selectedSlots.length === slots.length}
                onChange={(e) =>
                  e.target.checked ? selectAllVisibleSlots() : clearSelectedSlots()
                }
              />
              Selecionar todos
            </label>

            <button style={styles.secondaryButton} onClick={clearSelectedSlots}>
              Limpar seleção
            </button>

            <button
              style={styles.dangerButton}
              onClick={deleteSelectedSlots}
              disabled={!selectedSlots.length}
            >
              Excluir selecionados ({selectedSlots.length})
            </button>
          </div>
        )}

        <div style={styles.slotGrid}>
          {slots.map((slot) => (
            <article
              key={slot.id}
              style={{
                ...styles.slotCard,
                ...(selectedSlots.includes(slot.id) ? styles.slotCardSelected : {}),
              }}
            >
              <div style={styles.cardTop}>
                <label style={styles.slotCheckbox}>
                  <input
                    type="checkbox"
                    checked={selectedSlots.includes(slot.id)}
                    onChange={() => toggleSlot(slot.id)}
                  />
                  <span>Selecionar</span>
                </label>

                <span style={slotBadgeStyle(slot.status)}>
                  {slotStatusLabel(slot.status)}
                </span>
              </div>

              <div>
                <strong>{slot.title || "Entrevista"}</strong>
                <p>{formatSlotDate(slot.start_at)}</p>
              </div>

              {slot.reserved_name && (
                <div style={styles.reservedBox}>
                  <b>{slot.reserved_name}</b>
                  <span>{formatPhone(slot.reserved_phone)}</span>
                  <span>{slot.reserved_email || "-"}</span>
                </div>
              )}

              <div style={styles.infoGrid}>
                {slot.meeting_url && <span>Meet/Teams: {slot.meeting_url}</span>}
                {slot.location && <span>Local: {slot.location}</span>}
                {slot.recruiter_name && <span>Recrutador: {slot.recruiter_name}</span>}
                {slot.recruiter_phone && (
                  <span>WhatsApp recrutador: {formatPhone(slot.recruiter_phone)}</span>
                )}
              </div>

              <div style={styles.actions}>
                {slot.status === "available" && (
                  <button
                    style={styles.primarySmallButton}
                    onClick={() => copySlotLink(slot)}
                  >
                    Copiar Link
                  </button>
                )}

                <a
                  style={styles.secondaryButton}
                  href={`/agenda/${slot.token}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir
                </a>

                {["reserved", "confirmed", "done"].includes(slot.status) && (
                  <>
                    <button
                      style={styles.successButton}
                      onClick={() => updateSlotOutcome(slot, "confirmed")}
                    >
                      Confirmou
                    </button>

                    <button
                      style={styles.successButton}
                      onClick={() => updateSlotOutcome(slot, "approved")}
                    >
                      Aprovado
                    </button>

                    <button
                      style={styles.dangerButton}
                      onClick={() => updateSlotOutcome(slot, "rejected")}
                    >
                      Reprovado
                    </button>

                    <button
                      style={styles.warningButton}
                      onClick={() => updateSlotOutcome(slot, "no_show")}
                    >
                      Não participou
                    </button>

                    <button
                      style={styles.secondaryButton}
                      onClick={() => rescheduleSlot(slot)}
                    >
                      Remarcar
                    </button>
                  </>
                )}

                <button
                  style={styles.dangerButton}
                  disabled={slot.status === "cancelled"}
                  onClick={() => cancelSlot(slot)}
                >
                  Cancelar
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Candidatos vindos do WhatsApp</h2>
        <p style={styles.smallText}>
          Aqui aparecem contatos com status "Quer agendar entrevista" ou "Agendou entrevista".
        </p>

        {!whatsappLeads.length && (
          <div style={styles.empty}>
            Nenhum candidato do WhatsApp aguardando entrevista.
          </div>
        )}

        <div style={styles.cardsGrid}>
          {whatsappLeads.map((lead) => (
            <article key={lead.id} style={styles.interviewCard}>
              <div style={styles.cardTop}>
                <div>
                  <strong>{lead.name || "Candidato WhatsApp"}</strong>
                  <p>{formatPhone(lead.phone)}</p>
                </div>

                <span style={styles.badge}>
                  {lead.status === "entrevista_agendada"
                    ? "Agendou entrevista"
                    : "Quer agendar"}
                </span>
              </div>

              {lead.last_message && (
                <p style={styles.note}>
                  <b>Última resposta:</b> {lead.last_message}
                </p>
              )}

              <div style={styles.actions}>
                <a
                  style={styles.successButton}
                  href={whatsappLink(lead.phone, lead.name)}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>

                <button
                  style={styles.primarySmallButton}
                  onClick={() => scheduleFromWhatsappLead(lead)}
                >
                  Copiar link da agenda
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Nova entrevista manual</h2>

        <div style={styles.formGrid}>
          <input
            style={styles.input}
            placeholder="Nome do candidato"
            value={form.candidate_name}
            onChange={(e) => setForm({ ...form, candidate_name: e.target.value })}
          />

          <input
            style={styles.input}
            placeholder="Vaga"
            value={form.job_title}
            onChange={(e) => setForm({ ...form, job_title: e.target.value })}
          />

          <input
            style={styles.input}
            placeholder="Telefone / WhatsApp"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />

          <input
            style={styles.input}
            placeholder="E-mail"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <input
            type="datetime-local"
            style={styles.input}
            value={form.scheduled_at}
            onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
          />

          <select
            style={styles.input}
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            {INTERVIEW_STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>

          <textarea
            style={{ ...styles.input, gridColumn: "1 / -1", minHeight: 90 }}
            placeholder="Observações"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>

        <button
          style={styles.primaryButton}
          onClick={() => createInterview()}
          disabled={saving}
        >
          {saving ? "Salvando..." : "Salvar entrevista"}
        </button>
      </section>

      <section style={styles.card}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.sectionTitle}>Agenda RH</h2>
            <p style={styles.smallText}>Lista das entrevistas criadas manualmente ou pela agenda pública.</p>
          </div>
        </div>

        <div style={styles.filters}>
          <input
            style={styles.input}
            placeholder="Buscar candidato, vaga, telefone..."
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          />

          <select
            style={styles.input}
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="all">Todos os status</option>
            {INTERVIEW_STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>

          <button style={styles.secondaryButton} onClick={loadInterviews}>
            Filtrar
          </button>
        </div>

        {loading && <p style={styles.smallText}>Carregando entrevistas...</p>}

        {!loading && items.length === 0 && (
          <div style={styles.empty}>Nenhuma entrevista encontrada.</div>
        )}

        <div style={styles.cardsGrid}>
          {items.map((item) => {
            const candidateName =
              item.candidate_name || item.candidate?.name || "Candidato";
            const jobTitle = item.job_title || item.job?.title || "Sem vaga informada";
            const phone =
              item.phone || item.candidate?.phone || item.candidate?.mobile;
            const email = item.email || item.candidate?.email;
            const scheduledAt = item.scheduledAt || item.scheduled_at;

            return (
              <article key={item.id} style={styles.interviewCard}>
                <div style={styles.cardTop}>
                  <div>
                    <strong>{candidateName}</strong>
                    <p>{jobTitle}</p>
                  </div>

                  <span style={styles.badge}>{statusLabel(item.status)}</span>
                </div>

                <div style={styles.infoGrid}>
                  <span><b>Data:</b> {formatDateTime(scheduledAt)}</span>
                  <span><b>Telefone:</b> {formatPhone(phone)}</span>
                  <span><b>E-mail:</b> {email || "-"}</span>
                </div>

                {item.notes && <p style={styles.note}>{item.notes}</p>}

                <div style={styles.actions}>
                  <a
                    style={styles.secondaryButton}
                    href={whatsappLink(phone, candidateName)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </a>

                  <select
                    style={styles.smallSelect}
                    value={item.status}
                    onChange={(e) => updateInterview(item, { status: e.target.value })}
                  >
                    {INTERVIEW_STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>

                  <button
                    style={styles.primarySmallButton}
                    onClick={() => updateInterview(item, { status: "confirmed" })}
                  >
                    Confirmar
                  </button>

                  <button
                    style={styles.secondaryButton}
                    onClick={() => updateInterview(item, { status: "approved" })}
                  >
                    Aprovar
                  </button>

                  <button
                    style={styles.dangerButton}
                    onClick={() => updateInterview(item, { status: "rejected" })}
                  >
                    Reprovar
                  </button>

                  <button
                    style={styles.successButton}
                    onClick={() => hireCandidate(item)}
                  >
                    Contratar
                  </button>

                  <button
                    style={styles.dangerGhostButton}
                    onClick={() => deleteInterview(item)}
                  >
                    Excluir
                  </button>
                </div>
              </article>
            );
          })}
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
    fontSize: 36,
    fontWeight: 950,
  },
  subtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: 14,
    maxWidth: 720,
  },
  primaryButton: {
    border: 0,
    borderRadius: 16,
    padding: "13px 18px",
    background: "linear-gradient(135deg, #38bdf8, #2563eb)",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(37,99,235,.20)",
  },
  statsGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
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
  card: {
    marginTop: 18,
    background: "#fff",
    border: "1px solid #bfdbfe",
    borderRadius: 28,
    padding: 22,
    boxShadow: "0 18px 50px rgba(37,99,235,.06)",
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
  formGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 12,
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
  inputSmall: {
    borderRadius: 14,
    border: "1px solid #bfdbfe",
    background: "#f8fafc",
    padding: "10px 12px",
    outline: "none",
    fontSize: 14,
    color: "#0f172a",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  filters: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 12,
  },
  filtersInline: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  secondaryButton: {
    border: "1px solid #bfdbfe",
    borderRadius: 14,
    padding: "10px 12px",
    background: "#fff",
    color: "#2563eb",
    fontWeight: 900,
    cursor: "pointer",
    textDecoration: "none",
    textAlign: "center",
  },
  empty: {
    marginTop: 16,
    border: "1px dashed #93c5fd",
    borderRadius: 20,
    padding: 24,
    textAlign: "center",
    color: "#64748b",
  },
  slotGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 14,
  },
  cardsGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
    gap: 14,
  },
  slotCard: {
    border: "1px solid #dbeafe",
    background: "#f8fafc",
    borderRadius: 22,
    padding: 16,
    display: "grid",
    gap: 12,
  },
  slotCardSelected: {
    border: "1px solid #2563eb",
    background: "#eff6ff",
    boxShadow: "0 14px 34px rgba(37,99,235,.12)",
  },
  bulkActions: {
    marginTop: 16,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  checkLabel: {
    border: "1px solid #bfdbfe",
    borderRadius: 14,
    padding: "10px 12px",
    background: "#fff",
    color: "#2563eb",
    fontWeight: 900,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  slotCheckbox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 900,
  },
  interviewCard: {
    border: "1px solid #dbeafe",
    background: "#f8fafc",
    borderRadius: 22,
    padding: 16,
    display: "grid",
    gap: 12,
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
  },
  badge: {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  badgeReserved: {
    border: "1px solid #fed7aa",
    background: "#fff7ed",
    color: "#c2410c",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  badgeCancelled: {
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#dc2626",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  reservedBox: {
    border: "1px solid #fed7aa",
    background: "#fff7ed",
    borderRadius: 14,
    padding: 12,
    display: "grid",
    gap: 4,
    color: "#9a3412",
    fontSize: 13,
  },
  infoGrid: {
    display: "grid",
    gap: 6,
    color: "#475569",
    fontSize: 13,
  },
  note: {
    border: "1px solid #dbeafe",
    background: "#fff",
    borderRadius: 14,
    padding: 12,
    color: "#475569",
    fontSize: 13,
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  smallSelect: {
    border: "1px solid #bfdbfe",
    borderRadius: 14,
    padding: "10px 12px",
    background: "#fff",
    color: "#0f172a",
    fontWeight: 800,
  },
  primarySmallButton: {
    border: 0,
    borderRadius: 14,
    padding: "10px 12px",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  warningButton: {
    border: 0,
    borderRadius: 14,
    padding: "10px 12px",
    background: "#f97316",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  dangerButton: {
    border: 0,
    borderRadius: 14,
    padding: "10px 12px",
    background: "#ef4444",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  successButton: {
    border: 0,
    borderRadius: 14,
    padding: "10px 12px",
    background: "#16a34a",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    textDecoration: "none",
    textAlign: "center",
  },
  dangerGhostButton: {
    border: "1px solid #fecaca",
    borderRadius: 14,
    padding: "10px 12px",
    background: "#fff",
    color: "#dc2626",
    fontWeight: 900,
    cursor: "pointer",
  },
};
