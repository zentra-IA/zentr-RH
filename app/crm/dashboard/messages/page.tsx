"use client";

import { useEffect, useRef, useState } from "react";

const CAMPAIGN_INTENTS = [
  {
    value: "RH_ABERTURA",
    label: "Abertura de vaga",
    desc: "Primeira mensagem para chamar o candidato selecionado.",
  },
  {
    value: "RH_ENTREVISTA",
    label: "Convite para entrevista",
    desc: "Mensagem para convidar o candidato para entrevista.",
  },
  {
    value: "RH_RELEMBRETE",
    label: "Lembrete de entrevista",
    desc: "Aviso antes da entrevista para reduzir faltas.",
  },
  {
    value: "RH_REAGENDAMENTO",
    label: "Reagendamento",
    desc: "Mensagem para reorganizar data e horário.",
  },
  {
    value: "RH_BANCO_TALENTOS",
    label: "Banco de talentos",
    desc: "Mensagem para manter bons perfis para vagas futuras.",
  },
];

const AI_INTENTS = [
  {
    value: "OPENING",
    label: "Primeira resposta",
    desc: "Quando o candidato chama pela primeira vez.",
  },
  {
    value: "FAQ_CUSTOM",
    label: "Resposta automática personalizada",
    desc: "Quando o candidato escrever uma das palavras configuradas, o robô responde automaticamente.",
  },
  {
    value: "INTERESSE_ENTREVISTA",
    label: "Detectar interesse",
    desc: "Quando o candidato demonstra interesse em agendar entrevista.",
  },
  {
    value: "AGENDAMENTO",
    label: "Agendamento",
    desc: "Quando o candidato confirma data ou horário de entrevista.",
  },
  {
    value: "SEM_INTERESSE",
    label: "Sem interesse",
    desc: "Quando o candidato informa que não quer participar.",
  },
  {
    value: "REAGENDAR_FUTURO",
    label: "Reagendar futuro",
    desc: "Quando o candidato tem bom perfil, mas não pode agora.",
  },
  {
    value: "DEFAULT",
    label: "Resposta padrão",
    desc: "Quando o robô não encontrar uma resposta específica.",
  },
];

const KANBAN_STATUS = [
  { value: "", label: "Não alterar etapa" },
  { value: "novo", label: "Novo" },
  { value: "enviado", label: "Enviado" },
  { value: "respondeu", label: "Respondeu" },
  { value: "quer_agendar_entrevista", label: "Quer agendar entrevista" },
  { value: "entrevista_agendada", label: "Agendou entrevista" },
  { value: "campanha", label: "Campanha" },
  { value: "reagendar_futuro", label: "Reagendar futuro" },
  { value: "contratado", label: "Contratado" },
  { value: "sem_interesse", label: "Sem interesse" },
  { value: "nao_aprovado", label: "Não aprovado" },
];

const VARIABLES = [
  { label: "Nome", value: "{nome}" },
  { label: "Telefone", value: "{telefone}" },
  { label: "Vaga", value: "{vaga}" },
  { label: "Empresa", value: "{empresa}" },
  { label: "Link agendamento", value: "{link_agendamento}" },
  { label: "Cidade", value: "{cidade}" },
  { label: "Estado", value: "{estado}" },
  { label: "Tipo contrato", value: "{tipo_contrato}" },
  { label: "Salário/bolsa", value: "{salario}" },
  { label: "Horário trabalho", value: "{horario_trabalho}" },
  { label: "Local", value: "{local}" },
  { label: "Benefícios", value: "{beneficios}" },
  { label: "Descrição da vaga", value: "{descricao_vaga}" },
  { label: "Recrutador", value: "{recrutador}" },
  { label: "Última mensagem", value: "{ultima_mensagem}" },
  { label: "Link WhatsApp", value: "{link_whatsapp}" },
  { label: "Data da entrevista", value: "{data_entrevista}" },
];

const DEFAULT_NOTIFY_MESSAGE =
  "🚨 Novo candidato no atendimento\n\nCandidato: {nome}\nTelefone: {telefone}\n\nÚltima mensagem:\n{ultima_mensagem}\n\nAbrir conversa:\n{link_whatsapp}";

function hasFeature(data: any, feature: string) {
  const fromPlan = data?.features?.some(
    (item: any) => item.feature === feature && item.enabled
  );

  const fromGrant = data?.grants?.some((item: any) => {
    if (item.feature !== feature || !item.active) return false;
    if (!item.expires_at) return true;
    return new Date(item.expires_at) > new Date();
  });

  return Boolean(fromPlan || fromGrant);
}

function formatTriggers(value: any) {
  if (Array.isArray(value)) return value.join("\n");
  return "";
}

function formatVariations(value: any) {
  if (Array.isArray(value)) {
    return value
      .map((item) => item?.content || "")
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function flowModeLabel(value: any) {
  return value === "sequence" ? "Fluxo em ordem" : "Resposta avulsa";
}

export default function MessagesPage() {
  const messageRef = useRef<HTMLTextAreaElement | null>(null);
  const notifyRef = useRef<HTMLTextAreaElement | null>(null);

  const [companyData, setCompanyData] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [previewJobId, setPreviewJobId] = useState("");
  const [previewName, setPreviewName] = useState("João");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [type, setType] = useState<"campaign" | "ai">("campaign");
  const [name, setName] = useState("");
  const [intent, setIntent] = useState("OPENING");
  const [baseMessage, setBaseMessage] = useState("");
  const [messageVariations, setMessageVariations] = useState("");
  const [triggerKeywords, setTriggerKeywords] = useState("");
  const [matchType, setMatchType] = useState("contains");
  const [kanbanStatus, setKanbanStatus] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("text");

  const [flowMode, setFlowMode] = useState("global");
  const [flowStep, setFlowStep] = useState("");
  const [nextStep, setNextStep] = useState("");

  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyNumber, setNotifyNumber] = useState("");
  const [notifyMessage, setNotifyMessage] = useState(DEFAULT_NOTIFY_MESSAGE);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const canUseChatbot = hasFeature(companyData, "chatbot_ia");
  const intents = type === "campaign" ? CAMPAIGN_INTENTS : AI_INTENTS;
  const selectedIntent = intents.find((item) => item.value === intent);
  const isCustomTrigger = type === "ai" && intent === "FAQ_CUSTOM";

  async function loadCompany() {
    const res = await fetch("/api/company/current", {
      cache: "no-store",
      credentials: "include",
    });

    const data = await res.json();
    if (data?.success) setCompanyData(data);
  }

  async function loadTemplates() {
    const res = await fetch("/api/crm/message-templates", {
      credentials: "include",
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Erro ao carregar mensagens");
      return;
    }

    setTemplates(data || []);
  }

  async function loadJobs() {
    const res = await fetch("/api/rh/jobs?status=open", {
      credentials: "include",
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setJobs(data.jobs || []);
    }
  }

  useEffect(() => {
    loadCompany();
    loadTemplates();
    loadJobs();
  }, []);


  function formatMoney(value: any) {
    const number = Number(value || 0);
    if (!Number.isFinite(number) || number <= 0) return "";

    return number.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function salaryText(job: any) {
    if (!job) return "";

    if (job.salary) return String(job.salary);
    if (job.salaryRange) return String(job.salaryRange);
    if (job.salary_range) return String(job.salary_range);

    const min = formatMoney(job.salaryMin || job.salary_min);
    const max = formatMoney(job.salaryMax || job.salary_max);

    if (min && max) return `${min} a ${max}`;
    if (min) return `A partir de ${min}`;
    if (max) return `Até ${max}`;

    return "";
  }

  function jobLocal(job: any) {
    if (!job) return "";

    return [
      job.neighborhood,
      job.city,
      job.state,
    ]
      .filter(Boolean)
      .join(" / ");
  }

  function jobShift(job: any) {
    return (
      job?.shift ||
      job?.requirements?.shift ||
      job?.filters?.shift ||
      job?.workSchedule ||
      job?.work_schedule ||
      ""
    );
  }

  function jobBenefits(job: any) {
    const value =
      job?.benefits ||
      job?.requirements?.benefits ||
      job?.filters?.benefits ||
      job?.aiCriteria?.benefits ||
      "";

    if (Array.isArray(value)) return value.join(", ");
    return String(value || "");
  }
function buildPreviewMessage() {
  const job = jobs.find((item) => String(item.id) === String(previewJobId));

 const origin =
  typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:3000";

const scheduleLink = previewJobId
  ? `${origin}/agenda/exemplo-${String(previewJobId).slice(0, 8)}`
  : `${origin}/agenda/exemplo`;

    const replacements: Record<string, string> = {
      "{nome}": previewName || "João",
      "{telefone}": "5511999999999",
      "{vaga}": job?.title || "Auxiliar Administrativo",
      "{cargo}": job?.title || "Auxiliar Administrativo",
      "{empresa}": companyData?.company?.name || companyData?.name || "Zentra RH",
      "{link_agendamento}": scheduleLink,
      "{link}": scheduleLink,
      "{link_entrevista}": scheduleLink,
      "{cidade}": job?.city || "São Paulo",
      "{estado}": job?.state || "SP",
      "{bairro}": job?.neighborhood || "",
      "{local}": jobLocal(job) || "São Paulo / SP",
      "{tipo_contrato}": job?.contractType || job?.contract_type || "CLT",
      "{salario}": salaryText(job) || "A combinar",
      "{horario_trabalho}": jobShift(job) || "Horário comercial",
      "{beneficios}": jobBenefits(job) || "Benefícios informados na entrevista",
      "{descricao_vaga}": job?.description || "Descrição da vaga cadastrada no sistema.",
      "{recrutador}": job?.recruiterName || job?.recruiter_name || "RH",
      "{ultima_mensagem}": "Tenho interesse",
      "{link_whatsapp}": "https://wa.me/5511999999999",
      "{data_entrevista}": "26/06 às 09:00",
    };

    let result = baseMessage || "Digite uma mensagem principal para visualizar.";

    Object.entries(replacements).forEach(([key, value]) => {
      result = result.split(key).join(value || "");
    });

    return result.trim();
  }

  function resetForm() {
    setEditingId(null);
    setType("campaign");
    setName("");
    setIntent("OPENING");
    setBaseMessage("");
    setMessageVariations("");
    setTriggerKeywords("");
    setMatchType("contains");
    setKanbanStatus("");
    setMediaUrl("");
    setMediaType("text");
    setFlowMode("global");
    setFlowStep("");
    setNextStep("");
    setNotifyEnabled(false);
    setNotifyNumber("");
    setNotifyMessage(DEFAULT_NOTIFY_MESSAGE);
    setPreviewJobId("");
    setPreviewName("João");
  }

  function changeType(nextType: "campaign" | "ai") {
    if (nextType === "ai" && !canUseChatbot) {
      alert("Chatbot IA está bloqueado no seu plano atual.");
      return;
    }

    setType(nextType);
    setIntent("OPENING");
    setTriggerKeywords("");
    setKanbanStatus("");
    setMessageVariations("");
    setFlowMode("global");
    setFlowStep("");
    setNextStep("");
  }

  function insertVariable(target: "message" | "notify", variable: string) {
    if (target === "message") {
      const textarea = messageRef.current;
      const start = textarea?.selectionStart ?? baseMessage.length;
      const end = textarea?.selectionEnd ?? baseMessage.length;
      const next =
        baseMessage.slice(0, start) + variable + baseMessage.slice(end);

      setBaseMessage(next);

      setTimeout(() => {
        textarea?.focus();
        textarea?.setSelectionRange(
          start + variable.length,
          start + variable.length
        );
      }, 0);
    }

    if (target === "notify") {
      const textarea = notifyRef.current;
      const start = textarea?.selectionStart ?? notifyMessage.length;
      const end = textarea?.selectionEnd ?? notifyMessage.length;
      const next =
        notifyMessage.slice(0, start) + variable + notifyMessage.slice(end);

      setNotifyMessage(next);

      setTimeout(() => {
        textarea?.focus();
        textarea?.setSelectionRange(
          start + variable.length,
          start + variable.length
        );
      }, 0);
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "message-templates");

      const res = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || data.details || "Erro ao enviar arquivo");
        return;
      }

      setMediaUrl(data.mediaUrl || data.url);
      setMediaType(data.mediaType || "file");
    } finally {
      setUploading(false);
    }
  }

  function editTemplate(item: any) {
    setEditingId(item.id);
    setType(item.type || "campaign");
    setName(item.name || "");
    setIntent(item.intent || "OPENING");
    setBaseMessage(item.base_message || "");

    setMessageVariations(
      Array.isArray(item.message_variations)
        ? item.message_variations.map((v: any) => v.content).join("\n")
        : ""
    );

    setTriggerKeywords(
      Array.isArray(item.trigger_keywords)
        ? item.trigger_keywords.join("\n")
        : ""
    );

    setMatchType(item.match_type || "contains");
    setKanbanStatus(item.kanban_status || "");
    setMediaUrl(item.media_url || "");
    setMediaType(item.media_type || "text");
    setFlowMode(item.flow_mode || "global");
    setFlowStep(item.flow_step ? String(item.flow_step) : "");
    setNextStep(item.next_step ? String(item.next_step) : "");
    setNotifyEnabled(Boolean(item.notify_enabled));
    setNotifyNumber(item.notify_number || "");
    setNotifyMessage(item.notify_message || DEFAULT_NOTIFY_MESSAGE);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function saveTemplate() {
    if (type === "ai" && !canUseChatbot) {
      alert("Chatbot IA está bloqueado no seu plano atual.");
      return;
    }

    if (!name.trim() || !baseMessage.trim()) {
      alert("Preencha nome da automação e mensagem principal.");
      return;
    }

    if (isCustomTrigger && !triggerKeywords.trim()) {
      alert("Preencha pelo menos uma frase que o candidato pode escrever.");
      return;
    }

    if (isCustomTrigger && flowMode === "sequence" && !flowStep.trim()) {
      alert("Informe a etapa atual do fluxo.");
      return;
    }

    if (notifyEnabled && !notifyNumber.trim()) {
      alert("Informe o WhatsApp interno que receberá a notificação.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/crm/message-templates", {
        method: editingId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          type,
          name,
          intent,
          base_message: baseMessage,
          message_variations: messageVariations,
          trigger_keywords: triggerKeywords,
          match_type: matchType,
          media_url: mediaUrl || null,
          media_type: mediaUrl ? mediaType : "text",
          kanban_status: kanbanStatus || null,
          flow_mode: isCustomTrigger ? flowMode : "global",
          flow_step: isCustomTrigger && flowMode === "sequence" ? flowStep : null,
          next_step: isCustomTrigger && flowMode === "sequence" ? nextStep || null : null,
          notify_enabled: notifyEnabled,
          notify_number: notifyNumber,
          notify_message: notifyMessage,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Erro ao salvar mensagem");
        return;
      }

      resetForm();
      await loadTemplates();
    } finally {
      setLoading(false);
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Excluir esta mensagem?")) return;

    const res = await fetch(`/api/crm/message-templates?id=${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Erro ao excluir mensagem");
      return;
    }

    await loadTemplates();
  }

  async function toggleTemplate(item: any) {
    const res = await fetch("/api/crm/message-templates", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item.id,
        active: !item.active,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Erro ao atualizar mensagem");
      return;
    }

    await loadTemplates();
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-100 px-4 py-5 text-slate-900 md:px-6">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-100/70 md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-600">
            Zentra RH
          </p>

          <h1 className="mt-2 text-3xl font-black md:text-5xl">
            Mensagens e automações de RH
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Crie mensagens de campanha, convites de entrevista, respostas automáticas, fluxos de WhatsApp, mídia e movimentação no Kanban de candidatos.
          </p>
        </section>

        <section className="mt-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-100/60">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">
              {editingId ? "Editar mensagem / automação" : "Nova mensagem / automação"}
            </h2>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
              >
                Cancelar edição
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <select
              value={type}
              onChange={(e) => changeType(e.target.value as "campaign" | "ai")}
              className="input"
            >
              <option value="campaign">Campanha / disparo para candidatos</option>
              <option value="ai">
                Resposta automática no WhatsApp {canUseChatbot ? "" : "🔒"}
              </option>
            </select>

            <select
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              className="input"
            >
              {intents.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            {selectedIntent && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 md:col-span-2">
                <strong>{selectedIntent.label}:</strong> {selectedIntent.desc}
              </div>
            )}

            {isCustomTrigger && (
              <>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-black">
                    O que o candidato pode escrever
                  </label>
                  <textarea
                    value={triggerKeywords}
                    onChange={(e) => setTriggerKeywords(e.target.value)}
                    placeholder={`Digite uma opção por linha.\nEx:\nsim\nquero\ntenho interesse\nonde pegou meu contato`}
                    className="input min-h-32"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Se o candidato enviar qualquer uma dessas frases, o robô envia a resposta configurada abaixo.
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-100 bg-sky-50 p-4 md:col-span-2">
                  <label className="mb-2 block text-sm font-black">
                    Tipo de resposta
                  </label>

                  <div className="grid gap-3 md:grid-cols-3">
                    <select
                      value={flowMode}
                      onChange={(e) => {
                        setFlowMode(e.target.value);
                        if (e.target.value === "global") {
                          setFlowStep("");
                          setNextStep("");
                        }
                      }}
                      className="input"
                    >
                      <option value="global">Resposta avulsa</option>
                      <option value="sequence">Fluxo em ordem</option>
                    </select>

                    {flowMode === "sequence" && (
                      <>
                        <input
                          type="number"
                          min="1"
                          value={flowStep}
                          onChange={(e) => setFlowStep(e.target.value)}
                          placeholder="Etapa atual. Ex: 1"
                          className="input"
                        />

                        <input
                          type="number"
                          min="1"
                          value={nextStep}
                          onChange={(e) => setNextStep(e.target.value)}
                          placeholder="Próxima etapa. Ex: 2"
                          className="input"
                        />
                      </>
                    )}
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    Resposta avulsa funciona a qualquer momento. Fluxo em ordem
                    só responde quando o candidato estiver na etapa configurada.
                  </p>
                </div>

                <select
                  value={matchType}
                  onChange={(e) => setMatchType(e.target.value)}
                  className="input"
                >
                  <option value="contains">
                    Palavra em qualquer lugar da mensagem
                  </option>
                  <option value="exact">Mensagem igual exatamente</option>
                  <option value="starts_with">Mensagem começa com</option>
                </select>

                <select
                  value={kanbanStatus}
                  onChange={(e) => setKanbanStatus(e.target.value)}
                  className="input"
                >
                  {KANBAN_STATUS.map((item) => (
                    <option key={item.value || "none"} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </>
            )}

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da mensagem. Ex: Etapa 1 - Convite entrevista, Interesse, Reagendamento"
              className="input md:col-span-2"
            />

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-black">
                Mensagem principal
              </label>

              <textarea
                ref={messageRef}
                value={baseMessage}
                onChange={(e) => setBaseMessage(e.target.value)}
                placeholder="Ex: Olá {nome}, tudo bem? Seu perfil foi selecionado para a vaga de {vaga}. Quer participar do processo seletivo?"
                className="input min-h-36"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                {VARIABLES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => insertVariable("message", item.value)}
                    className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
                  >
                    + {item.label}
                  </button>
                ))}
              </div>

              <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-900">
                <p className="font-black">Variáveis de vaga/lote</p>
                <p className="mt-1">
                  No disparo real, quem define a vaga é o lote do candidato. Aqui você só usa as variáveis.
                  O sistema substitui automaticamente:
                  <b> {"{vaga}"}</b>, <b>{"{link_agendamento}"}</b>, <b>{"{descricao_vaga}"}</b>,
                  <b> {"{salario}"}</b>, <b>{"{horario_trabalho}"}</b>, <b>{"{local}"}</b> e demais dados da vaga.
                </p>
              </div>

              <div className="mt-4 rounded-[1.5rem] border border-blue-100 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <div className="flex-1">
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-blue-600">
                      Pré-visualização com vaga real
                    </label>
                    <select
                      value={previewJobId}
                      onChange={(e) => setPreviewJobId(e.target.value)}
                      className="input"
                    >
                      <option value="">Usar exemplo padrão</option>
                      {jobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.title} {job.city ? `• ${job.city}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full md:w-48">
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-blue-600">
                      Nome teste
                    </label>
                    <input
                      value={previewName}
                      onChange={(e) => setPreviewName(e.target.value)}
                      className="input"
                      placeholder="Nome"
                    />
                  </div>
                </div>

                <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-dashed border-blue-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                  {buildPreviewMessage()}
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Essa prévia é só para você testar. No envio real, o lote define a vaga correta automaticamente.
                </p>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-black">
                Variações da mensagem
              </label>

              <textarea
                value={messageVariations}
                onChange={(e) => setMessageVariations(e.target.value)}
                placeholder={`Digite uma variação por linha.\nEx:\nOi {nome}, tudo bem?\nOlá {nome}, tudo certo?\nOpa {nome}, posso te mandar uma informação?`}
                className="input min-h-40"
              />

              <p className="mt-2 text-xs text-slate-500">
                O sistema escolhe uma versão aleatória em cada disparo ou resposta.
              </p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-slate-50 p-4 md:col-span-2">
              <p className="text-sm font-black">Mídia opcional</p>
              <p className="mt-1 text-xs text-slate-500">
                Anexe áudio, imagem, PDF ou vídeo para enviar junto com a resposta.
              </p>

              <input
                type="file"
                accept="image/*,audio/*,video/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFile(file);
                }}
                className="mt-3 block w-full text-sm text-slate-700"
              />

              {uploading && (
                <p className="mt-2 text-xs text-yellow-300">
                  Enviando arquivo...
                </p>
              )}

              {mediaUrl && (
                <div className="mt-3 rounded-xl border border-blue-100 bg-white p-3 text-xs text-slate-700">
                  <p>
                    <strong>Arquivo:</strong> {mediaType}
                  </p>
                  <p className="mt-1 break-all text-slate-500">{mediaUrl}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setMediaUrl("");
                      setMediaType("text");
                    }}
                    className="mt-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-black text-white"
                  >
                    Remover mídia
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 md:col-span-2">
              <label className="flex items-center gap-3 text-sm font-black">
                <input
                  type="checkbox"
                  checked={notifyEnabled}
                  onChange={(e) => setNotifyEnabled(e.target.checked)}
                />
                Avisar alguém da equipe quando essa automação disparar
              </label>

              <p className="mt-2 text-xs text-slate-500">
                Use isso para mandar um alerta interno para outro WhatsApp, como
                vendedor, atendente, gerente ou equipe de RH.
              </p>

              {notifyEnabled && (
                <div className="mt-4 grid gap-3">
                  <input
                    value={notifyNumber}
                    onChange={(e) => setNotifyNumber(e.target.value)}
                    placeholder="WhatsApp da equipe. Ex: 5511999999999"
                    className="input"
                  />

                  <textarea
                    ref={notifyRef}
                    value={notifyMessage}
                    onChange={(e) => setNotifyMessage(e.target.value)}
                    placeholder="Mensagem que a equipe vai receber"
                    className="input min-h-36"
                  />

                  <div className="flex flex-wrap gap-2">
                    {VARIABLES.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => insertVariable("notify", item.value)}
                        className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
                      >
                        + {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={saveTemplate}
            disabled={loading || uploading}
            className="mt-4 w-full rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-blue-300/40 hover:brightness-110 disabled:opacity-50 md:w-auto"
          >
            {loading
              ? "Salvando..."
              : editingId
              ? "Atualizar automação"
              : "Salvar automação"}
          </button>
        </section>

        <section className="mt-5 grid gap-4">
          {templates.map((item) => (
            <article
              key={item.id}
              className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-100/50"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-lg font-black">{item.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.type === "campaign" ? "Campanha" : "Chatbot"} ·{" "}
                    {item.intent} · {item.active ? "Ativa" : "Inativa"}
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    Tipo: <strong>{flowModeLabel(item.flow_mode)}</strong>
                    {item.flow_mode === "sequence" && (
                      <>
                        {" "}· Etapa atual: <strong>{item.flow_step || 1}</strong>
                        {" "}· Próxima etapa: <strong>{item.next_step || "não avança"}</strong>
                      </>
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => editTemplate(item)}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700"
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleTemplate(item)}
                    className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
                  >
                    {item.active ? "Desativar" : "Ativar"}
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteTemplate(item.id)}
                    className="rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white hover:bg-red-700"
                  >
                    Excluir
                  </button>
                </div>
              </div>

              {item.trigger_keywords?.length > 0 && (
                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                  <strong>Candidato pode escrever:</strong>
                  <pre className="mt-2 whitespace-pre-wrap text-xs">
                    {formatTriggers(item.trigger_keywords)}
                  </pre>
                </div>
              )}

              <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                {item.base_message}
              </div>

              {item.message_variations?.length > 0 && (
                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                  <strong>Variações:</strong>
                  <pre className="mt-2 whitespace-pre-wrap text-xs">
                    {formatVariations(item.message_variations)}
                  </pre>
                </div>
              )}

              {item.notify_enabled && (
                <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                  <p>
                    <strong>Avisa equipe:</strong> {item.notify_number}
                  </p>
                  {item.notify_message && (
                    <pre className="mt-2 whitespace-pre-wrap text-xs text-blue-700">
                      {item.notify_message}
                    </pre>
                  )}
                </div>
              )}

              {item.media_url && (
                <div className="mt-4 rounded-2xl border border-blue-100 bg-slate-50 p-4 text-sm text-slate-700">
                  <p>
                    <strong>Mídia:</strong> {item.media_type}
                  </p>
                  <a
                    href={item.media_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block break-all text-blue-600"
                  >
                    {item.media_url}
                  </a>
                </div>
              )}

              {item.kanban_status && (
                <p className="mt-3 text-xs text-slate-500">
                  Move candidato para: <strong>{item.kanban_status}</strong>
                </p>
              )}
            </article>
          ))}
        </section>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 16px;
          border: 1px solid #bfdbfe;
          background: #f8fafc;
          padding: 13px 14px;
          color: #0f172a;
          outline: none;
          font-size: 14px;
        }

        .input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.14);
        }

        .input::placeholder {
          color: #94a3b8;
        }
      `}</style>
    </main>
  );
}
