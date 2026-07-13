"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type TeamUser = {
  id?: string;
  user_id?: string;
  name?: string;
  email?: string;
  role?: string;
  active?: boolean;
};

type Conversation = {
  id: string;
  otherUser?: {
    user_id: string;
    user_name?: string;
  } | null;
  lastMessage?: {
    body?: string;
    created_at?: string;
  } | null;
  unreadCount?: number;
};

type Message = {
  id: string;
  sender_id: string;
  sender_name?: string;
  body: string;
  created_at: string;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function formatTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function readJson(res: Response) {
  return res.json().catch(() => ({}));
}

export default function FloatingInternalChat() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"conversations" | "users" | "messages">("conversations");
  const [companyId, setCompanyId] = useState("");
  const [currentUser, setCurrentUser] = useState<TeamUser | null>(null);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const unreadTotal = useMemo(
    () => conversations.reduce((total, item) => total + Number(item.unreadCount || 0), 0),
    [conversations]
  );

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users
      .filter((user) => user.active !== false)
      .filter((user) => (user.user_id || user.id) !== (currentUser?.user_id || currentUser?.id))
      .filter((user) => {
        if (!query) return true;
        return [user.name, user.email, user.role]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
  }, [users, search, currentUser]);

  async function bootstrap() {
    try {
      const companyRes = await fetch("/api/company/current", {
        cache: "no-store",
        credentials: "include",
      });
      const companyData = await readJson(companyRes);

      const resolvedCompanyId =
        companyData?.company?.id ||
        companyData?.companyId ||
        localStorage.getItem("active_company_id") ||
        "";

      if (!resolvedCompanyId) {
        throw new Error("Empresa atual não encontrada.");
      }

      setCompanyId(resolvedCompanyId);
      localStorage.setItem("active_company_id", resolvedCompanyId);

      const [usersRes, chatRes] = await Promise.all([
        fetch(
          `/api/admin/users?companyId=${encodeURIComponent(resolvedCompanyId)}`,
          { cache: "no-store", credentials: "include" }
        ),
        fetch("/api/rh/chat", {
          cache: "no-store",
          credentials: "include",
        }),
      ]);

      const usersData = await readJson(usersRes);
      const chatData = await readJson(chatRes);

      if (!usersRes.ok) {
        throw new Error(usersData.error || "Erro ao carregar usuários.");
      }

      if (!chatRes.ok) {
        throw new Error(chatData.error || "Erro ao identificar usuário no chat.");
      }

      const teamUsers: TeamUser[] = Array.isArray(usersData.users)
        ? usersData.users
        : [];

      setUsers(teamUsers);
      setCurrentUser(chatData.currentUser || null);
      setConversations(chatData.conversations || []);
    } catch (error) {
      console.error("CHAT BOOTSTRAP:", error);
    }
  }

  async function loadConversations() {
    const res = await fetch("/api/rh/chat", {
      cache: "no-store",
      credentials: "include",
    });
    const data = await readJson(res);

    if (!res.ok) {
      console.error("CHAT CONVERSATIONS:", data.error);
      return;
    }

    if (data.currentUser) setCurrentUser(data.currentUser);
    setConversations(data.conversations || []);
  }

  async function loadMessages(conversation: Conversation) {
    const res = await fetch(
      `/api/rh/chat?conversationId=${encodeURIComponent(conversation.id)}`,
      { cache: "no-store", credentials: "include" }
    );
    const data = await readJson(res);

    if (!res.ok) {
      alert(data.error || "Erro ao carregar conversa.");
      return;
    }

    if (data.currentUser) setCurrentUser(data.currentUser);
    setMessages(data.messages || []);
    setTimeout(
      () => endRef.current?.scrollIntoView({ behavior: "smooth" }),
      50
    );
  }

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    loadConversations();
    const timer = window.setInterval(() => loadConversations(), 6000);
    return () => window.clearInterval(timer);
  }, [currentUser]);

  useEffect(() => {
    if (!selectedConversation || !currentUser) return;
    loadMessages(selectedConversation);
    const timer = window.setInterval(() => loadMessages(selectedConversation), 3500);
    return () => window.clearInterval(timer);
  }, [selectedConversation?.id, currentUser]);

  async function openDirect(user: TeamUser) {
    const targetUserId = user.user_id || user.id;

    if (!targetUserId) return;

    setLoading(true);
    try {
      const res = await fetch("/api/rh/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open_direct",
          targetUserId,
        }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Erro ao abrir conversa.");

      const conversation: Conversation = {
        ...data.conversation,
        otherUser: {
          user_id: targetUserId,
          user_name: user.name || user.email || "Usuário",
        },
      };

      setSelectedConversation(conversation);
      setView("messages");
      await loadMessages(conversation);
      await loadConversations();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = messageText.trim();
    if (!text || !selectedConversation) return;

    setMessageText("");

    const res = await fetch("/api/rh/chat", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send_message",
        conversationId: selectedConversation.id,
        message: text,
      }),
    });

    const data = await readJson(res);
    if (!res.ok) {
      setMessageText(text);
      alert(data.error || "Erro ao enviar mensagem.");
      return;
    }

    await loadMessages(selectedConversation);
    await loadConversations();
  }

  function openConversation(conversation: Conversation) {
    setSelectedConversation(conversation);
    setView("messages");
    loadMessages(conversation);
  }

  const currentUserId = currentUser?.user_id || currentUser?.id || "";

  return (
    <>
      <button
        type="button"
        aria-label="Abrir chat interno"
        onClick={() => setOpen((value) => !value)}
        style={styles.floatingButton}
      >
        <span style={{ fontSize: 22 }}>💬</span>
        <span style={styles.buttonText}>Chat</span>
        {unreadTotal > 0 && <span style={styles.badge}>{unreadTotal > 99 ? "99+" : unreadTotal}</span>}
      </button>

      {open && (
        <section style={styles.panel} aria-label="Chat interno">
          <header style={styles.header}>
            <div>
              <strong style={styles.headerTitle}>
                {view === "messages"
                  ? selectedConversation?.otherUser?.user_name || "Conversa"
                  : view === "users"
                  ? "Nova conversa"
                  : "Chat interno"}
              </strong>
              <div style={styles.headerSub}>
                {view === "messages" ? "Conversa direta" : `${users.length} usuários na equipe`}
              </div>
            </div>

            <div style={styles.headerActions}>
              {view !== "conversations" && (
                <button
                  type="button"
                  style={styles.iconButton}
                  onClick={() => {
                    setView("conversations");
                    setSelectedConversation(null);
                  }}
                  aria-label="Voltar"
                >
                  ←
                </button>
              )}
              <button
                type="button"
                style={styles.iconButton}
                onClick={() => setOpen(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
          </header>

          {view === "conversations" && (
            <>
              <div style={styles.toolbar}>
                <button type="button" style={styles.primaryButton} onClick={() => setView("users")}>
                  + Nova conversa
                </button>
                <button type="button" style={styles.refreshButton} onClick={() => loadConversations()}>
                  Atualizar
                </button>
              </div>

              <div style={styles.list}>
                {!currentUser && (
                  <div style={styles.empty}>
                    Identificando usuário atual…
                  </div>
                )}

                {currentUser && conversations.length === 0 && (
                  <div style={styles.empty}>
                    Nenhuma conversa ainda.<br />
                    Clique em “Nova conversa”.
                  </div>
                )}

                {conversations.map((conversation) => (
                  <button
                    type="button"
                    key={conversation.id}
                    onClick={() => openConversation(conversation)}
                    style={styles.userRow}
                  >
                    <span style={styles.avatar}>
                      {initials(conversation.otherUser?.user_name || "Usuário")}
                    </span>
                    <span style={styles.userText}>
                      <strong>{conversation.otherUser?.user_name || "Usuário"}</strong>
                      <small style={styles.preview}>
                        {conversation.lastMessage?.body || "Conversa iniciada"}
                      </small>
                    </span>
                    <span style={styles.rowMeta}>
                      <small>{formatTime(conversation.lastMessage?.created_at)}</small>
                      {(conversation.unreadCount || 0) > 0 && (
                        <span style={styles.smallBadge}>{conversation.unreadCount}</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {view === "users" && (
            <>
              <div style={styles.searchWrap}>
                <input
                  style={styles.search}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar usuário por nome ou e-mail"
                />
              </div>
              <div style={styles.list}>
                {filteredUsers.map((user) => (
                  <button
                    type="button"
                    key={user.user_id || user.id}
                    onClick={() => openDirect(user)}
                    style={styles.userRow}
                    disabled={loading}
                  >
                    <span style={styles.avatar}>{initials(user.name || user.email || "Usuário")}</span>
                    <span style={styles.userText}>
                      <strong>{user.name || user.email || "Usuário"}</strong>
                      <small style={styles.preview}>{user.role || user.email || "Equipe"}</small>
                    </span>
                  </button>
                ))}
                {!filteredUsers.length && <div style={styles.empty}>Nenhum usuário encontrado.</div>}
              </div>
            </>
          )}

          {view === "messages" && selectedConversation && (
            <>
              <div style={styles.messages}>
                {messages.map((message) => {
                  const mine = message.sender_id === currentUserId;
                  return (
                    <div
                      key={message.id}
                      style={{
                        ...styles.messageRow,
                        justifyContent: mine ? "flex-end" : "flex-start",
                      }}
                    >
                      <div style={mine ? styles.myBubble : styles.otherBubble}>
                        {!mine && <strong style={styles.sender}>{message.sender_name || "Usuário"}</strong>}
                        <div style={styles.messageBody}>{message.body}</div>
                        <small style={styles.messageTime}>{formatTime(message.created_at)}</small>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <form onSubmit={sendMessage} style={styles.composer}>
                <textarea
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder="Digite uma mensagem…"
                  style={styles.textarea}
                  rows={2}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <button type="submit" style={styles.sendButton} disabled={!messageText.trim()}>
                  Enviar
                </button>
              </form>
            </>
          )}
        </section>
      )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  floatingButton: {
    position: "fixed",
    right: 20,
    bottom: 88,
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    gap: 8,
    minHeight: 52,
    padding: "0 16px",
    border: "none",
    borderRadius: 999,
    background: "#1d4ed8",
    color: "#fff",
    boxShadow: "0 16px 38px rgba(29,78,216,.35)",
    cursor: "pointer",
    fontWeight: 800,
  },
  buttonText: { fontSize: 14 },
  badge: {
    position: "absolute",
    top: -6,
    right: -4,
    minWidth: 22,
    height: 22,
    display: "grid",
    placeItems: "center",
    padding: "0 6px",
    borderRadius: 999,
    background: "#dc2626",
    color: "#fff",
    fontSize: 11,
    border: "2px solid #fff",
  },
  panel: {
    position: "fixed",
    right: 20,
    bottom: 150,
    zIndex: 1001,
    width: "min(390px, calc(100vw - 24px))",
    height: "min(650px, calc(100vh - 180px))",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "#fff",
    border: "1px solid #dbeafe",
    borderRadius: 22,
    boxShadow: "0 28px 80px rgba(15,23,42,.30)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "15px 16px",
    background: "linear-gradient(135deg,#eff6ff,#ffffff)",
    borderBottom: "1px solid #dbeafe",
  },
  headerTitle: { color: "#0f172a", fontSize: 16 },
  headerSub: { color: "#64748b", fontSize: 12, marginTop: 2 },
  headerActions: { display: "flex", gap: 6 },
  iconButton: {
    width: 34,
    height: 34,
    border: "1px solid #dbeafe",
    borderRadius: 10,
    background: "#fff",
    cursor: "pointer",
    fontSize: 18,
  },
  toolbar: {
    display: "flex",
    gap: 8,
    padding: 12,
    borderBottom: "1px solid #e2e8f0",
  },
  primaryButton: {
    flex: 1,
    border: 0,
    borderRadius: 10,
    padding: "10px 12px",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },
  refreshButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "10px 12px",
    background: "#fff",
    cursor: "pointer",
  },
  list: { flex: 1, overflowY: "auto", padding: 8 },
  userRow: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 10,
    border: 0,
    borderBottom: "1px solid #f1f5f9",
    background: "#fff",
    textAlign: "left",
    cursor: "pointer",
  },
  avatar: {
    width: 40,
    height: 40,
    flex: "0 0 40px",
    display: "grid",
    placeItems: "center",
    borderRadius: 14,
    background: "#dbeafe",
    color: "#1d4ed8",
    fontWeight: 900,
  },
  userText: { display: "flex", flexDirection: "column", minWidth: 0, flex: 1, color: "#0f172a" },
  preview: {
    marginTop: 3,
    color: "#64748b",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  rowMeta: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 5,
    color: "#94a3b8",
  },
  smallBadge: {
    minWidth: 20,
    height: 20,
    display: "grid",
    placeItems: "center",
    padding: "0 5px",
    borderRadius: 999,
    background: "#2563eb",
    color: "#fff",
    fontSize: 11,
  },
  searchWrap: { padding: 12, borderBottom: "1px solid #e2e8f0" },
  search: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "11px 12px",
    outline: "none",
  },
  empty: { padding: 30, textAlign: "center", color: "#64748b", lineHeight: 1.5 },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "14px 12px",
    background: "#f8fafc",
  },
  messageRow: { display: "flex", marginBottom: 9 },
  myBubble: {
    maxWidth: "82%",
    padding: "9px 11px",
    borderRadius: "15px 15px 4px 15px",
    background: "#2563eb",
    color: "#fff",
  },
  otherBubble: {
    maxWidth: "82%",
    padding: "9px 11px",
    borderRadius: "15px 15px 15px 4px",
    background: "#fff",
    color: "#0f172a",
    border: "1px solid #e2e8f0",
  },
  sender: { display: "block", fontSize: 11, marginBottom: 4, color: "#1d4ed8" },
  messageBody: { whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 14, lineHeight: 1.4 },
  messageTime: { display: "block", textAlign: "right", opacity: 0.7, marginTop: 4, fontSize: 10 },
  composer: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
    padding: 10,
    borderTop: "1px solid #e2e8f0",
    background: "#fff",
  },
  textarea: {
    flex: 1,
    resize: "none",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "9px 10px",
    fontFamily: "inherit",
    outline: "none",
  },
  sendButton: {
    border: 0,
    borderRadius: 11,
    padding: "11px 14px",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },
};
