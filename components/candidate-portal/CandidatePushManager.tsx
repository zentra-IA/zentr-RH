"use client";

import { useEffect, useMemo, useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  return Uint8Array.from(
    [...window.atob(base64)].map((character) => character.charCodeAt(0))
  );
}

function isIOSDevice() {
  if (typeof navigator === "undefined") return false;

  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;

  const nav = navigator as Navigator & { standalone?: boolean };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

export default function CandidatePushManager({
  portalToken,
}: {
  portalToken: string;
}) {
  const [supported, setSupported] = useState(false);
  const [checking, setChecking] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [standalone, setStandalone] = useState(false);

  const needsInstall = useMemo(
    () => isIOS && !standalone,
    [isIOS, standalone]
  );

  useEffect(() => {
    let cancelled = false;

    async function initPush() {
      setIsIOS(isIOSDevice());
      setStandalone(isStandaloneMode());

      const ok =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      if (!cancelled) {
        setSupported(ok);
      }

      if (!ok) {
        if (!cancelled) {
          setChecking(false);
        }
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register(
          "/candidato/sw.js",
          { scope: "/candidato/" }
        );

        const subscription =
          await registration.pushManager.getSubscription();

        const active =
          Boolean(subscription) &&
          Notification.permission === "granted";

        if (!cancelled) {
          setEnabled(active);
        }
      } catch (error) {
        console.error("Candidate Push init:", error);
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }

    void initPush();

    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    if (needsInstall) {
      alert(
        'No iPhone, toque em Compartilhar → "Adicionar à Tela de Início". Depois abra o Portal MOTIVAR pelo ícone criado e ative as notificações.'
      );
      return;
    }

    try {
      setLoading(true);

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!publicKey) {
        throw new Error(
          "NEXT_PUBLIC_VAPID_PUBLIC_KEY não configurada."
        );
      }

      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        throw new Error(
          "A permissão de notificações não foi concedida."
        );
      }

      const registration = await navigator.serviceWorker.ready;

      let subscription =
        await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      }

      const response = await fetch(
        `/api/candidate-portal/${encodeURIComponent(portalToken)}/push`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.error || "Não foi possível ativar o Push."
        );
      }

      setEnabled(true);
    } catch (error: any) {
      alert(error?.message || "Erro ao ativar notificações.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return null;
  }

  if (!supported) {
    return (
      <div className="cp-push-card">
        <div>
          <strong>🔕 Notificações indisponíveis</strong>
          <span>
            Este navegador não oferece suporte a Web Push.
          </span>
        </div>
      </div>
    );
  }

  if (needsInstall) {
    return (
      <div className="cp-push-card warning">
        <div>
          <strong>📲 Instale o Portal no iPhone</strong>
          <span>
            Safari → Compartilhar → Adicionar à Tela de Início.
            Depois abra pelo ícone MOTIVAR e ative as notificações.
          </span>
        </div>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="cp-push-card">
        <div>
          <strong>🔔 Ative as notificações da MOTIVAR</strong>
          <span>
            Receba novas vagas, entrevistas, mensagens e mudanças
            dos seus processos.
          </span>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => void enable()}
        >
          {loading ? "Ativando..." : "Ativar notificações"}
        </button>
      </div>
    );
  }

  return (
    <div className="cp-push-card enabled">
      <div className="cp-push-head">
        <div>
          <strong>✅ Push ativo neste dispositivo</strong>
          <span>
            Você receberá avisos importantes da MOTIVAR RH.
          </span>
        </div>
      </div>

      <div className="cp-pref-grid">
        <span>💼 Novas vagas</span>
        <span>📅 Entrevistas</span>
        <span>🎯 Atualizações dos processos</span>
        <span>💬 Mensagens da MOTIVAR</span>
        <span>📄 Documentos e contratação</span>
      </div>
    </div>
  );
}
