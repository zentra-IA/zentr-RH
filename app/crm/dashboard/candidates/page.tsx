"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type Candidate = {
  id: string;
  name: string;
  cpf?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  neighborhood?: string | null;
  zipCode?: string | null;
  address?: string | null;
  education?: string | null;
  course?: string | null;
  courseStatus?: string | null;
  institution?: string | null;
  lastRole?: string | null;
  professionalSummary?: string | null;
  experiences?: {
    texto?: string | null;
    historico?: string | null;
    treinamentos?: string | null;
  } | null;
  skills?: string[];
  languages?: string[];
  resumeOrigin?: string | null;
  status?: string | null;
  aiSummary?: string | null;
  aiExtractedData?: any;
  rawImportData?: any;
  createdAt: string;
};

type Stats = {
  total: number;
  novo: number;
  triagem: number;
  entrevista: number;
  bancoTalentos: number;
};

type MatchContext = {
  jobId: string;
  jobTitle: string;
  totalCandidates: number;
  engine?: string;
  createdAt?: string;
  matches: any[];
};



const STATUS_OPTIONS = [
  { value: "novo", label: "Novo" },
  { value: "triagem", label: "Triagem" },
  { value: "entrevista", label: "Entrevista" },
  { value: "aprovado", label: "Aprovado" },
  { value: "banco_de_talentos", label: "Banco de talentos" },
  { value: "reprovado", label: "Reprovado" },
];

function statusLabel(status?: string | null) {
  return (
    STATUS_OPTIONS.find((item) => item.value === status)?.label ||
    status ||
    "Novo"
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

function getStatus(candidate: Candidate) {
  return candidate.status || candidate?.aiExtractedData?.status || "novo";
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    novo: 0,
    triagem: 0,
    entrevista: 0,
    bancoTalentos: 0,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [matchContext, setMatchContext] = useState<MatchContext | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  const [filters, setFilters] = useState({
    q: "",
    city: "",
    education: "",
    origin: "",
    status: "",
  });

  const [form, setForm] = useState({
    name: "",
    cpf: "",
    birthDate: "",
    phone: "",
    email: "",
    city: "",
    state: "",
    neighborhood: "",
    zipCode: "",
    education: "",
    course: "",
    courseStatus: "",
    lastRole: "",
    skills: "",
    languages: "",
    resumeOrigin: "manual",
    status: "novo",
    experience: "",
  });

  useEffect(() => {
    loadCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value.trim()) params.set(key, value.trim());
    });

    return params.toString();
  }, [filters]);

  async function loadCandidates(customQuery?: string) {
    try {
      setLoading(true);

      const qs = customQuery ?? queryString;
      const res = await fetch(`/api/rh/candidates${qs ? `?${qs}` : ""}`, {
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao carregar candidatos");
        return;
      }

      let loadedCandidates = data.candidates || [];

      const urlParams =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : new URLSearchParams();

      const matchIdsParam = urlParams.get("matchIds");

      // IMPORTANTE:
      // A tela de Banco de Candidatos NÃO pode ficar presa no último matching salvo.
      // Antes, qualquer localStorage "zentra_rh_last_job_match" filtrava a lista inteira
      // e escondia candidatos novos vindos do site.
      // Agora só aplicamos filtro de matching quando a URL pedir explicitamente via ?matchIds=...
      const storedMatch =
        typeof window !== "undefined" && matchIdsParam
          ? localStorage.getItem("zentra_rh_last_job_match")
          : null;

      if (!storedMatch) {
        setMatchContext(null);
      }

      if (storedMatch) {
        try {
          const parsedMatch = JSON.parse(storedMatch);

          const ids = matchIdsParam
            ? matchIdsParam.split(",").filter(Boolean)
            : (parsedMatch.matches || [])
                .map((item: any) => item?.candidate?.id)
                .filter(Boolean);

          if (ids.length) {
            const order = new Map(ids.map((id: string, index: number) => [id, index]));
            const matchById = new Map(
              (parsedMatch.matches || [])
                .filter((item: any) => item?.candidate?.id)
                .map((item: any) => [item.candidate.id, item])
            );

            loadedCandidates = loadedCandidates
              .filter((candidate: Candidate) => order.has(candidate.id))
              .sort(
                (a: Candidate, b: Candidate) =>
                  Number(order.get(a.id)) - Number(order.get(b.id))
              )
              .map((candidate: Candidate) => ({
                ...candidate,
                aiExtractedData: {
                  ...(candidate.aiExtractedData || {}),
                  match: matchById.get(candidate.id) || null,
                },
              }));

            setMatchContext(parsedMatch);
          }
        } catch {
          setMatchContext(null);
        }
      }

      setCandidates(loadedCandidates);
      setSelectedIds([]);
      setStats(
        data.stats || {
          total: 0,
          novo: 0,
          triagem: 0,
          entrevista: 0,
          bancoTalentos: 0,
        }
      );
    } finally {
      setLoading(false);
    }
  }
function shortText(value?: string | null, max = 90) {
    if (!value) return "-";
    const text = String(value).trim();
    if (!text) return "-";
    return text.length > max ? `${text.slice(0, max)}...` : text;
  }

  function getEducation(candidate: Candidate) {
    return (
      candidate.education ||
      candidate.course ||
      candidate?.aiExtractedData?.formacao ||
      candidate?.aiExtractedData?.formacaoOriginal ||
      "-"
    );
  }

  function getLastRole(candidate: Candidate) {
    return (
      candidate.lastRole ||
      candidate?.aiExtractedData?.cargoPrincipal ||
      candidate?.experiences?.texto ||
      candidate.professionalSummary ||
      "-"
    );
  }

  function getPhone(candidate: Candidate) {
    return candidate.phone || candidate?.aiExtractedData?.telefone || "-";
  }

  function getMobile(candidate: Candidate) {
    return candidate.mobile || candidate?.aiExtractedData?.celular || "-";
  }

  function getLocation(candidate: Candidate) {
    const parts = [
      candidate.city || candidate?.aiExtractedData?.cidade,
      candidate.state || candidate?.aiExtractedData?.estado,
    ].filter(Boolean);

    return parts.length ? parts.join(" / ") : "-";
  }

  function getMatch(candidate: Candidate) {
    return candidate?.aiExtractedData?.match || null;
  }

  function getMatchScore(candidate: Candidate) {
    const match = getMatch(candidate);
    return match?.score !== undefined ? `${match.score}%` : "-";
  }

  function getMatchReason(candidate: Candidate) {
    const match = getMatch(candidate);
    return match?.reason || candidate.aiSummary || "-";
  }

  function clearMatchFilter() {
    localStorage.removeItem("zentra_rh_last_job_match");
    setMatchContext(null);
    window.location.href = "/crm/dashboard/candidates";
  }

  function getExperience(candidate: Candidate) {
    return (
      candidate?.experiences?.texto ||
      candidate.professionalSummary ||
      candidate?.aiExtractedData?.experienciaTexto ||
      "-"
    );
  }

  function getLanguages(candidate: Candidate) {
    if (candidate.languages?.length) return candidate.languages.join(", ");
    return candidate?.aiExtractedData?.idiomasTexto || "-";
  }

  function getFullAddress(candidate: Candidate) {
    return [
      candidate.address,
      candidate.neighborhood,
      candidate.city || candidate?.aiExtractedData?.cidade,
      candidate.state || candidate?.aiExtractedData?.estado,
      candidate.zipCode,
    ]
      .filter(Boolean)
      .join(" • ") || "-";
  }

  async function copyText(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      alert(successMessage);
    } catch {
      alert("Não consegui copiar automaticamente.");
    }
  }

  function getCopyCandidates() {
    if (!selectedIds.length) return candidates;

    const selected = new Set(selectedIds);
    return candidates.filter((candidate) => selected.has(candidate.id));
  }

  function toggleCandidateSelection(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function toggleSelectAllVisible() {
    if (selectedIds.length === candidates.length) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(candidates.map((candidate) => candidate.id));
  }

  async function copyFilteredContacts(type: "phone" | "email") {
    const source = getCopyCandidates();

    const lines = source
      .map((candidate) => {
        if (type === "phone") {
          const phone = getMobile(candidate) !== "-" ? getMobile(candidate) : getPhone(candidate);
          return phone !== "-" ? `${candidate.name}, ${phone}` : null;
        }

        return candidate.email ? `${candidate.name}, ${candidate.email}` : null;
      })
      .filter(Boolean)
      .join("\n");

    if (!lines) {
      alert("Nenhum contato válido para copiar.");
      return;
    }

    await copyText(
      lines,
      type === "phone"
        ? `${source.length} contato(s) com telefone copiado(s).`
        : `${source.length} contato(s) com e-mail copiado(s).`
    );
  }
  async function createRecruitmentBatch(enqueue = false) {
    if (!matchContext?.jobId) {
      alert("Essa ação só funciona quando você veio do matching de uma vaga.");
      return;
    }

    const ids = selectedIds.length
      ? selectedIds
      : candidates.map((candidate) => candidate.id);

    if (!ids.length) {
      alert("Nenhum candidato selecionado.");
      return;
    }

    const actionText = enqueue
      ? "criar o lote e enviar para a fila do WhatsApp"
      : "criar o lote de recrutamento";

    if (!confirm(`${actionText} com ${ids.length} candidato(s)?`)) {
      return;
    }

    setBatchLoading(true);

    try {
      const res = await fetch("/api/rh/recruitment-batches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          jobId: matchContext.jobId,
          jobTitle: matchContext.jobTitle,
          candidateIds: ids,
          enqueue,
          intent: "RH_ABERTURA",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao criar lote da vaga.");
        return;
      }

      alert(
        enqueue
          ? `Lote criado e ${data.queued || 0} candidato(s) enviados para a fila do WhatsApp.`
          : `Lote criado com ${data.totalCandidates || ids.length} candidato(s).`
      );

      setSelectedIds([]);
      await loadCandidates();
    } finally {
      setBatchLoading(false);
    }
  }

  async function markSelectedForCurrentJob(status = "selected") {
    if (!matchContext?.jobId) {
      alert("Essa ação só funciona quando você veio do matching de uma vaga.");
      return;
    }

    const ids = selectedIds.length ? selectedIds : candidates.map((candidate) => candidate.id);

    if (!ids.length) {
      alert("Nenhum candidato selecionado.");
      return;
    }

    const label =
      status === "selected"
        ? "selecionado(s)"
        : status === "contacted"
          ? "contatado(s)"
          : "atualizado(s)";

    if (
      !confirm(
        `Marcar ${ids.length} candidato(s) como ${label} nesta vaga?\n\nEssa opção é manual e não cria lote automático.`
      )
    ) {
      return;
    }

    const res = await fetch("/api/rh/jobs/match", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jobId: matchContext.jobId,
        candidateIds: ids,
        status,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao atualizar candidatos da vaga.");
      return;
    }

    alert(`${data.updated || ids.length} candidato(s) marcado(s) na vaga.`);
  }

  async function applyFilters() {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value.trim()) params.set(key, value.trim());
    });

    await loadCandidates(params.toString());
  }

  async function createCandidate() {
    if (!form.name.trim()) {
      alert("Informe o nome do candidato.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/rh/candidates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao salvar candidato");
        return;
      }

      setForm({
        name: "",
        cpf: "",
        birthDate: "",
        phone: "",
        email: "",
        city: "",
        state: "",
        neighborhood: "",
        zipCode: "",
        education: "",
        course: "",
        courseStatus: "",
        lastRole: "",
        skills: "",
        languages: "",
        resumeOrigin: "manual",
        status: "novo",
        experience: "",
      });

      await loadCandidates();
    } finally {
      setSaving(false);
    }
  }

  async function importCandidates() {
    if (!file) {
      alert("Selecione uma planilha primeiro.");
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
      });

      if (!rows.length) {
        alert("A planilha está vazia.");
        return;
      }

      const res = await fetch("/api/rh/candidates/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rows }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao importar candidatos");
        return;
      }

      setImportResult(data);
      alert(`Importação concluída: ${data.created || 0} candidatos criados.`);
      setFile(null);
      await loadCandidates();
    } catch (error) {
      console.error("ERRO IMPORTAÇÃO:", error);
      alert("Erro ao ler/importar a planilha.");
    } finally {
      setImporting(false);
    }
  }

  async function updateStatus(candidate: Candidate, status: string) {
    const res = await fetch("/api/rh/candidates", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: candidate.id,
        status,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao atualizar candidato");
      return;
    }

    await loadCandidates();
  }


  async function analyzeCandidate(candidate: Candidate) {
    try {
      const res = await fetch("/api/rh/candidates/ai-analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidateId: candidate.id,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao analisar candidato com IA");
        return;
      }

      alert(`IA analisou ${candidate.name} com sucesso.`);
      await loadCandidates();
    } catch (error) {
      console.error(error);
      alert("Erro ao executar IA.");
    }
  }

  async function removeCandidate(candidate: Candidate) {
    if (!confirm(`Remover ${candidate.name}?`)) return;

    const res = await fetch(`/api/rh/candidates?id=${candidate.id}`, {
      method: "DELETE",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao remover candidato");
      return;
    }

    await loadCandidates();
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.kicker}>Zentra RH</p>
          <h1 style={styles.title}>Candidatos</h1>
          <p style={styles.subtitle}>
            Cadastre candidatos manualmente ou importe currículos por Excel/CSV.
          </p>
        </div>

        <button style={styles.primaryButton} onClick={() => loadCandidates()}>
          Atualizar
        </button>
      </section>

      <section style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span>Total</span>
          <strong>{stats.total}</strong>
        </div>
        <div style={styles.statCard}>
          <span>Novo</span>
          <strong>{stats.novo}</strong>
        </div>
        <div style={styles.statCard}>
          <span>Triagem</span>
          <strong>{stats.triagem}</strong>
        </div>
        <div style={styles.statCard}>
          <span>Entrevista</span>
          <strong>{stats.entrevista}</strong>
        </div>
        <div style={styles.statCard}>
          <span>Banco de talentos</span>
          <strong>{stats.bancoTalentos}</strong>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Importar candidatos</h2>
        <p style={styles.smallText}>
          Aceita .xlsx, .xls e .csv exportados do PandaPé, InfoJobs ou sistemas similares.
        </p>

        <div style={styles.importBox}>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            style={styles.fileInput}
            onChange={(event) => {
              const selectedFile = event.target.files?.[0] || null;
              setFile(selectedFile);
              setImportResult(null);
            }}
          />

          <button
            type="button"
            style={styles.primaryButton}
            disabled={importing}
            onClick={importCandidates}
          >
            {importing ? "Importando..." : "Importar planilha"}
          </button>
        </div>

        <p style={styles.smallText}>
          {file ? `Arquivo selecionado: ${file.name}` : "Nenhum arquivo selecionado."}
        </p>

        {importResult && (
          <div style={styles.resultBox}>
            <strong>Importação finalizada</strong>
            <p>
              Total: {importResult.totalRows || 0} • Criados:{" "}
              {importResult.created || 0} • Atualizados:{" "}
              {importResult.updated || 0} • Ignorados:{" "}
              {importResult.ignored || 0}
            </p>
          </div>
        )}
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Novo candidato</h2>

        <div style={styles.formGrid}>
          <label style={styles.label}>
            Nome completo
            <input
              style={styles.input}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Ex: Maria Silva"
            />
          </label>

          <label style={styles.label}>
            CPF
            <input
              style={styles.input}
              value={form.cpf}
              onChange={(event) => setForm({ ...form, cpf: event.target.value })}
              placeholder="Somente números"
            />
          </label>

          <label style={styles.label}>
            Data de nascimento
            <input
              type="date"
              style={styles.input}
              value={form.birthDate}
              onChange={(event) =>
                setForm({ ...form, birthDate: event.target.value })
              }
            />
          </label>

          <label style={styles.label}>
            Telefone / WhatsApp
            <input
              style={styles.input}
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder="Ex: 11999999999"
            />
          </label>

          <label style={styles.label}>
            E-mail
            <input
              style={styles.input}
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="email@dominio.com"
            />
          </label>

          <label style={styles.label}>
            Cidade
            <input
              style={styles.input}
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
              placeholder="São Paulo"
            />
          </label>

          <label style={styles.label}>
            Estado
            <input
              style={styles.input}
              value={form.state}
              onChange={(event) => setForm({ ...form, state: event.target.value })}
              placeholder="SP"
            />
          </label>

          <label style={styles.label}>
            Bairro
            <input
              style={styles.input}
              value={form.neighborhood}
              onChange={(event) =>
                setForm({ ...form, neighborhood: event.target.value })
              }
              placeholder="Ex: Tatuapé"
            />
          </label>

          <label style={styles.label}>
            CEP
            <input
              style={styles.input}
              value={form.zipCode}
              onChange={(event) => setForm({ ...form, zipCode: event.target.value })}
              placeholder="Ex: 03000-000"
            />
          </label>

          <label style={styles.label}>
            Escolaridade
            <input
              style={styles.input}
              value={form.education}
              onChange={(event) =>
                setForm({ ...form, education: event.target.value })
              }
              placeholder="Ex: Ensino médio completo"
            />
          </label>

          <label style={styles.label}>
            Curso
            <input
              style={styles.input}
              value={form.course}
              onChange={(event) => setForm({ ...form, course: event.target.value })}
              placeholder="Ex: Administração"
            />
          </label>

          <label style={styles.label}>
            Status do curso
            <input
              style={styles.input}
              value={form.courseStatus}
              onChange={(event) =>
                setForm({ ...form, courseStatus: event.target.value })
              }
              placeholder="Ex: Cursando / Concluído"
            />
          </label>

          <label style={styles.label}>
            Último cargo
            <input
              style={styles.input}
              value={form.lastRole}
              onChange={(event) =>
                setForm({ ...form, lastRole: event.target.value })
              }
              placeholder="Ex: Auxiliar administrativo"
            />
          </label>

          <label style={styles.label}>
            Origem
            <input
              style={styles.input}
              value={form.resumeOrigin}
              onChange={(event) =>
                setForm({ ...form, resumeOrigin: event.target.value })
              }
              placeholder="Ex: PandaPé, InfoJobs, Manual"
            />
          </label>

          <label style={styles.label}>
            Status
            <select
              style={styles.input}
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Habilidades
            <input
              style={styles.input}
              value={form.skills}
              onChange={(event) => setForm({ ...form, skills: event.target.value })}
              placeholder="Separe por vírgula"
            />
          </label>

          <label style={styles.label}>
            Idiomas
            <input
              style={styles.input}
              value={form.languages}
              onChange={(event) =>
                setForm({ ...form, languages: event.target.value })
              }
              placeholder="Ex: Inglês, Espanhol"
            />
          </label>

          <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
            Experiência profissional
            <textarea
              style={{ ...styles.input, minHeight: 90 }}
              value={form.experience}
              onChange={(event) =>
                setForm({ ...form, experience: event.target.value })
              }
              placeholder="Resumo das experiências profissionais do candidato."
            />
          </label>
        </div>

        <button
          style={styles.primaryButton}
          disabled={saving}
          onClick={createCandidate}
        >
          {saving ? "Salvando..." : "Salvar candidato"}
        </button>
      </section>

      {matchContext && (
        <section style={styles.matchBanner}>
          <div>
            <strong>Resultado da IA para a vaga: {matchContext.jobTitle}</strong>
            <p style={styles.smallText}>
              Mostrando candidatos com no mínimo{" "}
              {(matchContext as any).minScore || 60}% de aderência. Analisados:{" "}
              {matchContext.totalCandidates}. Exibidos: {candidates.length}. Já ocultos desta vaga:{" "}
              {(matchContext as any).excludedRecentlySelected || 0}. Selecionados manualmente:{" "}
              {selectedIds.length || "nenhum"}.
            </p>
          </div>

          <div style={styles.bannerActions}>
            <button
              style={styles.secondaryButton}
              onClick={toggleSelectAllVisible}
            >
              {selectedIds.length === candidates.length ? "Desmarcar todos" : "Selecionar todos"}
            </button>

            <button
              style={styles.secondaryButton}
              onClick={() => copyFilteredContacts("phone")}
            >
              Copiar telefones
            </button>

            <button
              style={styles.secondaryButton}
              onClick={() => copyFilteredContacts("email")}
            >
              Copiar e-mails
            </button>

            <button
              style={styles.primaryButton}
              type="button"
              disabled={batchLoading}
              onClick={() => createRecruitmentBatch(false)}
            >
              {batchLoading ? "Criando..." : "Criar lote da vaga"}
            </button>

            <button
              style={styles.successButton || styles.primaryButton}
              type="button"
              disabled={batchLoading}
              onClick={() => createRecruitmentBatch(true)}
            >
              Enviar WhatsApp do lote
            </button>

            <button
              style={styles.secondaryButton}
              type="button"
              onClick={() => markSelectedForCurrentJob("selected")}
            >
              Marcar manualmente
            </button>

            <button style={styles.dangerButton} onClick={clearMatchFilter}>
              Limpar filtro IA
            </button>
          </div>
        </section>
      )}

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Banco de candidatos</h2>
            <p style={styles.smallText}>
              Visual em lista para trabalhar rápido, estilo planilha.
            </p>
          </div>

          <div style={styles.actionsRow}>
            <button
              style={styles.secondaryButton}
              type="button"
              onClick={toggleSelectAllVisible}
            >
              {selectedIds.length === candidates.length ? "Desmarcar todos" : "Selecionar todos"}
            </button>

            <button
              style={styles.secondaryButton}
              type="button"
              onClick={() => copyFilteredContacts("phone")}
            >
              Copiar contatos
            </button>

            <button
              style={styles.secondaryButton}
              type="button"
              onClick={() => copyFilteredContacts("email")}
            >
              Copiar e-mails
            </button>
          </div>
        </div>

        <div style={styles.filtersGrid}>
          <input
            style={styles.input}
            value={filters.q}
            onChange={(event) => setFilters({ ...filters, q: event.target.value })}
            placeholder="Buscar nome, CPF, e-mail, telefone..."
          />

          <input
            style={styles.input}
            value={filters.city}
            onChange={(event) => setFilters({ ...filters, city: event.target.value })}
            placeholder="Cidade"
          />

          <input
            style={styles.input}
            value={filters.education}
            onChange={(event) =>
              setFilters({ ...filters, education: event.target.value })
            }
            placeholder="Escolaridade"
          />

          <input
            style={styles.input}
            value={filters.origin}
            onChange={(event) =>
              setFilters({ ...filters, origin: event.target.value })
            }
            placeholder="Origem"
          />

          <select
            style={styles.input}
            value={filters.status}
            onChange={(event) => setFilters({ ...filters, status: event.target.value })}
          >
            <option value="">Todos os status</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>

          <button style={styles.secondaryButton} onClick={applyFilters}>
            Filtrar
          </button>
        </div>

        {loading && <p style={styles.smallText}>Carregando candidatos...</p>}

        {!loading && candidates.length === 0 && (
          <div style={styles.emptyBox}>Nenhum candidato encontrado.</div>
        )}

        {!loading && candidates.length > 0 && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>
                    <input
                      type="checkbox"
                      checked={candidates.length > 0 && selectedIds.length === candidates.length}
                      onChange={toggleSelectAllVisible}
                    />
                  </th>
                  <th style={styles.th}>Nome</th>
                  <th style={styles.th}>Score IA</th>
                  <th style={styles.th}>Telefone</th>
<th style={styles.th}>Celular</th>
<th style={styles.th}>E-mail</th>
<th style={styles.th}>Cidade / UF</th>
<th style={styles.th}>Idade</th>
<th style={styles.th}>Escolaridade</th>
<th style={styles.th}>Cargo</th>
                  <th style={styles.th}>Origem</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Cadastro</th>
                  <th style={styles.th}>Ações</th>
                </tr>
              </thead>

              <tbody>
                {candidates.map((candidate) => {
                  const currentStatus = getStatus(candidate);

                  return (
                    <tr key={candidate.id}>
                      <td style={styles.td}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(candidate.id)}
                          onChange={() => toggleCandidateSelection(candidate.id)}
                        />
                      </td>

                      <td style={styles.td}>
                        <strong>{candidate.name}</strong>
                        <br />
                        <span style={styles.miniText}>{candidate.cpf || "-"}</span>
                      </td>

                      <td style={styles.td} title={getMatchReason(candidate)}>
                        <strong>{getMatchScore(candidate)}</strong>
                        <br />
                        <span style={styles.miniText}>{shortText(getMatchReason(candidate), 70)}</span>
                      </td>

                      <td style={styles.td}>
  {getPhone(candidate)}
</td>

<td style={styles.td}>
  {getMobile(candidate)}
</td>

<td style={styles.td}>
  {candidate.email || "-"}
</td>

<td style={styles.td}>
  {getLocation(candidate)}
</td>

<td style={styles.td}>{candidate?.aiExtractedData?.idade || candidate?.aiExtractedData?.age || "-"}</td>

<td style={styles.td} title={getEducation(candidate)}>
  {shortText(getEducation(candidate), 70)}
</td>

<td style={styles.td} title={getLastRole(candidate)}>
  {shortText(getLastRole(candidate), 70)}
</td>
                      <td style={styles.td}>{candidate.resumeOrigin || "Manual"}</td>

                      <td style={styles.td}>
                        <select
                          style={styles.smallSelect}
                          value={currentStatus}
                          onChange={(event) =>
                            updateStatus(candidate, event.target.value)
                          }
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td style={styles.td}>{formatDate(candidate.createdAt)}</td>

                      <td style={styles.td}>
                        <div style={styles.actionsRow}>
                          <button
                            style={styles.secondarySmallButton}
                            type="button"
                            onClick={() => setSelectedCandidate(candidate)}
                          >
                            Ver perfil
                          </button>

                          <button
                            style={styles.aiButton}
                            type="button"
                            onClick={() => analyzeCandidate(candidate)}
                          >
                            Analisar IA
                          </button>

                          <button
                            style={styles.dangerButton}
                            type="button"
                            onClick={() => removeCandidate(candidate)}
                          >
                            Remover
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedCandidate && (
        <div style={styles.modalBackdrop} onClick={() => setSelectedCandidate(null)}>
          <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <p style={styles.kicker}>Perfil do candidato</p>
                <h2 style={styles.sectionTitle}>{selectedCandidate.name}</h2>
                <p style={styles.smallText}>
                  {getLocation(selectedCandidate)} • {selectedCandidate.resumeOrigin || "Manual"}
                </p>
              </div>

              <button
                style={styles.secondarySmallButton}
                type="button"
                onClick={() => setSelectedCandidate(null)}
              >
                Fechar
              </button>
            </div>

            <div style={styles.profileGrid}>
              <div style={styles.profileItem}>
                <strong>CPF</strong>
                <span>{selectedCandidate.cpf || "-"}</span>
              </div>

              <div style={styles.profileItem}>
                <strong>Nascimento</strong>
                <span>{formatDate(selectedCandidate.birthDate)}</span>
              </div>

              <div style={styles.profileItem}>
                <strong>Sexo</strong>
                <span>{selectedCandidate.gender || "-"}</span>
              </div>

              <div style={styles.profileItem}>
                <strong>Telefone</strong>
                <span>{getPhone(selectedCandidate)}</span>
              </div>

              <div style={styles.profileItem}>
                <strong>Celular</strong>
                <span>{getMobile(selectedCandidate)}</span>
              </div>

              <div style={styles.profileItem}>
                <strong>E-mail</strong>
                <span>{selectedCandidate.email || "-"}</span>
              </div>

              <div style={styles.profileItemWide}>
                <strong>Endereço</strong>
                <span>{getFullAddress(selectedCandidate)}</span>
              </div>

              <div style={styles.profileItemWide}>
                <strong>Formação / Curso</strong>
                <span>{getEducation(selectedCandidate)}</span>
              </div>

              <div style={styles.profileItemWide}>
                <strong>Cargo / Experiência resumida</strong>
                <span>{getLastRole(selectedCandidate)}</span>
              </div>

              <div style={styles.profileItemWide}>
                <strong>Idiomas</strong>
                <span>{getLanguages(selectedCandidate)}</span>
              </div>

              <div style={styles.profileItemWide}>
                <strong>Experiência profissional</strong>
                <span>{getExperience(selectedCandidate)}</span>
              </div>

              <div style={styles.profileItemWide}>
                <strong>Histórico de candidatura</strong>
                <span>{selectedCandidate?.experiences?.historico || "-"}</span>
              </div>

              <div style={styles.profileItemWide}>
                <strong>Resumo IA</strong>
                <span>{selectedCandidate.aiSummary || "-"}</span>
              </div>
            </div>

            <div style={styles.actionsRow}>
              <button
                style={styles.primaryButton}
                type="button"
                onClick={() => {
                  const phone =
                    getMobile(selectedCandidate) !== "-"
                      ? getMobile(selectedCandidate)
                      : getPhone(selectedCandidate);

                  copyText(
                    `${selectedCandidate.name}, ${phone}`,
                    "Contato copiado."
                  );
                }}
              >
                Copiar nome + telefone
              </button>

              <button
                style={styles.secondaryButton}
                type="button"
                onClick={() =>
                  copyText(
                    `${selectedCandidate.name}, ${selectedCandidate.email || ""}`,
                    "Nome + e-mail copiado."
                  )
                }
              >
                Copiar nome + e-mail
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
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
    background: "#ffffff",
    border: "1px solid #bfdbfe",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 18px 50px rgba(37,99,235,.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  kicker: {
    margin: 0,
    color: "#2563eb",
    fontWeight: 900,
    letterSpacing: ".22em",
    fontSize: 12,
    textTransform: "uppercase",
  },
  title: {
    margin: "8px 0",
    fontSize: 36,
    fontWeight: 900,
  },
  subtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.5,
  },
  statsGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
  },
  statCard: {
    background: "#ffffff",
    border: "1px solid #bfdbfe",
    borderRadius: 20,
    padding: 18,
    display: "grid",
    gap: 8,
  },
  matchBanner: {
    marginTop: 18,
    background: "#ecfeff",
    border: "1px solid #67e8f9",
    borderRadius: 22,
    padding: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  bannerActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  card: {
    marginTop: 18,
    background: "#ffffff",
    border: "1px solid #bfdbfe",
    borderRadius: 28,
    padding: 22,
    boxShadow: "0 18px 50px rgba(37,99,235,.06)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 900,
  },
  smallText: {
    margin: "4px 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.5,
  },
  miniText: {
    color: "#64748b",
    fontSize: 11,
  },
  importBox: {
    marginTop: 14,
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
  fileInput: {
    border: "1px dashed #93c5fd",
    borderRadius: 16,
    padding: 14,
    background: "#f8fafc",
    flex: 1,
    minWidth: 240,
  },
  resultBox: {
    marginTop: 14,
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    borderRadius: 16,
    padding: 14,
    color: "#166534",
    fontSize: 13,
  },
  formGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  filtersGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  label: {
    display: "grid",
    gap: 6,
    color: "#334155",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: ".06em",
    textTransform: "uppercase",
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
  successButton: { border: 0, borderRadius: 14, padding: "12px 16px", background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", fontWeight: 900, cursor: "pointer" },
  primaryButton: {
    border: 0,
    borderRadius: 16,
    padding: "13px 18px",
    background: "linear-gradient(135deg, #38bdf8, #2563eb)",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(37,99,235,.20)",
  },
  secondaryButton: {
    border: "1px solid #bfdbfe",
    borderRadius: 16,
    padding: "13px 18px",
    background: "#ffffff",
    color: "#2563eb",
    fontWeight: 900,
    cursor: "pointer",
  },
  aiButton: {
    border: 0,
    borderRadius: 12,
    padding: "9px 12px",
    background: "linear-gradient(135deg, #7c3aed, #2563eb)",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },
  dangerButton: {
    border: 0,
    borderRadius: 12,
    padding: "9px 12px",
    background: "#ef4444",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },
  emptyBox: {
    marginTop: 16,
    border: "1px dashed #93c5fd",
    borderRadius: 20,
    padding: 24,
    textAlign: "center",
    color: "#64748b",
  },
  tableWrap: {
    marginTop: 16,
    overflowX: "auto",
    border: "1px solid #dbeafe",
    borderRadius: 18,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  minWidth: 1450,
    background: "#ffffff",
  },
  th: {
    background: "#eff6ff",
    color: "#1e3a8a",
    padding: "12px",
    textAlign: "left",
    borderBottom: "1px solid #bfdbfe",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 13,
    verticalAlign: "top",
  },
  smallSelect: {
    border: "1px solid #bfdbfe",
    borderRadius: 12,
    padding: "8px 10px",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 800,
  },
  secondarySmallButton: {
    border: "1px solid #bfdbfe",
    borderRadius: 12,
    padding: "9px 12px",
    background: "#ffffff",
    color: "#2563eb",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  actionsRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, .55)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
    zIndex: 50,
  },
  modal: {
    width: "min(980px, 100%)",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: 24,
    border: "1px solid #bfdbfe",
    padding: 22,
    boxShadow: "0 25px 70px rgba(15, 23, 42, .25)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    borderBottom: "1px solid #dbeafe",
    paddingBottom: 14,
    marginBottom: 16,
  },
  profileGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  profileItem: {
    border: "1px solid #dbeafe",
    borderRadius: 16,
    padding: 14,
    background: "#f8fafc",
    display: "grid",
    gap: 6,
    fontSize: 13,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  profileItemWide: {
    gridColumn: "1 / -1",
    border: "1px solid #dbeafe",
    borderRadius: 16,
    padding: 14,
    background: "#f8fafc",
    display: "grid",
    gap: 6,
    fontSize: 13,
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
};
