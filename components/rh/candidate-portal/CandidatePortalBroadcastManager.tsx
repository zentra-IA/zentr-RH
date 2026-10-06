"use client";

import { useEffect, useMemo, useState } from "react";

type Profile = {
  id: string;
  full_name: string;
  phone_normalized?: string | null;
  email_normalized?: string | null;
  portal_status?: string | null;
  push_active?: boolean;
  city?: string | null;
  state?: string | null;
  education?: string | null;
  course?: string | null;
  last_role?: string | null;
  origin?: string | null;
};

type SavedList = {
  id: string;
  name: string;
  member_count: number;
  profile_ids: string[];
};

type SendResult = {
  selected: number;
  eligible: number;
  message_delivered: number;
  push_sent: number;
  push_failed: number;
  without_push: number;
  without_portal: number;
};

export default function CandidatePortalBroadcastManager() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [lists, setLists] = useState<SavedList[]>([]);
  const [filters, setFilters] = useState<any>({
    cities: [],
    education: [],
    roles: [],
    origins: [],
  });

  const [q, setQ] = useState("");
  const [push, setPush] = useState("all");
  const [portal, setPortal] = useState("active");
  const [city, setCity] = useState("");
  const [education, setEducation] = useState("");
  const [role, setRole] = useState("");
  const [origin, setOrigin] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeListId, setActiveListId] = useState("");
  const [listName, setListName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  async function bootstrap() {
    const response = await fetch(
      "/api/rh/candidate-portal/broadcasts?mode=bootstrap",
      {
        credentials: "include",
        cache: "no-store",
      }
    );
    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      setLists(data.lists || []);
      setFilters(data.filters || {});
    }
  }

  async function load() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (push !== "all") params.set("push", push);
      if (portal !== "all") params.set("portal", portal);
      if (city) params.set("city", city);
      if (education) params.set("education", education);
      if (role) params.set("role", role);
      if (origin) params.set("origin", origin);

      const response = await fetch(
        `/api/rh/candidate-portal/broadcasts?${params.toString()}`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(data.error || "Erro ao carregar candidatos.");
        return;
      }

      setProfiles(data.profiles || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, push, portal, city, education, role, origin]);

  function toggle(id: string) {
    setActiveListId("");
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function toggleAll() {
    const ids = profiles.map((item) => item.id);
    const all = ids.length > 0 && ids.every((id) => selected.has(id));

    if (all) {
      setSelectedIds((current) =>
        current.filter((id) => !ids.includes(id))
      );
    } else {
      setSelectedIds((current) =>
        Array.from(new Set([...current, ...ids]))
      );
    }
    setActiveListId("");
  }

  function selectPushActive() {
    setSelectedIds(
      profiles
        .filter(
          (item) =>
            item.push_active && item.portal_status === "ACTIVE"
        )
        .map((item) => item.id)
    );
    setActiveListId("");
  }

  async function createList() {
    if (!listName.trim() || !selectedIds.length) {
      alert("Informe o nome e selecione candidatos.");
      return;
    }

    const response = await fetch(
      "/api/rh/candidate-portal/broadcasts",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_list",
          name: listName.trim(),
          profileIds: selectedIds,
        }),
      }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(data.error || "Erro ao criar lista.");
      return;
    }

    setActiveListId(data.list.id);
    await bootstrap();
  }

  async function updateList() {
    if (!activeListId) return;

    const response = await fetch(
      "/api/rh/candidate-portal/broadcasts",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "replace_list",
          listId: activeListId,
          profileIds: selectedIds,
        }),
      }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(data.error || "Erro ao atualizar lista.");
      return;
    }

    await bootstrap();
  }

  async function deleteList(list: SavedList) {
    if (!confirm(`Excluir a lista "${list.name}"?`)) return;

    const response = await fetch(
      `/api/rh/candidate-portal/broadcasts?listId=${encodeURIComponent(
        list.id
      )}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    if (response.ok) {
      if (activeListId === list.id) {
        setActiveListId("");
        setSelectedIds([]);
      }
      await bootstrap();
    }
  }

  function loadList(list: SavedList) {
    setActiveListId(list.id);
    setListName(list.name);
    setSelectedIds(list.profile_ids || []);
  }

  async function send() {
    if (!message.trim() || !selectedIds.length) {
      alert("Digite a mensagem e selecione candidatos.");
      return;
    }

    if (
      !confirm(
        `Enviar mensagem individual para ${selectedIds.length} candidato(s)? Quem tiver Push ativo receberá também a notificação.`
      )
    ) {
      return;
    }

    try {
      setSending(true);
      setResult(null);

      const response = await fetch(
        "/api/rh/candidate-portal/broadcasts",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "send",
            listId: activeListId || undefined,
            profileIds: activeListId ? undefined : selectedIds,
            message: message.trim(),
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(data.error || "Erro ao enviar transmissão.");
        return;
      }

      setResult(data.result || null);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="cpb-root">
      <div className="cpb-layout">
        <aside className="cpb-lists">
          <span className="eyebrow">SEGMENTAÇÃO SALVA</span>
          <h3>📣 Listas</h3>

          <input
            value={listName}
            onChange={(event) => setListName(event.target.value)}
            placeholder="Ex: Administrativo SP"
          />

          <button
            className="primary"
            disabled={!selectedIds.length}
            onClick={() => void createList()}
          >
            + Criar lista ({selectedIds.length})
          </button>

          {activeListId && (
            <button
              className="secondary"
              onClick={() => void updateList()}
            >
              Atualizar lista atual
            </button>
          )}

          <div className="saved">
            {lists.map((list) => (
              <div
                key={list.id}
                className={`saved-row ${
                  activeListId === list.id ? "active" : ""
                }`}
              >
                <button onClick={() => loadList(list)}>
                  <b>{list.name}</b>
                  <span>{list.member_count} candidatos</span>
                </button>
                <button
                  className="delete"
                  onClick={() => void deleteList(list)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </aside>

        <div className="cpb-workspace">
          <section className="cpb-card">
            <div className="head">
              <div>
                <span className="eyebrow">BANCO DO PORTAL</span>
                <h3>Selecione quem vai receber</h3>
              </div>
              <div className="head-actions">
                <button
                  className="green"
                  onClick={selectPushActive}
                >
                  🔔 Selecionar Push ativo
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    setQ("");
                    setPush("all");
                    setPortal("active");
                    setCity("");
                    setEducation("");
                    setRole("");
                    setOrigin("");
                  }}
                >
                  Limpar filtros
                </button>
              </div>
            </div>

            <div className="filters">
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Nome, CPF, celular, e-mail..."
              />

              <select
                value={push}
                onChange={(event) => setPush(event.target.value)}
              >
                <option value="all">Todos os Push</option>
                <option value="active">🔔 Push ativo</option>
                <option value="inactive">Sem Push</option>
              </select>

              <select
                value={portal}
                onChange={(event) => setPortal(event.target.value)}
              >
                <option value="all">Todos os Portais</option>
                <option value="active">Portal ativo</option>
                <option value="inactive">Portal não ativo</option>
              </select>

              <select
                value={city}
                onChange={(event) => setCity(event.target.value)}
              >
                <option value="">Todas as cidades</option>
                {(filters.cities || []).map((item: string) => (
                  <option key={item}>{item}</option>
                ))}
              </select>

              <select
                value={education}
                onChange={(event) =>
                  setEducation(event.target.value)
                }
              >
                <option value="">Todas escolaridades</option>
                {(filters.education || []).map((item: string) => (
                  <option key={item}>{item}</option>
                ))}
              </select>

              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                <option value="">Todos os cargos</option>
                {(filters.roles || []).map((item: string) => (
                  <option key={item}>{item}</option>
                ))}
              </select>

              <select
                value={origin}
                onChange={(event) => setOrigin(event.target.value)}
              >
                <option value="">Todas origens</option>
                {(filters.origins || []).map((item: string) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>

            <div className="selection">
              <button className="secondary" onClick={toggleAll}>
                Selecionar todos do filtro ({profiles.length})
              </button>
              <b>{selectedIds.length} selecionados</b>
              {selectedIds.length > 0 && (
                <button
                  className="link"
                  onClick={() => {
                    setSelectedIds([]);
                    setActiveListId("");
                  }}
                >
                  Limpar seleção
                </button>
              )}
            </div>
          </section>

          <section className="cpb-list">
            {loading ? (
              <div className="empty">Carregando candidatos...</div>
            ) : (
              profiles.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`candidate ${
                    selected.has(item.id) ? "selected" : ""
                  }`}
                  onClick={() => toggle(item.id)}
                >
                  <span className="check">
                    {selected.has(item.id) ? "✓" : ""}
                  </span>
                  <span className="copy">
                    <b>{item.full_name}</b>
                    <small>
                      {item.city
                        ? `${item.city}${item.state ? `/${item.state}` : ""}`
                        : "Cidade não informada"}
                      {item.last_role
                        ? ` · ${item.last_role}`
                        : ""}
                    </small>
                  </span>
                  <span className="flags">
                    <em className={item.portal_status === "ACTIVE" ? "good" : "muted"}>
                      {item.portal_status === "ACTIVE"
                        ? "✓ Portal"
                        : "Portal pendente"}
                    </em>
                    <em className={item.push_active ? "push" : "muted"}>
                      {item.push_active ? "🔔 Push" : "Sem Push"}
                    </em>
                  </span>
                </button>
              ))
            )}
          </section>

          <section className="cpb-card composer">
            <div className="head">
              <div>
                <span className="eyebrow">TRANSMISSÃO PRIVADA</span>
                <h3>Mensagem individual no Chat + Push</h3>
              </div>
              <strong className="count">
                {selectedIds.length} candidatos
              </strong>
            </div>

            <textarea
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ex: Olá! Temos uma nova oportunidade compatível com seu perfil. Acesse o Portal MOTIVAR para conferir."
            />

            <div className="send-row">
              <p>
                Cada candidato recebe uma conversa individual. Quem tiver
                Push ativo também recebe a notificação no celular.
              </p>
              <button
                className="send"
                disabled={
                  sending ||
                  !message.trim() ||
                  !selectedIds.length
                }
                onClick={() => void send()}
              >
                {sending
                  ? "Enviando..."
                  : `📣 Enviar para ${selectedIds.length}`}
              </button>
            </div>

            {result && (
              <div className="results">
                <Result label="Selecionados" value={result.selected} />
                <Result label="Mensagens" value={result.message_delivered} good />
                <Result label="Push enviados" value={result.push_sent} good />
                <Result label="Sem Push" value={result.without_push} />
                <Result label="Sem Portal" value={result.without_portal} warn />
                <Result label="Falhas Push" value={result.push_failed} warn />
              </div>
            )}
          </section>
        </div>
      </div>

      <style jsx>{`
        .cpb-root {
          color: #182230;
        }

        .cpb-layout {
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr);
          gap: 12px;
        }

        .cpb-lists,
        .cpb-card,
        .cpb-list {
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          background: #fff;
          box-shadow: 0 12px 34px rgba(15, 23, 42, 0.05);
        }

        .cpb-lists {
          align-self: start;
          position: sticky;
          top: 16px;
          padding: 14px;
        }

        .cpb-lists h3,
        .head h3 {
          margin: 4px 0 10px;
        }

        .eyebrow {
          color: #15803d;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.12em;
        }

        input,
        select,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dfe4ea;
          border-radius: 11px;
          background: #fff;
          color: #182230;
          outline: none;
          font: inherit;
          font-size: 11px;
        }

        input,
        select {
          height: 40px;
          padding: 0 10px;
        }

        textarea {
          resize: vertical;
          padding: 11px;
        }

        button {
          font: inherit;
        }

        .primary,
        .secondary,
        .green,
        .send {
          min-height: 38px;
          border-radius: 10px;
          padding: 0 11px;
          cursor: pointer;
          font-size: 10px;
          font-weight: 900;
        }

        .primary,
        .send {
          border: 1px solid #15803d;
          background: #15803d;
          color: #fff;
        }

        .secondary {
          border: 1px solid #dfe4ea;
          background: #fff;
          color: #344054;
        }

        .green {
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
          color: #166534;
        }

        .cpb-lists > input {
          margin-top: 5px;
        }

        .cpb-lists > button {
          width: 100%;
          margin-top: 7px;
        }

        .saved {
          display: grid;
          gap: 6px;
          margin-top: 12px;
          max-height: 420px;
          overflow-y: auto;
        }

        .saved-row {
          display: grid;
          grid-template-columns: 1fr 28px;
          overflow: hidden;
          border: 1px solid #e5e7eb;
          border-radius: 11px;
        }

        .saved-row.active {
          border-color: #22c55e;
          background: #f0fdf4;
        }

        .saved-row > button:first-child {
          display: grid;
          gap: 2px;
          padding: 8px;
          border: 0;
          background: transparent;
          text-align: left;
          cursor: pointer;
        }

        .saved-row b {
          font-size: 10px;
        }

        .saved-row span {
          color: #667085;
          font-size: 8px;
        }

        .delete {
          border: 0;
          background: transparent;
          color: #98a2b3;
          cursor: pointer;
          font-size: 17px;
        }

        .cpb-workspace {
          min-width: 0;
          display: grid;
          gap: 10px;
        }

        .cpb-card {
          padding: 14px;
        }

        .head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .head-actions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .filters {
          display: grid;
          grid-template-columns: 1.7fr repeat(6, minmax(100px, 1fr));
          gap: 7px;
          margin-top: 10px;
        }

        .selection {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #eef2f6;
          font-size: 10px;
        }

        .selection b {
          color: #15803d;
        }

        .link {
          border: 0;
          background: transparent;
          color: #dc2626;
          cursor: pointer;
          font-size: 9px;
          font-weight: 900;
        }

        .cpb-list {
          max-height: 440px;
          overflow-y: auto;
          padding: 7px;
        }

        .candidate {
          width: 100%;
          display: grid;
          grid-template-columns: 26px 1fr auto;
          align-items: center;
          gap: 8px;
          padding: 9px;
          border: 0;
          border-bottom: 1px solid #f1f5f9;
          background: #fff;
          text-align: left;
          cursor: pointer;
        }

        .candidate.selected {
          background: #f0fdf4;
        }

        .check {
          width: 20px;
          height: 20px;
          display: grid;
          place-items: center;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          color: #fff;
          background: #fff;
        }

        .selected .check {
          border-color: #15803d;
          background: #15803d;
        }

        .copy {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .copy b,
        .copy small {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .copy b {
          font-size: 11px;
        }

        .copy small {
          color: #667085;
          font-size: 9px;
        }

        .flags {
          display: flex;
          gap: 5px;
        }

        .flags em {
          padding: 4px 6px;
          border-radius: 999px;
          font-size: 8px;
          font-style: normal;
          font-weight: 900;
        }

        .good {
          color: #166534;
          background: #dcfce7;
        }

        .push {
          color: #1d4ed8;
          background: #dbeafe;
        }

        .muted {
          color: #667085;
          background: #f2f4f7;
        }

        .composer {
          border-color: #bbf7d0;
        }

        .count {
          padding: 6px 9px;
          border-radius: 999px;
          color: #166534;
          background: #dcfce7;
          font-size: 10px;
        }

        .composer textarea {
          margin-top: 8px;
        }

        .send-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 10px;
          margin-top: 8px;
        }

        .send-row p {
          margin: 0;
          max-width: 650px;
          color: #667085;
          font-size: 10px;
        }

        .send {
          min-width: 170px;
          min-height: 42px;
        }

        .results {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 6px;
          margin-top: 10px;
        }

        .empty {
          padding: 24px;
          text-align: center;
          color: #98a2b3;
          font-size: 10px;
        }

        @media (max-width: 1200px) {
          .filters {
            grid-template-columns: repeat(3, 1fr);
          }

          .results {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 900px) {
          .cpb-layout {
            grid-template-columns: 1fr;
          }

          .cpb-lists {
            position: static;
          }
        }

        @media (max-width: 650px) {
          .filters {
            grid-template-columns: 1fr 1fr;
          }

          .candidate {
            grid-template-columns: 26px 1fr;
          }

          .flags {
            grid-column: 2;
            justify-content: flex-start;
          }

          .send-row {
            align-items: stretch;
            flex-direction: column;
          }

          .send {
            width: 100%;
          }

          .results {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </section>
  );
}

function Result({
  label,
  value,
  good = false,
  warn = false,
}: {
  label: string;
  value: number;
  good?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      style={{
        padding: 9,
        border: "1px solid #e5e7eb",
        borderRadius: 11,
        background: "#f8fafc",
      }}
    >
      <small style={{ color: "#667085", fontSize: 8 }}>{label}</small>
      <strong
        style={{
          display: "block",
          marginTop: 3,
          color: good ? "#15803d" : warn ? "#d97706" : "#101828",
          fontSize: 18,
        }}
      >
        {value}
      </strong>
    </div>
  );
}
