"use client";

import { useEffect, useState } from "react";

type Availability = {
  resume: boolean;
  video: boolean;
  resumeName?: string;
};

export default function ClientInterviewMedia({
  token,
  memberId,
}: {
  token: string;
  memberId: string;
}) {
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [showVideo, setShowVideo] = useState(false);

  const base = `/api/public/client-ai-media/${encodeURIComponent(token)}/${encodeURIComponent(memberId)}`;

  useEffect(() => {
    let live = true;
    fetch(`${base}?kind=manifest`, { cache: "no-store" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (live) setAvailability(data); })
      .catch(() => { if (live) setAvailability(null); });
    return () => { live = false; };
  }, [base]);

  if (!availability?.resume && !availability?.video) return null;

  return (
    <section style={{ padding: 12, margin: "8px 0 15px", background: "#eef6ff", border: "1px solid #bfdbfe", borderRadius: 14 }}>
      <strong style={{ display: "block", marginBottom: 10, color: "#1d4ed8", fontSize: 13 }}>
        Arquivos enviados pelo candidato na entrevista
      </strong>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
        {availability.resume && (
          <a
            href={`${base}?kind=resume`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ padding: "9px 12px", background: "#2563eb", color: "#fff", borderRadius: 10, fontWeight: 800, textDecoration: "none", fontSize: 12 }}
          >
            📄 Ver currículo original
          </a>
        )}
        {availability.video && (
          <button
            type="button"
            onClick={() => setShowVideo(!showVideo)}
            style={{ padding: "9px 12px", background: "#0f766e", color: "#fff", borderRadius: 10, fontWeight: 800, border: 0, cursor: "pointer", fontSize: 12 }}
          >
            {showVideo ? "Fechar vídeo" : "▶ Assistir apresentação em vídeo"}
          </button>
        )}
      </div>
      {showVideo && availability.video && (
        <video
          src={`${base}?kind=video`}
          controls
          playsInline
          preload="metadata"
          style={{ width: "100%", borderRadius: 12, marginTop: 12, background: "#0f172a", maxHeight: 380 }}
        />
      )}
    </section>
  );
}
