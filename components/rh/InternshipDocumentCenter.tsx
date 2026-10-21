"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  hiring: any;
};

type RaPeriod = {
  number: number;
  start: string;
  end: string;
  label: string;
};

function isInternship(value: any) {
  return String(value || "")
    .toLocaleLowerCase("pt-BR")
    .includes("est");
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const raw = String(value).slice(0, 10);
  const [y, m, d] = raw.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function fieldMissing(value: any) {
  return !String(value ?? "").trim();
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  value: any;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label style={styles.label}>
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <input
        type={type}
        style={{
          ...styles.input,
          ...(required && fieldMissing(value) ? styles.missingInput : {}),
        }}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export default function InternshipDocumentCenter({ hiring }: Props) {
  const contractType =
    hiring?.contract_type || hiring?.contractType || hiring?.job?.contract_type;

  const enabled = isInternship(contractType);

  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [raPeriods, setRaPeriods] = useState<RaPeriod[]>([]);
  const [generatedDocs, setGeneratedDocs] = useState<any[]>([]);

  useEffect(() => {
    if (!enabled || !hiring?.id) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, hiring?.id]);

  const requiredMissing = useMemo(() => {
    const fields: Array<[string, any]> = [
      ["Nome do estagiário", data.candidate_name || hiring?.candidate_name],
      ["CPF", data.candidate_cpf],
      ["Empresa concedente", data.company_name],
      ["CNPJ da empresa", data.company_cnpj],
      ["Instituição de ensino", data.institution_name],
      ["Curso / série", data.course_name || data.school_year],
      ["Data de início", data.internship_start],
      ["Data final", data.internship_end],
      ["Jornada", data.work_schedule],
      ["Atividades", data.activities],
    ];

    if (
      String(data.internship_subtype || "").toLowerCase() !==
      "higher_education"
    ) {
      fields.push(["Responsável legal", data.guardian_name]);
      fields.push(["CPF do responsável", data.guardian_cpf]);
    }

    return fields.filter(([, value]) => fieldMissing(value)).map(([label]) => label);
  }, [data, hiring]);

  function update(field: string, value: any) {
    setData((current: any) => ({
      ...current,
      [field]: value,
    }));
  }

  async function load() {
    try {
      setLoading(true);

      const [dataRes, docsRes] = await Promise.all([
        fetch(
          `/api/rh/hirings/contract-data?hiringId=${encodeURIComponent(hiring.id)}`,
          {
            cache: "no-store",
            credentials: "include",
          }
        ),
        fetch(
          `/api/rh/hirings/internship-documents?hiringId=${encodeURIComponent(hiring.id)}`,
          {
            cache: "no-store",
            credentials: "include",
          }
        ),
      ]);

      const dataPayload = await dataRes.json().catch(() => ({}));
      const docsPayload = await docsRes.json().catch(() => ({}));

      if (!dataRes.ok) {
        alert(dataPayload.error || "Erro ao carregar dados do estágio.");
        return;
      }

      setData(dataPayload.contractData || {});

      if (docsRes.ok) {
        setRaPeriods(docsPayload.raPeriods || []);
        setGeneratedDocs(docsPayload.generated || []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function save(showMessage = true) {
    try {
      setSaving(true);

      const res = await fetch("/api/rh/hirings/contract-data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          hiringId: hiring.id,
          contractData: {
            ...data,
            completion_percent: requiredMissing.length ? 80 : 100,
          },
        }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(payload.error || "Erro ao salvar dados do estágio.");
        return false;
      }

      setData(payload.contractData || data);

      if (showMessage) {
        alert("Dados do estágio salvos.");
      }

      return true;
    } finally {
      setSaving(false);
    }
  }

  async function generate(documentType: string, reportNumber?: number) {
    try {
      setGenerating(
        documentType === "ra" ? `ra-${reportNumber}` : documentType
      );

      const saved = await save(false);
      if (!saved) return;

      const res = await fetch("/api/rh/hirings/internship-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          hiringId: hiring.id,
          documentType,
          reportNumber,
        }),
      });

      if (!res.ok) {
        const message = await res.text();
        alert(message || "Erro ao gerar documento.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      const docsRes = await fetch(
        `/api/rh/hirings/internship-documents?hiringId=${encodeURIComponent(hiring.id)}`,
        {
          cache: "no-store",
          credentials: "include",
        }
      );
      const docsPayload = await docsRes.json().catch(() => ({}));

      if (docsRes.ok) {
        setRaPeriods(docsPayload.raPeriods || []);
        setGeneratedDocs(docsPayload.generated || []);
      }
    } finally {
      setGenerating(null);
    }
  }

  if (!enabled) return null;

  if (loading) {
    return (
      <section style={styles.card}>
        <div style={styles.loading}>Carregando Central de Documentos de Estágio...</div>
      </section>
    );
  }

  const lastGenerated = (type: string, reportNumber?: number) =>
    generatedDocs.find(
      (item) =>
        item.document_type === type &&
        (type !== "ra" || Number(item.report_number) === Number(reportNumber))
    );

  return (
    <section style={styles.card}>
      <div style={styles.header}>
        <div>
          <p style={styles.kicker}>Gestão de estágio</p>
          <h3 style={styles.title}>Central de Documentos</h3>
          <p style={styles.subtitle}>
            O sistema reaproveita candidato, vaga e empresa. Abra a conferência
            somente quando precisar corrigir ou completar alguma informação.
          </p>
        </div>

        <div
          style={{
            ...styles.health,
            ...(requiredMissing.length ? styles.healthWarning : styles.healthOk),
          }}
        >
          {requiredMissing.length
            ? `${requiredMissing.length} dado(s) para conferir`
            : "Dados principais prontos"}
        </div>
      </div>

      <div style={styles.quickSummary}>
        <span>
          <b>Período:</b> {formatDate(data.internship_start)} até{" "}
          {formatDate(data.internship_end)}
        </span>
        <span>
          <b>Instituição:</b> {data.institution_name || "Não informada"}
        </span>
        <span>
          <b>Curso:</b> {data.course_name || data.school_year || "Não informado"}
        </span>
      </div>

      {requiredMissing.length > 0 && (
        <div style={styles.warning}>
          <b>Conferir:</b> {requiredMissing.join(", ")}.
        </div>
      )}

      <details style={styles.details}>
        <summary style={styles.summaryButton}>Conferir / editar dados do estágio</summary>

        <div style={styles.sectionTitle}>Estagiário e curso</div>
        <div style={styles.grid}>
          <Input
            label="Nome completo"
            required
            value={data.candidate_name}
            onChange={(v) => update("candidate_name", v)}
          />
          <Input
            label="CPF"
            required
            value={data.candidate_cpf}
            onChange={(v) => update("candidate_cpf", v)}
          />
          <Input
            label="RG"
            value={data.rg_number}
            onChange={(v) => update("rg_number", v)}
          />
          <Input
            label="Data de nascimento"
            type="date"
            value={data.candidate_birth_date}
            onChange={(v) => update("candidate_birth_date", v)}
          />
          <Input
            label="E-mail"
            value={data.candidate_email}
            onChange={(v) => update("candidate_email", v)}
          />
          <Input
            label="Celular"
            value={data.candidate_phone}
            onChange={(v) => update("candidate_phone", v)}
          />
          <Input
            label="Complemento do endereço"
            value={data.candidate_complement}
            onChange={(v) => update("candidate_complement", v)}
          />
          <Input
            label="Curso"
            required
            value={data.course_name}
            onChange={(v) => update("course_name", v)}
          />
          <Input
            label="Série / semestre"
            value={data.semester || data.school_year}
            onChange={(v) => {
              update("semester", v);
              update("school_year", v);
            }}
          />
          <Input
            label="RA / matrícula"
            value={data.enrollment_number}
            onChange={(v) => update("enrollment_number", v)}
          />
          <Input
            label="Período / horário escolar"
            value={data.study_period}
            onChange={(v) => update("study_period", v)}
          />
          <Input
            label="Nível de ensino"
            value={data.education_level}
            onChange={(v) => update("education_level", v)}
          />
        </div>

        <div style={styles.sectionTitle}>Empresa concedente</div>
        <div style={styles.grid}>
          <Input
            label="Razão social"
            required
            value={data.company_name}
            onChange={(v) => update("company_name", v)}
          />
          <Input
            label="CNPJ"
            required
            value={data.company_cnpj}
            onChange={(v) => update("company_cnpj", v)}
          />
          <Input
            label="Endereço"
            value={data.company_address}
            onChange={(v) => update("company_address", v)}
          />
          <Input
            label="Complemento"
            value={data.company_complement}
            onChange={(v) => update("company_complement", v)}
          />
          <Input
            label="Bairro"
            value={data.company_neighborhood}
            onChange={(v) => update("company_neighborhood", v)}
          />
          <Input
            label="Cidade"
            value={data.company_city}
            onChange={(v) => update("company_city", v)}
          />
          <Input
            label="Estado"
            value={data.company_state}
            onChange={(v) => update("company_state", v)}
          />
          <Input
            label="CEP"
            value={data.company_zip}
            onChange={(v) => update("company_zip", v)}
          />
          <Input
            label="Telefone"
            value={data.company_phone}
            onChange={(v) => update("company_phone", v)}
          />
          <Input
            label="E-mail"
            value={data.company_email}
            onChange={(v) => update("company_email", v)}
          />
          <Input
            label="Representante"
            value={data.company_representative}
            onChange={(v) => update("company_representative", v)}
          />
          <Input
            label="Cargo do representante"
            value={data.company_representative_role}
            onChange={(v) => update("company_representative_role", v)}
          />
        </div>

        <div style={styles.sectionTitle}>Instituição de ensino</div>
        <div style={styles.grid}>
          <Input
            label="Instituição"
            required
            value={data.institution_name}
            onChange={(v) => update("institution_name", v)}
          />
          <Input
            label="CNPJ"
            value={data.institution_cnpj}
            onChange={(v) => update("institution_cnpj", v)}
          />
          <Input
            label="Endereço"
            value={data.institution_address}
            onChange={(v) => update("institution_address", v)}
          />
          <Input
            label="Complemento"
            value={data.institution_complement}
            onChange={(v) => update("institution_complement", v)}
          />
          <Input
            label="Bairro"
            value={data.institution_neighborhood}
            onChange={(v) => update("institution_neighborhood", v)}
          />
          <Input
            label="Cidade"
            value={data.institution_city}
            onChange={(v) => update("institution_city", v)}
          />
          <Input
            label="Estado"
            value={data.institution_state}
            onChange={(v) => update("institution_state", v)}
          />
          <Input
            label="CEP"
            value={data.institution_zip}
            onChange={(v) => update("institution_zip", v)}
          />
          <Input
            label="Telefone"
            value={data.institution_phone}
            onChange={(v) => update("institution_phone", v)}
          />
          <Input
            label="Representante"
            value={data.institution_representative}
            onChange={(v) => update("institution_representative", v)}
          />
          <Input
            label="Cargo do representante"
            value={data.institution_representative_role}
            onChange={(v) => update("institution_representative_role", v)}
          />
        </div>

        <div style={styles.sectionTitle}>Dados do estágio</div>
        <div style={styles.grid}>
          <Input
            label="Número do TCE"
            value={data.contract_number}
            onChange={(v) => update("contract_number", v)}
          />
          <Input
            label="Início"
            required
            type="date"
            value={data.internship_start}
            onChange={(v) => update("internship_start", v)}
          />
          <Input
            label="Fim"
            required
            type="date"
            value={data.internship_end}
            onChange={(v) => update("internship_end", v)}
          />
          <Input
            label="Jornada"
            required
            value={data.work_schedule}
            onChange={(v) => update("work_schedule", v)}
            placeholder="Segunda a sexta, 08h00 às 14h00"
          />
          <Input
            label="Intervalo"
            value={data.break_time}
            onChange={(v) => update("break_time", v)}
            placeholder="20 minutos"
          />
          <Input
            label="Horas semanais"
            value={data.weekly_hours}
            onChange={(v) => update("weekly_hours", v)}
          />
          <Input
            label="Bolsa"
            value={data.scholarship_amount}
            onChange={(v) => update("scholarship_amount", v)}
          />
          <Input
            label="Ajuda de custo"
            value={data.cost_allowance}
            onChange={(v) => update("cost_allowance", v)}
          />
          <Input
            label="Auxílio transporte"
            value={data.transport_benefit}
            onChange={(v) => update("transport_benefit", v)}
          />
        </div>

        <label style={styles.labelWide}>
          Atividades *
          <textarea
            style={{
              ...styles.textarea,
              ...(fieldMissing(data.activities) ? styles.missingInput : {}),
            }}
            value={data.activities || ""}
            onChange={(e) => update("activities", e.target.value)}
            placeholder="Uma atividade por linha"
          />
        </label>

        <div style={styles.sectionTitle}>Supervisor</div>
        <div style={styles.grid}>
          <Input
            label="Nome"
            value={data.supervisor_name}
            onChange={(v) => update("supervisor_name", v)}
          />
          <Input
            label="Cargo"
            value={data.supervisor_role}
            onChange={(v) => update("supervisor_role", v)}
          />
          <Input
            label="Formação"
            value={data.supervisor_education}
            onChange={(v) => update("supervisor_education", v)}
          />
          <Input
            label="E-mail"
            value={data.supervisor_email}
            onChange={(v) => update("supervisor_email", v)}
          />
        </div>

        <div style={styles.sectionTitle}>Responsável legal</div>
        <div style={styles.grid}>
          <Input
            label="Nome"
            value={data.guardian_name}
            onChange={(v) => update("guardian_name", v)}
          />
          <Input
            label="CPF"
            value={data.guardian_cpf}
            onChange={(v) => update("guardian_cpf", v)}
          />
          <Input
            label="RG"
            value={data.guardian_rg}
            onChange={(v) => update("guardian_rg", v)}
          />
          <Input
            label="Celular"
            value={data.guardian_phone}
            onChange={(v) => update("guardian_phone", v)}
          />
          <Input
            label="Parentesco"
            value={data.guardian_relationship}
            onChange={(v) => update("guardian_relationship", v)}
          />
        </div>

        <div style={styles.sectionTitle}>RA e prorrogação</div>
        <div style={styles.grid}>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={Boolean(data.high_school_final_year)}
              onChange={(e) => update("high_school_final_year", e.target.checked)}
            />
            3º ano do Ensino Médio
          </label>

          <Input
            label="Ano de conclusão"
            value={data.graduation_year}
            onChange={(v) => update("graduation_year", v)}
            placeholder="Ex: 2027"
          />
          <Input
            label="Início da prorrogação"
            type="date"
            value={data.extension_start}
            onChange={(v) => update("extension_start", v)}
          />
          <Input
            label="Fim da prorrogação"
            type="date"
            value={data.extension_end}
            onChange={(v) => update("extension_end", v)}
          />
        </div>

        <div style={styles.sectionTitle}>Distrato e seguro</div>
        <div style={styles.grid}>
          <Input
            label="Data do distrato"
            type="date"
            value={data.termination_date}
            onChange={(v) => update("termination_date", v)}
          />
          <Input
            label="Solicitado por"
            value={data.termination_requested_by}
            onChange={(v) => update("termination_requested_by", v)}
            placeholder="empresa concedente / estagiário"
          />
          <Input
            label="Seguradora"
            value={data.insurance_company}
            onChange={(v) => update("insurance_company", v)}
          />
          <Input
            label="Apólice"
            value={data.insurance_policy}
            onChange={(v) => update("insurance_policy", v)}
          />
          <Input
            label="Data de emissão"
            type="date"
            value={data.document_date}
            onChange={(v) => update("document_date", v)}
          />
        </div>

        <div style={styles.editorActions}>
          <button
            type="button"
            style={styles.primary}
            disabled={saving}
            onClick={() => save(true)}
          >
            {saving ? "Salvando..." : "Salvar dados"}
          </button>
        </div>
      </details>

      <div style={styles.sectionTitle}>Documentos</div>

      <div style={styles.documents}>
        <DocumentCard
          title="TCE"
          description="Termo de Compromisso de Estágio"
          generated={lastGenerated("tce")}
          loading={generating === "tce"}
          onGenerate={() => generate("tce")}
        />

        {raPeriods.map((period) => (
          <DocumentCard
            key={period.number}
            title={`RA ${period.number}`}
            description={`${formatDate(period.start)} a ${formatDate(period.end)}`}
            generated={lastGenerated("ra", period.number)}
            loading={generating === `ra-${period.number}`}
            onGenerate={() => generate("ra", period.number)}
          />
        ))}

        <DocumentCard
          title="ADT PRO"
          description="Aditivo de Prorrogação de Estágio"
          generated={lastGenerated("adt")}
          loading={generating === "adt"}
          onGenerate={() => generate("adt")}
        />

        <DocumentCard
          title="DTT"
          description="Distrato / encerramento do estágio"
          generated={lastGenerated("dtt")}
          loading={generating === "dtt"}
          onGenerate={() => generate("dtt")}
        />

        <DocumentCard
          title="Declaração de Jornada"
          description="Comprovação da empresa, dias e horários"
          generated={lastGenerated("jornada")}
          loading={generating === "jornada"}
          onGenerate={() => generate("jornada")}
        />

        <DocumentCard
          title="Convênio"
          description="Modelo MOTIVAR para instituição sem modelo próprio"
          generated={lastGenerated("convenio")}
          loading={generating === "convenio"}
          onGenerate={() => generate("convenio")}
        />
      </div>

      {!raPeriods.length && (
        <p style={styles.note}>
          Os RAs aparecem automaticamente assim que as datas de início e fim do
          estágio estiverem preenchidas.
        </p>
      )}
    </section>
  );
}

function DocumentCard({
  title,
  description,
  generated,
  loading,
  onGenerate,
}: {
  title: string;
  description: string;
  generated?: any;
  loading: boolean;
  onGenerate: () => void;
}) {
  return (
    <article style={styles.documentCard}>
      <div>
        <strong style={styles.documentTitle}>{title}</strong>
        <p style={styles.documentDescription}>{description}</p>
        {generated && (
          <span style={styles.generated}>
            Último PDF:{" "}
            {new Date(generated.generated_at).toLocaleString("pt-BR")}
          </span>
        )}
      </div>

      <button
        type="button"
        style={styles.primary}
        disabled={loading}
        onClick={onGenerate}
      >
        {loading ? "Gerando..." : "Gerar PDF"}
      </button>
    </article>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    marginTop: 18,
    border: "1px solid #93c5fd",
    borderRadius: 22,
    padding: 18,
    background: "#f8fbff",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  },
  kicker: {
    margin: 0,
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: ".14em",
  },
  title: { margin: "5px 0", fontSize: 21, fontWeight: 950 },
  subtitle: {
    margin: 0,
    maxWidth: 700,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.5,
  },
  health: {
    padding: "8px 11px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
  },
  healthOk: { background: "#dcfce7", color: "#166534" },
  healthWarning: { background: "#ffedd5", color: "#9a3412" },
  quickSummary: {
    marginTop: 14,
    display: "flex",
    gap: 14,
    flexWrap: "wrap",
    fontSize: 12,
    color: "#475569",
  },
  warning: {
    marginTop: 12,
    borderRadius: 14,
    padding: 10,
    background: "#fff7ed",
    color: "#9a3412",
    fontSize: 12,
  },
  details: {
    marginTop: 16,
    borderRadius: 16,
    border: "1px solid #dbeafe",
    background: "#fff",
    padding: 12,
  },
  summaryButton: {
    cursor: "pointer",
    fontWeight: 900,
    color: "#1d4ed8",
  },
  sectionTitle: {
    marginTop: 18,
    marginBottom: 9,
    fontSize: 13,
    fontWeight: 950,
    color: "#0f172a",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 10,
  },
  label: {
    display: "grid",
    gap: 5,
    color: "#334155",
    fontSize: 11,
    fontWeight: 800,
  },
  labelWide: {
    display: "grid",
    gap: 5,
    marginTop: 10,
    color: "#334155",
    fontSize: 11,
    fontWeight: 800,
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "9px 10px",
    background: "#fff",
    color: "#0f172a",
  },
  missingInput: {
    border: "1px solid #fb923c",
    background: "#fff7ed",
  },
  textarea: {
    width: "100%",
    minHeight: 90,
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: 10,
    background: "#fff",
    color: "#0f172a",
  },
  checkbox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minHeight: 38,
    fontSize: 12,
    fontWeight: 800,
    color: "#334155",
  },
  editorActions: {
    display: "flex",
    gap: 8,
    marginTop: 14,
  },
  documents: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 10,
  },
  documentCard: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 145,
    borderRadius: 16,
    border: "1px solid #dbeafe",
    padding: 14,
    background: "#fff",
  },
  documentTitle: {
    fontSize: 15,
    color: "#0f172a",
  },
  documentDescription: {
    margin: "5px 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.45,
  },
  generated: {
    display: "block",
    marginTop: 8,
    color: "#15803d",
    fontSize: 10,
    fontWeight: 800,
  },
  primary: {
    border: 0,
    borderRadius: 11,
    padding: "9px 12px",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  note: {
    margin: "12px 0 0",
    color: "#64748b",
    fontSize: 12,
  },
  loading: {
    color: "#64748b",
    fontSize: 13,
  },
};
