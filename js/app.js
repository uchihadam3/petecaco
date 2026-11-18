// Instalação (PWA) e atualização automática do Petecaço
export const APP_VERSION = '1.3.0';

const $ = (s) => document.querySelector(s);
let deferredPrompt = null;
let pendingReload = false;
let canReloadNow = () => true;

export function isInstalled() {
  return matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function refreshButton() {
  const b = $('#install-btn');
  if (!b) return;
  const show = !isInstalled() && (deferredPrompt || isIOS());
  b.hidden = !show;
}

export function initApp({ toast, isSafe }) {
  if (isSafe) canReloadNow = isSafe;
  const btn = $('#install-btn');

  // ---- botão instalar ----
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; refreshButton(); });
  addEventListener('appinstalled', () => { deferredPrompt = null; refreshButton(); toast('📲', 'Petecaço instalado!', 'Agora é só abrir pelo ícone.'); });
  if (btn) btn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (e) { /* ignore */ }
      deferredPrompt = null; refreshButton();
    } else {
      $('#install-modal').classList.add('show');
    }
  });
  const close = $('#install-close');
  if (close) close.addEventListener('click', () => $('#install-modal').classList.remove('show'));
  refreshButton();

  applyOrientation();

  // ---- service worker + atualização automática ----
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
    const check = () => reg.update().catch(() => {});
    setInterval(check, 15 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    addEventListener('online', check);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('⬇️', 'Atualização baixada', 'Vai aplicar quando você voltar ao menu.');
      });
    });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return; } // primeira instalação, nada a recarregar
    pendingReload = true;
    applyUpdateIfSafe();
  });
}

// orientação da tela no app instalado: 'portrait' (padrão), 'landscape' ou 'auto'
export function applyOrientation(mode) {
  mode = mode || (window.__petecacoOrientation && window.__petecacoOrientation()) || 'portrait';
  const so = screen.orientation;
  if (!so || !so.lock) return;
  if (mode === 'auto') { try { so.unlock(); } catch (e) { /* ok */ } return; }
  so.lock(mode === 'landscape' ? 'landscape' : 'portrait').catch(() => {});
}

// chamado quando o jogador volta ao menu
export function applyUpdateIfSafe() {
  if (!pendingReload || !canReloadNow()) return;
  pendingReload = false;
  const t = document.createElement('div');
  t.className = 'update-overlay';
  t.innerHTML = '<div>✨<b>Nova versão!</b><small>Atualizando o Petecaço...</small></div>';
  document.body.appendChild(t);
  setTimeout(() => location.reload(), 900);
}
