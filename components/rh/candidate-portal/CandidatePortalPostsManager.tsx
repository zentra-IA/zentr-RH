"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FormEvent } from "react";

type AudienceMode = "ALL_PORTAL" | "PUSH_ACTIVE" | "SELECTED";
type ContentType = "VAGA" | "PROCESSO" | "ENTREVISTA" | "NOVIDADE";

type AudienceList = {
  id: string;
  name: string;
  description?: string | null;
  member_count: number;
  profile_ids: string[];
};

type PortalProfile = {
  id: string;
  full_name: string;
  portal_status?: string | null;
  push_active?: boolean;
};

type PostItem = {
  id: string;
  title: string;
  body: string;
  audience_mode: string;
  content_type?: ContentType | null;
  expires_at?: string | null;
  campaign_id?: string | null;
  push_sent_count?: number;
  push_failed_count?: number;
  media_path?: string | null;
  media_mime?: string | null;
  media_original_name?: string | null;
  recipient_count: number;
  viewed_count: number;
  published_at: string;
  updated_at?: string | null;
};

type Toast = {
  type: "success" | "error";
  message: string;
};

type ReportRow = {
  profile_id: string;
  full_name: string;
  cpf_normalized?: string | null;
  phone_normalized?: string | null;
  email_normalized?: string | null;
  recipient_created_at?: string | null;
  viewed_at?: string | null;
  push_active?: boolean;
  push_sent?: boolean;
  push_clicked?: boolean;
  push_opened?: boolean;
  push_failed?: boolean;
  push_sent_at?: string | null;
  push_clicked_at?: string | null;
  push_opened_at?: string | null;
  push_failed_at?: string | null;
  error_message?: string | null;
};

const AUDIENCE_LABELS: Record<string, string> = {
  ALL_PORTAL: "Todos os Portais",
  PUSH_ACTIVE: "Somente Push ativo",
  SELECTED: "Lista personalizada",
};

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  VAGA: "💼 Vaga",
  PROCESSO: "🎯 Processo",
  ENTREVISTA: "📅 Entrevista",
  NOVIDADE: "📰 Novidade",
};

function when(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function truncate(value: string, max = 130) {
  if (value.length <= max) return value;
  return `${value.slice(0, max).trim()}…`;
}

export default function CandidatePortalPostsManager() {
  const formRef = useRef<HTMLFormElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [lists, setLists] = useState<AudienceList[]>([]);
  const [profiles, setProfiles] = useState<PortalProfile[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingAudience, setLoadingAudience] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [contentType, setContentType] = useState<ContentType>("NOVIDADE");
  const [expiresAt, setExpiresAt] = useState("");
  const [audienceMode, setAudienceMode] =
    useState<AudienceMode>("ALL_PORTAL");
  const [audienceListId, setAudienceListId] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");

  const [historyQuery, setHistoryQuery] = useState("");
  const [historyAudience, setHistoryAudience] = useState("");
  const [historyType, setHistoryType] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);

  const [reportPost, setReportPost] = useState<PostItem | null>(null);
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportQuery, setReportQuery] = useState("");
  const [reportFilter, setReportFilter] = useState<
    "all" | "viewed" | "not_viewed" | "push_sent" | "failed"
  >("all");

  useEffect(() => {
    void Promise.all([loadPosts(), loadAudience()]);
  }, []);

  useEffect(() => {
    if (!imageFile) {
      setPreview("");
      return;
    }

    const url = URL.createObjectURL(imageFile);
    setPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  function notify(type: Toast["type"], message: string) {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 4200);
  }

  async function loadPosts() {
    try {
      setLoading(true);

      const response = await fetch(
        "/api/rh/candidate-portal/posts",
        {
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || "Erro ao carregar publicações."
        );
      }

      setPosts(data.posts || []);
    } catch (error: any) {
      notify(
        "error",
        error?.message || "Erro ao carregar publicações."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadAudience() {
    try {
      setLoadingAudience(true);

      const [bootstrapResponse, profilesResponse] = await Promise.all([
        fetch(
          "/api/rh/candidate-portal/broadcasts?mode=bootstrap",
          {
            credentials: "include",
            cache: "no-store",
          }
        ),
        fetch("/api/rh/candidate-portal/broadcasts", {
          credentials: "include",
          cache: "no-store",
        }),
      ]);

      const bootstrap = await bootstrapResponse
        .json()
        .catch(() => ({}));
      const profileData = await profilesResponse
        .json()
        .catch(() => ({}));

      if (!bootstrapResponse.ok) {
        throw new Error(
          bootstrap.error || "Erro ao carregar listas."
        );
      }

      if (!profilesResponse.ok) {
        throw new Error(
          profileData.error || "Erro ao carregar candidatos."
        );
      }

      setLists(Array.isArray(bootstrap.lists) ? bootstrap.lists : []);
      setProfiles(
        Array.isArray(profileData.profiles)
          ? profileData.profiles
          : []
      );
    } catch (error: any) {
      notify(
        "error",
        error?.message || "Erro ao carregar o público."
      );
    } finally {
      setLoadingAudience(false);
    }
  }

  const selectedList = useMemo(
    () => lists.find((item) => item.id === audienceListId) || null,
    [lists, audienceListId]
  );

  const portalActiveCount = useMemo(
    () =>
      profiles.filter(
        (profile) => profile.portal_status === "ACTIVE"
      ).length,
    [profiles]
  );

  const pushActiveCount = useMemo(
    () => profiles.filter((profile) => profile.push_active).length,
    [profiles]
  );

  const selectedAudienceCount = useMemo(() => {
    if (audienceMode === "PUSH_ACTIVE") {
      return pushActiveCount;
    }

    if (audienceMode === "SELECTED") {
      return Number(selectedList?.member_count || 0);
    }

    return portalActiveCount;
  }, [
    audienceMode,
    portalActiveCount,
    pushActiveCount,
    selectedList,
  ]);

  const filteredPosts = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();

    return posts.filter((post) => {
      if (
        historyAudience &&
        post.audience_mode !== historyAudience
      ) {
        return false;
      }

      if (
        historyType &&
        (post.content_type || "NOVIDADE") !== historyType
      ) {
        return false;
      }

      if (!q) return true;

      return `${post.title} ${post.body}`
        .toLowerCase()
        .includes(q);
    });
  }, [posts, historyQuery, historyAudience, historyType]);

  const totalRecipients = useMemo(
    () =>
      posts.reduce(
        (sum, item) => sum + Number(item.recipient_count || 0),
        0
      ),
    [posts]
  );

  const totalViewed = useMemo(
    () =>
      posts.reduce(
        (sum, item) => sum + Number(item.viewed_count || 0),
        0
      ),
    [posts]
  );

  function resetForm() {
    setTitle("");
    setBody("");
    setContentType("NOVIDADE");
    setExpiresAt("");
    setAudienceMode("ALL_PORTAL");
    setAudienceListId("");
    setImageFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function startNewPost() {
    resetForm();

    window.setTimeout(() => {
      formRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 40);
  }

  async function publish(event: FormEvent) {
    event.preventDefault();

    if (!title.trim() || !body.trim()) {
      notify(
        "error",
        "Informe o título e o texto da publicação."
      );
      return;
    }

    if (!expiresAt) {
      notify(
        "error",
        "Informe até que dia a publicação ficará visível no Portal."
      );
      return;
    }

    if (
      audienceMode === "SELECTED" &&
      !selectedList?.profile_ids?.length
    ) {
      notify(
        "error",
        "Selecione uma lista com pelo menos um candidato."
      );
      return;
    }

    if (!selectedAudienceCount) {
      notify(
        "error",
        "O público escolhido não possui candidatos disponíveis."
      );
      return;
    }

    const confirmed = window.confirm(
      `Publicar "${title.trim()}" como ${CONTENT_TYPE_LABELS[contentType]} para ${selectedAudienceCount} candidato(s)?\n\nFicará no Portal até ${new Date(`${expiresAt}T23:59:59`).toLocaleDateString("pt-BR")} e quem tiver Push ativo receberá a notificação.`
    );

    if (!confirmed) return;

    try {
      setPublishing(true);

      const form = new FormData();
      form.append("title", title.trim());
      form.append("body", body.trim());
      form.append("contentType", contentType);
      form.append("expiresAt", expiresAt);
      form.append("audienceMode", audienceMode);

      if (
        audienceMode === "SELECTED" &&
        selectedList?.profile_ids
      ) {
        form.append(
          "selectedProfileIds",
          JSON.stringify(selectedList.profile_ids)
        );
      }

      if (imageFile) {
        form.append("image", imageFile);
      }

      const response = await fetch(
        "/api/rh/candidate-portal/posts",
        {
          method: "POST",
          credentials: "include",
          body: form,
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Erro ao publicar.");
      }

      notify(
        "success",
        `Publicação criada para ${
          data.recipients || 0
        } candidato(s). Push enviado agora para ${
          data.processing?.sent || 0
        }.`
      );

      resetForm();
      await loadPosts();
    } catch (error: any) {
      notify("error", error?.message || "Erro ao publicar.");
    } finally {
      setPublishing(false);
    }
  }


  async function openReport(post: PostItem) {
    try {
      setReportPost(post);
      setReportRows([]);
      setReportQuery("");
      setReportFilter("all");
      setReportLoading(true);

      const response = await fetch(
        `/api/rh/candidate-portal/posts?reportPostId=${encodeURIComponent(post.id)}`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || "Erro ao carregar relatório da publicação."
        );
      }

      setReportRows(Array.isArray(data.report) ? data.report : []);
    } catch (error: any) {
      notify(
        "error",
        error?.message || "Erro ao carregar relatório."
      );
      setReportPost(null);
    } finally {
      setReportLoading(false);
    }
  }

  const filteredReportRows = useMemo(() => {
    const q = reportQuery.trim().toLowerCase();

    return reportRows.filter((row) => {
      const filterOk =
        reportFilter === "all" ||
        (reportFilter === "viewed" && Boolean(row.viewed_at)) ||
        (reportFilter === "not_viewed" && !row.viewed_at) ||
        (reportFilter === "push_sent" && Boolean(row.push_sent)) ||
        (reportFilter === "failed" && Boolean(row.push_failed));

      if (!filterOk) return false;
      if (!q) return true;

      return [
        row.full_name,
        row.cpf_normalized,
        row.phone_normalized,
        row.email_normalized,
        row.error_message,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [reportRows, reportQuery, reportFilter]);

  const reportMetrics = useMemo(() => {
    return {
      total: reportRows.length,
      pushSent: reportRows.filter((row) => row.push_sent).length,
      viewed: reportRows.filter((row) => row.viewed_at).length,
      notViewed: reportRows.filter((row) => !row.viewed_at).length,
      failed: reportRows.filter((row) => row.push_failed).length,
    };
  }, [reportRows]);

  return (
    <main className="page-shell">
      {toast && (
        <div className={`toast toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}

      <header className="page-header">
        <div>
          <p className="overline">
            MOTIVAR RH · PORTAL DO CANDIDATO
          </p>
          <h1>Publicações</h1>
          <div className="version-badge">V5.1 · Tipo + validade + relatório</div>
          <p className="subtitle">
            Crie comunicados profissionais para o Portal, escolha o
            público, visualize a publicação antes de enviar e acompanhe
            alcance e visualizações.
          </p>

          <div className="feature-pills">
            <span>📣 Portal + Push</span>
            <span>🎯 Listas personalizadas</span>
            <span>🖼️ Imagem da publicação</span>
            <span>📊 Histórico e métricas</span>
            <span>✅ Relatório completo por candidato</span>
          </div>
        </div>

        <button
          className="button button-primary"
          type="button"
          onClick={startNewPost}
        >
          Nova publicação
        </button>
      </header>

      <form
        ref={formRef}
        className="workspace"
        onSubmit={(event) => void publish(event)}
      >
        <div className="editor-column">
          <section className="section-card">
            <div className="section-title-row">
              <div>
                <p className="section-kicker">NOVA PUBLICAÇÃO</p>
                <h2>Configurar comunicação</h2>
              </div>
            </div>

            <div className="section-block audience-block">
              <div className="block-heading">
                <h3>Público</h3>
                <p>
                  Escolha quem verá a publicação. Quem tiver Push ativo
                  também recebe a notificação no celular.
                </p>
              </div>

              <div className="mode-selector">
                <button
                  type="button"
                  className={
                    audienceMode === "ALL_PORTAL" ? "active" : ""
                  }
                  onClick={() => {
                    setAudienceMode("ALL_PORTAL");
                    setAudienceListId("");
                  }}
                >
                  <strong>Todos os Portais</strong>
                  <span>
                    Todos os candidatos com acesso ativo ao Portal MOTIVAR.
                  </span>
                  <b>{portalActiveCount}</b>
                </button>

                <button
                  type="button"
                  className={
                    audienceMode === "PUSH_ACTIVE" ? "active" : ""
                  }
                  onClick={() => {
                    setAudienceMode("PUSH_ACTIVE");
                    setAudienceListId("");
                  }}
                >
                  <strong>Somente Push ativo</strong>
                  <span>
                    Comunica apenas candidatos que já autorizaram Push.
                  </span>
                  <b>{pushActiveCount}</b>
                </button>

                <button
                  type="button"
                  className={
                    audienceMode === "SELECTED" ? "active" : ""
                  }
                  onClick={() => setAudienceMode("SELECTED")}
                >
                  <strong>Lista personalizada</strong>
                  <span>
                    Reaproveite uma lista salva na Central de Comunicação.
                  </span>
                  <b>{selectedList?.member_count || 0}</b>
                </button>
              </div>

              {audienceMode === "SELECTED" && (
                <div className="campaign-area">
                  <label>
                    <span>Lista de candidatos</span>
                    <select
                      value={audienceListId}
                      disabled={loadingAudience}
                      onChange={(event) =>
                        setAudienceListId(event.target.value)
                      }
                    >
                      <option value="">
                        {loadingAudience
                          ? "Carregando listas..."
                          : "Selecione uma lista"}
                      </option>

                      {lists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.name} · {list.member_count} candidato(s)
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="campaign-help">
                    <div>
                      <strong>
                        {selectedList?.name ||
                          "Nenhuma lista selecionada"}
                      </strong>
                      <span>
                        {selectedList?.description ||
                          "As listas podem ser criadas na aba Transmissões da Central de Comunicação."}
                      </span>
                    </div>

                    <a href="/crm/dashboard/candidate-portal/comunicacao">
                      Gerenciar listas
                    </a>
                  </div>
                </div>
              )}

              <div className="audience-summary-row">
                <div>
                  <strong>{portalActiveCount}</strong>
                  <span>Portal ativo</span>
                </div>
                <div>
                  <strong>{pushActiveCount}</strong>
                  <span>Push ativo</span>
                </div>
                <div className="selected">
                  <strong>{selectedAudienceCount}</strong>
                  <span>No público atual</span>
                </div>
              </div>
            </div>

            <div className="section-block classification-block">
              <div className="block-heading">
                <h3>Tipo e validade</h3>
                <p>
                  Classifique a publicação e defina até qual dia ela ficará visível no Portal.
                </p>
              </div>

              <div className="content-type-grid">
                {(Object.entries(CONTENT_TYPE_LABELS) as Array<
                  [ContentType, string]
                >).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={contentType === value ? "active" : ""}
                    onClick={() => setContentType(value)}
                  >
                    <strong>{label}</strong>
                    <span>
                      {value === "VAGA"
                        ? "Oportunidade de trabalho"
                        : value === "PROCESSO"
                          ? "Atualização de processo seletivo"
                          : value === "ENTREVISTA"
                            ? "Aviso ou orientação de entrevista"
                            : "Comunicado geral da MOTIVAR RH"}
                    </span>
                  </button>
                ))}
              </div>

              <label className="expiry-field">
                <span>Exibir no Portal até</span>
                <input
                  type="date"
                  value={expiresAt}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
                <small>
                  Depois dessa data a publicação deixa de aparecer automaticamente para o candidato.
                </small>
              </label>
            </div>

            <div className="section-block content-block">
              <div className="block-heading">
                <h3>Conteúdo</h3>
                <p>
                  O mesmo conteúdo aparece no Portal e gera a
                  notificação Push para os candidatos elegíveis.
                </p>
              </div>

              <label>
                <span>Título público</span>
                <input
                  value={title}
                  onChange={(event) =>
                    setTitle(event.target.value)
                  }
                  maxLength={120}
                  placeholder="Ex: Novas oportunidades administrativas"
                />
              </label>

              <label>
                <span>Texto do Portal</span>
                <textarea
                  value={body}
                  onChange={(event) =>
                    setBody(event.target.value)
                  }
                  maxLength={5000}
                  placeholder="Escreva a mensagem que o candidato verá ao abrir a publicação..."
                />
              </label>

              <div className="push-copy">
                <span>PRÉVIA DO PUSH</span>
                <strong>
                  {title.trim() || "MOTIVAR RH"}
                </strong>
                <p>
                  {truncate(
                    body.trim() ||
                      "A mensagem da notificação aparecerá aqui.",
                    160
                  )}
                </p>
              </div>
            </div>

            <div className="section-block image-block">
              <div className="block-heading">
                <h3>Imagem principal</h3>
                <p>
                  A arte aparece dentro do Portal. Formatos aceitos:
                  JPG, PNG ou WEBP, até 10 MB.
                </p>
              </div>

              <input
                ref={fileInputRef}
                hidden
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                onChange={(event) =>
                  setImageFile(event.target.files?.[0] || null)
                }
              />

              <button
                className="upload-box"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                <strong>
                  {imageFile
                    ? imageFile.name
                    : "Selecionar imagem"}
                </strong>
                <span>
                  {imageFile
                    ? "Clique para trocar a imagem"
                    : "JPG, PNG ou WEBP"}
                </span>
              </button>

              {imageFile && (
                <button
                  className="remove-image"
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                >
                  Remover imagem
                </button>
              )}
            </div>
          </section>
        </div>

        <aside className="preview-column">
          <section className="section-card sticky-preview">
            <div className="block-heading">
              <h3>Pré-visualização</h3>
              <p>
                Veja como a comunicação ficará antes de publicar.
              </p>
            </div>

            <div className="push-preview">
              <div className="push-brand">
                <div>M</div>
                <span>MOTIVAR RH</span>
              </div>
              <strong>
                {title.trim() || "Título da publicação"}
              </strong>
              <p>
                {truncate(
                  body.trim() ||
                    "A mensagem do Push aparecerá aqui.",
                  145
                )}
              </p>
            </div>

            <div className="portal-preview">
              <div className="portal-image">
                {preview ? (
                  <img src={preview} alt="" />
                ) : (
                  <div>
                    <span>📰</span>
                    <small>Imagem da publicação</small>
                  </div>
                )}
              </div>

              <div className="portal-content">
                <small>
                  MOTIVAR RH · {CONTENT_TYPE_LABELS[contentType].replace(/^[^ ]+ /, "")}
                  {expiresAt
                    ? ` · ATÉ ${new Date(`${expiresAt}T23:59:59`).toLocaleDateString("pt-BR")}`
                    : ""}
                </small>
                <h4>
                  {title.trim() || "Título da publicação"}
                </h4>
                <p>
                  {body.trim() ||
                    "O conteúdo que o candidato verá no Portal aparecerá aqui."}
                </p>

                <button type="button">
                  Abrir no Portal
                </button>
              </div>
            </div>

            <div className="preview-meta-grid">
              <div>
                <small>TIPO</small>
                <strong>{CONTENT_TYPE_LABELS[contentType]}</strong>
              </div>
              <div>
                <small>NO PORTAL ATÉ</small>
                <strong>
                  {expiresAt
                    ? new Date(`${expiresAt}T23:59:59`).toLocaleDateString("pt-BR")
                    : "Defina a data"}
                </strong>
              </div>
            </div>

            <div className="preview-audience">
              <small>PÚBLICO</small>
              <strong>
                {audienceMode === "SELECTED"
                  ? selectedList?.name ||
                    "Lista não selecionada"
                  : AUDIENCE_LABELS[audienceMode]}
              </strong>
              <span>
                {selectedAudienceCount} candidato(s)
              </span>
            </div>

            <button
              className="button button-primary publish-button"
              type="submit"
              disabled={publishing}
            >
              {publishing
                ? "Publicando..."
                : "Publicar no Portal + enviar Push"}
            </button>
          </section>
        </aside>
      </form>

      <section className="history-section">
        <div className="history-header">
          <div>
            <p className="overline">HISTÓRICO</p>
            <h2>Publicações enviadas</h2>
            <p>
              Consulte alcance e visualizações das comunicações já
              distribuídas.
            </p>
          </div>

          <div className="filters">
            <input
              value={historyQuery}
              onChange={(event) =>
                setHistoryQuery(event.target.value)
              }
              placeholder="Buscar publicação..."
            />

            <select
              value={historyAudience}
              onChange={(event) =>
                setHistoryAudience(event.target.value)
              }
            >
              <option value="">Todos os públicos</option>
              <option value="ALL_PORTAL">
                Todos os Portais
              </option>
              <option value="PUSH_ACTIVE">
                Push ativo
              </option>
              <option value="SELECTED">
                Lista personalizada
              </option>
            </select>

            <select
              value={historyType}
              onChange={(event) =>
                setHistoryType(event.target.value)
              }
            >
              <option value="">Todos os tipos</option>
              <option value="VAGA">Vaga</option>
              <option value="PROCESSO">Processo</option>
              <option value="ENTREVISTA">Entrevista</option>
              <option value="NOVIDADE">Novidade</option>
            </select>

            <button
              className="button button-secondary"
              type="button"
              onClick={() => void loadPosts()}
            >
              Atualizar
            </button>
          </div>
        </div>

        <div className="history-metrics">
          <div>
            <b>{posts.length}</b>
            <span>Publicações</span>
          </div>
          <div>
            <b>{totalRecipients}</b>
            <span>Alcances</span>
          </div>
          <div>
            <b>{totalViewed}</b>
            <span>Visualizações</span>
          </div>
          <div>
            <b>
              {totalRecipients
                ? Math.round(
                    (totalViewed / totalRecipients) * 100
                  )
                : 0}
              %
            </b>
            <span>Taxa de visualização</span>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            Carregando publicações...
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="empty-state">
            Nenhuma publicação encontrada.
          </div>
        ) : (
          <div className="publication-table-wrap">
            <table className="publication-table">
              <thead>
                <tr>
                  <th>Publicação</th>
                  <th>Tipo</th>
                  <th>Público</th>
                  <th>Alcance</th>
                  <th>Visualizações</th>
                  <th>No Portal até</th>
                  <th>Relatório</th>
                </tr>
              </thead>

              <tbody>
                {filteredPosts.map((post) => {
                  const notViewed = Math.max(
                    Number(post.recipient_count || 0) -
                      Number(post.viewed_count || 0),
                    0
                  );

                  return (
                    <tr key={post.id}>
                      <td>
                        <div className="publication-cell">
                          <div className="table-thumb">
                            {post.media_path ? (
                              <img
                                src={`/api/rh/candidate-portal/posts/${post.id}/media`}
                                alt=""
                              />
                            ) : (
                              <span>📰</span>
                            )}
                          </div>
                          <div>
                            <strong>{post.title}</strong>
                            <small>
                              {truncate(post.body, 90)}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className={`type-badge type-${(post.content_type || "NOVIDADE").toLowerCase()}`}>
                          {CONTENT_TYPE_LABELS[
                            (post.content_type || "NOVIDADE") as ContentType
                          ]}
                        </span>
                      </td>

                      <td>
                        <span className="audience-badge">
                          {AUDIENCE_LABELS[
                            post.audience_mode
                          ] || post.audience_mode}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {post.recipient_count || 0}
                        </strong>
                      </td>

                      <td>
                        <div className="view-summary">
                          <strong>
                            {post.viewed_count || 0}
                          </strong>
                          <small>
                            {notViewed} ainda não visualizaram
                          </small>
                        </div>
                      </td>

                      <td>
                        <div className="expiry-summary">
                          <strong>{when(post.expires_at)}</strong>
                          <small>
                            Publicada em {when(post.published_at)}
                          </small>
                        </div>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="report-button"
                          onClick={() => void openReport(post)}
                        >
                          Ver relatório
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {reportPost && (
        <div
          className="report-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setReportPost(null);
            }
          }}
        >
          <section className="report-modal" role="dialog" aria-modal="true">
            <header className="report-header">
              <div>
                <p className="overline">RELATÓRIO DA PUBLICAÇÃO</p>
                <h2>{reportPost.title}</h2>
                <span>
                  {CONTENT_TYPE_LABELS[
                    (reportPost.content_type || "NOVIDADE") as ContentType
                  ]} · no Portal até {when(reportPost.expires_at)}
                </span>
              </div>

              <button
                type="button"
                className="report-close"
                onClick={() => setReportPost(null)}
              >
                ×
              </button>
            </header>

            <div className="report-metrics">
              <div>
                <span>Entregas</span>
                <b>{reportMetrics.total}</b>
              </div>
              <div>
                <span>Push enviados</span>
                <b>{reportMetrics.pushSent}</b>
              </div>
              <div>
                <span>Visualizaram</span>
                <b>{reportMetrics.viewed}</b>
              </div>
              <div>
                <span>Não visualizaram</span>
                <b>{reportMetrics.notViewed}</b>
              </div>
              <div>
                <span>Falhas Push</span>
                <b>{reportMetrics.failed}</b>
              </div>
            </div>

            <div className="report-toolbar">
              <input
                value={reportQuery}
                onChange={(event) =>
                  setReportQuery(event.target.value)
                }
                placeholder="Buscar candidato, CPF, telefone ou e-mail..."
              />

              <div className="report-filters">
                {([
                  ["all", "Todos"],
                  ["viewed", "Visualizou"],
                  ["not_viewed", "Não visualizou"],
                  ["push_sent", "Push enviado"],
                  ["failed", "Falhou"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={reportFilter === value ? "active" : ""}
                    onClick={() => setReportFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="report-list">
              {reportLoading ? (
                <div className="empty-state">
                  Carregando relatório...
                </div>
              ) : filteredReportRows.length === 0 ? (
                <div className="empty-state">
                  Nenhum candidato encontrado neste filtro.
                </div>
              ) : (
                filteredReportRows.map((row) => (
                  <article key={row.profile_id} className="report-card">
                    <div className="report-card-head">
                      <div>
                        <strong>{row.full_name}</strong>
                        <small>
                          {row.cpf_normalized || "CPF não informado"} ·{" "}
                          {row.phone_normalized ||
                            row.email_normalized ||
                            "Contato não informado"}
                        </small>
                      </div>

                      <span
                        className={
                          row.push_failed
                            ? "status-failed"
                            : row.push_sent
                              ? "status-sent"
                              : "status-pending"
                        }
                      >
                        {row.push_failed
                          ? "FALHOU"
                          : row.push_sent
                            ? "ENVIADO"
                            : "SEM PUSH"}
                      </span>
                    </div>

                    <div className="report-flags">
                      <span className={row.push_sent ? "ok" : ""}>
                        {row.push_sent ? "✓" : "○"} Push
                      </span>
                      <span className={row.push_opened ? "ok" : ""}>
                        {row.push_opened ? "✓" : "○"} Abriu
                      </span>
                      <span className={row.viewed_at ? "ok" : ""}>
                        {row.viewed_at ? "✓" : "○"} Visualizou
                      </span>
                      <span className={row.push_clicked ? "ok" : ""}>
                        {row.push_clicked ? "✓" : "○"} Clicou
                      </span>
                    </div>

                    <div className="report-timeline">
                      {row.recipient_created_at && (
                        <span>
                          <b>Entrou no público:</b>{" "}
                          {when(row.recipient_created_at)}
                        </span>
                      )}
                      {row.push_sent_at && (
                        <span>
                          <b>Push enviado:</b>{" "}
                          {when(row.push_sent_at)}
                        </span>
                      )}
                      {row.push_clicked_at && (
                        <span>
                          <b>Clicou no Push:</b>{" "}
                          {when(row.push_clicked_at)}
                        </span>
                      )}
                      {row.push_opened_at && (
                        <span>
                          <b>Abriu:</b>{" "}
                          {when(row.push_opened_at)}
                        </span>
                      )}
                      {row.viewed_at && (
                        <span>
                          <b>Visualizou publicação:</b>{" "}
                          {when(row.viewed_at)}
                        </span>
                      )}
                      {row.error_message && (
                        <span className="report-error">
                          <b>Falha:</b> {row.error_message}
                        </span>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        .page-shell {
          --brand: #2563eb;
          --brand-dark: #1d4ed8;
          --brand-soft: #eff6ff;
          --teal: #0f766e;
          --teal-soft: #ecfdf5;
          --ink: #0f172a;
          --muted: #64748b;
          --line: #dbeafe;
          width: min(1520px, calc(100% - 28px));
          margin: 0 auto;
          padding: 22px 0 60px;
          color: var(--ink);
        }

        button,
        input,
        textarea,
        select {
          font: inherit;
        }

        .toast {
          position: fixed;
          z-index: 3000;
          right: 22px;
          top: 22px;
          max-width: min(430px, calc(100vw - 44px));
          border-radius: 14px;
          padding: 12px 15px;
          color: #fff;
          font-size: 12px;
          font-weight: 850;
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.2);
        }

        .toast-success {
          background: #047857;
        }

        .toast-error {
          background: #b91c1c;
        }

        .page-header,
        .section-card,
        .history-section {
          border: 1px solid var(--line);
          background: #fff;
          box-shadow: 0 18px 50px rgba(37, 99, 235, 0.06);
        }

        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 22px;
          border-radius: 25px;
          padding: 25px 28px;
          background:
            radial-gradient(circle at 90% 0%, rgba(45, 212, 191, 0.13), transparent 28%),
            linear-gradient(125deg, #eff6ff, #ffffff 55%, #ecfeff);
        }

        .page-header > div {
          max-width: 850px;
        }

        .page-header h1 {
          margin: 4px 0 7px;
          font-size: clamp(30px, 3vw, 42px);
          letter-spacing: -0.045em;
        }

        .overline,
        .section-kicker {
          margin: 0;
          color: var(--brand);
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.15em;
        }

        .version-badge {
          display: inline-flex;
          margin: 2px 0 7px;
          border: 1px solid #c4b5fd;
          border-radius: 999px;
          background: #f5f3ff;
          padding: 5px 9px;
          color: #6d28d9;
          font-size: 9px;
          font-weight: 950;
        }

        .subtitle,
        .history-header p {
          margin: 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.55;
        }

        .feature-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 14px;
        }

        .feature-pills span {
          border: 1px solid #dbeafe;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.86);
          padding: 6px 10px;
          color: #334155;
          font-size: 10px;
          font-weight: 850;
        }

        .button {
          min-height: 42px;
          border-radius: 12px;
          padding: 9px 15px;
          font-size: 11px;
          font-weight: 950;
          cursor: pointer;
        }

        .button-primary {
          border: 1px solid var(--brand-dark);
          background: linear-gradient(
            135deg,
            #3b82f6,
            #1d4ed8
          );
          color: #fff;
        }

        .button-secondary {
          border: 1px solid #cbd5e1;
          background: #fff;
          color: #334155;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .workspace {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 410px;
          gap: 20px;
          align-items: start;
          margin-top: 16px;
        }

        .section-card {
          border-radius: 22px;
          padding: 22px;
        }

        .section-title-row {
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 16px;
        }

        .section-title-row h2 {
          margin: 4px 0 0;
          font-size: 21px;
        }

        .section-block {
          margin-top: 16px;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 19px;
        }

        .audience-block {
          border-color: #bfdbfe;
          background: linear-gradient(
            180deg,
            #eff6ff,
            #fff 45%
          );
        }

        .content-block {
          border-color: #c7d2fe;
          background: linear-gradient(
            180deg,
            #f5f3ff,
            #fff 44%
          );
        }

        .image-block {
          border-color: #99f6e4;
          background: linear-gradient(
            180deg,
            #f0fdfa,
            #fff 44%
          );
        }

        .block-heading {
          margin-bottom: 14px;
        }

        .block-heading h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 950;
        }

        .block-heading p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 11px;
          line-height: 1.5;
        }

        .mode-selector {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 9px;
        }

        .mode-selector button {
          position: relative;
          display: grid;
          gap: 5px;
          min-height: 122px;
          border: 1px solid #dbeafe;
          border-radius: 16px;
          background: #fff;
          padding: 14px;
          text-align: left;
          color: #334155;
          cursor: pointer;
        }

        .mode-selector button.active {
          border-color: #2563eb;
          background: #eff6ff;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
        }

        .mode-selector strong {
          color: #0f172a;
          font-size: 11px;
        }

        .mode-selector span {
          color: #64748b;
          font-size: 9.5px;
          line-height: 1.45;
        }

        .mode-selector b {
          align-self: end;
          color: #2563eb;
          font-size: 19px;
        }

        .campaign-area {
          margin-top: 12px;
          border: 1px solid #dbeafe;
          border-radius: 15px;
          background: #f8fafc;
          padding: 13px;
        }

        label {
          display: grid;
          gap: 6px;
        }

        label > span {
          color: #334155;
          font-size: 10px;
          font-weight: 900;
        }

        input,
        textarea,
        select {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          background: #fff;
          padding: 10px 12px;
          color: #0f172a;
          outline: none;
        }

        input,
        select {
          min-height: 43px;
        }

        textarea {
          min-height: 145px;
          resize: vertical;
          line-height: 1.55;
        }

        input:focus,
        textarea:focus,
        select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.09);
        }

        .campaign-help {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 10px;
        }

        .campaign-help > div {
          display: grid;
          gap: 2px;
        }

        .campaign-help strong {
          font-size: 10px;
        }

        .campaign-help span {
          color: #64748b;
          font-size: 9px;
        }

        .campaign-help a {
          flex: 0 0 auto;
          color: #1d4ed8;
          font-size: 9.5px;
          font-weight: 900;
          text-decoration: none;
        }

        .audience-summary-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-top: 12px;
        }

        .audience-summary-row > div {
          border: 1px solid #e2e8f0;
          border-radius: 13px;
          background: #fff;
          padding: 10px;
        }

        .audience-summary-row > div.selected {
          border-color: #93c5fd;
          background: #eff6ff;
        }

        .audience-summary-row strong,
        .audience-summary-row span {
          display: block;
        }

        .audience-summary-row strong {
          color: #1d4ed8;
          font-size: 18px;
        }

        .audience-summary-row span {
          margin-top: 2px;
          color: #64748b;
          font-size: 9px;
          font-weight: 800;
        }

        .content-block label + label {
          margin-top: 13px;
        }

        .push-copy {
          margin-top: 13px;
          border: 1px solid #dbeafe;
          border-radius: 14px;
          background: #f8fafc;
          padding: 12px;
        }

        .push-copy span {
          color: #2563eb;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.12em;
        }

        .push-copy strong {
          display: block;
          margin-top: 5px;
          font-size: 11px;
        }

        .push-copy p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 10px;
          line-height: 1.45;
        }

        .upload-box {
          width: 100%;
          min-height: 105px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 5px;
          border: 1px dashed #5eead4;
          border-radius: 16px;
          background: #f0fdfa;
          color: #0f766e;
          cursor: pointer;
        }

        .upload-box strong {
          font-size: 11px;
        }

        .upload-box span {
          color: #64748b;
          font-size: 9px;
        }

        .remove-image {
          margin-top: 8px;
          border: 0;
          background: transparent;
          color: #b91c1c;
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        .preview-column {
          min-width: 0;
        }

        .sticky-preview {
          position: sticky;
          top: 16px;
        }

        .push-preview {
          border: 1px solid #dbeafe;
          border-radius: 16px;
          background: #f8fafc;
          padding: 13px;
        }

        .push-brand {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 8px;
        }

        .push-brand div {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: linear-gradient(
            135deg,
            #38bdf8,
            #1d4ed8
          );
          color: #fff;
          font-size: 11px;
          font-weight: 950;
        }

        .push-brand span {
          color: #64748b;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.1em;
        }

        .push-preview > strong {
          display: block;
          font-size: 11px;
        }

        .push-preview > p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 9.5px;
          line-height: 1.45;
        }

        .portal-preview {
          overflow: hidden;
          margin-top: 12px;
          border: 1px solid #dbeafe;
          border-radius: 19px;
          background: #fff;
          box-shadow: 0 14px 35px rgba(37, 99, 235, 0.08);
        }

        .portal-image {
          aspect-ratio: 16 / 9;
          display: grid;
          place-items: center;
          overflow: hidden;
          background: linear-gradient(
            135deg,
            #e0f2fe,
            #e0e7ff
          );
        }

        .portal-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .portal-image > div {
          display: grid;
          place-items: center;
          gap: 5px;
          color: #64748b;
        }

        .portal-image > div span {
          font-size: 27px;
        }

        .portal-image > div small {
          font-size: 9px;
          font-weight: 850;
        }

        .portal-content {
          padding: 15px;
        }

        .portal-content > small {
          color: #2563eb;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.1em;
        }

        .portal-content h4 {
          margin: 6px 0 7px;
          font-size: 17px;
        }

        .portal-content p {
          margin: 0;
          white-space: pre-wrap;
          color: #475569;
          font-size: 10px;
          line-height: 1.6;
        }

        .portal-content button {
          width: 100%;
          min-height: 39px;
          margin-top: 12px;
          border: 0;
          border-radius: 11px;
          background: #2563eb;
          color: #fff;
          font-size: 10px;
          font-weight: 950;
        }

        .preview-audience {
          display: grid;
          gap: 3px;
          margin-top: 12px;
          border: 1px solid #dbeafe;
          border-radius: 14px;
          background: #eff6ff;
          padding: 11px;
        }

        .preview-audience small {
          color: #2563eb;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.1em;
        }

        .preview-audience strong {
          font-size: 10px;
        }

        .preview-audience span {
          color: #64748b;
          font-size: 9px;
        }

        .publish-button {
          width: 100%;
          margin-top: 12px;
        }

        .history-section {
          margin-top: 18px;
          border-radius: 22px;
          padding: 20px;
        }

        .history-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .history-header h2 {
          margin: 3px 0 4px;
          font-size: 21px;
        }

        .filters {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
        }

        .filters input {
          width: 220px;
        }

        .filters select {
          width: 180px;
        }

        .history-metrics {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-top: 14px;
        }

        .history-metrics > div {
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: #f8fafc;
          padding: 11px;
        }

        .history-metrics b,
        .history-metrics span {
          display: block;
        }

        .history-metrics b {
          color: #1d4ed8;
          font-size: 19px;
        }

        .history-metrics span {
          margin-top: 2px;
          color: #64748b;
          font-size: 9px;
          font-weight: 850;
        }

        .publication-table-wrap {
          overflow-x: auto;
          margin-top: 14px;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
        }

        .publication-table {
          width: 100%;
          min-width: 820px;
          border-collapse: collapse;
        }

        .publication-table th,
        .publication-table td {
          border-bottom: 1px solid #eef2f7;
          padding: 11px;
          text-align: left;
          vertical-align: middle;
          font-size: 10px;
        }

        .publication-table th {
          background: #f8fafc;
          color: #64748b;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .publication-cell {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 270px;
        }

        .table-thumb {
          width: 56px;
          height: 40px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          overflow: hidden;
          border-radius: 9px;
          background: #eff6ff;
        }

        .table-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .publication-cell > div:last-child {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .publication-cell strong {
          overflow: hidden;
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .publication-cell small {
          color: #64748b;
          font-size: 8.5px;
        }

        .audience-badge {
          display: inline-flex;
          border-radius: 999px;
          background: #eff6ff;
          padding: 5px 8px;
          color: #1d4ed8;
          font-size: 8px;
          font-weight: 900;
        }

        .view-summary {
          display: grid;
          gap: 2px;
        }

        .view-summary small {
          color: #64748b;
          font-size: 8.5px;
        }

        .empty-state {
          margin-top: 14px;
          border: 1px dashed #cbd5e1;
          border-radius: 14px;
          padding: 28px;
          color: #94a3b8;
          text-align: center;
          font-size: 10px;
          font-weight: 800;
        }


        .classification-block {
          border-color: #ddd6fe !important;
          background: linear-gradient(180deg, #f7f5ff 0%, #ffffff 48%) !important;
        }

        .content-type-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .content-type-grid button {
          min-height: 86px;
          display: grid;
          align-content: start;
          gap: 5px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: #fff;
          padding: 12px;
          color: #334155;
          text-align: left;
          cursor: pointer;
        }

        .content-type-grid button strong {
          font-size: 11px;
        }

        .content-type-grid button span {
          color: #64748b;
          font-size: 9px;
          line-height: 1.4;
        }

        .content-type-grid button.active {
          border-color: #7c3aed;
          background: #f5f3ff;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.08);
        }

        .expiry-field {
          max-width: 320px;
          margin-top: 14px;
        }

        .expiry-field small {
          color: #64748b;
          font-size: 9px;
          line-height: 1.45;
        }

        .preview-meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 10px;
        }

        .preview-meta-grid > div {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #f8fafc;
          padding: 10px;
        }

        .preview-meta-grid small,
        .preview-meta-grid strong {
          display: block;
        }

        .preview-meta-grid small {
          color: #64748b;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: .08em;
        }

        .preview-meta-grid strong {
          margin-top: 3px;
          font-size: 10px;
        }

        .type-badge {
          display: inline-flex;
          border-radius: 999px;
          padding: 5px 8px;
          font-size: 8px;
          font-weight: 950;
          white-space: nowrap;
        }

        .type-vaga {
          background: #dcfce7;
          color: #15803d;
        }

        .type-processo {
          background: #ede9fe;
          color: #6d28d9;
        }

        .type-entrevista {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .type-novidade {
          background: #fef3c7;
          color: #b45309;
        }

        .expiry-summary {
          display: grid;
          gap: 2px;
          min-width: 125px;
        }

        .expiry-summary strong {
          font-size: 9px;
        }

        .expiry-summary small {
          color: #64748b;
          font-size: 8px;
        }

        .report-button {
          border: 1px solid #bfdbfe;
          border-radius: 10px;
          background: #eff6ff;
          padding: 7px 9px;
          color: #1d4ed8;
          font-size: 8.5px;
          font-weight: 950;
          cursor: pointer;
          white-space: nowrap;
        }

        .report-overlay {
          position: fixed;
          z-index: 4000;
          inset: 0;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(15, 23, 42, .60);
          backdrop-filter: blur(4px);
        }

        .report-modal {
          width: min(980px, 100%);
          max-height: min(780px, 94vh);
          overflow: hidden;
          display: grid;
          grid-template-rows: auto auto auto minmax(0, 1fr);
          border-radius: 24px;
          background: #fff;
          box-shadow: 0 30px 90px rgba(15, 23, 42, .30);
        }

        .report-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 20px;
          border-bottom: 1px solid #e2e8f0;
        }

        .report-header h2 {
          margin: 3px 0 5px;
          font-size: 20px;
        }

        .report-header > div > span {
          color: #64748b;
          font-size: 10px;
          font-weight: 750;
        }

        .report-close {
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 10px;
          background: #f1f5f9;
          color: #475569;
          font-size: 20px;
          cursor: pointer;
        }

        .report-metrics {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
          padding: 14px 20px;
          border-bottom: 1px solid #e2e8f0;
        }

        .report-metrics > div {
          border: 1px solid #e2e8f0;
          border-radius: 13px;
          background: #f8fafc;
          padding: 10px;
        }

        .report-metrics span,
        .report-metrics b {
          display: block;
        }

        .report-metrics span {
          color: #64748b;
          font-size: 8px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .report-metrics b {
          margin-top: 3px;
          font-size: 18px;
        }

        .report-toolbar {
          display: grid;
          grid-template-columns: minmax(240px, 1fr) auto;
          gap: 10px;
          align-items: center;
          padding: 12px 20px;
          border-bottom: 1px solid #e2e8f0;
        }

        .report-filters {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .report-filters button {
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          background: #fff;
          padding: 7px 9px;
          color: #64748b;
          font-size: 8px;
          font-weight: 900;
          cursor: pointer;
        }

        .report-filters button.active {
          border-color: #2563eb;
          background: #2563eb;
          color: #fff;
        }

        .report-list {
          overflow: auto;
          display: grid;
          gap: 8px;
          padding: 12px 20px 20px;
        }

        .report-card {
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          background: #fff;
          padding: 12px;
        }

        .report-card-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .report-card-head > div {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .report-card-head strong {
          font-size: 10px;
        }

        .report-card-head small {
          color: #64748b;
          font-size: 8.5px;
        }

        .status-sent,
        .status-failed,
        .status-pending {
          border-radius: 999px;
          padding: 5px 7px;
          font-size: 7.5px;
          font-weight: 950;
        }

        .status-sent {
          background: #dcfce7;
          color: #15803d;
        }

        .status-failed {
          background: #fee2e2;
          color: #b91c1c;
        }

        .status-pending {
          background: #f1f5f9;
          color: #64748b;
        }

        .report-flags {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
          margin-top: 9px;
        }

        .report-flags span {
          border-radius: 999px;
          background: #f1f5f9;
          padding: 5px 7px;
          color: #64748b;
          font-size: 8px;
          font-weight: 850;
        }

        .report-flags span.ok {
          background: #dcfce7;
          color: #15803d;
        }

        .report-timeline {
          display: flex;
          gap: 8px 14px;
          flex-wrap: wrap;
          margin-top: 9px;
          padding-top: 9px;
          border-top: 1px solid #f1f5f9;
        }

        .report-timeline span {
          color: #64748b;
          font-size: 8.5px;
        }

        .report-error {
          color: #b91c1c !important;
        }

        @media (max-width: 1180px) {
          .workspace {
            grid-template-columns: 1fr;
          }

          .sticky-preview {
            position: static;
          }
        }

        @media (max-width: 760px) {
          .page-shell {
            width: min(100% - 14px, 1520px);
            padding-top: 8px;
          }

          .page-header,
          .history-header {
            align-items: stretch;
            flex-direction: column;
          }

          .page-header,
          .section-card,
          .history-section {
            border-radius: 17px;
            padding: 14px;
          }

          .mode-selector,
          .content-type-grid,
          .preview-meta-grid {
            grid-template-columns: 1fr;
          }

          .report-metrics {
            grid-template-columns: 1fr 1fr;
          }

          .report-toolbar {
            grid-template-columns: 1fr;
          }

          .report-filters {
            justify-content: flex-start;
          }

          .audience-summary-row {
            grid-template-columns: 1fr 1fr;
          }

          .audience-summary-row > div.selected {
            grid-column: 1 / -1;
          }

          .history-metrics {
            grid-template-columns: 1fr 1fr;
          }

          .filters {
            display: grid;
            grid-template-columns: 1fr;
          }

          .filters input,
          .filters select {
            width: 100%;
          }

          .campaign-help {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}
