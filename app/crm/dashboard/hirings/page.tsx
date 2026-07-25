"use client";

import { useEffect, useMemo, useState } from "react";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos os status" },
  { value: "pending_documents", label: "Documentos pendentes" },
  { value: "documents_review", label: "Documentos em análise" },
  { value: "documents_approved", label: "Documentos aprovados" },
  { value: "admission_scheduled", label: "Admissão agendada" },
  { value: "hired", label: "Contrato ativo" },
  { value: "finished", label: "Contrato finalizado" },
  { value: "terminated", label: "Contrato rescindido" },
  { value: "canceled", label: "Desistiu/Cancelado" },
];

const CONTRACT_TYPES = [
  "CLT",
  "PJ",
  "Temporário",
  "Estágio",
  "Jovem Aprendiz",
  "Experiência",
  "Freelancer",
];

const DOC_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  sent: "Enviado",
  approved: "Aprovado",
  rejected: "Reprovado",
  expired: "Atrasado",
};

const INTERNSHIP_SUBTYPES = [
  { value: "high_school", label: "Ensino médio" },
  { value: "technical", label: "Ensino técnico" },
  { value: "senai", label: "SENAI" },
  { value: "higher_education", label: "Ensino superior" },
];

const EMPTY_CONTRACT_DATA = {
  hiring_type: "",
  internship_subtype: "",
  father_name: "",
  mother_name: "",
  marital_status: "",
  nationality: "Brasileira",
  birth_city: "",
  rg_number: "",
  rg_issuer: "",
  rg_issue_date: "",
  bank_name: "",
  bank_branch: "",
  bank_account: "",
  bank_account_type: "",
  institution_name: "",
  institution_cnpj: "",
  course_name: "",
  semester: "",
  enrollment_number: "",
  education_level: "",
  guardian_name: "",
  guardian_cpf: "",
  guardian_rg: "",
  guardian_relationship: "",
  notes: "",
};

function getRequiredContractFields(data: any) {
  const base = [
    "mother_name",
    "marital_status",
    "nationality",
    "birth_city",
    "rg_number",
    "rg_issuer",
  ];

  const type = String(data?.hiring_type || "").toLowerCase();

  if (type.includes("estágio") || type.includes("estagio")) {
    return [
      ...base,
      "internship_subtype",
      "institution_name",
      "course_name",
      "enrollment_number",
    ];
  }

  if (type.includes("clt")) {
    return [...base, "bank_name", "bank_branch", "bank_account"];
  }

  return base;
}

function contractCompletion(data: any) {
  const required = getRequiredContractFields(data);
  if (!required.length) return 100;

  const complete = required.filter((field) =>
    String(data?.[field] || "").trim()
  ).length;

  return Math.round((complete / required.length) * 100);
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function addMonths(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function statusLabel(status: string) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label || status;
}

function docStatusLabel(status: string) {
  return DOC_STATUS_LABELS[status] || status;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

function formatMoney(value: any) {
  const number = Number(value || 0);
  return number.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatPhone(phone?: string | null) {
  if (!phone) return "-";
  const digits = String(phone).replace(/\D/g, "");
  return digits.startsWith("55") ? `+${digits}` : phone;
}

function getCandidateName(item: any) {
  return item.candidate_name || item.candidate?.name || item.candidate?.firstName || "Candidato";
}

function getCandidatePhone(item: any) {
  return item.phone || item.candidate?.phone || item.candidate?.mobile || "";
}

function getCandidateEmail(item: any) {
  return item.email || item.candidate?.email || "";
}

function getJobTitle(item: any) {
  return item.job_title || item.position || item.job?.title || "Sem vaga informada";
}

function getSalary(item: any) {
  return item.salary || 0;
}

function getStartDate(item: any) {
  return item.start_date || item.startDate || item.hired_at || item.createdAt;
}

function getEndDate(item: any) {
  return item.end_date || item.endDate || item.contractEndDate || null;
}

function daysTo(dateValue?: string | null) {
  if (!dateValue) return null;
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function contractAlert(item: any) {
  const days = daysTo(getEndDate(item));

  if (days === null) return null;
  if (days < 0) return `Contrato vencido há ${Math.abs(days)} dia(s)`;
  if (days === 0) return "Contrato vence hoje";
  if (days <= 7) return `Contrato vence em ${days} dia(s)`;
  if (days <= 30) return `Contrato vence em ${days} dia(s)`;

  return null;
}

export default function HiringsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [documentsByHiring, setDocumentsByHiring] = useState<Record<string, any[]>>({});
  const [stats, setStats] = useState<any>({
    total: 0,
    totalSalary: 0,
    averageSalary: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const [activeHiring, setActiveHiring] = useState<any | null>(null);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [contractData, setContractData] = useState<any>(EMPTY_CONTRACT_DATA);
  const [loadingContractData, setLoadingContractData] = useState(false);
  const [savingContractData, setSavingContractData] = useState(false);
  const [contractPreview, setContractPreview] = useState<any | null>(null);
  const [contractVersions, setContractVersions] = useState<any[]>([]);
  const [generatingContract, setGeneratingContract] = useState(false);
  const [savingContractVersion, setSavingContractVersion] = useState(false);

  const [filters, setFilters] = useState({
    candidate: "",
    company: "",
    job: "",
    contractType: "all",
    status: "all",
    documentState: "all",
    assignedTo: "all",
    priority: "all",
  });

  const [metricDetails, setMetricDetails] = useState<{
    title: string;
    type: string;
  } | null>(null);

  const [users, setUsers] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");

  const [form, setForm] = useState({
    candidate_name: "",
    job_title: "",
    phone: "",
    email: "",
    salary: "",
    contractType: "CLT",
    startDate: todayInput(),
    endDate: addMonths(12),
    hired_at: todayInput(),
    status: "pending_documents",
    notes: "",
  });

  async function loadHirings() {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (filters.status !== "all") params.set("status", filters.status);

      const res = await fetch(`/api/rh/hirings?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao carregar contratações.");
        return;
      }

      const hirings = data.hirings || [];

      setItems(hirings);
      setStats(data.stats || { total: 0, totalSalary: 0, averageSalary: 0 });

      for (const item of hirings.slice(0, 50)) {
        loadDocuments(item.id);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadDocuments(hiringId: string) {
    const res = await fetch(`/api/rh/hirings/documents?hiringId=${hiringId}`, {
      cache: "no-store",
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setDocumentsByHiring((prev) => ({
        ...prev,
        [hiringId]: data.documents || [],
      }));
    }
  }

  async function loadUsers() {
    const res = await fetch("/api/rh/hirings/users", {
      cache: "no-store",
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setUsers(data.users || []);
      setCurrentUserId(data.currentUserId || null);
    }
  }

  async function loadTimeline(hiringId: string) {
    setLoadingTimeline(true);

    try {
      const res = await fetch(
        `/api/rh/hirings/timeline?hiringId=${encodeURIComponent(hiringId)}`,
        {
          cache: "no-store",
          credentials: "include",
        }
      );

      const data = await res.json().catch(() => ({}));

      if (res.ok) setTimeline(data.events || []);
    } finally {
      setLoadingTimeline(false);
    }
  }

  useEffect(() => {
    loadHirings();
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const localStats = useMemo(() => {
    const docs = Object.values(documentsByHiring).flat();

    const lateDocs = docs.filter((doc: any) => doc.isLate || doc.computedStatus === "expired").length;
    const pendingDocs = docs.filter((doc: any) => ["pending", "sent", "rejected"].includes(doc.status)).length;
    const activeContracts = items.filter((item) => item.status === "hired").length;
    const endingContracts = items.filter((item) => {
      const alert = contractAlert(item);
      return Boolean(alert);
    }).length;

    return {
      total: items.length,
      pendingDocs,
      lateDocs,
      activeContracts,
      endingContracts,
      hired: items.filter((item) => item.status === "hired").length,
      unassigned: items.filter(
        (item) => !(item.assigned_to || item.assigned_user_id)
      ).length,
      urgent: items.filter((item) => item.priority === "urgent").length,
    };
  }, [items, documentsByHiring]);

  const filterOptions = useMemo(() => {
    const unique = (values: string[]) =>
      Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      );

    return {
      companies: unique(
        items.map(
          (item) =>
            item.company_name ||
            item.company?.name ||
            item.client_name ||
            ""
        )
      ),
      jobs: unique(items.map((item) => getJobTitle(item))),
      contractTypes: unique(
        items.map(
          (item) =>
            item.contract_type ||
            item.contractType ||
            item.job?.contract_type ||
            ""
        )
      ),
    };
  }, [items]);

  const metricRows = useMemo(() => {
    const rows: any[] = [];

    for (const hiring of items) {
      const docs = documentsByHiring[hiring.id] || [];

      for (const doc of docs) {
        rows.push({
          hiring,
          document: doc,
          candidate: getCandidateName(hiring),
          company:
            hiring.company_name ||
            hiring.company?.name ||
            hiring.client_name ||
            "-",
          job: getJobTitle(hiring),
          dueDate: doc.due_date || null,
          isLate:
            Boolean(doc.isLate) ||
            doc.computedStatus === "expired",
          isPending: ["pending", "sent", "rejected"].includes(
            doc.status
          ),
        });
      }
    }

    return rows;
  }, [items, documentsByHiring]);

  const activeMetricRows = useMemo(() => {
    if (!metricDetails) return [];

    if (metricDetails.type === "pending-documents") {
      return metricRows.filter((row) => row.isPending);
    }

    if (metricDetails.type === "late-documents") {
      return metricRows.filter((row) => row.isLate);
    }

    if (metricDetails.type === "active-contracts") {
      return items
        .filter((item) => item.status === "hired")
        .map((hiring) => ({ hiring }));
    }

    if (metricDetails.type === "ending-contracts") {
      return items
        .filter((item) => Boolean(contractAlert(item)))
        .map((hiring) => ({ hiring }));
    }

    if (metricDetails.type === "admissions") {
      return items.map((hiring) => ({ hiring }));
    }

    if (metricDetails.type === "unassigned") {
      return items
        .filter((hiring) => !(hiring.assigned_to || hiring.assigned_user_id))
        .map((hiring) => ({ hiring }));
    }

    if (metricDetails.type === "urgent") {
      return items
        .filter((hiring) => hiring.priority === "urgent")
        .map((hiring) => ({ hiring }));
    }

    return [];
  }, [metricDetails, metricRows, items]);

  function clearFilters() {
    setFilters({
      candidate: "",
      company: "",
      job: "",
      contractType: "all",
      status: "all",
      documentState: "all",
      assignedTo: "all",
      priority: "all",
    });
    setGlobalSearch("");
  }

  async function createHiring() {
    if (!form.candidate_name.trim()) {
      alert("Informe o candidato.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/rh/hirings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao criar contratação. Se veio da entrevista, use o botão Aprovar/Contratar na entrevista.");
        return;
      }

      setForm({
        candidate_name: "",
        job_title: "",
        phone: "",
        email: "",
        salary: "",
        contractType: "CLT",
        startDate: todayInput(),
        endDate: addMonths(12),
        hired_at: todayInput(),
        status: "pending_documents",
        notes: "",
      });

      await loadHirings();
    } finally {
      setSaving(false);
    }
  }

  async function updateHiring(item: any, patch: any) {
    const res = await fetch("/api/rh/hirings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        id: item.id,
        ...patch,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao atualizar contratação.");
      return;
    }

    await loadHirings();
  }

  async function uploadDocument(hiringId: string, doc: any, files: FileList | null) {
    if (!files || !files.length) return;

    setUploadingDocId(doc.id);

    try {
      const formData = new FormData();
      formData.append("hiringId", hiringId);
      formData.append("documentId", doc.id);

      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });

      const res = await fetch("/api/rh/hirings/documents", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao enviar documento.");
        return;
      }

      await loadDocuments(hiringId);
    } finally {
      setUploadingDocId(null);
    }
  }

  async function deleteDocumentFile(hiringId: string, fileId: string) {
    if (!confirm("Excluir este anexo?")) return;

    const res = await fetch(`/api/rh/hirings/documents?fileId=${fileId}`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao excluir anexo.");
      return;
    }

    await loadDocuments(hiringId);
  }

  async function updateDocument(hiringId: string, doc: any, patch: any) {
    const res = await fetch("/api/rh/hirings/documents", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        id: doc.id,
        ...patch,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao atualizar documento.");
      return;
    }

    await loadDocuments(hiringId);
  }

  async function setDueDate(hiringId: string, doc: any) {
    const dueDate = prompt("Prazo do documento no formato AAAA-MM-DD", doc.due_date || todayInput());

    if (!dueDate) return;

    await updateDocument(hiringId, doc, { dueDate });
  }

  async function sendWhatsapp(item: any) {
    const phone = String(getCandidatePhone(item)).replace(/\D/g, "");
    if (!phone) {
      alert("Candidato sem telefone.");
      return;
    }

    const message = encodeURIComponent(
      `Olá ${getCandidateName(item)}, tudo bem?\n\nEstamos dando andamento na sua admissão para a vaga ${getJobTitle(item)}.\n\nPor favor, envie os documentos pendentes para seguirmos com o processo.`
    );

    window.open(`https://wa.me/${phone.startsWith("55") ? phone : `55${phone}`}?text=${message}`, "_blank");
  }

  async function deleteHiring(item: any) {
    const candidateName = getCandidateName(item);

    const confirmed = confirm(
      `Excluir definitivamente a contratação de ${candidateName}?\n\nEssa ação remove o registro da área de Contratações e não pode ser desfeita.`
    );

    if (!confirmed) return;

    try {
      setSaving(true);

      const res = await fetch(
        `/api/rh/hirings?id=${encodeURIComponent(item.id)}&hard=1`,
        {
          method: "DELETE",
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao excluir contratação.");
        return;
      }

      setItems((current) =>
        current.filter((hiring) => hiring.id !== item.id)
      );

      setDocumentsByHiring((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });

      if (activeHiring?.id === item.id) {
        setActiveHiring(null);
      }

      await loadHirings();
    } catch (error) {
      console.error("DELETE HIRING FRONTEND ERROR:", error);
      alert("Não foi possível excluir a contratação.");
    } finally {
      setSaving(false);
    }
  }


  const visibleItems = useMemo(() => {
    const normalize = (value: any) =>
      String(value || "")
        .trim()
        .toLocaleLowerCase("pt-BR");

    const global = normalize(globalSearch);

    return items.filter((item) => {
      const candidate = normalize(getCandidateName(item));
      const company = normalize(
        item.company_name ||
          item.company?.name ||
          item.client_name
      );
      const job = normalize(getJobTitle(item));
      const contractType = normalize(
        item.contract_type ||
          item.contractType ||
          item.job?.contract_type
      );
      const responsible = normalize(
        item.assigned_user_name ||
          item.assigned_to_name ||
          users.find(
            (user) =>
              (user.user_id || user.id) ===
              (item.assigned_to || item.assigned_user_id)
          )?.name ||
          ""
      );

      const globalHaystack = [
        candidate,
        company,
        job,
        contractType,
        responsible,
        normalize(getCandidatePhone(item)),
        normalize(getCandidateEmail(item)),
        normalize(item.candidate_cpf),
        normalize(item.cpf),
        normalize(item.city),
      ].join(" ");

      const matchesGlobal =
        !global || globalHaystack.includes(global);

      const matchesCandidate =
        !filters.candidate.trim() ||
        candidate.includes(normalize(filters.candidate));

      const matchesCompany =
        !filters.company.trim() ||
        company === normalize(filters.company);

      const matchesJob =
        !filters.job.trim() ||
        job === normalize(filters.job);

      const matchesContractType =
        filters.contractType === "all" ||
        contractType === normalize(filters.contractType);

      const matchesStatus =
        filters.status === "all" ||
        item.status === filters.status;

      const assignedId =
        item.assigned_to || item.assigned_user_id || "";

      const matchesAssigned =
        filters.assignedTo === "all" ||
        (filters.assignedTo === "mine" &&
          assignedId === currentUserId) ||
        (filters.assignedTo === "unassigned" && !assignedId) ||
        assignedId === filters.assignedTo;

      const matchesPriority =
        filters.priority === "all" ||
        (item.priority || "normal") === filters.priority;

      const docs = documentsByHiring[item.id] || [];
      const hasPending = docs.some((doc: any) =>
        ["pending", "sent", "rejected"].includes(doc.status)
      );
      const hasLate = docs.some(
        (doc: any) =>
          doc.isLate || doc.computedStatus === "expired"
      );
      const allApproved =
        docs.length > 0 &&
        docs.every((doc: any) => doc.status === "approved");

      const matchesDocumentState =
        filters.documentState === "all" ||
        (filters.documentState === "pending" && hasPending) ||
        (filters.documentState === "late" && hasLate) ||
        (filters.documentState === "approved" && allApproved);

      return (
        matchesGlobal &&
        matchesCandidate &&
        matchesCompany &&
        matchesJob &&
        matchesContractType &&
        matchesStatus &&
        matchesAssigned &&
        matchesPriority &&
        matchesDocumentState
      );
    });
  }, [
    items,
    filters,
    documentsByHiring,
    globalSearch,
    users,
    currentUserId,
  ]);

  const boardColumns = useMemo(
    () =>
      STATUS_OPTIONS.filter((status) => status.value !== "all").map((status) => ({
        ...status,
        items: visibleItems.filter((item) => item.status === status.value),
      })),
    [visibleItems]
  );

  async function assignHiring(item: any, assignedTo: string | null) {
    const selectedUser = users.find(
      (user) => (user.user_id || user.id) === assignedTo
    );

    setItems((current) =>
      current.map((hiring) =>
        hiring.id === item.id
          ? {
              ...hiring,
              assigned_to: assignedTo,
              assigned_to_name:
                selectedUser?.name || selectedUser?.email || null,
            }
          : hiring
      )
    );

    const res = await fetch("/api/rh/hirings/assign", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        hiringId: item.id,
        assignedTo,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao atribuir responsável.");
      await loadHirings();
      return;
    }

    if (activeHiring?.id === item.id) {
      setActiveHiring(data.hiring || activeHiring);
      await loadTimeline(item.id);
    }
  }

  async function changePriority(item: any, priority: string) {
    setItems((current) =>
      current.map((hiring) =>
        hiring.id === item.id ? { ...hiring, priority } : hiring
      )
    );

    const res = await fetch("/api/rh/hirings/priority", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        hiringId: item.id,
        priority,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao alterar prioridade.");
      await loadHirings();
      return;
    }

    if (activeHiring?.id === item.id) {
      setActiveHiring(data.hiring || activeHiring);
      await loadTimeline(item.id);
    }
  }

  async function moveHiring(item: any, nextStatus: string) {
    if (!item || item.status === nextStatus) return;

    setItems((current) =>
      current.map((hiring) =>
        hiring.id === item.id ? { ...hiring, status: nextStatus } : hiring
      )
    );

    try {
      await updateHiring(item, { status: nextStatus });
    } catch {
      await loadHirings();
    } finally {
      setDraggingId(null);
    }
  }

  async function loadContractData(item: any) {
    setLoadingContractData(true);

    try {
      const res = await fetch(
        `/api/rh/hirings/contract-data?hiringId=${encodeURIComponent(item.id)}`,
        {
          cache: "no-store",
          credentials: "include",
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao carregar dados contratuais.");
        return;
      }

      const hiringType =
        data.contractData?.hiring_type ||
        item.contract_type ||
        item.contractType ||
        "";

      setContractData({
        ...EMPTY_CONTRACT_DATA,
        ...(data.contractData || {}),
        hiring_type: hiringType,
      });
    } finally {
      setLoadingContractData(false);
    }
  }

  async function saveContractData() {
    if (!activeHiring) return;

    setSavingContractData(true);

    try {
      const payload = {
        ...contractData,
        completion_percent: contractCompletion(contractData),
      };

      const res = await fetch("/api/rh/hirings/contract-data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          hiringId: activeHiring.id,
          contractData: payload,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao salvar dados contratuais.");
        return;
      }

      setContractData({
        ...EMPTY_CONTRACT_DATA,
        ...(data.contractData || payload),
      });

      alert("Dados contratuais salvos.");
    } finally {
      setSavingContractData(false);
    }
  }

  async function loadContractVersions(hiringId: string) {
    const res = await fetch(
      `/api/rh/hirings/contracts?hiringId=${encodeURIComponent(hiringId)}`,
      {
        cache: "no-store",
        credentials: "include",
      }
    );

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setContractVersions(data.contracts || []);
    }
  }

  async function generateContractPreview() {
    if (!activeHiring) return;

    if (contractCompletion(contractData) !== 100) {
      alert("Complete os campos obrigatórios antes de gerar o contrato.");
      return;
    }

    setGeneratingContract(true);

    try {
      const res = await fetch("/api/rh/hirings/contracts/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          hiringId: activeHiring.id,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao gerar pré-visualização.");
        return;
      }

      setContractPreview(data);
      await loadContractVersions(activeHiring.id);
    } finally {
      setGeneratingContract(false);
    }
  }

  async function saveContractVersion() {
    if (!activeHiring || !contractPreview) return;

    setSavingContractVersion(true);

    try {
      const res = await fetch("/api/rh/hirings/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          hiringId: activeHiring.id,
          templateName: contractPreview.templateName,
          templateType: contractPreview.templateType,
          renderedText: contractPreview.renderedText,
          variables: contractPreview.variables || {},
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao salvar contrato.");
        return;
      }

      alert(`Contrato salvo como versão ${data.contract.version}.`);
      await loadContractVersions(activeHiring.id);
    } finally {
      setSavingContractVersion(false);
    }
  }

  function downloadContractText() {
    if (!contractPreview) return;

    const blob = new Blob([contractPreview.renderedText], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `contrato-${getCandidateName(activeHiring || {})}.txt`
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-.]/g, "");

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function printContract() {
    if (!contractPreview) return;

    const popup = window.open("", "_blank", "width=900,height=700");

    if (!popup) {
      alert("Permita pop-ups para imprimir ou salvar o contrato em PDF.");
      return;
    }

    const safeText = contractPreview.renderedText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    popup.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>${contractPreview.templateName}</title>
          <style>
            @page { size: A4; margin: 2cm; }
            body {
              font-family: Arial, Helvetica, sans-serif;
              color: #111827;
              line-height: 1.55;
              font-size: 12pt;
            }
            pre {
              white-space: pre-wrap;
              word-break: break-word;
              font-family: Arial, Helvetica, sans-serif;
            }
          </style>
        </head>
        <body>
          <pre>${safeText}</pre>
          <script>
            window.onload = () => {
              window.print();
            };
          <\/script>
        </body>
      </html>
    `);

    popup.document.close();
  }

  function updateContractField(field: string, value: string) {
    setContractData((current: any) => ({
      ...current,
      [field]: value,
    }));
  }

  function openHiring(item: any) {
    setActiveHiring(item);
    setTimeline([]);
    loadContractData(item);
    loadTimeline(item.id);

    if (!documentsByHiring[item.id]) {
      loadDocuments(item.id);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.kicker}>Zentra RH</p>
          <h1 style={styles.title}>Contratações</h1>
          <p style={styles.subtitle}>
            Kanban operacional de admissões, documentos, prazos e contratos.
          </p>
        </div>

        <div style={styles.heroActions}>
          <button
            style={styles.secondaryButton}
            onClick={() => setShowManualForm((current) => !current)}
          >
            {showManualForm ? "Fechar cadastro" : "Nova admissão"}
          </button>

          <button style={styles.primaryButton} onClick={loadHirings}>
            Atualizar
          </button>
        </div>
      </section>

      <section style={styles.statsGrid}>
        <Metric
          label="Admissões"
          value={localStats.total}
          hint="Ver todos os processos"
          onClick={() =>
            setMetricDetails({
              title: "Todas as admissões",
              type: "admissions",
            })
          }
        />
        <Metric
          label="Docs pendentes"
          value={localStats.pendingDocs}
          hint="Ver documentos e candidatos"
          tone="warning"
          onClick={() =>
            setMetricDetails({
              title: "Documentos pendentes",
              type: "pending-documents",
            })
          }
        />
        <Metric
          label="Docs atrasados"
          value={localStats.lateDocs}
          hint="Ver atrasos agora"
          tone="danger"
          onClick={() =>
            setMetricDetails({
              title: "Documentos atrasados",
              type: "late-documents",
            })
          }
        />
        <Metric
          label="Contratos ativos"
          value={localStats.activeContracts}
          hint="Ver contratos ativos"
          tone="success"
          onClick={() =>
            setMetricDetails({
              title: "Contratos ativos",
              type: "active-contracts",
            })
          }
        />
        <Metric
          label="Contratos vencendo"
          value={localStats.endingContracts}
          hint="Ver próximos vencimentos"
          onClick={() =>
            setMetricDetails({
              title: "Contratos vencendo",
              type: "ending-contracts",
            })
          }
        />
      </section>

      <section style={styles.alertStrip}>
        <button
          style={styles.alertButton}
          onClick={() =>
            setMetricDetails({
              title: "Contratações sem responsável",
              type: "unassigned",
            })
          }
        >
          <strong>{localStats.unassigned}</strong>
          <span>Sem responsável</span>
        </button>

        <button
          style={styles.alertButton}
          onClick={() =>
            setMetricDetails({
              title: "Contratações urgentes",
              type: "urgent",
            })
          }
        >
          <strong>{localStats.urgent}</strong>
          <span>Prioridade urgente</span>
        </button>

        <button
          style={styles.alertButton}
          onClick={() =>
            setMetricDetails({
              title: "Documentos atrasados",
              type: "late-documents",
            })
          }
        >
          <strong>{localStats.lateDocs}</strong>
          <span>Documentos atrasados</span>
        </button>

        <button
          style={styles.alertButton}
          onClick={() =>
            setMetricDetails({
              title: "Contratos vencendo",
              type: "ending-contracts",
            })
          }
        >
          <strong>{localStats.endingContracts}</strong>
          <span>Contratos vencendo</span>
        </button>
      </section>

      {showManualForm && (
        <section style={styles.card}>
          <div style={styles.headerRow}>
            <div>
              <h2 style={styles.sectionTitle}>Nova admissão manual</h2>
              <p style={styles.smallText}>
                Use somente para exceções. O fluxo principal continua automático.
              </p>
            </div>
          </div>

          <div style={styles.formGrid}>
            <input style={styles.input} placeholder="Nome do candidato" value={form.candidate_name} onChange={(e) => setForm({ ...form, candidate_name: e.target.value })} />
            <input style={styles.input} placeholder="Vaga" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
            <input style={styles.input} placeholder="Telefone / WhatsApp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input style={styles.input} placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input style={styles.input} placeholder="Salário" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} />

            <select style={styles.input} value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value })}>
              {CONTRACT_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>

            <label style={styles.label}>
              Início do contrato
              <input type="date" style={styles.input} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </label>

            <label style={styles.label}>
              Fim do contrato
              <input type="date" style={styles.input} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </label>

            <select style={styles.input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUS_OPTIONS.filter((status) => status.value !== "all").map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>

            <textarea
              style={{ ...styles.input, gridColumn: "1 / -1", minHeight: 90 }}
              placeholder="Observações"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <button style={styles.primaryButton} onClick={createHiring} disabled={saving}>
            {saving ? "Salvando..." : "Salvar admissão"}
          </button>
        </section>
      )}

      <section style={styles.boardSection}>
        <div style={styles.boardToolbar}>
          <div>
            <h2 style={styles.sectionTitle}>Kanban de contratações</h2>
            <p style={styles.smallText}>
              Arraste os cartões entre as colunas para atualizar o status.
            </p>
          </div>

          <div style={styles.filterPanel}>
            <label style={{ ...styles.label, marginBottom: 12 }}>
              Busca global
              <input
                style={styles.globalSearch}
                placeholder="Nome, CPF, telefone, e-mail, empresa, vaga, cidade ou responsável"
                value={globalSearch}
                onChange={(event) =>
                  setGlobalSearch(event.target.value)
                }
              />
            </label>

            <div style={styles.filterGrid}>
              <label style={styles.label}>
                Candidato
                <input
                  style={styles.input}
                  placeholder="Digite o nome"
                  value={filters.candidate}
                  onChange={(event) =>
                    setFilters({
                      ...filters,
                      candidate: event.target.value,
                    })
                  }
                />
              </label>

              <label style={styles.label}>
                Empresa
                <select
                  style={styles.input}
                  value={filters.company}
                  onChange={(event) =>
                    setFilters({
                      ...filters,
                      company: event.target.value,
                    })
                  }
                >
                  <option value="">Todas as empresas</option>
                  {filterOptions.companies.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.label}>
                Vaga
                <select
                  style={styles.input}
                  value={filters.job}
                  onChange={(event) =>
                    setFilters({
                      ...filters,
                      job: event.target.value,
                    })
                  }
                >
                  <option value="">Todas as vagas</option>
                  {filterOptions.jobs.map((job) => (
                    <option key={job} value={job}>
                      {job}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.label}>
                Tipo de contrato
                <select
                  style={styles.input}
                  value={filters.contractType}
                  onChange={(event) =>
                    setFilters({
                      ...filters,
                      contractType: event.target.value,
                    })
                  }
                >
                  <option value="all">Todos os tipos</option>
                  {filterOptions.contractTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.label}>
                Status da contratação
                <select
                  style={styles.input}
                  value={filters.status}
                  onChange={(event) =>
                    setFilters({
                      ...filters,
                      status: event.target.value,
                    })
                  }
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option
                      key={status.value}
                      value={status.value}
                    >
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.label}>
                Responsável
                <select
                  style={styles.input}
                  value={filters.assignedTo}
                  onChange={(event) =>
                    setFilters({
                      ...filters,
                      assignedTo: event.target.value,
                    })
                  }
                >
                  <option value="all">Todos os responsáveis</option>
                  <option value="mine">Minhas contratações</option>
                  <option value="unassigned">Sem responsável</option>
                  {users.map((user) => (
                    <option
                      key={user.id}
                      value={user.user_id || user.id}
                    >
                      {user.name || user.email}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.label}>
                Prioridade
                <select
                  style={styles.input}
                  value={filters.priority}
                  onChange={(event) =>
                    setFilters({
                      ...filters,
                      priority: event.target.value,
                    })
                  }
                >
                  <option value="all">Todas as prioridades</option>
                  <option value="urgent">Urgente</option>
                  <option value="high">Alta</option>
                  <option value="normal">Normal</option>
                  <option value="low">Baixa</option>
                </select>
              </label>

              <label style={styles.label}>
                Situação dos documentos
                <select
                  style={styles.input}
                  value={filters.documentState}
                  onChange={(event) =>
                    setFilters({
                      ...filters,
                      documentState: event.target.value,
                    })
                  }
                >
                  <option value="all">Todos os documentos</option>
                  <option value="pending">Com pendências</option>
                  <option value="late">Com atraso</option>
                  <option value="approved">Todos aprovados</option>
                </select>
              </label>
            </div>

            <div style={styles.filterActions}>
              <span style={styles.resultCount}>
                {visibleItems.length} contratação(ões) encontrada(s)
              </span>

              <button
                style={styles.secondaryButton}
                onClick={clearFilters}
              >
                Limpar filtros
              </button>

              <button
                style={styles.primaryButton}
                onClick={loadHirings}
              >
                Atualizar dados
              </button>
            </div>
          </div>
        </div>

        {loading && <div style={styles.empty}>Carregando contratações...</div>}

        {!loading && visibleItems.length === 0 && (
          <div style={styles.empty}>Nenhuma contratação encontrada.</div>
        )}

        {!loading && visibleItems.length > 0 && (
          <div style={styles.boardScroll}>
            <div style={styles.board}>
              {boardColumns.map((column) => (
                <section
                  key={column.value}
                  style={styles.column}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    const item = items.find((hiring) => hiring.id === draggingId);
                    if (item) moveHiring(item, column.value);
                  }}
                >
                  <header style={styles.columnHeader}>
                    <div>
                      <strong style={styles.columnTitle}>{column.label}</strong>
                      <p style={styles.columnSubtitle}>
                        {column.items.length} processo(s)
                      </p>
                    </div>
                    <span style={styles.countBadge}>{column.items.length}</span>
                  </header>

                  <div style={styles.columnBody}>
                    {column.items.map((item) => {
                      const docs = documentsByHiring[item.id] || [];
                      const approved = docs.filter((doc) => doc.status === "approved").length;
                      const late = docs.filter((doc) => doc.isLate || doc.computedStatus === "expired").length;
                      const required = docs.filter((doc) => doc.required).length || docs.length;
                      const alert = contractAlert(item);

                      return (
                        <article
                          key={item.id}
                          draggable
                          onDragStart={() => setDraggingId(item.id)}
                          onDragEnd={() => setDraggingId(null)}
                          style={{
                            ...styles.kanbanCard,
                            opacity: draggingId === item.id ? 0.55 : 1,
                          }}
                        >
                          <button
                            type="button"
                            style={styles.cardMainButton}
                            onClick={() => openHiring(item)}
                          >
                            <div style={styles.cardTop}>
                              <div style={{ minWidth: 0 }}>
                                <strong style={styles.candidateName}>
                                  {getCandidateName(item)}
                                </strong>
                                <p style={styles.jobTitle}>{getJobTitle(item)}</p>
                              </div>

                              <span style={late > 0 ? styles.badgeDanger : styles.badge}>
                                {late > 0 ? `${late} atrasado(s)` : `${approved}/${required}`}
                              </span>
                            </div>

                            <div style={styles.infoGrid}>
                              <span><b>Empresa:</b> {item.company_name || item.company?.name || "-"}</span>
                              <span><b>Início:</b> {formatDate(getStartDate(item))}</span>
                              <span><b>Contrato:</b> {item.contract_type || item.contractType || "-"}</span>
                              <span><b>Responsável:</b> {item.assigned_user_name || item.assigned_to_name || "Sem responsável"}</span>
                            </div>

                            {alert && <div style={styles.warningBox}>⏰ {alert}</div>}
                          </button>

                          <div style={styles.cardActions}>
                            <button
                              style={styles.miniButton}
                              onClick={() => openHiring(item)}
                            >
                              Documentos
                            </button>

                            <button
                              style={styles.miniButton}
                              onClick={() => sendWhatsapp(item)}
                            >
                              WhatsApp
                            </button>

                            <select
                              aria-label="Definir responsável"
                              style={styles.cardSelect}
                              value={
                                item.assigned_to ||
                                item.assigned_user_id ||
                                ""
                              }
                              onChange={(event) =>
                                assignHiring(
                                  item,
                                  event.target.value || null
                                )
                              }
                            >
                              <option value="">Sem responsável</option>
                              {users.map((user) => (
                                <option
                                  key={user.id}
                                  value={user.user_id || user.id}
                                >
                                  {user.name || user.email}
                                </option>
                              ))}
                            </select>

                            <select
                              aria-label="Definir prioridade"
                              style={styles.cardSelect}
                              value={item.priority || "normal"}
                              onChange={(event) =>
                                changePriority(item, event.target.value)
                              }
                            >
                              <option value="urgent">Urgente</option>
                              <option value="high">Alta</option>
                              <option value="normal">Normal</option>
                              <option value="low">Baixa</option>
                            </select>

                            <select
                              aria-label="Alterar status"
                              style={styles.cardSelect}
                              value={item.status}
                              onChange={(event) =>
                                moveHiring(item, event.target.value)
                              }
                            >
                              {STATUS_OPTIONS.filter((status) => status.value !== "all").map((status) => (
                                <option key={status.value} value={status.value}>
                                  {status.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </article>
                      );
                    })}

                    {column.items.length === 0 && (
                      <div style={styles.columnEmpty}>
                        Arraste uma contratação para cá
                      </div>
                    )}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </section>

      {activeHiring && (
        <div style={styles.modalOverlay} onClick={() => setActiveHiring(null)}>
          <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div style={styles.headerRow}>
              <div>
                <p style={styles.kicker}>Processo de contratação</p>
                <h2 style={styles.sectionTitle}>{getCandidateName(activeHiring)}</h2>
                <p style={styles.smallText}>{getJobTitle(activeHiring)}</p>
              </div>

              <button style={styles.secondaryButton} onClick={() => setActiveHiring(null)}>
                Fechar
              </button>
            </div>

            <div style={styles.modalSummary}>
              <div><span>Empresa</span><strong>{activeHiring.company_name || activeHiring.company?.name || "-"}</strong></div>
              <div><span>Status</span><strong>{statusLabel(activeHiring.status)}</strong></div>
              <div><span>Início</span><strong>{formatDate(getStartDate(activeHiring))}</strong></div>
              <div><span>Fim</span><strong>{formatDate(getEndDate(activeHiring))}</strong></div>
            </div>

            <div style={styles.modalActions}>
              <button style={styles.successButton} onClick={() => updateHiring(activeHiring, { status: "hired" })}>
                Ativar contrato
              </button>
              <button style={styles.dangerButton} onClick={() => updateHiring(activeHiring, { status: "terminated" })}>
                Rescindir
              </button>
              <button style={styles.dangerGhostButton} onClick={() => deleteHiring(activeHiring)}>
                Excluir
              </button>
            </div>

            <section style={styles.contractSection}>
              <div style={styles.headerRow}>
                <div>
                  <h3 style={styles.subheading}>Dados contratuais</h3>
                  <p style={styles.smallText}>
                    Preencha apenas os dados que não existem no currículo.
                  </p>
                </div>

                <div style={styles.completionBox}>
                  <strong>{contractCompletion(contractData)}%</strong>
                  <span>completo</span>
                </div>
              </div>

              <div style={styles.progressTrack}>
                <div
                  style={{
                    ...styles.progressBar,
                    width: `${contractCompletion(contractData)}%`,
                  }}
                />
              </div>

              {loadingContractData ? (
                <div style={styles.empty}>Carregando dados contratuais...</div>
              ) : (
                <>
                  <div style={styles.formGrid}>
                    <label style={styles.label}>
                      Tipo de contratação
                      <select
                        style={styles.input}
                        value={contractData.hiring_type}
                        onChange={(event) =>
                          updateContractField("hiring_type", event.target.value)
                        }
                      >
                        <option value="">Selecione</option>
                        {CONTRACT_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </label>

                    {String(contractData.hiring_type || "")
                      .toLowerCase()
                      .includes("est") && (
                      <label style={styles.label}>
                        Tipo de estágio *
                        <select
                          style={styles.input}
                          value={contractData.internship_subtype}
                          onChange={(event) =>
                            updateContractField(
                              "internship_subtype",
                              event.target.value
                            )
                          }
                        >
                          <option value="">Selecione</option>
                          {INTERNSHIP_SUBTYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <ContractInput label="Nome da mãe *" field="mother_name" value={contractData.mother_name} onChange={updateContractField} />
                    <ContractInput label="Nome do pai" field="father_name" value={contractData.father_name} onChange={updateContractField} />
                    <ContractInput label="Estado civil *" field="marital_status" value={contractData.marital_status} onChange={updateContractField} />
                    <ContractInput label="Nacionalidade *" field="nationality" value={contractData.nationality} onChange={updateContractField} />
                    <ContractInput label="Naturalidade *" field="birth_city" value={contractData.birth_city} onChange={updateContractField} />
                    <ContractInput label="RG *" field="rg_number" value={contractData.rg_number} onChange={updateContractField} />
                    <ContractInput label="Órgão emissor *" field="rg_issuer" value={contractData.rg_issuer} onChange={updateContractField} />
                    <ContractInput label="Data de emissão do RG" field="rg_issue_date" type="date" value={contractData.rg_issue_date} onChange={updateContractField} />

                    <ContractInput label="Banco" field="bank_name" value={contractData.bank_name} onChange={updateContractField} />
                    <ContractInput label="Agência" field="bank_branch" value={contractData.bank_branch} onChange={updateContractField} />
                    <ContractInput label="Conta" field="bank_account" value={contractData.bank_account} onChange={updateContractField} />
                    <ContractInput label="Tipo de conta" field="bank_account_type" value={contractData.bank_account_type} onChange={updateContractField} />

                    {String(contractData.hiring_type || "")
                      .toLowerCase()
                      .includes("est") && (
                      <>
                        <ContractInput label="Instituição de ensino *" field="institution_name" value={contractData.institution_name} onChange={updateContractField} />
                        <ContractInput label="CNPJ da instituição" field="institution_cnpj" value={contractData.institution_cnpj} onChange={updateContractField} />
                        <ContractInput label="Curso *" field="course_name" value={contractData.course_name} onChange={updateContractField} />
                        <ContractInput label="Semestre" field="semester" value={contractData.semester} onChange={updateContractField} />
                        <ContractInput label="Matrícula *" field="enrollment_number" value={contractData.enrollment_number} onChange={updateContractField} />
                        <ContractInput label="Nível de ensino" field="education_level" value={contractData.education_level} onChange={updateContractField} />
                      </>
                    )}

                    <ContractInput label="Responsável legal" field="guardian_name" value={contractData.guardian_name} onChange={updateContractField} />
                    <ContractInput label="CPF do responsável" field="guardian_cpf" value={contractData.guardian_cpf} onChange={updateContractField} />
                    <ContractInput label="RG do responsável" field="guardian_rg" value={contractData.guardian_rg} onChange={updateContractField} />
                    <ContractInput label="Parentesco" field="guardian_relationship" value={contractData.guardian_relationship} onChange={updateContractField} />

                    <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
                      Observações contratuais
                      <textarea
                        style={{ ...styles.input, minHeight: 90 }}
                        value={contractData.notes}
                        onChange={(event) =>
                          updateContractField("notes", event.target.value)
                        }
                      />
                    </label>
                  </div>

                  <div style={styles.contractActions}>
                    <button
                      style={styles.primaryButton}
                      onClick={saveContractData}
                      disabled={savingContractData}
                    >
                      {savingContractData
                        ? "Salvando..."
                        : "Salvar dados contratuais"}
                    </button>

                    <button
                      style={
                        contractCompletion(contractData) === 100
                          ? styles.successButton
                          : styles.disabledButton
                      }
                      disabled={
                        contractCompletion(contractData) !== 100 ||
                        generatingContract
                      }
                      title={
                        contractCompletion(contractData) !== 100
                          ? "Complete os campos obrigatórios"
                          : "Gerar pré-visualização do contrato"
                      }
                      onClick={generateContractPreview}
                    >
                      {generatingContract
                        ? "Gerando..."
                        : "Gerar contrato"}
                    </button>
                  </div>
                </>
              )}
            </section>

            <h3 style={styles.subheading}>Checklist documental</h3>

            <div style={styles.docsGrid}>
              {(documentsByHiring[activeHiring.id] || []).map((doc) => (
                <article key={doc.id} style={styles.docCard}>
                  <div style={styles.cardTop}>
                    <div>
                      <strong>{doc.document_label}</strong>
                      <p style={styles.smallText}>{doc.required ? "Obrigatório" : "Opcional"}</p>
                    </div>

                    <span style={doc.computedStatus === "expired" ? styles.badgeDanger : doc.status === "approved" ? styles.badgeSuccess : styles.badge}>
                      {docStatusLabel(doc.computedStatus || doc.status)}
                    </span>
                  </div>

                  <div style={styles.infoGrid}>
                    <span><b>Prazo:</b> {formatDate(doc.due_date)}</span>
                    <span><b>Anexos:</b> {(doc.files || []).length || (doc.file_name ? 1 : 0)}</span>
                    {doc.rejection_reason && <span><b>Motivo:</b> {doc.rejection_reason}</span>}
                  </div>

                  {(doc.files || []).length > 0 && (
                    <div style={styles.fileList}>
                      {(doc.files || []).map((file: any) => (
                        <div key={file.id} style={styles.fileItem}>
                          <span>{file.file_name || "arquivo"}</span>
                          <div style={styles.cardActions}>
                            <a href={file.file_url} target="_blank" rel="noreferrer" style={styles.miniButton}>
                              Abrir
                            </a>
                            <button style={styles.dangerGhostButton} onClick={() => deleteDocumentFile(activeHiring.id, file.id)}>
                              Excluir
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!(doc.files || []).length && doc.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noreferrer" style={styles.secondaryButton}>
                      Abrir arquivo
                    </a>
                  )}

                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                    style={styles.input}
                    onChange={(event) =>
                      uploadDocument(activeHiring.id, doc, event.target.files)
                    }
                  />

                  <div style={styles.cardActions}>
                    <button style={styles.miniButton} onClick={() => setDueDate(activeHiring.id, doc)}>
                      Prazo
                    </button>
                    <button style={styles.successButton} onClick={() => updateDocument(activeHiring.id, doc, { status: "approved" })}>
                      Aprovar
                    </button>
                    <button
                      style={styles.dangerButton}
                      onClick={() => {
                        const reason = prompt("Motivo da reprovação", doc.rejection_reason || "");
                        updateDocument(activeHiring.id, doc, {
                          status: "rejected",
                          rejectionReason: reason || "Documento reprovado",
                        });
                      }}
                    >
                      Reprovar
                    </button>
                  </div>

                  {uploadingDocId === doc.id && (
                    <p style={styles.smallText}>Enviando documento...</p>
                  )}
                </article>
              ))}
            </div>
            <h3 style={styles.subheading}>
              Linha do tempo da contratação
            </h3>

            {loadingTimeline ? (
              <div style={styles.empty}>Carregando histórico...</div>
            ) : timeline.length === 0 ? (
              <div style={styles.empty}>
                Ainda não há eventos registrados.
              </div>
            ) : (
              <div style={styles.timeline}>
                {timeline.map((event) => (
                  <div key={event.id} style={styles.timelineItem}>
                    <span style={styles.timelineDot} />
                    <div>
                      <strong>{event.title}</strong>
                      {event.description && (
                        <p style={styles.smallText}>
                          {event.description}
                        </p>
                      )}
                      <p style={styles.smallText}>
                        {new Date(
                          event.created_at
                        ).toLocaleString("pt-BR")}
                        {event.actor_name
                          ? ` • ${event.actor_name}`
                          : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {metricDetails && (
        <div
          style={{ ...styles.modalOverlay, zIndex: 65 }}
          onClick={() => setMetricDetails(null)}
        >
          <div
            style={{ ...styles.modal, width: "min(1050px, 100%)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={styles.headerRow}>
              <div>
                <p style={styles.kicker}>Detalhamento operacional</p>
                <h2 style={styles.sectionTitle}>
                  {metricDetails.title}
                </h2>
                <p style={styles.smallText}>
                  {activeMetricRows.length} registro(s) encontrado(s)
                </p>
              </div>

              <button
                style={styles.secondaryButton}
                onClick={() => setMetricDetails(null)}
              >
                Fechar
              </button>
            </div>

            {activeMetricRows.length === 0 ? (
              <div style={styles.empty}>
                Nenhum registro encontrado.
              </div>
            ) : (
              <div style={styles.metricTableWrapper}>
                <table style={styles.metricTable}>
                  <thead>
                    <tr>
                      <th style={styles.metricTh}>Candidato</th>
                      <th style={styles.metricTh}>Empresa</th>
                      <th style={styles.metricTh}>Vaga</th>
                      {activeMetricRows.some((row) => row.document) && (
                        <>
                          <th style={styles.metricTh}>Documento</th>
                          <th style={styles.metricTh}>Prazo</th>
                          <th style={styles.metricTh}>Situação</th>
                        </>
                      )}
                      <th style={styles.metricTh}>Ação</th>
                    </tr>
                  </thead>

                  <tbody>
                    {activeMetricRows.map((row, index) => {
                      const hiring = row.hiring;

                      return (
                        <tr
                          key={`${hiring.id}-${row.document?.id || index}`}
                        >
                          <td style={styles.metricTd}>
                            {getCandidateName(hiring)}
                          </td>
                          <td style={styles.metricTd}>
                            {hiring.company_name ||
                              hiring.company?.name ||
                              hiring.client_name ||
                              "-"}
                          </td>
                          <td style={styles.metricTd}>
                            {getJobTitle(hiring)}
                          </td>

                          {activeMetricRows.some(
                            (item) => item.document
                          ) && (
                            <>
                              <td style={styles.metricTd}>
                                {row.document?.document_label || "-"}
                              </td>
                              <td style={styles.metricTd}>
                                {formatDate(row.document?.due_date)}
                              </td>
                              <td style={styles.metricTd}>
                                <span
                                  style={
                                    row.isLate
                                      ? styles.badgeDanger
                                      : styles.badge
                                  }
                                >
                                  {row.isLate
                                    ? "Atrasado"
                                    : docStatusLabel(
                                        row.document?.computedStatus ||
                                          row.document?.status
                                      )}
                                </span>
                              </td>
                            </>
                          )}

                          <td style={styles.metricTd}>
                            <button
                              style={styles.miniButton}
                              onClick={() => {
                                setMetricDetails(null);
                                openHiring(hiring);
                              }}
                            >
                              Abrir processo
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {contractPreview && (
        <div
          style={{ ...styles.modalOverlay, zIndex: 70 }}
          onClick={() => setContractPreview(null)}
        >
          <div
            style={{ ...styles.modal, width: "min(980px, 100%)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={styles.headerRow}>
              <div>
                <p style={styles.kicker}>Pré-visualização</p>
                <h2 style={styles.sectionTitle}>
                  {contractPreview.templateName}
                </h2>
                <p style={styles.smallText}>
                  Revise e edite o conteúdo antes de salvar.
                </p>
              </div>

              <button
                style={styles.secondaryButton}
                onClick={() => setContractPreview(null)}
              >
                Fechar
              </button>
            </div>

            {contractPreview.missingVariables?.length > 0 && (
              <div style={styles.warningBox}>
                Variáveis sem valor:{" "}
                {contractPreview.missingVariables.join(", ")}
              </div>
            )}

            <textarea
              style={styles.contractPreviewEditor}
              value={contractPreview.renderedText}
              onChange={(event) =>
                setContractPreview((current: any) => ({
                  ...current,
                  renderedText: event.target.value,
                }))
              }
            />

            <div style={styles.contractActions}>
              <button
                style={styles.primaryButton}
                onClick={saveContractVersion}
                disabled={savingContractVersion}
              >
                {savingContractVersion
                  ? "Salvando versão..."
                  : "Salvar versão"}
              </button>

              <button
                style={styles.secondaryButton}
                onClick={printContract}
              >
                Imprimir / Salvar PDF
              </button>

              <button
                style={styles.secondaryButton}
                onClick={downloadContractText}
              >
                Baixar texto
              </button>
            </div>

            <h3 style={styles.subheading}>Versões salvas</h3>

            {contractVersions.length === 0 ? (
              <div style={styles.empty}>
                Nenhuma versão salva ainda.
              </div>
            ) : (
              <div style={styles.versionList}>
                {contractVersions.map((version) => (
                  <div key={version.id} style={styles.versionItem}>
                    <div>
                      <strong>Versão {version.version}</strong>
                      <p style={styles.smallText}>
                        {new Date(version.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>

                    <button
                      style={styles.miniButton}
                      onClick={() =>
                        setContractPreview((current: any) => ({
                          ...current,
                          renderedText: version.rendered_text,
                          templateName: version.template_name,
                        }))
                      }
                    >
                      Abrir versão
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function ContractInput({
  label,
  field,
  value,
  type = "text",
  onChange,
}: {
  label: string;
  field: string;
  value: string;
  type?: string;
  onChange: (field: string, value: string) => void;
}) {
  return (
    <label style={styles.label}>
      {label}
      <input
        type={type}
        style={styles.input}
        value={value || ""}
        onChange={(event) => onChange(field, event.target.value)}
      />
    </label>
  );
}

function Metric({
  label,
  value,
  hint,
  onClick,
  tone = "default",
}: {
  label: string;
  value: any;
  hint?: string;
  onClick?: () => void;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  const toneStyle =
    tone === "danger"
      ? { borderColor: "#fecaca", background: "#fff7f7" }
      : tone === "warning"
        ? { borderColor: "#fde68a", background: "#fffdf2" }
        : tone === "success"
          ? { borderColor: "#bbf7d0", background: "#f7fff9" }
          : {};

  return (
    <button
      type="button"
      style={{ ...styles.metric, ...toneStyle }}
      onClick={onClick}
    >
      <span>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
      {hint && <small style={styles.metricHint}>{hint}</small>}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "clamp(12px, 2vw, 22px)",
    background: "linear-gradient(135deg, #eff6ff, #ffffff, #dbeafe)",
    color: "#0f172a",
    overflowX: "hidden",
  },
  hero: {
    background: "#fff",
    border: "1px solid #bfdbfe",
    borderRadius: 24,
    padding: "clamp(18px, 3vw, 26px)",
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    boxShadow: "0 18px 50px rgba(37,99,235,.08)",
  },
  heroActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  kicker: {
    margin: 0,
    color: "#2563eb",
    fontWeight: 900,
    letterSpacing: ".18em",
    fontSize: 11,
    textTransform: "uppercase",
  },
  title: {
    margin: "8px 0",
    fontSize: "clamp(28px, 5vw, 42px)",
    fontWeight: 950,
  },
  subtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: 14,
    maxWidth: 760,
  },
  primaryButton: {
    border: 0,
    borderRadius: 14,
    padding: "12px 16px",
    background: "linear-gradient(135deg, #38bdf8, #2563eb)",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(37,99,235,.20)",
  },
  secondaryButton: {
    border: "1px solid #bfdbfe",
    borderRadius: 14,
    padding: "11px 14px",
    background: "#fff",
    color: "#2563eb",
    fontWeight: 900,
    cursor: "pointer",
    textDecoration: "none",
    textAlign: "center",
  },
  statsGrid: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))",
    gap: 10,
  },
  alertStrip: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 8,
  },
  alertButton: {
    border: "1px solid #fde68a",
    background: "#fffbeb",
    color: "#92400e",
    borderRadius: 14,
    padding: 12,
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    cursor: "pointer",
    fontWeight: 800,
  },
  metric: {
    background: "#fff",
    border: "1px solid #bfdbfe",
    borderRadius: 18,
    padding: 14,
    display: "grid",
    gap: 6,
    textAlign: "left",
    color: "#0f172a",
    cursor: "pointer",
    minHeight: 96,
    transition: "transform .15s ease, box-shadow .15s ease",
  },
  metricValue: {
    fontSize: 24,
    lineHeight: 1,
  },
  metricHint: {
    color: "#2563eb",
    fontWeight: 800,
    fontSize: 10,
  },
  card: {
    marginTop: 16,
    background: "#fff",
    border: "1px solid #bfdbfe",
    borderRadius: 24,
    padding: "clamp(16px, 2vw, 22px)",
    boxShadow: "0 18px 50px rgba(37,99,235,.06)",
  },
  boardSection: {
    marginTop: 16,
    background: "#fff",
    border: "1px solid #bfdbfe",
    borderRadius: 24,
    padding: "clamp(14px, 2vw, 20px)",
    boxShadow: "0 18px 50px rgba(37,99,235,.06)",
  },
  boardToolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "end",
    gap: 14,
    flexWrap: "wrap",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "clamp(20px, 3vw, 25px)",
    fontWeight: 950,
  },
  subheading: {
    margin: "22px 0 10px",
    fontSize: 18,
    fontWeight: 950,
  },
  smallText: {
    margin: "4px 0",
    color: "#64748b",
    fontSize: 12,
  },
  formGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 12,
  },
  filters: {
    display: "grid",
    gap: 10,
  },
  filterPanel: {
    width: "100%",
    marginTop: 14,
    border: "1px solid #dbeafe",
    background: "#f8fafc",
    borderRadius: 18,
    padding: 14,
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  },
  filterActions: {
    marginTop: 12,
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  resultCount: {
    marginRight: "auto",
    color: "#475569",
    fontSize: 12,
    fontWeight: 800,
  },
  globalSearch: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 16,
    border: "2px solid #93c5fd",
    background: "#fff",
    padding: "14px 15px",
    outline: "none",
    fontSize: 14,
    color: "#0f172a",
    boxShadow: "0 8px 22px rgba(37,99,235,.08)",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 14,
    border: "1px solid #bfdbfe",
    background: "#f8fafc",
    padding: "12px 13px",
    outline: "none",
    fontSize: 14,
    color: "#0f172a",
  },
  label: {
    display: "grid",
    gap: 6,
    color: "#475569",
    fontSize: 12,
    fontWeight: 900,
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
  empty: {
    marginTop: 16,
    border: "1px dashed #93c5fd",
    borderRadius: 18,
    padding: 22,
    textAlign: "center",
    color: "#64748b",
  },
  boardScroll: {
    marginTop: 16,
    overflowX: "auto",
    paddingBottom: 8,
    WebkitOverflowScrolling: "touch",
  },
  board: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    minWidth: "max-content",
  },
  column: {
    width: "min(86vw, 310px)",
    minWidth: "min(86vw, 310px)",
    background: "#f1f5f9",
    border: "1px solid #dbeafe",
    borderRadius: 20,
    overflow: "hidden",
  },
  columnHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    padding: 14,
    background: "rgba(255,255,255,.82)",
    borderBottom: "1px solid #dbeafe",
  },
  columnTitle: {
    fontSize: 14,
    color: "#0f172a",
  },
  columnSubtitle: {
    margin: "3px 0 0",
    color: "#64748b",
    fontSize: 11,
  },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "#dbeafe",
    color: "#1d4ed8",
    fontWeight: 900,
    fontSize: 12,
  },
  columnBody: {
    minHeight: 160,
    maxHeight: "calc(100vh - 330px)",
    overflowY: "auto",
    padding: 10,
    display: "grid",
    alignContent: "start",
    gap: 10,
  },
  columnEmpty: {
    border: "1px dashed #cbd5e1",
    color: "#94a3b8",
    borderRadius: 14,
    padding: 18,
    textAlign: "center",
    fontSize: 12,
  },
  kanbanCard: {
    background: "#fff",
    border: "1px solid #dbeafe",
    borderRadius: 16,
    padding: 12,
    display: "grid",
    gap: 10,
    boxShadow: "0 8px 22px rgba(15,23,42,.06)",
    cursor: "grab",
    transition: "opacity .15s ease, transform .15s ease",
  },
  cardMainButton: {
    display: "grid",
    gap: 10,
    padding: 0,
    border: 0,
    background: "transparent",
    color: "inherit",
    textAlign: "left",
    cursor: "pointer",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
  },
  candidateName: {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  jobTitle: {
    margin: "4px 0 0",
    color: "#475569",
    fontSize: 12,
  },
  badge: {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 999,
    padding: "5px 8px",
    fontSize: 10,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  badgeSuccess: {
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#15803d",
    borderRadius: 999,
    padding: "5px 8px",
    fontSize: 10,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  badgeDanger: {
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#dc2626",
    borderRadius: 999,
    padding: "5px 8px",
    fontSize: 10,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  infoGrid: {
    display: "grid",
    gap: 5,
    color: "#475569",
    fontSize: 12,
  },
  warningBox: {
    border: "1px solid #fde68a",
    background: "#fffbeb",
    color: "#b45309",
    borderRadius: 11,
    padding: 8,
    fontSize: 11,
    fontWeight: 900,
  },
  cardActions: {
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
    alignItems: "center",
  },
  miniButton: {
    border: "1px solid #bfdbfe",
    borderRadius: 10,
    padding: "7px 9px",
    background: "#fff",
    color: "#2563eb",
    fontWeight: 900,
    cursor: "pointer",
    textDecoration: "none",
    fontSize: 11,
  },
  cardSelect: {
    width: "100%",
    border: "1px solid #bfdbfe",
    borderRadius: 10,
    padding: "8px 9px",
    background: "#f8fafc",
    color: "#0f172a",
    fontSize: 11,
    fontWeight: 800,
  },
  successButton: {
    border: 0,
    borderRadius: 12,
    padding: "9px 11px",
    background: "#16a34a",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  dangerButton: {
    border: 0,
    borderRadius: 12,
    padding: "9px 11px",
    background: "#ef4444",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  dangerGhostButton: {
    border: "1px solid #fecaca",
    borderRadius: 12,
    padding: "9px 11px",
    background: "#fff",
    color: "#dc2626",
    fontWeight: 900,
    cursor: "pointer",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,.55)",
    display: "grid",
    placeItems: "center",
    zIndex: 50,
    padding: 12,
  },
  modal: {
    width: "min(1100px, 100%)",
    maxHeight: "92vh",
    overflowY: "auto",
    background: "#fff",
    borderRadius: 24,
    border: "1px solid #bfdbfe",
    padding: "clamp(15px, 3vw, 24px)",
    boxShadow: "0 24px 70px rgba(15,23,42,.22)",
  },
  modalSummary: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
  },
  modalActions: {
    marginTop: 14,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  contractSection: {
    marginTop: 18,
    border: "1px solid #dbeafe",
    background: "#f8fafc",
    borderRadius: 20,
    padding: "clamp(14px, 2vw, 18px)",
  },
  completionBox: {
    minWidth: 78,
    display: "grid",
    textAlign: "center",
    color: "#1d4ed8",
  },
  progressTrack: {
    height: 9,
    borderRadius: 999,
    background: "#dbeafe",
    overflow: "hidden",
    margin: "12px 0 4px",
  },
  progressBar: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #38bdf8, #2563eb)",
    transition: "width .25s ease",
  },
  contractActions: {
    marginTop: 14,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  disabledButton: {
    border: 0,
    borderRadius: 12,
    padding: "9px 11px",
    background: "#cbd5e1",
    color: "#64748b",
    fontWeight: 900,
    cursor: "not-allowed",
  },
  contractPreviewEditor: {
    width: "100%",
    minHeight: "52vh",
    marginTop: 16,
    padding: 18,
    boxSizing: "border-box",
    border: "1px solid #bfdbfe",
    borderRadius: 16,
    background: "#f8fafc",
    color: "#0f172a",
    fontFamily: "Arial, Helvetica, sans-serif",
    lineHeight: 1.55,
    resize: "vertical",
  },
  versionList: {
    display: "grid",
    gap: 8,
  },
  versionItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    padding: 12,
    border: "1px solid #dbeafe",
    borderRadius: 14,
    background: "#f8fafc",
  },
  docsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))",
    gap: 12,
  },
  docCard: {
    border: "1px solid #dbeafe",
    background: "#f8fafc",
    borderRadius: 18,
    padding: 13,
    display: "grid",
    gap: 10,
  },
  metricTableWrapper: {
    marginTop: 16,
    overflowX: "auto",
    border: "1px solid #dbeafe",
    borderRadius: 16,
  },
  metricTable: {
    width: "100%",
    minWidth: 760,
    borderCollapse: "collapse",
    background: "#fff",
  },
  metricTh: {
    padding: 12,
    textAlign: "left",
    background: "#eff6ff",
    color: "#1e3a8a",
    fontSize: 11,
    borderBottom: "1px solid #dbeafe",
  },
  metricTd: {
    padding: 12,
    fontSize: 12,
    color: "#334155",
    borderBottom: "1px solid #e2e8f0",
    verticalAlign: "middle",
  },
  timeline: {
    display: "grid",
    gap: 0,
    marginTop: 10,
    paddingLeft: 18,
    borderLeft: "2px solid #dbeafe",
  },
  timelineItem: {
    position: "relative",
    padding: "0 0 18px 10px",
  },
  timelineDot: {
    position: "absolute",
    left: -25,
    top: 3,
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "#2563eb",
    border: "3px solid #dbeafe",
  },
  fileList: {
    display: "grid",
    gap: 8,
  },
  fileItem: {
    border: "1px solid #dbeafe",
    background: "#fff",
    borderRadius: 12,
    padding: 9,
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    fontSize: 12,
  },
};

