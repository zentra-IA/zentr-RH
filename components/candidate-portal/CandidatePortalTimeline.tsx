"use client";

import { useEffect, useMemo, useState } from "react";

type TimelineFilter =
  | "tudo"
  | "vagas"
  | "processos"
  | "entrevistas"
  | "novidades";

type PortalPost = {
  id: string;
  title: string;
  body: string;
  contentType: "VAGA" | "PROCESSO" | "ENTREVISTA" | "NOVIDADE";
  expiresAt?: string | null;
  publishedAt?: string | null;
  viewedAt?: string | null;
  imageUrl?: string | null;
};

function dateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function categoryFromContentType(
  value?: string | null
): TimelineFilter {
  if (value === "VAGA") return "vagas";
  if (value === "PROCESSO") return "processos";
  if (value === "ENTREVISTA") return "entrevistas";
  return "novidades";
}

function categoryLabel(value: TimelineFilter) {
  const labels: Record<TimelineFilter, string> = {
    tudo: "Tudo",
    vagas: "💼 Vagas",
    processos: "🎯 Processos",
    entrevistas: "📅 Entrevistas",
    novidades: "📰 Novidades",
  };

  return labels[value];
}

export default function CandidatePortalTimeline({
  portalToken,
  jobs,
  applications,
  interviews,
  interestMap,
  busy,
  focusPostId,
  focusJobId,
  onInterest,
  onOpenChat,
  onOpenTab,
}: {
  portalToken: string;
  jobs: any[];
  applications: any[];
  interviews: any[];
  interestMap: Map<string, string>;
  busy: string;
  focusPostId?: string;
  focusJobId?: string;
  onInterest: (jobId: string, interest: string) => Promise<void>;
  onOpenChat: () => void;
  onOpenTab: (tab: string) => void;
}) {
  const [posts, setPosts] = useState<PortalPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TimelineFilter>("tudo");

  async function loadPosts() {
    try {
      const response = await fetch(
        `/api/candidate-portal/${encodeURIComponent(
          portalToken
        )}/posts?t=${Date.now()}`,
        { cache: "no-store" }
      );

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setPosts(Array.isArray(data.posts) ? data.posts : []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalToken]);

  useEffect(() => {
    const focusId = focusPostId
      ? `timeline-post-${focusPostId}`
      : focusJobId
        ? `timeline-job-${focusJobId}`
        : "";

    if (!focusId) return;

    const timer = window.setTimeout(() => {
      const element = document.getElementById(focusId);
      if (!element) return;

      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      element.classList.add("cp-timeline-focus");
      window.setTimeout(
        () => element.classList.remove("cp-timeline-focus"),
        2800
      );
    }, 250);

    return () => window.clearTimeout(timer);
  }, [focusPostId, focusJobId, posts.length, jobs.length]);

  async function markPostViewed(post: PortalPost) {
    if (post.viewedAt) return;

    await fetch(
      `/api/candidate-portal/${encodeURIComponent(
        portalToken
      )}/posts`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id }),
      }
    ).catch(() => null);

    setPosts((current) =>
      current.map((item) =>
        item.id === post.id
          ? {
              ...item,
              viewedAt: new Date().toISOString(),
            }
          : item
      )
    );
  }

  const items = useMemo(() => {
    const result: Array<any> = [];

    for (const post of posts) {
      result.push({
        id: `post:${post.id}`,
        domId: `timeline-post-${post.id}`,
        kind: "post",
        category: categoryFromContentType(post.contentType),
        date: post.publishedAt || null,
        post,
      });
    }

    for (const job of jobs || []) {
      result.push({
        id: `job:${job.id}`,
        domId: `timeline-job-${job.id}`,
        kind: "job",
        category: "vagas",
        date:
          job.matchUpdatedAt ||
          job.updatedAt ||
          job.createdAt ||
          null,
        job,
      });
    }

    for (const application of applications || []) {
      result.push({
        id: `process:${application.id}`,
        domId: `timeline-process-${application.id}`,
        kind: "process",
        category: "processos",
        date:
          application.updatedAt ||
          application.applicationDate ||
          null,
        application,
      });
    }

    for (const interview of interviews || []) {
      result.push({
        id: `interview:${interview.id}`,
        domId: `timeline-interview-${interview.id}`,
        kind: "interview",
        category: "entrevistas",
        date:
          interview.updatedAt ||
          interview.createdAt ||
          interview.scheduledAt ||
          null,
        interview,
      });
    }

    return result
      .filter(
        (item) =>
          filter === "tudo" || item.category === filter
      )
      .sort((a, b) => {
        const aTime = a.date ? new Date(a.date).getTime() : 0;
        const bTime = b.date ? new Date(b.date).getTime() : 0;
        return bTime - aTime;
      });
  }, [posts, jobs, applications, interviews, filter]);

  return (
    <section className="cp-card cp-timeline-card">
      <div className="cp-section-head">
        <div>
          <span className="cp-eyebrow">SEU FEED</span>
          <h2>Atualizações para você</h2>
          <p className="cp-timeline-subtitle">
            Vagas, processos, entrevistas e novidades da MOTIVAR em uma
            única timeline.
          </p>
        </div>
        <span>{items.length} item(ns)</span>
      </div>

      <div className="cp-timeline-filters">
        {(
          [
            "tudo",
            "vagas",
            "processos",
            "entrevistas",
            "novidades",
          ] as TimelineFilter[]
        ).map((value) => (
          <button
            key={value}
            type="button"
            className={filter === value ? "active" : ""}
            onClick={() => setFilter(value)}
          >
            {categoryLabel(value)}
          </button>
        ))}
      </div>

      <div className="cp-timeline">
        {items.map((item) => {
          if (item.kind === "post") {
            const post: PortalPost = item.post;

            return (
              <article
                id={item.domId}
                className={`cp-feed-item cp-feed-post ${
                  post.viewedAt ? "" : "unread"
                }`}
                key={item.id}
                onClick={() => void markPostViewed(post)}
              >
                {post.imageUrl && (
                  <img
                    className="cp-feed-image"
                    src={post.imageUrl}
                    alt={post.title}
                  />
                )}

                <div className="cp-feed-content">
                  <div className="cp-feed-meta">
                    <span>{categoryLabel(item.category)}</span>
                    <span>{dateTime(post.publishedAt)}</span>
                    {!post.viewedAt && <b>NOVO</b>}
                  </div>

                  <h3>{post.title}</h3>
                  <p>{post.body}</p>

                  {post.expiresAt && (
                    <small>
                      Disponível no Portal até{" "}
                      {dateTime(post.expiresAt)}
                    </small>
                  )}
                </div>
              </article>
            );
          }

          if (item.kind === "job") {
            const job = item.job;
            const interest = interestMap.get(String(job.id));

            return (
              <article
                id={item.domId}
                className="cp-feed-item cp-feed-job"
                key={item.id}
              >
                <div className="cp-feed-meta">
                  <span>💼 VAGA COMPATÍVEL</span>
                  {job.score != null && (
                    <b>{job.score}% compatível</b>
                  )}
                </div>

                <h3>{job.title}</h3>

                <p>
                  {[job.city, job.state]
                    .filter(Boolean)
                    .join(" / ") || "Local a confirmar"}
                  {job.workMode ? ` • ${job.workMode}` : ""}
                  {job.contractType
                    ? ` • ${job.contractType}`
                    : ""}
                </p>

                {job.description && (
                  <p className="cp-feed-description">
                    {job.description}
                  </p>
                )}

                <div className="cp-actions">
                  <button
                    type="button"
                    className={
                      interest === "INTERESTED"
                        ? "selected"
                        : ""
                    }
                    disabled={busy === `job:${job.id}`}
                    onClick={() =>
                      void onInterest(job.id, "INTERESTED")
                    }
                  >
                    {interest === "INTERESTED"
                      ? "✓ Interesse registrado"
                      : "Quero me candidatar"}
                  </button>

                  <button
                    type="button"
                    className="secondary-action"
                    onClick={onOpenChat}
                  >
                    💬 Falar com a MOTIVAR
                  </button>

                  <button
                    type="button"
                    className="link-action"
                    onClick={() => onOpenTab("vagas")}
                  >
                    Ver detalhes
                  </button>
                </div>

                <small className="cp-chat-hint">
                  Tem dúvida sobre esta vaga? Use o chat interno para falar
                  com a equipe antes de se candidatar.
                </small>
              </article>
            );
          }

          if (item.kind === "process") {
            const application = item.application;

            return (
              <article
                id={item.domId}
                className="cp-feed-item"
                key={item.id}
              >
                <div className="cp-feed-meta">
                  <span>🎯 PROCESSO SELETIVO</span>
                  <span>{dateTime(application.updatedAt)}</span>
                </div>
                <h3>{application.jobTitle}</h3>
                <p>
                  Etapa atual:{" "}
                  <strong>
                    {String(
                      application.stage || "Em andamento"
                    )}
                  </strong>
                </p>
                <button
                  type="button"
                  className="cp-feed-inline-link"
                  onClick={() => onOpenTab("processos")}
                >
                  Acompanhar processo
                </button>
              </article>
            );
          }

          const interview = item.interview;

          return (
            <article
              id={item.domId}
              className="cp-feed-item cp-feed-interview"
              key={item.id}
            >
              <div className="cp-feed-meta">
                <span>📅 ENTREVISTA</span>
                <span>{dateTime(interview.scheduledAt)}</span>
              </div>
              <h3>{interview.jobTitle}</h3>
              <p>
                {interview.location ||
                  (interview.meetingUrl
                    ? "Entrevista online"
                    : "Local a confirmar")}
              </p>
              <button
                type="button"
                className="cp-feed-inline-link"
                onClick={() => onOpenTab("entrevistas")}
              >
                Ver entrevista
              </button>
            </article>
          );
        })}

        {!loading && !items.length && (
          <div className="cp-empty">
            Nenhuma atualização neste filtro ainda.
          </div>
        )}

        {loading && !items.length && (
          <div className="cp-empty">
            Carregando sua timeline...
          </div>
        )}
      </div>
    </section>
  );
}
