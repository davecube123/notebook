// App shell: navigation, routing, theme, global search, shortcuts, lock, PWA plumbing.
import { loadAll, settings, list, subscribe } from './db.js';
import { esc, today, fmtShort, fmtDay, snippet, highlight, sha256, debounce, $ } from './util.js';
import { icon } from './icons.js';
import { route, resolve, navigate, rerender, parseHash, currentRoute } from './router.js';
import { sheet, closeTopSheet, hasOpenSheet, toast } from './ui.js';
import { renderToday } from './views/today.js';
import { renderNotes, newNote, noteTitle } from './views/notes.js';
import { renderOneThing } from './views/onething.js';
import { renderCalendar } from './views/calendar.js';
import { renderPeople, avatar } from './views/people.js';
import { renderHabits } from './views/habits.js';
import { renderSettings } from './views/settings.js';
import { renderFeelings, moods } from './views/feelings.js';
import { APP_VERSION } from './version.js';
import './install.js';


const NAV = [
  ['today', 'Today', 'today', '#/today'],
  ['notes', 'Notes', 'notes', '#/notes'],
  ['onething', 'One Thing', 'target', '#/onething'],
  ['feel', 'Feelings', 'heart', '#/feel'],
  ['habits', 'Habits', 'habits', '#/habits'],
  ['calendar', 'Calendar', 'calendar', '#/calendar'],
  ['people', 'People', 'people', '#/people'],
];
const TABS = ['today', 'notes', 'habits', 'calendar', 'people'];

function renderShell() {
  $('#sidebar').innerHTML = `
    <div class="brand"><span class="brand-mark"></span><span>Almanac</span></div>
    <button class="side-search" data-open-search>${icon('search')}<span>Search</span><kbd>/</kbd></button>
    ${NAV.filter(([k]) => k !== 'feel' || settings().showFeelings).map(([k, l, ic, href]) => `<a class="side-link" data-nav="${k}" href="${href}">${icon(ic)}<span>${l}</span></a>`).join('')}
    <div class="side-tags"></div>
    <div class="side-foot"><a class="side-link" data-nav="settings" href="#/settings">${icon('settings')}<span>Settings</span></a><div class="app-version">Version ${APP_VERSION}</div></div>`;
  $('#tabbar').innerHTML = TABS.map(k => { const [, l, ic, href] = NAV.find(n => n[0] === k); return `<a class="tab" data-nav="${k}" href="${href}">${icon(ic)}<span>${l}</span></a>`; }).join('');
}

function updateNav() {
  const seg = parseHash().path.split('/')[1] || 'today';
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === seg));
  // sidebar tag shortcuts
  const counts = new Map();
  list('notes').forEach(n => !n.trashed && !n.archived && (n.tags || []).forEach(t => counts.set(t, (counts.get(t) || 0) + 1)));
  const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 12);
  const box = $('.side-tags');
  if (box) box.innerHTML = top.length ? `<div class="side-label">Tags</div>${top.map(([t, c]) => `<a class="side-link sm" href="#/notes?tag=${encodeURIComponent(t)}"><span class="hash">#</span><span>${esc(t)}</span><em>${c}</em></a>`).join('')}` : '';
  // the tab bar hides while editing a note on phones
  document.body.classList.toggle('in-editor', /^\/notes\/[^/]+$/.test(parseHash().path));
}

export function applyTheme() {
  const st = settings();
  const root = document.documentElement;
  if (st.theme === 'system') delete root.dataset.theme; else root.dataset.theme = st.theme;
  root.style.setProperty('--accent', st.accent);
  try { localStorage.setItem('almanac-theme', st.theme); localStorage.setItem('almanac-accent', st.accent); } catch {}
  const dark = st.theme === 'dark' || (st.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', dark ? '#000000' : '#F2F2F7'));
}

// ---------- global search (⌘K) ----------
function openSearch() {
  if (document.querySelector('.search-sheet')) return;
  sheet({
    className: 'search-sheet',
    render(body, close) {
      body.innerHTML = `<label class="search-field big">${icon('search')}<input type="search" placeholder="Search notes, people, logs, one things…" autofocus autocomplete="off"></label><div class="search-results"></div>`;
      const inp = body.querySelector('input'), out = body.querySelector('.search-results');
      let sel = 0;
      const run = () => {
        const q = inp.value.trim().toLowerCase();
        if (!q) { out.innerHTML = `<p class="muted small pad-x">Tip: type <b>#tag</b> to jump to tagged notes.</p>`; return; }
        const res = [];
        const tagQ = q.startsWith('#') ? q.slice(1) : null;
        const tq = tagQ ?? q;
        if (tagQ !== null || q.length >= 2) {
          const tags = new Set(); list('notes').forEach(n => !n.trashed && (n.tags || []).forEach(t => t.includes(tq) && tags.add(t)));
          [...tags].sort((a, b) => b.startsWith(tq) - a.startsWith(tq)).slice(0, tagQ !== null ? 8 : 3)
            .forEach(t => res.push({ k: 'Tag', href: `#/notes?tag=${encodeURIComponent(t)}`, html: `<span class="tag-chip">#${esc(t)}</span>` }));
        }
        list('notes').filter(n => !n.trashed && !n.draft && (n.title + ' ' + n.text + ' ' + (n.tags || []).join(' ')).toLowerCase().includes(tagQ ?? q))
          .sort((a, b) => b.updated - a.updated).slice(0, 8)
          .forEach(n => res.push({ k: 'Note', href: `#/notes/${n.id}`, html: `${icon('notes')}<div class="grow"><b>${highlight(noteTitle(n), q)}</b><div class="muted small">${highlight(snippet(n.text, q, 90), q)}</div></div><time class="muted small">${fmtShort(n.updated)}</time>` }));
        if (!tagQ) {
          list('people').filter(p => [p.name, p.summary, ...Object.values(p.fields || {}), ...(p.tags || [])].join(' ').toLowerCase().includes(q)).slice(0, 5)
            .forEach(p => res.push({ k: 'Person', href: `#/people/${p.id}`, html: `${avatar(p, 'sm')}<div class="grow"><b>${highlight(p.name, q)}</b><div class="muted small">${esc(p.summary || p.circle || '')}</div></div>` }));
          list('onething').filter(o => o.text.toLowerCase().includes(q)).sort((a, b) => b.id.localeCompare(a.id)).slice(0, 4)
            .forEach(o => res.push({ k: 'One thing', href: `#/onething`, html: `${icon('target')}<div class="grow">${highlight(o.text, q)}<div class="muted small">${fmtDay(o.id)}${o.done ? ' · done' : ''}</div></div>` }));
          const tmap = new Map(list('trackers').map(t => [t.id, t]));
          list('trackers').filter(t => t.name.toLowerCase().includes(q)).forEach(t => res.push({ k: 'Tracker', href: '#/calendar', html: `<span class="ev-badge" style="--c:${t.color}">${esc(t.emoji)}</span><div class="grow">${highlight(t.name, q)}</div>` }));
          if (settings().showFeelings) moods().filter(m => (m.words.join(' ') + ' ' + (m.note || '')).toLowerCase().includes(q)).reverse().slice(0, 4)
            .forEach(m => res.push({ k: 'Feeling', href: '#/feel', html: `${icon('heart')}<div class="grow">${highlight(m.words.join(', '), q)}<div class="muted small">${fmtDay(m.date)}${m.note ? ' · ' + highlight(snippet(m.note, q, 60), q) : ''}</div></div>` }));
          list('events').filter(e => e.note && e.note.toLowerCase().includes(q)).slice(0, 4)
            .forEach(e => res.push({ k: 'Log', href: `#/calendar?day=${e.date}`, html: `${icon('calendar')}<div class="grow">${highlight(e.note, q)}<div class="muted small">${esc(tmap.get(e.trackerId)?.name || '')} · ${fmtDay(e.date)}</div></div>` }));
          const NAVQ = [['today', 'Today'], ['notes', 'Notes'], ['onething', 'One Thing'], ['habits', 'Habits'], ['calendar', 'Calendar'], ['people', 'People'], ['settings', 'Settings']];
          NAVQ.filter(([, l]) => l.toLowerCase().startsWith(q)).forEach(([k, l]) => res.push({ k: 'Go to', href: `#/${k}`, html: `${icon('chevR')}<div class="grow">${l}</div>` }));
        }
        sel = 0;
        out.innerHTML = res.length ? res.map((r, i) => `<a class="sr ${i === 0 ? 'sel' : ''}" href="${r.href}"><span class="sr-k">${r.k}</span>${r.html}</a>`).join('') : `<p class="muted pad-x">Nothing found for “${esc(q)}”.</p>`;
      };
      run();
      inp.addEventListener('input', debounce(run, 80));
      inp.addEventListener('keydown', e => {
        const items = [...out.querySelectorAll('.sr')];
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
          items.forEach((it, i) => it.classList.toggle('sel', i === sel)); items[sel]?.scrollIntoView({ block: 'nearest' });
        }
        if (e.key === 'Enter' && items[sel]) { e.preventDefault(); close(); location.hash = items[sel].getAttribute('href'); }
      });
      out.addEventListener('click', e => { if (e.target.closest('.sr')) close(); });
    },
  });
}

// ---------- keyboard ----------
let gPending = false;
function onKey(e) {
  const typing = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
  if (e.key === 'Escape') { if (closeTopSheet()) { e.preventDefault(); return; } if (typing) e.target.blur?.(); return; }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !typing) { e.preventDefault(); openSearch(); return; }
  if (typing || e.metaKey || e.ctrlKey || e.altKey || hasOpenSheet()) return;
  if (e.key === '/') { e.preventDefault(); openSearch(); return; }
  if (gPending) {
    gPending = false;
    const map = { t: 'today', n: 'notes', o: 'onething', c: 'calendar', p: 'people', h: 'habits', s: 'settings', ...(settings().showFeelings ? { f: 'feel' } : {}) };
    if (map[e.key]) navigate('#/' + map[e.key]);
    return;
  }
  if (e.key === 'g') { gPending = true; setTimeout(() => gPending = false, 1200); return; }
  if (e.key === 'd') { e.preventDefault(); import('./views/templates.js').then(m => m.openDaily()); }
  if (e.key === 'n') { e.preventDefault(); const n = newNote(); navigate(`#/notes/${n.id}`); }
}

// ---------- lock ----------
function showLock() {
  const st = settings();
  if (!st.lockHash || document.querySelector('.lock-screen')) return Promise.resolve();
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.className = 'lock-screen';
    el.innerHTML = `<form class="lock-box"><div class="brand-mark big"></div><h2>Almanac is locked</h2>
      <input type="password" class="input" placeholder="Passcode" autocomplete="current-password" autofocus aria-label="Passcode">
      <button class="btn primary block">Unlock</button><p class="muted small lock-err" aria-live="polite"></p></form>`;
    document.body.append(el);
    document.getElementById('app').setAttribute('inert', '');
    const f = el.querySelector('form'), inp = f.querySelector('input');
    setTimeout(() => inp.focus(), 50);
    f.onsubmit = async e => {
      e.preventDefault();
      if (await sha256('almanac:' + inp.value) === settings().lockHash) {
        el.classList.add('out'); setTimeout(() => el.remove(), 250);
        document.getElementById('app').removeAttribute('inert'); resolve();
      } else { inp.value = ''; f.querySelector('.lock-err').textContent = 'Wrong passcode'; f.classList.add('shake'); setTimeout(() => f.classList.remove('shake'), 400); }
    };
  });
}

// ---------- boot ----------
async function boot() {
  try {
    await loadAll();
  } catch (err) {
    $('#main').innerHTML = `<div class="page"><div class="empty"><h3>Storage unavailable</h3><p>Your browser blocked local storage (private mode?). Almanac needs it to save your notes.</p></div></div>`;
    console.error(err); return;
  }
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  renderShell();

  route('/today', renderToday, { name: 'today' });
  route('/notes', renderNotes, { name: 'notes' });
  route('/notes/:id', renderNotes, { name: 'note' });
  route('/onething', renderOneThing, { name: 'onething' });
  route('/habits', renderHabits, { name: 'habits' });
  route('/calendar', renderCalendar, { name: 'calendar' });
  route('/people', renderPeople, { name: 'people' });
  route('/people/:id', renderPeople, { name: 'person' });
  route('/settings', renderSettings, { name: 'settings' });
  route('/feel', (main, params, query) => settings().showFeelings ? renderFeelings(main, params, query) : navigate('#/today', { replace: true }), { name: 'feel' });

  document.addEventListener('routechange', () => {
    updateNav();
    document.querySelectorAll('.hm-scroll').forEach(s => { s.scrollLeft = s.scrollWidth; });
  });
  window.addEventListener('hashchange', () => { closeTopSheet(); resolve(); });
  document.addEventListener('keydown', onKey);
  document.addEventListener('open-search', openSearch);
  document.addEventListener('click', e => { if (e.target.closest('[data-open-search]')) openSearch(); });
  document.addEventListener('lock-now', () => showLock());
  document.addEventListener('install-available', () => { if (['today', 'settings'].includes(currentRoute()?.r.name)) rerender(); });
  subscribe(store => { if (store === '*') { applyTheme(); rerender(); } });
  document.addEventListener('features-changed', () => { renderShell(); updateNav(); });

  // When the date rolls over while the app is open (or resumes the next day), refresh
  let day = today();
  const checkDay = () => { if (today() !== day) { day = today(); rerender(); } };
  setInterval(checkDay, 60_000);
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    checkDay();
    if (settings().lockHash && Date.now() - hiddenAt > 5 * 60_000) showLock();
  });

  await showLock();
  resolve();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) toast('A new version is ready', { action: 'Reload', onAction: () => location.reload(), ms: 10000 });
        });
      });
    }).catch(() => {});
  }
}


boot();
