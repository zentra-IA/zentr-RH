"use client";

import { useEffect, useMemo, useState } from "react";

type Job = {
  id: string;
  title: string;
  department?: string | null;
  description?: string | null;
  city?: string | null;
  state?: string | null;
  neighborhood?: string | null;
  region?: string | null;
  zipCode?: string | null;
  workMode?: string | null;
  contractType?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  status: string;
  educationRequired?: string | null;
  experienceRequired?: string | null;
  skillsRequired?: string[];
  filters?: any;
  requirements?: any;
  aiCriteria?: any;
  createdAt: string;
};

type JobForm = {
  title: string;
  department: string;
  clientId: string;
  responsibleUserId: string;
  responsibleName: string;
  priority: string;
  startDate: string;
  dueDate: string;
  meetLink: string;
  processDate: string;
  processTime: string;
  city: string;
  state: string;
  neighborhood: string;
  region: string;
  zipCode: string;
  workMode: string;
  contractType: string;
  shift: string;
  openings: string;
  salaryMin: string;
  salaryMax: string;
  description: string;
  requirementsText: string;
  educationRequired: string;
  educationCurrent: string;
  courseStatus: string;
  courseArea: string;
  studentYear: string;
  experienceRequired: string;
  experienceMode: string;
  minExperienceMonths: string;
  skillsRequired: string;
  languagesRequired: string;
  ageMin: string;
  ageMax: string;
};

type TeamUser = {
  id?: string;
  user_id?: string;
  name?: string;
  email?: string;
  role?: string;
  active?: boolean;
};


type RhClient = {
  id: string;
  name?: string;
  companyName?: string;
  cnpj?: string | null;
  responsibleName?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  city?: string | null;
  state?: string | null;
};

type KanbanFilters = {
  search: string;
  client: string;
  responsibleUserId: string;
  priority: string;
  status: string;
  contractType: string;
  city: string;
};

const emptyFilters: KanbanFilters = {
  search: "",
  client: "",
  responsibleUserId: "",
  priority: "",
  status: "",
  contractType: "",
  city: "",
};

const priorityLabel: Record<string, string> = {
  urgent: "Urgente",
  high: "Alta",
  normal: "Normal",
  low: "Baixa",
};

const priorityRank: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const statusChecklist: Record<string, string[]> = {
  open: ["Vaga publicada/divulgada", "Mensagem inicial configurada", "Critérios conferidos"],
  analyzing_resumes: ["Currículos recebidos", "IA aplicada", "Candidatos separados em lote"],
  scheduling_interviews: ["Lote fechado", "Mensagem enviada", "Link de agenda enviado"],
  clt_jobs: ["Dados CLT conferidos", "Salário/benefícios validados", "Documentos previstos"],
  internship_jobs: ["Curso/período conferidos", "Idade mínima validada", "Horário validado"],
  paused: ["Motivo da pausa registrado", "Cliente avisado", "Prazo de retomada definido"],
  no_client_response: ["Candidatos enviados", "Follow-up feito", "Próximo contato definido"],
  closed: ["Retorno final registrado", "Contratação validada", "Vaga encerrada"],
  canceled: ["Motivo cancelamento registrado", "Histórico preservado", "Equipe avisada"],
  draft: ["Informações básicas preenchidas", "Critérios revisados", "Pronta para publicar"],
};

const emptyForm: JobForm = {
  title: "",
  department: "",
  clientId: "",
  responsibleUserId: "",
  responsibleName: "",
  priority: "normal",
  startDate: "",
  dueDate: "",
  meetLink: "",
  processDate: "",
  processTime: "",
  city: "",
  state: "",
  neighborhood: "",
  region: "nenhuma",
  zipCode: "",
  workMode: "presencial",
  contractType: "clt",
  shift: "",
  openings: "1",
  salaryMin: "",
  salaryMax: "",
  description: "",
  requirementsText: "",
  educationRequired: "",
  educationCurrent: "",
  courseStatus: "",
  courseArea: "",
  studentYear: "",
  experienceRequired: "",
  experienceMode: "indiferente",
  minExperienceMonths: "",
  skillsRequired: "",
  languagesRequired: "",
  ageMin: "",
  ageMax: "",
};

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  open: "Divulgação da vaga",
  analyzing_resumes: "Analisando currículos",
  scheduling_interviews: "Agendando entrevistas",
  clt_jobs: "Vagas CLT",
  internship_jobs: "Vagas de estágio",
  paused: "Pausadas",
  no_client_response: "Sem retorno do cliente",
  closed: "Concluída",
  canceled: "Cancelada",
  archived: "Arquivada",
};

const kanbanColumns = [
  { key: "open", label: "Divulgação da vaga", helper: "Vagas ativas para divulgação." },
  { key: "analyzing_resumes", label: "Analisando currículos", helper: "Triagem e seleção inicial." },
  { key: "scheduling_interviews", label: "Agendando entrevistas", helper: "Contato e marcação com candidatos." },
  { key: "clt_jobs", label: "Vagas CLT", helper: "Processos CLT em andamento." },
  { key: "internship_jobs", label: "Vagas de estágio", helper: "Processos de estágio." },
  { key: "paused", label: "Pausadas", helper: "Aguardando retomada interna." },
  { key: "no_client_response", label: "Sem retorno do cliente", helper: "Cliente ainda não respondeu." },
  { key: "closed", label: "Concluída", helper: "Vagas finalizadas com sucesso." },
  { key: "canceled", label: "Cancelada", helper: "Processos cancelados." },
  { key: "draft", label: "Rascunho", helper: "Vagas ainda não publicadas." },
];

const regionLabel: Record<string, string> = {
  nenhuma: "Nenhuma",
  zona_leste: "Zona Leste",
  zona_norte: "Zona Norte",
  zona_sul: "Zona Sul",
  zona_oeste: "Zona Oeste",
  centro: "Centro",
};

function money(value?: number | null) {
  if (!value) return null;

  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getJson(job: Job, key: string) {
  return job.filters?.[key] ?? job.requirements?.[key] ?? job.aiCriteria?.[key] ?? null;
}

function getMeta(job: Job, key: string) {
  return getJson(job, key) ?? (job as any)[key] ?? null;
}

function getClientName(job: Job) {
  return String(getMeta(job, "clientName") || job.department || "").trim();
}

function getClientId(job: Job) {
  return String(getMeta(job, "clientId") || "").trim();
}

function getPriority(job: Job) {
  return String(getMeta(job, "priority") || "normal");
}

function getResponsibleUserId(job: Job) {
  return String(getMeta(job, "responsibleUserId") || "");
}

function getResponsibleName(job: Job) {
  return String(getMeta(job, "responsibleName") || "");
}

function priorityPillStyle(priority: string): React.CSSProperties {
  if (priority === "urgent") {
    return {
      border: "1px solid #fecaca",
      background: "#fef2f2",
      color: "#dc2626",
    };
  }

  if (priority === "high") {
    return {
      border: "1px solid #fde68a",
      background: "#fffbeb",
      color: "#ca8a04",
    };
  }

  if (priority === "normal") {
    return {
      border: "1px solid #bfdbfe",
      background: "#eff6ff",
      color: "#2563eb",
    };
  }

  return {
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#64748b",
  };
}

function joinList(value: any) {
  if (!value) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    draft: 0,
    paused: 0,
    closed: 0,
  });

  const [form, setForm] = useState<JobForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [matchingJobId, setMatchingJobId] = useState<string | null>(null);
  const [duplicatingJobId, setDuplicatingJobId] = useState<string | null>(null);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [loadingTeamUsers, setLoadingTeamUsers] = useState(false);
  const [clients, setClients] = useState<RhClient[]>([]);
  const [filters, setFilters] = useState<KanbanFilters>(emptyFilters);
  const [draggingJobId, setDraggingJobId] = useState<string | null>(null);
  const [isFormCollapsed, setIsFormCollapsed] = useState(false);

  useEffect(() => {
    loadJobs();
    loadTeamUsers();
    loadClients();
  }, []);

  useEffect(() => {
    if (form.contractType === "estagio") {
      setForm((current) => ({
        ...current,
        ageMin: current.ageMin || "16",
        courseStatus: current.courseStatus || "cursando",
        experienceMode: "sem_experiencia",
      }));
    }
  }, [form.contractType]);

  const clientOptions = useMemo(() => {
    return clients
      .map((client) => ({
        id: client.id,
        name: client.companyName || client.name || "",
      }))
      .filter((client) => client.name)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [clients]);

  const cityOptions = useMemo(() => {
    return Array.from(new Set(jobs.map((job) => job.city || "").filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    );
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return jobs
      .filter((job) => {
        const clientName = getClientName(job);
        const clientId = getClientId(job);
        const responsibleUserId = getResponsibleUserId(job);
        const priority = getPriority(job);

        const matchesSearch =
          !search ||
          [job.title, clientName, job.city, job.state, job.neighborhood, job.contractType]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(search);

        return (
          matchesSearch &&
          (!filters.client || clientId === filters.client || clientName === filters.client) &&
          (!filters.responsibleUserId || responsibleUserId === filters.responsibleUserId) &&
          (!filters.priority || priority === filters.priority) &&
          (!filters.status || job.status === filters.status) &&
          (!filters.contractType || job.contractType === filters.contractType) &&
          (!filters.city || job.city === filters.city)
        );
      })
      .sort((a, b) => {
        const priorityDiff =
          (priorityRank[getPriority(a)] ?? 2) - (priorityRank[getPriority(b)] ?? 2);

        if (priorityDiff !== 0) return priorityDiff;

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [jobs, filters]);

  const jobsByStatus = useMemo(() => {
    return kanbanColumns.reduce<Record<string, Job[]>>((acc, column) => {
      acc[column.key] = filteredJobs.filter((job) => job.status === column.key);
      return acc;
    }, {});
  }, [filteredJobs]);

  const totalVisibleJobs = useMemo(() => filteredJobs.length, [filteredJobs]);

  function updateForm(key: keyof JobForm, value: string) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateFilter(key: keyof KanbanFilters, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function loadClients() {
    try {
      const res = await fetch("/api/rh/clients", {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
    }
  }

  function selectClientByName(clientName: string) {
    const selectedClient = clients.find((client) => {
      const name = client.companyName || client.name || "";
      return name.trim().toLowerCase() === clientName.trim().toLowerCase();
    });

    setForm((current) => ({
      ...current,
      department: clientName,
      clientId: selectedClient?.id || "",
    }));
  }

  async function getCurrentCompanyId() {
    try {
      const res = await fetch("/api/company/current", {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));
      const companyId = String(data?.company?.id || data?.companyId || "").trim();

      if (res.ok && companyId) {
        if (typeof window !== "undefined") {
          localStorage.setItem("active_company_id", companyId);
          localStorage.setItem("zentra_company_id", companyId);
        }
        return companyId;
      }
    } catch (error) {
      console.warn("Não foi possível consultar a empresa atual pela API:", error);
    }

    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("active_company_id") ||
        localStorage.getItem("zentra_company_id") ||
        localStorage.getItem("companyId") ||
        ""
      );
    }

    return "";
  }

  async function loadTeamUsers() {
    try {
      setLoadingTeamUsers(true);

      const companyId = await getCurrentCompanyId();

      if (!companyId) {
        console.warn("Empresa atual não encontrada para carregar responsáveis.");
        setTeamUsers([]);
        return;
      }

      const res = await fetch(
        `/api/admin/users?companyId=${encodeURIComponent(companyId)}&t=${Date.now()}`,
        {
          cache: "no-store",
          credentials: "include",
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("Erro ao carregar usuários:", data.error || data);
        setTeamUsers([]);
        return;
      }

      const rawUsers = Array.isArray(data)
        ? data
        : Array.isArray(data.users)
        ? data.users
        : Array.isArray(data.data)
        ? data.data
        : [];

      const normalizedUsers = rawUsers
        .filter((user: TeamUser) => user && user.active !== false)
        .map((user: TeamUser) => {
          const membershipId = String(user.id || "").trim();
          const authUserId = String(user.user_id || "").trim();
          const valueId = authUserId || membershipId;

          return {
            ...user,
            id: membershipId || valueId,
            user_id: valueId,
            name: String(user.name || user.email || "Usuário").trim(),
          };
        })
        .filter((user: TeamUser) => Boolean(user.user_id || user.id));

      setTeamUsers(normalizedUsers);

      setForm((current) => {
        if (!current.responsibleUserId) return current;

        const selectedStillExists = normalizedUsers.some(
          (user: TeamUser) =>
            (user.user_id || user.id) === current.responsibleUserId
        );

        return selectedStillExists
          ? current
          : {
              ...current,
              responsibleUserId: "",
              responsibleName: "",
            };
      });
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      setTeamUsers([]);
    } finally {
      setLoadingTeamUsers(false);
    }
  }

  function selectResponsible(userId: string) {
    const user = teamUsers.find((item) => (item.user_id || item.id) === userId);

    setForm((current) => ({
      ...current,
      responsibleUserId: userId,
      responsibleName: user?.name || user?.email || "",
    }));
  }

  function editJob(job: Job) {
    setEditingId(job.id);

    setForm({
      title: job.title || "",
      department: getClientName(job),
      clientId: getClientId(job),
      responsibleUserId: getResponsibleUserId(job),
      responsibleName: getResponsibleName(job),
      priority: getPriority(job),
      startDate: getMeta(job, "startDate") || "",
      dueDate: getMeta(job, "dueDate") || "",
      meetLink: getMeta(job, "meetLink") || "",
      processDate: getMeta(job, "processDate") || "",
      processTime: getMeta(job, "processTime") || "",
      city: job.city || "",
      state: job.state || "",
      neighborhood: job.neighborhood || "",
      region: job.region || "nenhuma",
      zipCode: job.zipCode || "",
      workMode: job.workMode || "presencial",
      contractType: job.contractType || "clt",
      shift: getJson(job, "shift") || "",
      openings: String(getJson(job, "openings") || "1"),
      salaryMin: job.salaryMin ? String(job.salaryMin) : "",
      salaryMax: job.salaryMax ? String(job.salaryMax) : "",
      description: job.description || "",
      requirementsText: job.requirements?.text || job.aiCriteria?.raw || "",
      educationRequired: job.educationRequired || "",
      educationCurrent: getJson(job, "educationCurrent") || "",
      courseStatus: getJson(job, "courseStatus") || "",
      courseArea: getJson(job, "courseArea") || "",
      studentYear: getJson(job, "studentYear") || "",
      experienceRequired: job.experienceRequired || "",
      experienceMode: getJson(job, "experienceMode") || "indiferente",
      minExperienceMonths: getJson(job, "minExperienceMonths") ? String(getJson(job, "minExperienceMonths")) : "",
      skillsRequired: joinList(job.skillsRequired),
      languagesRequired: joinList(getJson(job, "languagesRequired")),
      ageMin: getJson(job, "ageMin") ? String(getJson(job, "ageMin")) : "",
      ageMax: getJson(job, "ageMax") ? String(getJson(job, "ageMax")) : "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function loadJobs() {
    try {
      setLoading(true);

      const res = await fetch("/api/rh/jobs", {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao carregar vagas.");
        return;
      }

      setJobs(data.jobs || []);
      setStats(
        data.stats || {
          total: 0,
          open: 0,
          draft: 0,
          paused: 0,
          closed: 0,
        }
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveJob(status: "open" | "draft") {
    if (!form.title.trim()) {
      alert("Informe o título da vaga.");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/rh/jobs", {
        method: editingId ? "PATCH" : "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          id: editingId,
          status,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao salvar vaga.");
        return;
      }

      setForm(emptyForm);
      setEditingId(null);
      await loadJobs();

      alert(status === "open" ? "Vaga publicada." : "Rascunho salvo.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(job: Job, status: string) {
    const res = await fetch("/api/rh/jobs", {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...job,
        status,
        skillsRequired: job.skillsRequired || [],
        languagesRequired: getJson(job, "languagesRequired") || [],
        ageMin: getJson(job, "ageMin") || "",
        ageMax: getJson(job, "ageMax") || "",
        shift: getJson(job, "shift") || "",
        openings: getJson(job, "openings") || "1",
        educationCurrent: getJson(job, "educationCurrent") || "",
        courseStatus: getJson(job, "courseStatus") || "",
        courseArea: getJson(job, "courseArea") || "",
        studentYear: getJson(job, "studentYear") || "",
        experienceMode: getJson(job, "experienceMode") || "indiferente",
        minExperienceMonths: getJson(job, "minExperienceMonths") || "",
        requirementsText: job.requirements?.text || "",
        clientId: getClientId(job),
        clientName: getClientName(job),
        responsibleUserId: getResponsibleUserId(job),
        responsibleName: getResponsibleName(job),
        priority: getPriority(job),
        startDate: getMeta(job, "startDate") || "",
        dueDate: getMeta(job, "dueDate") || "",
        meetLink: getMeta(job, "meetLink") || "",
        processDate: getMeta(job, "processDate") || "",
        processTime: getMeta(job, "processTime") || "",
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao atualizar vaga.");
      return;
    }

    await loadJobs();
  }

  function handleDragStart(job: Job) {
    setDraggingJobId(job.id);
  }

  async function handleDrop(targetStatus: string) {
    const job = jobs.find((item) => item.id === draggingJobId);

    setDraggingJobId(null);

    if (!job || job.status === targetStatus) return;

    await changeStatus(job, targetStatus);
  }

  async function duplicateJob(job: Job) {
    const confirmed = confirm(
      `Duplicar a vaga "${job.title}"?\n\nA cópia será criada como rascunho, sem candidatos, lotes ou entrevistas.`
    );

    if (!confirmed) return;

    try {
      setDuplicatingJobId(job.id);

      const res = await fetch("/api/rh/jobs", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          duplicateFromId: job.id,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao duplicar vaga.");
        return;
      }

      await loadJobs();
      alert(`Vaga duplicada como rascunho: ${data.job?.title || `${job.title} - Cópia`}`);
    } finally {
      setDuplicatingJobId(null);
    }
  }

  async function deleteJob(job: Job) {
    const confirmed = confirm(`Excluir a vaga "${job.title}"?`);

    if (!confirmed) return;

    const res = await fetch(`/api/rh/jobs?id=${job.id}`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao excluir vaga.");
      return;
    }

    await loadJobs();
  }

  async function matchCandidates(job: Job) {
    try {
      setMatchingJobId(job.id);

      const rawLimit = prompt(
        "Quantos candidatos você quer trazer?\nEx: 10, 15, 20, 30, 50, 100",
        "20"
      );

      if (rawLimit === null) return;

      const requestedLimit = Math.max(
        1,
        Math.min(200, Number(rawLimit.replace(/\D/g, "")) || 20)
      );

      const rawCooldown = prompt(
        "Por quantos dias candidatos já selecionados para esta vaga devem ficar ocultos?\nEx: 7, 14, 30",
        "14"
      );

      if (rawCooldown === null) return;

      const cooldownDays = Math.max(
        1,
        Math.min(180, Number(rawCooldown.replace(/\D/g, "")) || 14)
      );

      const minScore = 60;

      const res = await fetch("/api/rh/jobs/match", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobId: job.id,
          limit: Math.max(requestedLimit, 80),
          minScore,
          useAi: true,
          excludeRecentlySelected: true,
          cooldownDays,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao gerar ranking de candidatos.");
        return;
      }

      const allMatches = data.matches || [];

      const matches = allMatches
        .filter((item: any) => Number(item?.score || 0) >= minScore)
        .slice(0, requestedLimit);

      if (!matches.length) {
        alert(
          `Matching finalizado, mas nenhum candidato atingiu ${minScore}% de aderência.\n\nCandidatos analisados: ${
            data.totalCandidates || 0
          }`
        );
        return;
      }

      const payload = {
        jobId: job.id,
        jobTitle: job.title,
        jobContext: {
          title: job.title,
          city: job.city,
          state: job.state,
          neighborhood: job.neighborhood,
          region: job.region,
          contractType: job.contractType,
          filters: job.filters,
          requirements: job.requirements,
        },
        totalCandidates: data.totalCandidates || 0,
        engine: data.engine || "matching",
        minScore,
        requestedLimit,
        selectedCandidates: matches.length,
        cooldownDays,
        excludedRecentlySelected: data.excludedRecentlySelected || 0,
        createdAt: new Date().toISOString(),
        matches,
      };

      localStorage.setItem("zentra_rh_last_job_match", JSON.stringify(payload));

      const ids = matches
        .map((item: any) => item?.candidate?.id)
        .filter(Boolean)
        .join(",");

      window.location.href = `/crm/dashboard/candidates?matchJobId=${job.id}&matchIds=${encodeURIComponent(ids)}`;
    } finally {
      setMatchingJobId(null);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.kicker}>Zentra RH</p>
          <h1 style={styles.title}>Vagas inteligentes</h1>
          <p style={styles.subtitle}>
            Cadastre critérios da vaga para o sistema ranquear candidatos por idade, região,
            escolaridade, curso, experiência e habilidades.
          </p>
        </div>

        <button style={styles.primaryButton} onClick={loadJobs}>
          Atualizar
        </button>
      </section>

      <section style={styles.statsGrid}>
        <Stat label="Total" value={stats.total} />
        <Stat label="Abertas" value={stats.open} />
        <Stat label="Rascunhos" value={stats.draft} />
        <Stat label="Pausadas" value={stats.paused} />
        <Stat label="Fechadas" value={stats.closed} />
      </section>

      <section style={styles.card}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.sectionTitle}>
              {editingId ? "Editar vaga" : "Nova vaga"}
            </h2>
            <p style={styles.smallText}>
              Os critérios ficam salvos dentro da vaga e serão usados no matching dos currículos.
            </p>
          </div>

          <div style={styles.headerActions}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => setIsFormCollapsed((current) => !current)}
            >
              {isFormCollapsed ? "Mostrar formulário" : "Minimizar formulário"}
            </button>

            {editingId && (
              <button style={styles.secondaryButton} onClick={cancelEdit}>
                Cancelar edição
              </button>
            )}
          </div>
        </div>

        {!isFormCollapsed ? (
          <>
            <div style={styles.formGrid}>
              <Input label="Título da vaga" value={form.title} onChange={(v) => updateForm("title", v)} placeholder="Ex: Auxiliar Administrativo" />

          <label style={styles.label}>
            Cliente
            <div style={styles.clientFieldBox}>
              <input
                style={styles.input}
                list="client-options"
                value={form.department}
                onChange={(e) => selectClientByName(e.target.value)}
                onBlur={(e) => selectClientByName(e.target.value)}
                placeholder="Busque pelo nome do cliente"
              />
              <a style={styles.inlineLinkButton} href="/crm/dashboard/clients" target="_blank" rel="noreferrer">
                Cadastrar cliente
              </a>
            </div>
            <datalist id="client-options">
              {clientOptions.map((client) => (
                <option key={client.id} value={client.name} />
              ))}
            </datalist>
          </label>

          <Field label="Responsável">
            <div style={{ display: "grid", gap: 8 }}>
              <select
                style={styles.input}
                value={form.responsibleUserId}
                onChange={(e) => selectResponsible(e.target.value)}
                disabled={loadingTeamUsers}
              >
                <option value="">
                  {loadingTeamUsers ? "Carregando usuários..." : "Sem responsável"}
                </option>
                {!loadingTeamUsers && teamUsers.length === 0 && (
                  <option value="" disabled>
                    Nenhum usuário encontrado para esta empresa
                  </option>
                )}
                {teamUsers.map((user) => {
                  const id = user.user_id || user.id || "";
                  return (
                    <option key={id} value={id}>
                      {user.name || user.email || "Usuário"} {user.role ? `- ${user.role}` : ""}
                    </option>
                  );
                })}
              </select>

              <button
                type="button"
                style={{ ...styles.secondaryButton, width: "fit-content", padding: "8px 12px" }}
                onClick={loadTeamUsers}
                disabled={loadingTeamUsers}
              >
                {loadingTeamUsers ? "Atualizando..." : "Atualizar usuários"}
              </button>
            </div>
          </Field>

              <Field label="Prioridade">
                <div style={styles.prioritySelector}>
                  {(["urgent", "high", "normal", "low"] as const).map((priority) => {
                    const active = form.priority === priority;
                    return (
                      <button
                        key={priority}
                        type="button"
                        onClick={() => updateForm("priority", priority)}
                        style={{
                          ...styles.priorityOption,
                          ...priorityPillStyle(priority),
                          ...(active ? styles.priorityOptionActive : {}),
                        }}
                      >
                        {priorityLabel[priority]}
                      </button>
                    );
                  })}
                </div>
              </Field>

          <Field label="Tipo de contrato">
            <select style={styles.input} value={form.contractType} onChange={(e) => updateForm("contractType", e.target.value)}>
              <option value="clt">CLT</option>
              <option value="estagio">Estágio</option>
              <option value="pj">PJ</option>
              <option value="temporario">Temporário</option>
              <option value="jovem_aprendiz">Jovem Aprendiz</option>
              <option value="freelancer">Freelancer</option>
            </select>
          </Field>

          <Field label="Modalidade">
            <select style={styles.input} value={form.workMode} onChange={(e) => updateForm("workMode", e.target.value)}>
              <option value="presencial">Presencial</option>
              <option value="hibrido">Híbrido</option>
              <option value="remoto">Remoto</option>
            </select>
          </Field>

          <Input label="Quantidade de vagas" value={form.openings} onChange={(v) => updateForm("openings", v)} placeholder="Ex: 10" />
          <Input label="Turno / horário" value={form.shift} onChange={(v) => updateForm("shift", v)} placeholder="Ex: Manhã, tarde, comercial" />

          <Input label="Data de início" value={form.startDate} onChange={(v) => updateForm("startDate", v)} placeholder="AAAA-MM-DD" />
          <Input label="Data de vencimento" value={form.dueDate} onChange={(v) => updateForm("dueDate", v)} placeholder="AAAA-MM-DD" />
          <Input label="Link do Meet" value={form.meetLink} onChange={(v) => updateForm("meetLink", v)} placeholder="Cole o link da entrevista" />
          <Input label="Dia do processo seletivo" value={form.processDate} onChange={(v) => updateForm("processDate", v)} placeholder="AAAA-MM-DD" />
          <Input label="Horário do processo seletivo" value={form.processTime} onChange={(v) => updateForm("processTime", v)} placeholder="Ex: 14:00" />

          <Input label="Cidade" value={form.city} onChange={(v) => updateForm("city", v)} placeholder="Ex: São Paulo" />
          <Input label="Estado" value={form.state} onChange={(v) => updateForm("state", v)} placeholder="Ex: SP" />
          <Input label="Bairro" value={form.neighborhood} onChange={(v) => updateForm("neighborhood", v)} placeholder="Ex: Tatuapé" />

          <Field label="Região">
            <select style={styles.input} value={form.region} onChange={(e) => updateForm("region", e.target.value)}>
              {Object.entries(regionLabel).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>

          <Input label="CEP / referência" value={form.zipCode} onChange={(v) => updateForm("zipCode", v)} placeholder="Opcional" />
          <Input label="Salário mínimo / bolsa" value={form.salaryMin} onChange={(v) => updateForm("salaryMin", v)} placeholder="Ex: 1800" />
          <Input label="Salário máximo" value={form.salaryMax} onChange={(v) => updateForm("salaryMax", v)} placeholder="Ex: 2500" />

          <Input label="Idade mínima" value={form.ageMin} onChange={(v) => updateForm("ageMin", v)} placeholder="Ex: 16" />
          <Input label="Idade máxima" value={form.ageMax} onChange={(v) => updateForm("ageMax", v)} placeholder="Ex: 24" />

          <Field label="Escolaridade mínima">
            <select style={styles.input} value={form.educationRequired} onChange={(e) => updateForm("educationRequired", e.target.value)}>
              <option value="">Indiferente</option>
              <option value="fundamental">Ensino fundamental</option>
              <option value="medio_incompleto">Ensino médio incompleto</option>
              <option value="medio_cursando">Ensino médio cursando</option>
              <option value="medio_completo">Ensino médio completo</option>
              <option value="tecnico">Técnico</option>
              <option value="superior_cursando">Superior cursando</option>
              <option value="superior_completo">Superior completo</option>
            </select>
          </Field>

          <Field label="Situação de estudo">
            <select style={styles.input} value={form.courseStatus} onChange={(e) => updateForm("courseStatus", e.target.value)}>
              <option value="">Indiferente</option>
              <option value="cursando">Cursando</option>
              <option value="concluido">Concluído</option>
              <option value="trancado">Trancado</option>
              <option value="nao_cursa">Não está cursando</option>
            </select>
          </Field>

          <Input label="Ano/período" value={form.studentYear} onChange={(v) => updateForm("studentYear", v)} placeholder="Ex: 1º, 2º, 3º, 4º semestre" />
          <Input label="Curso / área" value={form.courseArea} onChange={(v) => updateForm("courseArea", v)} placeholder="Ex: Administração, RH, Logística" />

          <Field label="Experiência">
            <select style={styles.input} value={form.experienceMode} onChange={(e) => updateForm("experienceMode", e.target.value)}>
              <option value="indiferente">Indiferente</option>
              <option value="sem_experiencia">Sem experiência</option>
              <option value="desejavel">Desejável</option>
              <option value="obrigatoria">Obrigatória</option>
            </select>
          </Field>

          <Input label="Experiência mínima em meses" value={form.minExperienceMonths} onChange={(v) => updateForm("minExperienceMonths", v)} placeholder="Ex: 6, 12, 24" />
          <Input label="Resumo da experiência" value={form.experienceRequired} onChange={(v) => updateForm("experienceRequired", v)} placeholder="Ex: atendimento, vendas, administrativo" />
          <Input label="Habilidades" value={form.skillsRequired} onChange={(v) => updateForm("skillsRequired", v)} placeholder="Excel, atendimento, comunicação" />
          <Input label="Idiomas" value={form.languagesRequired} onChange={(v) => updateForm("languagesRequired", v)} placeholder="Inglês, espanhol" />

          <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
            Descrição da vaga
            <textarea style={{ ...styles.input, minHeight: 110 }} value={form.description} onChange={(e) => updateForm("description", e.target.value)} placeholder="Descreva responsabilidades, rotina, benefícios e detalhes para a IA entender a vaga." />
          </label>

          <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
            Critérios adicionais para matching
            <textarea style={{ ...styles.input, minHeight: 95 }} value={form.requirementsText} onChange={(e) => updateForm("requirementsText", e.target.value)} placeholder="Ex: perfil comunicativo, mora próximo, disponibilidade aos sábados, estágio em administração..." />
          </label>
            </div>

            <div style={styles.actionRow}>
              <button style={styles.secondaryButton} onClick={() => saveJob("draft")} disabled={saving}>
                {saving ? "Salvando..." : "Salvar rascunho"}
              </button>

              <button style={styles.primaryButton} onClick={() => saveJob("open")} disabled={saving}>
                {saving ? "Publicando..." : editingId ? "Salvar e publicar" : "Publicar vaga"}
              </button>
            </div>
          </>
        ) : (
          <div style={styles.collapsedFormBox}>
            <div>
              <strong>{editingId ? "Edição minimizada" : "Cadastro de vaga minimizado"}</strong>
              <p style={styles.smallText}>
                O formulário ficou recolhido para dar mais espaço ao Kanban. Clique em "Mostrar formulário" quando precisar criar ou editar uma vaga.
              </p>
            </div>
            <button type="button" style={styles.primaryButton} onClick={() => setIsFormCollapsed(false)}>
              Mostrar formulário
            </button>
          </div>
        )}
      </section>

      <section style={styles.card}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.sectionTitle}>Vagas cadastradas</h2>
            <p style={styles.smallText}>Use “Buscar candidatos” para gerar o lote vinculado à vaga.</p>
          </div>
        </div>

        <div style={styles.filtersBox}>
          <Input label="Buscar" value={filters.search} onChange={(v) => updateFilter("search", v)} placeholder="Vaga, cliente, cidade..." />

          <Field label="Cliente">
            <select style={styles.input} value={filters.client} onChange={(e) => updateFilter("client", e.target.value)}>
              <option value="">Todos</option>
              {clientOptions.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Responsável">
            <select style={styles.input} value={filters.responsibleUserId} onChange={(e) => updateFilter("responsibleUserId", e.target.value)}>
              <option value="">Todos</option>
              {teamUsers.length === 0 && (
                <option value="" disabled>
                  Nenhum usuário encontrado
                </option>
              )}
              {teamUsers.map((user) => {
                const id = user.user_id || user.id || "";
                return <option key={id} value={id}>{user.name || user.email || "Usuário"}</option>;
              })}
            </select>
          </Field>

          <Field label="Prioridade">
            <select style={styles.input} value={filters.priority} onChange={(e) => updateFilter("priority", e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(priorityLabel).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>

          <Field label="Status">
            <select style={styles.input} value={filters.status} onChange={(e) => updateFilter("status", e.target.value)}>
              <option value="">Todos</option>
              {kanbanColumns.map((column) => (
                <option key={column.key} value={column.key}>{column.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Contrato">
            <select style={styles.input} value={filters.contractType} onChange={(e) => updateFilter("contractType", e.target.value)}>
              <option value="">Todos</option>
              <option value="clt">CLT</option>
              <option value="estagio">Estágio</option>
              <option value="pj">PJ</option>
              <option value="temporario">Temporário</option>
              <option value="jovem_aprendiz">Jovem Aprendiz</option>
              <option value="freelancer">Freelancer</option>
            </select>
          </Field>

          <Field label="Cidade">
            <select style={styles.input} value={filters.city} onChange={(e) => updateFilter("city", e.target.value)}>
              <option value="">Todas</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </Field>

          <button style={styles.secondaryButton} onClick={() => setFilters(emptyFilters)}>
            Limpar filtros
          </button>
        </div>

        {loading && <div style={styles.empty}>Carregando vagas...</div>}
        {!loading && !totalVisibleJobs && <div style={styles.empty}>Nenhuma vaga cadastrada.</div>}

        {!loading && Boolean(totalVisibleJobs) && (
          <div style={styles.kanbanBoard}>
            {kanbanColumns.map((column) => {
              const columnJobs = jobsByStatus[column.key] || [];

              return (
                <section
                  key={column.key}
                  style={styles.kanbanColumn}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop(column.key)}
                >
                  <div style={styles.kanbanColumnHeader}>
                    <div>
                      <h3 style={styles.kanbanTitle}>{column.label}</h3>
                      <p style={styles.kanbanHelper}>{column.helper}</p>
                    </div>

                    <span style={styles.kanbanCount}>{columnJobs.length}</span>
                  </div>

                  <div style={styles.kanbanCards}>
                    {!columnJobs.length && (
                      <div style={styles.kanbanEmpty}>
                        Nenhuma vaga nesta etapa.
                      </div>
                    )}

                    {columnJobs.map((job) => (
                      <article
                        key={job.id}
                        style={{
                          ...styles.jobCard,
                          opacity: draggingJobId === job.id ? 0.55 : 1,
                          borderColor: getPriority(job) === "urgent" ? "#fecaca" : getPriority(job) === "high" ? "#fed7aa" : "#dbeafe",
                        }}
                        draggable
                        onDragStart={() => handleDragStart(job)}
                        onDragEnd={() => setDraggingJobId(null)}
                      >
                        <div style={styles.cardTop}>
                          <div>
                            <strong style={styles.jobTitle}>{job.title}</strong>
                            <p style={styles.muted}>{job.department || "Sem cliente"} {getClientId(job) ? "• vinculado" : ""}</p>
                          </div>

                          <div style={styles.cardBadges}>
                            <span style={{ ...styles.priorityBadge, ...(styles as any)[`priority_${getPriority(job)}`] }}>
                              {priorityLabel[getPriority(job)] || "Normal"}
                            </span>
                            <span style={styles.badge}>{statusLabel[job.status] || job.status}</span>
                          </div>
                        </div>

                        <div style={styles.metaGrid}>
                          <span><b>Responsável:</b> {getResponsibleName(job) || "Sem responsável"}</span>
                          <span><b>Início:</b> {getMeta(job, "startDate") || "-"}</span>
                          <span><b>Vencimento:</b> {getMeta(job, "dueDate") || "-"}</span>
                          <span><b>Processo:</b> {[getMeta(job, "processDate"), getMeta(job, "processTime")].filter(Boolean).join(" às ") || "-"}</span>
                          {getMeta(job, "meetLink") && <a style={styles.link} href={String(getMeta(job, "meetLink"))} target="_blank" rel="noreferrer">Abrir Meet</a>}
                        </div>

                        <div style={styles.tags}>
                          {job.contractType && <span>{job.contractType}</span>}
                          {job.workMode && <span>{job.workMode}</span>}
                          {(job.city || job.state) && <span>{[job.city, job.state].filter(Boolean).join(" / ")}</span>}
                          {job.neighborhood && <span>{job.neighborhood}</span>}
                          {job.region && <span>{regionLabel[job.region] || job.region}</span>}
                        </div>

                        <div style={styles.criteriaBox}>
                          <span><b>Idade:</b> {getJson(job, "ageMin") || "-"} até {getJson(job, "ageMax") || "-"}</span>
                          <span><b>Escolaridade:</b> {job.educationRequired || "-"}</span>
                          <span><b>Curso:</b> {getJson(job, "courseArea") || "-"}</span>
                          <span><b>Experiência:</b> {getJson(job, "experienceMode") || job.experienceRequired || "-"}</span>
                          <span><b>Turno:</b> {getJson(job, "shift") || "-"}</span>
                          <span><b>Vagas:</b> {getJson(job, "openings") || "-"}</span>
                        </div>

                        {(job.salaryMin || job.salaryMax) && (
                          <p style={styles.salary}>
                            {money(job.salaryMin)} {job.salaryMax ? `até ${money(job.salaryMax)}` : ""}
                          </p>
                        )}

                        <details style={styles.checklistBox}>
                          <summary style={styles.checklistSummary}>Checklist do status</summary>
                          <div style={styles.checklistItems}>
                            {(statusChecklist[job.status] || []).map((item) => (
                              <label key={item} style={styles.checkItem}>
                                <input type="checkbox" />
                                <span>{item}</span>
                              </label>
                            ))}
                          </div>
                        </details>

                        <label style={styles.moveLabel}>
                          Mover etapa
                          <select
                            style={styles.moveSelect}
                            value={job.status}
                            onChange={(event) => changeStatus(job, event.target.value)}
                          >
                            {kanbanColumns.map((item) => (
                              <option key={item.key} value={item.key}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div style={styles.actionRow}>
                          <button style={styles.primaryButton} onClick={() => matchCandidates(job)} disabled={matchingJobId === job.id || job.status === "draft" || job.status === "closed" || job.status === "canceled"}>
                            {matchingJobId === job.id ? "Buscando..." : "Buscar candidatos"}
                          </button>

                          <button style={styles.secondaryButton} onClick={() => editJob(job)}>
                            Editar
                          </button>

                          <button
                            style={styles.secondaryButton}
                            onClick={() => duplicateJob(job)}
                            disabled={duplicatingJobId === job.id}
                          >
                            {duplicatingJobId === job.id ? "Duplicando..." : "Duplicar"}
                          </button>

                          {job.status !== "paused" && (
                            <button style={styles.secondaryButton} onClick={() => changeStatus(job, "paused")}>
                              Pausar
                            </button>
                          )}

                          {job.status !== "closed" && (
                            <button style={styles.secondaryButton} onClick={() => changeStatus(job, "closed")}>
                              Concluir
                            </button>
                          )}

                          {job.status !== "open" && (
                            <button style={styles.secondaryButton} onClick={() => changeStatus(job, "open")}>
                              Reabrir
                            </button>
                          )}

                          <button style={styles.dangerButton} onClick={() => deleteJob(job)}>
                            Excluir
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div style={styles.statCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={styles.label}>
      {label}
      {children}
    </label>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={styles.label}>
      {label}
      <input style={styles.input} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 20,
    background: "linear-gradient(135deg, #eff6ff, #ffffff, #dbeafe)",
    color: "#0f172a",
  },
  hero: {
    background: "#fff",
    border: "1px solid #bfdbfe",
    borderRadius: 28,
    padding: 24,
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    boxShadow: "0 18px 50px rgba(37,99,235,.08)",
  },
  kicker: {
    margin: 0,
    color: "#2563eb",
    fontWeight: 950,
    letterSpacing: ".22em",
    fontSize: 12,
    textTransform: "uppercase",
  },
  title: {
    margin: "8px 0",
    fontSize: 38,
    fontWeight: 950,
    letterSpacing: "-.04em",
  },
  subtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: 14,
    maxWidth: 820,
    lineHeight: 1.6,
  },
  statsGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 12,
  },
  statCard: {
    background: "#fff",
    border: "1px solid #bfdbfe",
    borderRadius: 20,
    padding: 16,
    display: "grid",
    gap: 8,
  },
  card: {
    marginTop: 18,
    background: "#fff",
    border: "1px solid #bfdbfe",
    borderRadius: 28,
    padding: 22,
    boxShadow: "0 18px 50px rgba(37,99,235,.06)",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
  headerActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 950,
  },
  smallText: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 12,
  },
  filtersBox: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    alignItems: "end",
    border: "1px solid #dbeafe",
    background: "#f8fafc",
    borderRadius: 22,
    padding: 14,
  },
  formGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  label: {
    display: "grid",
    gap: 7,
    fontSize: 12,
    color: "#334155",
    fontWeight: 900,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 16,
    border: "1px solid #bfdbfe",
    background: "#f8fafc",
    padding: "13px 14px",
    outline: "none",
    fontSize: 14,
    color: "#0f172a",
  },
  clientFieldBox: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 8,
    alignItems: "center",
  },
  inlineLinkButton: {
    border: "1px solid #bfdbfe",
    borderRadius: 14,
    padding: "12px 12px",
    background: "#fff",
    color: "#2563eb",
    fontWeight: 950,
    fontSize: 12,
    textDecoration: "none",
    whiteSpace: "nowrap",
  },
  prioritySelector: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 8,
  },
  priorityOption: {
    borderRadius: 14,
    padding: "13px 10px",
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 13,
    transition: "transform .15s ease, box-shadow .15s ease, opacity .15s ease",
  },
  priorityOptionActive: {
    transform: "translateY(-1px)",
    boxShadow: "0 12px 24px rgba(15,23,42,.16)",
    outline: "3px solid rgba(37,99,235,.18)",
  },
  collapsedFormBox: {
    marginTop: 16,
    border: "1px dashed #93c5fd",
    background: "#f8fafc",
    borderRadius: 22,
    padding: 16,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  actionRow: {
    marginTop: 14,
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  primaryButton: {
    border: 0,
    borderRadius: 16,
    padding: "12px 16px",
    background: "linear-gradient(135deg, #38bdf8, #2563eb)",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(37,99,235,.20)",
  },
  secondaryButton: {
    border: "1px solid #bfdbfe",
    borderRadius: 16,
    padding: "11px 14px",
    background: "#fff",
    color: "#2563eb",
    fontWeight: 950,
    cursor: "pointer",
  },
  dangerButton: {
    border: "1px solid #fecaca",
    borderRadius: 16,
    padding: "11px 14px",
    background: "#fff1f2",
    color: "#dc2626",
    fontWeight: 950,
    cursor: "pointer",
  },
  empty: {
    marginTop: 16,
    border: "1px dashed #93c5fd",
    borderRadius: 20,
    padding: 24,
    textAlign: "center",
    color: "#64748b",
    background: "#f8fafc",
  },
  kanbanBoard: {
    marginTop: 16,
    display: "flex",
    gap: 14,
    overflowX: "auto",
    paddingBottom: 14,
    WebkitOverflowScrolling: "touch",
  },
  kanbanColumn: {
    minWidth: 310,
    width: 310,
    flex: "0 0 310px",
    border: "1px solid #dbeafe",
    background: "#f8fafc",
    borderRadius: 24,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    maxHeight: "78vh",
  },
  kanbanColumnHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
    position: "sticky",
    top: 0,
    background: "#f8fafc",
    zIndex: 1,
    paddingBottom: 4,
  },
  kanbanTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 950,
    lineHeight: 1.25,
  },
  kanbanHelper: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 11,
    lineHeight: 1.35,
  },
  kanbanCount: {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 12,
    fontWeight: 950,
    minWidth: 28,
    textAlign: "center",
  },
  kanbanCards: {
    display: "grid",
    gap: 12,
    overflowY: "auto",
    paddingRight: 2,
  },
  kanbanEmpty: {
    border: "1px dashed #bfdbfe",
    background: "#fff",
    borderRadius: 18,
    padding: 14,
    color: "#94a3b8",
    fontSize: 12,
    textAlign: "center",
  },
  moveLabel: {
    display: "grid",
    gap: 6,
    color: "#334155",
    fontSize: 12,
    fontWeight: 900,
  },
  moveSelect: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 14,
    border: "1px solid #bfdbfe",
    background: "#fff",
    padding: "10px 12px",
    outline: "none",
    fontSize: 13,
    color: "#0f172a",
    fontWeight: 800,
  },
  jobsGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
    gap: 14,
  },
  jobCard: {
    border: "1px solid #dbeafe",
    background: "#f8fafc",
    borderRadius: 24,
    padding: 16,
    display: "grid",
    gap: 12,
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  jobTitle: {
    fontSize: 17,
    fontWeight: 950,
  },
  muted: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 12,
  },
  cardBadges: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    alignItems: "flex-end",
  },
  priorityBadge: {
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 950,
    whiteSpace: "nowrap",
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
  },
  priority_urgent: {
    borderColor: "#fecaca",
    background: "#fef2f2",
    color: "#dc2626",
  },
  priority_high: {
    borderColor: "#fde68a",
    background: "#fffbeb",
    color: "#ca8a04",
  },
  priority_normal: {
    borderColor: "#bfdbfe",
    background: "#eff6ff",
    color: "#2563eb",
  },
  priority_low: {
    borderColor: "#e2e8f0",
    background: "#f8fafc",
    color: "#64748b",
  },
  badge: {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 999,
    padding: "7px 11px",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  metaGrid: {
    border: "1px solid #dbeafe",
    background: "#fff",
    borderRadius: 16,
    padding: 10,
    display: "grid",
    gap: 6,
    color: "#475569",
    fontSize: 12,
  },
  link: {
    color: "#2563eb",
    fontWeight: 950,
    textDecoration: "none",
  },
  tags: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  criteriaBox: {
    border: "1px solid #dbeafe",
    background: "#fff",
    borderRadius: 18,
    padding: 12,
    display: "grid",
    gap: 6,
    color: "#475569",
    fontSize: 13,
  },
  checklistBox: {
    border: "1px solid #dbeafe",
    borderRadius: 16,
    background: "#ffffff",
    padding: 10,
  },
  checklistSummary: {
    cursor: "pointer",
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 950,
  },
  checklistItems: {
    marginTop: 10,
    display: "grid",
    gap: 7,
  },
  checkItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#475569",
    fontSize: 12,
    fontWeight: 700,
  },
  salary: {
    margin: 0,
    color: "#2563eb",
    fontWeight: 950,
  },
};
