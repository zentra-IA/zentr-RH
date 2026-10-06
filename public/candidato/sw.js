self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;

  try {
    data = event.data.json();
  } catch {
    data = {
      title: "MOTIVAR RH",
      body: event.data.text(),
      url: "/candidato/",
      type: "MESSAGE",
    };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "MOTIVAR RH", {
      body: data.body || "",
      icon: data.icon || "/candidato/motivar-icon.svg",
      badge: data.badge || "/candidato/motivar-icon.svg",
      tag: data.tag || "motivar-candidate",
      renotify: Boolean(data.renotify ?? true),
      requireInteraction: Boolean(data.requireInteraction),
      vibrate: Array.isArray(data.vibrate) ? data.vibrate : [120, 80, 120],
      actions: Array.isArray(data.actions) ? data.actions : undefined,
      data: {
        url: data.url || "/candidato/",
        type: data.type || "MESSAGE",
      },
    })
  );
});

async function trackClick(targetUrl) {
  try {
    const url = new URL(targetUrl, self.location.origin);
    if (!url.pathname.startsWith("/candidato/")) return;

    const token = decodeURIComponent(
      url.pathname.replace(/^\/candidato\//, "").split("/")[0] || ""
    );

    const notificationId = url.searchParams.get("notification_id") || "";
    const deliveryId = url.searchParams.get("delivery_id") || "";

    if (!token || !notificationId || !deliveryId) return;

    await fetch(
      `/api/candidate-portal/${encodeURIComponent(token)}/track`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationId,
          deliveryId,
          event: "clicked",
        }),
      }
    );
  } catch {
    // Tracking nunca impede abertura do Portal.
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || "/candidato/";
  const absolute = new URL(targetUrl, self.location.origin).toString();

  event.waitUntil(
    (async () => {
      await trackClick(targetUrl);

      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of windows) {
        if (
          client.url.startsWith(self.location.origin + "/candidato/") &&
          "navigate" in client &&
          "focus" in client
        ) {
          try {
            await client.navigate(absolute);
            return client.focus();
          } catch {
            // Abre uma nova janela se o navegador impedir navigate.
          }
        }
      }

      return self.clients.openWindow(absolute);
    })()
  );
});
