import webpush, {
  type PushSubscription as WebPushSubscription,
} from "web-push";

let configured = false;

function configureCandidateWebPush() {
  if (configured) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "VAPID não configurado. Defina NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT."
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export type CandidatePushPayload = {
  title: string;
  body: string;
  url: string;
  type:
    | "JOB_OPPORTUNITY"
    | "INTERVIEW"
    | "PROCESS_UPDATE"
    | "MESSAGE"
    | "DOCUMENT";
  tag?: string;
  requireInteraction?: boolean;
  actions?: Array<{
    action: string;
    title: string;
  }>;
};

export async function sendCandidateWebPush(
  subscription: WebPushSubscription,
  payload: CandidatePushPayload
) {
  configureCandidateWebPush();

  return webpush.sendNotification(
    subscription,
    JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url,
      icon: "/candidato/motivar-icon.svg",
      badge: "/candidato/motivar-icon.svg",
      tag:
        payload.tag ||
        `motivar-candidate-${payload.type.toLowerCase()}`,
      type: payload.type,
      requireInteraction: Boolean(payload.requireInteraction),
      renotify: true,
      vibrate: [120, 80, 120],
      actions: payload.actions || [
        { action: "open", title: "Abrir Portal" },
      ],
    }),
    {
      TTL: 60 * 60 * 12,
      urgency: "high",
    }
  );
}
