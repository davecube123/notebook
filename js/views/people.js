// People: profiles with a spy's dossier and a psychiatrist's notes, plus an encounter log.
import { list, get, save, remove, uid, settings, setSettings } from '../db.js';
import { esc, today, fmtDay, relDays, daysBetween, initials, colorFor, resizeImage, debounce, normTag, parseDay, haptic } from '../util.js';
import { icon } from '../icons.js';
import { navigate, rerender } from '../router.js';
import { sheet, toast, confirmDialog, menu } from '../ui.js';
import { SECTIONS, BIG_FIVE, TABS, CIRCLES } from './fields.js';

const ui = { q: '', circle: '', sort: 'recent', hideEmpty: false };
const KEEP_DAYS = { 'Week': 7, '2 weeks': 14, 'Month': 30, '3 months': 90, '6 months': 180, 'Year': 365 };

export const lastSeen = p => (p.interactions || []).map(i => i.date).sort().at(-1) || null;

export function nextBirthday(p) {
  const b = p.fields?.birthday;
  if (!b) return null;
  const t = today();
  let y = +t.slice(0, 4);
  let d = `${y}-${b.slice(5)}`;
  if (d < t) d = `${y + 1}-${b.slice(5)}`;
  const age = +b.slice(0, 4) > 1900 ? +d.slice(0, 4) - +b.slice(0, 4) : null;
  return { date: d, inDays: daysBetween(t, d), age };
}

export function reconnectDue(p) {
  const every = KEEP_DAYS[p.fields?.keepInTouch];
  if (!every) return null;
  const ls = lastSeen(p);
  const gap = ls ? daysBetween(ls, today()) : Infinity;
  return gap > every ? { gap, every } : null;
}

export function avatar(p, size = '') {
  return p.photo
    ? `<span class="avatar ${size}"><img src="${p.photo}" alt=""></span>`
    : `<span class="avatar ${size}" style="--av:${colorFor(p.name)}">${esc(initials(p.name))}</span>`;
}

const subtitle = p => [p.fields?.occupation, p.fields?.workplace && `@ ${p.fields.workplace}`, p.fields?.city].filter(Boolean).join(' · ') || p.summary || p.circle || '';

// ---------------- list ----------------
function listHTML() {
  const q = ui.q.toLowerCase();
  let ps = list('people').filter(p => {
    if (ui.circle === '★') { if (!p.favorite) return false; }
    else if (ui.circle && p.circle !== ui.circle) return false;
    if (!q) return true;
    const hay = [p.name, p.summary, p.circle, ...(p.tags || []), ...Object.values(p.fields || {}), ...(p.interactions || []).map(i => i.note + ' ' + (i.where || ''))].join(' ').toLowerCase();
    return q.split(/\s+/).every(w => hay.includes(w.replace(/^#/, '')));
  });
  const sorters = {
    recent: (a, b) => (lastSeen(b) || b.created && new Date(b.created).toISOString()).localeCompare(lastSeen(a) || new Date(a.created).toISOString()),
    name: (a, b) => a.name.localeCompare(b.name),
    added: (a, b) => b.created - a.created,
  };
  ps.sort(sorters[ui.sort]);
  const all = list('people');
  const circles = CIRCLES.filter(c => all.some(p => p.circle === c));
  const due = all.filter(reconnectDue);
  const bdays = all.map(p => ({ p, b: nextBirthday(p) })).filter(x => x.b && x.b.inDays <= 30).sort((a, b) => a.b.inDays - b.b.inDays);

  const groups = ui.sort === 'name'
    ? Object.entries(ps.reduce((acc, p) => { const k = (p.name[0] || '#').toUpperCase(); (acc[k] = acc[k] || []).push(p); return acc; }, {}))
    : [['', ps]];

  return `<header class="page-head sticky">
    <div class="page-title-row"><h1>People</h1>
      <div class="head-actions"><button class="icon-btn" data-act="sort" aria-label="Sort">${icon('sort')}</button><button class="icon-btn accent" data-act="new" aria-label="Add person">${icon('plus')}</button></div></div>
    <label class="search-field">${icon('search')}<input id="people-search" type="search" placeholder="Search names, traits, places, anything" value="${esc(ui.q)}" autocomplete="off"></label>
    ${all.length ? `<div class="chip-row"><button class="chip ${!ui.circle ? 'on' : ''}" data-circle="">Everyone <span class="chip-count">${all.length}</span></button>
      ${all.some(p => p.favorite) ? `<button class="chip ${ui.circle === '★' ? 'on' : ''}" data-circle="★">${icon('star')}Favorites</button>` : ''}
      ${circles.map(c => `<button class="chip ${ui.circle === c ? 'on' : ''}" data-circle="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}
  </header>
  ${!ui.q && !ui.circle && (due.length || bdays.length) ? `<div class="nudges">
    ${bdays.map(({ p, b }) => `<a class="nudge" href="#/people/${p.id}">${avatar(p, 'sm')}<span><b>${esc(p.name)}</b> ${b.inDays === 0 ? 'has a birthday today 🎂' : `turns ${b.age ?? ''} in ${b.inDays} day${b.inDays > 1 ? 's' : ''}`.replace('turns  in', 'birthday in')}</span></a>`).join('')}
    ${due.map(p => { const r = reconnectDue(p); return `<a class="nudge" href="#/people/${p.id}">${avatar(p, 'sm')}<span>Reconnect with <b>${esc(p.name)}</b> — ${r.gap === Infinity ? 'never logged' : `${r.gap} days`}</span></a>`; }).join('')}
  </div>` : ''}
  ${ps.length ? groups.map(([k, arr]) => `<section class="note-group">${k ? `<h3 class="group-label">${esc(k)}</h3>` : ''}<div class="card list-card">${arr.map(p => {
    const ls = lastSeen(p);
    return `<a class="person-row" href="#/people/${p.id}">${avatar(p)}
      <div class="grow"><div class="person-name">${esc(p.name)}${p.favorite ? `<span class="fav">${icon('star')}</span>` : ''}</div><div class="muted small ellipsis">${esc(subtitle(p))}</div></div>
      <div class="person-meta muted small">${p.circle ? `<span class="circle-pill">${esc(p.circle)}</span>` : ''}${ls ? `<span>${relDays(ls)}</span>` : ''}</div></a>`;
  }).join('')}</div></section>`).join('')
  : all.length ? `<div class="empty">${icon('search', 'empty-ic')}<h3>No one matches</h3></div>`
  : `<div class="empty">${icon('people', 'empty-ic')}<h3>Your people</h3><p>Keep a quiet file on everyone who matters — what they look like, what drives them, what they told you, and when you last saw them.</p><button class="btn primary" data-act="new">${icon('plus')}Add someone</button></div>`}`;
}

export function renderPeople(main, params, query) {
  if (params.id) return renderPerson(main, params.id, query);
  main.innerHTML = `<div class="page people-page">${listHTML()}</div>`;
  const page = main.querySelector('.page');
  const refresh = () => {
    const f = document.activeElement?.id === 'people-search';
    page.innerHTML = listHTML();
    if (f) { const s = page.querySelector('#people-search'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
  };
  const onQ = debounce(refresh, 120);
  page.addEventListener('input', e => { if (e.target.id === 'people-search') { ui.q = e.target.value; onQ(); } });
  page.addEventListener('click', e => {
    const c = e.target.closest('[data-circle]');
    if (c) { ui.circle = c.dataset.circle; return refresh(); }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'new') newPersonSheet();
    if (b.dataset.act === 'sort') menu(b, [
      { label: 'Recently seen', action: () => { ui.sort = 'recent'; refresh(); }, checked: ui.sort === 'recent' },
      { label: 'Name', action: () => { ui.sort = 'name'; refresh(); }, checked: ui.sort === 'name' },
      { label: 'Recently added', action: () => { ui.sort = 'added'; refresh(); }, checked: ui.sort === 'added' },
    ]);
  });
}

export function newPersonSheet(prefill = {}) {
  sheet({
    title: 'New person',
    render(body, close) {
      body.innerHTML = `<form class="stack">
        <label class="field"><span>Name</span><input class="input" name="name" required placeholder="Full name" autofocus autocomplete="off" value="${esc(prefill.name || '')}"></label>
        <label class="field"><span>Who are they, in a line? <em class="faint">optional</em></span><input class="input" name="summary" placeholder="e.g. Designer I met at Maya's party"></label>
        <div class="grid2">
          <label class="field"><span>Circle</span><select class="input" name="circle"><option value="">—</option>${CIRCLES.map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
          <label class="field"><span>First met</span><input class="input" type="date" name="met" value="${today()}"></label>
        </div>
        <label class="field"><span>Where <em class="faint">optional</em></span><input class="input" name="where" placeholder="Café, conference, through a friend…"></label>
        <div class="row-end"><button type="button" class="btn ghost" data-cancel>Cancel</button><button class="btn primary">Create profile</button></div>
      </form>`;
      const f = body.querySelector('form');
      body.querySelector('[data-cancel]').onclick = () => close();
      f.onsubmit = e => {
        e.preventDefault();
        const name = f.name.value.trim(); if (!name) return;
        const p = {
          id: uid(), name, summary: f.summary.value.trim(), circle: f.circle.value, tags: [], favorite: false, photo: null,
          trust: 0, closeness: 0, big5: {}, fields: { metDate: f.met.value, metWhere: f.where.value.trim() },
          interactions: f.met.value ? [{ id: uid(), date: f.met.value, where: f.where.value.trim(), note: 'First met', mood: '' }] : [],
          created: Date.now(), updated: Date.now(),
        };
        save('people', p); close(); navigate(`#/people/${p.id}`);
      };
    },
  });
}

// ---------------- detail ----------------
function propRow(p, def) {
  const [key, label, type = 'text', options] = def;
  const v = p.fields?.[key] || '';
  if (ui.hideEmpty && !v) return '';
  let shown = esc(v);
  if (type === 'date' && v) shown = `${fmtDay(v, { month: 'long', day: 'numeric', year: 'numeric' })} <span class="faint">· ${key === 'birthday' && nextBirthday(p) ? `in ${nextBirthday(p).inDays}d` : relDays(v)}</span>`;
  if (type === 'long' && v) shown = esc(v).replace(/\n/g, '<br>');
  if (key === 'phone' && v) shown = `<a href="tel:${esc(v)}" class="link-inline">${esc(v)}</a>`;
  if (key === 'email' && v) shown = `<a href="mailto:${esc(v)}" class="link-inline">${esc(v)}</a>`;
  return `<div class="prop ${v ? '' : 'is-empty'}" data-field="${key}" data-type="${type}" ${options ? `data-options="${esc(options.join('|'))}"` : ''} tabindex="0" role="button">
    <div class="prop-label">${esc(label)}</div><div class="prop-value">${v ? shown : '<span class="faint">Add…</span>'}</div></div>`;
}

function sectionHTML(p, s, hidden) {
  const fields = s.fields.filter(f => !hidden.includes(f[0]));
  if (!fields.length) return '';
  const rows = fields.map(f => propRow(p, f)).join('');
  if (!rows) return '';
  const filled = fields.filter(f => p.fields?.[f[0]]).length;
  return `<section class="prop-section"><h3 class="group-label">${icon(s.icon)}${esc(s.title)}<span class="count">${filled}/${fields.length}</span></h3><div class="card props">${rows}</div></section>`;
}

function scale(name, label, val, lo = 'Low', hi = 'High') {
  return `<div class="scale-row"><span class="scale-label">${label}</span><div class="scale" data-scale="${name}">${[1, 2, 3, 4, 5].map(n => `<button class="${val >= n ? 'on' : ''}" data-v="${n}" aria-label="${label} ${n}"></button>`).join('')}</div></div>`;
}

function tabHTML(p, tab) {
  const st = settings();
  const hidden = st.hiddenPersonFields;
  if (tab === 'log') {
    const ints = [...(p.interactions || [])].sort((a, b) => b.date.localeCompare(a.date));
    return `<form class="card pad log-form" data-log-form>
        <div class="grid2"><input class="input" type="date" name="date" value="${today()}" aria-label="Date"><input class="input" name="where" placeholder="Where" aria-label="Where"></div>
        <textarea class="input" name="note" rows="2" placeholder="What happened? What did you learn about them?" aria-label="Note"></textarea>
        <div class="row-between"><div class="mood-pick">${['😊', '😐', '😟', '😡', '🥰', '🤔'].map(m => `<button type="button" data-mood="${m}">${m}</button>`).join('')}</div><button class="btn primary sm">${icon('plus')}Log encounter</button></div>
      </form>
      ${ints.length ? `<div class="timeline">${ints.map(i => `<div class="tl-item"><div class="tl-dot"></div><div class="tl-body">
        <div class="tl-head"><b>${fmtDay(i.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</b><span class="muted small">${relDays(i.date)}${i.where ? ' · ' + esc(i.where) : ''}</span>${i.mood ? `<span>${i.mood}</span>` : ''}
        <button class="icon-btn sm" data-int-del="${i.id}" aria-label="Delete">${icon('x')}</button></div>
        ${i.note ? `<div class="tl-note">${esc(i.note).replace(/\n/g, '<br>')}</div>` : ''}</div></div>`).join('')}</div>`
      : '<p class="muted">No encounters logged yet.</p>'}`;
  }
  let html = SECTIONS.filter(s => s.tab === tab).map(s => sectionHTML(p, s, hidden)).join('');
  if (tab === 'profile' && st.customPersonFields.length) {
    html += sectionHTML(p, { id: 'custom', title: 'Custom', icon: 'edit', fields: st.customPersonFields.map(c => [c.key, c.label, c.type]) }, hidden);
  }
  if (tab === 'psyche' && !hidden.includes('big5')) {
    html = `<section class="prop-section"><h3 class="group-label">${icon('brain')}Big Five (your read)</h3><div class="card pad big5">
      ${BIG_FIVE.map(([k, name, lo, hi]) => { const v = p.big5?.[k]; return `<div class="b5-row"><div class="b5-head"><b>${name}</b><span class="muted small">${v == null ? 'not rated' : v}</span></div>
        <input type="range" min="0" max="100" step="5" value="${v ?? 50}" data-b5="${k}" class="${v == null ? 'unset' : ''}" aria-label="${name}">
        <div class="b5-ends muted small"><span>${lo}</span><span>${hi}</span></div></div>`; }).join('')}
    </div></section>` + html;
  }
  if (tab === 'profile') {
    html = `<section class="prop-section"><div class="card pad ratings">
      ${scale('trust', 'Trust', p.trust)}${scale('closeness', 'Closeness', p.closeness)}${scale('energy', 'Energy they give', p.energy)}
    </div></section>
    <section class="prop-section"><h3 class="group-label">${icon('notes')}Notes</h3><div class="card"><textarea class="input bare autosize" data-freenotes rows="3" placeholder="Anything else worth remembering…">${esc(p.notes || '')}</textarea></div></section>` + html;
  }
  return html || '<p class="muted">All fields in this tab are hidden. Use “Customize fields” to show some.</p>';
}

function renderPerson(main, id, query) {
  const p0 = get('people', id);
  if (!p0) { navigate('#/people', { replace: true }); return; }
  const tab = query.tab || 'profile';
  const draw = () => {
    const p = get('people', id);
    const ls = lastSeen(p), nb = nextBirthday(p), rc = reconnectDue(p);
    main.innerHTML = `<div class="page person-page">
      <header class="detail-head">
        <a class="icon-btn" href="#/people" aria-label="Back">${icon('back')}</a>
        <div class="head-actions">
          <button class="icon-btn ${p.favorite ? 'on' : ''}" data-act="fav" aria-label="Favorite">${icon('star')}</button>
          <button class="icon-btn" data-act="more" aria-label="More">${icon('more')}</button></div>
      </header>
      <div class="person-hero">
        <label class="avatar-edit" title="Change photo">${avatar(p, 'xl')}<span class="avatar-cam">${icon('camera')}</span><input type="file" accept="image/*" hidden data-photo></label>
        <input class="person-title" value="${esc(p.name)}" data-name aria-label="Name">
        <input class="person-summary" value="${esc(p.summary || '')}" placeholder="Who are they, in a line?" data-summary aria-label="Summary">
        <div class="chip-row center wrap">
          <button class="chip ${p.circle ? 'on' : ''}" data-act="circle">${esc(p.circle || 'Set circle')}${icon('chevD')}</button>
          ${(p.tags || []).map(t => `<span class="tag-chip">#${esc(t)}<button data-rmtag="${esc(t)}" aria-label="Remove">${icon('x')}</button></span>`).join('')}
          <button class="chip ghost" data-act="tag">${icon('tag')}Tag</button>
        </div>
        <div class="person-facts">
          <div><b>${ls ? relDays(ls) : '—'}</b><span>last seen</span></div>
          <div><b>${(p.interactions || []).length}</b><span>encounters</span></div>
          <div><b>${p.fields?.metDate ? relDays(p.fields.metDate).replace(' ago', '') : '—'}</b><span>known</span></div>
          ${nb ? `<div><b>${nb.inDays === 0 ? 'Today!' : nb.inDays + 'd'}</b><span>to birthday</span></div>` : ''}
        </div>
        ${rc ? `<div class="banner warn">${icon('bell')}It's been ${rc.gap === Infinity ? 'a while' : rc.gap + ' days'} — you wanted to stay in touch every ${p.fields.keepInTouch.toLowerCase()}.</div>` : ''}
      </div>
      <nav class="seg" role="tablist">${TABS.map(([k, l, ic]) => `<a role="tab" class="${k === tab ? 'on' : ''}" href="#/people/${id}?tab=${k}" aria-selected="${k === tab}">${icon(ic)}<span>${l}</span></a>`).join('')}</nav>
      <div class="tab-body">${tabHTML(p, tab)}</div>
      ${tab !== 'log' ? `<button class="link small center-block" data-act="hideempty">${ui.hideEmpty ? 'Show empty fields' : 'Hide empty fields'}</button>` : ''}
    </div>`;
    main.querySelectorAll('textarea.autosize').forEach(a => { a.style.height = 'auto'; a.style.height = a.scrollHeight + 'px'; });
  };
  draw();

  const update = (patch, { redraw = false } = {}) => {
    const p = get('people', id);
    save('people', { ...p, ...patch, updated: Date.now() }, { silent: true });
    if (redraw) { const st = main.scrollTop; draw(); main.scrollTop = st; }
  };

  const saveFreeNotes = debounce(v => update({ notes: v }), 400);
  const saveName = debounce(v => v.trim() && update({ name: v.trim() }), 400);
  const saveSummary = debounce(v => update({ summary: v.trim() }), 400);
  const saveB5 = debounce((k, v) => { const p = get('people', id); update({ big5: { ...(p.big5 || {}), [k]: v } }); }, 150);
  let mood = '';

  main.oninput = e => {
    if (e.target.matches('[data-freenotes]')) { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; saveFreeNotes(e.target.value); }
    if (e.target.matches('[data-name]')) saveName(e.target.value);
    if (e.target.matches('[data-summary]')) saveSummary(e.target.value);
    if (e.target.matches('[data-b5]')) { e.target.classList.remove('unset'); e.target.closest('.b5-row').querySelector('.b5-head span').textContent = e.target.value; saveB5(e.target.dataset.b5, +e.target.value); }
  };
  main.onchange = async e => {
    if (e.target.matches('[data-photo]') && e.target.files[0]) {
      try { update({ photo: await resizeImage(e.target.files[0]) }, { redraw: true }); } catch { toast('Could not read that image'); }
    }
  };
  main.onkeydown = e => {
    const pr = e.target.closest('.prop:not(.editing)');
    if (pr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); editProp(pr); }
  };
  main.onsubmit = e => {
    const f = e.target.closest('[data-log-form]');
    if (!f) return;
    e.preventDefault();
    if (!f.note.value.trim() && !f.where.value.trim()) { toast('Add a note or a place'); return; }
    const p = get('people', id);
    update({ interactions: [...(p.interactions || []), { id: uid(), date: f.date.value || today(), where: f.where.value.trim(), note: f.note.value.trim(), mood }] }, { redraw: true });
    mood = ''; haptic(); toast('Encounter logged');
  };
  main.onclick = async e => {
    const pr = e.target.closest('.prop:not(.editing)');
    if (pr && !e.target.closest('a')) return editProp(pr);
    const sc = e.target.closest('[data-scale] button');
    if (sc) { const k = sc.parentElement.dataset.scale; const p = get('people', id); const v = +sc.dataset.v; update({ [k]: p[k] === v ? 0 : v }, { redraw: true }); haptic(5); return; }
    const md = e.target.closest('[data-mood]');
    if (md) { mood = mood === md.dataset.mood ? '' : md.dataset.mood; md.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.mood === mood)); return; }
    const idel = e.target.closest('[data-int-del]');
    if (idel) { const p = get('people', id); const it = p.interactions.find(i => i.id === idel.dataset.intDel); update({ interactions: p.interactions.filter(i => i !== it) }, { redraw: true }); toast('Encounter removed', { action: 'Undo', onAction: () => { const p2 = get('people', id); update({ interactions: [...p2.interactions, it] }, { redraw: true }); } }); return; }
    const rt = e.target.closest('[data-rmtag]');
    if (rt) { const p = get('people', id); update({ tags: p.tags.filter(t => t !== rt.dataset.rmtag) }, { redraw: true }); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const p = get('people', id);
    switch (b.dataset.act) {
      case 'fav': update({ favorite: !p.favorite }, { redraw: true }); haptic(); break;
      case 'hideempty': ui.hideEmpty = !ui.hideEmpty; draw(); break;
      case 'circle': menu(b, [...CIRCLES.map(c => ({ label: c, checked: p.circle === c, action: () => update({ circle: c }, { redraw: true }) })), '-', { label: 'None', action: () => update({ circle: '' }, { redraw: true }) }]); break;
      case 'tag': {
        const { promptDialog } = await import('../ui.js');
        const v = await promptDialog('Add tag', { placeholder: 'e.g. climbing, investor, book-club' });
        if (v) { const t = normTag(v); if (t && !p.tags.includes(t)) update({ tags: [...p.tags, t] }, { redraw: true }); }
        break;
      }
      case 'more': menu(b, [
        { label: 'Customize fields', icon: 'settings', action: () => customizeFields(draw) },
        { label: 'Export profile (text)', icon: 'download', action: () => exportPerson(p) },
        p.photo ? { label: 'Remove photo', icon: 'camera', action: () => update({ photo: null }, { redraw: true }) } : null,
        '-',
        { label: 'Delete person', icon: 'trash', danger: true, action: async () => { if (await confirmDialog(`Delete ${p.name}'s profile and log?`)) { remove('people', id); navigate('#/people'); toast('Deleted'); } } },
      ]); break;
    }
  };

  function editProp(pr) {
    const key = pr.dataset.field, type = pr.dataset.type;
    const p = get('people', id);
    const v = p.fields?.[key] || '';
    const valEl = pr.querySelector('.prop-value');
    pr.classList.add('editing');
    let input;
    if (type === 'long') input = `<textarea class="input" rows="3">${esc(v)}</textarea>`;
    else if (type === 'select') input = `<select class="input">${pr.dataset.options.split('|').map(o => `<option ${o === v ? 'selected' : ''} value="${esc(o)}">${esc(o || '—')}</option>`).join('')}</select>`;
    else if (type === 'date') input = `<input class="input" type="date" value="${esc(v)}">`;
    else input = `<input class="input" value="${esc(v)}" ${key === 'phone' ? 'type="tel"' : key === 'email' ? 'type="email"' : ''}>`;
    valEl.innerHTML = input;
    const el = valEl.firstElementChild;
    el.focus();
    if (el.tagName === 'TEXTAREA') { el.style.height = Math.max(80, el.scrollHeight) + 'px'; el.oninput = () => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }; }
    let done = false;
    const commit = () => {
      if (done) return; done = true;
      const nv = el.value.trim();
      const cur = get('people', id);
      if (nv !== v) update({ fields: { ...(cur.fields || {}), [key]: nv } });
      const tmp = document.createElement('div');
      const def = [...SECTIONS.flatMap(s => s.fields), ...settings().customPersonFields.map(c => [c.key, c.label, c.type])].find(f => f[0] === key);
      tmp.innerHTML = propRow(get('people', id), def) || '';
      if (tmp.firstElementChild) pr.replaceWith(tmp.firstElementChild); else pr.remove();
    };
    el.addEventListener('blur', commit);
    el.addEventListener('change', () => { if (type === 'select' || type === 'date') commit(); });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (type !== 'long' || e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { el.value = v; commit(); }
    });
  }

  return () => {
    if (get('people', id)) {
      const ta = main.querySelector('[data-freenotes]'); if (ta) saveFreeNotes.flush(ta.value);
      const nm = main.querySelector('[data-name]'); if (nm) saveName.flush(nm.value);
      const sm = main.querySelector('[data-summary]'); if (sm) saveSummary.flush(sm.value);
    }
    main.onclick = main.oninput = main.onchange = main.onkeydown = main.onsubmit = null;
  };
}

function customizeFields(after) {
  sheet({
    title: 'Customize fields',
    wide: true,
    onClose: () => after(),
    render(body) {
      const draw = () => {
        const st = settings();
        const hidden = new Set(st.hiddenPersonFields);
        const box = (k, l) => `<label class="check-row"><input type="checkbox" data-fkey="${k}" ${hidden.has(k) ? '' : 'checked'}><span>${esc(l)}</span></label>`;
        body.innerHTML = `<p class="muted small">Choose what you want to track about people. Hidden fields keep their data.</p>
          ${TABS.filter(t => t[0] !== 'log').map(([tk, tl]) => `<h4 class="sub-label">${tl}</h4>
            ${tk === 'psyche' ? `<div class="card pad check-grid">${box('big5', 'Big Five sliders')}</div>` : ''}
            ${SECTIONS.filter(s => s.tab === tk).map(s => `<div class="card pad"><div class="row-between"><b>${esc(s.title)}</b><button class="link small" data-sec="${s.id}">toggle all</button></div><div class="check-grid">${s.fields.map(f => box(f[0], f[1])).join('')}</div></div>`).join('')}`).join('')}
          <h4 class="sub-label">Your own fields</h4>
          <div class="card pad">${st.customPersonFields.map(c => `<div class="row-between"><span>${esc(c.label)} <span class="faint small">${c.type === 'long' ? 'paragraph' : c.type}</span></span><button class="icon-btn sm" data-cdel="${c.key}" aria-label="Remove">${icon('trash')}</button></div>`).join('') || '<p class="muted small">None yet.</p>'}
            <form class="row" data-cadd><input class="input grow" name="label" placeholder="e.g. Star sign, Shoe size, Coffee order" required><select class="input" name="type" style="width:auto"><option value="text">Short</option><option value="long">Paragraph</option><option value="date">Date</option></select><button class="btn primary">Add</button></form></div>`;
      };
      draw();
      body.addEventListener('change', e => {
        const k = e.target.dataset.fkey; if (!k) return;
        const hidden = new Set(settings().hiddenPersonFields);
        e.target.checked ? hidden.delete(k) : hidden.add(k);
        setSettings({ hiddenPersonFields: [...hidden] });
      });
      body.addEventListener('click', e => {
        const s = e.target.closest('[data-sec]');
        if (s) {
          const sec = SECTIONS.find(x => x.id === s.dataset.sec);
          const hidden = new Set(settings().hiddenPersonFields);
          const allShown = sec.fields.every(f => !hidden.has(f[0]));
          sec.fields.forEach(f => allShown ? hidden.add(f[0]) : hidden.delete(f[0]));
          setSettings({ hiddenPersonFields: [...hidden] }); draw();
        }
        const cd = e.target.closest('[data-cdel]');
        if (cd) { setSettings({ customPersonFields: settings().customPersonFields.filter(c => c.key !== cd.dataset.cdel) }); draw(); }
      });
      body.addEventListener('submit', e => {
        const f = e.target.closest('[data-cadd]'); if (!f) return;
        e.preventDefault();
        const label = f.label.value.trim(); if (!label) return;
        setSettings({ customPersonFields: [...settings().customPersonFields, { key: 'c_' + uid(), label, type: f.type.value }] });
        draw();
      });
    },
  });
}

function exportPerson(p) {
  const lines = [`# ${p.name}`, p.summary || '', p.circle ? `Circle: ${p.circle}` : '', (p.tags || []).map(t => '#' + t).join(' '), ''];
  const custom = settings().customPersonFields;
  [...SECTIONS, { title: 'Custom', fields: custom.map(c => [c.key, c.label]) }].forEach(s => {
    const rows = s.fields.filter(f => p.fields?.[f[0]]).map(f => `- **${f[1]}:** ${p.fields[f[0]]}`);
    if (rows.length) lines.push(`## ${s.title}`, ...rows, '');
  });
  if (Object.keys(p.big5 || {}).length) lines.push('## Big Five', ...BIG_FIVE.filter(b => p.big5[b[0]] != null).map(b => `- ${b[1]}: ${p.big5[b[0]]}/100`), '');
  if (p.notes) lines.push('## Notes', p.notes, '');
  if (p.interactions?.length) lines.push('## Log', ...[...p.interactions].sort((a, b) => a.date.localeCompare(b.date)).map(i => `- ${i.date}${i.where ? ' @ ' + i.where : ''}${i.mood ? ' ' + i.mood : ''}: ${i.note}`));
  import('../util.js').then(u => u.download(`${p.name.replace(/[^\w-]+/g, '-')}.md`, lines.filter((l, i, a) => l || a[i - 1]).join('\n'), 'text/markdown'));
}
