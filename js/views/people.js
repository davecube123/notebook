// People: a researched personality reading, an encounter log and linked notes.
import { list, get, save, remove, uid, settings } from '../db.js';
import { esc, today, ymd, fmtDay, relDays, daysBetween, initials, colorFor, resizeImage, debounce, normTag, parseDay, haptic } from '../util.js';
import { icon } from '../icons.js';
import { navigate, rerender } from '../router.js';
import { sheet, toast, confirmDialog, menu } from '../ui.js';
import { SECTIONS, LEGACY_FIELDS, TABS, CIRCLES } from './fields.js';
import { personalityTab, handlePersonality, personalityText } from './typology.js';
import { notesAbout, possibleNotes, namesakes, personLine, contextFor, linkNote, unlinkNote, notThem, mentionHTML, nameTerms } from './mentions.js';
import { newNote, noteTitle } from './notes.js';

const ui = { q: '', circle: '', sort: 'recent' };
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
      <div class="grow"><div class="person-name">${esc(p.name)}${p.favorite ? `<span class="fav">${icon('star')}</span>` : ''}</div><div class="muted small ellipsis">${esc(subtitle(p) || personLine(p))}</div></div>
      <div class="person-meta muted small">${p.circle ? `<span class="circle-pill">${esc(p.circle)}</span>` : ''}${ls ? `<span>${relDays(ls)}</span>` : ''}</div></a>`;
  }).join('')}</div></section>`).join('')
  : all.length ? `<div class="empty">${icon('search', 'empty-ic')}<h3>No one matches</h3></div>`
  : `<div class="empty">${icon('people', 'empty-ic')}<h3>Your people</h3><p>Keep a quiet file on everyone who matters: how they’re wired, what they told you, and when you last saw them.</p><button class="btn primary" data-act="new">${icon('plus')}Add someone</button></div>`}`;
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
        <p class="dup-warn small" hidden></p>
        <label class="field"><span>Who are they, in a line? <em class="faint">optional</em></span><input class="input" name="summary" placeholder="e.g. Designer I met at Maya's party"></label>
        <div class="grid2">
          <label class="field"><span>Circle</span><select class="input" name="circle"><option value="">—</option>${CIRCLES.map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
          <label class="field"><span>First met</span><input class="input" type="date" name="met" value="${today()}"></label>
        </div>
        <label class="field"><span>Where <em class="faint">optional</em></span><input class="input" name="where" placeholder="Café, conference, through a friend…"></label>
        <div class="row-end"><button type="button" class="btn ghost" data-cancel>Cancel</button><button class="btn primary">Add person</button></div>
      </form>`;
      const f = body.querySelector('form');
      body.querySelector('[data-cancel]').onclick = () => close();
      const warn = body.querySelector('.dup-warn');
      f.name.addEventListener('input', () => {
        const sakes = f.name.value.trim().length >= 2 ? namesakes({ id: null, name: f.name.value, fields: {} }) : [];
        warn.hidden = !sakes.length;
        warn.innerHTML = sakes.length ? `You already have ${sakes.map(q => `<b>${esc(q.name)}</b> (${esc(personLine(q))})`).join(', ')}. Fill in “who are they” so you can tell them apart. Notes about each stay separate.` : '';
      });
      f.onsubmit = e => {
        e.preventDefault();
        const name = f.name.value.trim(); if (!name) return;
        const p = {
          id: uid(), name, summary: f.summary.value.trim(), circle: f.circle.value, tags: [], favorite: false, photo: null,
          trust: 0, closeness: 0, fields: { metDate: f.met.value, metWhere: f.where.value.trim() },
          interactions: f.met.value ? [{ id: uid(), date: f.met.value, where: f.where.value.trim(), note: 'First met', mood: '' }] : [],
          created: Date.now(), updated: Date.now(),
        };
        save('people', p); close(); navigate(`#/people/${p.id}`);
      };
    },
  });
}

// ---------------- detail ----------------
function notesTab(p) {
  const first = p.name.split(/\s+/)[0];
  const linked = notesAbout(p);
  const maybe = possibleNotes(p);
  const sakes = namesakes(p);
  const clear = maybe.filter(m => !m.also.length);
  const row = (n, actions = '', extra = '') => {
    const title = noteTitle(n), ctx = contextFor(n, p);
    const repeat = ctx.replace(/^…/, '').startsWith(title.slice(0, 30)); // one-line notes: the title already says it
    return `<div class="list-row pnote">
    <a class="pnote-main" href="#/notes/${n.id}"><b>${esc(title)}</b><span class="muted small">${fmtDay(ymd(new Date(n.created)), { month: 'short', day: 'numeric', year: 'numeric' })}${repeat ? '' : ` · ${esc(ctx)}`}</span>${extra}</a>
    ${actions}</div>`;
  };
  return `
    <button class="btn ghost block" data-new-note-about>${icon('edit')}New note about ${esc(first)}</button>
    ${sakes.length ? `<div class="banner">${icon('info')}<span>Also in People: ${sakes.map(q => `<a class="link-inline" href="#/people/${q.id}?tab=notes">${esc(q.name)}</a> <span class="muted">(${esc(personLine(q))})</span>`).join(', ')}. Notes are linked to one person only when you choose.</span></div>` : ''}
    <section class="prop-section"><h3 class="group-label">${icon('notes')}Notes about ${esc(first)}<span class="count">${linked.length}</span></h3>
      ${linked.length ? `<div class="card list-card">${linked.map(n => row(n, (n.linkedPeople || []).includes(p.id) && !(n.people || []).includes(p.id) ? `<button class="icon-btn sm" data-unlink-note="${n.id}" aria-label="Unlink from ${esc(first)}">${icon('x')}</button>` : '')).join('')}</div>`
        : `<p class="muted small pad-x">Type <b>@${esc(first)}</b> in any note to link it here, or tap the button above.</p>`}
    </section>
    ${maybe.length ? `<section class="prop-section"><div class="row-between"><h3 class="group-label">Possibly about ${esc(first)}<span class="count">${maybe.length}</span></h3>${clear.length > 1 ? `<button class="link small" data-link-all>Link ${clear.length}</button>` : ''}</div>
      <p class="muted small pad-x">These notes contain “${esc(nameTerms(p).join('”, “'))}” but aren't linked yet.</p>
      <div class="card list-card">${maybe.map(({ note, also }) => row(note,
        `<span class="pnote-actions"><button class="btn primary sm" data-link-note="${note.id}">Link</button><button class="btn ghost sm" data-not-them="${note.id}">Not ${esc(first)}</button></span>`,
        also.length ? `<span class="same-name-hint">${icon('info')}Could also be ${also.map(q => `${esc(q.name)} (${esc(personLine(q))})`).join(' or ')}</span>` : '')).join('')}</div>
    </section>` : ''}`;
}

function tabHTML(p, tab) {
  if (tab === 'notes') return notesTab(p);
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
  return personalityTab(p);
}

function renderPerson(main, id, query) {
  const p0 = get('people', id);
  if (!p0) { navigate('#/people', { replace: true }); return; }
  const tab = TABS.some(t => t[0] === query.tab) ? query.tab : 'personality';
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
      <nav class="seg" role="tablist">${TABS.map(([k, l, ic]) => `<a role="tab" class="${k === tab ? 'on' : ''}" href="#/people/${id}?tab=${k}" aria-selected="${k === tab}">${icon(ic)}<span>${l}${k === 'notes' && notesAbout(p).length ? ` <em class="tab-count">${notesAbout(p).length}</em>` : ''}</span></a>`).join('')}</nav>
      <div class="tab-body">${tabHTML(p, tab)}</div>
    </div>`;
    main.querySelectorAll('textarea.autosize').forEach(a => { a.style.height = 'auto'; a.style.height = a.scrollHeight + 'px'; });
  };
  draw();

  const update = (patch, { redraw = false } = {}) => {
    const p = get('people', id);
    save('people', { ...p, ...patch, updated: Date.now() }, { silent: true });
    if (redraw) { const st = main.scrollTop; draw(); main.scrollTop = st; }
  };

  const saveName = debounce(v => v.trim() && update({ name: v.trim() }), 400);
  const saveSummary = debounce(v => update({ summary: v.trim() }), 400);
  let mood = '';

  main.oninput = e => {
    if (e.target.matches('[data-name]')) saveName(e.target.value);
    if (e.target.matches('[data-summary]')) saveSummary(e.target.value);
  };
  main.onchange = async e => {
    if (e.target.matches('[data-photo]') && e.target.files[0]) {
      try { update({ photo: await resizeImage(e.target.files[0]) }, { redraw: true }); } catch { toast('Could not read that image'); }
    }
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
    const redraw = () => { const st = main.scrollTop; draw(); main.scrollTop = st; };
    if (handlePersonality(e, id, redraw)) return;
    const ln = e.target.closest('[data-link-note]');
    if (ln) { const nid = ln.dataset.linkNote; linkNote(nid, id); haptic(8); redraw(); toast('Linked', { action: 'Undo', onAction: () => { unlinkNote(nid, id); redraw(); } }); return; }
    const ul = e.target.closest('[data-unlink-note]');
    if (ul) { const nid = ul.dataset.unlinkNote; unlinkNote(nid, id); redraw(); toast('Unlinked', { action: 'Undo', onAction: () => { linkNote(nid, id); redraw(); } }); return; }
    const nt = e.target.closest('[data-not-them]');
    if (nt) {
      const nid = nt.dataset.notThem; notThem(nid, id); redraw();
      toast('Hidden from this person', { action: 'Undo', onAction: () => { const q = get('people', id); save('people', { ...q, notNotes: (q.notNotes || []).filter(x => x !== nid) }); redraw(); } });
      return;
    }
    if (e.target.closest('[data-link-all]')) {
      const ids = possibleNotes(get('people', id)).filter(m => !m.also.length).map(m => m.note.id);
      ids.forEach(nid => linkNote(nid, id)); haptic(10); redraw();
      toast(`Linked ${ids.length} notes`, { action: 'Undo', onAction: () => { ids.forEach(nid => unlinkNote(nid, id)); redraw(); } });
      return;
    }
    if (e.target.closest('[data-new-note-about]')) {
      const p = get('people', id);
      const n = newNote({ html: `<p>${mentionHTML(p)}&nbsp;</p>`, text: `@${p.name}`, people: [p.id], tags: [], seeded: true });
      navigate(`#/notes/${n.id}`);
      return;
    }
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
      case 'circle': menu(b, [...CIRCLES.map(c => ({ label: c, checked: p.circle === c, action: () => update({ circle: c }, { redraw: true }) })), '-', { label: 'None', action: () => update({ circle: '' }, { redraw: true }) }]); break;
      case 'tag': {
        const { promptDialog } = await import('../ui.js');
        const v = await promptDialog('Add tag', { placeholder: 'e.g. climbing, investor, book-club' });
        if (v) { const t = normTag(v); if (t && !p.tags.includes(t)) update({ tags: [...p.tags, t] }, { redraw: true }); }
        break;
      }
      case 'more': menu(b, [
        { label: 'Export profile (text)', icon: 'download', action: () => exportPerson(p) },
        p.photo ? { label: 'Remove photo', icon: 'camera', action: () => update({ photo: null }, { redraw: true }) } : null,
        '-',
        { label: 'Delete person', icon: 'trash', danger: true, action: async () => { if (await confirmDialog(`Delete ${p.name}'s profile and log?`)) { remove('people', id); navigate('#/people'); toast('Deleted'); } } },
      ]); break;
    }
  };

  return () => {
    if (get('people', id)) {
      const nm = main.querySelector('[data-name]'); if (nm) saveName.flush(nm.value);
      const sm = main.querySelector('[data-summary]'); if (sm) saveSummary.flush(sm.value);
    }
    main.onclick = main.oninput = main.onchange = main.onsubmit = null;
  };
}

function exportPerson(p) {
  const lines = [`# ${p.name}`, p.summary || '', p.circle ? `Circle: ${p.circle}` : '', (p.tags || []).map(t => '#' + t).join(' '), ''];
  const custom = settings().customPersonFields;
  [...SECTIONS, { title: 'Custom', fields: custom.map(c => [c.key, c.label]) }, { title: 'Earlier details', fields: LEGACY_FIELDS }].forEach(s => {
    const rows = s.fields.filter(f => p.fields?.[f[0]]).map(f => `- **${f[1]}:** ${p.fields[f[0]]}`);
    if (rows.length) lines.push(`## ${s.title}`, ...rows, '');
  });
  lines.push(...personalityText(p));
  if (p.notes) lines.push('## Notes', p.notes, '');
  if (p.interactions?.length) lines.push('## Log', ...[...p.interactions].sort((a, b) => a.date.localeCompare(b.date)).map(i => `- ${i.date}${i.where ? ' @ ' + i.where : ''}${i.mood ? ' ' + i.mood : ''}: ${i.note}`));
  import('../util.js').then(u => u.download(`${p.name.replace(/[^\w-]+/g, '-')}.md`, lines.filter((l, i, a) => l || a[i - 1]).join('\n'), 'text/markdown'));
}
