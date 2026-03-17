// ─── CCB Agenda – Service Worker ─────────────────────────────────────────────
// Mude a versão abaixo a cada novo deploy para que os clientes recebam o badge.
const CACHE_VERSION = "ccbagenda-v7";
const ASSETS = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(ASSETS))
    // Não chame skipWaiting() aqui; deixamos o cliente decidir (via mensagem)
    // para que possamos mostrar o toast de "nova versão disponível".
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((k) => (k === CACHE_VERSION ? null : caches.delete(k))))
      )
      .then(() => self.clients.claim())
      .then(() => {
        // Avisa TODOS os clientes abertos que uma nova versão entrou em vigor.
        return self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
          clients.forEach((client) =>
            client.postMessage({ type: "SW_ACTIVATED", version: CACHE_VERSION })
          );
        });
      })
  );
});

// ── Message (skipWaiting a pedido do cliente) ─────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isHtmlRequest =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html") ||
    url.pathname === "/" ||
    url.pathname === "/index.html";

  // APIs: sempre rede; fallback offline JSON.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(req).catch(
        () =>
          new Response(JSON.stringify({ ok: false, error: "offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          })
      )
    );
    return;
  }

  // HTML: rede primeiro (para pegar atualizações), cache como fallback.
  if (isSameOrigin && isHtmlRequest) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy)).catch(() => { });
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/")))
    );
    return;
  }

  // Demais assets: cache primeiro, atualiza em background (stale-while-revalidate).
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy)).catch(() => { });
        return res;
      });
      return cached || fetchPromise;
    })
  );
});
