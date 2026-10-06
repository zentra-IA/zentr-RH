"use client";

import { useMemo, useState } from "react";

export type PipelineClient = {
  id: string;
  name: string;
  companyName: string;
  cnpj?: string | null;
  responsibleName?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  pipelineStage?: string | null;
};

const COLUMNS = [
  {
    key: "CLIENTE_NOVO",
    title: "Cliente novo",
    description: "Cadastro criado, sem ficha iniciada.",
  },
  {
    key: "AGUARDANDO_FICHA",
    title: "Aguardando ficha",
    description: "Ficha de abertura em preparação/validação.",
  },
  {
    key: "AGUARDANDO_CONTRATO",
    title: "Aguardando contrato",
    description: "Ficha aprovada e contrato pendente.",
  },
  {
    key: "CONTRATO_ASSINADO_ATIVO",
    title: "Contrato assinado / Ativo",
    description: "Cliente liberado e com processo ativo.",
  },
  {
    key: "CONTRATO_NAO_ASSINADO",
    title: "Contrato não assinado",
    description: "Cliente não concluiu a assinatura.",
  },
  {
    key: "CLIENTE_INADIMPLENTE",
    title: "Cliente inadimplente",
    description: "Pendência financeira exige acompanhamento.",
  },
  {
    key: "CLIENTE_INATIVO",
    title: "Cliente inativo",
    description: "Sem processo ativo no momento.",
  },
] as const;

type Stage = (typeof COLUMNS)[number]["key"];

export default function ClientPipeline({
  clients,
  onOpenClient,
  onChanged,
}: {
  clients: PipelineClient[];
  onOpenClient: (client: PipelineClient) => void;
  onChanged: () => Promise<void> | void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<Stage, PipelineClient[]>();

    for (const column of COLUMNS) {
      map.set(column.key, []);
    }

    for (const client of clients) {
      const stage = (client.pipelineStage || "CLIENTE_NOVO") as Stage;
      const bucket = map.get(stage) || map.get("CLIENTE_NOVO")!;
      bucket.push(client);
    }

    for (const [, list] of map) {
      list.sort((a, b) =>
        (a.companyName || a.name).localeCompare(b.companyName || b.name, "pt-BR")
      );
    }

    return map;
  }, [clients]);

  async function moveClient(clientId: string, pipelineStage: Stage) {
    const client = clients.find((item) => item.id === clientId);
    if (!client) return;

    if ((client.pipelineStage || "CLIENTE_NOVO") === pipelineStage) {
      setDraggingId(null);
      return;
    }

    try {
      setMovingId(clientId);

      const res = await fetch("/api/rh/clients", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: clientId,
          action: "pipeline_stage",
          pipelineStage,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Não foi possível mover o cliente.");
        return;
      }

      await onChanged();
    } finally {
      setDraggingId(null);
      setMovingId(null);
    }
  }

  return (
    <div style={styles.board}>
      {COLUMNS.map((column) => {
        const items = grouped.get(column.key) || [];

        return (
          <section
            key={column.key}
            style={styles.column}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              event.preventDefault();
              const clientId =
                event.dataTransfer.getData("text/client-id") || draggingId;

              if (clientId) {
                moveClient(clientId, column.key);
              }
            }}
          >
            <header style={styles.columnHeader}>
              <div>
                <div style={styles.columnTitleRow}>
                  <strong style={styles.columnTitle}>{column.title}</strong>
                  <span style={styles.count}>{items.length}</span>
                </div>
                <p style={styles.columnDescription}>{column.description}</p>
              </div>
            </header>

            <div style={styles.cardList}>
              {items.length === 0 && (
                <div style={styles.emptyColumn}>Arraste um cliente para cá</div>
              )}

              {items.map((client) => (
                <article
                  key={client.id}
                  draggable
                  onDragStart={(event) => {
                    setDraggingId(client.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/client-id", client.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  style={{
                    ...styles.card,
                    opacity:
                      draggingId === client.id || movingId === client.id
                        ? 0.55
                        : 1,
                  }}
                >
                  <div style={styles.cardTop}>
                    <div style={styles.avatar}>
                      {(client.companyName || client.name || "C")
                        .slice(0, 1)
                        .toUpperCase()}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <strong style={styles.clientName}>
                        {client.companyName || client.name}
                      </strong>
                      <div style={styles.muted}>
                        {client.responsibleName || "Sem responsável"}
                      </div>
                    </div>
                  </div>

                  <div style={styles.cardMeta}>
                    {client.cnpj && <span>CNPJ: {client.cnpj}</span>}
                    {(client.city || client.state) && (
                      <span>
                        {[client.city, client.state].filter(Boolean).join(" / ")}
                      </span>
                    )}
                    {(client.whatsapp || client.email) && (
                      <span>{client.whatsapp || client.email}</span>
                    )}
                  </div>

                  <div style={styles.actions}>
                    <button
                      type="button"
                      style={styles.openButton}
                      onClick={() => onOpenClient(client)}
                    >
                      Abrir cliente
                    </button>

                    <select
                      aria-label="Mover cliente"
                      value={client.pipelineStage || "CLIENTE_NOVO"}
                      disabled={movingId === client.id}
                      onChange={(event) =>
                        moveClient(client.id, event.target.value as Stage)
                      }
                      style={styles.select}
                    >
                      {COLUMNS.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  board: {
    display: "grid",
    gridAutoFlow: "column",
    gridAutoColumns: "minmax(285px, 315px)",
    gap: 14,
    overflowX: "auto",
    padding: "4px 2px 16px",
    scrollbarWidth: "thin",
  },
  column: {
    minHeight: 430,
    border: "1px solid #dbeafe",
    borderRadius: 20,
    background: "#f8fafc",
    padding: 12,
  },
  columnHeader: {
    padding: "3px 3px 10px",
    borderBottom: "1px solid #e2e8f0",
  },
  columnTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  columnTitle: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 950,
  },
  count: {
    minWidth: 25,
    height: 25,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "#e0edff",
    color: "#1d4ed8",
    fontSize: 11,
    fontWeight: 950,
  },
  columnDescription: {
    minHeight: 30,
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 10.5,
    lineHeight: 1.4,
  },
  cardList: {
    display: "grid",
    gap: 10,
    marginTop: 10,
  },
  emptyColumn: {
    border: "1px dashed #cbd5e1",
    borderRadius: 14,
    padding: 15,
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 11,
    background: "#fff",
  },
  card: {
    border: "1px solid #dbeafe",
    borderRadius: 16,
    padding: 12,
    background: "#fff",
    boxShadow: "0 8px 24px rgba(15,23,42,.04)",
    cursor: "grab",
    transition: "opacity .15s ease, box-shadow .15s ease",
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    gap: 9,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 11,
    display: "grid",
    placeItems: "center",
    flex: "0 0 auto",
    background: "linear-gradient(135deg,#38bdf8,#2563eb)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 950,
  },
  clientName: {
    display: "block",
    maxWidth: 205,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#0f172a",
    fontSize: 12.5,
    fontWeight: 950,
  },
  muted: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 10.5,
  },
  cardMeta: {
    display: "grid",
    gap: 3,
    marginTop: 9,
    color: "#64748b",
    fontSize: 10.5,
  },
  actions: {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 7,
  },
  openButton: {
    border: 0,
    borderRadius: 11,
    padding: "9px 10px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 11,
  },
  select: {
    width: "100%",
    border: "1px solid #dbeafe",
    borderRadius: 11,
    padding: "8px 9px",
    background: "#fff",
    color: "#475569",
    fontSize: 10.5,
    outline: "none",
  },
};
