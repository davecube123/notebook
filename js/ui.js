// Reusable UI primitives: sheets/dialogs, toasts, menus, confirm, confetti.
import { esc } from './util.js';
import { icon } from './icons.js';

// ---------- toast ----------
let toastTimer;
export function toast(msg, { action, onAction, ms = 3200 } = {}) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.append(el); }
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button class="toast-btn">${esc(action)}</button>` : ''}`;
  el.classList.add('show');
  if (action) el.querySelector('button').onclick = () => { el.classList.remove('show'); onAction?.(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ---------- sheet / dialog ----------
// Opens a bottom sheet on phones, a centered dialog on larger screens.
// `render(body, close)` fills the content. Returns { el, close }.
const stack = [];
export function sheet({ title = '', render, onClose, wide = false, className = '' }) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `
    <div class="sheet-backdrop"></div>
    <div class="sheet ${wide ? 'wide' : ''} ${className}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-grabber"></div>
      ${title ? `<header class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></header>` : ''}
      <div class="sheet-body"></div>
    </div>`;
  document.body.append(wrap);
  const body = wrap.querySelector('.sheet-body');
  let closed = false;
  const close = (result) => {
    if (closed) return; closed = true;
    wrap.classList.remove('open');
    stack.splice(stack.indexOf(close), 1);
    setTimeout(() => wrap.remove(), 220);
    onClose?.(result);
  };
  wrap.querySelector('.sheet-backdrop').onclick = () => close();
  wrap.querySelector('[data-close]')?.addEventListener('click', () => close());
  stack.push(close);
  render(body, close);
  requestAnimationFrame(() => wrap.classList.add('open'));
  setTimeout(() => body.querySelector('[autofocus]')?.focus(), 60);

  // swipe down to dismiss on touch
  const sh = wrap.querySelector('.sheet');
  let y0 = null;
  sh.querySelector('.sheet-grabber').addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true });
  sh.addEventListener('touchmove', e => {
    if (y0 == null) return;
    const dy = Math.max(0, e.touches[0].clientY - y0);
    sh.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  sh.addEventListener('touchend', e => {
    if (y0 == null) return;
    const dy = e.changedTouches[0].clientY - y0; y0 = null;
    sh.style.transform = '';
    if (dy > 90) close();
  });
  return { el: wrap, body, close };
}
export function closeTopSheet() { const c = stack.at(-1); if (c) { c(); return true; } return false; }
export const hasOpenSheet = () => stack.length > 0;

export function confirmDialog(message, { ok = 'Delete', danger = true, title = 'Are you sure?' } = {}) {
  return new Promise(resolve => {
    sheet({
      title,
      onClose: r => resolve(!!r),
      render(body, close) {
        body.innerHTML = `<p class="muted">${esc(message)}</p>
          <div class="row-end">
            <button class="btn ghost" data-no>Cancel</button>
            <button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(ok)}</button>
          </div>`;
        body.querySelector('[data-no]').onclick = () => close(false);
        body.querySelector('[data-yes]').onclick = () => close(true);
      },
    });
  });
}

export function promptDialog(title, { value = '', placeholder = '', ok = 'Save', multiline = false, type = 'text' } = {}) {
  return new Promise(resolve => {
    sheet({
      title,
      onClose: r => resolve(r ?? null),
      render(body, close) {
        body.innerHTML = `<form class="stack">
          ${multiline
            ? `<textarea class="input" rows="4" placeholder="${esc(placeholder)}" autofocus>${esc(value)}</textarea>`
            : `<input class="input" type="${type}" placeholder="${esc(placeholder)}" value="${esc(value)}" autofocus>`}
          <div class="row-end"><button type="button" class="btn ghost" data-no>Cancel</button><button class="btn primary">${esc(ok)}</button></div>
        </form>`;
        const f = body.querySelector('form'), inp = f.querySelector('.input');
        body.querySelector('[data-no]').onclick = () => close(null);
        f.onsubmit = e => { e.preventDefault(); close(inp.value.trim()); };
      },
    });
  });
}

// ---------- popover menu anchored to an element ----------
export function menu(anchor, items) {
  document.querySelector('.menu-pop')?.remove();
  const m = document.createElement('div');
  m.className = 'menu-pop';
  m.innerHTML = items.filter(Boolean).map((it, i) => it === '-' ? '<hr>' :
    `<button data-i="${i}" class="${it.danger ? 'danger' : ''}">${it.icon ? icon(it.icon) : ''}<span>${esc(it.label)}</span>${it.checked ? icon('check', 'menu-check') : ''}</button>`).join('');
  document.body.append(m);
  const r = anchor.getBoundingClientRect();
  const mw = m.offsetWidth, mh = m.offsetHeight;
  let left = Math.min(window.innerWidth - mw - 8, Math.max(8, r.right - mw));
  let top = r.bottom + 6;
  if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
  m.style.left = left + 'px'; m.style.top = top + 'px';
  const list = items.filter(Boolean);
  const off = (e) => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('pointerdown', off, true); } };
  setTimeout(() => document.addEventListener('pointerdown', off, true));
  m.addEventListener('click', e => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    m.remove(); document.removeEventListener('pointerdown', off, true);
    items.filter(Boolean)[+b.dataset.i]?.action?.();
  });
  requestAnimationFrame(() => m.classList.add('open'));
  return list;
}

// ---------- confetti (tiny, dependency-free) ----------
export function confetti(originEl) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio;
  document.body.append(c);
  const ctx = c.getContext('2d');
  ctx.scale(devicePixelRatio, devicePixelRatio);
  const r = originEl?.getBoundingClientRect();
  const ox = r ? r.left + r.width / 2 : innerWidth / 2, oy = r ? r.top + r.height / 2 : innerHeight / 3;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#E0583A';
  const colors = [accent, '#F2C14E', '#5B9A47', '#3A7BD5', '#D0508A', '#2F9C8F'];
  const parts = Array.from({ length: 90 }, () => ({
    x: ox, y: oy, vx: (Math.random() - .5) * 12, vy: -Math.random() * 11 - 3,
    s: Math.random() * 6 + 4, r: Math.random() * 6, vr: (Math.random() - .5) * .4,
    c: colors[(Math.random() * colors.length) | 0], life: 0,
  }));
  let frame = 0;
  (function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts.forEach(p => {
      p.vy += .32; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      ctx.globalAlpha = Math.max(0, 1 - frame / 110);
      ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
    });
    if (++frame < 110) requestAnimationFrame(tick); else c.remove();
  })();
}

// Emoji quick-picker used by trackers and habits
export const EMOJIS = ['✨','🌅','🌇','🏃','🧘','💪','📚','✍️','💧','🥗','😴','🚶','🧠','🙏','🎯','🎨','🎸','🧹','💊','☕','🚭','🍷','📵','🌳','🏊','🚴','🧗','💻','💰','❤️','🔥','🌙','☀️','🌊','📞','🍳','🛁','🧴','🦷','📝','🎧','⚽','🏋️','🧑‍🍳','🐕','🌱','🗣️','💤','🎉','📍'];

export function emojiPicker(current, onPick) {
  return `<div class="emoji-grid">${EMOJIS.map(e => `<button type="button" class="emoji-opt ${e === current ? 'sel' : ''}" data-emoji="${e}">${e}</button>`).join('')}</div>`;
}
