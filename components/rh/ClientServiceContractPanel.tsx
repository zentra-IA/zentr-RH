"use client";

import { useEffect, useState } from "react";
import type { RhClientSummary } from "@/components/rh/ClientOpeningFlow";

type ContractData = {
  client_name: string;
  client_cnpj: string;
  client_address: string;
  honorarium_amount: string;
  payment_day: string;
  contract_date: string;
  representative_name: string;
};

const STATUS_LABEL: Record<string, string> = {
  not_generated: "Ainda não gerado",
  draft: "Em preparação",
  generated: "Gerado",
  sent: "Enviado",
  signed: "Assinado",
};

export default function ClientServiceContractPanel({
  client,
}: {
  client: RhClientSummary;
}) {
  const [data, setData] = useState<ContractData>({
    client_name: client.companyName || client.name || "",
    client_cnpj: client.cnpj || "",
    client_address: [
      client.address,
      client.city,
      client.state,
      client.cep ? `CEP ${client.cep}` : "",
    ]
      .filter(Boolean)
      .join(", "),
    honorarium_amount: "",
    payment_day: "",
    contract_date: new Date().toISOString().slice(0, 10),
    representative_name: client.responsibleName || "",
  });
  const [status, setStatus] = useState("not_generated");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openEditor, setOpenEditor] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  async function load() {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/rh/clients/${encodeURIComponent(client.id)}/service-contract`,
        { cache: "no-store", credentials: "include" }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(payload.error || "Erro ao carregar contrato do cliente.");
        return;
      }

      setStatus(payload.status || "not_generated");
      setData((current) => ({
        ...current,
        ...(payload.data || {}),
      }));
    } finally {
      setLoading(false);
    }
  }

  async function save(nextStatus?: string) {
    const res = await fetch(
      `/api/rh/clients/${encodeURIComponent(client.id)}/service-contract`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: nextStatus || (status === "not_generated" ? "draft" : status),
          data,
        }),
      }
    );

    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(payload.error || "Erro ao salvar contrato do cliente.");
      return false;
    }

    setStatus(payload.status || nextStatus || status);
    setData((current) => ({
      ...current,
      ...(payload.data || {}),
    }));
    return true;
  }

  async function generatePdf() {
    try {
      setBusy(true);

      const res = await fetch(
        `/api/rh/clients/${encodeURIComponent(client.id)}/service-contract`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ data }),
        }
      );

      if (!res.ok) {
        const message = await res.text();
        alert(message || "Erro ao gerar PDF.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setStatus("generated");
      setOpenEditor(false);
    } finally {
      setBusy(false);
    }
  }

  async function mark(nextStatus: "sent" | "signed") {
    try {
      setBusy(true);
      const ok = await save(nextStatus);
      if (ok) {
        alert(
          nextStatus === "signed"
            ? "Contrato marcado como assinado."
            : "Contrato marcado como enviado."
        );
      }
    } finally {
      setBusy(false);
    }
  }

  const missing =
    !String(data.client_name || "").trim() ||
    !String(data.client_cnpj || "").trim() ||
    !String(data.client_address || "").trim() ||
    !String(data.honorarium_amount || "").trim() ||
    !String(data.payment_day || "").trim();

  return (
    <section style={styles.card}>
      <div style={styles.header}>
        <div>
          <p style={styles.kicker}>1. Contrato-mãe do cliente</p>
          <h3 style={styles.title}>Contrato de Prestação de Serviços de Estágio</h3>
          <p style={styles.text}>
            Os dados do cliente já entram automaticamente. Confira só as condições
            comerciais e gere o PDF.
          </p>
        </div>

        <span
          style={{
            ...styles.badge,
            ...(status === "signed"
              ? styles.badgeSuccess
              : status === "generated" || status === "sent"
                ? styles.badgeInfo
                : {}),
          }}
        >
          {loading ? "Carregando..." : STATUS_LABEL[status] || status}
        </span>
      </div>

      {missing && !loading && (
        <div style={styles.warning}>
          Existem dados obrigatórios para conferir antes de gerar o contrato.
        </div>
      )}

      <div style={styles.summary}>
        <span>
          <b>Empresa:</b> {client.companyName || client.name}
        </span>
        <span>
          <b>CNPJ:</b> {client.cnpj || "-"}
        </span>
        <span>
          <b>Responsável:</b> {client.responsibleName || "-"}
        </span>
      </div>

      {openEditor && (
        <div style={styles.grid}>
          <label style={styles.label}>
            Razão social no contrato
            <input
              style={styles.input}
              value={data.client_name || ""}
              onChange={(e) =>
                setData((current) => ({
                  ...current,
                  client_name: e.target.value,
                }))
              }
            />
          </label>

          <label style={styles.label}>
            CNPJ no contrato
            <input
              style={styles.input}
              value={data.client_cnpj || ""}
              onChange={(e) =>
                setData((current) => ({
                  ...current,
                  client_cnpj: e.target.value,
                }))
              }
            />
          </label>

          <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
            Endereço completo no contrato
            <input
              style={styles.input}
              value={data.client_address || ""}
              onChange={(e) =>
                setData((current) => ({
                  ...current,
                  client_address: e.target.value,
                }))
              }
            />
          </label>

          <label style={styles.label}>
            Valor por estagiário ativo
            <input
              style={styles.input}
              value={data.honorarium_amount || ""}
              onChange={(e) =>
                setData((current) => ({
                  ...current,
                  honorarium_amount: e.target.value,
                }))
              }
              placeholder="Ex: 800,00"
            />
          </label>

          <label style={styles.label}>
            Dia de pagamento
            <input
              style={styles.input}
              value={data.payment_day || ""}
              onChange={(e) =>
                setData((current) => ({
                  ...current,
                  payment_day: e.target.value,
                }))
              }
              placeholder="Ex: 10"
            />
          </label>

          <label style={styles.label}>
            Data do contrato
            <input
              type="date"
              style={styles.input}
              value={data.contract_date || ""}
              onChange={(e) =>
                setData((current) => ({
                  ...current,
                  contract_date: e.target.value,
                }))
              }
            />
          </label>

          <label style={styles.label}>
            Representante do cliente
            <input
              style={styles.input}
              value={data.representative_name || ""}
              onChange={(e) =>
                setData((current) => ({
                  ...current,
                  representative_name: e.target.value,
                }))
              }
            />
          </label>
        </div>
      )}

      <div style={styles.actions}>
        <button
          type="button"
          style={styles.secondary}
          onClick={() => setOpenEditor((value) => !value)}
        >
          {openEditor ? "Fechar conferência" : "Conferir dados"}
        </button>

        <button
          type="button"
          style={styles.primary}
          disabled={busy || missing}
          onClick={generatePdf}
        >
          {busy ? "Gerando..." : "Gerar PDF"}
        </button>

        {["generated", "sent"].includes(status) && (
          <button
            type="button"
            style={styles.secondary}
            disabled={busy}
            onClick={() => mark("sent")}
          >
            Marcar enviado
          </button>
        )}

        {status !== "signed" && (
          <button
            type="button"
            style={styles.success}
            disabled={busy}
            onClick={() => {
              if (
                confirm(
                  "Confirmar que este cliente já possui o Contrato de Prestação de Serviços de Estágio assinado?"
                )
              ) {
                mark("signed");
              }
            }}
          >
            Já possui contrato assinado
          </button>
        )}

        {status === "signed" && (
          <span style={styles.signedText}>✓ Contrato regularizado</span>
        )}
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    marginTop: 18,
    padding: 18,
    border: "1px solid #bfdbfe",
    borderRadius: 22,
    background: "#f8fbff",
  },
  header: {
    display: "flex",
    gap: 14,
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  kicker: {
    margin: 0,
    color: "#2563eb",
    fontWeight: 900,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: ".12em",
  },
  title: { margin: "5px 0", fontSize: 18, fontWeight: 900 },
  text: { margin: 0, color: "#64748b", fontSize: 13, lineHeight: 1.5 },
  badge: {
    padding: "8px 11px",
    borderRadius: 999,
    background: "#e2e8f0",
    color: "#334155",
    fontSize: 12,
    fontWeight: 900,
  },
  badgeInfo: { background: "#dbeafe", color: "#1d4ed8" },
  badgeSuccess: { background: "#dcfce7", color: "#166534" },
  signedText: { color: "#166534", fontSize: 12, fontWeight: 900, alignSelf: "center" },
  warning: {
    marginTop: 12,
    padding: 11,
    borderRadius: 14,
    background: "#fff7ed",
    color: "#9a3412",
    fontSize: 12,
    fontWeight: 800,
  },
  summary: {
    display: "flex",
    gap: 14,
    flexWrap: "wrap",
    marginTop: 14,
    color: "#475569",
    fontSize: 12,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 12,
    marginTop: 16,
  },
  label: {
    display: "grid",
    gap: 6,
    fontSize: 12,
    fontWeight: 800,
    color: "#334155",
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "10px 12px",
    background: "#fff",
    color: "#0f172a",
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 16,
  },
  primary: {
    border: 0,
    borderRadius: 12,
    padding: "10px 14px",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  secondary: {
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "10px 14px",
    background: "#fff",
    color: "#334155",
    fontWeight: 800,
    cursor: "pointer",
  },
  success: {
    border: 0,
    borderRadius: 12,
    padding: "10px 14px",
    background: "#15803d",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
};
