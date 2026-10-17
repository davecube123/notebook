// Hash router. Views are { match: RegExp, render(main, params, query) => cleanup? }.
const routes = [];
let cleanup = null;
let current = null;
const beforeLeave = new Set();

export function route(pattern, render, opts = {}) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ re, keys, render, ...opts });
}

export function parseHash() {
  const raw = location.hash.slice(1) || '/today';
  const [path, qs = ''] = raw.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(qs)) };
}

export function navigate(hash, { replace = false } = {}) {
  if (!hash.startsWith('#')) hash = '#' + hash;
  if (replace) history.replaceState(null, '', hash), resolve();
  else if (location.hash === hash) resolve();
  else location.hash = hash;
}

// Registered hooks run before leaving a route (e.g. discard empty drafts)
export function onLeave(fn) { beforeLeave.add(fn); return () => beforeLeave.delete(fn); }

export function resolve({ keepScroll = false } = {}) {
  const { path, query } = parseHash();
  const main = document.getElementById('main');
  const scroll = keepScroll ? main.scrollTop : 0;
  for (const r of routes) {
    const m = path.match(r.re);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const next = { r, params, query, path };
    if (!keepScroll) { beforeLeave.forEach(fn => fn(next)); }
    if (typeof cleanup === 'function') cleanup();
    current = next;
    main.dataset.view = r.name || '';
    cleanup = r.render(main, params, query) || null;
    main.scrollTop = scroll;
    document.dispatchEvent(new CustomEvent('routechange', { detail: next }));
    return;
  }
  navigate('#/today', { replace: true });
}

// Re-render the current view in place (keeps scroll position)
export function rerender() { resolve({ keepScroll: true }); }
export const currentRoute = () => current;
