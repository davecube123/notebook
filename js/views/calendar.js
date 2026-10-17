// Life calendar: trackers for things that happen regularly, a month grid, day details.
import { list, get, save, remove, uid, settings } from '../db.js';
import { esc, today, ymd, addDays, parseDay, fmtMonth, fmtLongDay, fmtDay, hm, relDays, daysBetween, weekdayNames, COLORS, haptic } from '../util.js';
import { icon } from '../icons.js';
import { rerender, navigate } from '../router.js';
import { sheet, toast, confirmDialog, emojiPicker, menu } from '../ui.js';
import { heatmap } from './heatmap.js';
import { getOne, oneThingCard, bindOneThing } from './onething.js';
import { isPerfect, habitsOn, logFor } from './habits.js';
import { noteTitle } from './notes.js';

const ui = { y: null, m: null, sel: null, filter: '', layers: { trackers: true, one: true, habits: true, notes: false } };

export const trackers = () => list('trackers').filter(t => !t.archived).sort((a, b) => a.created - b.created);
export const eventsOn = day => list('events').filter(e => e.date === day).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
const eventsOf = tid => list('events').filter(e => e.trackerId === tid).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

export function trackerStats(t) {
  const evs = eventsOf(t.id);
  const days = [...new Set(evs.map(e => e.date))].sort();
  const last = days.at(-1);
  const gaps = days.slice(1).map((d, i) => daysBetween(days[i], d));
  const now = today();
  const ym = now.slice(0, 7);
  return {
    total: evs.length,
    month: evs.filter(e => e.date.startsWith(ym)).length,
    last,
    since: last ? daysBetween(last, now) : null,
    avg: gaps.length ? Math.round(10 * gaps.reduce((a, b) => a + b, 0) / gaps.length) / 10 : null,
    longest: gaps.length ? Math.max(...gaps) : null,
    overdue: t.everyDays && last ? daysBetween(last, now) > t.everyDays : false,
  };
}

export function logEvent(trackerId, { date = today(), time = hm(), note = '' } = {}) {
  const ev = save('events', { id: uid(), trackerId, date, time, note, created: Date.now() });
  haptic(10);
  const t = get('trackers', trackerId);
  toast(`${t?.emoji || ''} ${t?.name || 'Logged'} — ${date === today() ? 'today' : fmtDay(date)} ${time}`, { action: 'Undo', onAction: () => { remove('events', ev.id); rerender(); } });
  return ev;
}

function monthGrid() {
  const ws = settings().weekStart;
  const first = new Date(ui.y, ui.m, 1);
  const lead = (first.getDay() - ws + 7) % 7;
  const start = addDays(ymd(first), -lead);
  const t = today();
  const tmap = new Map(list('trackers').map(x => [x.id, x]));
  const byDay = new Map();
  list('events').forEach(e => { if (!ui.filter || e.trackerId === ui.filter) { if (!byDay.has(e.date)) byDay.set(e.date, []); byDay.get(e.date).push(e); } });
  const noteDays = new Set(ui.layers.notes ? list('notes').filter(n => !n.trashed && !n.draft).map(n => ymd(new Date(n.created))) : []);
  const cells = [];
  const weeks = Math.ceil((lead + new Date(ui.y, ui.m + 1, 0).getDate()) / 7);
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i);
    const inMonth = parseDay(d).getMonth() === ui.m;
    const evs = ui.layers.trackers ? (byDay.get(d) || []) : [];
    const o = ui.layers.one ? getOne(d) : null;
    const perfect = ui.layers.habits && d <= t && isPerfect(d);
    const dots = evs.slice(0, 4).map(e => { const tr = tmap.get(e.trackerId); return `<i class="cal-dot" style="background:${tr?.color || 'var(--muted)'}" title="${esc(tr?.name || '')}"></i>`; }).join('') + (evs.length > 4 ? `<i class="cal-more">+${evs.length - 4}</i>` : '');
    cells.push(`<button class="cal-cell ${inMonth ? '' : 'out'} ${d === t ? 'today' : ''} ${d === ui.sel ? 'sel' : ''} ${d > t ? 'future' : ''}" data-day="${d}" aria-label="${fmtLongDay(d)}">
      <span class="cal-num">${parseDay(d).getDate()}</span>
      <span class="cal-marks">${o?.done ? `<i class="cal-one" title="One thing done">${icon('target')}</i>` : ''}${perfect ? `<i class="cal-perfect" title="All habits done">${icon('flame')}</i>` : ''}${noteDays.has(d) ? '<i class="cal-note"></i>' : ''}</span>
      <span class="cal-dots">${dots}</span>
      ${ui.filter && evs.length ? `<span class="cal-fill" style="background:${tmap.get(ui.filter)?.color}"></span>` : ''}
    </button>`);
  }
  return `<div class="cal-week">${weekdayNames(ws).map(n => `<span>${n}</span>`).join('')}</div><div class="cal-grid">${cells.join('')}</div>`;
}

function dayPanel(day) {
  const tmap = new Map(list('trackers').map(x => [x.id, x]));
  const evs = eventsOn(day);
  const notes = list('notes').filter(n => !n.trashed && !n.draft && ymd(new Date(n.created)) === day);
  const people = list('people');
  const met = people.flatMap(p => (p.interactions || []).filter(i => i.date === day).map(i => ({ p, i })));
  const bdays = people.filter(p => p.fields?.birthday && p.fields.birthday.slice(5) === day.slice(5));
  const hs = habitsOn(day);
  const dn = new Set(logFor(day).done);
  const ts = trackers();
  return `<div class="day-panel">
    <div class="day-head"><h2>${fmtLongDay(day)}</h2><span class="muted small">${relDays(day)}</span></div>
    ${ts.length ? `<div class="chip-row wrap quick-log">${ts.map(t => `<button class="chip log-chip" data-log="${t.id}" style="--c:${t.color}">${esc(t.emoji)} ${esc(t.name)} ${icon('plus')}</button>`).join('')}</div>` : ''}
    ${evs.length ? `<div class="card list-card">${evs.map(e => { const t = tmap.get(e.trackerId); return `<div class="list-row ev-row" data-ev="${e.id}">
      <span class="ev-badge" style="--c:${t?.color || 'var(--muted)'}">${esc(t?.emoji || '•')}</span>
      <div class="grow"><b>${esc(t?.name || 'Deleted tracker')}</b><div class="muted small">${e.time || ''}${e.note ? ' · ' + esc(e.note) : ''}</div></div>
      <button class="icon-btn sm" data-ev-edit="${e.id}" aria-label="Edit">${icon('edit')}</button></div>`; }).join('')}</div>` : `<p class="muted small">${ts.length ? 'Nothing logged. Tap a tracker above to log it on this day.' : ''}</p>`}
    ${day <= addDays(today(), 7) ? `<div class="day-one">${getOne(day) || day >= today() ? oneThingCard(day) : ''}</div>` : ''}
    ${hs.length && day <= today() ? `<div class="day-line">${icon('flame')}<span>Habits: <b>${hs.filter(h => dn.has(h.id)).length}/${hs.length}</b>${isPerfect(day) ? ' — perfect day' : ''}</span><button class="link small" data-day-habits="${day}">Edit</button></div>` : ''}
    ${bdays.map(p => `<a class="day-line" href="#/people/${p.id}">${icon('cake')}<span><b>${esc(p.name)}</b>'s birthday</span></a>`).join('')}
    ${met.map(({ p, i }) => `<a class="day-line" href="#/people/${p.id}">${icon('chat')}<span>Saw <b>${esc(p.name)}</b>${i.note ? ' — ' + esc(i.note.slice(0, 60)) : ''}</span></a>`).join('')}
    ${notes.map(n => `<a class="day-line" href="#/notes/${n.id}">${icon('notes')}<span>${esc(noteTitle(n))}</span></a>`).join('')}
  </div>`;
}

export function renderCalendar(main, params, query) {
  const t = today();
  if (ui.y === null) { ui.y = parseDay(t).getFullYear(); ui.m = parseDay(t).getMonth(); ui.sel = t; }
  if (query.day) { ui.sel = query.day; ui.y = parseDay(query.day).getFullYear(); ui.m = parseDay(query.day).getMonth(); }
  const ts = trackers();
  main.innerHTML = `<div class="page cal-page">
    <header class="page-head"><div class="page-title-row"><h1>Calendar</h1>
      <div class="head-actions"><button class="icon-btn" data-act="layers" aria-label="Layers">${icon('eye')}</button><button class="icon-btn accent" data-act="newtracker" aria-label="New tracker">${icon('plus')}</button></div></div></header>
    <div class="cal-layout">
      <div class="cal-main card pad">
        <div class="cal-nav">
          <button class="icon-btn" data-act="prev" aria-label="Previous month">${icon('chevL')}</button>
          <h2>${fmtMonth(ui.y, ui.m)}</h2>
          <button class="icon-btn" data-act="next" aria-label="Next month">${icon('chevR')}</button>
          <button class="btn ghost sm" data-act="today">Today</button>
        </div>
        ${ts.length ? `<div class="chip-row"><button class="chip ${!ui.filter ? 'on' : ''}" data-filter="">All</button>${ts.map(x => `<button class="chip ${ui.filter === x.id ? 'on' : ''}" data-filter="${x.id}"><i class="dot" style="background:${x.color}"></i>${esc(x.emoji)} ${esc(x.name)}</button>`).join('')}</div>` : ''}
        ${monthGrid()}
        <div class="cal-legend muted small"><span><i class="cal-dot" style="background:var(--accent)"></i>tracker</span><span>${icon('target')}one thing</span><span>${icon('flame')}perfect habits</span></div>
      </div>
      <div class="cal-side">${dayPanel(ui.sel)}</div>
    </div>
    <section class="section">
      <h3 class="group-label">Trackers</h3>
      ${ts.length ? `<div class="tracker-grid">${ts.map(x => { const s = trackerStats(x); return `<button class="tracker-card card" data-tracker="${x.id}" style="--c:${x.color}">
        <div class="tracker-top"><span class="tracker-emoji">${esc(x.emoji)}</span><span class="tracker-name">${esc(x.name)}</span>${s.overdue ? '<span class="badge warn">due</span>' : ''}</div>
        <div class="tracker-big">${s.since === null ? '—' : s.since === 0 ? 'Today' : `${s.since}<small>d ago</small>`}</div>
        <div class="tracker-meta muted small">${s.month} this month · ${s.total} total${s.avg ? ` · every ~${s.avg}d` : ''}</div>
      </button>`; }).join('')}</div>`
      : `<div class="empty card pad">${icon('calendar', 'empty-ic')}<h3>Track what happens regularly</h3><p>Sunsets, workouts, calls with mom, the gym, migraines, dates, anything. Log it with one tap and see patterns over time.</p><button class="btn primary" data-act="newtracker">${icon('plus')}Create a tracker</button></div>`}
    </section>
  </div>`;
  const page = main.querySelector('.page');
  bindOneThing(page);
  page.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b) {
      const a = b.dataset.act;
      if (a === 'prev' || a === 'next') { const d = new Date(ui.y, ui.m + (a === 'next' ? 1 : -1), 1); ui.y = d.getFullYear(); ui.m = d.getMonth(); return rerender(); }
      if (a === 'today') { ui.y = parseDay(t).getFullYear(); ui.m = parseDay(t).getMonth(); ui.sel = t; return rerender(); }
      if (a === 'newtracker') return trackerSheet(null);
      if (a === 'layers') {
        const tg = k => () => { ui.layers[k] = !ui.layers[k]; rerender(); };
        return menu(b, [
          { label: 'Trackers', action: tg('trackers'), checked: ui.layers.trackers },
          { label: 'One Thing done', action: tg('one'), checked: ui.layers.one },
          { label: 'Perfect habit days', action: tg('habits'), checked: ui.layers.habits },
          { label: 'Notes written', action: tg('notes'), checked: ui.layers.notes },
        ]);
      }
    }
    const day = e.target.closest('[data-day]');
    if (day) {
      ui.sel = day.dataset.day;
      if (parseDay(ui.sel).getMonth() !== ui.m) { ui.y = parseDay(ui.sel).getFullYear(); ui.m = parseDay(ui.sel).getMonth(); }
      rerender();
      if (!matchMedia('(min-width: 980px)').matches) setTimeout(() => main.querySelector('.cal-side')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
      return;
    }
    const f = e.target.closest('[data-filter]');
    if (f) { ui.filter = f.dataset.filter; return rerender(); }
    const lg = e.target.closest('[data-log]');
    if (lg) { logEvent(lg.dataset.log, { date: ui.sel, time: ui.sel === t ? hm() : '' }); return rerender(); }
    const ee = e.target.closest('[data-ev-edit]');
    if (ee) return eventSheet(get('events', ee.dataset.evEdit));
    const tr = e.target.closest('[data-tracker]');
    if (tr) return trackerDetail(get('trackers', tr.dataset.tracker));
    const dh = e.target.closest('[data-day-habits]');
    if (dh) import('./habits.js').then(m => m.dayHabitsSheet(dh.dataset.dayHabits));
  });
  // swipe between months
  const grid = page.querySelector('.cal-grid');
  let x0 = null;
  grid.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  grid.addEventListener('touchend', e => {
    if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 60) { const d = new Date(ui.y, ui.m + (dx < 0 ? 1 : -1), 1); ui.y = d.getFullYear(); ui.m = d.getMonth(); rerender(); }
  });
}

function eventSheet(ev) {
  const ts = list('trackers');
  sheet({
    title: 'Edit entry',
    render(body, close) {
      body.innerHTML = `<form class="stack">
        <label class="field"><span>Tracker</span><select class="input" name="tracker">${ts.map(t => `<option value="${t.id}" ${t.id === ev.trackerId ? 'selected' : ''}>${esc(t.emoji)} ${esc(t.name)}</option>`).join('')}</select></label>
        <div class="grid2"><label class="field"><span>Date</span><input type="date" class="input" name="date" value="${ev.date}" required></label>
        <label class="field"><span>Time</span><input type="time" class="input" name="time" value="${ev.time || ''}"></label></div>
        <label class="field"><span>Note</span><textarea class="input" name="note" rows="3" placeholder="How was it? Who was there?">${esc(ev.note || '')}</textarea></label>
        <div class="row-between"><button type="button" class="btn danger ghost" data-del>${icon('trash')}Delete</button>
        <div class="row-end"><button type="button" class="btn ghost" data-cancel>Cancel</button><button class="btn primary">Save</button></div></div>
      </form>`;
      const f = body.querySelector('form');
      body.querySelector('[data-cancel]').onclick = () => close();
      body.querySelector('[data-del]').onclick = () => { remove('events', ev.id); close(); rerender(); toast('Entry deleted', { action: 'Undo', onAction: () => { save('events', ev); rerender(); } }); };
      f.onsubmit = e => { e.preventDefault(); save('events', { ...ev, trackerId: f.tracker.value, date: f.date.value, time: f.time.value, note: f.note.value.trim() }); close(); rerender(); };
    },
  });
}

const TRACKER_SUGGESTIONS = [['🌅', 'Sunset'], ['🏃', 'Run'], ['🏋️', 'Gym'], ['📞', 'Called family'], ['❤️', 'Date night'], ['🍷', 'Drinks'], ['🧘', 'Yoga'], ['🤕', 'Headache'], ['🌙', 'Late night'], ['🏊', 'Swim']];

export function trackerSheet(t) {
  const isNew = !t;
  t = t || { emoji: '🌅', name: '', color: COLORS[list('trackers').length % COLORS.length], everyDays: '' };
  sheet({
    title: isNew ? 'New tracker' : 'Edit tracker',
    render(body, close) {
      body.innerHTML = `<form class="stack">
        <div class="emoji-field"><button type="button" class="emoji-big" data-emoji-toggle>${esc(t.emoji)}</button>
        <label class="field grow"><span>Name</span><input class="input" name="name" value="${esc(t.name)}" placeholder="e.g. Sunset walk" maxlength="40" required autofocus></label></div>
        <div class="emoji-wrap" hidden>${emojiPicker(t.emoji)}</div>
        <div class="field"><span>Color</span><div class="swatches">${COLORS.map(c => `<button type="button" class="swatch ${c === t.color ? 'sel' : ''}" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div></div>
        <label class="field"><span>Nudge me if it's been more than <em class="faint">optional</em></span><div class="input-suffix"><input class="input" type="number" min="1" max="365" name="every" value="${t.everyDays || ''}" placeholder="—"><span>days</span></div></label>
        ${isNew ? `<div class="chip-row wrap">${TRACKER_SUGGESTIONS.map(([e, n]) => `<button type="button" class="chip" data-sug="${e}|${n}">${e} ${n}</button>`).join('')}</div>` : ''}
        <div class="row-end"><button type="button" class="btn ghost" data-cancel>Cancel</button><button class="btn primary">${isNew ? 'Create' : 'Save'}</button></div>
      </form>`;
      const f = body.querySelector('form');
      let emoji = t.emoji, color = t.color;
      body.querySelector('[data-cancel]').onclick = () => close();
      body.addEventListener('click', e => {
        if (e.target.closest('[data-emoji-toggle]')) { const w = body.querySelector('.emoji-wrap'); w.hidden = !w.hidden; }
        const em = e.target.closest('[data-emoji]'); if (em) { emoji = em.dataset.emoji; body.querySelector('.emoji-big').textContent = emoji; body.querySelector('.emoji-wrap').hidden = true; }
        const c = e.target.closest('[data-color]'); if (c) { color = c.dataset.color; body.querySelectorAll('.swatch').forEach(s => s.classList.toggle('sel', s === c)); }
        const sg = e.target.closest('[data-sug]'); if (sg) { const [e2, n] = sg.dataset.sug.split('|'); emoji = e2; body.querySelector('.emoji-big').textContent = e2; f.name.value = n; }
      });
      f.onsubmit = e => {
        e.preventDefault();
        const rec = { ...t, name: f.name.value.trim(), emoji, color, everyDays: +f.every.value || null };
        if (isNew) Object.assign(rec, { id: uid(), created: Date.now(), archived: false });
        save('trackers', rec); close(); rerender();
      };
    },
  });
}

function trackerDetail(t) {
  const s = trackerStats(t);
  const days = new Map();
  eventsOf(t.id).forEach(e => days.set(e.date, (days.get(e.date) || 0) + 1));
  sheet({
    title: `${t.emoji} ${t.name}`,
    wide: true,
    render(body, close) {
      const recent = eventsOf(t.id).reverse().slice(0, 30);
      body.innerHTML = `
        <div class="stat-row compact">
          <div class="stat"><div class="stat-n">${s.total}</div><div class="stat-l">Total</div></div>
          <div class="stat"><div class="stat-n">${s.month}</div><div class="stat-l">This month</div></div>
          <div class="stat"><div class="stat-n">${s.since ?? '—'}</div><div class="stat-l">Days since</div></div>
          <div class="stat"><div class="stat-n">${s.avg ?? '—'}</div><div class="stat-l">Avg gap (d)</div></div>
        </div>
        <div class="card pad">${heatmap(d => Math.min(4, (days.get(d) || 0) * 2), { weeks: 26, color: t.color, title: d => `${fmtDay(d)}: ${days.get(d) || 0}` })}</div>
        <button class="btn primary block" data-lognow>${icon('plus')}Log ${esc(t.name)} now</button>
        <h4 class="sub-label">Recent</h4>
        ${recent.length ? `<div class="card list-card">${recent.map(e => `<a class="list-row" href="#/calendar?day=${e.date}" data-close-go><div class="grow"><b>${fmtDay(e.date)}</b> <span class="muted small">${e.time || ''} · ${relDays(e.date)}</span>${e.note ? `<div class="muted small">${esc(e.note)}</div>` : ''}</div>${icon('chevR')}</a>`).join('')}</div>` : '<p class="muted">No entries yet.</p>'}
        <div class="row-between" style="margin-top:16px"><button class="btn ghost danger" data-del>${icon('trash')}Delete tracker</button><button class="btn ghost" data-edit>${icon('edit')}Edit</button></div>`;
      body.querySelector('[data-lognow]').onclick = () => { logEvent(t.id); close(); rerender(); };
      body.querySelector('[data-edit]').onclick = () => { close(); trackerSheet(t); };
      body.querySelectorAll('[data-close-go]').forEach(a => a.addEventListener('click', () => close()));
      body.querySelector('[data-del]').onclick = async () => {
        if (!await confirmDialog(`Delete “${t.name}” and all ${s.total} entries?`)) return;
        list('events').filter(e => e.trackerId === t.id).forEach(e => remove('events', e.id));
        remove('trackers', t.id); if (ui.filter === t.id) ui.filter = ''; close(); rerender();
      };
    },
  });
}
