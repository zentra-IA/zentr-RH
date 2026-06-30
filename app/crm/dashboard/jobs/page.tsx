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

const emptyForm: JobForm = {
  title: "",
  department: "",
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
  open: "Aberta",
  paused: "Pausada",
  closed: "Fechada",
  archived: "Arquivada",
};

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

  useEffect(() => {
    loadJobs();
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

  const orderedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => {
      const order: Record<string, number> = {
        open: 1,
        draft: 2,
        paused: 3,
        closed: 4,
        archived: 5,
      };

      return (order[a.status] || 99) - (order[b.status] || 99);
    });
  }, [jobs]);

  function updateForm(key: keyof JobForm, value: string) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function editJob(job: Job) {
    setEditingId(job.id);

    setForm({
      title: job.title || "",
      department: job.department || "",
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
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao atualizar vaga.");
      return;
    }

    await loadJobs();
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

          {editingId && (
            <button style={styles.secondaryButton} onClick={cancelEdit}>
              Cancelar edição
            </button>
          )}
        </div>

        <div style={styles.formGrid}>
          <Input label="Título da vaga" value={form.title} onChange={(v) => updateForm("title", v)} placeholder="Ex: Auxiliar Administrativo" />
          <Input label="Departamento/cliente" value={form.department} onChange={(v) => updateForm("department", v)} placeholder="Ex: Multivar / RH" />

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
      </section>

      <section style={styles.card}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.sectionTitle}>Vagas cadastradas</h2>
            <p style={styles.smallText}>Use “Buscar candidatos” para gerar o lote vinculado à vaga.</p>
          </div>
        </div>

        {loading && <div style={styles.empty}>Carregando vagas...</div>}
        {!loading && !orderedJobs.length && <div style={styles.empty}>Nenhuma vaga cadastrada.</div>}

        <div style={styles.jobsGrid}>
          {orderedJobs.map((job) => (
            <article key={job.id} style={styles.jobCard}>
              <div style={styles.cardTop}>
                <div>
                  <strong style={styles.jobTitle}>{job.title}</strong>
                  <p style={styles.muted}>{job.department || "Sem departamento"}</p>
                </div>

                <span style={styles.badge}>{statusLabel[job.status] || job.status}</span>
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

              <div style={styles.actionRow}>
                <button style={styles.primaryButton} onClick={() => matchCandidates(job)} disabled={matchingJobId === job.id || job.status !== "open"}>
                  {matchingJobId === job.id ? "Buscando..." : "Buscar candidatos"}
                </button>

                <button style={styles.secondaryButton} onClick={() => editJob(job)}>
                  Editar
                </button>

                {job.status !== "paused" && (
                  <button style={styles.secondaryButton} onClick={() => changeStatus(job, "paused")}>
                    Pausar
                  </button>
                )}

                {job.status !== "closed" && (
                  <button style={styles.secondaryButton} onClick={() => changeStatus(job, "closed")}>
                    Fechar
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
  salary: {
    margin: 0,
    color: "#2563eb",
    fontWeight: 950,
  },
};
