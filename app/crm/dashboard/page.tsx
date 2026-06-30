"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const STAGES = [
  {
    key: "novo",
    label: "Novo",
    description: "Candidatos que iniciaram o disparo",
    color: "from-sky-500 to-blue-600",
    badge: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  },
  {
    key: "enviado",
    label: "Enviado",
    description: "Mensagens enviadas",
    color: "from-indigo-500 to-violet-600",
    badge: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  },
  {
    key: "respondeu",
    label: "Respondeu",
    description: "Candidatos que responderam",
    color: "from-emerald-500 to-green-600",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  {
    key: "quer_agendar_entrevista",
    label: "Quer agendar entrevista",
    description: "Interessados em marcar entrevista",
    color: "from-amber-400 to-orange-500",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  {
    key: "entrevista_agendada",
    label: "Agendou entrevista",
    description: "Entrevista já agendada",
    color: "from-fuchsia-500 to-pink-600",
    badge: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  },
  {
    key: "campanha",
    label: "Campanha",
    description: "Fila para disparos de campanhas",
    color: "from-purple-500 to-violet-700",
    badge: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  },
  {
    key: "reagendar_futuro",
    label: "Reagendar futuro",
    description: "Bom perfil para futuras vagas",
    color: "from-cyan-500 to-teal-600",
    badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  },
  {
    key: "contratado",
    label: "Contratado",
    description: "Candidato contratado",
    color: "from-lime-500 to-green-700",
    badge: "bg-lime-500/15 text-lime-300 border-lime-500/30",
  },
  {
    key: "sem_interesse",
    label: "Sem interesse",
    description: "Não quis marcar entrevista",
    color: "from-zinc-500 to-zinc-700",
    badge: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  },
  {
    key: "nao_aprovado",
    label: "Não aprovado",
    description: "Não aprovado na entrevista",
    color: "from-red-500 to-rose-700",
    badge: "bg-red-500/15 text-red-300 border-red-500/30",
  },
];

const LEGACY_STATUS_MAP: Record<string, string> = {
  respondido: "respondeu",
  interesse: "quer_agendar_entrevista",
  pedido: "entrevista_agendada",
  finalizado: "contratado",
  reativar_futuro: "reagendar_futuro",
};

function normalizeStatus(status?: string | null) {
  const value = String(status || "novo").trim();
  return LEGACY_STATUS_MAP[value] || value || "novo";
}

function getStage(status?: string | null) {
  const normalized = normalizeStatus(status);
  return STAGES.find((stage) => stage.key === normalized) || STAGES[0];
}

function getLastDate(lead: any) {
  return lead.last_message_at || lead.updated_at || lead.created_at;
}

function daysStopped(lead: any) {
  const date = getLastDate(lead);
  if (!date) return 0;

  const diff = Date.now() - new Date(date).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(date: string) {
  if (!date) return "-";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPhone(phone?: string | null) {
  if (!phone) return "-";

  const digits = String(phone).replace(/\D/g, "");

  if (digits.length >= 12 && digits.startsWith("55")) {
    return `+${digits}`;
  }

  return phone;
}

function shortText(text?: string | null, max = 90) {
  if (!text) return "";
  const value = String(text).trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

export default function DashboardPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedStage, setSelectedStage] = useState("todos");

  async function loadDashboard() {
    try {
      setLoading(true);

      const res = await fetch("/api/crm/leads", {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Erro ao carregar leads");
      }

      setLeads(Array.isArray(data) ? data : data.leads || []);
    } catch (error: any) {
      console.error("ERRO DASHBOARD:", error);
      alert("Erro ao carregar funil:\n\n" + (error.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();

    const interval = setInterval(() => {
      loadDashboard();
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase();

    return leads.filter((lead) => {
      const stage = normalizeStatus(lead.status);

      if (selectedStage !== "todos" && stage !== selectedStage) {
        return false;
      }

      if (!term) return true;

      return [
        lead.name,
        lead.phone,
        lead.email,
        lead.last_message,
        lead.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [leads, search, selectedStage]);

  const grouped = useMemo(() => {
    const result: Record<string, any[]> = {};

    STAGES.forEach((stage) => {
      result[stage.key] = [];
    });

    filteredLeads.forEach((lead) => {
      const status = normalizeStatus(lead.status);
      const key = STAGES.some((stage) => stage.key === status) ? status : "novo";
      result[key].push(lead);
    });

    Object.keys(result).forEach((key) => {
      result[key].sort((a, b) => daysStopped(b) - daysStopped(a));
    });

    return result;
  }, [filteredLeads]);

  const stats = useMemo(() => {
    return {
      total: leads.length,
      novo: leads.filter((lead) => normalizeStatus(lead.status) === "novo").length,
      enviado: leads.filter((lead) => normalizeStatus(lead.status) === "enviado").length,
      respondeu: leads.filter((lead) => normalizeStatus(lead.status) === "respondeu").length,
      entrevista: leads.filter((lead) =>
        ["quer_agendar_entrevista", "entrevista_agendada"].includes(
          normalizeStatus(lead.status)
        )
      ).length,
      contratado: leads.filter((lead) => normalizeStatus(lead.status) === "contratado").length,
    };
  }, [leads]);

  async function moveLead(id: string, status: string) {
    try {
      setMovingId(id);

      const res = await fetch("/api/crm/leads/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          id,
          status,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Erro ao mover contato");
      }

      setLeads((current) =>
        current.map((lead) => (lead.id === id ? { ...lead, status } : lead))
      );
    } catch (error: any) {
      console.error("ERRO MOVE LEAD:", error);
      alert("Erro ao mover contato:\n\n" + (error.message || "Erro desconhecido"));
    } finally {
      setMovingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <section className="sticky top-0 z-20 border-b border-white/10 bg-[#050816]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-[1800px] px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 font-black text-white shadow-lg shadow-blue-500/20">
                  Z
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
                    Zentra RH
                  </p>
                  <h1 className="text-2xl font-black sm:text-4xl">
                    Kanban de recrutamento
                  </h1>
                </div>
              </div>

              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Acompanhe disparos, respostas, entrevistas, campanhas e decisões
                do funil de candidatos em tempo real.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Link className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white hover:bg-white/10" href="/crm/dashboard/contacts">
                Contatos
              </Link>
              <Link className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white hover:bg-white/10" href="/crm/dashboard/inbox">
                Inbox
              </Link>
              <Link className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white hover:bg-white/10" href="/crm/dashboard/messages">
                Mensagens
              </Link>
              <Link className="rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-3 text-center text-sm font-black text-white shadow-lg shadow-purple-900/30 hover:brightness-110" href="/crm/dashboard/campaigns">
                Campanhas
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px_140px]">
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
              placeholder="Buscar por nome, telefone, e-mail ou última mensagem..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <select
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
              value={selectedStage}
              onChange={(event) => setSelectedStage(event.target.value)}
            >
              <option className="bg-slate-950" value="todos">
                Todos os status
              </option>

              {STAGES.map((stage) => (
                <option className="bg-slate-950" key={stage.key} value={stage.key}>
                  {stage.label}
                </option>
              ))}
            </select>

            <button
              className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-black text-cyan-200 hover:bg-cyan-400/20 disabled:opacity-60"
              disabled={loading}
              onClick={loadDashboard}
              type="button"
            >
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1800px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard title="Total" value={stats.total} />
          <MetricCard title="Novo" value={stats.novo} />
          <MetricCard title="Enviado" value={stats.enviado} />
          <MetricCard title="Respondeu" value={stats.respondeu} />
          <MetricCard title="Entrevistas" value={stats.entrevista} />
          <MetricCard title="Contratados" value={stats.contratado} />
        </div>
      </section>

      <section className="mx-auto max-w-[1800px] px-4 pb-8 sm:px-6 lg:px-8">
        <div className="overflow-x-auto pb-4">
          <div className="flex min-w-max gap-4">
            {STAGES.map((stage) => {
              const items = grouped[stage.key] || [];

              return (
                <div
                  key={stage.key}
                  className="w-[310px] shrink-0 overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/20 sm:w-[350px]"
                >
                  <div className={`h-1.5 bg-gradient-to-r ${stage.color}`} />

                  <div className="border-b border-white/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-black">{stage.label}</h2>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                          {stage.description}
                        </p>
                      </div>

                      <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${stage.badge}`}>
                        {items.length}
                      </span>
                    </div>
                  </div>

                  <div className="max-h-[calc(100vh-310px)] min-h-[440px] space-y-3 overflow-y-auto p-3">
                    {items.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        moving={movingId === lead.id}
                        onMove={moveLead}
                      />
                    ))}

                    {!items.length && (
                      <div className="grid min-h-[220px] place-items-center rounded-3xl border border-dashed border-white/10 bg-black/20 p-6 text-center">
                        <div>
                          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-xl">
                            —
                          </div>
                          <p className="text-sm font-bold text-slate-400">
                            Nenhum candidato aqui.
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            Quando mudar o status, ele aparece nesta coluna.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ title, value }: { title: string; value: any }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-xl shadow-black/10">
      <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
        {title}
      </div>
      <div className="mt-2 text-3xl font-black text-white">{value}</div>
    </div>
  );
}

function LeadCard({
  lead,
  moving,
  onMove,
}: {
  lead: any;
  moving: boolean;
  onMove: (id: string, status: string) => void;
}) {
  const stage = getStage(lead.status);
  const stoppedDays = daysStopped(lead);

  return (
    <article className="rounded-3xl border border-white/10 bg-[#070b18] p-4 shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-white/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-black text-white">
            {lead.name || "Contato WhatsApp"}
          </h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {formatPhone(lead.phone)}
          </p>
        </div>

        <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black ${stage.badge}`}>
          {stage.label}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Parado há
          </span>
          <strong className={stoppedDays >= 3 ? "text-amber-300" : "text-slate-200"}>
            {stoppedDays} dia(s)
          </strong>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Atualizado
          </span>
          <strong className="text-slate-300">{formatDate(getLastDate(lead))}</strong>
        </div>
      </div>

      {lead.status === "campanha" && (
        <div className="mt-3 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-3 text-xs font-bold text-purple-200">
          Campanha etapa {lead.campaign_step || 0}
        </div>
      )}

      {normalizeStatus(lead.status) === "reagendar_futuro" && (
        <div className="mt-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs font-bold text-cyan-200">
          Guardar para futuras vagas
        </div>
      )}

      {lead.last_message && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-slate-400">
          {shortText(lead.last_message, 130)}
        </div>
      )}

      <div className="mt-4">
        <select
          disabled={moving}
          value={normalizeStatus(lead.status)}
          onChange={(event) => onMove(lead.id, event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-white outline-none disabled:opacity-50"
        >
          {STAGES.map((stage) => (
            <option className="bg-slate-950" key={stage.key} value={stage.key}>
              {stage.label}
            </option>
          ))}
        </select>
      </div>

      <Link
        href={`/crm/dashboard/inbox?leadId=${lead.id}`}
        className="mt-3 block rounded-2xl bg-white/10 px-3 py-2.5 text-center text-sm font-black text-white hover:bg-white/15"
      >
        Abrir conversa
      </Link>
    </article>
  );
}
