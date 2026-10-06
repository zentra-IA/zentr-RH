"use client";

import { useEffect, useMemo, useState } from "react";

type WorkerType = "CLT" | "ESTAGIO";

type DocumentType =
  | "CONTRATO_TRABALHO"
  | "REGIMENTO_COLABORADOR"
  | "TCE"
  | "REGIMENTO_ESTAGIARIO";

type Worker = {
  id: string;
  status: string;
  worker_type: WorkerType;
  full_name: string;
  cpf: string;
  rg?: string | null;
  ctps?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  email?: string | null;
  phone?: string | null;

  job_title?: string | null;
  sector?: string | null;
  salary_amount?: number | null;
  salary_words?: string | null;
  weekly_hours?: number | null;

  monday_schedule?: string | null;
  tuesday_schedule?: string | null;
  wednesday_schedule?: string | null;
  thursday_schedule?: string | null;
  friday_schedule?: string | null;

  non_compete_territory?: string | null;

  course_name?: string | null;
  institution_name?: string | null;
  institution_cnpj?: string | null;
  institution_address?: string | null;
  semester?: string | null;

  guardian_name?: string | null;
  guardian_cpf?: string | null;

  internship_schedule?: string | null;
  stipend_amount?: number | null;
  stipend_words?: string | null;
  transport_amount?: number | null;
  transport_words?: string | null;
  meal_amount?: number | null;
  meal_words?: string | null;

  internship_start?: string | null;
  internship_end?: string | null;

  notes?: string | null;

  documents?: Array<{
    id: string;
    document_type: DocumentType;
    status: string;
    generated_at: string;
    sent_at?: string | null;
    signed_at?: string | null;
  }>;

  signed_files?: Array<{
    id: string;
    document_type: DocumentType;
    original_name: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
  }>;

  personal_files?: Array<{
    id: string;
    category: string;
    label?: string | null;
    original_name: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
  }>;
};

type FormState = {
  workerType: WorkerType;
  fullName: string;
  cpf: string;
  rg: string;
  ctps: string;
  address: string;
  city: string;
  state: string;
  email: string;
  phone: string;

  jobTitle: string;
  sector: string;
  salaryAmount: string;
  salaryWords: string;
  weeklyHours: string;

  mondaySchedule: string;
  tuesdaySchedule: string;
  wednesdaySchedule: string;
  thursdaySchedule: string;
  fridaySchedule: string;

  nonCompeteTerritory: string;

  courseName: string;
  institutionName: string;
  institutionCnpj: string;
  institutionAddress: string;
  semester: string;

  guardianName: string;
  guardianCpf: string;

  internshipSchedule: string;
  stipendAmount: string;
  stipendWords: string;
  transportAmount: string;
  transportWords: string;
  mealAmount: string;
  mealWords: string;

  internshipStart: string;
  internshipEnd: string;

  notes: string;
};

const EMPTY_FORM: FormState = {
  workerType: "CLT",
  fullName: "",
  cpf: "",
  rg: "",
  ctps: "",
  address: "",
  city: "São Paulo",
  state: "SP",
  email: "",
  phone: "",

  jobTitle: "",
  sector: "Integração de Estágio",
  salaryAmount: "",
  salaryWords: "",
  weeklyHours: "44",

  mondaySchedule: "",
  tuesdaySchedule: "",
  wednesdaySchedule: "",
  thursdaySchedule: "",
  fridaySchedule: "",

  nonCompeteTerritory: "São Paulo/SP",

  courseName: "",
  institutionName: "",
  institutionCnpj: "",
  institutionAddress: "",
  semester: "",

  guardianName: "",
  guardianCpf: "",

  internshipSchedule: "",
  stipendAmount: "",
  stipendWords: "",
  transportAmount: "",
  transportWords: "",
  mealAmount: "",
  mealWords: "",

  internshipStart: "",
  internshipEnd: "",

  notes: "",
};

const COLUMNS = [
  { key: "CANDIDATO_NOVO", title: "Candidato novo", hint: "Cadastro inicial" },
  { key: "EM_ANALISE", title: "Em análise", hint: "Validação interna" },
  { key: "APROVADO", title: "Aprovado", hint: "Pronto para documentos" },
  { key: "DOCUMENTOS_GERADOS", title: "Documentos gerados", hint: "Prontos para envio" },
  { key: "AGUARDANDO_ASSINATURA", title: "Aguardando assinatura", hint: "Enviado ao candidato" },
  { key: "CONTRATADO_ATIVO", title: "Contratado / Ativo", hint: "Documentação concluída" },
  { key: "NAO_APROVADO", title: "Não aprovado", hint: "Processo encerrado" },
  { key: "INATIVO", title: "Inativo", hint: "Sem vínculo ativo" },
] as const;

const STATUS_COLOR: Record<string, string> = {
  CANDIDATO_NOVO: "#2563eb",
  EM_ANALISE: "#7c3aed",
  APROVADO: "#0f766e",
  DOCUMENTOS_GERADOS: "#0369a1",
  AGUARDANDO_ASSINATURA: "#c2410c",
  CONTRATADO_ATIVO: "#15803d",
  NAO_APROVADO: "#b91c1c",
  INATIVO: "#64748b",
};

const DOCUMENT_LABEL: Record<DocumentType, string> = {
  CONTRATO_TRABALHO: "Contrato Individual de Trabalho",
  REGIMENTO_COLABORADOR: "Regimento Interno e Código de Conduta",
  TCE: "Termo de Compromisso de Estágio (TCE)",
  REGIMENTO_ESTAGIARIO: "Regimento Interno e Código de Conduta — Estagiário",
};

const PERSONAL_CATEGORY_LABEL: Record<string, string> = {
  RG_CNH: "RG / CNH",
  CPF: "CPF",
  CTPS: "CTPS",
  COMPROVANTE_ENDERECO: "Comprovante de endereço",
  DADOS_BANCARIOS: "Dados bancários",
  COMPROVANTE_MATRICULA: "Comprovante de matrícula",
  OUTRO: "Outro documento",
};

function requiredDocuments(type: WorkerType): DocumentType[] {
  return type === "CLT"
    ? ["CONTRATO_TRABALHO", "REGIMENTO_COLABORADOR"]
    : ["TCE", "REGIMENTO_ESTAGIARIO"];
}

function toForm(worker: Worker): FormState {
  return {
    workerType: worker.worker_type,
    fullName: worker.full_name || "",
    cpf: worker.cpf || "",
    rg: worker.rg || "",
    ctps: worker.ctps || "",
    address: worker.address || "",
    city: worker.city || "",
    state: worker.state || "",
    email: worker.email || "",
    phone: worker.phone || "",

    jobTitle: worker.job_title || "",
    sector: worker.sector || "",
    salaryAmount: worker.salary_amount != null ? String(worker.salary_amount) : "",
    salaryWords: worker.salary_words || "",
    weeklyHours: worker.weekly_hours != null ? String(worker.weekly_hours) : "",

    mondaySchedule: worker.monday_schedule || "",
    tuesdaySchedule: worker.tuesday_schedule || "",
    wednesdaySchedule: worker.wednesday_schedule || "",
    thursdaySchedule: worker.thursday_schedule || "",
    fridaySchedule: worker.friday_schedule || "",

    nonCompeteTerritory: worker.non_compete_territory || "",

    courseName: worker.course_name || "",
    institutionName: worker.institution_name || "",
    institutionCnpj: worker.institution_cnpj || "",
    institutionAddress: worker.institution_address || "",
    semester: worker.semester || "",

    guardianName: worker.guardian_name || "",
    guardianCpf: worker.guardian_cpf || "",

    internshipSchedule: worker.internship_schedule || "",
    stipendAmount: worker.stipend_amount != null ? String(worker.stipend_amount) : "",
    stipendWords: worker.stipend_words || "",
    transportAmount: worker.transport_amount != null ? String(worker.transport_amount) : "",
    transportWords: worker.transport_words || "",
    mealAmount: worker.meal_amount != null ? String(worker.meal_amount) : "",
    mealWords: worker.meal_words || "",

    internshipStart: worker.internship_start?.slice(0, 10) || "",
    internshipEnd: worker.internship_end?.slice(0, 10) || "",

    notes: worker.notes || "",
  };
}

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function InternalTeamManager() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selected, setSelected] = useState<Worker | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploadKey, setUploadKey] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [attachmentCategory, setAttachmentCategory] = useState("RG_CNH");
  const [attachmentLabel, setAttachmentLabel] = useState("");

  useEffect(() => {
    loadWorkers();
  }, []);

  async function loadWorkers() {
    try {
      setLoading(true);
      const query = search.trim()
        ? `?search=${encodeURIComponent(search.trim())}`
        : "";

      const res = await fetch(`/api/rh/internal-team${query}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao carregar equipe interna.");
        return;
      }

      setWorkers(data.workers || []);

      if (selected) {
        const still = (data.workers || []).find((item: Worker) => item.id === selected.id);
        if (still) setSelected((current) => (current ? { ...current, ...still } : current));
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id: string) {
    const res = await fetch(`/api/rh/internal-team?id=${encodeURIComponent(id)}`, {
      credentials: "include",
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao abrir colaborador.");
      return;
    }

    setSelected(data.worker);
    setTimeout(() => {
      document.getElementById("internal-worker-detail")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function newWorker() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setSelected(null);
    setTimeout(() => {
      document.getElementById("internal-worker-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  function editWorker(worker: Worker) {
    setEditingId(worker.id);
    setForm(toForm(worker));
    setShowForm(true);
    setTimeout(() => {
      document.getElementById("internal-worker-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  async function saveWorker(event: React.FormEvent) {
    event.preventDefault();

    if (!form.fullName.trim()) {
      alert("Informe o nome completo.");
      return;
    }

    if (!form.cpf.replace(/\D/g, "")) {
      alert("Informe o CPF.");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/rh/internal-team", {
        method: editingId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId
            ? {
                id: editingId,
                action: "update",
                ...form,
              }
            : form
        ),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao salvar cadastro.");
        return;
      }

      const id = editingId || data.worker?.id;
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await loadWorkers();

      if (id) await loadDetail(id);

      alert(editingId ? "Cadastro atualizado." : "Cadastro criado.");
    } finally {
      setSaving(false);
    }
  }

  async function action(workerId: string, actionName: string, extra: Record<string, unknown> = {}) {
    try {
      setBusyId(workerId);

      const res = await fetch("/api/rh/internal-team", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: workerId,
          action: actionName,
          ...extra,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Não foi possível concluir a ação.");
        return false;
      }

      await loadWorkers();
      await loadDetail(workerId);
      return true;
    } finally {
      setBusyId(null);
    }
  }

  async function moveWorker(workerId: string, status: string) {
    await action(workerId, "pipeline_stage", { status });
    setDraggingId(null);
  }

  function openPdf(worker: Worker, documentType: DocumentType, download = false) {
    const params = new URLSearchParams({
      documentType,
      ...(download ? { download: "1" } : {}),
    });

    window.open(
      `/api/rh/internal-team/${worker.id}/pdf?${params.toString()}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function uploadSigned(
    worker: Worker,
    documentType: DocumentType,
    file: File | null
  ) {
    if (!file) return;

    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowed.includes(file.type)) {
      alert("Envie PDF, JPG, PNG ou WEBP.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert("O arquivo deve ter no máximo 15 MB.");
      return;
    }

    const key = `${worker.id}:${documentType}`;

    try {
      setUploadKey(key);

      const body = new FormData();
      body.append("documentType", documentType);
      body.append("file", file);

      const res = await fetch(
        `/api/rh/internal-team/${worker.id}/signed-document`,
        {
          method: "POST",
          credentials: "include",
          body,
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao anexar documento.");
        return;
      }

      await loadWorkers();
      await loadDetail(worker.id);

      if (data.activated) {
        alert(
          "Todos os documentos obrigatórios foram anexados. O colaborador foi movido automaticamente para Contratado / Ativo."
        );
      } else {
        alert("Documento assinado salvo no sistema.");
      }
    } finally {
      setUploadKey(null);
    }
  }

  function openSigned(worker: Worker, fileId: string, download = false) {
    const params = new URLSearchParams({
      fileId,
      ...(download ? { download: "1" } : {}),
    });

    window.open(
      `/api/rh/internal-team/${worker.id}/signed-document?${params.toString()}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function removeSigned(worker: Worker, fileId: string) {
    if (!confirm("Remover este arquivo assinado do histórico?")) return;

    const res = await fetch(
      `/api/rh/internal-team/${worker.id}/signed-document?fileId=${encodeURIComponent(
        fileId
      )}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao remover arquivo.");
      return;
    }

    await loadDetail(worker.id);
  }


  async function uploadAttachment(worker: Worker, file: File | null) {
    if (!file) return;

    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowed.includes(file.type)) {
      alert("Envie PDF, JPG, PNG ou WEBP.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert("O arquivo deve ter no máximo 15 MB.");
      return;
    }

    const key = `${worker.id}:attachment`;

    try {
      setUploadKey(key);

      const body = new FormData();
      body.append("category", attachmentCategory);
      body.append("label", attachmentLabel);
      body.append("file", file);

      const res = await fetch(
        `/api/rh/internal-team/${worker.id}/attachments`,
        {
          method: "POST",
          credentials: "include",
          body,
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao salvar documento.");
        return;
      }

      setAttachmentLabel("");
      await loadDetail(worker.id);
      alert("Documento salvo no prontuário interno.");
    } finally {
      setUploadKey(null);
    }
  }

  function openAttachment(worker: Worker, fileId: string, download = false) {
    const params = new URLSearchParams({
      fileId,
      ...(download ? { download: "1" } : {}),
    });

    window.open(
      `/api/rh/internal-team/${worker.id}/attachments?${params.toString()}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function removeAttachment(worker: Worker, fileId: string) {
    if (!confirm("Remover este documento do prontuário?")) return;

    const res = await fetch(
      `/api/rh/internal-team/${worker.id}/attachments?fileId=${encodeURIComponent(
        fileId
      )}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao remover documento.");
      return;
    }

    await loadDetail(worker.id);
  }

  const grouped = useMemo(() => {
    const result: Record<string, Worker[]> = {};

    for (const column of COLUMNS) result[column.key] = [];

    for (const worker of workers) {
      const key = result[worker.status] ? worker.status : "CANDIDATO_NOVO";
      result[key].push(worker);
    }

    return result;
  }, [workers]);

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.kicker}>MOTIVAR RH • GESTÃO INTERNA</p>
          <h1 style={styles.title}>Equipe Interna</h1>
          <p style={styles.subtitle}>
            Controle de contratação, contrato de trabalho, TCE, regimento interno,
            código de conduta e documentos assinados da própria equipe da Motivar RH.
          </p>
        </div>

        <button type="button" style={styles.primaryButton} onClick={newWorker}>
          + Novo colaborador
        </button>
      </section>

      <section style={styles.card}>
        <div style={styles.toolbar}>
          <div>
            <h2 style={styles.sectionTitle}>Funil de contratação interna</h2>
            <p style={styles.smallText}>
              Arraste os cards entre as etapas ou altere o status dentro do próprio card.
            </p>
          </div>

          <div style={styles.searchRow}>
            <input
              style={styles.searchInput}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, CPF, e-mail..."
              onKeyDown={(event) => {
                if (event.key === "Enter") loadWorkers();
              }}
            />
            <button type="button" style={styles.secondaryButton} onClick={loadWorkers}>
              Buscar
            </button>
          </div>
        </div>

        {loading ? (
          <div style={styles.empty}>Carregando equipe interna...</div>
        ) : (
          <div style={styles.board}>
            {COLUMNS.map((column) => {
              const items = grouped[column.key] || [];

              return (
                <section
                  key={column.key}
                  style={styles.column}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const id =
                      event.dataTransfer.getData("text/internal-worker") ||
                      draggingId;
                    if (id) moveWorker(id, column.key);
                  }}
                >
                  <div style={styles.columnHeader}>
                    <div>
                      <strong style={styles.columnTitle}>{column.title}</strong>
                      <div style={styles.columnHint}>{column.hint}</div>
                    </div>
                    <span style={styles.count}>{items.length}</span>
                  </div>

                  <div style={styles.columnList}>
                    {!items.length && (
                      <div style={styles.emptyColumn}>Nenhum registro</div>
                    )}

                    {items.map((worker) => (
                      <article
                        key={worker.id}
                        draggable
                        style={{
                          ...styles.workerCard,
                          opacity:
                            draggingId === worker.id || busyId === worker.id
                              ? 0.55
                              : 1,
                        }}
                        onDragStart={(event) => {
                          setDraggingId(worker.id);
                          event.dataTransfer.setData(
                            "text/internal-worker",
                            worker.id
                          );
                        }}
                        onDragEnd={() => setDraggingId(null)}
                      >
                        <div style={styles.workerTop}>
                          <div style={styles.avatar}>
                            {worker.full_name.slice(0, 1).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <strong style={styles.workerName}>
                              {worker.full_name}
                            </strong>
                            <div style={styles.muted}>
                              {worker.worker_type === "CLT"
                                ? "Funcionário CLT"
                                : "Estagiário"}
                            </div>
                          </div>
                        </div>

                        <div style={styles.metaGrid}>
                          <span>CPF: {formatCpf(worker.cpf)}</span>
                          {worker.job_title && <span>{worker.job_title}</span>}
                          {worker.email && <span>{worker.email}</span>}
                        </div>

                        <button
                          type="button"
                          style={styles.openButton}
                          onClick={() => loadDetail(worker.id)}
                        >
                          Abrir gestão
                        </button>

                        <select
                          style={styles.stageSelect}
                          value={worker.status}
                          onChange={(event) =>
                            moveWorker(worker.id, event.target.value)
                          }
                        >
                          {COLUMNS.map((stage) => (
                            <option key={stage.key} value={stage.key}>
                              {stage.title}
                            </option>
                          ))}
                        </select>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>

      {showForm && (
        <section id="internal-worker-form" style={styles.card}>
          <div style={styles.toolbar}>
            <div>
              <p style={styles.kicker}>
                {editingId ? "EDITAR CADASTRO" : "NOVA CONTRATAÇÃO"}
              </p>
              <h2 style={styles.sectionTitle}>
                {editingId ? "Dados do colaborador" : "Cadastrar colaborador"}
              </h2>
              <p style={styles.smallText}>
                Os campos abaixo alimentam automaticamente os documentos jurídicos.
              </p>
            </div>

            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
            >
              Fechar
            </button>
          </div>

          <form onSubmit={saveWorker} style={styles.form}>
            <FormSection title="1. Tipo de vínculo e dados pessoais">
              <SelectField
                label="Tipo de vínculo"
                value={form.workerType}
                onChange={(value) => {
                  const workerType = value as WorkerType;
                  updateForm("workerType", workerType);
                  updateForm("weeklyHours", workerType === "CLT" ? "44" : "30");
                }}
                options={[
                  ["CLT", "Funcionário CLT"],
                  ["ESTAGIO", "Estagiário"],
                ]}
              />

              <InputField
                label="Nome completo"
                value={form.fullName}
                onChange={(value) => updateForm("fullName", value)}
                placeholder="Nome completo"
              />

              <InputField
                label="CPF"
                value={form.cpf}
                onChange={(value) => updateForm("cpf", formatCpf(value))}
                placeholder="000.000.000-00"
              />

              <InputField
                label="RG"
                value={form.rg}
                onChange={(value) => updateForm("rg", value)}
              />

              {form.workerType === "CLT" && (
                <InputField
                  label="CTPS / Série / UF"
                  value={form.ctps}
                  onChange={(value) => updateForm("ctps", value)}
                  placeholder="Número / série / UF"
                />
              )}

              <InputField
                label="E-mail"
                value={form.email}
                onChange={(value) => updateForm("email", value)}
                type="email"
              />

              <InputField
                label="Telefone / WhatsApp"
                value={form.phone}
                onChange={(value) => updateForm("phone", value)}
              />

              <InputField
                label="Cidade"
                value={form.city}
                onChange={(value) => updateForm("city", value)}
              />

              <InputField
                label="UF"
                value={form.state}
                onChange={(value) => updateForm("state", value)}
              />

              <WideField label="Endereço completo">
                <input
                  style={styles.input}
                  value={form.address}
                  onChange={(event) => updateForm("address", event.target.value)}
                  placeholder="Rua, número, complemento, bairro, CEP"
                />
              </WideField>
            </FormSection>

            {form.workerType === "CLT" ? (
              <>
                <FormSection title="2. Dados do contrato de trabalho">
                  <InputField
                    label="Cargo"
                    value={form.jobTitle}
                    onChange={(value) => updateForm("jobTitle", value)}
                    placeholder="Ex: Analista Sênior"
                  />

                  <InputField
                    label="Setor"
                    value={form.sector}
                    onChange={(value) => updateForm("sector", value)}
                  />

                  <InputField
                    label="Salário mensal"
                    value={form.salaryAmount}
                    onChange={(value) => updateForm("salaryAmount", value)}
                    placeholder="Ex: 3500,00"
                  />

                  <InputField
                    label="Salário por extenso"
                    value={form.salaryWords}
                    onChange={(value) => updateForm("salaryWords", value)}
                    placeholder="Ex: três mil e quinhentos reais"
                  />

                  <InputField
                    label="Jornada semanal"
                    value={form.weeklyHours}
                    onChange={(value) => updateForm("weeklyHours", value)}
                    type="number"
                  />

                  <InputField
                    label="Território da não competitividade"
                    value={form.nonCompeteTerritory}
                    onChange={(value) =>
                      updateForm("nonCompeteTerritory", value)
                    }
                    placeholder="Ex: Estado de São Paulo"
                  />
                </FormSection>

                <FormSection title="3. Jornada híbrida">
                  <InputField
                    label="Segunda — Home Office"
                    value={form.mondaySchedule}
                    onChange={(value) => updateForm("mondaySchedule", value)}
                    placeholder="Ex: Das 08h às 18h"
                  />
                  <InputField
                    label="Terça — Presencial"
                    value={form.tuesdaySchedule}
                    onChange={(value) => updateForm("tuesdaySchedule", value)}
                    placeholder="Ex: Das 08h às 18h"
                  />
                  <InputField
                    label="Quarta — Presencial"
                    value={form.wednesdaySchedule}
                    onChange={(value) => updateForm("wednesdaySchedule", value)}
                    placeholder="Ex: Das 08h às 18h"
                  />
                  <InputField
                    label="Quinta — Presencial"
                    value={form.thursdaySchedule}
                    onChange={(value) => updateForm("thursdaySchedule", value)}
                    placeholder="Ex: Das 08h às 18h"
                  />
                  <InputField
                    label="Sexta — Home Office"
                    value={form.fridaySchedule}
                    onChange={(value) => updateForm("fridaySchedule", value)}
                    placeholder="Ex: Das 08h às 18h"
                  />
                </FormSection>
              </>
            ) : (
              <>
                <FormSection title="2. Dados acadêmicos do estágio">
                  <InputField
                    label="Curso"
                    value={form.courseName}
                    onChange={(value) => updateForm("courseName", value)}
                    placeholder="Ex: Administração"
                  />
                  <InputField
                    label="Semestre / Ano"
                    value={form.semester}
                    onChange={(value) => updateForm("semester", value)}
                    placeholder="Ex: 4º semestre"
                  />
                  <InputField
                    label="Instituição de ensino"
                    value={form.institutionName}
                    onChange={(value) => updateForm("institutionName", value)}
                  />
                  <InputField
                    label="CNPJ da instituição"
                    value={form.institutionCnpj}
                    onChange={(value) => updateForm("institutionCnpj", value)}
                  />
                  <WideField label="Endereço da instituição">
                    <input
                      style={styles.input}
                      value={form.institutionAddress}
                      onChange={(event) =>
                        updateForm("institutionAddress", event.target.value)
                      }
                    />
                  </WideField>
                  <InputField
                    label="Responsável legal (se menor)"
                    value={form.guardianName}
                    onChange={(value) => updateForm("guardianName", value)}
                  />
                  <InputField
                    label="CPF do responsável"
                    value={form.guardianCpf}
                    onChange={(value) =>
                      updateForm("guardianCpf", formatCpf(value))
                    }
                  />
                </FormSection>

                <FormSection title="3. Condições do estágio">
                  <WideField label="Horário do estágio">
                    <input
                      style={styles.input}
                      value={form.internshipSchedule}
                      onChange={(event) =>
                        updateForm("internshipSchedule", event.target.value)
                      }
                      placeholder="Ex: segunda a sexta-feira, das 09h às 16h, com 1 hora de intervalo"
                    />
                  </WideField>

                  <InputField
                    label="Bolsa-auxílio"
                    value={form.stipendAmount}
                    onChange={(value) => updateForm("stipendAmount", value)}
                    placeholder="Ex: 1200,00"
                  />
                  <InputField
                    label="Bolsa por extenso"
                    value={form.stipendWords}
                    onChange={(value) => updateForm("stipendWords", value)}
                  />
                  <InputField
                    label="Auxílio-transporte"
                    value={form.transportAmount}
                    onChange={(value) => updateForm("transportAmount", value)}
                    placeholder="Ex: 200,00"
                  />
                  <InputField
                    label="Transporte por extenso"
                    value={form.transportWords}
                    onChange={(value) => updateForm("transportWords", value)}
                  />
                  <InputField
                    label="Auxílio-alimentação"
                    value={form.mealAmount}
                    onChange={(value) => updateForm("mealAmount", value)}
                    placeholder="Ex: 300,00"
                  />
                  <InputField
                    label="Alimentação por extenso"
                    value={form.mealWords}
                    onChange={(value) => updateForm("mealWords", value)}
                  />
                  <InputField
                    label="Início do estágio"
                    value={form.internshipStart}
                    onChange={(value) => updateForm("internshipStart", value)}
                    type="date"
                  />
                  <InputField
                    label="Término do estágio"
                    value={form.internshipEnd}
                    onChange={(value) => updateForm("internshipEnd", value)}
                    type="date"
                  />
                  <InputField
                    label="Território da não competitividade"
                    value={form.nonCompeteTerritory}
                    onChange={(value) =>
                      updateForm("nonCompeteTerritory", value)
                    }
                  />
                </FormSection>
              </>
            )}

            <FormSection title="Observações internas">
              <WideField label="Observações">
                <textarea
                  style={styles.textarea}
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                  placeholder="Informações internas sobre admissão, documentos pendentes, observações da gestão..."
                />
              </WideField>
            </FormSection>

            <div style={styles.submitRow}>
              <button style={styles.primaryButton} disabled={saving}>
                {saving
                  ? "Salvando..."
                  : editingId
                  ? "Salvar alterações"
                  : "Cadastrar colaborador"}
              </button>
            </div>
          </form>
        </section>
      )}

      {selected && (
        <section id="internal-worker-detail" style={styles.card}>
          <div style={styles.toolbar}>
            <div>
              <p style={styles.kicker}>GESTÃO DO COLABORADOR</p>
              <h2 style={styles.sectionTitle}>{selected.full_name}</h2>
              <p style={styles.smallText}>
                {selected.worker_type === "CLT"
                  ? "Funcionário CLT"
                  : "Estagiário"}{" "}
                • CPF {formatCpf(selected.cpf)}
              </p>
            </div>

            <div style={styles.actionRow}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => editWorker(selected)}
              >
                Editar cadastro
              </button>

              {!["APROVADO", "DOCUMENTOS_GERADOS", "AGUARDANDO_ASSINATURA", "CONTRATADO_ATIVO"].includes(
                selected.status
              ) && (
                <button
                  type="button"
                  style={styles.successButton}
                  onClick={() => action(selected.id, "approve")}
                >
                  Aprovar
                </button>
              )}

              {!["NAO_APROVADO", "CONTRATADO_ATIVO"].includes(
                selected.status
              ) && (
                <button
                  type="button"
                  style={styles.dangerButton}
                  onClick={() => {
                    if (confirm("Marcar este candidato como não aprovado?")) {
                      action(selected.id, "reject");
                    }
                  }}
                >
                  Não aprovado
                </button>
              )}
            </div>
          </div>

          <div style={styles.summaryGrid}>
            <Summary label="Status" value={COLUMNS.find((item) => item.key === selected.status)?.title || selected.status} />
            <Summary label="E-mail" value={selected.email || "-"} />
            <Summary label="Telefone" value={selected.phone || "-"} />
            <Summary label="Cidade" value={[selected.city, selected.state].filter(Boolean).join(" / ") || "-"} />
            <Summary
              label={selected.worker_type === "CLT" ? "Cargo" : "Curso"}
              value={
                selected.worker_type === "CLT"
                  ? selected.job_title || "-"
                  : selected.course_name || "-"
              }
            />
            <Summary
              label={selected.worker_type === "CLT" ? "Salário" : "Bolsa"}
              value={
                selected.worker_type === "CLT"
                  ? selected.salary_amount != null
                    ? `R$ ${Number(selected.salary_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                    : "-"
                  : selected.stipend_amount != null
                  ? `R$ ${Number(selected.stipend_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                  : "-"
              }
            />
          </div>

          <div style={styles.documentHeader}>
            <div>
              <h3 style={styles.documentTitle}>Documentos da contratação</h3>
              <p style={styles.smallText}>
                O sistema gera somente os documentos compatíveis com o vínculo selecionado.
              </p>
            </div>

            <div style={styles.actionRow}>
              {[
                "APROVADO",
                "DOCUMENTOS_GERADOS",
                "AGUARDANDO_ASSINATURA",
                "CONTRATADO_ATIVO",
              ].includes(selected.status) && (
                <button
                  type="button"
                  style={styles.contractButton}
                  disabled={busyId === selected.id}
                  onClick={() => action(selected.id, "generate_documents")}
                >
                  {selected.documents?.length
                    ? "Gerar nova versão"
                    : "Gerar documentos"}
                </button>
              )}

              {Boolean(selected.documents?.length) && (
                <button
                  type="button"
                  style={styles.warnButton}
                  disabled={busyId === selected.id}
                  onClick={() => action(selected.id, "mark_sent")}
                >
                  Marcar documentos enviados
                </button>
              )}
            </div>
          </div>

          <div style={styles.documentGrid}>
            {requiredDocuments(selected.worker_type).map((type) => {
              const snapshot = selected.documents?.find(
                (document) => document.document_type === type
              );

              const files =
                selected.signed_files?.filter(
                  (file) => file.document_type === type
                ) || [];

              const key = `${selected.id}:${type}`;

              return (
                <article key={type} style={styles.documentCard}>
                  <div>
                    <span style={styles.docType}>DOCUMENTO</span>
                    <h4 style={styles.docName}>{DOCUMENT_LABEL[type]}</h4>
                    <p style={styles.docStatus}>
                      {snapshot
                        ? `Gerado em ${new Date(
                            snapshot.generated_at
                          ).toLocaleString("pt-BR")}`
                        : "Ainda não gerado"}
                    </p>
                  </div>

                  <div style={styles.actionRow}>
                    {snapshot && (
                      <>
                        <button
                          type="button"
                          style={styles.secondaryButton}
                          onClick={() => openPdf(selected, type)}
                        >
                          Visualizar PDF
                        </button>
                        <button
                          type="button"
                          style={styles.secondaryButton}
                          onClick={() => openPdf(selected, type, true)}
                        >
                          Baixar PDF
                        </button>
                      </>
                    )}
                  </div>

                  <div style={styles.signedBox}>
                    <div>
                      <strong style={styles.signedTitle}>
                        Documento assinado
                      </strong>
                      <p style={styles.signedHint}>
                        Salve aqui a via devolvida assinada em PDF ou foto.
                      </p>
                    </div>

                    <label style={styles.uploadButton}>
                      {uploadKey === key ? "Enviando..." : "Anexar assinado"}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                        disabled={uploadKey === key}
                        style={{ display: "none" }}
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          uploadSigned(selected, type, file);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>

                    {!files.length ? (
                      <div style={styles.noFile}>Nenhum arquivo assinado.</div>
                    ) : (
                      <div style={styles.fileList}>
                        {files.map((file) => (
                          <div key={file.id} style={styles.fileRow}>
                            <div style={{ minWidth: 0 }}>
                              <strong style={styles.fileName}>
                                {file.original_name}
                              </strong>
                              <div style={styles.fileMeta}>
                                {formatBytes(file.size_bytes)} •{" "}
                                {new Date(file.created_at).toLocaleString("pt-BR")}
                              </div>
                            </div>

                            <div style={styles.actionRow}>
                              <button
                                type="button"
                                style={styles.secondaryButton}
                                onClick={() => openSigned(selected, file.id)}
                              >
                                Ver
                              </button>
                              <button
                                type="button"
                                style={styles.secondaryButton}
                                onClick={() =>
                                  openSigned(selected, file.id, true)
                                }
                              >
                                Baixar
                              </button>
                              <button
                                type="button"
                                style={styles.removeButton}
                                onClick={() => removeSigned(selected, file.id)}
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <div style={styles.personalDocsSection}>
            <div style={styles.documentHeader}>
              <div>
                <h3 style={styles.documentTitle}>
                  Prontuário de documentos
                </h3>
                <p style={styles.smallText}>
                  Guarde documentos pessoais e admissionais do colaborador em um único lugar.
                </p>
              </div>
            </div>

            <div style={styles.attachmentUploader}>
              <select
                style={styles.input}
                value={attachmentCategory}
                onChange={(event) =>
                  setAttachmentCategory(event.target.value)
                }
              >
                {Object.entries(PERSONAL_CATEGORY_LABEL).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  )
                )}
              </select>

              <input
                style={styles.input}
                value={attachmentLabel}
                onChange={(event) =>
                  setAttachmentLabel(event.target.value)
                }
                placeholder="Descrição opcional"
              />

              <label style={styles.uploadButton}>
                {uploadKey === `${selected.id}:attachment`
                  ? "Enviando..."
                  : "Anexar documento"}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  disabled={uploadKey === `${selected.id}:attachment`}
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    uploadAttachment(selected, file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            {!selected.personal_files?.length ? (
              <div style={styles.noFile}>
                Nenhum documento pessoal/admissional anexado.
              </div>
            ) : (
              <div style={styles.personalFileGrid}>
                {selected.personal_files.map((file) => (
                  <div key={file.id} style={styles.personalFileCard}>
                    <span style={styles.docType}>
                      {PERSONAL_CATEGORY_LABEL[file.category] ||
                        file.category}
                    </span>

                    <strong style={styles.fileName}>
                      {file.label || file.original_name}
                    </strong>

                    <div style={styles.fileMeta}>
                      {file.original_name} • {formatBytes(file.size_bytes)} •{" "}
                      {new Date(file.created_at).toLocaleString("pt-BR")}
                    </div>

                    <div style={styles.actionRow}>
                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={() =>
                          openAttachment(selected, file.id)
                        }
                      >
                        Ver
                      </button>

                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={() =>
                          openAttachment(selected, file.id, true)
                        }
                      >
                        Baixar
                      </button>

                      <button
                        type="button"
                        style={styles.removeButton}
                        onClick={() =>
                          removeAttachment(selected, file.id)
                        }
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selected.status === "CONTRATADO_ATIVO" && (
            <div style={styles.activeBanner}>
              ✓ Documentação obrigatória assinada e salva. Colaborador ativo.
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset style={styles.formSection}>
      <legend style={styles.legend}>{title}</legend>
      <div style={styles.formGrid}>{children}</div>
    </fieldset>
  );
}

function InputField({
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
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label style={styles.label}>
      {label}
      <select
        style={styles.input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function WideField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
      {label}
      {children}
    </label>
  );
}

function Summary({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.summaryItem}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
    </div>
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
    gap: 18,
    flexWrap: "wrap",
    padding: 24,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #bfdbfe",
    boxShadow: "0 18px 50px rgba(37,99,235,.08)",
  },
  kicker: {
    margin: 0,
    color: "#2563eb",
    fontWeight: 950,
    letterSpacing: ".18em",
    fontSize: 11,
    textTransform: "uppercase",
  },
  title: {
    margin: "7px 0",
    fontSize: 36,
    fontWeight: 950,
    letterSpacing: "-.04em",
  },
  subtitle: {
    margin: 0,
    maxWidth: 850,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.6,
  },
  card: {
    marginTop: 18,
    padding: 20,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #bfdbfe",
    boxShadow: "0 16px 42px rgba(37,99,235,.06)",
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 21,
    fontWeight: 950,
  },
  smallText: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 11.5,
  },
  searchRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  searchInput: {
    minWidth: 260,
    border: "1px solid #bfdbfe",
    borderRadius: 14,
    padding: "10px 12px",
    background: "#f8fafc",
    outline: "none",
  },
  board: {
    display: "grid",
    gridAutoFlow: "column",
    gridAutoColumns: "minmax(280px,310px)",
    gap: 12,
    marginTop: 16,
    overflowX: "auto",
    paddingBottom: 10,
  },
  column: {
    minHeight: 420,
    border: "1px solid #dbeafe",
    borderRadius: 18,
    padding: 11,
    background: "#f8fafc",
  },
  columnHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: "3px 2px 10px",
    borderBottom: "1px solid #e2e8f0",
  },
  columnTitle: {
    fontSize: 12.5,
    fontWeight: 950,
  },
  columnHint: {
    marginTop: 3,
    color: "#94a3b8",
    fontSize: 10,
  },
  count: {
    minWidth: 26,
    height: 26,
    display: "grid",
    placeItems: "center",
    borderRadius: 999,
    background: "#dbeafe",
    color: "#1d4ed8",
    fontWeight: 950,
    fontSize: 11,
  },
  columnList: {
    display: "grid",
    gap: 9,
    marginTop: 10,
  },
  emptyColumn: {
    border: "1px dashed #cbd5e1",
    borderRadius: 13,
    padding: 14,
    textAlign: "center",
    color: "#94a3b8",
    background: "#ffffff",
    fontSize: 10.5,
  },
  workerCard: {
    padding: 11,
    borderRadius: 15,
    border: "1px solid #dbeafe",
    background: "#ffffff",
    boxShadow: "0 8px 20px rgba(15,23,42,.04)",
    cursor: "grab",
  },
  workerTop: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 34,
    height: 34,
    flex: "0 0 auto",
    display: "grid",
    placeItems: "center",
    borderRadius: 11,
    background: "linear-gradient(135deg,#38bdf8,#2563eb)",
    color: "#ffffff",
    fontWeight: 950,
  },
  workerName: {
    display: "block",
    maxWidth: 200,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 12,
    fontWeight: 950,
  },
  muted: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 10,
  },
  metaGrid: {
    display: "grid",
    gap: 3,
    marginTop: 9,
    color: "#64748b",
    fontSize: 10,
  },
  openButton: {
    width: "100%",
    marginTop: 9,
    border: 0,
    borderRadius: 10,
    padding: "8px 9px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 10.5,
  },
  stageSelect: {
    width: "100%",
    marginTop: 7,
    border: "1px solid #dbeafe",
    borderRadius: 10,
    padding: "8px 9px",
    background: "#fff",
    color: "#475569",
    fontSize: 10,
    outline: "none",
  },
  form: {
    display: "grid",
    gap: 14,
    marginTop: 16,
  },
  formSection: {
    margin: 0,
    padding: 15,
    border: "1px solid #dbeafe",
    borderRadius: 18,
  },
  legend: {
    padding: "0 7px",
    color: "#1d4ed8",
    fontWeight: 950,
    fontSize: 12.5,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 11,
  },
  label: {
    display: "grid",
    gap: 6,
    color: "#334155",
    fontSize: 11.5,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #bfdbfe",
    borderRadius: 13,
    padding: "11px 12px",
    background: "#f8fafc",
    color: "#0f172a",
    outline: "none",
    fontSize: 13,
  },
  textarea: {
    width: "100%",
    minHeight: 90,
    resize: "vertical",
    boxSizing: "border-box",
    border: "1px solid #bfdbfe",
    borderRadius: 13,
    padding: "11px 12px",
    background: "#f8fafc",
    color: "#0f172a",
    outline: "none",
    fontSize: 13,
  },
  submitRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  primaryButton: {
    border: 0,
    borderRadius: 14,
    padding: "11px 15px",
    background: "linear-gradient(135deg,#38bdf8,#2563eb)",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #bfdbfe",
    borderRadius: 13,
    padding: "9px 12px",
    background: "#fff",
    color: "#2563eb",
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 10.5,
  },
  successButton: {
    border: 0,
    borderRadius: 13,
    padding: "10px 13px",
    background: "#15803d",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
  },
  dangerButton: {
    border: "1px solid #fecaca",
    borderRadius: 13,
    padding: "10px 13px",
    background: "#fff1f2",
    color: "#b91c1c",
    fontWeight: 950,
    cursor: "pointer",
  },
  warnButton: {
    border: "1px solid #fed7aa",
    borderRadius: 13,
    padding: "10px 13px",
    background: "#fff7ed",
    color: "#c2410c",
    fontWeight: 950,
    cursor: "pointer",
  },
  contractButton: {
    border: 0,
    borderRadius: 13,
    padding: "10px 13px",
    background: "#7c3aed",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
  },
  actionRow: {
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
    alignItems: "center",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
    gap: 10,
    marginTop: 16,
  },
  summaryItem: {
    padding: 11,
    border: "1px solid #dbeafe",
    borderRadius: 14,
    background: "#f8fafc",
  },
  summaryLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 9.5,
    textTransform: "uppercase",
    letterSpacing: ".08em",
  },
  summaryValue: {
    display: "block",
    marginTop: 4,
    fontSize: 11.5,
  },
  documentHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 22,
    paddingTop: 18,
    borderTop: "1px solid #dbeafe",
  },
  documentTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 950,
  },
  documentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
    gap: 12,
    marginTop: 14,
  },
  documentCard: {
    display: "grid",
    gap: 12,
    alignContent: "start",
    border: "1px solid #dbeafe",
    borderRadius: 18,
    padding: 14,
    background: "#f8fafc",
  },
  docType: {
    color: "#2563eb",
    fontSize: 9,
    fontWeight: 950,
    letterSpacing: ".12em",
  },
  docName: {
    margin: "4px 0",
    fontSize: 13,
    fontWeight: 950,
  },
  docStatus: {
    margin: 0,
    color: "#64748b",
    fontSize: 10,
  },
  signedBox: {
    display: "grid",
    gap: 9,
    borderRadius: 14,
    border: "1px solid #c7d2fe",
    padding: 11,
    background: "#fff",
  },
  signedTitle: {
    fontSize: 11.5,
    fontWeight: 950,
  },
  signedHint: {
    margin: "2px 0 0",
    color: "#64748b",
    fontSize: 9.5,
  },
  uploadButton: {
    justifySelf: "start",
    border: 0,
    borderRadius: 11,
    padding: "9px 11px",
    background: "#0f766e",
    color: "#fff",
    fontSize: 10,
    fontWeight: 950,
    cursor: "pointer",
  },
  noFile: {
    border: "1px dashed #cbd5e1",
    borderRadius: 11,
    padding: 9,
    color: "#94a3b8",
    fontSize: 9.5,
  },
  fileList: {
    display: "grid",
    gap: 7,
  },
  fileRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    padding: 9,
    borderRadius: 11,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  fileName: {
    display: "block",
    maxWidth: 260,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 10.5,
  },
  fileMeta: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 9,
  },
  removeButton: {
    border: "1px solid #fecaca",
    borderRadius: 11,
    padding: "9px 10px",
    background: "#fff1f2",
    color: "#b91c1c",
    fontSize: 10,
    fontWeight: 950,
    cursor: "pointer",
  },
  personalDocsSection: {
    marginTop: 22,
    paddingTop: 18,
    borderTop: "1px solid #dbeafe",
  },
  attachmentUploader: {
    display: "grid",
    gridTemplateColumns: "minmax(180px,220px) minmax(220px,1fr) auto",
    gap: 9,
    alignItems: "end",
    marginTop: 12,
    marginBottom: 12,
  },
  personalFileGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
    gap: 9,
  },
  personalFileCard: {
    display: "grid",
    gap: 6,
    padding: 11,
    borderRadius: 13,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  activeBanner: {
    marginTop: 14,
    border: "1px solid #bbf7d0",
    borderRadius: 14,
    padding: 12,
    background: "#f0fdf4",
    color: "#15803d",
    fontSize: 11.5,
    fontWeight: 950,
  },
  empty: {
    marginTop: 14,
    padding: 18,
    textAlign: "center",
    borderRadius: 14,
    border: "1px dashed #bfdbfe",
    color: "#64748b",
    background: "#f8fafc",
  },
};
