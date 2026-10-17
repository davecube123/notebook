// Shared helpers: dates, escaping, text, small DOM conveniences.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

// ---------- dates (all "day keys" are local YYYY-MM-DD) ----------
const pad = n => String(n).padStart(2, '0');
export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
export const parseDay = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (key, n) => { const d = parseDay(key); d.setDate(d.getDate() + n); return ymd(d); };
export const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000);
export const hm = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const fmtCache = {};
const fmt = (opts) => {
  const k = JSON.stringify(opts);
  return fmtCache[k] || (fmtCache[k] = new Intl.DateTimeFormat(undefined, opts));
};
export const fmtDay = (key, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => fmt(opts).format(parseDay(key));
export const fmtLongDay = key => fmt({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(parseDay(key));
export const fmtMonth = (y, m) => fmt({ month: 'long', year: 'numeric' }).format(new Date(y, m, 1));
export const fmtTime = ts => fmt({ hour: 'numeric', minute: '2-digit' }).format(new Date(ts));
export const fmtDateTime = ts => fmt({ month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(ts));
export const fmtShort = ts => {
  const d = new Date(ts);
  const key = ymd(d), t = today();
  if (key === t) return fmtTime(ts);
  if (key === addDays(t, -1)) return 'Yesterday';
  if (daysBetween(key, t) < 7) return fmt({ weekday: 'long' }).format(d);
  if (d.getFullYear() === new Date().getFullYear()) return fmt({ month: 'short', day: 'numeric' }).format(d);
  return fmt({ month: 'short', day: 'numeric', year: 'numeric' }).format(d);
};
export const weekdayNames = (start = 1) => {
  const base = new Date(2024, 0, 7); // a Sunday
  const names = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(base); d.setDate(base.getDate() + ((i + start) % 7));
    names.push(fmt({ weekday: 'narrow' }).format(d));
  }
  return names;
};

export function relDays(key) {
  const n = daysBetween(key, today());
  if (n === 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n === -1) return 'tomorrow';
  if (n > 0) return n < 60 ? `${n} days ago` : n < 730 ? `${Math.round(n / 30)} months ago` : `${Math.round(n / 365)} years ago`;
  return `in ${-n} days`;
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ---------- text ----------
export function htmlToText(html) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  d.querySelectorAll('li, p, div, h1, h2, h3, blockquote, pre, br').forEach(el => el.append('\n'));
  return d.textContent.replace(/\n{3,}/g, '\n\n').trim();
}

export function snippet(text, query, len = 140) {
  text = (text || '').replace(/\s+/g, ' ').trim();
  if (!query) return text.slice(0, len);
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return text.slice(0, len);
  const start = Math.max(0, i - 40);
  return (start > 0 ? '…' : '') + text.slice(start, start + len);
}

export function highlight(text, query) {
  const safe = esc(text);
  if (!query) return safe;
  const q = esc(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(q, 'ig'), m => `<mark>${m}</mark>`);
}

export const normTag = t => t.trim().replace(/^#+/, '').replace(/\s+/g, '-').toLowerCase().slice(0, 40);

export function initials(name) {
  const parts = (name || '?').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts.at(-1)[0] : '')).toUpperCase() || '?';
}

// Stable pleasant color from a string
const PALETTE = ['#E0583A', '#D9822B', '#C9A227', '#5B9A47', '#2F9C8F', '#3A7BD5', '#6A5ACD', '#A35CC8', '#D0508A', '#7A8794'];
export function colorFor(str) {
  let h = 0;
  for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % (PALETTE.length - 1)];
}
export const COLORS = PALETTE;

export function debounce(fn, ms = 300) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); fn(...a); };
  return d;
}

export function haptic(ms = 10) { try { navigator.vibrate?.(ms); } catch {} }

export async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Resize an image file to a square-ish JPEG data URL (keeps the DB small)
export function resizeImage(file, max = 320) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function download(filename, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
