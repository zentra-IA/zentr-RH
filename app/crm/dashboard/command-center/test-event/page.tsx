"use client";

import Link from "next/link";
import { useState } from "react";

export default function TestCommandCenterEventPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function sendTest() {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/command-center/events", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          module: "sistema",
          entityType: "command_center",
          action: "command_center_tested",
          description: "Testou o Event Bus do Centro de Comando",
          metadata: {
            origin: "test-page",
          },
        }),
      });

      const payload = await response.json();
      setResult({
        status: response.status,
        payload,
      });
    } catch (error) {
      setResult({
        status: 0,
        payload: {
          success: false,
          error: error instanceof Error ? error.message : "Erro desconhecido.",
        },
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="test-page">
      <section className="card">
        <Link href="/crm/dashboard/command-center">
          ← Voltar ao Centro de Comando
        </Link>

        <p className="eyebrow">Diagnóstico</p>
        <h1>Testar Event Bus</h1>
        <p>
          Este teste cria um evento real no Supabase. Após o sucesso, volte ao
          dashboard e clique em <strong>Atualizar</strong>.
        </p>

        <button type="button" disabled={loading} onClick={sendTest}>
          {loading ? "Enviando evento..." : "Criar evento de teste"}
        </button>

        {result && (
          <pre className={result.payload?.success ? "success" : "error"}>
            {JSON.stringify(result, null, 2)}
          </pre>
        )}

        <div className="links">
          <a href="/api/command-center/health" target="_blank">
            Abrir diagnóstico da integração
          </a>
          <a href="/api/command-center/events?limit=10" target="_blank">
            Ver últimos eventos em JSON
          </a>
        </div>
      </section>

      <style jsx>{`
        .test-page {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
          color: #e2e8f0;
          background:
            radial-gradient(circle at top, rgba(37, 99, 235, 0.22), transparent 35%),
            #07101f;
        }
        .card {
          width: min(700px, 100%);
          padding: 30px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 26px;
          background: rgba(15, 23, 42, 0.88);
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.25);
        }
        a {
          color: #7dd3fc;
          font-weight: 800;
          text-decoration: none;
        }
        .eyebrow {
          margin: 28px 0 8px;
          color: #67e8f9;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }
        h1 {
          margin: 0 0 12px;
          color: white;
          font-size: 38px;
        }
        p {
          color: #94a3b8;
          line-height: 1.65;
        }
        button {
          min-height: 48px;
          margin-top: 12px;
          border: 0;
          border-radius: 14px;
          padding: 0 18px;
          color: white;
          background: linear-gradient(135deg, #2563eb, #0891b2);
          font-weight: 900;
          cursor: pointer;
        }
        pre {
          overflow: auto;
          margin-top: 20px;
          padding: 16px;
          border-radius: 14px;
          font-size: 12px;
          line-height: 1.5;
          white-space: pre-wrap;
        }
        pre.success {
          color: #bbf7d0;
          background: rgba(20, 83, 45, 0.35);
        }
        pre.error {
          color: #fecaca;
          background: rgba(127, 29, 29, 0.35);
        }
        .links {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid rgba(148, 163, 184, 0.15);
        }
      `}</style>
    </main>
  );
}
