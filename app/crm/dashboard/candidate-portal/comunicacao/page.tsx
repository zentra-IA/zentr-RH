"use client";

import { useState } from "react";
import CandidatePortalBroadcastManager from "@/components/rh/candidate-portal/CandidatePortalBroadcastManager";
import CandidatePortalAutomationManager from "@/components/rh/candidate-portal/CandidatePortalAutomationManager";
import CandidatePortalPostsManager from "@/components/rh/candidate-portal/CandidatePortalPostsManager";

export default function CandidatePortalCommunicationPage() {
  const [tab, setTab] = useState<"broadcasts" | "automations" | "posts">(
    "broadcasts"
  );

  return (
    <main className="communication-page">
      <section className="hero">
        <div>
          <span>MOTIVAR RH · PORTAL + PUSH</span>
          <h1>Central de Comunicação</h1>
          <p>
            Transmissões segmentadas, automações do chat e publicações com
            texto/imagem para o Portal do Candidato.
          </p>
        </div>
      </section>

      <nav className="tabs">
        <button
          className={tab === "broadcasts" ? "active" : ""}
          onClick={() => setTab("broadcasts")}
        >
          📣 Transmissões
        </button>
        <button
          className={tab === "automations" ? "active" : ""}
          onClick={() => setTab("automations")}
        >
          🤖 Automações
        </button>
        <button
          className={tab === "posts" ? "active" : ""}
          onClick={() => setTab("posts")}
        >
          📰 Publicações + Imagens
        </button>
      </nav>

      {tab === "broadcasts" && <CandidatePortalBroadcastManager />}
      {tab === "automations" && <CandidatePortalAutomationManager />}
      {tab === "posts" && <CandidatePortalPostsManager />}

      <style jsx>{`
        .communication-page {
          width: min(1500px, 100%);
          margin: 0 auto;
          padding: 4px;
          color: #182230;
        }

        .hero {
          margin-bottom: 12px;
          padding: 22px;
          border: 1px solid #dbeafe;
          border-radius: 24px;
          background: #fff;
          box-shadow: 0 16px 45px rgba(15, 23, 42, 0.06);
        }

        .hero span {
          color: #2563eb;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.14em;
        }

        .hero h1 {
          margin: 5px 0 7px;
          font-size: clamp(28px, 3vw, 39px);
          letter-spacing: -0.045em;
        }

        .hero p {
          margin: 0;
          color: #667085;
          font-size: 12px;
        }

        .tabs {
          display: flex;
          gap: 7px;
          margin-bottom: 12px;
          padding: 6px;
          overflow-x: auto;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          background: #fff;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
        }

        .tabs button {
          flex: 0 0 auto;
          min-height: 39px;
          border: 1px solid transparent;
          border-radius: 10px;
          padding: 0 13px;
          background: transparent;
          color: #667085;
          font-size: 10px;
          font-weight: 950;
          cursor: pointer;
        }

        .tabs button.active {
          border-color: #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
        }
      `}</style>
    </main>
  );
}
