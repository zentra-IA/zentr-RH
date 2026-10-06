"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Conversation = {
  id?: string | null;
  profile_id: string;
  full_name: string;
  phone_normalized?: string | null;
  email_normalized?: string | null;
  push_active?: boolean;
  last_message_text?: string | null;
  last_message_at?: string | null;
  rh_unread?: number;
  automation_paused?: boolean;
};

type Message = {
  id: string;
  sender_type: "RH" | "CANDIDATE";
  sender_user_id?: string | null;
  body: string;
  created_at: string;
};

function time(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FloatingCandidatePortalChat() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{
    name: string;
    text: string;
  } | null>(null);
  const [sending, setSending] = useState(false);
  const previousUnread = useRef(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  async function loadSummary() {
    const response = await fetch(
      `/api/rh/candidate-portal/chat?mode=summary&t=${Date.now()}`,
      {
        credentials: "include",
        cache: "no-store",
      }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) return;

    const next = Number(data.unreadTotal || 0);

    if (
      next > previousUnread.current &&
      Array.isArray(data.recent) &&
      data.recent[0]
    ) {
      setToast({
        name: data.recent[0].full_name || "Candidato",
        text: data.recent[0].last_message_text || "Nova mensagem",
      });

      window.setTimeout(() => {
        setToast(null);
      }, 7000);
    }

    previousUnread.current = next;
    setUnread(next);
  }

  async function loadConversations() {
    const response = await fetch(
      `/api/rh/candidate-portal/chat?t=${Date.now()}`,
      {
        credentials: "include",
        cache: "no-store",
      }
    );
    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      setConversations(data.conversations || []);
    }
  }

  async function loadMessages(profileId: string) {
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

    if (response.ok) {
      setMessages(data.messages || []);
      setSelected((current) =>
        current
          ? {
              ...current,
              rh_unread: 0,
              automation_paused: Boolean(
                data.conversation?.automation_paused
              ),
            }
          : current
      );
      void loadSummary();
      void loadConversations();
    }
  }

  useEffect(() => {
    void loadSummary();

    const timer = window.setInterval(() => {
      void loadSummary();

      if (open) {
        void loadConversations();

        if (selected?.profile_id) {
          void loadMessages(selected.profile_id);
        }
      }
    }, 5000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selected?.profile_id]);

  useEffect(() => {
    if (open) {
      void loadConversations();
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;

    return conversations.filter((item) =>
      [
        item.full_name,
        item.phone_normalized,
        item.email_normalized,
        item.last_message_text,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [conversations, search]);

  async function select(item: Conversation) {
    setSelected(item);
    await loadMessages(item.profile_id);
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();

    if (!selected?.profile_id || !message.trim() || sending) return;

    try {
      setSending(true);

      const response = await fetch(
        "/api/rh/candidate-portal/chat",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
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
      await loadMessages(selected.profile_id);
    } finally {
      setSending(false);
    }
  }

  async function automation(paused: boolean) {
    if (!selected?.profile_id) return;

    const response = await fetch(
      "/api/rh/candidate-portal/chat",
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: selected.profile_id,
          action: paused
            ? "pause_automation"
            : "resume_automation",
        }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      alert(data.error || "Erro ao alterar automação.");
      return;
    }

    setSelected((current) =>
      current
        ? { ...current, automation_paused: paused }
        : current
    );
  }

  return (
    <>
      {toast && (
        <button
          type="button"
          className="fcpc-toast"
          onClick={() => {
            setOpen(true);
            setToast(null);
          }}
        >
          <b>💬 {toast.name}</b>
          <span>{toast.text}</span>
          <small>Nova mensagem no Portal</small>
        </button>
      )}

      {open && (
        <section className="fcpc-panel">
          <header>
            <div>
              <span>PORTAL DO CANDIDATO</span>
              <strong>Chat candidatos</strong>
            </div>
            <button onClick={() => setOpen(false)}>×</button>
          </header>

          <div className="fcpc-body">
            <aside>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar candidato..."
              />

              <div className="fcpc-list">
                {filtered.map((item) => (
                  <button
                    key={item.profile_id}
                    type="button"
                    className={
                      selected?.profile_id === item.profile_id
                        ? "active"
                        : ""
                    }
                    onClick={() => void select(item)}
                  >
                    <span className="avatar">
                      {item.full_name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="copy">
                      <b>{item.full_name}</b>
                      <small>
                        {item.last_message_text || "Abrir conversa"}
                      </small>
                    </span>
                    {Number(item.rh_unread || 0) > 0 && (
                      <em>{item.rh_unread}</em>
                    )}
                  </button>
                ))}
              </div>
            </aside>

            <main>
              {!selected ? (
                <div className="fcpc-empty">
                  Selecione um candidato para conversar.
                </div>
              ) : (
                <>
                  <div className="fcpc-conversation-head">
                    <div>
                      <strong>{selected.full_name}</strong>
                      <span>
                        {selected.push_active
                          ? "🔔 Push ativo"
                          : "Sem Push ativo"}
                      </span>
                    </div>

                    <button
                      type="button"
                      className={
                        selected.automation_paused
                          ? "automation off"
                          : "automation on"
                      }
                      onClick={() =>
                        void automation(
                          !Boolean(selected.automation_paused)
                        )
                      }
                    >
                      {selected.automation_paused
                        ? "🤖 Reativar bot"
                        : "🤖 Bot ativo"}
                    </button>
                  </div>

                  <div className="fcpc-messages">
                    {messages.map((item) => (
                      <div
                        className={`bubble ${
                          item.sender_type === "RH"
                            ? "mine"
                            : "candidate"
                        }`}
                        key={item.id}
                      >
                        <b>
                          {item.sender_type === "RH"
                            ? item.sender_user_id?.startsWith(
                                "AUTOMATION:"
                              )
                              ? "Automação"
                              : "MOTIVAR RH"
                            : selected.full_name}
                        </b>
                        <p>{item.body}</p>
                        <small>{time(item.created_at)}</small>
                      </div>
                    ))}
                    <div ref={bottomRef} />
                  </div>

                  <form onSubmit={send}>
                    <textarea
                      rows={2}
                      value={message}
                      onChange={(event) =>
                        setMessage(event.target.value)
                      }
                      placeholder="Digite uma mensagem..."
                    />
                    <button disabled={sending || !message.trim()}>
                      {sending ? "..." : "Enviar"}
                    </button>
                  </form>
                </>
              )}
            </main>
          </div>
        </section>
      )}

      <button
        type="button"
        className={`fcpc-fab ${unread > 0 ? "attention" : ""}`}
        onClick={() => setOpen((value) => !value)}
        title="Chat com candidatos do Portal"
      >
        <span>💬</span>
        <strong>Candidatos</strong>
        {unread > 0 && <em>{unread > 99 ? "99+" : unread}</em>}
      </button>

      <style jsx>{`
        .fcpc-fab {
          position: fixed;
          right: 18px;
          bottom: 142px;
          z-index: 1050;
          min-width: 126px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 0;
          border-radius: 999px;
          background: linear-gradient(135deg, #0f766e, #0d9488);
          color: #fff;
          font-size: 11px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 16px 40px rgba(15, 118, 110, 0.28);
        }

        .fcpc-fab.attention {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          animation: fcpcPulse 1.15s infinite;
        }

        .fcpc-fab em {
          position: absolute;
          top: -7px;
          right: -4px;
          min-width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
          padding: 0 5px;
          border: 3px solid #fff;
          border-radius: 999px;
          background: #facc15;
          color: #7c2d12;
          font-size: 9px;
          font-style: normal;
        }

        .fcpc-toast {
          position: fixed;
          right: 18px;
          top: 18px;
          z-index: 1300;
          width: min(360px, calc(100vw - 36px));
          display: grid;
          gap: 4px;
          padding: 14px;
          border: 1px solid #99f6e4;
          border-radius: 17px;
          background: #f0fdfa;
          color: #134e4a;
          text-align: left;
          cursor: pointer;
          box-shadow: 0 18px 55px rgba(15, 23, 42, 0.18);
          animation: fcpcToastIn 0.25s ease-out;
        }

        .fcpc-toast b {
          font-size: 12px;
        }

        .fcpc-toast span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 11px;
        }

        .fcpc-toast small {
          color: #0f766e;
          font-size: 9px;
          font-weight: 900;
        }

        .fcpc-panel {
          position: fixed;
          right: 18px;
          bottom: 198px;
          z-index: 1049;
          width: min(760px, calc(100vw - 36px));
          height: min(610px, calc(100vh - 230px));
          overflow: hidden;
          border: 1px solid #99f6e4;
          border-radius: 22px;
          background: #fff;
          box-shadow: 0 24px 80px rgba(15, 23, 42, 0.25);
        }

        .fcpc-panel > header {
          height: 62px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 0 16px;
          color: #fff;
          background: linear-gradient(135deg, #0f766e, #0d9488);
        }

        .fcpc-panel > header div {
          display: grid;
          gap: 2px;
        }

        .fcpc-panel > header span {
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.14em;
        }

        .fcpc-panel > header strong {
          font-size: 15px;
        }

        .fcpc-panel > header button {
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.15);
          color: #fff;
          font-size: 22px;
          cursor: pointer;
        }

        .fcpc-body {
          height: calc(100% - 62px);
          display: grid;
          grid-template-columns: 260px 1fr;
        }

        .fcpc-body aside {
          min-width: 0;
          padding: 10px;
          border-right: 1px solid #e2e8f0;
          background: #f8fafc;
          overflow: hidden;
        }

        .fcpc-body aside > input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #cbd5e1;
          border-radius: 11px;
          padding: 9px 10px;
          outline: none;
          font-size: 11px;
        }

        .fcpc-list {
          height: calc(100% - 46px);
          margin-top: 8px;
          overflow-y: auto;
        }

        .fcpc-list > button {
          width: 100%;
          display: grid;
          grid-template-columns: 32px 1fr auto;
          align-items: center;
          gap: 7px;
          margin-bottom: 5px;
          padding: 8px;
          border: 1px solid transparent;
          border-radius: 12px;
          background: transparent;
          text-align: left;
          cursor: pointer;
        }

        .fcpc-list > button:hover,
        .fcpc-list > button.active {
          border-color: #99f6e4;
          background: #fff;
        }

        .avatar {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: #ccfbf1;
          color: #0f766e;
          font-weight: 950;
        }

        .copy {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .copy b,
        .copy small {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .copy b {
          font-size: 10px;
        }

        .copy small {
          color: #64748b;
          font-size: 8px;
        }

        .fcpc-list em {
          min-width: 21px;
          height: 21px;
          display: grid;
          place-items: center;
          padding: 0 4px;
          border-radius: 999px;
          background: #ef4444;
          color: #fff;
          font-size: 8px;
          font-style: normal;
          font-weight: 950;
        }

        .fcpc-body main {
          min-width: 0;
          display: grid;
          grid-template-rows: auto 1fr auto;
          overflow: hidden;
        }

        .fcpc-empty {
          place-self: center;
          color: #94a3b8;
          font-size: 11px;
        }

        .fcpc-conversation-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 12px;
          border-bottom: 1px solid #e2e8f0;
        }

        .fcpc-conversation-head div {
          display: grid;
          gap: 2px;
        }

        .fcpc-conversation-head strong {
          font-size: 11px;
        }

        .fcpc-conversation-head span {
          color: #64748b;
          font-size: 8px;
        }

        .automation {
          border: 1px solid #bbf7d0;
          border-radius: 999px;
          padding: 7px 9px;
          font-size: 8px;
          font-weight: 950;
          cursor: pointer;
        }

        .automation.on {
          background: #f0fdf4;
          color: #15803d;
        }

        .automation.off {
          border-color: #fed7aa;
          background: #fff7ed;
          color: #c2410c;
        }

        .fcpc-messages {
          overflow-y: auto;
          padding: 12px;
          background: #f8fafc;
        }

        .bubble {
          width: fit-content;
          max-width: 82%;
          margin-bottom: 8px;
          padding: 9px 10px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: #fff;
        }

        .bubble.mine {
          margin-left: auto;
          background: #ccfbf1;
          border-color: #99f6e4;
        }

        .bubble.candidate {
          margin-right: auto;
        }

        .bubble b {
          display: block;
          color: #0f766e;
          font-size: 8px;
        }

        .bubble p {
          margin: 3px 0;
          font-size: 11px;
          line-height: 1.4;
        }

        .bubble small {
          display: block;
          color: #94a3b8;
          font-size: 7px;
          text-align: right;
        }

        .fcpc-body main > form {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 7px;
          padding: 9px;
          border-top: 1px solid #e2e8f0;
        }

        .fcpc-body textarea {
          resize: none;
          border: 1px solid #cbd5e1;
          border-radius: 11px;
          padding: 8px;
          outline: none;
          font: inherit;
          font-size: 10px;
        }

        .fcpc-body form button {
          border: 0;
          border-radius: 11px;
          padding: 0 12px;
          background: #0f766e;
          color: #fff;
          font-size: 9px;
          font-weight: 950;
          cursor: pointer;
        }

        @keyframes fcpcPulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.48);
          }
          70% {
            transform: scale(1.04);
            box-shadow: 0 0 0 15px rgba(239, 68, 68, 0);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
          }
        }

        @keyframes fcpcToastIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 760px) {
          .fcpc-fab {
            right: 12px;
            bottom: 142px;
          }

          .fcpc-panel {
            right: 10px;
            bottom: 196px;
            width: calc(100vw - 20px);
            height: min(70vh, 620px);
          }

          .fcpc-body {
            grid-template-columns: 130px 1fr;
          }
        }
      `}</style>
    </>
  );
}
