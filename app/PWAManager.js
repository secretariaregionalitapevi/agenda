"use client";

import { useEffect, useState } from "react";

const DISMISSED_KEY = "ccb-agenda-install-dismissed";
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isAndroid = () => /android/i.test(navigator.userAgent);
const isInstalled = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

const css = `
  .pwa-overlay{position:fixed;inset:0;z-index:10001;display:flex;align-items:flex-end;justify-content:center;padding:16px;background:rgba(15,23,42,.62);backdrop-filter:blur(3px)}
  .pwa-card{width:min(100%,430px);box-sizing:border-box;padding:24px 22px 20px;border-radius:22px;background:#fff;color:#1e293b;box-shadow:0 24px 70px rgba(0,0,0,.32);text-align:center;animation:pwa-up .35s ease}
  .pwa-icon{width:72px;height:72px;border-radius:17px;box-shadow:0 6px 18px rgba(26,58,92,.22)}
  .pwa-eyebrow{margin:14px 0 5px;color:#2563b0;font-size:12px;font-weight:800;letter-spacing:.12em}.pwa-title{margin:0;font-size:24px;line-height:1.2}.pwa-description{margin:9px 0 16px;color:#64748b;font-size:15px;line-height:1.45}
  .pwa-instructions{margin-bottom:16px;padding:13px;border-radius:13px;background:#eef4fb;color:#334155;font-size:14px;line-height:1.5}.pwa-actions{display:grid;gap:9px}
  .pwa-primary,.pwa-secondary{width:100%;border:0;cursor:pointer}.pwa-primary{padding:12px 16px;border-radius:12px;background:#1a3a5c;color:#fff;font-size:15px;font-weight:700}.pwa-secondary{padding:10px 16px;background:transparent;color:#64748b;font-size:14px}
  .pwa-toast{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:10000;display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:12px;background:#1e293b;color:#fff;box-shadow:0 4px 20px rgba(0,0,0,.35);font-size:14px;white-space:nowrap}
  .pwa-update{padding:6px 12px;border:0;border-radius:8px;background:#3b82f6;color:#fff;font-weight:700;cursor:pointer}.pwa-toast-close{border:0;background:transparent;color:rgba(255,255,255,.7);font-size:20px;cursor:pointer}
  @keyframes pwa-up{from{transform:translateY(35px);opacity:0}to{transform:translateY(0);opacity:1}}
  @media(min-width:600px){.pwa-overlay{align-items:center}}
`;

export default function PWAManager() {
  const [prompt, setPrompt] = useState(null);
  const [platform, setPlatform] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    const mobilePlatform = isIos() ? "ios" : isAndroid() ? "android" : null;
    setPlatform(mobilePlatform);
    const timer = window.setTimeout(() => {
      if (mobilePlatform && !isInstalled() && !sessionStorage.getItem(DISMISSED_KEY)) setShowInstall(true);
    }, 1200);

    let refreshing = false;
    const controllerChanged = () => {
      if (!refreshing) { refreshing = true; window.location.reload(); }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        if (registration.waiting) { setWaitingWorker(registration.waiting); setShowUpdate(true); }
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              setWaitingWorker(worker); setShowUpdate(true);
            }
          });
        });
      }).catch((error) => console.warn("[PWA] Falha ao registrar service worker:", error));
      navigator.serviceWorker.addEventListener("controllerchange", controllerChanged);
    }

    const beforeInstall = (event) => { event.preventDefault(); setPrompt(event); };
    const installed = () => { setShowInstall(false); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
      navigator.serviceWorker?.removeEventListener("controllerchange", controllerChanged);
    };
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setShowInstall(false);
  };

  const install = async () => {
    if (!prompt) { setShowFallback(true); return; }
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
    setShowInstall(false);
  };

  const update = () => {
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
    setShowUpdate(false);
  };

  return <>
    <style>{css}</style>
    {showUpdate && <div className="pwa-toast" role="alert" aria-live="polite">
      <span>Nova versão disponível!</span>
      <button type="button" className="pwa-update" onClick={update}>Atualizar</button>
      <button type="button" className="pwa-toast-close" onClick={() => setShowUpdate(false)} aria-label="Fechar">×</button>
    </div>}

    {showInstall && platform && <div className="pwa-overlay" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={(event) => event.target === event.currentTarget && dismiss()}>
      <section className="pwa-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="pwa-icon" />
        <p className="pwa-eyebrow">ACESSO RÁPIDO</p>
        <h2 id="install-title" className="pwa-title">Instale o CCB Agenda</h2>
        <p className="pwa-description">Use como aplicativo, direto pela tela inicial do celular.</p>

        {platform === "ios" && <div className="pwa-instructions">No Safari, toque em <strong>Compartilhar</strong> <span aria-hidden="true">□↑</span> e depois em <strong>Adicionar à Tela de Início</strong>.</div>}
        {platform === "android" && showFallback && <div className="pwa-instructions">Abra o menu do navegador e escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</div>}

        <div className="pwa-actions">
          {platform === "android" && <button type="button" className="pwa-primary" onClick={install}>Instalar aplicativo</button>}
          <button type="button" className="pwa-secondary" onClick={dismiss}>Agora não</button>
        </div>
      </section>
    </div>}
  </>;
}
