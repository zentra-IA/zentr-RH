"use client";

import { useEffect, useMemo, useState } from "react";

type Profile = {
  id: string;
  candidate_id?: string | null;
  full_name: string;
  cpf_normalized?: string | null;
  phone_normalized?: string | null;
  email_normalized?: string | null;
  match_status: string;
  match_method?: string | null;
  match_confidence: number;
  portal_status: string;
  push_status: string;
  push_active?: boolean;
  active_devices?: number;
  identity_confirmed_at?: string | null;
  linked_at?: string | null;
  last_access_at?: string | null;
  created_at: string;
};

type Stats = {
  total?: number;
  portal_active?: number;
  linked?: number;
  unlinked?: number;
  push_active?: number;
};

function cpfMask(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 11) return value || "-";
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

function when(value?: string | null) {
  if (!value) return "Nunca";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nunca";
  return date.toLocaleString("pt-BR");
}


async function safeCopyText(value: string) {
  const text = String(value || "");
  if (!text) return false;

  // Clipboard API moderna: pode falhar se a aba perder o foco.
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof window !== "undefined" &&
      window.isSecureContext &&
      document.hasFocus()
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Cai para o fallback abaixo.
  }

  // Fallback compatível com navegadores que bloqueiam navigator.clipboard.
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);

    return copied;
  } catch {
    return false;
  }
}

export default function CandidatePortalManager() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    cpf: "",
    phone: "",
    email: "",
  });

  async function load() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);

      const response = await fetch(
        `/api/rh/candidate-portal?${params.toString()}`,
        { cache: "no-store", credentials: "include" }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(data?.error || "Erro ao carregar Portal & Push.");
        return;
      }

      setProfiles(data.profiles || []);
      setStats(data.stats || {});
      setCampaigns(data.campaigns || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createProfile(event: React.FormEvent) {
    event.preventDefault();

    try {
      setBusy("create");
      const response = await fetch("/api/rh/candidate-portal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(data?.error || "Erro ao criar Portal.");
        return;
      }

      if (data.link) {
        const copied = await safeCopyText(data.link);

        if (copied) {
          alert(
            `Portal criado. Link copiado para a área de transferência.\n\nVínculo: ${
              data.profile?.match_status || "UNLINKED"
            }`
          );
        } else {
          window.prompt(
            `Portal criado. O navegador bloqueou a cópia automática.\nCopie o link abaixo:\n\nVínculo: ${
              data.profile?.match_status || "UNLINKED"
            }`,
            data.link
          );
        }
      }

      setForm({ fullName: "", cpf: "", phone: "", email: "" });
      setShowCreate(false);
      await load();
    } finally {
      setBusy("");
    }
  }

  async function profileAction(
    profile: Profile,
    action: string,
    extra: Record<string, unknown> = {}
  ) {
    try {
      setBusy(`${profile.id}:${action}`);

      const response = await fetch("/api/rh/candidate-portal", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: profile.id,
          action,
          ...extra,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(data?.error || "Erro ao atualizar Portal.");
        return;
      }

      if (data.link) {
        const copied = await safeCopyText(data.link);

        if (copied) {
          alert(
            action === "rotate_link"
              ? "Novo link gerado e copiado. O link anterior foi invalidado."
              : "Link do Portal copiado."
          );
        } else {
          window.prompt(
            action === "rotate_link"
              ? "Novo link gerado. O link anterior foi invalidado. Copie abaixo:"
              : "O navegador bloqueou a cópia automática. Copie o link abaixo:",
            data.link
          );
        }
      }

      await load();
    } finally {
      setBusy("");
    }
  }

  async function sendIndividual(profile: Profile) {
    if (!profile.candidate_id) {
      alert("Este Portal ainda não está vinculado a um currículo.");
      return;
    }

    const title =
      prompt("Título do Push:", "MOTIVAR RH")?.trim() || "";
    if (!title) return;

    const message =
      prompt(
        "Mensagem:",
        "Você recebeu uma nova atualização no Portal MOTIVAR."
      )?.trim() || "";
    if (!message) return;

    try {
      setBusy(`${profile.id}:push`);

      const response = await fetch(
        "/api/rh/candidate-portal/dispatch",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            candidateIds: [profile.candidate_id],
            title,
            message,
            type: "MESSAGE",
            source: "manual_profile",
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(data?.error || "Erro ao enviar Push.");
        return;
      }

      alert(
        `Push preparado.\nElegíveis: ${data.pushEligible}\nEnviados agora: ${
          data.processing?.sent || 0
        }\nSem Push: ${data.skippedWithoutPush || 0}`
      );

      await load();
    } finally {
      setBusy("");
    }
  }

  async function processQueue() {
    try {
      setBusy("queue");

      const response = await fetch(
        "/api/rh/candidate-portal/push-queue",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 300 }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(data?.error || "Erro ao processar fila.");
        return;
      }

      alert(
        `Fila processada: ${data.processed}\nEnviados: ${data.sent}\nFalhas: ${data.failed}`
      );
      await load();
    } finally {
      setBusy("");
    }
  }

  const activePush = Number(stats.push_active || 0);

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.kicker}>MOTIVAR RH • PORTAL DO CANDIDATO</p>
          <h1 style={styles.title}>Portal & Push</h1>
          <p style={styles.subtitle}>
            Gere acessos, ative o Portal mesmo antes do currículo ser vinculado,
            acompanhe o Push e centralize publicações, vagas e conversas com os candidatos.
          </p>
        </div>

        <div style={styles.heroActions}>
          <a
            href="/crm/dashboard/candidate-portal/publicacoes"
            style={styles.heroLink}
          >
            📰 Publicações
          </a>

          <a
            href="/crm/dashboard/candidate-portal/chat"
            style={styles.heroLink}
          >
            💬 Chat
          </a>

          <button
            style={styles.secondaryButton}
            disabled={busy === "queue"}
            onClick={() => void processQueue()}
          >
            {busy === "queue" ? "Processando..." : "Processar fila Push"}
          </button>
          <button
            style={styles.primaryButton}
            onClick={() => setShowCreate(true)}
          >
            + Novo acesso
          </button>
        </div>
      </section>

      <section style={styles.metrics}>
        <Metric value={Number(stats.total || 0)} label="Portais criados" />
        <Metric value={Number(stats.linked || 0)} label="Currículos vinculados" />
        <Metric value={Number(stats.portal_active || 0)} label="Portal ativo" />
        <Metric value={activePush} label="Push ativo" />
        <Metric value={Number(stats.unlinked || 0)} label="Aguardando vínculo" />
      </section>

      {showCreate && (
        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.kicker}>NOVO PORTAL</p>
              <h2 style={styles.sectionTitle}>Gerar acesso do candidato</h2>
              <p style={styles.smallText}>
                O CPF será usado primeiro para localizar o currículo existente.
              </p>
            </div>
            <button
              style={styles.secondaryButton}
              onClick={() => setShowCreate(false)}
            >
              Fechar
            </button>
          </div>

          <form style={styles.formGrid} onSubmit={createProfile}>
            <Field
              label="Nome completo"
              value={form.fullName}
              onChange={(value) => setForm({ ...form, fullName: value })}
            />
            <Field
              label="CPF"
              value={form.cpf}
              onChange={(value) => setForm({ ...form, cpf: value })}
              placeholder="000.000.000-00"
            />
            <Field
              label="Celular / WhatsApp"
              value={form.phone}
              onChange={(value) => setForm({ ...form, phone: value })}
            />
            <Field
              label="E-mail"
              value={form.email}
              onChange={(value) => setForm({ ...form, email: value })}
              type="email"
            />

            <div style={{ gridColumn: "1 / -1" }}>
              <button
                style={styles.primaryButton}
                disabled={busy === "create"}
              >
                {busy === "create"
                  ? "Criando..."
                  : "Gerar Portal e copiar link"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Candidatos no Portal</h2>
            <p style={styles.smallText}>
              Currículo, acesso e Push permanecem separados, mas vinculados pelo
              candidate_id.
            </p>
          </div>

          <div style={styles.filters}>
            <input
              style={styles.input}
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Nome, CPF, celular, e-mail..."
              onKeyDown={(event) => {
                if (event.key === "Enter") void load();
              }}
            />
            <select
              style={styles.input}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Todos os Portais</option>
              <option value="LINK_READY">Link gerado</option>
              <option value="ACTIVE">Ativo</option>
              <option value="INACTIVE">Inativo</option>
            </select>
            <button style={styles.secondaryButton} onClick={() => void load()}>
              Filtrar
            </button>
          </div>
        </div>

        {loading ? (
          <div style={styles.empty}>Carregando...</div>
        ) : (
          <div style={styles.grid}>
            {profiles.map((profile) => (
              <article style={styles.profileCard} key={profile.id}>
                <div style={styles.profileTop}>
                  <div style={styles.avatar}>
                    {profile.full_name.slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <strong style={styles.profileName}>
                      {profile.full_name}
                    </strong>
                    <span style={styles.muted}>
                      CPF {cpfMask(profile.cpf_normalized)}
                    </span>
                  </div>
                </div>

                <div style={styles.statusRow}>
                  <Pill
                    ok={profile.match_status === "MATCHED"}
                    text={
                      profile.match_status === "MATCHED"
                        ? "Currículo vinculado"
                        : profile.match_status === "REVIEW"
                        ? "Revisar vínculo"
                        : "Sem vínculo"
                    }
                  />
                  <Pill
                    ok={profile.portal_status === "ACTIVE"}
                    text={
                      profile.portal_status === "ACTIVE"
                        ? "Portal ativo"
                        : profile.portal_status === "INACTIVE"
                        ? "Portal inativo"
                        : "Link gerado"
                    }
                  />
                  <Pill
                    ok={Boolean(profile.push_active)}
                    text={
                      profile.push_active
                        ? `Push ativo (${profile.active_devices || 1})`
                        : "Sem Push"
                    }
                  />
                </div>

                <div style={styles.details}>
                  <span>{profile.phone_normalized || "Sem celular"}</span>
                  <span>{profile.email_normalized || "Sem e-mail"}</span>
                  <span>Último acesso: {when(profile.last_access_at)}</span>
                </div>

                <div style={styles.actions}>
                  <button
                    style={styles.secondaryButton}
                    onClick={() =>
                      void profileAction(profile, "get_link")
                    }
                  >
                    Copiar link
                  </button>

                  <button
                    style={styles.secondaryButton}
                    onClick={() => {
                      if (
                        confirm(
                          "Gerar um novo link? O link anterior deixará de funcionar."
                        )
                      ) {
                        void profileAction(profile, "rotate_link");
                      }
                    }}
                  >
                    Novo link
                  </button>

                  <button
                    style={{
                      ...styles.pushButton,
                      opacity: profile.push_active ? 1 : 0.5,
                    }}
                    disabled={!profile.push_active}
                    onClick={() => void sendIndividual(profile)}
                  >
                    Enviar Push
                  </button>

                  <button
                    style={styles.secondaryButton}
                    onClick={() =>
                      void profileAction(profile, "set_active", {
                        active: profile.portal_status === "INACTIVE",
                      })
                    }
                  >
                    {profile.portal_status === "INACTIVE"
                      ? "Reativar"
                      : "Inativar"}
                  </button>
                </div>
              </article>
            ))}

            {!profiles.length && (
              <div style={styles.empty}>Nenhum Portal encontrado.</div>
            )}
          </div>
        )}
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Últimos disparos</h2>
            <p style={styles.smallText}>
              Visão rápida das campanhas Push geradas pelo matching ou manualmente.
            </p>
          </div>
        </div>

        <div style={styles.campaignList}>
          {campaigns.map((item) => (
            <div style={styles.campaignRow} key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span style={styles.muted}>
                  {when(item.created_at)} • {item.source}
                </span>
              </div>
              <div style={styles.campaignStats}>
                <span>Alvo {item.target_count}</span>
                <span>Elegíveis {item.eligible_count}</span>
                <span>Enviados {item.sent_count}</span>
                <span>Falhas {item.failed_count}</span>
              </div>
            </div>
          ))}

          {!campaigns.length && (
            <div style={styles.empty}>Nenhum disparo realizado.</div>
          )}
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label style={styles.label}>
      {label}
      <input
        style={styles.input}
        value={value}
        type={type}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div style={styles.metric}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

function Pill({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span
      style={{
        ...styles.pill,
        ...(ok
          ? { background: "#ecfdf5", color: "#047857", borderColor: "#a7f3d0" }
          : { background: "#f8fafc", color: "#64748b", borderColor: "#e2e8f0" }),
      }}
    >
      {text}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 20,
    background: "linear-gradient(135deg,#eff6ff,#ffffff,#eef2ff)",
    color: "#0f172a",
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
    padding: 24,
    borderRadius: 26,
    background: "#fff",
    border: "1px solid #bfdbfe",
    boxShadow: "0 18px 50px rgba(37,99,235,.08)",
  },
  heroActions: { display: "flex", gap: 8, flexWrap: "wrap" },
  heroLink: {
    display: "inline-block",
    border: "1px solid #bfdbfe",
    borderRadius: 13,
    padding: "10px 13px",
    background: "#fff",
    color: "#1d4ed8",
    fontWeight: 950,
    textDecoration: "none",
  },
  kicker: {
    margin: 0,
    fontSize: 10,
    color: "#2563eb",
    fontWeight: 950,
    letterSpacing: ".16em",
  },
  title: { margin: "7px 0", fontSize: 34, fontWeight: 950 },
  subtitle: {
    margin: 0,
    maxWidth: 760,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.6,
  },
  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
    gap: 10,
    marginTop: 14,
  },
  card: {
    marginTop: 14,
    padding: 18,
    borderRadius: 22,
    border: "1px solid #bfdbfe",
    background: "#fff",
  },
  metric: {
    padding: 14,
    border: "1px solid #dbeafe",
    borderRadius: 17,
    background: "#fff",
    display: "grid",
    gap: 3,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  sectionTitle: { margin: 0, fontSize: 19, fontWeight: 950 },
  smallText: { margin: "4px 0 0", color: "#64748b", fontSize: 11 },
  formGrid: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 10,
  },
  label: { display: "grid", gap: 5, fontSize: 11, fontWeight: 900 },
  input: {
    border: "1px solid #bfdbfe",
    borderRadius: 12,
    padding: "10px 11px",
    background: "#f8fafc",
    outline: "none",
  },
  filters: { display: "flex", gap: 8, flexWrap: "wrap" },
  primaryButton: {
    border: 0,
    borderRadius: 13,
    padding: "10px 13px",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #bfdbfe",
    borderRadius: 12,
    padding: "9px 11px",
    background: "#fff",
    color: "#1d4ed8",
    fontWeight: 900,
    cursor: "pointer",
  },
  pushButton: {
    border: 0,
    borderRadius: 12,
    padding: "9px 11px",
    background: "#0f766e",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
  },
  grid: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
    gap: 10,
  },
  profileCard: {
    border: "1px solid #dbeafe",
    borderRadius: 17,
    padding: 13,
    background: "#f8fafc",
  },
  profileTop: { display: "flex", alignItems: "center", gap: 9 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg,#38bdf8,#2563eb)",
    color: "#fff",
    fontWeight: 950,
  },
  profileName: {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 12,
  },
  muted: { display: "block", color: "#64748b", fontSize: 9.5, marginTop: 2 },
  statusRow: { display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 },
  pill: {
    border: "1px solid",
    borderRadius: 999,
    padding: "5px 7px",
    fontSize: 9,
    fontWeight: 900,
  },
  details: {
    display: "grid",
    gap: 3,
    marginTop: 9,
    color: "#64748b",
    fontSize: 9.5,
  },
  actions: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 },
  campaignList: { display: "grid", gap: 8, marginTop: 12 },
  campaignRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    padding: 11,
    borderRadius: 13,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  campaignStats: { display: "flex", gap: 8, flexWrap: "wrap", fontSize: 9.5, color: "#475569" },
  empty: {
    padding: 18,
    border: "1px dashed #cbd5e1",
    borderRadius: 13,
    color: "#94a3b8",
    textAlign: "center",
    fontSize: 11,
  },
};
