"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function groupByDay(slots: any[]) {
  return slots.reduce((acc: Record<string, any[]>, slot) => {
    const date = new Date(slot.start_at);
    const key = date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
    });

    acc[key] = acc[key] || [];
    acc[key].push(slot);

    return acc;
  }, {});
}

export default function PublicAgendaPage() {
  const params = useParams();
  const token = String(params.token || "");

  const [slots, setSlots] = useState<any[]>([]);
  const [baseSlot, setBaseSlot] = useState<any>(null);
  const [lead, setLead] = useState<any>(null);
  const [selectedToken, setSelectedToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [requiresCandidateData, setRequiresCandidateData] = useState(false);
  const [candidateForm, setCandidateForm] = useState({
    name: "",
    phone: "",
    email: "",
  });

  async function loadAgenda() {
    try {
      setLoading(true);
      setErrorMessage("");

      const res = await fetch(`/api/rh/interviews/book?token=${token}`, {
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMessage(data.error || "Agenda não encontrada.");
        return;
      }

      setBaseSlot(data.baseSlot || null);
      setLead(data.lead || null);
      setRequiresCandidateData(Boolean(data.requiresCandidateData));
      setSlots(data.slots || []);

      const firstAvailable = (data.slots || [])[0];
      if (firstAvailable?.token) {
        setSelectedToken(firstAvailable.token);
      }
    } catch {
      setErrorMessage("Erro ao carregar agenda.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) loadAgenda();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const grouped = useMemo(() => groupByDay(slots), [slots]);

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.token === selectedToken) || null,
    [slots, selectedToken]
  );

  async function book() {
    if (!selectedToken) {
      alert("Escolha um horário.");
      return;
    }

    if (requiresCandidateData && !lead?.id) {
      const hasPhoneOrEmail = candidateForm.phone.trim() || candidateForm.email.trim();

      if (!candidateForm.name.trim()) {
        alert("Informe seu nome para confirmar o horário.");
        return;
      }

      if (!hasPhoneOrEmail) {
        alert("Informe seu WhatsApp ou e-mail para identificarmos seu cadastro.");
        return;
      }
    }

    setBooking(true);

    try {
      const res = await fetch("/api/rh/interviews/book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedToken,
          contextToken: token,
          leadId: lead?.id || baseSlot?.lead_id || null,
          name: candidateForm.name,
          phone: candidateForm.phone,
          email: candidateForm.email,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao reservar horário.");
        await loadAgenda();
        return;
      }

      setDone(true);
    } finally {
      setBooking(false);
    }
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <section style={styles.successCard}>
          <h1 style={styles.title}>Carregando agenda...</h1>
          <p style={styles.subtitle}>Aguarde alguns segundos.</p>
        </section>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main style={styles.page}>
        <section style={styles.successCard}>
          <div style={styles.errorIcon}>!</div>
          <h1 style={styles.title}>Agenda indisponível</h1>
          <p style={styles.subtitle}>{errorMessage}</p>
          <p style={styles.helpText}>
            Solicite ao recrutador um novo link de agendamento pelo WhatsApp.
          </p>
        </section>
      </main>
    );
  }

  if (done) {
    return (
      <main style={styles.page}>
        <section style={styles.successCard}>
          <div style={styles.successIcon}>✓</div>
          <h1 style={styles.title}>Entrevista agendada</h1>
          <p style={styles.subtitle}>
            Seu horário foi reservado com sucesso. Você receberá a confirmação pelo WhatsApp.
          </p>

          <div style={styles.warningBox}>
            <strong>⚠️ IMPORTANTE:</strong> após concluir o agendamento, não responda esta mensagem no WhatsApp. Caso precise reagendar ou cancelar, utilize o mesmo link de agendamento.
          </div>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <p style={styles.kicker}>Zentra RH</p>
        <h1 style={styles.title}>Escolha seu horário de entrevista</h1>
        <p style={styles.subtitle}>
          {baseSlot?.title || "Entrevista"}{" "}
          {baseSlot?.location ? `• ${baseSlot.location}` : ""}
        </p>

        {lead?.name && (
          <div style={styles.leadBox}>
            Olá, <strong>{lead.name}</strong>. Escolha abaixo o melhor dia e horário para sua entrevista.
          </div>
        )}
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Horários disponíveis</h2>

        {!slots.length && (
          <div style={styles.empty}>
            Nenhum horário disponível no momento. Solicite novos horários ao recrutador.
          </div>
        )}

        <div style={styles.days}>
          {Object.entries(grouped as Record<string, any[]>).map(([day, daySlots]) => (
            <div key={day} style={styles.dayBlock}>
              <h3 style={styles.dayTitle}>{day}</h3>

              <div style={styles.slotGrid}>
                {daySlots.map((slot: any) => (
                  <button
                    key={slot.token}
                    type="button"
                    style={
                      selectedToken === slot.token
                        ? { ...styles.slotButton, ...styles.slotButtonActive }
                        : styles.slotButton
                    }
                    onClick={() => setSelectedToken(slot.token)}
                  >
                    {formatTime(slot.start_at)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {requiresCandidateData && !lead?.id && (
          <div style={styles.candidateBox}>
            <strong>Identificação do candidato</strong>
            <p style={styles.candidateHelp}>
              Esta agenda é compartilhada. Informe seus dados para confirmarmos o horário no seu cadastro.
            </p>

            <div style={styles.candidateGrid}>
              <input
                style={styles.input}
                placeholder="Seu nome"
                value={candidateForm.name}
                onChange={(event) =>
                  setCandidateForm({ ...candidateForm, name: event.target.value })
                }
              />

              <input
                style={styles.input}
                placeholder="WhatsApp com DDD"
                value={candidateForm.phone}
                onChange={(event) =>
                  setCandidateForm({ ...candidateForm, phone: event.target.value })
                }
              />

              <input
                style={styles.input}
                placeholder="E-mail"
                value={candidateForm.email}
                onChange={(event) =>
                  setCandidateForm({ ...candidateForm, email: event.target.value })
                }
              />
            </div>
          </div>
        )}

        {selectedSlot && (
          <div style={styles.selectedBox}>
            Horário selecionado: <strong>{formatDate(selectedSlot.start_at)}</strong>
          </div>
        )}

        <button
          style={{
            ...styles.primaryButton,
            ...(booking || !selectedToken ? styles.primaryButtonDisabled : {}),
          }}
          onClick={book}
          disabled={booking || !selectedToken}
        >
          {booking ? "Reservando..." : "Confirmar horário"}
        </button>

        <div style={styles.warningBox}>
          <strong>⚠️ Atenção:</strong> depois de confirmar, não responda a mensagem automática no WhatsApp para evitar reiniciar o atendimento. Para reagendar ou cancelar, use este mesmo link.
        </div>
      </section>
    </main>
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
    maxWidth: 860,
    margin: "0 auto",
    background: "#fff",
    border: "1px solid #bfdbfe",
    borderRadius: 30,
    padding: 28,
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
  },
  subtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: 15,
    lineHeight: 1.6,
  },
  leadBox: {
    marginTop: 18,
    border: "1px solid #dbeafe",
    background: "#f8fafc",
    borderRadius: 20,
    padding: 16,
    color: "#334155",
    fontSize: 14,
    lineHeight: 1.6,
  },
  card: {
    maxWidth: 860,
    margin: "18px auto 0",
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
  empty: {
    marginTop: 16,
    border: "1px dashed #93c5fd",
    borderRadius: 20,
    padding: 24,
    textAlign: "center",
    color: "#64748b",
  },
  days: {
    marginTop: 16,
    display: "grid",
    gap: 18,
  },
  dayBlock: {
    border: "1px solid #dbeafe",
    background: "#f8fafc",
    borderRadius: 22,
    padding: 16,
  },
  dayTitle: {
    margin: "0 0 12px",
    color: "#1e3a8a",
    textTransform: "capitalize",
  },
  slotGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
    gap: 10,
  },
  slotButton: {
    border: "1px solid #bfdbfe",
    background: "#fff",
    color: "#2563eb",
    borderRadius: 16,
    padding: "13px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  slotButtonActive: {
    background: "linear-gradient(135deg, #38bdf8, #2563eb)",
    color: "#fff",
    borderColor: "#2563eb",
  },
  selectedBox: {
    marginTop: 18,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1e3a8a",
    borderRadius: 18,
    padding: 14,
    fontSize: 14,
  },
  candidateBox: {
    marginTop: 18,
    border: "1px solid #bfdbfe",
    background: "#f8fafc",
    borderRadius: 20,
    padding: 16,
    color: "#334155",
  },
  candidateHelp: {
    margin: "6px 0 14px",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.5,
  },
  candidateGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  },
  input: {
    width: "100%",
    border: "1px solid #bfdbfe",
    background: "#fff",
    borderRadius: 16,
    padding: "13px 14px",
    color: "#0f172a",
    outline: "none",
    fontSize: 14,
    boxSizing: "border-box",
  },
  primaryButton: {
    marginTop: 18,
    width: "100%",
    border: 0,
    borderRadius: 18,
    padding: "15px 18px",
    background: "linear-gradient(135deg, #38bdf8, #2563eb)",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 15,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  warningBox: {
    marginTop: 16,
    border: "1px solid #fde68a",
    background: "#fffbeb",
    color: "#92400e",
    borderRadius: 18,
    padding: 14,
    fontSize: 13,
    lineHeight: 1.6,
  },
  successCard: {
    maxWidth: 620,
    margin: "80px auto 0",
    textAlign: "center",
    background: "#fff",
    border: "1px solid #bfdbfe",
    borderRadius: 30,
    padding: 32,
    boxShadow: "0 18px 50px rgba(37,99,235,.08)",
  },
  successIcon: {
    width: 70,
    height: 70,
    margin: "0 auto 16px",
    borderRadius: 24,
    display: "grid",
    placeItems: "center",
    background: "#dcfce7",
    color: "#16a34a",
    fontSize: 34,
    fontWeight: 950,
  },
  errorIcon: {
    width: 70,
    height: 70,
    margin: "0 auto 16px",
    borderRadius: 24,
    display: "grid",
    placeItems: "center",
    background: "#fee2e2",
    color: "#dc2626",
    fontSize: 34,
    fontWeight: 950,
  },
  helpText: {
    marginTop: 16,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.6,
  },
};
