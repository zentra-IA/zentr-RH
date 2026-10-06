"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  sender_type: "RH" | "CANDIDATE";
  sender_user_id?: string | null;
  body: string;
  created_at: string;
};

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CandidatePortalFloatingChat({
  portalToken,
}: {
  portalToken: string;
}) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const endpoint = `/api/candidate-portal/${encodeURIComponent(
    portalToken
  )}/chat`;

  async function loadSummary() {
    const response = await fetch(
      `${endpoint}?mode=summary&t=${Date.now()}`,
      { cache: "no-store" }
    );
    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      setUnread(Number(data.unread || 0));
    }
  }

  async function loadMessages() {
    try {
      setLoading(true);
      const response = await fetch(`${endpoint}?t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setMessages(data.messages || []);
        setUnread(0);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSummary();

    const timer = window.setInterval(() => {
      if (open) {
        void loadMessages();
      } else {
        void loadSummary();
      }
    }, 5000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalToken, open]);

  useEffect(() => {
    if (open) {
      void loadMessages();
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text || sending) return;

    try {
      setSending(true);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(data.error || "Não foi possível enviar sua mensagem.");
        return;
      }

      setMessage("");
      await loadMessages();
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {open && (
        <section className="cpf-chat-panel" aria-label="Chat MOTIVAR RH">
          <header>
            <div>
              <span>ATENDIMENTO MOTIVAR RH</span>
              <strong>Fale com nossa equipe</strong>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fechar chat">
              ×
            </button>
          </header>

          <div className="cpf-chat-messages">
            {loading && !messages.length ? (
              <div className="cpf-chat-empty">Carregando conversa...</div>
            ) : (
              <>
                {!messages.length && (
                  <div className="cpf-chat-empty">
                    Envie uma mensagem para falar com a MOTIVAR RH.
                  </div>
                )}

                {messages.map((item) => (
                  <div
                    key={item.id}
                    className={`cpf-bubble ${
                      item.sender_type === "CANDIDATE" ? "mine" : "rh"
                    }`}
                  >
                    <b>
                      {item.sender_type === "CANDIDATE"
                        ? "Você"
                        : item.sender_user_id?.startsWith("AUTOMATION:")
                        ? "MOTIVAR • Assistente"
                        : "MOTIVAR RH"}
                    </b>
                    <p>{item.body}</p>
                    <small>{formatTime(item.created_at)}</small>
                  </div>
                ))}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          <form onSubmit={send}>
            <textarea
              rows={2}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Digite sua mensagem..."
            />
            <button disabled={sending || !message.trim()}>
              {sending ? "..." : "Enviar"}
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className={`cpf-chat-fab ${unread > 0 ? "has-unread" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-label="Abrir chat MOTIVAR RH"
      >
        <span className="cpf-chat-icon">💬</span>
        <strong>Chat</strong>
        {unread > 0 && (
          <em>{unread > 99 ? "99+" : unread}</em>
        )}
      </button>

      <style jsx>{`
        .cpf-chat-fab {
          position: fixed;
          right: 18px;
          bottom: 18px;
          z-index: 1200;
          min-width: 96px;
          height: 54px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 0;
          border-radius: 999px;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #fff;
          box-shadow: 0 18px 45px rgba(37, 99, 235, 0.35);
          font-weight: 950;
          cursor: pointer;
        }

        .cpf-chat-fab.has-unread {
          animation: cpfPulse 1.15s infinite;
          background: linear-gradient(135deg, #ef4444, #dc2626);
        }

        .cpf-chat-fab em {
          position: absolute;
          right: -3px;
          top: -6px;
          min-width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
          padding: 0 6px;
          border: 3px solid #fff;
          border-radius: 999px;
          background: #facc15;
          color: #7c2d12;
          font-size: 10px;
          font-style: normal;
        }

        .cpf-chat-icon {
          font-size: 20px;
        }

        .cpf-chat-panel {
          position: fixed;
          right: 18px;
          bottom: 82px;
          z-index: 1199;
          width: min(390px, calc(100vw - 24px));
          height: min(600px, calc(100vh - 120px));
          display: grid;
          grid-template-rows: auto 1fr auto;
          overflow: hidden;
          border: 1px solid #bfdbfe;
          border-radius: 24px;
          background: #fff;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.25);
        }

        .cpf-chat-panel header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          color: #fff;
          background: linear-gradient(135deg, #2563eb, #1e40af);
        }

        .cpf-chat-panel header div {
          display: grid;
          gap: 2px;
        }

        .cpf-chat-panel header span {
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.14em;
          opacity: 0.8;
        }

        .cpf-chat-panel header strong {
          font-size: 14px;
        }

        .cpf-chat-panel header button {
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
          font-size: 22px;
          cursor: pointer;
        }

        .cpf-chat-messages {
          overflow-y: auto;
          padding: 13px;
          background: #f8fafc;
        }

        .cpf-chat-empty {
          padding: 18px;
          border: 1px dashed #cbd5e1;
          border-radius: 14px;
          color: #64748b;
          background: #fff;
          text-align: center;
          font-size: 11px;
        }

        .cpf-bubble {
          width: fit-content;
          max-width: 82%;
          margin-bottom: 9px;
          padding: 10px 11px;
          border-radius: 15px;
          background: #fff;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
        }

        .cpf-bubble.mine {
          margin-left: auto;
          background: #dbeafe;
          border-color: #bfdbfe;
        }

        .cpf-bubble.rh {
          margin-right: auto;
        }

        .cpf-bubble b {
          display: block;
          color: #1d4ed8;
          font-size: 9px;
        }

        .cpf-bubble p {
          margin: 4px 0;
          color: #0f172a;
          font-size: 12px;
          line-height: 1.45;
        }

        .cpf-bubble small {
          display: block;
          color: #94a3b8;
          font-size: 8px;
          text-align: right;
        }

        .cpf-chat-panel form {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          padding: 10px;
          border-top: 1px solid #e2e8f0;
          background: #fff;
        }

        .cpf-chat-panel textarea {
          resize: none;
          border: 1px solid #cbd5e1;
          border-radius: 13px;
          padding: 9px 10px;
          outline: none;
          font: inherit;
          font-size: 12px;
        }

        .cpf-chat-panel form button {
          align-self: stretch;
          border: 0;
          border-radius: 13px;
          padding: 0 14px;
          background: #2563eb;
          color: #fff;
          font-weight: 950;
          cursor: pointer;
        }

        @keyframes cpfPulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.55);
          }
          70% {
            transform: scale(1.05);
            box-shadow: 0 0 0 16px rgba(239, 68, 68, 0);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
          }
        }

        @media (max-width: 640px) {
          .cpf-chat-fab {
            right: 12px;
            bottom: 12px;
          }

          .cpf-chat-panel {
            right: 12px;
            bottom: 74px;
            width: calc(100vw - 24px);
            height: min(70vh, 620px);
          }
        }
      `}</style>
    </>
  );
}
