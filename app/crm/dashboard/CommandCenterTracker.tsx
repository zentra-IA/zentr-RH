"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const HEARTBEAT_INTERVAL_MS = 30_000;
const IDLE_THRESHOLD_MS = 60_000;

type TrackerPayload = {
  event: "page_enter" | "page_leave";
  route: string;
  page: string;
  module: string;
  duration?: number;
  enteredAt?: string;
  leftAt?: string;
  idleSeconds?: number;
};

function getModuleFromRoute(route: string): string {
  if (route.includes("/clients")) return "clientes";
  if (route.includes("/jobs")) return "vagas";
  if (route.includes("/candidates")) return "candidatos";
  if (route.includes("/interviews")) return "entrevistas";
  if (route.includes("/hirings")) return "contratacoes";
  if (route.includes("/tasks")) return "tarefas";
  if (route.includes("/inbox")) return "inbox";
  if (route.includes("/messages")) return "mensagens";
  if (route.includes("/contacts")) return "disparos";
  if (route.includes("/whatsapp")) return "whatsapp";
  if (route.includes("/command-center")) return "centro_de_comando";

  return "dashboard";
}

function getPageName(route: string): string {
  const pages: Array<[string, string]> = [
    ["/clients", "Clientes"],
    ["/jobs", "Vagas"],
    ["/candidates", "Candidatos"],
    ["/interviews", "Entrevistas"],
    ["/hirings", "Contratações"],
    ["/tasks", "Tarefas"],
    ["/inbox", "Inbox"],
    ["/messages", "Mensagens"],
    ["/contacts", "Disparar contatos"],
    ["/crm/whatsapp", "WhatsApp"],
    ["/command-center", "Centro de Comando"],
  ];

  const match = pages.find(([fragment]) => route.includes(fragment));

  return match?.[1] || "Dashboard";
}

async function sendTrack(payload: TrackerPayload): Promise<void> {
  try {
    await fetch("/api/command-center/track", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // O rastreamento nunca deve quebrar a navegação do usuário.
  }
}

function sendTrackBeacon(payload: TrackerPayload): void {
  try {
    const blob = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });

    navigator.sendBeacon("/api/command-center/track", blob);
  } catch {
    // Falha silenciosa para não bloquear a saída da página.
  }
}

export default function CommandCenterTracker() {
  const pathname = usePathname();

  const enteredAtRef = useRef<number>(Date.now());
  const lastInteractionRef = useRef<number>(Date.now());
  const currentRouteRef = useRef<string>(pathname || "/crm/dashboard");
  const leaveSentRef = useRef<boolean>(false);

  useEffect(() => {
    const route = pathname || "/crm/dashboard";
    const page = getPageName(route);
    const module = getModuleFromRoute(route);

    currentRouteRef.current = route;
    enteredAtRef.current = Date.now();
    lastInteractionRef.current = Date.now();
    leaveSentRef.current = false;

    void sendTrack({
      event: "page_enter",
      route,
      page,
      module,
      enteredAt: new Date().toISOString(),
      idleSeconds: 0,
    });

    return () => {
      if (leaveSentRef.current) return;

      leaveSentRef.current = true;

      const duration = Math.max(
        0,
        Math.floor((Date.now() - enteredAtRef.current) / 1000)
      );

      const idleSeconds = Math.max(
        0,
        Math.floor((Date.now() - lastInteractionRef.current) / 1000)
      );

      sendTrackBeacon({
        event: "page_leave",
        route,
        page,
        module,
        duration,
        idleSeconds,
        leftAt: new Date().toISOString(),
      });
    };
  }, [pathname]);

  useEffect(() => {
    const markActivity = () => {
      lastInteractionRef.current = Date.now();
    };

    const interactionEvents: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "focus",
    ];

    interactionEvents.forEach((eventName) => {
      window.addEventListener(eventName, markActivity, {
        passive: true,
      });
    });

    return () => {
      interactionEvents.forEach((eventName) => {
        window.removeEventListener(eventName, markActivity);
      });
    };
  }, []);

  useEffect(() => {
    const sendHeartbeat = async () => {
      const route = currentRouteRef.current || "/crm/dashboard";
      const idleMilliseconds = Date.now() - lastInteractionRef.current;
      const idleSeconds = Math.max(
        0,
        Math.floor(idleMilliseconds / 1000)
      );

      try {
        await fetch("/api/command-center/heartbeat", {
          method: "POST",
          credentials: "include",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            route,
            page: getPageName(route),
            module: getModuleFromRoute(route),
            idleSeconds,
            idle: idleMilliseconds >= IDLE_THRESHOLD_MS,
            visible: document.visibilityState === "visible",
            screenWidth: window.screen?.width || null,
            screenHeight: window.screen?.height || null,
          }),
        });
      } catch {
        // A presença não deve interferir no funcionamento do CRM.
      }
    };

    void sendHeartbeat();

    const intervalId = window.setInterval(
      sendHeartbeat,
      HEARTBEAT_INTERVAL_MS
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        lastInteractionRef.current = Date.now();
      }

      void sendHeartbeat();
    };

    window.addEventListener("focus", sendHeartbeat);
    window.addEventListener("online", sendHeartbeat);
    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", sendHeartbeat);
      window.removeEventListener("online", sendHeartbeat);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (leaveSentRef.current) return;

      leaveSentRef.current = true;

      const route = currentRouteRef.current || "/crm/dashboard";
      const duration = Math.max(
        0,
        Math.floor((Date.now() - enteredAtRef.current) / 1000)
      );

      const idleSeconds = Math.max(
        0,
        Math.floor((Date.now() - lastInteractionRef.current) / 1000)
      );

      sendTrackBeacon({
        event: "page_leave",
        route,
        page: getPageName(route),
        module: getModuleFromRoute(route),
        duration,
        idleSeconds,
        leftAt: new Date().toISOString(),
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  return null;
}
