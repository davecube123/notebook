// Anchor habits: a short daily list. Checking every one marks the day "perfect"
// and extends the streak.
import { list, get, save, remove, uid } from '../db.js';
import { esc, today, addDays, fmtDay, fmtLongDay, parseDay, haptic, weekdayNames } from '../util.js';
import { icon } from '../icons.js';
import { rerender } from '../router.js';
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

function habitStreak(h) {
  const t = today();
  const done = d => logFor(d).done.includes(h.id);
  let s = 0, d = done(t) ? t : addDays(t, -1);
  while (done(d)) { s++; d = addDays(d, -1); }
  const start = h.startDay || dayOf(h.created);
  let n = 0, hit = 0;
  for (let i = 0; i < 30; i++) { const k = addDays(t, -i); if (k < start) break; n++; if (done(k)) hit++; }
  return { streak: s, rate: n ? Math.round(100 * hit / n) : 0 };
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

function streakBoxes(days = 14) {
  const t = today();
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(t, -i);
    const p = isPerfect(d);
    const hs = habitsOn(d); const done = new Set(logFor(d).done);
    const part = hs.length ? hs.filter(h => done.has(h.id)).length / hs.length : 0;
    out.push(`<button class="sbox ${p ? 'on' : part > 0 ? 'part' : ''} ${d === t ? 'today' : ''}" data-day-open="${d}" title="${fmtDay(d)}">
      <span class="sbox-d">${fmtDay(d, { weekday: 'narrow' })}</span><span class="sbox-b">${p ? icon('check') : ''}</span><span class="sbox-n">${parseDay(d).getDate()}</span></button>`);
  }
  return `<div class="streak-boxes">${out.join('')}</div>`;
}

export function renderHabits(main) {
  const s = habitStats();
  const hs = activeHabits();
  const archived = list('habits').filter(h => h.archivedAt);
  const t = today();
  main.innerHTML = `<div class="page">
    <header class="page-head"><div class="page-title-row"><h1>Habits</h1>
      <div class="head-actions"><button class="icon-btn accent" data-habit-new aria-label="New habit">${icon('plus')}</button></div></div>
      <p class="muted">${fmtLongDay(t)}</p></header>

    <div class="streak-hero card pad">
      <div class="streak-big"><span class="flame ${s.streak ? 'lit' : ''}">${icon('flame')}</span><div><div class="streak-n">${s.streak}</div><div class="muted small">day streak</div></div></div>
      <div class="streak-side"><div><b>${s.best}</b><span class="muted small">best</span></div><div><b>${s.perfectTotal}</b><span class="muted small">perfect days</span></div></div>
      ${streakBoxes(14)}
    </div>

    ${habitsCard(t, { showHeader: false })}

    ${hs.length ? `<section class="section"><h3 class="group-label">Your anchors</h3><div class="card list-card">
      ${hs.map((h, i) => { const st = habitStreak(h); return `<div class="list-row">
        <span class="habit-emoji">${esc(h.emoji || '✨')}</span>
        <div class="grow"><div><b>${esc(h.name)}</b></div><div class="muted small">${h.cue ? esc(h.cue) + ' · ' : ''}${st.streak} day streak · ${st.rate}% last 30 days</div></div>
        <button class="icon-btn sm" data-move="${h.id}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${icon('chevD', 'flip')}</button>
        <button class="icon-btn sm" data-move="${h.id}" data-dir="1" ${i === hs.length - 1 ? 'disabled' : ''} aria-label="Move down">${icon('chevD')}</button>
        <button class="icon-btn sm" data-habit-menu="${h.id}" aria-label="Options">${icon('more')}</button></div>`; }).join('')}
    </div></section>` : ''}

    <section class="section"><h3 class="group-label">Perfect days</h3>
      <div class="card pad">${heatmap(d => { const hs2 = habitsOn(d); if (!hs2.length) return 0; const dn = new Set(logFor(d).done); const r = hs2.filter(h => dn.has(h.id)).length / hs2.length; return r === 1 ? 4 : r >= .66 ? 3 : r > .33 ? 2 : r > 0 ? 1 : 0; }, { weeks: 26, legend: [['Some', 1], ['Most', 3], ['Perfect', 4]], title: d => fmtDay(d) + (isPerfect(d) ? ' — perfect' : '') })}
      <p class="muted small">Tap a streak box to fill in a day you forgot to log.</p></div>
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
      menu(m, [
        { label: 'Edit', icon: 'edit', action: () => habitSheet(h) },
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
