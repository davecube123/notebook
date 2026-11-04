// Anchor habits: a short daily list. Checking every one marks the day "perfect"
// and extends the streak.
import { list, get, save, remove, uid } from '../db.js';
import { esc, today, addDays, fmtDay, fmtLongDay, parseDay, haptic, weekdayNames } from '../util.js';
import { icon } from '../icons.js';
import { rerender, navigate } from '../router.js';
import { sheet, toast, confetti, confirmDialog, emojiPicker, menu } from '../ui.js';
import { heatmap } from './heatmap.js';
import { settings } from '../db.js';

const dayOf = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export const activeHabits = () => list('habits').filter(h => !h.archivedAt).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.created - b.created);

// Habits that "counted" on a given day: created on/before it and not archived before it
export function habitsOn(day) {
  return list('habits').filter(h => (h.startDay || dayOf(h.created)) <= day && (!h.archivedAt || dayOf(h.archivedAt) > day));
}

export const logFor = day => get('habitlogs', day) || { id: day, done: [] };

export function isPerfect(day) {
  const hs = habitsOn(day);
  if (!hs.length) return false;
  const done = new Set(logFor(day).done);
  return hs.every(h => done.has(h.id));
}

export function toggleHabit(day, hid, el) {
  const log = logFor(day);
  const wasPerfect = isPerfect(day);
  const done = log.done.includes(hid) ? log.done.filter(x => x !== hid) : [...log.done, hid];
  save('habitlogs', { ...log, done, updated: Date.now() });
  haptic(8);
  if (!wasPerfect && isPerfect(day)) {
    confetti(el); haptic([15, 50, 25]);
    const s = habitStats();
    toast(day === today() ? `All anchors done — ${s.streak} day streak 🔥` : `${fmtDay(day)} is now a perfect day`);
  }
}

export function habitStats() {
  const t = today();
  let streak = 0;
  let d = isPerfect(t) ? t : addDays(t, -1);
  while (isPerfect(d)) { streak++; d = addDays(d, -1); }
  const logs = list('habitlogs').map(l => l.id).sort();
  let best = 0, run = 0, prev = null;
  logs.forEach(k => { if (!isPerfect(k)) { run = 0; prev = null; return; } run = prev && addDays(prev, 1) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; });
  const perfectTotal = logs.filter(isPerfect).length;
  return { streak, best: Math.max(best, streak), perfectTotal };
}

// ---------- one habit ----------
const startOf = h => h.startDay || dayOf(h.created);
const doneOn = (h, d) => logFor(d).done.includes(h.id);
// a habit counts on a day from its start until it's archived (never in the future)
const countsOn = (h, d) => d >= startOf(h) && d <= today() && (!h.archivedAt || dayOf(h.archivedAt) > d);

function habitStreak(h) {
  const t = today();
  let s = 0, d = doneOn(h, t) ? t : addDays(t, -1);
  while (doneOn(h, d)) { s++; d = addDays(d, -1); }
  let n = 0, hit = 0;
  for (let i = 0; i < 30; i++) { const k = addDays(t, -i); if (k < startOf(h)) break; n++; if (doneOn(h, k)) hit++; }
  // best run since it started
  let best = 0, run = 0;
  for (let k = startOf(h); k <= t; k = addDays(k, 1)) { run = doneOn(h, k) ? run + 1 : 0; best = Math.max(best, run); }
  return { streak: s, rate: n ? Math.round(100 * hit / n) : 0, best, doneToday: doneOn(h, t) };
}

// Done days in a row join into one chain. cells: [{ day, state: on|off|todo|none }]
function chainClasses(cells, i) {
  const on = c => c && c.state === 'on';
  return on(cells[i]) ? `${on(cells[i - 1]) ? ' jl' : ''}${on(cells[i + 1]) ? ' jr' : ''}` : '';
}
function habitStrip(h, days = 14) {
  const t = today();
  const cells = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(t, -i);
    cells.push({ day: d, state: !countsOn(h, d) ? 'none' : doneOn(h, d) ? 'on' : d === t ? 'todo' : 'off' });
  }
  return `<div class="hs-strip" role="group" aria-label="${esc(h.name)}, last ${days} days">${cells.map((c, i) => c.state === 'none'
    ? '<i class="hs-cell none"></i>'
    : `<button class="hs-cell ${c.state}${chainClasses(cells, i)}" data-hcell="${h.id}" data-day="${c.day}" aria-label="${fmtDay(c.day)}: ${c.state === 'on' ? 'done' : c.state === 'todo' ? 'not done yet' : 'missed'}" aria-pressed="${c.state === 'on'}"></button>`).join('')}</div>`;
}

// Compact checklist card for the Today page (and top of Habits page)
export function habitsCard(day = today(), { showHeader = true } = {}) {
  const hs = day === today() ? activeHabits() : habitsOn(day);
  const log = logFor(day);
  const s = habitStats();
  const n = hs.filter(h => log.done.includes(h.id)).length;
  if (!hs.length) return `<div class="card pad habits-card">
      ${showHeader ? `<div class="card-head"><h3>${icon('habits')}Anchor habits</h3></div>` : ''}
      <p class="muted">Pick 3–5 small things you commit to every single day. Check them all to keep the streak alive.</p>
      <button class="btn primary" data-habit-new>${icon('plus')}Add your first anchor</button></div>`;
  const pct = Math.round(100 * n / hs.length);
  return `<div class="card habits-card ${n === hs.length ? 'perfect' : ''}">
    ${showHeader ? `<div class="card-head pad-x"><h3>${icon('habits')}Anchor habits</h3><a class="streak-pill" href="#/habits">${icon('flame')}${s.streak}</a></div>` : ''}
    <div class="progress" aria-label="${n} of ${hs.length} done"><span style="width:${pct}%"></span></div>
    <div class="habit-list">${hs.map(h => {
      const on = log.done.includes(h.id);
      return `<button class="habit-row ${on ? 'on' : ''}" data-habit-toggle="${h.id}" data-day="${day}" role="checkbox" aria-checked="${on}">
        <span class="habit-emoji">${esc(h.emoji || '✨')}</span>
        <span class="habit-text"><span class="habit-name">${esc(h.name)}</span>${h.cue ? `<span class="habit-cue">${esc(h.cue)}</span>` : ''}</span>
        <span class="check-circle">${icon('check')}</span></button>`;
    }).join('')}</div>
    ${n === hs.length ? `<div class="perfect-banner">${icon('sparkle')}Perfect day — streak box checked.</div>` : `<div class="habit-foot muted small">${hs.length - n} to go to keep your streak</div>`}
  </div>`;
}

export function bindHabits(root, after = rerender) {
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-habit-toggle]');
    if (t) { toggleHabit(t.dataset.day, t.dataset.habitToggle, t); after(); return; }
    if (e.target.closest('[data-habit-new]')) habitSheet(null, after);
  });
}

// tick / untick one habit on one day; past days get an Undo
function toggleDay(hid, day, el, after = rerender) {
  const was = logFor(day).done.includes(hid);
  toggleHabit(day, hid, el); after();
  if (day !== today()) toast(`${fmtDay(day)}: ${was ? 'unticked' : 'ticked'}`, { action: 'Undo', onAction: () => { toggleHabit(day, hid); after(); } });
}

export function renderHabits(main, params = {}) {
  if (params.id) return renderHabitDetail(main, params.id);
  const s = habitStats();
  const hs = activeHabits();
  const archived = list('habits').filter(h => h.archivedAt);
  const t = today();
  main.innerHTML = `<div class="page">
    <header class="page-head"><div class="page-title-row"><h1>Habits</h1>
      <div class="head-actions"><button class="icon-btn accent" data-habit-new aria-label="New habit">${icon('plus')}</button></div></div>
      <p class="muted">${fmtLongDay(t)}</p></header>

    ${hs.length ? `<div class="streak-hero card pad compact">
      <div class="streak-big"><span class="flame ${s.streak ? 'lit' : ''}">${icon('flame')}</span><div><div class="streak-n">${s.streak}</div><div class="muted small">perfect day${s.streak === 1 ? '' : 's'} in a row</div></div></div>
      <div class="streak-side"><div><b>${s.best}</b><span class="muted small">best</span></div><div><b>${s.perfectTotal}</b><span class="muted small">perfect days</span></div></div>
    </div>` : habitsCard(t, { showHeader: false })}

    ${hs.length ? `<section class="card pad hs-card">
      <div class="hs-head"><h3>Your anchors</h3><span class="muted small">last 14 days · tap a day to fix it</span></div>
      <div class="hs-dow" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => { const d = addDays(t, i - 13); return `<span class="${d === t ? 'today' : ''}">${fmtDay(d, { weekday: 'narrow' })}</span>`; }).join('')}</div>
      ${hs.map(h => { const st = habitStreak(h); return `<div class="hs-habit">
        <div class="hs-top">
          <a class="hs-name" href="#/habits/${h.id}"><span class="habit-emoji">${esc(h.emoji || '✨')}</span><b>${esc(h.name)}</b></a>
          <span class="hs-streak ${st.streak >= 7 ? 'hot' : ''}" title="${st.streak} day streak">${icon('flame')}${st.streak}</span>
          <button class="icon-btn sm" data-habit-menu="${h.id}" aria-label="Options for ${esc(h.name)}">${icon('more')}</button>
        </div>
        ${habitStrip(h)}
        <a class="hs-meta muted small" href="#/habits/${h.id}">${h.cue ? esc(h.cue) + ' · ' : ''}${st.rate}% in the last 30 days${icon('chevR')}</a>
      </div>`; }).join('')}
    </section>` : ''}

    <section class="section"><h3 class="group-label">Perfect days</h3>
      <div class="card pad">${heatmap(d => { const hs2 = habitsOn(d); if (!hs2.length) return 0; const dn = new Set(logFor(d).done); const r = hs2.filter(h => dn.has(h.id)).length / hs2.length; return r === 1 ? 4 : r >= .66 ? 3 : r > .33 ? 2 : r > 0 ? 1 : 0; }, { weeks: 26, legend: [['Some', 1], ['Most', 3], ['Perfect', 4]], title: d => fmtDay(d) + (isPerfect(d) ? ' — perfect' : '') })}
      <p class="muted small">Tap a day in a habit’s chain to fill in one you forgot to log.</p></div>
    </section>

    ${archived.length ? `<section class="section"><h3 class="group-label">Archived</h3><div class="card list-card">${archived.map(h => `<div class="list-row"><span class="habit-emoji">${esc(h.emoji || '✨')}</span><div class="grow muted">${esc(h.name)}</div><button class="btn ghost sm" data-unarchive="${h.id}">Restore</button></div>`).join('')}</div></section>` : ''}

    <div class="tip card pad">${icon('info')}<div><b>Make them anchors.</b> Tie each habit to something you already do — “After I pour coffee, I write one line.” Keep them tiny enough to do on your worst day.</div></div>
  </div>`;
  const page = main.querySelector('.page');
  bindHabits(page);
  page.addEventListener('click', e => {
    const mv = e.target.closest('[data-move]');
    if (mv) {
      const arr = activeHabits(); const i = arr.findIndex(h => h.id === mv.dataset.move); const j = i + +mv.dataset.dir;
      if (j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      arr.forEach((h, k) => save('habits', { ...h, order: k }));
      rerender(); return;
    }
    const m = e.target.closest('[data-habit-menu]');
    if (m) {
      const h = get('habits', m.dataset.habitMenu);
      const arr = activeHabits(), at = arr.findIndex(x => x.id === h.id);
      const move = dir => { const j = at + dir; [arr[at], arr[j]] = [arr[j], arr[at]]; arr.forEach((x, k) => save('habits', { ...x, order: k })); rerender(); };
      menu(m, [
        { label: 'Open', icon: 'chevR', action: () => navigate(`#/habits/${h.id}`) },
        { label: 'Edit', icon: 'edit', action: () => habitSheet(h) },
        at > 0 ? { label: 'Move up', icon: 'sort', action: () => move(-1) } : null,
        at >= 0 && at < arr.length - 1 ? { label: 'Move down', icon: 'sort', action: () => move(1) } : null,
        { label: 'Archive', icon: 'archive', action: () => { save('habits', { ...h, archivedAt: Date.now() }); toast('Archived — past streaks are kept'); rerender(); } },
        { label: 'Delete', icon: 'trash', danger: true, action: async () => {
          if (!await confirmDialog(`Delete “${h.name}” and its history? Archiving keeps history instead.`)) return;
          remove('habits', h.id);
          list('habitlogs').forEach(l => l.done.includes(h.id) && save('habitlogs', { ...l, done: l.done.filter(x => x !== h.id) }));
          rerender();
        } },
      ]);
      return;
    }
    const ua = e.target.closest('[data-unarchive]');
    if (ua) { const h = get('habits', ua.dataset.unarchive); save('habits', { ...h, archivedAt: null, startDay: today(), order: activeHabits().length }); rerender(); return; }
    const hc = e.target.closest('[data-hcell]');
    if (hc) { toggleDay(hc.dataset.hcell, hc.dataset.day, hc); return; }
    const od = e.target.closest('[data-day-open]');
    if (od) dayHabitsSheet(od.dataset.dayOpen);
  });
}

export function dayHabitsSheet(day) {
  sheet({
    title: fmtLongDay(day),
    onClose: () => rerender(),
    render(body) {
      const draw = () => { body.innerHTML = habitsOn(day).length ? habitsCard(day, { showHeader: false }) : '<p class="muted">No habits existed on this day.</p>'; };
      draw();
      body.addEventListener('click', e => { const t = e.target.closest('[data-habit-toggle]'); if (t) { toggleHabit(day, t.dataset.habitToggle, t); draw(); } });
    },
  });
}

const SUGGESTED = [['💧', 'Drink a glass of water', 'After I wake up'], ['🧘', 'Meditate 5 minutes', 'After I make coffee'], ['📚', 'Read 10 pages', 'Before bed'], ['🚶', 'Walk 20 minutes', 'After lunch'], ['✍️', 'Write one line', 'After dinner'], ['📵', 'No phone first hour', 'When I wake up'], ['💪', '20 push-ups', 'After I brush my teeth'], ['🙏', 'Name 3 gratitudes', 'Before I sleep']];

export function habitSheet(h, after = rerender) {
  const isNew = !h;
  h = h || { emoji: '✨', name: '', cue: '' };
  sheet({
    title: isNew ? 'New anchor habit' : 'Edit habit',
    render(body, close) {
      body.innerHTML = `<form class="stack">
        <div class="emoji-field"><button type="button" class="emoji-big" data-emoji-toggle>${esc(h.emoji)}</button>
          <label class="field grow"><span>Habit</span><input class="input" name="name" value="${esc(h.name)}" placeholder="e.g. Read 10 pages" maxlength="60" required autofocus></label></div>
        <div class="emoji-wrap" hidden>${emojiPicker(h.emoji)}</div>
        <label class="field"><span>Anchor / cue <em class="faint">optional</em></span><input class="input" name="cue" value="${esc(h.cue || '')}" placeholder="After I…" maxlength="80"></label>
        ${isNew ? `<div><div class="muted small" style="margin-bottom:6px">Or start from a suggestion</div><div class="chip-row wrap">${SUGGESTED.map(([e, n, c]) => `<button type="button" class="chip" data-sug="${esc(e)}|${esc(n)}|${esc(c)}">${e} ${esc(n)}</button>`).join('')}</div></div>` : ''}
        <div class="row-end"><button type="button" class="btn ghost" data-cancel>Cancel</button><button class="btn primary">${isNew ? 'Add habit' : 'Save'}</button></div>
      </form>`;
      const f = body.querySelector('form');
      let emoji = h.emoji;
      body.querySelector('[data-cancel]').onclick = () => close();
      body.addEventListener('click', e => {
        if (e.target.closest('[data-emoji-toggle]')) { const w = body.querySelector('.emoji-wrap'); w.hidden = !w.hidden; }
        const em = e.target.closest('[data-emoji]');
        if (em) { emoji = em.dataset.emoji; body.querySelector('.emoji-big').textContent = emoji; body.querySelector('.emoji-wrap').hidden = true; }
        const sg = e.target.closest('[data-sug]');
        if (sg) { const [e2, n, c] = sg.dataset.sug.split('|'); emoji = e2; body.querySelector('.emoji-big').textContent = e2; f.name.value = n; f.cue.value = c; }
      });
      f.onsubmit = e => {
        e.preventDefault();
        const name = f.name.value.trim(); if (!name) return;
        if (isNew) save('habits', { id: uid(), name, cue: f.cue.value.trim(), emoji, created: Date.now(), startDay: today(), order: activeHabits().length, archivedAt: null });
        else save('habits', { ...h, name, cue: f.cue.value.trim(), emoji });
        close(); after();
      };
    },
  });
}

// ---------- one habit, in depth (#/habits/:id) ----------
const detailUi = { id: null, y: 0, m: 0 };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function renderHabitDetail(main, id) {
  const h = get('habits', id);
  if (!h) { navigate('#/habits', { replace: true }); return; }
  const t = today();
  if (detailUi.id !== id) Object.assign(detailUi, { id, y: parseDay(t).getFullYear(), m: parseDay(t).getMonth() });
  const st = habitStreak(h);
  const ws = settings().weekStart;
  const ym = d => d.slice(0, 7);

  // month calendar: done days join into chains within each week row
  const first = new Date(detailUi.y, detailUi.m, 1);
  const lead = (first.getDay() - ws + 7) % 7;
  const n = new Date(detailUi.y, detailUi.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push({ state: 'blank' });
  for (let k = 1; k <= n; k++) {
    const d = `${detailUi.y}-${String(detailUi.m + 1).padStart(2, '0')}-${String(k).padStart(2, '0')}`;
    cells.push({ day: d, n: k, state: !countsOn(h, d) ? 'none' : doneOn(h, d) ? 'on' : d === t ? 'todo' : 'off' });
  }
  while (cells.length % 7) cells.push({ state: 'blank' });
  const inMonth = cells.filter(c => c.state === 'on' || c.state === 'off' || c.state === 'todo');
  const month = cells.map((c, i) => {
    if (c.state === 'blank') return '<span></span>';
    const row = [Math.floor(i / 7) * 7, Math.floor(i / 7) * 7 + 6];
    const nb = j => (j >= row[0] && j <= row[1] ? cells[j] : null);
    const join = c.state === 'on' ? `${nb(i - 1)?.state === 'on' ? ' jl' : ''}${nb(i + 1)?.state === 'on' ? ' jr' : ''}` : '';
    return c.state === 'none'
      ? `<span class="hd-day none">${c.n}</span>`
      : `<button class="hd-day ${c.state}${join}" data-hcell="${h.id}" data-day="${c.day}" aria-label="${fmtDay(c.day)}: ${c.state === 'on' ? 'done' : c.state === 'todo' ? 'not done yet' : 'missed'}" aria-pressed="${c.state === 'on'}">${c.n}</button>`;
  }).join('');
  const thisMonth = ym(t) === `${detailUi.y}-${String(detailUi.m + 1).padStart(2, '0')}`;

  // 26 weeks, one column per week
  const weekStart = addDays(t, -((parseDay(t).getDay() - ws + 7) % 7));
  const from = addDays(weekStart, -25 * 7);
  let heatDone = 0, heatDays = 0;
  const heat = [];
  for (let i = 0; i < 26 * 7; i++) {
    const d = addDays(from, i);
    if (!countsOn(h, d)) { heat.push(`<i class="hd-heat ${d > t ? 'future' : 'none'}"></i>`); continue; }
    const on = doneOn(h, d); heatDays++; if (on) heatDone++;
    heat.push(`<i class="hd-heat ${on ? 'on' : 'off'}" title="${fmtDay(d)}: ${on ? 'done' : 'missed'}"></i>`);
  }

  // by weekday, over the last 12 weeks it existed
  const byDow = Array.from({ length: 7 }, () => [0, 0]);
  for (let i = 0; i < 84; i++) { const d = addDays(t, -i); if (!countsOn(h, d) || (d === t && !doneOn(h, d))) continue; const w = (parseDay(d).getDay() - ws + 7) % 7; byDow[w][1]++; if (doneOn(h, d)) byDow[w][0]++; }
  const pct = byDow.map(([a, b]) => (b ? Math.round(100 * a / b) : null));
  const enough = byDow.every(([, b]) => b >= 2);
  const valid = pct.filter(v => v !== null);
  const lowI = enough ? pct.indexOf(Math.min(...valid)) : -1;
  const names = weekdayNames(ws);
  const fullNames = names.map((_, i) => fmtDay(addDays(weekStart, i), { weekday: 'long' }));
  const weakest = enough && Math.max(...valid) - pct[lowI] >= 10 ? `${fullNames[lowI]}s slip most` : enough ? 'Steady across the week' : '';

  main.innerHTML = `<div class="page hd-page">
    <header class="detail-head"><a class="link" href="#/habits">${icon('back')}Habits</a>
      <button class="icon-btn" data-habit-menu="${h.id}" aria-label="Options">${icon('more')}</button></header>
    <div class="hd-title"><span class="habit-emoji big">${esc(h.emoji || '✨')}</span><div><h1>${esc(h.name)}</h1>
      <p class="muted small">${h.cue ? esc(h.cue) + ' · ' : ''}since ${fmtDay(startOf(h), { month: 'short', day: 'numeric', year: 'numeric' })}${h.archivedAt ? ' · archived' : ''}</p></div></div>
    <div class="hd-stats">
      <div class="card ${st.streak >= 7 ? 'hd-hot' : ''}"><b>${icon('flame')}${st.streak}</b><span>day streak</span></div>
      <div class="card"><b>${st.best}</b><span>best streak</span></div>
      <div class="card"><b>${st.rate}%</b><span>last 30 days</span></div>
    </div>
    <section class="card pad hd-month">
      <div class="hd-month-head"><b>${MONTHS[detailUi.m]}${detailUi.y !== parseDay(t).getFullYear() ? ' ' + detailUi.y : ''}</b>
        <span><button class="icon-btn sm" data-hm="-1" aria-label="Previous month">${icon('back')}</button><button class="icon-btn sm" data-hm="1" aria-label="Next month" ${thisMonth ? 'disabled' : ''}>${icon('chevR')}</button></span></div>
      <div class="hd-dow">${names.map(x => `<span>${x.slice(0, 1)}</span>`).join('')}</div>
      <div class="hd-grid">${month}</div>
      <p class="muted small">${inMonth.filter(c => c.state === 'on').length} of ${inMonth.length} days · tap a day to tick or untick it</p>
    </section>
    <section class="card pad">
      <div class="hd-sec-head"><b>Last 6 months</b><span class="muted small">${heatDone} of ${heatDays} days</span></div>
      <div class="hd-heatmap" role="img" aria-label="Done ${heatDone} of ${heatDays} days in the last 26 weeks">${heat.join('')}</div>
    </section>
    <section class="card pad">
      <div class="hd-sec-head"><b>By weekday</b><span class="muted small">${weakest}</span></div>
      ${enough ? `<div class="hd-bars">${pct.map((v, i) => `<div class="hd-bar" title="${fullNames[i]}: ${v}%"><span>${v}%</span><i class="${i === lowI && weakest.includes('slip') ? 'low' : ''}" style="height:${Math.max(4, Math.round(v * 0.5))}px"></i></div>`).join('')}</div>
        <div class="hd-bar-labels">${names.map(x => `<span>${x.slice(0, 1)}</span>`).join('')}</div>`
      : '<p class="muted small">Shows up after two weeks, once there’s enough to compare days.</p>'}
    </section>
  </div>`;
  const page = main.querySelector('.page');
  page.addEventListener('click', e => {
    const mm = e.target.closest('[data-hm]');
    if (mm) { const d = new Date(detailUi.y, detailUi.m + +mm.dataset.hm, 1); detailUi.y = d.getFullYear(); detailUi.m = d.getMonth(); rerender(); return; }
    const hc = e.target.closest('[data-hcell]');
    if (hc) { toggleDay(hc.dataset.hcell, hc.dataset.day, hc); return; }
    const m = e.target.closest('[data-habit-menu]');
    if (m) menu(m, [
      { label: 'Edit', icon: 'edit', action: () => habitSheet(get('habits', id)) },
      h.archivedAt ? null : { label: 'Archive', icon: 'archive', action: () => { save('habits', { ...get('habits', id), archivedAt: Date.now() }); toast('Archived — past streaks are kept'); navigate('#/habits'); } },
    ]);
  });
}
