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

export default function SharedAgendaPage() {
  const params = useParams();
  const token = String(params.token || "");

  const [slots, setSlots] = useState<any[]>([]);
  const [baseSlot, setBaseSlot] = useState<any>(null);
  const [selectedToken, setSelectedToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [candidateForm, setCandidateForm] = useState({
    name: "",
    phone: "",
    email: "",
  });

  async function loadAgenda() {
    try {
      setLoading(true);
      setErrorMessage("");

      const res = await fetch(`/api/rh/interviews/shared/book?token=${token}`, {
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMessage(data.error || "Agenda compartilhada não encontrada.");
        return;
      }

      setBaseSlot(data.baseSlot || null);
      setSlots(data.slots || []);

      const firstAvailable = (data.slots || [])[0];
      if (firstAvailable?.token) {
        setSelectedToken(firstAvailable.token);
      }
    } catch {
      setErrorMessage("Erro ao carregar agenda compartilhada.");
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

    const hasPhoneOrEmail = candidateForm.phone.trim() || candidateForm.email.trim();

    if (!candidateForm.name.trim()) {
      alert("Informe seu nome para confirmar o horário.");
      return;
    }

    if (!hasPhoneOrEmail) {
      alert("Informe seu WhatsApp ou e-mail para confirmarmos sua entrevista.");
      return;
    }

    setBooking(true);

    try {
      const res = await fetch("/api/rh/interviews/shared/book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedToken,
          contextToken: token,
          name: candidateForm.name,
          phone: candidateForm.phone,
          email: candidateForm.email,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao confirmar horário.");
        await loadAgenda();
        return;
      }

      setDone(true);
    } catch {
      alert("Erro ao confirmar horário.");
    } finally {
      setBooking(false);
    }
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>Carregando agenda compartilhada...</section>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <h1 style={styles.title}>Agenda indisponível</h1>
          <p style={styles.text}>{errorMessage}</p>
        </section>
      </main>
    );
  }

  if (done) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <div style={styles.successIcon}>✓</div>
          <h1 style={styles.title}>Entrevista confirmada!</h1>
          <p style={styles.text}>
            Seu horário foi registrado com sucesso. Você receberá a confirmação pelo WhatsApp
            informado.
          </p>

          {selectedSlot && (
            <div style={styles.confirmBox}>
              <b>{selectedSlot.title || baseSlot?.title || "Entrevista"}</b>
              <span>{formatDate(selectedSlot.start_at)}</span>
              {selectedSlot.meeting_url && <span>Link da reunião: {selectedSlot.meeting_url}</span>}
              {selectedSlot.location && <span>Local: {selectedSlot.location}</span>}
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <p style={styles.kicker}>Zentra RH</p>
        <h1 style={styles.title}>{baseSlot?.title || "Agenda compartilhada de entrevista"}</h1>
        <p style={styles.text}>
          Esta é uma agenda compartilhada. Vários candidatos podem confirmar o mesmo horário
          enquanto houver vagas disponíveis.
        </p>

        <div style={styles.formBox}>
          <h2 style={styles.sectionTitle}>Seus dados</h2>
          <input
            style={styles.input}
            placeholder="Seu nome completo"
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
            placeholder="E-mail (opcional se informar WhatsApp)"
            value={candidateForm.email}
            onChange={(event) =>
              setCandidateForm({ ...candidateForm, email: event.target.value })
            }
          />
        </div>

        <div style={styles.slotsWrapper}>
          <h2 style={styles.sectionTitle}>Escolha um horário</h2>

          {!slots.length && (
            <div style={styles.empty}>
              Nenhum horário disponível nesta agenda compartilhada.
            </div>
          )}

          {Object.entries(grouped).map(([date, items]) => {
            const daySlots = Array.isArray(items) ? items : [];

            return (
              <div key={date} style={styles.dayGroup}>
                <h3 style={styles.dayTitle}>{date}</h3>

                <div style={styles.slotGrid}>
                  {daySlots.map((slot: any) => {
                    const max = Number(slot.max_candidates || 1);
                    const count = Number(slot.reserved_count || slot.confirmed_count || 0);
                    const remaining = Math.max(0, max - count);
                    const isSelected = selectedToken === slot.token;

                    return (
                      <button
                        key={slot.id || slot.token}
                        type="button"
                        onClick={() => setSelectedToken(slot.token)}
                        style={isSelected ? styles.slotButtonActive : styles.slotButton}
                      >
                        <strong>{formatTime(slot.start_at)}</strong>
                        <span>{remaining} vaga(s) restante(s)</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {selectedSlot && (
          <div style={styles.selectedBox}>
            <b>Horário selecionado</b>
            <span>{formatDate(selectedSlot.start_at)}</span>
            {selectedSlot.meeting_url && <span>Reunião online configurada</span>}
            {selectedSlot.location && <span>{selectedSlot.location}</span>}
          </div>
        )}

        <button style={styles.primaryButton} disabled={booking || !selectedToken} onClick={book}>
          {booking ? "Confirmando..." : "Confirmar entrevista"}
        </button>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 18,
    background: "linear-gradient(135deg, #eff6ff, #ffffff, #dbeafe)",
    color: "#0f172a",
    display: "grid",
    placeItems: "center",
  },
  card: {
    width: "min(760px, 100%)",
    background: "#fff",
    border: "1px solid #bfdbfe",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 20px 60px rgba(37,99,235,.10)",
  },
  kicker: {
    margin: 0,
    color: "#2563eb",
    fontWeight: 900,
    letterSpacing: ".18em",
    textTransform: "uppercase",
    fontSize: 12,
  },
  title: { margin: "8px 0", fontSize: 30, fontWeight: 950 },
  sectionTitle: { margin: "0 0 10px", fontSize: 18, fontWeight: 900 },
  text: { color: "#64748b", fontSize: 14, lineHeight: 1.6 },
  formBox: {
    marginTop: 20,
    display: "grid",
    gap: 10,
    border: "1px solid #dbeafe",
    background: "#f8fafc",
    borderRadius: 20,
    padding: 16,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 14,
    border: "1px solid #bfdbfe",
    background: "#fff",
    padding: "13px 14px",
    outline: "none",
    fontSize: 14,
    color: "#0f172a",
  },
  slotsWrapper: { marginTop: 22, display: "grid", gap: 14 },
  dayGroup: { display: "grid", gap: 10 },
  dayTitle: { margin: 0, fontSize: 15, fontWeight: 900, color: "#1d4ed8" },
  slotGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 },
  slotButton: {
    border: "1px solid #bfdbfe",
    background: "#fff",
    color: "#0f172a",
    borderRadius: 16,
    padding: 14,
    cursor: "pointer",
    display: "grid",
    gap: 4,
    textAlign: "left",
  },
  slotButtonActive: {
    border: "1px solid #2563eb",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 16,
    padding: 14,
    cursor: "pointer",
    display: "grid",
    gap: 4,
    textAlign: "left",
    boxShadow: "0 10px 24px rgba(37,99,235,.16)",
  },
  selectedBox: {
    marginTop: 18,
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
    borderRadius: 16,
    padding: 14,
    display: "grid",
    gap: 4,
  },
  confirmBox: {
    marginTop: 18,
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
    borderRadius: 16,
    padding: 14,
    display: "grid",
    gap: 4,
  },
  empty: {
    border: "1px dashed #93c5fd",
    borderRadius: 16,
    padding: 18,
    textAlign: "center",
    color: "#64748b",
  },
  primaryButton: {
    marginTop: 20,
    width: "100%",
    border: 0,
    borderRadius: 16,
    padding: "14px 18px",
    background: "linear-gradient(135deg, #38bdf8, #2563eb)",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 14px 28px rgba(37,99,235,.22)",
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 999,
    background: "#16a34a",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    fontSize: 34,
    fontWeight: 950,
  },
};
