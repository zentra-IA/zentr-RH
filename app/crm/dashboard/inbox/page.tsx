"use client";

import { useEffect, useRef, useState } from "react";

const STATUS_LABELS: Record<string, string> = {
  novo: "Novo",
  enviado: "Enviado",
  respondeu: "Respondeu",
  quer_agendar_entrevista: "Quer agendar entrevista",
  entrevista_agendada: "Agendou entrevista",
  entrevista_confirmada: "Entrevista confirmada",
  campanha: "Campanha",
  reagendar_futuro: "Reagendar futuro",
  contratado: "Contratado",
  sem_interesse: "Sem interesse",
  nao_aprovado: "Não aprovado",
  selecionado_vaga: "Selecionado na vaga",
  aprovado: "Aprovado",
  nao_compareceu: "Não compareceu",

  // compatibilidade antiga
  respondido: "Respondeu",
  interesse: "Quer agendar entrevista",
  pedido: "Agendou entrevista",
  reativar_futuro: "Reagendar futuro",
  finalizado: "Contratado",
};

const STATUS_BADGE: Record<string, string> = {
  novo: "bg-sky-50 text-sky-700 border-sky-200",
  enviado: "bg-blue-50 text-blue-700 border-blue-200",
  respondeu: "bg-emerald-50 text-emerald-700 border-emerald-200",
  quer_agendar_entrevista: "bg-amber-50 text-amber-700 border-amber-200",
  entrevista_agendada: "bg-purple-50 text-purple-700 border-purple-200",
  entrevista_confirmada: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  campanha: "bg-indigo-50 text-indigo-700 border-indigo-200",
  reagendar_futuro: "bg-cyan-50 text-cyan-700 border-cyan-200",
  contratado: "bg-lime-50 text-lime-700 border-lime-200",
  sem_interesse: "bg-slate-100 text-slate-700 border-slate-200",
  nao_aprovado: "bg-red-50 text-red-700 border-red-200",
  selecionado_vaga: "bg-blue-50 text-blue-700 border-blue-200",
  aprovado: "bg-green-50 text-green-700 border-green-200",
  nao_compareceu: "bg-orange-50 text-orange-700 border-orange-200",
};

const STATUS_MAP: Record<string, string> = {
  respondido: "respondeu",
  interesse: "quer_agendar_entrevista",
  pedido: "entrevista_agendada",
  reativar_futuro: "reagendar_futuro",
  finalizado: "contratado",
};

function normalizeStatus(status?: string | null) {
  const value = String(status || "novo").trim();
  return STATUS_MAP[value] || value || "novo";
}

function statusLabel(status?: string | null) {
  const normalized = normalizeStatus(status);
  return STATUS_LABELS[normalized] || STATUS_LABELS[status || ""] || status || "Novo";
}

function statusClass(status?: string | null) {
  return STATUS_BADGE[normalizeStatus(status)] || STATUS_BADGE.novo;
}

function formatPhone(phone?: string | null) {
  if (!phone) return "-";
  const digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
  return phone;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getLastDate(lead: any) {
  return lead.last_message_at || lead.updated_at || lead.created_at;
}

function shortText(value?: string | null, max = 70) {
  if (!value) return "";
  const text = String(value).trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function getJobTitle(lead: any) {
  return lead?.job_title || lead?.job?.title || lead?.job?.name || "-";
}

function getBatchName(lead: any) {
  return lead?.batch_name || lead?.batch?.name || "-";
}

export default function InboxPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const selectedLeadRef = useRef<any>(null);

  useEffect(() => {
    selectedLeadRef.current = selectedLead;
  }, [selectedLead]);

  const filteredLeads = leads.filter((lead) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;

    return [
      lead.name,
      lead.phone,
      lead.email,
      lead.last_message,
      getJobTitle(lead),
      getBatchName(lead),
      statusLabel(lead.status),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(term);
  });

  async function loadLeads() {
    try {
      const res = await fetch(`/api/crm/inbox?t=${Date.now()}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json().catch(() => []);

      if (!res.ok) return;

      setLeads(data || []);

      const current = selectedLeadRef.current;

      if (current?.id) {
        const updated = data.find((lead: any) => lead.id === current.id);
        if (updated) setSelectedLead(updated);
      } else if (data?.length) {
        setSelectedLead(data[0]);
      }
    } catch (error) {
      console.error("Erro loadLeads:", error);
    }
  }

  async function loadMessages(leadId: string) {
    try {
      const res = await fetch(`/api/crm/inbox?leadId=${leadId}&t=${Date.now()}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json().catch(() => []);

      if (!res.ok) return;

      setMessages(data || []);

      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (error) {
      console.error("Erro loadMessages:", error);
    }
  }

  useEffect(() => {
    loadLeads();

    const interval = setInterval(async () => {
      const current = selectedLeadRef.current;

      await loadLeads();

      if (current?.id) await loadMessages(current.id);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedLead?.id) return;
    loadMessages(selectedLead.id);
  }, [selectedLead?.id]);

  async function sendReply() {
    if (!reply.trim() || !selectedLead) return;

    const message = reply.trim();

    const tempMessage = {
      id: `temp-${Date.now()}`,
      lead_id: selectedLead.id,
      direction: "sent",
      content: message,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempMessage]);
    setReply("");
    setLoading(true);

    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    try {
      const res = await fetch("/api/whatsapp/inbox-send", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadId: selectedLead.id,
          message,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        alert(data?.error || "Erro ao enviar mensagem");

        setMessages((prev) =>
          prev.filter((msg) => msg.id !== tempMessage.id)
        );

        setReply(message);
        return;
      }

      await loadMessages(selectedLead.id);
      await loadLeads();
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      alert("Erro ao enviar mensagem");

      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id));
      setReply(message);
    } finally {
      setLoading(false);
    }
  }

  async function pauseAI() {
    if (!selectedLead) return;

    const nextPaused = !selectedLead.ai_paused;

    const res = await fetch("/api/crm/inbox", {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        leadId: selectedLead.id,
        ai_paused: nextPaused,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao atualizar IA");
      return;
    }

    setSelectedLead(data.lead || { ...selectedLead, ai_paused: nextPaused });
    await loadLeads();
  }

  return (
    <div className="flex h-[calc(100vh-48px)] flex-col gap-4 bg-gradient-to-br from-sky-50 via-white to-blue-100 p-3 text-slate-900 md:flex-row md:p-4">
      <aside className="flex h-[38vh] flex-col overflow-hidden rounded-[28px] border border-blue-100 bg-white shadow-xl shadow-blue-100/70 md:h-full md:w-96">
        <div className="border-b border-blue-100 p-4">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">
            Zentra RH
          </p>

          <div className="mt-1 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-slate-950">Inbox</h1>
              <p className="text-sm text-slate-500">
                Conversas com candidatos que responderam
              </p>
            </div>

            <button
              type="button"
              onClick={loadLeads}
              className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
            >
              Atualizar
            </button>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar candidato, vaga, lote, telefone ou mensagem..."
            className="mt-4 w-full rounded-2xl border border-blue-100 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {filteredLeads.map((lead) => {
            const active = selectedLead?.id === lead.id;

            return (
              <button
                key={lead.id}
                onClick={() => setSelectedLead(lead)}
                className={`w-full border-b border-blue-50 p-4 text-left transition hover:bg-blue-50/70 ${
                  active ? "bg-blue-50" : "bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-black text-slate-950">
                      {lead.name || "Candidato WhatsApp"}
                    </div>

                    <div className="mt-1 text-sm font-semibold text-slate-500">
                      {formatPhone(lead.phone)}
                    </div>
                  </div>

                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black ${statusClass(
                      lead.status
                    )}`}
                  >
                    {statusLabel(lead.status)}
                  </span>
                </div>

                <div className="mt-2 grid gap-1 rounded-2xl border border-blue-50 bg-slate-50 p-2 text-[11px] font-bold text-slate-500">
                  <span>Vaga: {getJobTitle(lead)}</span>
                  <span>Lote: {getBatchName(lead)}</span>
                </div>

                {lead.last_message && (
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    {shortText(lead.last_message, 92)}
                  </p>
                )}

                <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-slate-400">
                  <span>Sessão {lead.session_id || 1}</span>
                  <span>{formatDate(getLastDate(lead))}</span>
                </div>
              </button>
            );
          })}

          {!filteredLeads.length && (
            <div className="p-6 text-center text-sm text-slate-500">
              Nenhuma resposta recebida ainda.
            </div>
          )}
        </div>
      </aside>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-blue-100 bg-white shadow-xl shadow-blue-100/70">
        {!selectedLead ? (
          <div className="flex flex-1 items-center justify-center text-slate-500">
            Selecione uma conversa
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 border-b border-blue-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-black text-slate-950">
                    {selectedLead.name || "Candidato WhatsApp"}
                  </h2>

                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-black ${statusClass(
                      selectedLead.status
                    )}`}
                  >
                    {statusLabel(selectedLead.status)}
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  {formatPhone(selectedLead.phone)} · Última atualização:{" "}
                  {formatDate(getLastDate(selectedLead))}
                </p>

                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-blue-700">
                    Vaga: {getJobTitle(selectedLead)}
                  </span>
                  <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-indigo-700">
                    Lote: {getBatchName(selectedLead)}
                  </span>
                </div>
              </div>

              <button
                onClick={pauseAI}
                className={`rounded-2xl px-4 py-2 text-sm font-black shadow-sm ${
                  selectedLead.ai_paused
                    ? "border border-blue-200 bg-blue-50 text-blue-700"
                    : "bg-amber-500 text-white hover:bg-amber-600"
                }`}
              >
                {selectedLead.ai_paused ? "Ativar IA" : "Pausar IA"}
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-4">
              {messages.map((msg) => {
                const fromMe =
                  msg.direction === "sent" ||
                  msg.direction === "outgoing" ||
                  msg.from_me === true;

                const text = msg.content || msg.message || "";
                const mediaUrl = msg.media_url || msg.payload?.media_url;

                return (
                  <div
                    key={msg.id}
                    className={`flex ${
                      fromMe ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[86%] whitespace-pre-wrap rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-sm md:max-w-[72%] ${
                        fromMe
                          ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white"
                          : "border border-blue-100 bg-white text-slate-800"
                      }`}
                    >
                      {text && <p>{text}</p>}

                      {mediaUrl && (
                        <a
                          href={mediaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={`mt-2 block rounded-2xl px-3 py-2 text-xs font-black ${
                            fromMe
                              ? "bg-white/15 text-white"
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          Abrir mídia/anexo
                        </a>
                      )}

                      <p
                        className={`mt-2 text-[10px] font-bold ${
                          fromMe ? "text-blue-100" : "text-slate-400"
                        }`}
                      >
                        {formatDate(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}

              {!messages.length && (
                <div className="pt-10 text-center text-slate-500">
                  Nenhuma mensagem ainda.
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            <div className="flex flex-col gap-2 border-t border-blue-100 bg-white p-3 sm:flex-row">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                placeholder="Digite sua resposta para o candidato..."
                className="min-h-[58px] flex-1 resize-none rounded-2xl border border-blue-100 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                rows={2}
              />

              <button
                onClick={sendReply}
                disabled={loading || !reply.trim()}
                className="rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-200 hover:brightness-110 disabled:opacity-50"
              >
                {loading ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
