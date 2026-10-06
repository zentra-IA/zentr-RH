"use client";

import { useEffect, useMemo, useState } from "react";

type Automation = {
  id: string;
  name: string;
  intent?: string | null;
  trigger_keywords: string[];
  match_type: string;
  response_text: string;
  response_variations: string[];
  is_fallback: boolean;
  priority: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

type FormState = {
  id: string;
  name: string;
  intent: string;
  keywords: string;
  matchType: string;
  responseText: string;
  responseVariations: string;
  isFallback: boolean;
  priority: string;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  id: "",
  name: "",
  intent: "",
  keywords: "",
  matchType: "contains",
  responseText: "",
  responseVariations: "",
  isFallback: false,
  priority: "0",
  active: true,
};

const INTENTS = [
  ["", "Sem intenção específica"],
  ["SAUDACAO", "Saudação"],
  ["VAGA", "Pergunta sobre vagas"],
  ["ENTREVISTA", "Pergunta sobre entrevista"],
  ["PROCESSO", "Status do processo"],
  ["CURRICULO", "Currículo / cadastro"],
  ["DOCUMENTOS", "Documentos"],
  ["ATENDIMENTO_HUMANO", "Pedir atendimento humano"],
  ["SEM_INTERESSE", "Sem interesse"],
];

function intentLabel(value: unknown) {
  const key = String(value || "").toUpperCase();
  return INTENTS.find(([id]) => id === key)?.[1] || key || "—";
}

function matchLabel(value: string) {
  if (value === "exact") return "Frase exata";
  if (value === "starts_with") return "Começa com";
  return "Contém";
}

export default function CandidatePortalAutomationManager() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const activeCount = useMemo(
    () => automations.filter((item) => item.active).length,
    [automations]
  );

  async function load() {
    try {
      setLoading(true);

      const response = await fetch(
        "/api/rh/candidate-portal/automations",
        {
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(data.error || "Erro ao carregar automações.");
        return;
      }

      setAutomations(data.automations || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function update<K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function edit(item: Automation) {
    setForm({
      id: item.id,
      name: item.name || "",
      intent: item.intent || "",
      keywords: (item.trigger_keywords || []).join("\n"),
      matchType: item.match_type || "contains",
      responseText: item.response_text || "",
      responseVariations: (item.response_variations || []).join("\n"),
      isFallback: Boolean(item.is_fallback),
      priority: String(item.priority ?? 0),
      active: item.active !== false,
    });
    setShowForm(true);
  }

  function reset() {
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  async function save() {
    if (!form.name.trim()) {
      alert("Informe o nome da automação.");
      return;
    }

    if (!form.responseText.trim()) {
      alert("Informe a resposta.");
      return;
    }

    if (
      !form.isFallback &&
      !form.keywords.trim() &&
      !form.intent
    ) {
      alert(
        "Informe palavras-chave, uma intenção ou marque como resposta padrão."
      );
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        "/api/rh/candidate-portal/automations",
        {
          method: form.id ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: form.id || undefined,
            name: form.name,
            intent: form.isFallback ? "" : form.intent,
            triggerKeywords: form.isFallback ? [] : form.keywords,
            matchType: form.matchType,
            responseText: form.responseText,
            responseVariations: form.responseVariations,
            isFallback: form.isFallback,
            priority: Number(form.priority || 0),
            active: form.active,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(data.error || "Erro ao salvar automação.");
        return;
      }

      reset();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: Automation) {
    const response = await fetch(
      "/api/rh/candidate-portal/automations",
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          active: !item.active,
          toggleOnly: true,
        }),
      }
    );

    if (response.ok) {
      await load();
    }
  }

  async function remove(item: Automation) {
    if (!confirm(`Excluir a automação "${item.name}"?`)) return;

    const response = await fetch(
      `/api/rh/candidate-portal/automations?id=${encodeURIComponent(
        item.id
      )}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    if (response.ok) {
      if (form.id === item.id) reset();
      await load();
    }
  }

  return (
    <section className="cpa-root">
      <section className="cpa-summary">
        <div>
          <span>CHATBOT EXCLUSIVO DO CANDIDATO</span>
          <h2>🤖 Respostas automáticas Portal + Push</h2>
          <p>
            O candidato envia uma mensagem no Portal. O sistema identifica
            o gatilho e responde no chat. A resposta também pode gerar Push.
            Quando uma recrutadora responde manualmente, o bot daquela conversa
            é pausado automaticamente.
          </p>
        </div>

        <div className="summary-side">
          <div>
            <b>{activeCount}</b>
            <small>automações ativas</small>
          </div>
          <button
            onClick={() => {
              setForm(EMPTY_FORM);
              setShowForm(true);
            }}
          >
            + Nova automação
          </button>
        </div>
      </section>

      <section className="cpa-how">
        <strong>Exemplo</strong>
        <span>
          Candidato: “qual horário da entrevista?” → gatilho “entrevista” →
          “Olá, {"{{nome}}"}! Confira a aba Entrevistas do seu Portal. Se precisar,
          nossa equipe também pode te atender por aqui.”
        </span>
      </section>

      {showForm && (
        <section className="cpa-form">
          <div className="form-head">
            <div>
              <span>AUTOMAÇÃO</span>
              <h3>
                {form.id
                  ? "Editar resposta automática"
                  : "Criar resposta automática"}
              </h3>
            </div>
            <button className="close" onClick={reset}>
              ×
            </button>
          </div>

          <div className="form-grid">
            <label className="wide">
              <span>Nome interno</span>
              <input
                value={form.name}
                onChange={(event) =>
                  update("name", event.target.value)
                }
                placeholder="Ex: Entrevista - horário"
              />
            </label>

            <label>
              <span>Intenção</span>
              <select
                value={form.intent}
                disabled={form.isFallback}
                onChange={(event) =>
                  update("intent", event.target.value)
                }
              >
                {INTENTS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Correspondência</span>
              <select
                value={form.matchType}
                disabled={form.isFallback}
                onChange={(event) =>
                  update("matchType", event.target.value)
                }
              >
                <option value="contains">Mensagem contém</option>
                <option value="exact">Mensagem exata</option>
                <option value="starts_with">Começa com</option>
              </select>
            </label>

            <label className="wide">
              <span>Palavras / frases gatilho</span>
              <textarea
                rows={3}
                value={form.keywords}
                disabled={form.isFallback}
                onChange={(event) =>
                  update("keywords", event.target.value)
                }
                placeholder={"entrevista\nhorário da entrevista\nquando é minha entrevista"}
              />
              <small>Uma por linha ou separadas por vírgula.</small>
            </label>

            <label className="wide">
              <span>Resposta principal</span>
              <textarea
                rows={5}
                value={form.responseText}
                onChange={(event) =>
                  update("responseText", event.target.value)
                }
                placeholder="Olá, {{nome}}! Vou te ajudar..."
              />
              <small>
                Variáveis disponíveis: {"{{nome}}"}, {"{{candidato}}"}.
              </small>
            </label>

            <label className="wide">
              <span>Variações futuras (opcional)</span>
              <textarea
                rows={3}
                value={form.responseVariations}
                onChange={(event) =>
                  update("responseVariations", event.target.value)
                }
                placeholder={"Resposta alternativa 1\nResposta alternativa 2"}
              />
            </label>

            <label>
              <span>Prioridade</span>
              <input
                type="number"
                value={form.priority}
                onChange={(event) =>
                  update("priority", event.target.value)
                }
              />
            </label>

            <label className="toggle">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) =>
                  update("active", event.target.checked)
                }
              />
              <span>Automação ativa</span>
            </label>

            <label className="toggle wide">
              <input
                type="checkbox"
                checked={form.isFallback}
                onChange={(event) =>
                  update("isFallback", event.target.checked)
                }
              />
              <span>
                Resposta padrão quando nenhum outro gatilho corresponder
              </span>
            </label>
          </div>

          <div className="form-actions">
            <button className="secondary" onClick={reset}>
              Cancelar
            </button>
            <button
              className="primary"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "Salvando..." : "Salvar automação"}
            </button>
          </div>
        </section>
      )}

      <section className="cpa-list">
        {loading ? (
          <div className="empty">Carregando automações...</div>
        ) : !automations.length ? (
          <div className="empty">
            Nenhuma automação criada ainda.
          </div>
        ) : (
          automations.map((item) => (
            <article key={item.id} className={!item.active ? "inactive" : ""}>
              <div className="top">
                <div>
                  <span className="tag">
                    {item.is_fallback
                      ? "RESPOSTA PADRÃO"
                      : intentLabel(item.intent)}
                  </span>
                  <h3>{item.name}</h3>
                </div>

                <button
                  className={item.active ? "active-toggle" : "inactive-toggle"}
                  onClick={() => void toggle(item)}
                >
                  {item.active ? "Ativa" : "Pausada"}
                </button>
              </div>

              {!item.is_fallback && (
                <div className="trigger">
                  <b>{matchLabel(item.match_type)}</b>
                  <span>
                    {(item.trigger_keywords || []).join(" • ") ||
                      "Somente intenção"}
                  </span>
                </div>
              )}

              <p>{item.response_text}</p>

              <div className="bottom">
                <small>Prioridade {item.priority}</small>
                <div>
                  <button
                    className="secondary"
                    onClick={() => edit(item)}
                  >
                    Editar
                  </button>
                  <button
                    className="danger"
                    onClick={() => void remove(item)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      <style jsx>{`
        .cpa-root {
          display: grid;
          gap: 12px;
        }

        .cpa-summary,
        .cpa-how,
        .cpa-form,
        .cpa-list article,
        .empty {
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          background: #fff;
          box-shadow: 0 12px 34px rgba(15, 23, 42, 0.05);
        }

        .cpa-summary {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          padding: 18px;
        }

        .cpa-summary > div:first-child {
          max-width: 800px;
        }

        .cpa-summary span,
        .form-head span {
          color: #7c3aed;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.12em;
        }

        .cpa-summary h2 {
          margin: 4px 0 7px;
        }

        .cpa-summary p,
        .cpa-how span {
          margin: 0;
          color: #667085;
          font-size: 11px;
          line-height: 1.5;
        }

        .summary-side {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .summary-side > div {
          padding: 10px 14px;
          border-radius: 14px;
          background: #f5f3ff;
          text-align: center;
        }

        .summary-side b,
        .summary-side small {
          display: block;
        }

        .summary-side b {
          color: #7c3aed;
          font-size: 22px;
        }

        .summary-side small {
          color: #667085;
          font-size: 8px;
        }

        .summary-side button,
        .primary {
          min-height: 40px;
          border: 0;
          border-radius: 11px;
          padding: 0 13px;
          background: #7c3aed;
          color: #fff;
          font-weight: 950;
          cursor: pointer;
        }

        .cpa-how {
          display: grid;
          gap: 4px;
          padding: 13px 15px;
          background: #faf5ff;
          border-color: #e9d5ff;
        }

        .cpa-how strong {
          color: #7c3aed;
          font-size: 10px;
        }

        .cpa-form {
          padding: 16px;
        }

        .form-head,
        .form-actions,
        .top,
        .bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .form-head h3 {
          margin: 3px 0 0;
        }

        .close {
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 10px;
          background: #f2f4f7;
          cursor: pointer;
          font-size: 20px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          margin-top: 13px;
        }

        label {
          display: grid;
          gap: 5px;
        }

        label.wide {
          grid-column: 1 / -1;
        }

        label > span {
          color: #475467;
          font-size: 10px;
          font-weight: 850;
        }

        label small {
          color: #98a2b3;
          font-size: 8px;
        }

        input,
        select,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dfe4ea;
          border-radius: 11px;
          padding: 9px 10px;
          background: #fff;
          outline: none;
          font: inherit;
          font-size: 11px;
        }

        textarea {
          resize: vertical;
        }

        .toggle {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 9px;
          border: 1px solid #e5e7eb;
          border-radius: 11px;
        }

        .toggle input {
          width: auto;
        }

        .form-actions {
          justify-content: flex-end;
          margin-top: 12px;
        }

        .secondary,
        .danger {
          min-height: 36px;
          border-radius: 10px;
          padding: 0 11px;
          background: #fff;
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        .secondary {
          border: 1px solid #dfe4ea;
          color: #344054;
        }

        .danger {
          border: 1px solid #fecaca;
          color: #b91c1c;
          background: #fff1f2;
        }

        .cpa-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 10px;
        }

        .cpa-list article {
          padding: 13px;
        }

        .cpa-list article.inactive {
          opacity: 0.65;
        }

        .tag {
          display: inline-block;
          padding: 4px 6px;
          border-radius: 999px;
          background: #f5f3ff;
          color: #7c3aed;
          font-size: 8px;
          font-weight: 950;
        }

        .top h3 {
          margin: 5px 0 0;
          font-size: 13px;
        }

        .active-toggle,
        .inactive-toggle {
          border: 1px solid;
          border-radius: 999px;
          padding: 6px 9px;
          font-size: 8px;
          font-weight: 950;
          cursor: pointer;
        }

        .active-toggle {
          border-color: #bbf7d0;
          background: #f0fdf4;
          color: #15803d;
        }

        .inactive-toggle {
          border-color: #e5e7eb;
          background: #f8fafc;
          color: #667085;
        }

        .trigger {
          display: grid;
          gap: 3px;
          margin: 10px 0;
          padding: 9px;
          border-radius: 11px;
          background: #f8fafc;
        }

        .trigger b {
          font-size: 8px;
          color: #475467;
        }

        .trigger span {
          color: #667085;
          font-size: 9px;
        }

        article > p {
          min-height: 52px;
          margin: 8px 0;
          color: #344054;
          font-size: 10px;
          line-height: 1.5;
        }

        .bottom {
          padding-top: 9px;
          border-top: 1px solid #eef2f6;
        }

        .bottom small {
          color: #98a2b3;
          font-size: 8px;
        }

        .bottom div {
          display: flex;
          gap: 5px;
        }

        .empty {
          padding: 30px;
          grid-column: 1 / -1;
          color: #98a2b3;
          text-align: center;
          font-size: 10px;
        }

        @media (max-width: 760px) {
          .cpa-summary,
          .summary-side {
            align-items: stretch;
            flex-direction: column;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          label.wide {
            grid-column: auto;
          }
        }
      `}</style>
    </section>
  );
}
