(() => {
  const SEEN_KEY = 'ccb-agenda-install-invitation-v1';
  let deferredPrompt = null;

  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMobile = () => isIos() || /android/i.test(navigator.userAgent);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/', { scope: '/' }).catch(() => {}));
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
  });

  window.addEventListener('appinstalled', () => {
    localStorage.setItem(SEEN_KEY, 'installed');
    document.querySelector('.install-overlay')?.remove();
  });

  function showInvitation() {
    if (!isMobile() || isStandalone() || localStorage.getItem(SEEN_KEY)) return;

    const ios = isIos();
    const overlay = document.createElement('div');
    overlay.className = 'install-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'install-title');
    overlay.innerHTML = `
      <section class="install-card">
        <img src="/?pwa=icon192" alt="" class="install-icon">
        <p class="install-eyebrow">ACESSO RÁPIDO</p>
        <h2 id="install-title">Instale o CCB Agenda</h2>
        <p class="install-description">Use como aplicativo, direto pela tela inicial do celular.</p>
        ${ios
          ? '<div class="install-instructions">No Safari, toque em <strong>Compartilhar</strong> <span aria-hidden="true">□↑</span> e depois em <strong>Adicionar à Tela de Início</strong>.</div>'
          : '<div class="install-instructions install-fallback" hidden>Abra o menu do navegador e escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</div>'}
        <div class="install-actions">
          ${ios ? '' : '<button type="button" class="install-primary">Instalar aplicativo</button>'}
          <button type="button" class="install-secondary">Agora não</button>
        </div>
      </section>`;

    const close = () => {
      localStorage.setItem(SEEN_KEY, 'dismissed');
      overlay.remove();
    };
    overlay.querySelector('.install-secondary').addEventListener('click', close);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });

    const installButton = overlay.querySelector('.install-primary');
    installButton?.addEventListener('click', async () => {
      if (!deferredPrompt) {
        overlay.querySelector('.install-fallback').hidden = false;
        installButton.hidden = true;
        return;
      }
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      localStorage.setItem(SEEN_KEY, choice.outcome);
      overlay.remove();
    });

    document.body.appendChild(overlay);
  }

  window.addEventListener('DOMContentLoaded', () => window.setTimeout(showInvitation, 1200));
})();
