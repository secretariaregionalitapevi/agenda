"use client";

import { useEffect, useState } from "react";

// ─── Estilos inline (sem dependências externas) ───────────────────────────────
const S = {
    // Banner de instalação (bottom sheet)
    banner: {
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "linear-gradient(135deg, #1a3a5c 0%, #2563b0 100%)",
        color: "#fff",
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        boxShadow: "0 -4px 24px rgba(0,0,0,0.25)",
        borderRadius: "16px 16px 0 0",
        animation: "slideUp 0.4s ease",
    },
    icon: {
        width: 52,
        height: 52,
        borderRadius: 12,
        objectFit: "cover",
        flexShrink: 0,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    },
    texts: { flex: 1 },
    title: { margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.3 },
    sub: { margin: "2px 0 0", fontSize: 13, opacity: 0.85 },
    btnInstall: {
        background: "#fff",
        color: "#1a3a5c",
        border: "none",
        borderRadius: 10,
        padding: "9px 18px",
        fontWeight: 700,
        fontSize: 14,
        cursor: "pointer",
        whiteSpace: "nowrap",
        flexShrink: 0,
    },
    btnClose: {
        background: "none",
        border: "none",
        color: "#fff",
        fontSize: 22,
        cursor: "pointer",
        padding: "0 4px",
        lineHeight: 1,
        opacity: 0.75,
        flexShrink: 0,
    },
    // Toast de nova versão (topo)
    toast: {
        position: "fixed",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10000,
        background: "#1e293b",
        color: "#fff",
        padding: "12px 20px",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 14,
        boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
        whiteSpace: "nowrap",
        animation: "fadeIn 0.3s ease",
    },
    badge: {
        background: "#f59e0b",
        color: "#000",
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 12,
        fontWeight: 700,
    },
    btnUpdate: {
        background: "#3b82f6",
        color: "#fff",
        border: "none",
        borderRadius: 8,
        padding: "6px 14px",
        fontWeight: 700,
        fontSize: 13,
        cursor: "pointer",
    },
    btnDismiss: {
        background: "none",
        border: "none",
        color: "rgba(255,255,255,0.6)",
        fontSize: 20,
        cursor: "pointer",
        lineHeight: 1,
        padding: "0 2px",
    },
};

const KEYFRAMES = `
@keyframes slideUp {
  from { transform: translateY(100%); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0);    }
}
`;

// ─── Componente ───────────────────────────────────────────────────────────────
export default function PWAManager() {
    const [installPrompt, setInstallPrompt] = useState(null);
    const [showBanner, setShowBanner] = useState(false);
    const [waitingSW, setWaitingSW] = useState(null);
    const [showToast, setShowToast] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        // ── 1. Injetar keyframes via <style> ─────────────────────────────────────
        const style = document.createElement("style");
        style.textContent = KEYFRAMES;
        document.head.appendChild(style);

        // ── 2. Registrar Service Worker ──────────────────────────────────────────
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker
                .register("/sw.js")
                .then((reg) => {
                    // SW em espera (atualização já baixada mas aguardando)
                    if (reg.waiting) {
                        setWaitingSW(reg.waiting);
                        setShowToast(true);
                    }

                    // Detecta instalação de novo SW
                    reg.addEventListener("updatefound", () => {
                        const newSW = reg.installing;
                        if (!newSW) return;
                        newSW.addEventListener("statechange", () => {
                            if (newSW.state === "installed" && navigator.serviceWorker.controller) {
                                // Há uma nova versão pronta esperando ativação
                                setWaitingSW(newSW);
                                setShowToast(true);
                            }
                        });
                    });
                })
                .catch((err) => console.warn("[PWA] SW register error:", err));

            // Quando o SW ativa (após SKIP_WAITING), recarrega a página
            let refreshing = false;
            navigator.serviceWorker.addEventListener("controllerchange", () => {
                if (!refreshing) {
                    refreshing = true;
                    window.location.reload();
                }
            });
        }

        // ── 3. Capturar evento de instalação ─────────────────────────────────────
        const onPrompt = (e) => {
            e.preventDefault();
            setInstallPrompt(e);

            // Só mostra o banner se o usuário ainda não dispensou
            const dismissed = sessionStorage.getItem("pwa-banner-dismissed");
            if (!dismissed) setShowBanner(true);
        };
        window.addEventListener("beforeinstallprompt", onPrompt);

        // Esconde o banner se o app já foi instalado
        window.addEventListener("appinstalled", () => {
            setShowBanner(false);
            setInstallPrompt(null);
        });

        return () => {
            window.removeEventListener("beforeinstallprompt", onPrompt);
        };
    }, []);

    // ── Instalar ──────────────────────────────────────────────────────────────
    const handleInstall = async () => {
        if (!installPrompt) return;
        await installPrompt.prompt();
        const result = await installPrompt.userChoice;
        if (result.outcome === "accepted") {
            setShowBanner(false);
            setInstallPrompt(null);
        }
    };

    const dismissBanner = () => {
        setShowBanner(false);
        sessionStorage.setItem("pwa-banner-dismissed", "1");
    };

    // ── Atualizar ─────────────────────────────────────────────────────────────
    const handleUpdate = () => {
        if (waitingSW) {
            waitingSW.postMessage({ type: "SKIP_WAITING" });
        }
        setShowToast(false);
    };

    const dismissToast = () => setShowToast(false);

    return (
        <>
            {/* ── Toast: nova versão disponível ── */}
            {showToast && (
                <div style={S.toast} role="alert" aria-live="polite">
                    <span style={S.badge}>●</span>
                    <span>Nova versão disponível!</span>
                    <button style={S.btnUpdate} onClick={handleUpdate}>
                        Atualizar
                    </button>
                    <button style={S.btnDismiss} onClick={dismissToast} aria-label="Fechar">
                        ×
                    </button>
                </div>
            )}

            {/* ── Banner: instalar app ── */}
            {showBanner && (
                <div style={S.banner} role="complementary" aria-label="Instalar aplicativo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icons/icon-192.png" alt="CCB Agenda" style={S.icon} />
                    <div style={S.texts}>
                        <p style={S.title}>Instale o CCB Agenda</p>
                        <p style={S.sub}>Acesse offline, direto do celular</p>
                    </div>
                    <button style={S.btnInstall} onClick={handleInstall}>
                        Instalar
                    </button>
                    <button style={S.btnClose} onClick={dismissBanner} aria-label="Fechar">
                        ×
                    </button>
                </div>
            )}
        </>
    );
}
