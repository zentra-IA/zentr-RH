"use client";

import { useMemo, useState } from "react";

const CREATIVE_TYPES = [
  "Vaga de Emprego",
  "Contratação Urgente",
  "Banco de Talentos",
  "Estágio",
  "Jovem Aprendiz",
  "Vaga Administrativa",
  "Vaga Operacional",
  "Vaga Comercial",
  "Employer Branding",
  "Personalizado",
];

const STYLES = [
  "Corporativo",
  "Moderno",
  "Urgente",
  "Premium",
  "Jovem",
  "Profissional",
  "Minimalista",
];

const FORMATS = [
  { value: "feed", label: "Feed Instagram/Facebook 1:1" },
  { value: "story", label: "Stories/Status 9:16" },
  { value: "wide", label: "Banner horizontal 16:9" },
];

function copy(text: string) {
  navigator.clipboard.writeText(text || "");
  alert("Copiado.");
}

export default function CreativeGeneratorPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    creativeType: "Vaga de Emprego",
    style: "Moderno",
    format: "feed",
    jobTitle: "",
    city: "",
    salary: "",
    benefits: "",
    requirements: "",
    companyName: "",
    recruiterWhatsapp: "",
    extra: "",
  });

  const [result, setResult] = useState<any>(null);

  const payload = useMemo(() => {
    return {
      ...form,
      prompt: `
Tipo: ${form.creativeType}
Estilo: ${form.style}
Formato: ${form.format}
Vaga: ${form.jobTitle}
Cidade: ${form.city}
Salário: ${form.salary}
Benefícios: ${form.benefits}
Requisitos: ${form.requirements}
Empresa: ${form.companyName}
WhatsApp: ${form.recruiterWhatsapp}
Informações extras: ${form.extra}
      `.trim(),
    };
  }, [form]);

  async function generateCreative() {
    if (!form.jobTitle.trim() && !form.extra.trim()) {
      alert("Informe pelo menos a vaga ou uma descrição.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/creative-generator/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao gerar criativo.");
        return;
      }

      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  async function saveCreative() {
    if (!result) {
      alert("Gere um criativo primeiro.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/creative-generator/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          ...payload,
          result,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao salvar criativo.");
        return;
      }

      alert("Criativo salvo com sucesso.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.kicker}>Zentra RH</p>
          <h1 style={styles.title}>Gerador de Criativos RH IA</h1>
          <p style={styles.subtitle}>
            Crie artes, legendas e mensagens para divulgar vagas no Instagram,
            Facebook, WhatsApp Status e campanhas de recrutamento.
          </p>
        </div>

        <button style={styles.primaryButton} onClick={generateCreative} disabled={loading}>
          {loading ? "Gerando..." : "Gerar criativo"}
        </button>
      </section>

      <section style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Briefing da vaga</h2>
          <p style={styles.smallText}>
            Quanto mais claro o briefing, melhor a IA cria a arte e os textos.
          </p>

          <div style={styles.formGrid}>
            <select
              style={styles.input}
              value={form.creativeType}
              onChange={(e) => setForm({ ...form, creativeType: e.target.value })}
            >
              {CREATIVE_TYPES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>

            <select
              style={styles.input}
              value={form.style}
              onChange={(e) => setForm({ ...form, style: e.target.value })}
            >
              {STYLES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>

            <select
              style={styles.input}
              value={form.format}
              onChange={(e) => setForm({ ...form, format: e.target.value })}
            >
              {FORMATS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <input
              style={styles.input}
              placeholder="Nome da vaga. Ex: Operador de Caixa"
              value={form.jobTitle}
              onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
            />

            <input
              style={styles.input}
              placeholder="Cidade/Região. Ex: Campinas/SP"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />

            <input
              style={styles.input}
              placeholder="Salário. Ex: R$ 2.300"
              value={form.salary}
              onChange={(e) => setForm({ ...form, salary: e.target.value })}
            />

            <input
              style={styles.input}
              placeholder="Empresa"
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            />

            <input
              style={styles.input}
              placeholder="WhatsApp para candidatura"
              value={form.recruiterWhatsapp}
              onChange={(e) => setForm({ ...form, recruiterWhatsapp: e.target.value })}
            />

            <textarea
              style={{ ...styles.input, minHeight: 90, gridColumn: "1 / -1" }}
              placeholder="Benefícios. Ex: VT, VR, plano de saúde, bonificação"
              value={form.benefits}
              onChange={(e) => setForm({ ...form, benefits: e.target.value })}
            />

            <textarea
              style={{ ...styles.input, minHeight: 90, gridColumn: "1 / -1" }}
              placeholder="Requisitos. Ex: Ensino médio, experiência com atendimento, disponibilidade 6x1"
              value={form.requirements}
              onChange={(e) => setForm({ ...form, requirements: e.target.value })}
            />

            <textarea
              style={{ ...styles.input, minHeight: 120, gridColumn: "1 / -1" }}
              placeholder={`Informações extras:
Ex: Criar arte chamativa para vaga de Operador de Caixa.
Escala 6x1, início imediato, enviar currículo pelo WhatsApp.`}
              value={form.extra}
              onChange={(e) => setForm({ ...form, extra: e.target.value })}
            />
          </div>

          <div style={styles.actions}>
            <button style={styles.primaryButton} onClick={generateCreative} disabled={loading}>
              {loading ? "Gerando arte e textos..." : "Gerar criativo RH"}
            </button>

            <button style={styles.secondaryButton} onClick={saveCreative} disabled={saving || !result}>
              {saving ? "Salvando..." : "Salvar criativo"}
            </button>
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Resultado</h2>

          {!result && !loading && (
            <div style={styles.empty}>
              O resultado aparecerá aqui com imagem, legenda, texto de WhatsApp e hashtags.
            </div>
          )}

          {loading && (
            <div style={styles.empty}>
              Gerando criativo com IA. Isso pode levar alguns segundos.
            </div>
          )}

          {result && (
            <div style={styles.resultGrid}>
              {result.imageUrl && (
                <div>
                  <img src={result.imageUrl} alt="Criativo gerado" style={styles.imagePreview} />
                  <a
                    href={result.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.primaryButtonLink}
                  >
                    Abrir imagem
                  </a>
                </div>
              )}

              <ResultBox
                title="Texto para status"
                text={result.statusText}
              />

              <ResultBox
                title="Legenda Instagram/Facebook"
                text={result.instagramCaption}
              />

              <ResultBox
                title="Mensagem WhatsApp"
                text={result.whatsappText}
              />

              <ResultBox
                title="Hashtags"
                text={result.hashtags}
              />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function ResultBox({ title, text }: { title: string; text: string }) {
  return (
    <div style={styles.resultBox}>
      <div style={styles.resultHeader}>
        <strong>{title}</strong>
        <button style={styles.copyButton} onClick={() => copy(text)}>
          Copiar
        </button>
      </div>

      <pre style={styles.pre}>{text || "-"}</pre>
    </div>
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
    fontWeight: 900,
    letterSpacing: ".22em",
    fontSize: 12,
    textTransform: "uppercase",
  },
  title: {
    margin: "8px 0",
    fontSize: 36,
    fontWeight: 950,
  },
  subtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: 14,
    maxWidth: 760,
  },
  grid: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, .9fr)",
    gap: 18,
  },
  card: {
    background: "#fff",
    border: "1px solid #bfdbfe",
    borderRadius: 28,
    padding: 22,
    boxShadow: "0 18px 50px rgba(37,99,235,.06)",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 950,
  },
  smallText: {
    margin: "4px 0 14px",
    color: "#64748b",
    fontSize: 12,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 12,
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
  actions: {
    marginTop: 16,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryButton: {
    border: 0,
    borderRadius: 16,
    padding: "13px 18px",
    background: "linear-gradient(135deg, #38bdf8, #2563eb)",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(37,99,235,.20)",
  },
  primaryButtonLink: {
    display: "inline-block",
    marginTop: 10,
    borderRadius: 16,
    padding: "12px 16px",
    background: "linear-gradient(135deg, #38bdf8, #2563eb)",
    color: "#fff",
    fontWeight: 900,
    textDecoration: "none",
  },
  secondaryButton: {
    border: "1px solid #bfdbfe",
    borderRadius: 16,
    padding: "12px 16px",
    background: "#fff",
    color: "#2563eb",
    fontWeight: 900,
    cursor: "pointer",
  },
  empty: {
    border: "1px dashed #93c5fd",
    borderRadius: 20,
    padding: 24,
    textAlign: "center",
    color: "#64748b",
    background: "#f8fafc",
  },
  resultGrid: {
    display: "grid",
    gap: 14,
  },
  imagePreview: {
    width: "100%",
    borderRadius: 22,
    border: "1px solid #dbeafe",
    background: "#f8fafc",
  },
  resultBox: {
    border: "1px solid #dbeafe",
    background: "#f8fafc",
    borderRadius: 20,
    padding: 14,
  },
  resultHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },
  copyButton: {
    border: "1px solid #bfdbfe",
    borderRadius: 12,
    background: "#fff",
    color: "#2563eb",
    padding: "8px 10px",
    fontWeight: 900,
    cursor: "pointer",
  },
  pre: {
    whiteSpace: "pre-wrap",
    fontFamily: "inherit",
    color: "#334155",
    fontSize: 13,
    lineHeight: 1.6,
    margin: "10px 0 0",
  },
};
