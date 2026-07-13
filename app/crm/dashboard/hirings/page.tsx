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

  const [activeHiring, setActiveHiring] = useState<any | null>(null);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    q: "",
    status: "all",
  });

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
      if (filters.q.trim()) params.set("q", filters.q.trim());
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

  useEffect(() => {
    loadHirings();
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
    };
  }, [items, documentsByHiring]);

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

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.kicker}>Zentra RH</p>
          <h1 style={styles.title}>Admissões e Contratos</h1>
          <p style={styles.subtitle}>
            Gestão de aprovados, documentos, prazos, contratos ativos, vencimentos, rescisões e finalizações.
          </p>
        </div>

        <button style={styles.primaryButton} onClick={loadHirings}>
          Atualizar
        </button>
      </section>

      <section style={styles.statsGrid}>
        <Metric label="Admissões" value={localStats.total} />
        <Metric label="Docs pendentes" value={localStats.pendingDocs} />
        <Metric label="Docs atrasados" value={localStats.lateDocs} />
        <Metric label="Contratos ativos" value={localStats.activeContracts} />
        <Metric label="Vencendo" value={localStats.endingContracts} />
        <Metric label="Salário médio" value={formatMoney(stats.averageSalary)} />
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Nova admissão manual</h2>
        <p style={styles.smallText}>
          O fluxo principal é automático pela entrevista aprovada. Use o manual apenas para exceções.
        </p>

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

          <label style={styles.label}>Início do contrato<input type="date" style={styles.input} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
          <label style={styles.label}>Fim do contrato<input type="date" style={styles.input} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>

          <select style={styles.input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {STATUS_OPTIONS.filter((s) => s.value !== "all").map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>

          <textarea style={{ ...styles.input, gridColumn: "1 / -1", minHeight: 90 }} placeholder="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>

        <button style={styles.primaryButton} onClick={createHiring} disabled={saving}>
          {saving ? "Salvando..." : "Salvar admissão"}
        </button>
      </section>

      <section style={styles.card}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.sectionTitle}>Aprovados e contratos</h2>
            <p style={styles.smallText}>Controle operacional de documentos, status de admissão e vencimento contratual.</p>
          </div>
        </div>

        <div style={styles.filters}>
          <input style={styles.input} placeholder="Buscar candidato, vaga, telefone..." value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          <select style={styles.input} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            {STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
          <button style={styles.secondaryButton} onClick={loadHirings}>Filtrar</button>
        </div>

        {loading && <p style={styles.smallText}>Carregando admissões...</p>}

        {!loading && items.length === 0 && (
          <div style={styles.empty}>Nenhuma admissão encontrada.</div>
        )}

        <div style={styles.cardsGrid}>
          {items.map((item) => {
            const docs = documentsByHiring[item.id] || [];
            const approved = docs.filter((doc) => doc.status === "approved").length;
            const late = docs.filter((doc) => doc.isLate || doc.computedStatus === "expired").length;
            const required = docs.filter((doc) => doc.required).length || docs.length;
            const alert = contractAlert(item);

            return (
              <article key={item.id} style={styles.hiringCard}>
                <div style={styles.cardTop}>
                  <div>
                    <strong>{getCandidateName(item)}</strong>
                    <p>{getJobTitle(item)}</p>
                  </div>

                  <span style={styles.badge}>{statusLabel(item.status)}</span>
                </div>

                <div style={styles.infoGrid}>
                  <span><b>Telefone:</b> {formatPhone(getCandidatePhone(item))}</span>
                  <span><b>E-mail:</b> {getCandidateEmail(item) || "-"}</span>
                  <span><b>Salário:</b> {formatMoney(getSalary(item))}</span>
                  <span><b>Início:</b> {formatDate(getStartDate(item))}</span>
                  <span><b>Fim contrato:</b> {formatDate(getEndDate(item))}</span>
                  <span><b>Documentos:</b> {approved}/{required} aprovados</span>
                </div>

                {late > 0 && (
                  <div style={styles.alertBox}>⚠ {late} documento(s) atrasado(s)</div>
                )}

                {alert && (
                  <div style={styles.warningBox}>⏰ {alert}</div>
                )}

                <div style={styles.actions}>
                  <button style={styles.secondaryButton} onClick={() => setActiveHiring(item)}>
                    Documentos
                  </button>

                  <button style={styles.secondaryButton} onClick={() => sendWhatsapp(item)}>
                    WhatsApp
                  </button>

                  <select style={styles.smallSelect} value={item.status} onChange={(e) => updateHiring(item, { status: e.target.value })}>
                    {STATUS_OPTIONS.filter((s) => s.value !== "all").map((status) => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>

                  <button style={styles.successButton} onClick={() => updateHiring(item, { status: "hired" })}>
                    Ativar
                  </button>

                  <button style={styles.dangerButton} onClick={() => updateHiring(item, { status: "terminated" })}>
                    Rescindir
                  </button>

                  <button style={styles.dangerGhostButton} onClick={() => deleteHiring(item)}>
                    Excluir
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {activeHiring && (
        <div style={styles.modalOverlay} onClick={() => setActiveHiring(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.headerRow}>
              <div>
                <p style={styles.kicker}>Checklist documental</p>
                <h2 style={styles.sectionTitle}>{getCandidateName(activeHiring)}</h2>
                <p style={styles.smallText}>{getJobTitle(activeHiring)}</p>
              </div>

              <button style={styles.secondaryButton} onClick={() => setActiveHiring(null)}>
                Fechar
              </button>
            </div>

            <div style={styles.docsGrid}>
              {(documentsByHiring[activeHiring.id] || []).map((doc) => (
                <article key={doc.id} style={styles.docCard}>
                  <div style={styles.cardTop}>
                    <div>
                      <strong>{doc.document_label}</strong>
                      <p>{doc.required ? "Obrigatório" : "Opcional"}</p>
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

                          <div style={styles.actions}>
                            <a href={file.file_url} target="_blank" rel="noreferrer" style={styles.secondaryButton}>
                              Abrir
                            </a>

                            <button
                              style={styles.dangerGhostButton}
                              onClick={() => deleteDocumentFile(activeHiring.id, file.id)}
                            >
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
                    onChange={(e) => uploadDocument(activeHiring.id, doc, e.target.files)}
                  />

                  <p style={styles.smallText}>
                    Você pode selecionar vários arquivos de uma vez.
                  </p>

                  <div style={styles.actions}>
                    <button style={styles.secondaryButton} onClick={() => setDueDate(activeHiring.id, doc)}>
                      Prazo
                    </button>

                    <button style={styles.successButton} onClick={() => updateDocument(activeHiring.id, doc, { status: "approved" })}>
                      Aprovar
                    </button>

                    <button
                      style={styles.dangerButton}
                      onClick={() => {
                        const reason = prompt("Motivo da reprovação", doc.rejection_reason || "");
                        updateDocument(activeHiring.id, doc, { status: "rejected", rejectionReason: reason || "Documento reprovado" });
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
          </div>
        </div>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div style={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", padding: 20, background: "linear-gradient(135deg, #eff6ff, #ffffff, #dbeafe)", color: "#0f172a" },
  hero: { background: "#fff", border: "1px solid #bfdbfe", borderRadius: 28, padding: 24, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", boxShadow: "0 18px 50px rgba(37,99,235,.08)" },
  kicker: { margin: 0, color: "#2563eb", fontWeight: 900, letterSpacing: ".22em", fontSize: 12, textTransform: "uppercase" },
  title: { margin: "8px 0", fontSize: 36, fontWeight: 950 },
  subtitle: { margin: 0, color: "#64748b", fontSize: 14, maxWidth: 760 },
  primaryButton: { border: 0, borderRadius: 16, padding: "13px 18px", background: "linear-gradient(135deg, #38bdf8, #2563eb)", color: "#fff", fontWeight: 900, cursor: "pointer", boxShadow: "0 12px 24px rgba(37,99,235,.20)" },
  statsGrid: { marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 },
  metric: { background: "#fff", border: "1px solid #bfdbfe", borderRadius: 20, padding: 16, display: "grid", gap: 8 },
  card: { marginTop: 18, background: "#fff", border: "1px solid #bfdbfe", borderRadius: 28, padding: 22, boxShadow: "0 18px 50px rgba(37,99,235,.06)" },
  sectionTitle: { margin: 0, fontSize: 22, fontWeight: 950 },
  smallText: { margin: "4px 0", color: "#64748b", fontSize: 12 },
  formGrid: { marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 },
  filters: { marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 },
  input: { width: "100%", boxSizing: "border-box", borderRadius: 16, border: "1px solid #bfdbfe", background: "#f8fafc", padding: "13px 14px", outline: "none", fontSize: 14, color: "#0f172a" },
  label: { display: "grid", gap: 6, color: "#475569", fontSize: 12, fontWeight: 900 },
  headerRow: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" },
  secondaryButton: { border: "1px solid #bfdbfe", borderRadius: 14, padding: "10px 12px", background: "#fff", color: "#2563eb", fontWeight: 900, cursor: "pointer", textDecoration: "none", textAlign: "center" },
  empty: { marginTop: 16, border: "1px dashed #93c5fd", borderRadius: 20, padding: 24, textAlign: "center", color: "#64748b" },
  cardsGrid: { marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 14 },
  hiringCard: { border: "1px solid #dbeafe", background: "#f8fafc", borderRadius: 22, padding: 16, display: "grid", gap: 12 },
  cardTop: { display: "flex", justifyContent: "space-between", gap: 12 },
  badge: { border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 999, padding: "6px 10px", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" },
  badgeSuccess: { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#15803d", borderRadius: 999, padding: "6px 10px", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" },
  badgeDanger: { border: "1px solid #fecaca", background: "#fff1f2", color: "#dc2626", borderRadius: 999, padding: "6px 10px", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" },
  infoGrid: { display: "grid", gap: 6, color: "#475569", fontSize: 13 },
  alertBox: { border: "1px solid #fecaca", background: "#fff1f2", color: "#dc2626", borderRadius: 14, padding: 10, fontSize: 13, fontWeight: 900 },
  warningBox: { border: "1px solid #fde68a", background: "#fffbeb", color: "#b45309", borderRadius: 14, padding: 10, fontSize: 13, fontWeight: 900 },
  actions: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  smallSelect: { border: "1px solid #bfdbfe", borderRadius: 14, padding: "10px 12px", background: "#fff", color: "#0f172a", fontWeight: 800 },
  successButton: { border: 0, borderRadius: 14, padding: "10px 12px", background: "#16a34a", color: "#fff", fontWeight: 900, cursor: "pointer" },
  dangerButton: { border: 0, borderRadius: 14, padding: "10px 12px", background: "#ef4444", color: "#fff", fontWeight: 900, cursor: "pointer" },
  dangerGhostButton: { border: "1px solid #fecaca", borderRadius: 14, padding: "10px 12px", background: "#fff", color: "#dc2626", fontWeight: 900, cursor: "pointer" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "grid", placeItems: "center", zIndex: 50, padding: 16 },
  modal: { width: "min(1100px, 100%)", maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: 28, border: "1px solid #bfdbfe", padding: 22, boxShadow: "0 24px 70px rgba(15,23,42,.22)" },
  docsGrid: { marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 },
  docCard: { border: "1px solid #dbeafe", background: "#f8fafc", borderRadius: 22, padding: 14, display: "grid", gap: 10 },
  fileList: { display: "grid", gap: 8 },
  fileItem: { border: "1px solid #dbeafe", background: "#fff", borderRadius: 14, padding: 10, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 },
};
