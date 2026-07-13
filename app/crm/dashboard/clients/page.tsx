"use client";

import { useEffect, useMemo, useState } from "react";

type Client = {
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
  notes?: string | null;
};

type ClientForm = {
  companyName: string;
  cnpj: string;
  responsibleName: string;
  whatsapp: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  address: string;
  cep: string;
  notes: string;
};

const emptyForm: ClientForm = {
  companyName: "",
  cnpj: "",
  responsibleName: "",
  whatsapp: "",
  phone: "",
  email: "",
  city: "",
  state: "",
  address: "",
  cep: "",
  notes: "",
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return clients;

    return clients.filter((client) =>
      [
        client.companyName,
        client.responsibleName,
        client.cnpj,
        client.whatsapp,
        client.email,
        client.city,
        client.state,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [clients, search]);

  function updateForm(key: keyof ClientForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function loadClients() {
    try {
      setLoading(true);

      const res = await fetch("/api/rh/clients", {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao carregar clientes.");
        return;
      }

      setClients(data.clients || []);
    } finally {
      setLoading(false);
    }
  }

  async function saveClient(event: React.FormEvent) {
    event.preventDefault();

    if (!form.companyName.trim()) {
      alert("Informe o nome da empresa.");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/rh/clients", {
        method: editingId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          id: editingId,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Erro ao salvar cliente.");
        return;
      }

      setForm(emptyForm);
      setEditingId(null);
      await loadClients();

      alert(editingId ? "Cliente atualizado." : "Cliente cadastrado.");
    } finally {
      setSaving(false);
    }
  }

  function editClient(client: Client) {
    setEditingId(client.id);
    setForm({
      companyName: client.companyName || client.name || "",
      cnpj: client.cnpj || "",
      responsibleName: client.responsibleName || "",
      whatsapp: client.whatsapp || "",
      phone: client.phone || "",
      email: client.email || "",
      city: client.city || "",
      state: client.state || "",
      address: client.address || "",
      cep: client.cep || "",
      notes: client.notes || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function deleteClient(client: Client) {
    const confirmed = confirm(
      `Excluir o cliente "${client.companyName || client.name}"?\n\nA vaga já criada continuará com o nome salvo, mas o vínculo direto pode ser perdido.`
    );

    if (!confirmed) return;

    const res = await fetch(`/api/rh/clients?id=${client.id}`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Erro ao excluir cliente.");
      return;
    }

    await loadClients();
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.kicker}>Zentra RH</p>
          <h1 style={styles.title}>Clientes</h1>
          <p style={styles.subtitle}>
            Cadastre as empresas que solicitam vagas. Depois, cada vaga pode ser vinculada ao cliente correto.
          </p>
        </div>

        <a style={styles.secondaryLink} href="/crm/dashboard/jobs">
          Voltar para vagas
        </a>
      </section>

      <section style={styles.card}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.sectionTitle}>
              {editingId ? "Editar cliente" : "Novo cliente"}
            </h2>
            <p style={styles.smallText}>
              Use esses dados para identificar a empresa, enviar candidatos e manter histórico por cliente.
            </p>
          </div>

          {editingId && (
            <button type="button" style={styles.secondaryButton} onClick={cancelEdit}>
              Cancelar edição
            </button>
          )}
        </div>

        <form onSubmit={saveClient} style={styles.formGrid}>
          <Input label="Nome da empresa" value={form.companyName} onChange={(v) => updateForm("companyName", v)} placeholder="Ex: Rede Brasil" />
          <Input label="CNPJ" value={form.cnpj} onChange={(v) => updateForm("cnpj", v)} placeholder="Somente se tiver" />
          <Input label="Responsável" value={form.responsibleName} onChange={(v) => updateForm("responsibleName", v)} placeholder="Ex: Angélica" />
          <Input label="WhatsApp" value={form.whatsapp} onChange={(v) => updateForm("whatsapp", v)} placeholder="Ex: 11999999999" />
          <Input label="Telefone" value={form.phone} onChange={(v) => updateForm("phone", v)} placeholder="Opcional" />
          <Input label="E-mail" value={form.email} onChange={(v) => updateForm("email", v)} placeholder="rh@empresa.com.br" />
          <Input label="Cidade" value={form.city} onChange={(v) => updateForm("city", v)} placeholder="Ex: São Paulo" />
          <Input label="Estado" value={form.state} onChange={(v) => updateForm("state", v)} placeholder="Ex: SP" />
          <Input label="CEP" value={form.cep} onChange={(v) => updateForm("cep", v)} placeholder="Opcional" />

          <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
            Endereço
            <input style={styles.input} value={form.address} onChange={(e) => updateForm("address", e.target.value)} placeholder="Rua, número, bairro" />
          </label>

          <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
            Observações
            <textarea style={{ ...styles.input, minHeight: 90 }} value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} placeholder="Preferências do cliente, contatos extras, regras de envio de candidatos..." />
          </label>

          <div style={styles.actionRow}>
            <button style={styles.primaryButton} disabled={saving}>
              {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar cliente"}
            </button>
          </div>
        </form>
      </section>

      <section style={styles.card}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.sectionTitle}>Clientes cadastrados</h2>
            <p style={styles.smallText}>Busque por empresa, responsável, CNPJ, WhatsApp, e-mail ou cidade.</p>
          </div>

          <button type="button" style={styles.secondaryButton} onClick={loadClients}>
            Atualizar
          </button>
        </div>

        <div style={styles.searchBox}>
          <Input label="Buscar cliente" value={search} onChange={setSearch} placeholder="Digite o nome do cliente..." />
        </div>

        {loading && <div style={styles.empty}>Carregando clientes...</div>}
        {!loading && !filteredClients.length && <div style={styles.empty}>Nenhum cliente cadastrado.</div>}

        {!loading && Boolean(filteredClients.length) && (
          <div style={styles.clientGrid}>
            {filteredClients.map((client) => (
              <article key={client.id} style={styles.clientCard}>
                <div style={styles.clientTop}>
                  <div>
                    <strong style={styles.clientName}>{client.companyName || client.name}</strong>
                    <p style={styles.muted}>{client.responsibleName || "Sem responsável informado"}</p>
                  </div>

                  <span style={styles.badge}>Cliente</span>
                </div>

                <div style={styles.metaGrid}>
                  <span><b>CNPJ:</b> {client.cnpj || "-"}</span>
                  <span><b>WhatsApp:</b> {client.whatsapp || client.phone || "-"}</span>
                  <span><b>E-mail:</b> {client.email || "-"}</span>
                  <span><b>Cidade:</b> {[client.city, client.state].filter(Boolean).join(" / ") || "-"}</span>
                </div>

                {client.notes && <p style={styles.notes}>{client.notes}</p>}

                <div style={styles.actionRow}>
                  <button style={styles.secondaryButton} onClick={() => editClient(client)}>
                    Editar
                  </button>

                  <button style={styles.dangerButton} onClick={() => deleteClient(client)}>
                    Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
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
  secondaryLink: {
    border: "1px solid #bfdbfe",
    borderRadius: 16,
    padding: "11px 14px",
    background: "#fff",
    color: "#2563eb",
    fontWeight: 950,
    textDecoration: "none",
    alignSelf: "flex-start",
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
  searchBox: {
    marginTop: 16,
    border: "1px solid #dbeafe",
    background: "#f8fafc",
    borderRadius: 22,
    padding: 14,
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
  clientGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 14,
  },
  clientCard: {
    border: "1px solid #dbeafe",
    background: "#f8fafc",
    borderRadius: 24,
    padding: 16,
    display: "grid",
    gap: 12,
  },
  clientTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  clientName: {
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
  notes: {
    margin: 0,
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.5,
  },
};
