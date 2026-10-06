"use client";

import { useEffect, useState } from "react";

type Post = {
  id: string;
  title: string;
  body: string;
  contentType: "VAGA" | "PROCESSO" | "ENTREVISTA" | "NOVIDADE";
  expiresAt?: string | null;
  publishedAt: string;
  viewedAt?: string | null;
  hasImage: boolean;
  imageUrl?: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  VAGA: "💼 Vaga",
  PROCESSO: "🎯 Processo seletivo",
  ENTREVISTA: "📅 Entrevista",
  NOVIDADE: "📰 Novidade",
};

function when(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function CandidatePortalPosts({
  portalToken,
}: {
  portalToken: string;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const response = await fetch(
        `/api/candidate-portal/${encodeURIComponent(
          portalToken
        )}/posts?t=${Date.now()}`,
        { cache: "no-store" }
      );

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setPosts(data.posts || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalToken]);

  async function markViewed(post: Post) {
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

  if (loading) {
    return <div className="cp-empty">Carregando novidades...</div>;
  }

  return (
    <section className="cp-card">
      <div className="cp-section-head">
        <div>
          <span className="cp-eyebrow">MOTIVAR RH</span>
          <h2>Novidades & Comunicados</h2>
        </div>
        <span>{posts.length} publicação(ões)</span>
      </div>

      <div className="cp-post-grid">
        {posts.map((post) => (
          <article
            className={`cp-post ${post.viewedAt ? "" : "unread"}`}
            key={post.id}
            onClick={() => void markViewed(post)}
          >
            {post.imageUrl && (
              <img
                src={post.imageUrl}
                alt={post.title}
                className="cp-post-image"
              />
            )}

            <div className="cp-post-body">
              <div className="cp-post-meta">
                <span>
                  {TYPE_LABELS[post.contentType] || "📰 Novidade"}
                </span>
                <span>{when(post.publishedAt)}</span>
                {post.expiresAt && (
                  <span>até {when(post.expiresAt)}</span>
                )}
                {!post.viewedAt && <b>NOVO</b>}
              </div>

              <h3>{post.title}</h3>
              <p>{post.body}</p>
            </div>
          </article>
        ))}

        {!posts.length && (
          <div className="cp-empty">
            Nenhum comunicado publicado para você ainda.
          </div>
        )}
      </div>
    </section>
  );
}
