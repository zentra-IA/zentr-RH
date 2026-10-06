"use client";

import { useEffect, useMemo, useState } from "react";

export type RhClientSummary = {
  id: string;
  name: string;
  companyName: string;
  cnpj?: string | null;
  responsibleName?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  cep?: string | null;
};

type Opening = {
  id: string;
  clientId: string;
  jobId?: string | null;
  status: string;
  contractType: ContractType;
  position: string;
  quantity: number;
  department?: string;
  createdAt?: string;
  signedFiles?: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt?: string;
  }>;
};

type ContractType =
  | "CLT"
  | "ESTAGIO_MEDIO_TECNICO"
  | "ESTAGIO_SUPERIOR";

type FormState = {
  contractType: ContractType;
  position: string;
  quantity: string;
  department: string;
  requestResponsible: string;
  directManager: string;
  workMode: string;
  workplaceAddress: string;
  workSchedule: string;
  breakTime: string;
  remuneration: string;
  transportBenefit: string;
  mealBenefit: string;
  lifeInsurance: boolean;
  otherBenefits: string;
  educationRequired: string;
  courses: string;
  requiredSkills: string;
  desiredSkills: string;
  softSkills: string;
  activities: string;
  slaFirstCandidates: string;
  slaInterviews: string;
  slaClosing: string;
  honorariumText: string;
  honorariumAmount: string;
  honorariumWords: string;
  paymentDays: string;
  suspensionDays: string;
  guaranteeDays: string;
  forumCity: string;
  forumState: string;
};

function initialForm(client: RhClientSummary): FormState {
  return {
    contractType: "CLT",
    position: "",
    quantity: "1",
    department: "",
    requestResponsible: client.responsibleName || "",
    directManager: "",
    workMode: "Presencial",
    workplaceAddress: [
      client.address,
      client.city,
      client.state,
      client.cep ? `CEP ${client.cep}` : null,
    ]
      .filter(Boolean)
      .join(", "),
    workSchedule: "",
    breakTime: "",
    remuneration: "",
    transportBenefit: "",
    mealBenefit: "",
    lifeInsurance: false,
    otherBenefits: "",
    educationRequired: "",
    courses: "",
    requiredSkills: "",
    desiredSkills: "",
    softSkills: "",
    activities: "",
    slaFirstCandidates: "05 dias úteis",
    slaInterviews: "07 dias úteis",
    slaClosing: "15 dias úteis",
    honorariumText: "",
    honorariumAmount: "",
    honorariumWords: "",
    paymentDays: "5",
    suspensionDays: "10",
    guaranteeDays: "45",
    forumCity: client.city || "",
    forumState: client.state || "",
  };
}

const STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Ficha em preenchimento", tone: "#64748b" },
  sheet_sent: { label: "Ficha enviada", tone: "#d97706" },
  approved: { label: "Ficha aprovada", tone: "#2563eb" },
  contract_generated: { label: "Contrato gerado", tone: "#7c3aed" },
  contract_sent: { label: "Contrato enviado", tone: "#c2410c" },
  signed: { label: "Contrato assinado", tone: "#15803d" },
};

export default function ClientOpeningFlow({
  client,
  onClose,
}: {
  client: RhClientSummary;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => initialForm(client));
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  useEffect(() => {
    setForm(initialForm(client));
    loadOpenings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  const isClt = form.contractType === "CLT";

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function loadOpenings() {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/rh/job-openings?clientId=${encodeURIComponent(client.id)}`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao carregar fichas.");
        return;
      }

      setOpenings(data.openings || []);
    } finally {
      setLoading(false);
    }
  }

  async function saveOpening(event: React.FormEvent) {
    event.preventDefault();

    if (!form.position.trim()) {
      alert("Informe o cargo/posição da vaga.");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/rh/job-openings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          ...form,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao criar ficha.");
        return;
      }

      setForm(initialForm(client));
      await loadOpenings();

      alert(
        "Ficha de abertura criada. Agora você pode gerar o PDF e enviar ao cliente."
      );
    } finally {
      setSaving(false);
    }
  }

  async function runAction(opening: Opening, action: string) {
    try {
      setBusyId(opening.id);

      const res = await fetch("/api/rh/job-openings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: opening.id,
          action,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Não foi possível concluir a ação.");
        return false;
      }

      await loadOpenings();
      return true;
    } finally {
      setBusyId(null);
    }
  }

  function openPdf(opening: Opening, type: "sheet" | "contract", download = false) {
    const params = new URLSearchParams({
      type,
      ...(download ? { download: "1" } : {}),
    });

    window.open(
      `/api/rh/job-openings/${opening.id}/pdf?${params.toString()}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function generateContract(opening: Opening) {
    const ok = await runAction(opening, "generate_contract");
    if (ok) openPdf(opening, "contract");
  }


  async function uploadSignedContract(
    opening: Opening,
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
      alert("Envie um arquivo PDF, JPG, PNG ou WEBP.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert("O contrato assinado deve ter no máximo 15 MB.");
      return;
    }

    try {
      setUploadingId(opening.id);

      const body = new FormData();
      body.append("file", file);

      const res = await fetch(
        `/api/rh/job-openings/${opening.id}/signed-contract`,
        {
          method: "POST",
          credentials: "include",
          body,
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao salvar contrato assinado.");
        return;
      }

      await loadOpenings();
      alert("Contrato assinado anexado e salvo no sistema.");
    } finally {
      setUploadingId(null);
    }
  }

  function openSignedContract(
    opening: Opening,
    fileId: string,
    download = false
  ) {
    const params = new URLSearchParams({
      fileId,
      ...(download ? { download: "1" } : {}),
    });

    window.open(
      `/api/rh/job-openings/${opening.id}/signed-contract?${params.toString()}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function deleteSignedContract(opening: Opening, fileId: string) {
    if (
      !confirm(
        "Remover este arquivo de contrato assinado? Essa ação remove o anexo salvo, mas não altera automaticamente o status da vaga."
      )
    ) {
      return;
    }

    const res = await fetch(
      `/api/rh/job-openings/${opening.id}/signed-contract?fileId=${encodeURIComponent(
        fileId
      )}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao remover contrato assinado.");
      return;
    }

    await loadOpenings();
  }

  function formatBytes(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const clientAddress = useMemo(
    () =>
      [client.address, client.city, client.state, client.cep]
        .filter(Boolean)
        .join(", "),
    [client]
  );

  return (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <div>
          <p style={styles.kicker}>Fluxo documental</p>
          <h2 style={styles.title}>Nova Ficha de Abertura de Vaga</h2>
          <p style={styles.subtitle}>
            Cliente: <b>{client.companyName || client.name}</b>
            {client.cnpj ? ` • CNPJ ${client.cnpj}` : ""}
          </p>
        </div>

        <button type="button" style={styles.secondaryButton} onClick={onClose}>
          Fechar
        </button>
      </div>

      <div style={styles.clientSnapshot}>
        <span><b>Responsável:</b> {client.responsibleName || "-"}</span>
        <span><b>E-mail:</b> {client.email || "-"}</span>
        <span><b>Telefone:</b> {client.whatsapp || client.phone || "-"}</span>
        <span><b>Endereço:</b> {clientAddress || "-"}</span>
      </div>

      <form onSubmit={saveOpening} style={styles.form}>
        <Section title="1. Dados do cliente e da vaga">
          <Select
            label="Tipo de contratação"
            value={form.contractType}
            onChange={(value) => {
              const contractType = value as ContractType;
              update("contractType", contractType);
              update(
                "guaranteeDays",
                contractType === "CLT" ? "45" : "30"
              );
              update(
                "lifeInsurance",
                contractType !== "CLT"
              );
            }}
            options={[
              ["CLT", "CLT"],
              ["ESTAGIO_MEDIO_TECNICO", "Estágio Ensino Médio / Técnico"],
              ["ESTAGIO_SUPERIOR", "Estágio Ensino Superior"],
            ]}
          />
          <Input label="Cargo / Posição" value={form.position} onChange={(v) => update("position", v)} placeholder="Ex: Auxiliar Administrativo" />
          <Input label="Quantidade de vagas" value={form.quantity} onChange={(v) => update("quantity", v)} type="number" />
          <Input label="Área / Departamento" value={form.department} onChange={(v) => update("department", v)} placeholder="Ex: Comercial" />
          <Input label="Responsável pela solicitação" value={form.requestResponsible} onChange={(v) => update("requestResponsible", v)} />
          <Input label="Gestor direto" value={form.directManager} onChange={(v) => update("directManager", v)} placeholder="Nome e cargo" />
        </Section>

        <Section title="2. Condições de trabalho e remuneração">
          <Select
            label="Modelo de trabalho"
            value={form.workMode}
            onChange={(v) => update("workMode", v)}
            options={[
              ["Presencial", "Presencial"],
              ["Híbrido", "Híbrido"],
              ["100% Remoto", "100% Remoto"],
            ]}
          />
          <Input label="Remuneração / Bolsa-Auxílio" value={form.remuneration} onChange={(v) => update("remuneration", v)} placeholder="Ex: 2500,00" />
          <Input label="Horário de trabalho" value={form.workSchedule} onChange={(v) => update("workSchedule", v)} placeholder="Ex: Seg a Sex, 09h às 18h" />
          <Input label="Intervalo" value={form.breakTime} onChange={(v) => update("breakTime", v)} placeholder="Ex: 1 hora" />
          <FieldWide label="Local de trabalho">
            <input style={styles.input} value={form.workplaceAddress} onChange={(e) => update("workplaceAddress", e.target.value)} />
          </FieldWide>
          <Input label="Auxílio-Transporte" value={form.transportBenefit} onChange={(v) => update("transportBenefit", v)} placeholder='Ex: Integral ou R$ 250,00' />
          <Input label="Vale-Refeição / Alimentação" value={form.mealBenefit} onChange={(v) => update("mealBenefit", v)} placeholder="Ex: R$ 35,00/dia" />
          <label style={styles.checkLabel}>
            <input
              type="checkbox"
              checked={form.lifeInsurance}
              onChange={(e) => update("lifeInsurance", e.target.checked)}
            />
            Seguro de Vida
            {!isClt && <small style={styles.hint}>Obrigatório para estágio conforme a ficha fornecida.</small>}
          </label>
          <Input label="Outros benefícios" value={form.otherBenefits} onChange={(v) => update("otherBenefits", v)} placeholder="Gympass, plano de saúde..." />
        </Section>

        <Section title="3. Perfil do candidato">
          <Input label="Escolaridade exigida" value={form.educationRequired} onChange={(v) => update("educationRequired", v)} />
          <Input label="Cursos / Formação" value={form.courses} onChange={(v) => update("courses", v)} />
          <FieldWide label="Hard Skills obrigatórias">
            <textarea style={styles.textarea} value={form.requiredSkills} onChange={(e) => update("requiredSkills", e.target.value)} />
          </FieldWide>
          <FieldWide label="Hard Skills desejáveis">
            <textarea style={styles.textarea} value={form.desiredSkills} onChange={(e) => update("desiredSkills", e.target.value)} />
          </FieldWide>
          <FieldWide label="Soft Skills">
            <textarea style={styles.textarea} value={form.softSkills} onChange={(e) => update("softSkills", e.target.value)} />
          </FieldWide>
        </Section>

        <Section title="4. Atividades e responsabilidades">
          <FieldWide label="Principais atividades — uma por linha, até 5">
            <textarea
              style={{ ...styles.textarea, minHeight: 130 }}
              value={form.activities}
              onChange={(e) => update("activities", e.target.value)}
              placeholder={"Atendimento inicial a clientes\nAtualização de planilhas\nElaboração de relatórios"}
            />
          </FieldWide>
        </Section>

        <Section title="5. SLA e prazos do processo">
          <Input label="Primeiros currículos" value={form.slaFirstCandidates} onChange={(v) => update("slaFirstCandidates", v)} />
          <Input label="Agendamento de entrevistas" value={form.slaInterviews} onChange={(v) => update("slaInterviews", v)} />
          <Input label="Fechamento da vaga" value={form.slaClosing} onChange={(v) => update("slaClosing", v)} />
        </Section>

        <Section title="Condições para preenchimento automático do contrato">
          {isClt ? (
            <FieldWide label="Honorários">
              <input
                style={styles.input}
                value={form.honorariumText}
                onChange={(e) => update("honorariumText", e.target.value)}
                placeholder="Ex: 100% do primeiro salário bruto CLT"
              />
            </FieldWide>
          ) : (
            <>
              <Input label="Valor dos honorários" value={form.honorariumAmount} onChange={(v) => update("honorariumAmount", v)} placeholder="Ex: 800,00" />
              <Input label="Valor por extenso" value={form.honorariumWords} onChange={(v) => update("honorariumWords", v)} placeholder="Ex: oitocentos reais" />
            </>
          )}
          <Input label="Prazo de pagamento (dias úteis)" value={form.paymentDays} onChange={(v) => update("paymentDays", v)} type="number" />
          <Input label="Suspensão por atraso (dias)" value={form.suspensionDays} onChange={(v) => update("suspensionDays", v)} type="number" />
          <Input label="Garantia / reposição (dias)" value={form.guaranteeDays} onChange={(v) => update("guaranteeDays", v)} type="number" />
          <Input label="Foro — Cidade" value={form.forumCity} onChange={(v) => update("forumCity", v)} />
          <Input label="Foro — UF" value={form.forumState} onChange={(v) => update("forumState", v)} />
        </Section>

        <div style={styles.submitRow}>
          <button disabled={saving} style={styles.primaryButton}>
            {saving ? "Salvando ficha..." : "Salvar Ficha de Abertura"}
          </button>
          <span style={styles.hint}>
            A vaga ainda não será liberada para recrutamento.
          </span>
        </div>
      </form>

      <div style={styles.divider} />

      <div style={styles.panelHeader}>
        <div>
          <h3 style={styles.subheading}>Fichas deste cliente</h3>
          <p style={styles.subtitle}>
            Cada solicitação possui ficha, contrato e status próprios.
          </p>
        </div>
        <button type="button" style={styles.secondaryButton} onClick={loadOpenings}>
          Atualizar
        </button>
      </div>

      {loading && <div style={styles.empty}>Carregando fichas...</div>}

      {!loading && openings.length === 0 && (
        <div style={styles.empty}>Nenhuma ficha criada para este cliente.</div>
      )}

      <div style={styles.openingList}>
        {openings.map((opening) => {
          const status = STATUS[opening.status] || {
            label: opening.status,
            tone: "#64748b",
          };
          const busy = busyId === opening.id;

          return (
            <article key={opening.id} style={styles.openingCard}>
              <div style={styles.openingTop}>
                <div>
                  <strong style={styles.openingTitle}>{opening.position}</strong>
                  <div style={styles.meta}>
                    {contractTypeLabel(opening.contractType)} • {opening.quantity} vaga(s)
                    {opening.department ? ` • ${opening.department}` : ""}
                  </div>
                </div>

                <span
                  style={{
                    ...styles.status,
                    color: status.tone,
                    borderColor: `${status.tone}55`,
                    background: `${status.tone}10`,
                  }}
                >
                  {status.label}
                </span>
              </div>

              <div style={styles.actions}>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => openPdf(opening, "sheet")}
                >
                  Ver ficha PDF
                </button>

                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => openPdf(opening, "sheet", true)}
                >
                  Baixar ficha
                </button>

                {opening.status === "draft" && (
                  <button
                    type="button"
                    disabled={busy}
                    style={styles.warnButton}
                    onClick={() => runAction(opening, "send_sheet")}
                  >
                    Marcar ficha enviada
                  </button>
                )}

                {["draft", "sheet_sent"].includes(opening.status) && (
                  <button
                    type="button"
                    disabled={busy}
                    style={styles.primaryButton}
                    onClick={() => runAction(opening, "approve_sheet")}
                  >
                    Aprovar ficha e criar vaga
                  </button>
                )}

                {["approved", "contract_generated", "contract_sent", "signed"].includes(
                  opening.status
                ) && (
                  <button
                    type="button"
                    disabled={busy}
                    style={styles.contractButton}
                    onClick={() => generateContract(opening)}
                  >
                    {opening.status === "approved"
                      ? "Gerar contrato"
                      : "Gerar nova via do contrato"}
                  </button>
                )}

                {["contract_generated", "contract_sent", "signed"].includes(
                  opening.status
                ) && (
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={() => openPdf(opening, "contract", true)}
                  >
                    Baixar contrato PDF
                  </button>
                )}

                {opening.status === "contract_generated" && (
                  <button
                    type="button"
                    disabled={busy}
                    style={styles.warnButton}
                    onClick={() => runAction(opening, "send_contract")}
                  >
                    Marcar contrato enviado
                  </button>
                )}

                {["contract_generated", "contract_sent"].includes(opening.status) && (
                  <button
                    type="button"
                    disabled={busy}
                    style={styles.successButton}
                    onClick={() => {
                      if (
                        confirm(
                          "Confirmar que o contrato foi assinado pelo cliente? A vaga será liberada para recrutamento."
                        )
                      ) {
                        runAction(opening, "mark_signed");
                      }
                    }}
                  >
                    Contrato assinado
                  </button>
                )}

                {opening.status === "signed" && (
                  <span style={styles.release}>
                    ✓ Vaga liberada para recrutamento
                  </span>
                )}
              </div>

              {["contract_generated", "contract_sent", "signed"].includes(
                opening.status
              ) && (
                <div style={styles.signedContractBox}>
                  <div style={styles.signedContractHeader}>
                    <div>
                      <strong style={styles.signedContractTitle}>
                        Gestão do contrato assinado
                      </strong>
                      <p style={styles.signedContractHint}>
                        Anexe o documento devolvido pelo cliente em PDF ou foto. Ele fica salvo no histórico desta vaga.
                      </p>
                    </div>

                    <label style={styles.uploadButton}>
                      {uploadingId === opening.id
                        ? "Enviando..."
                        : "Anexar contrato assinado"}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                        disabled={uploadingId === opening.id}
                        style={{ display: "none" }}
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          uploadSignedContract(opening, file);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>

                  {!opening.signedFiles?.length ? (
                    <div style={styles.noSignedFile}>
                      Nenhum contrato assinado anexado.
                    </div>
                  ) : (
                    <div style={styles.fileList}>
                      {opening.signedFiles.map((file) => (
                        <div key={file.id} style={styles.fileRow}>
                          <div style={styles.fileInfo}>
                            <span style={styles.fileIcon}>
                              {file.mimeType === "application/pdf" ? "PDF" : "IMG"}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <strong style={styles.fileName}>
                                {file.originalName}
                              </strong>
                              <div style={styles.fileMeta}>
                                {formatBytes(file.sizeBytes)}
                                {file.createdAt
                                  ? ` • ${new Date(file.createdAt).toLocaleString("pt-BR")}`
                                  : ""}
                              </div>
                            </div>
                          </div>

                          <div style={styles.fileActions}>
                            <button
                              type="button"
                              style={styles.secondaryButton}
                              onClick={() =>
                                openSignedContract(opening, file.id)
                              }
                            >
                              Visualizar
                            </button>

                            <button
                              type="button"
                              style={styles.secondaryButton}
                              onClick={() =>
                                openSignedContract(opening, file.id, true)
                              }
                            >
                              Baixar
                            </button>

                            <button
                              type="button"
                              style={styles.removeFileButton}
                              onClick={() =>
                                deleteSignedContract(opening, file.id)
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
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function contractTypeLabel(type: ContractType) {
  if (type === "CLT") return "CLT";
  if (type === "ESTAGIO_SUPERIOR") return "Estágio Superior";
  return "Estágio Médio / Técnico";
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset style={styles.section}>
      <legend style={styles.legend}>{title}</legend>
      <div style={styles.grid}>{children}</div>
    </fieldset>
  );
}

function Input({
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
        type={type}
        style={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function Select({
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
        onChange={(e) => onChange(e.target.value)}
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

function FieldWide({
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

const styles: Record<string, React.CSSProperties> = {
  panel: {
    marginTop: 18,
    background: "#ffffff",
    border: "1px solid #bfdbfe",
    borderRadius: 28,
    padding: 22,
    boxShadow: "0 18px 50px rgba(37,99,235,.08)",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  kicker: {
    margin: 0,
    fontSize: 11,
    fontWeight: 950,
    color: "#2563eb",
    textTransform: "uppercase",
    letterSpacing: ".16em",
  },
  title: {
    margin: "5px 0",
    fontSize: 24,
    fontWeight: 950,
  },
  subheading: {
    margin: 0,
    fontSize: 18,
    fontWeight: 950,
  },
  subtitle: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 12,
  },
  clientSnapshot: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 8,
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #dbeafe",
    color: "#475569",
    fontSize: 12,
  },
  form: {
    display: "grid",
    gap: 16,
    marginTop: 16,
  },
  section: {
    border: "1px solid #dbeafe",
    borderRadius: 20,
    padding: 16,
    margin: 0,
  },
  legend: {
    padding: "0 8px",
    color: "#1d4ed8",
    fontWeight: 950,
    fontSize: 13,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
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
    borderRadius: 14,
    border: "1px solid #bfdbfe",
    background: "#f8fafc",
    padding: "12px 13px",
    outline: "none",
    fontSize: 14,
    color: "#0f172a",
  },
  textarea: {
    width: "100%",
    minHeight: 88,
    boxSizing: "border-box",
    borderRadius: 14,
    border: "1px solid #bfdbfe",
    background: "#f8fafc",
    padding: "12px 13px",
    outline: "none",
    resize: "vertical",
    fontSize: 14,
    color: "#0f172a",
  },
  checkLabel: {
    display: "flex",
    gap: 9,
    alignItems: "center",
    minHeight: 44,
    fontSize: 12,
    fontWeight: 900,
    color: "#334155",
  },
  submitRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  primaryButton: {
    border: 0,
    borderRadius: 14,
    padding: "11px 14px",
    background: "linear-gradient(135deg,#38bdf8,#2563eb)",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #bfdbfe",
    borderRadius: 14,
    padding: "10px 13px",
    background: "#fff",
    color: "#2563eb",
    fontWeight: 950,
    cursor: "pointer",
  },
  warnButton: {
    border: "1px solid #fed7aa",
    borderRadius: 14,
    padding: "10px 13px",
    background: "#fff7ed",
    color: "#c2410c",
    fontWeight: 950,
    cursor: "pointer",
  },
  contractButton: {
    border: 0,
    borderRadius: 14,
    padding: "11px 14px",
    background: "#7c3aed",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
  },
  successButton: {
    border: 0,
    borderRadius: 14,
    padding: "11px 14px",
    background: "#15803d",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
  },
  hint: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 600,
  },
  divider: {
    height: 1,
    background: "#dbeafe",
    margin: "24px 0",
  },
  empty: {
    marginTop: 14,
    padding: 18,
    textAlign: "center",
    color: "#64748b",
    border: "1px dashed #93c5fd",
    borderRadius: 18,
    background: "#f8fafc",
  },
  openingList: {
    display: "grid",
    gap: 12,
    marginTop: 14,
  },
  openingCard: {
    border: "1px solid #dbeafe",
    borderRadius: 20,
    padding: 15,
    background: "#f8fafc",
  },
  openingTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  openingTitle: {
    fontSize: 16,
    fontWeight: 950,
    color: "#0f172a",
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  status: {
    border: "1px solid",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 950,
  },
  actions: {
    marginTop: 12,
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  signedContractBox: {
    marginTop: 14,
    border: "1px solid #c7d2fe",
    borderRadius: 16,
    padding: 13,
    background: "#ffffff",
  },
  signedContractHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  signedContractTitle: {
    color: "#0f172a",
    fontSize: 12.5,
    fontWeight: 950,
  },
  signedContractHint: {
    margin: "3px 0 0",
    color: "#64748b",
    fontSize: 10.5,
    lineHeight: 1.45,
    maxWidth: 620,
  },
  uploadButton: {
    border: 0,
    borderRadius: 12,
    padding: "10px 12px",
    background: "#0f766e",
    color: "#ffffff",
    fontWeight: 950,
    fontSize: 11,
    cursor: "pointer",
  },
  noSignedFile: {
    marginTop: 10,
    padding: 11,
    borderRadius: 12,
    border: "1px dashed #cbd5e1",
    color: "#94a3b8",
    background: "#f8fafc",
    fontSize: 10.5,
  },
  fileList: {
    display: "grid",
    gap: 8,
    marginTop: 10,
  },
  fileRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    padding: 10,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  fileInfo: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    minWidth: 0,
  },
  fileIcon: {
    minWidth: 38,
    height: 34,
    borderRadius: 9,
    display: "grid",
    placeItems: "center",
    background: "#e0e7ff",
    color: "#4338ca",
    fontSize: 9,
    fontWeight: 950,
  },
  fileName: {
    display: "block",
    maxWidth: 370,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#0f172a",
    fontSize: 11.5,
  },
  fileMeta: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 9.5,
  },
  fileActions: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  removeFileButton: {
    border: "1px solid #fecaca",
    borderRadius: 12,
    padding: "10px 12px",
    background: "#fff1f2",
    color: "#dc2626",
    fontWeight: 950,
    cursor: "pointer",
  },
  release: {
    color: "#15803d",
    fontSize: 12,
    fontWeight: 950,
  },
};
