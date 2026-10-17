// Install help: uses the browser's install prompt when there is one, and otherwise
// explains the right steps (iOS Safari, Android in-app browsers, desktop).
import { icon } from './icons.js';
import { toast } from './ui.js';

export const installPrompt = { event: null };

const ua = navigator.userAgent;
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(ua);

export const isInstalled = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// Opens this page in Chrome from any Android browser, including in-app ones
const chromeIntent = () => `intent://${location.host}${location.pathname}#Intent;scheme=https;package=com.android.chrome;end`;

const DISMISS_KEY = 'almanac-install-dismissed';
const dismissed = () => { try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; } };

function help() {
  if (installPrompt.event) return { text: 'Add Almanac to your home screen. It opens full-screen and works offline.', action: `<button class="btn primary sm" data-install="prompt">${icon('install')}Install</button>` };
  if (isIOS) return { text: 'In Safari, tap the Share button, then “Add to Home Screen”.' };
  // No install prompt on Android usually means an in-app browser (opened from X, Gmail, GCash…),
  // which can't install and looks just like Chrome, so always offer the way out to Chrome itself
  if (isAndroid) return {
    text: 'Open Almanac in Chrome, then tap ⋮ (top right) → “Install app”. Browsers inside other apps can’t install it.',
    action: `<a class="btn primary sm" href="${chromeIntent()}">Open in Chrome</a>`,
  };
  return { text: 'In Chrome or Edge, click the install icon at the right of the address bar.' };
}

// Card for the Today page; empty once installed or dismissed
export function installCard() {
  if (isInstalled() || dismissed()) return '';
  const h = help();
  return `<div class="card pad install-card">
    <div class="card-head"><h3>Install Almanac</h3><button class="icon-btn sm" data-install="dismiss" aria-label="Dismiss">${icon('x')}</button></div>
    <p class="muted small">${h.text}</p>${h.action ? `<div class="install-action">${h.action}</div>` : ''}
  </div>`;
}

// Row for Settings; always available until installed
export function installRow() {
  if (isInstalled()) return '';
  const h = help();
  return `<div class="list-row"><span class="grow">Install app<div class="muted small">${h.text}</div></span>${h.action || ''}</div>`;
}

export function bindInstall(root, after) {
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-install]');
    if (!b) return;
    if (b.dataset.install === 'dismiss') { try { localStorage.setItem(DISMISS_KEY, '1'); } catch {} after?.(); }
    if (b.dataset.install === 'prompt' && installPrompt.event) {
      installPrompt.event.prompt();
      const { outcome } = await installPrompt.event.userChoice;
      if (outcome === 'accepted') installPrompt.event = null;
      after?.();
    }
  });
}

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt.event = e; document.dispatchEvent(new CustomEvent('install-available')); });
window.addEventListener('appinstalled', () => { installPrompt.event = null; toast('Installed — find Almanac on your home screen'); });
