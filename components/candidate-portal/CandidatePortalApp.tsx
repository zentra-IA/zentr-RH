"use client";

import { useEffect, useMemo, useState } from "react";
import CandidatePushManager from "@/components/candidate-portal/CandidatePushManager";
import CandidatePortalPosts from "@/components/candidate-portal/CandidatePortalPosts";
import CandidatePortalChat from "@/components/candidate-portal/CandidatePortalChat";
import CandidatePortalFloatingChat from "@/components/candidate-portal/CandidatePortalFloatingChat";
import CandidatePortalTimeline from "@/components/candidate-portal/CandidatePortalTimeline";

type PortalData = {
  requiresIdentity: boolean;
  profile?: any;
  push?: any;
  jobs?: any[];
  applications?: any[];
  interviews?: any[];
  notifications?: any[];
  interests?: any[];
  interviewResponses?: any[];
};

const MOTIVAR_LOGO_PATH =
  process.env.NEXT_PUBLIC_MOTIVAR_LOGO_PATH || "/motivar-logo.png";

function money(value?: number | null) {
  if (value == null) return null;
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function stageLabel(value?: string | null) {
  const map: Record<string, string> = {
    triagem: "Triagem",
    entrevista: "Entrevista",
    aprovado: "Aprovado",
    reprovado: "Não aprovado",
    contratado: "Contratado",
  };
  return map[String(value || "")] || String(value || "Em andamento");
}

export default function CandidatePortalApp({
  portalToken,
}: {
  portalToken: string;
}) {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cpf, setCpf] = useState("");
  const [identityLoading, setIdentityLoading] = useState(false);
  const [tab, setTab] = useState("inicio");
  const [busy, setBusy] = useState("");
  const [focusPostId, setFocusPostId] = useState("");
  const [focusJobId, setFocusJobId] = useState("");

  const endpoint = `/api/candidate-portal/${encodeURIComponent(portalToken)}`;

  async function load() {
    try {
      setLoading(true);
      const response = await fetch(`${endpoint}?t=${Date.now()}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Portal indisponível.");
      }

      setData(payload);
    } catch (error: any) {
      setData({
        requiresIdentity: true,
        profile: {
          error: error?.message || "Portal indisponível.",
        },
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    function applyPortalUrl(rawUrl: string) {
      const url = new URL(rawUrl, window.location.origin);
      const params = url.searchParams;
      const requestedTab = params.get("tab");

      if (requestedTab) {
        setTab(requestedTab);
      }

      setFocusPostId(params.get("post") || "");
      setFocusJobId(params.get("job") || "");

      const source = params.get("src");
      const notificationId = params.get("notification_id");
      const deliveryId = params.get("delivery_id");

      if (source === "push" && notificationId && deliveryId) {
        const trackingEndpoint =
          `/api/candidate-portal/${encodeURIComponent(portalToken)}/track`;

        void fetch(trackingEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notificationId,
            deliveryId,
            event: "opened",
          }),
        });

        window.setTimeout(() => {
          void fetch(trackingEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              notificationId,
              deliveryId,
              event: "viewed",
            }),
          });
        }, 1500);
      }
    }

    applyPortalUrl(window.location.href);

    const onServiceWorkerMessage = (event: MessageEvent) => {
      if (
        event.data?.type !== "MOTIVAR_PUSH_NAVIGATE" ||
        !event.data?.url
      ) {
        return;
      }

      const nextUrl = new URL(
        String(event.data.url),
        window.location.origin
      );

      window.history.replaceState(
        {},
        "",
        `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
      );

      applyPortalUrl(nextUrl.toString());
      void load();
    };

    navigator.serviceWorker?.addEventListener(
      "message",
      onServiceWorkerMessage
    );

    void load();

    return () => {
      navigator.serviceWorker?.removeEventListener(
        "message",
        onServiceWorkerMessage
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalToken]);

  const interestMap = useMemo(
    () =>
      new Map(
        (data?.interests || []).map((item: any) => [
          String(item.job_id),
          item.interest,
        ])
      ),
    [data?.interests]
  );

  const interviewResponseMap = useMemo(
    () =>
      new Map(
        (data?.interviewResponses || []).map((item: any) => [
          String(item.interview_id),
          item.response,
        ])
      ),
    [data?.interviewResponses]
  );

  async function confirmIdentity(event: React.FormEvent) {
    event.preventDefault();

    try {
      setIdentityLoading(true);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm_identity",
          cpf,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(payload?.error || "Não foi possível confirmar seus dados.");
        return;
      }

      setCpf("");
      await load();
    } finally {
      setIdentityLoading(false);
    }
  }

  async function setInterest(jobId: string, interest: string) {
    try {
      setBusy(`job:${jobId}`);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "job_interest",
          jobId,
          interest,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(payload?.error || "Não foi possível registrar seu interesse.");
        return;
      }

      await load();
    } finally {
      setBusy("");
    }
  }

  async function interviewResponse(
    interviewId: string,
    responseValue: string
  ) {
    try {
      setBusy(`interview:${interviewId}`);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "interview_response",
          interviewId,
          response: responseValue,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(payload?.error || "Não foi possível registrar sua resposta.");
        return;
      }

      await load();
    } finally {
      setBusy("");
    }
  }

  async function markNotificationRead(id: string) {
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "notification_read",
        notificationId: id,
      }),
    }).catch(() => null);

    setData((current) =>
      current
        ? {
            ...current,
            notifications: (current.notifications || []).map((item: any) =>
              item.id === id
                ? { ...item, read_at: item.read_at || new Date().toISOString() }
                : item
            ),
          }
        : current
    );
  }

  if (loading) {
    return (
      <main className="candidate-portal-shell">
        <div className="cp-loading">Carregando Portal MOTIVAR...</div>
      </main>
    );
  }

  if (data?.profile?.error) {
    return (
      <main className="candidate-portal-shell">
        <section className="cp-card cp-error">
          <h1>Portal MOTIVAR RH</h1>
          <p>{data.profile.error}</p>
        </section>
      </main>
    );
  }

  if (data?.requiresIdentity) {
    const firstName = String(data?.profile?.name || "candidato")
      .trim()
      .split(" ")[0];

    return (
      <main className="candidate-portal-shell identity">
        <section className="cp-identity-card">
          <div className="cp-logo">
            <span>M</span>
            <img
              src={MOTIVAR_LOGO_PATH}
              alt="MOTIVAR RH"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          </div>
          <span className="cp-eyebrow">PORTAL DO CANDIDATO</span>
          <h1>Olá, {firstName}.</h1>
          <p>
            Confirme seu CPF para ativar seu acesso ao Portal MOTIVAR.
            Se o seu currículo já estiver na nossa base, ele será vinculado
            automaticamente ao seu perfil.
          </p>

          <form onSubmit={confirmIdentity}>
            <label>
              CPF
              <input
                value={cpf}
                onChange={(event) => setCpf(event.target.value)}
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
            </label>

            <button disabled={identityLoading}>
              {identityLoading
                ? "Confirmando..."
                : "Entrar no Portal MOTIVAR"}
            </button>
          </form>

          <small>
            Seus dados são utilizados somente para confirmar seu cadastro de
            candidato e os processos seletivos vinculados ao seu perfil.
          </small>
        </section>
      </main>
    );
  }

  const profile = data?.profile || {};
  const unread = (data?.notifications || []).filter(
    (item: any) => !item.read_at
  ).length;

  return (
    <main className="candidate-portal-shell">
      <header className="cp-header">
        <div className="cp-brand">
          <div className="cp-logo small">
            <span>M</span>
            <img
              src={MOTIVAR_LOGO_PATH}
              alt="MOTIVAR RH"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          </div>
          <div>
            <strong>MOTIVAR RH</strong>
            <span>Portal do Candidato</span>
          </div>
        </div>

        <div className="cp-user">
          <strong>{profile.name}</strong>
          <span>{profile.lastRole || profile.course || "Candidato"}</span>
        </div>
      </header>

      <CandidatePushManager portalToken={portalToken} />

      {!profile.curriculumLinked && (
        <section className="cp-link-warning">
          <div>
            <strong>✅ Seu Portal MOTIVAR está ativo</strong>
            <span>
              Seu acesso, Push, comunicados e chat já funcionam normalmente.
              A equipe da MOTIVAR RH ainda pode vincular seu currículo para liberar
              vagas compatíveis e processos seletivos.
            </span>
          </div>
        </section>
      )}

      <nav className="cp-nav">
        {[
          ["inicio", "Início"],
          ["vagas", "Vagas"],
          ["processos", "Processos"],
          ["entrevistas", "Entrevistas"],
          ["novidades", "Novidades"],
          ["chat", "Chat"],
          ["notificacoes", `Avisos${unread ? ` (${unread})` : ""}`],
          ["perfil", "Meu perfil"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "inicio" && (
        <>
          <section className="cp-hero">
            <span className="cp-eyebrow">BEM-VINDO AO SEU ESPAÇO</span>
            <h1>Olá, {String(profile.name || "").split(" ")[0]} 👋</h1>
            <p>
              Acompanhe oportunidades, processos seletivos e entrevistas em
              um único lugar.
            </p>
          </section>

          <section className="cp-metric-grid">
            <button onClick={() => setTab("vagas")}>
              <b>{data?.jobs?.length || 0}</b>
              <span>Vagas compatíveis</span>
            </button>
            <button onClick={() => setTab("processos")}>
              <b>{data?.applications?.length || 0}</b>
              <span>Processos</span>
            </button>
            <button onClick={() => setTab("entrevistas")}>
              <b>{data?.interviews?.length || 0}</b>
              <span>Entrevistas</span>
            </button>
            <button onClick={() => setTab("notificacoes")}>
              <b>{unread}</b>
              <span>Avisos novos</span>
            </button>
          </section>

          <CandidatePortalTimeline
            portalToken={portalToken}
            jobs={data?.jobs || []}
            applications={data?.applications || []}
            interviews={data?.interviews || []}
            interestMap={interestMap}
            busy={busy}
            focusPostId={focusPostId}
            focusJobId={focusJobId}
            onInterest={setInterest}
            onOpenChat={() => setTab("chat")}
            onOpenTab={setTab}
          />
        </>
      )}

      {tab === "vagas" && (
        <section className="cp-card">
          <div className="cp-section-head">
            <div>
              <span className="cp-eyebrow">OPORTUNIDADES</span>
              <h2>Vagas para você</h2>
            </div>
            <span>{data?.jobs?.length || 0} oportunidades</span>
          </div>

          <div className="cp-list">
            {(data?.jobs || []).map((job: any) => (
              <JobCard
                key={job.id}
                job={job}
                interest={interestMap.get(job.id)}
                busy={busy === `job:${job.id}`}
                onInterest={setInterest}
              />
            ))}
            {!data?.jobs?.length && (
              <div className="cp-empty">
                Nenhuma nova vaga compatível disponível agora.
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "processos" && (
        <section className="cp-card">
          <div className="cp-section-head">
            <div>
              <span className="cp-eyebrow">ACOMPANHAMENTO</span>
              <h2>Meus processos seletivos</h2>
            </div>
          </div>

          <div className="cp-list">
            {(data?.applications || []).map((item: any) => (
              <article className="cp-process" key={item.id}>
                <div>
                  <strong>{item.jobTitle}</strong>
                  <span>
                    Atualizado em {dateTime(item.updatedAt)}
                  </span>
                </div>
                <b>{stageLabel(item.stage)}</b>
              </article>
            ))}

            {!data?.applications?.length && (
              <div className="cp-empty">
                Você ainda não possui processo seletivo ativo.
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "entrevistas" && (
        <section className="cp-card">
          <div className="cp-section-head">
            <div>
              <span className="cp-eyebrow">AGENDA</span>
              <h2>Minhas entrevistas</h2>
            </div>
          </div>

          <div className="cp-list">
            {(data?.interviews || []).map((item: any) => {
              const answer = interviewResponseMap.get(item.id);

              return (
                <article className="cp-interview" key={item.id}>
                  <div>
                    <strong>{item.jobTitle}</strong>
                    <h3>{dateTime(item.scheduledAt)}</h3>
                    <span>
                      {item.location ||
                        (item.meetingUrl ? "Entrevista online" : "Local a confirmar")}
                    </span>
                    {item.meetingUrl && (
                      <a
                        href={item.meetingUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir link da entrevista
                      </a>
                    )}
                  </div>

                  <div className="cp-actions">
                    <button
                      className={answer === "CONFIRMED" ? "selected" : ""}
                      disabled={busy === `interview:${item.id}`}
                      onClick={() =>
                        void interviewResponse(item.id, "CONFIRMED")
                      }
                    >
                      Confirmar presença
                    </button>
                    <button
                      className={
                        answer === "DECLINED"
                          ? "danger selected"
                          : "danger"
                      }
                      disabled={busy === `interview:${item.id}`}
                      onClick={() =>
                        void interviewResponse(item.id, "DECLINED")
                      }
                    >
                      Não posso comparecer
                    </button>
                  </div>
                </article>
              );
            })}

            {!data?.interviews?.length && (
              <div className="cp-empty">
                Nenhuma entrevista agendada.
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "novidades" && (
        <CandidatePortalPosts portalToken={portalToken} />
      )}

      {tab === "chat" && (
        <CandidatePortalChat portalToken={portalToken} />
      )}

      {tab === "notificacoes" && (
        <section className="cp-card">
          <div className="cp-section-head">
            <div>
              <span className="cp-eyebrow">CENTRAL DE AVISOS</span>
              <h2>Notificações</h2>
            </div>
          </div>

          <div className="cp-list">
            {(data?.notifications || []).map((item: any) => (
              <button
                className={`cp-notification ${
                  item.read_at ? "" : "unread"
                }`}
                key={item.id}
                onClick={() => void markNotificationRead(item.id)}
              >
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  <span>{dateTime(item.created_at)}</span>
                </div>
                {!item.read_at && <b>NOVO</b>}
              </button>
            ))}

            {!data?.notifications?.length && (
              <div className="cp-empty">Nenhum aviso recebido.</div>
            )}
          </div>
        </section>
      )}

      {tab === "perfil" && (
        <section className="cp-card">
          <div className="cp-section-head">
            <div>
              <span className="cp-eyebrow">SEU CADASTRO</span>
              <h2>Meu perfil</h2>
            </div>
          </div>

          <div className="cp-profile-grid">
            <Info label="Nome" value={profile.name} />
            <Info label="E-mail" value={profile.email} />
            <Info label="Celular" value={profile.phone} />
            <Info
              label="Cidade"
              value={[profile.city, profile.state].filter(Boolean).join(" / ")}
            />
            <Info label="Escolaridade" value={profile.education} />
            <Info label="Curso" value={profile.course} />
            <Info label="Último cargo" value={profile.lastRole} />
            <Info label="Origem do currículo" value={profile.resumeOrigin} />
          </div>

          {profile.professionalSummary && (
            <div className="cp-summary">
              <strong>Resumo profissional</strong>
              <p>{profile.professionalSummary}</p>
            </div>
          )}
        </section>
      )}

      <footer className="cp-footer">
        MOTIVAR RH LTDA. • Portal do Candidato
      </footer>

      <CandidatePortalFloatingChat portalToken={portalToken} />
    </main>
  );
}

function JobCard({
  job,
  interest,
  busy,
  onInterest,
}: {
  key?: string;
  job: any;
  interest?: string;
  busy: boolean;
  onInterest: (jobId: string, interest: string) => Promise<void>;
}) {
  const salary =
    job.salaryMin != null || job.salaryMax != null
      ? [money(job.salaryMin), money(job.salaryMax)]
          .filter(Boolean)
          .join(" a ")
      : null;

  return (
    <article className="cp-job">
      <div className="cp-job-top">
        <div>
          <span className="cp-score">{job.score}% compatível</span>
          <h3>{job.title}</h3>
          <p>
            {[job.city, job.state].filter(Boolean).join(" / ") || "Local a confirmar"}
            {job.workMode ? ` • ${job.workMode}` : ""}
            {job.contractType ? ` • ${job.contractType}` : ""}
          </p>
        </div>
        {salary && <strong>{salary}</strong>}
      </div>

      {job.description && <p>{job.description}</p>}

      {Array.isArray(job.skillsRequired) && job.skillsRequired.length > 0 && (
        <div className="cp-tags">
          {job.skillsRequired.slice(0, 8).map((skill: string) => (
            <span key={skill}>{skill}</span>
          ))}
        </div>
      )}

      <div className="cp-actions">
        <button
          className={interest === "INTERESTED" ? "selected" : ""}
          disabled={busy}
          onClick={() => void onInterest(job.id, "INTERESTED")}
        >
          Tenho interesse
        </button>
        <button
          className={
            interest === "NOT_INTERESTED"
              ? "danger selected"
              : "danger"
          }
          disabled={busy}
          onClick={() => void onInterest(job.id, "NOT_INTERESTED")}
        >
          Não tenho interesse
        </button>
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="cp-info">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}
