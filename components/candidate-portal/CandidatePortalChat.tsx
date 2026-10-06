"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  sender_type: "RH" | "CANDIDATE";
  body: string;
  read_at?: string | null;
  created_at: string;
};

function time(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function CandidatePortalChat({
  portalToken,
}: {
  portalToken: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const endpoint = `/api/candidate-portal/${encodeURIComponent(
    portalToken
  )}/chat`;

  async function load(silent = false) {
    try {
      const response = await fetch(`${endpoint}?t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setMessages(data.messages || []);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();

    const timer = window.setInterval(() => {
      void load(true);
    }, 5000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalToken]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;

    try {
      setSending(true);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(data.error || "Não foi possível enviar a mensagem.");
        return;
      }

      setMessage("");
      await load(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="cp-card">
      <div className="cp-section-head">
        <div>
          <span className="cp-eyebrow">ATENDIMENTO</span>
          <h2>Falar com a MOTIVAR RH</h2>
        </div>
        <span>Chat do candidato</span>
      </div>

      <div className="cp-chat">
        <div className="cp-chat-messages">
          {loading ? (
            <div className="cp-empty">Carregando mensagens...</div>
          ) : (
            <>
              {messages.map((item) => (
                <div
                  key={item.id}
                  className={`cp-chat-message ${
                    item.sender_type === "CANDIDATE"
                      ? "mine"
                      : "rh"
                  }`}
                >
                  <strong>
                    {item.sender_type === "CANDIDATE"
                      ? "Você"
                      : "MOTIVAR RH"}
                  </strong>
                  <p>{item.body}</p>
                  <span>{time(item.created_at)}</span>
                </div>
              ))}

              {!messages.length && (
                <div className="cp-empty">
                  Ainda não há mensagens. Você pode iniciar a conversa.
                </div>
              )}

              <div ref={bottomRef} />
            </>
          )}
        </div>

        <form className="cp-chat-form" onSubmit={send}>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Digite sua mensagem..."
            rows={3}
          />
          <button disabled={sending || !message.trim()}>
            {sending ? "Enviando..." : "Enviar mensagem"}
          </button>
        </form>
      </div>
    </section>
  );
}
