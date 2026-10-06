"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Conversation = {
  id?: string | null;
  profile_id: string;
  candidate_id?: string | null;
  full_name: string;
  cpf_normalized?: string | null;
  phone_normalized?: string | null;
  email_normalized?: string | null;
  portal_status?: string | null;
  push_status?: string | null;
  push_active?: boolean;
  last_message_text?: string | null;
  last_message_at?: string | null;
  rh_unread?: number;
};

type Message = {
  id: string;
  sender_type: "RH" | "CANDIDATE";
  sender_user_id?: string | null;
  body: string;
  read_at?: string | null;
  created_at: string;
};

function cpfMask(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 11) return value || "-";

  return digits.replace(
    /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
    "$1.$2.$3-$4"
  );
}

function when(value?: string | null) {
  if (!value) return "Sem mensagens";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem mensagens";
  return date.toLocaleString("pt-BR");
}

export default function CandidatePortalChatManager() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  async function loadConversations(silent = false) {
    try {
      if (!silent) setLoadingList(true);

      const response = await fetch(
        `/api/rh/candidate-portal/chat?t=${Date.now()}`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (!silent) {
          alert(data.error || "Erro ao carregar conversas.");
        }
        return;
      }

      setConversations(data.conversations || []);
    } finally {
      if (!silent) setLoadingList(false);
    }
  }

  async function loadMessages(profileId: string, silent = false) {
    try {
      if (!silent) setLoadingMessages(true);

      const response = await fetch(
        `/api/rh/candidate-portal/chat?profileId=${encodeURIComponent(
          profileId
        )}&t=${Date.now()}`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (!silent) {
          alert(data.error || "Erro ao carregar mensagens.");
        }
        return;
      }

      setMessages(data.messages || []);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }

  useEffect(() => {
    void loadConversations();

    const timer = window.setInterval(() => {
      void loadConversations(true);
      if (selected?.profile_id) {
        void loadMessages(selected.profile_id, true);
      }
    }, 5000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.profile_id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return conversations;

    return conversations.filter((item) =>
      [
        item.full_name,
        item.cpf_normalized,
        item.phone_normalized,
        item.email_normalized,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(q)
        )
    );
  }, [conversations, search]);

  async function selectConversation(item: Conversation) {
    setSelected(item);
    await loadMessages(item.profile_id);
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();

    if (!selected?.profile_id || !message.trim()) return;

    try {
      setSending(true);

      const response = await fetch(
        "/api/rh/candidate-portal/chat",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            profileId: selected.profile_id,
            message: message.trim(),
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(data.error || "Erro ao enviar mensagem.");
        return;
      }

      setMessage("");
      await loadMessages(selected.profile_id, true);
      await loadConversations(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.kicker}>
            MOTIVAR RH • PORTAL DO CANDIDATO
          </p>
          <h1 style={styles.title}>Chat</h1>
          <p style={styles.subtitle}>
            Converse com o candidato dentro do Portal. Quando ele possui
            Push ativo, cada nova mensagem do RH gera uma notificação
            automaticamente no celular.
          </p>
        </div>

        <div style={styles.actions}>
          <a
            href="/crm/dashboard/candidate-portal"
            style={styles.secondaryLink}
          >
            ← Portal & Push
          </a>
          <a
            href="/crm/dashboard/candidate-portal/publicacoes"
            style={styles.primaryLink}
          >
            Publicações
          </a>
        </div>
      </section>

      <section style={styles.chatShell}>
        <aside style={styles.sidebar}>
          <input
            style={styles.search}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar candidato..."
          />

          <div style={styles.list}>
            {loadingList ? (
              <div style={styles.empty}>Carregando...</div>
            ) : (
              <>
                {filtered.map((item) => (
                  <button
                    type="button"
                    key={item.profile_id}
                    style={{
                      ...styles.conversationButton,
                      ...(selected?.profile_id === item.profile_id
                        ? styles.conversationButtonActive
                        : {}),
                    }}
                    onClick={() =>
                      void selectConversation(item)
                    }
                  >
                    <div style={styles.avatar}>
                      {item.full_name.slice(0, 1).toUpperCase()}
                    </div>

                    <div style={styles.conversationInfo}>
                      <div style={styles.conversationTop}>
                        <strong>{item.full_name}</strong>
                        {Number(item.rh_unread || 0) > 0 && (
                          <span style={styles.unreadBadge}>
                            {item.rh_unread}
                          </span>
                        )}
                      </div>

                      <span style={styles.small}>
                        CPF {cpfMask(item.cpf_normalized)}
                      </span>

                      <span style={styles.preview}>
                        {item.last_message_text ||
                          "Iniciar conversa"}
                      </span>

                      <div style={styles.statusRow}>
                        <span
                          style={
                            item.push_active
                              ? styles.pushOn
                              : styles.pushOff
                          }
                        >
                          {item.push_active
                            ? "🔔 Push ativo"
                            : "Sem Push"}
                        </span>
                        <span style={styles.date}>
                          {when(item.last_message_at)}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}

                {!filtered.length && (
                  <div style={styles.empty}>
                    Nenhum candidato encontrado.
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        <section style={styles.messageArea}>
          {!selected ? (
            <div style={styles.emptyCenter}>
              <strong>Selecione um candidato</strong>
              <span>
                Você poderá conversar com qualquer Portal criado,
                mesmo antes do currículo ser vinculado.
              </span>
            </div>
          ) : (
            <>
              <header style={styles.messageHeader}>
                <div>
                  <strong>{selected.full_name}</strong>
                  <span style={styles.small}>
                    {selected.phone_normalized ||
                      selected.email_normalized ||
                      "Portal do candidato"}
                  </span>
                </div>

                <span
                  style={
                    selected.push_active
                      ? styles.pushOn
                      : styles.pushOff
                  }
                >
                  {selected.push_active
                    ? "🔔 Push ativo"
                    : "Sem Push ativo"}
                </span>
              </header>

              <div style={styles.messages}>
                {loadingMessages ? (
                  <div style={styles.empty}>Carregando...</div>
                ) : (
                  <>
                    {messages.map((item) => (
                      <article
                        key={item.id}
                        style={{
                          ...styles.messageBubble,
                          ...(item.sender_type === "RH"
                            ? styles.messageRh
                            : styles.messageCandidate),
                        }}
                      >
                        <strong style={styles.sender}>
                          {item.sender_type === "RH"
                            ? "MOTIVAR RH"
                            : selected.full_name}
                        </strong>
                        <p style={styles.messageText}>
                          {item.body}
                        </p>
                        <span style={styles.messageTime}>
                          {when(item.created_at)}
                        </span>
                      </article>
                    ))}

                    {!messages.length && (
                      <div style={styles.emptyCenter}>
                        <strong>Nenhuma mensagem ainda</strong>
                        <span>
                          Digite abaixo para iniciar a conversa.
                        </span>
                      </div>
                    )}

                    <div ref={bottomRef} />
                  </>
                )}
              </div>

              <form style={styles.form} onSubmit={send}>
                <textarea
                  style={styles.textarea}
                  value={message}
                  onChange={(event) =>
                    setMessage(event.target.value)
                  }
                  placeholder="Digite sua mensagem para o candidato..."
                  rows={3}
                />
                <button
                  style={styles.sendButton}
                  disabled={sending || !message.trim()}
                >
                  {sending
                    ? "Enviando..."
                    : selected.push_active
                    ? "Enviar mensagem + Push"
                    : "Enviar mensagem"}
                </button>
              </form>
            </>
          )}
        </section>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 20,
    background:
      "linear-gradient(135deg,#eff6ff,#ffffff,#eef2ff)",
    color: "#0f172a",
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    padding: 24,
    border: "1px solid #bfdbfe",
    borderRadius: 26,
    background: "#fff",
  },
  kicker: {
    margin: 0,
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: ".15em",
    color: "#2563eb",
  },
  title: {
    margin: "7px 0",
    fontSize: 34,
    fontWeight: 950,
  },
  subtitle: {
    margin: 0,
    maxWidth: 760,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.6,
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  primaryLink: {
    display: "inline-block",
    padding: "10px 13px",
    borderRadius: 13,
    background: "#2563eb",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 900,
  },
  secondaryLink: {
    display: "inline-block",
    padding: "10px 13px",
    borderRadius: 13,
    border: "1px solid #bfdbfe",
    background: "#fff",
    color: "#2563eb",
    textDecoration: "none",
    fontWeight: 900,
  },
  chatShell: {
    display: "grid",
    gridTemplateColumns: "330px minmax(0,1fr)",
    minHeight: "70vh",
    marginTop: 14,
    overflow: "hidden",
    border: "1px solid #bfdbfe",
    borderRadius: 22,
    background: "#fff",
  },
  sidebar: {
    display: "grid",
    gridTemplateRows: "auto 1fr",
    minHeight: 0,
    borderRight: "1px solid #dbeafe",
    background: "#f8fafc",
  },
  search: {
    margin: 12,
    border: "1px solid #bfdbfe",
    borderRadius: 13,
    padding: "11px 12px",
    outline: "none",
  },
  list: {
    overflowY: "auto",
    minHeight: 0,
    padding: "0 8px 10px",
  },
  conversationButton: {
    width: "100%",
    display: "flex",
    gap: 9,
    padding: 10,
    border: "1px solid transparent",
    borderRadius: 14,
    background: "transparent",
    textAlign: "left",
    cursor: "pointer",
  },
  conversationButtonActive: {
    borderColor: "#93c5fd",
    background: "#eff6ff",
  },
  avatar: {
    width: 36,
    height: 36,
    flex: "0 0 auto",
    display: "grid",
    placeItems: "center",
    borderRadius: 12,
    background:
      "linear-gradient(135deg,#38bdf8,#2563eb)",
    color: "#fff",
    fontWeight: 950,
  },
  conversationInfo: {
    minWidth: 0,
    flex: 1,
    display: "grid",
    gap: 2,
  },
  conversationTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    display: "grid",
    placeItems: "center",
    borderRadius: 999,
    background: "#2563eb",
    color: "#fff",
    fontSize: 9,
    fontWeight: 950,
  },
  small: {
    color: "#64748b",
    fontSize: 9.5,
  },
  preview: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#475569",
    fontSize: 10,
  },
  statusRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 6,
    marginTop: 4,
  },
  pushOn: {
    color: "#047857",
    fontSize: 9,
    fontWeight: 900,
  },
  pushOff: {
    color: "#94a3b8",
    fontSize: 9,
    fontWeight: 900,
  },
  date: {
    color: "#94a3b8",
    fontSize: 8.5,
  },
  messageArea: {
    display: "grid",
    gridTemplateRows: "auto 1fr auto",
    minWidth: 0,
    minHeight: 0,
  },
  messageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderBottom: "1px solid #dbeafe",
  },
  messages: {
    overflowY: "auto",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: 9,
    padding: 14,
    background: "#f8fafc",
  },
  messageBubble: {
    maxWidth: "76%",
    padding: "10px 12px",
    borderRadius: 15,
    border: "1px solid #e2e8f0",
  },
  messageRh: {
    alignSelf: "flex-end",
    background: "#dbeafe",
    borderColor: "#bfdbfe",
  },
  messageCandidate: {
    alignSelf: "flex-start",
    background: "#fff",
  },
  sender: {
    display: "block",
    color: "#2563eb",
    fontSize: 9,
  },
  messageText: {
    margin: "4px 0",
    whiteSpace: "pre-wrap",
    color: "#0f172a",
    fontSize: 11.5,
    lineHeight: 1.5,
  },
  messageTime: {
    color: "#94a3b8",
    fontSize: 8.5,
  },
  form: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 8,
    padding: 12,
    borderTop: "1px solid #dbeafe",
  },
  textarea: {
    minHeight: 70,
    resize: "vertical",
    border: "1px solid #bfdbfe",
    borderRadius: 13,
    padding: "10px 11px",
    outline: "none",
    fontFamily: "inherit",
  },
  sendButton: {
    border: 0,
    borderRadius: 13,
    padding: "0 16px",
    background: "#0f766e",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
  },
  empty: {
    margin: 8,
    padding: 14,
    border: "1px dashed #cbd5e1",
    borderRadius: 13,
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 10,
  },
  emptyCenter: {
    alignSelf: "center",
    justifySelf: "center",
    display: "grid",
    gap: 5,
    maxWidth: 360,
    padding: 24,
    textAlign: "center",
    color: "#64748b",
    fontSize: 11,
  },
};
