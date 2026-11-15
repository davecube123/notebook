// Habits with a rhythm: daily, or a number of times a week, month or quarter.
// Today's list shows what is still due; a habit that has met its target for the
// period moves to "Done for now" until the next period. Checking enough habits
// wins the day, and won days make the streak.
import { list, get, save, remove, uid, settings, setSettings } from '../db.js';
import { esc, today, addDays, fmtDay, fmtLongDay, parseDay, daysBetween, haptic, weekdayNames } from '../util.js';
import { icon } from '../icons.js';
import { rerender, navigate } from '../router.js';
import { sheet, toast, confetti, confirmDialog, emojiPicker, menu } from '../ui.js';
import { heatmap } from './heatmap.js';
import { getOne, toggleOne } from './onething.js';

const dayOf = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export const activeHabits = () => list('habits').filter(h => !h.archivedAt).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.created - b.created);

// Habits that existed on a given day: started on/before it and not archived before it
export function habitsOn(day) {
  return list('habits').filter(h => (h.startDay || dayOf(h.created)) <= day && (!h.archivedAt || dayOf(h.archivedAt) > day))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.created - b.created);
}

export const logFor = day => get('habitlogs', day) || { id: day, done: [] };

const startOf = h => h.startDay || dayOf(h.created);
const doneOn = (h, d) => logFor(d).done.includes(h.id);
// a habit counts on a day from its start until it's archived (never in the future)
const countsOn = (h, d) => d >= startOf(h) && d <= today() && (!h.archivedAt || dayOf(h.archivedAt) > d);

// ---------- rhythms and periods ----------
export const RHYTHMS = [['daily', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly'], ['quarter', 'Quarterly']];
const PERIOD = { daily: 'day', week: 'week', month: 'month', quarter: 'quarter' };
const rhythmOf = h => h.rhythm || 'daily';
const targetOf = h => (rhythmOf(h) === 'daily' ? 1 : Math.max(1, h.target || 1));
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
export const rhythmLabel = h => {
  const r = rhythmOf(h), n = targetOf(h);
  if (r === 'daily') return 'Every day';
  return `${n === 1 ? 'Once' : n === 2 ? 'Twice' : `${n} times`} a ${PERIOD[r]}`;
};

// The period (week / month / quarter) a day falls in
export function periodOf(r, day) {
  if (r === 'daily') return { start: day, end: day };
  const d = parseDay(day);
  if (r === 'week') {
    const s = addDays(day, -((d.getDay() - settings().weekStart + 7) % 7));
    return { start: s, end: addDays(s, 6) };
  }
  const m0 = r === 'quarter' ? Math.floor(d.getMonth() / 3) * 3 : d.getMonth();
  const len = r === 'quarter' ? 3 : 1;
  const key = (y, m, dd) => `${y}-${String(m + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const last = new Date(d.getFullYear(), m0 + len, 0);
  return { start: key(d.getFullYear(), m0, 1), end: key(last.getFullYear(), last.getMonth(), last.getDate()) };
}
const countBetween = (h, a, b) => { let n = 0; for (let d = a; d <= b; d = addDays(d, 1)) if (doneOn(h, d)) n++; return n; };

// Where a habit stands on a day: is it due, how far along its period, how much time is left
export function habitState(h, day = today()) {
  const r = rhythmOf(h), target = targetOf(h), { start, end } = periodOf(r, day);
  const before = r === 'daily' ? 0 : countBetween(h, start, addDays(day, -1));
  const doneToday = doneOn(h, day);
  const count = before + (doneToday ? 1 : 0);
  const restedBefore = r !== 'daily' && before >= target; // target already met earlier in the period
  const due = countsOn(h, day) && (!restedBefore || doneToday || h.hideWhenDone === false);
  return { r, target, start, end, before, count, doneToday, met: count >= target, restedBefore, due,
    remaining: Math.max(0, target - count), daysLeft: daysBetween(day, end) + 1 };
}

// ---------- winning the day ----------
export const winTarget = () => settings().winTarget || 5;
// The day's One Thing, once written, is a daily habit of its own: it shows in the
// list and counts toward winning the day.
const oneOf = day => { const o = getOne(day); return o && o.text?.trim() ? o : null; };
// today it always has a place (it can't be ticked until it's written); past days only if written
const oneSlot = day => day === today() || !!oneOf(day);

export function dayScore(day) {
  const due = habitsOn(day).filter(h => habitState(h, day).due);
  const counting = due.filter(h => h.countsToWin !== false);
  const one = oneOf(day), slot = oneSlot(day) ? 1 : 0;
  const nCount = counting.length + slot, nDue = due.length + slot;
  const done = counting.filter(h => doneOn(h, day)).length + (one?.done ? 1 : 0);
  const allDone = due.every(h => doneOn(h, day)) && (!slot || !!one?.done);
  // winning takes every daily habit (and the One Thing), plus enough checks to reach the target
  const dailies = counting.filter(h => rhythmOf(h) === 'daily');
  const dailyTotal = dailies.length + slot, dailyDone = dailies.filter(h => doneOn(h, day)).length + (one?.done ? 1 : 0);
  const target = Math.max(1, dailyTotal, Math.min(winTarget(), nCount));
  return {
    done, target, due: nDue, dailyLeft: dailyTotal - dailyDone,
    won: nCount > 0 && done >= target && dailyDone === dailyTotal,
    perfect: nDue > 0 && allDone,
    showedUp: due.some(h => doneOn(h, day)) || !!one?.done,
  };
}
// kept for other views: every habit due that day was done
export const isPerfect = day => dayScore(day).perfect;

export function habitStats() {
  const t = today();
  const first = list('habits').map(startOf).sort()[0];
  let streak = 0, d = dayScore(t).won ? t : addDays(t, -1);
  while (first && d >= first && dayScore(d).won) { streak++; d = addDays(d, -1); }
  let best = 0, run = 0, won = 0;
  if (first) for (let k = first; k <= t; k = addDays(k, 1)) { if (dayScore(k).won) { run++; won++; } else run = 0; best = Math.max(best, run); }
  return { streak, best: Math.max(best, streak), wonTotal: won };
}

// After a change: celebrate a newly won or perfect day. Returns true if it did.
function celebrate(day, was, el) {
  const now = dayScore(day);
  if (!was.won && now.won) {
    haptic([15, 50, 25]); confetti(el);
    if (day === today()) winSheet(); else toast(`${fmtDay(day)} is now a won day`);
    return true;
  }
  if (!was.perfect && now.perfect) { confetti(el); toast(day === today() ? 'Perfect day: everything due is done' : `${fmtDay(day)} is now a perfect day`); return true; }
  return false;
}

export function toggleOneThing(day, el) {
  const was = dayScore(day);
  const o = oneOf(day);
  if (!o) { toast('Write today’s One Thing first', { action: 'Write', onAction: () => navigate('#/onething') }); return; }
  if (o.done) { save('onething', { ...o, done: false, doneAt: null }); haptic(8); return; }
  if (!celebrateLater(day, was, el)) toggleOne(day, el);
}
// tick the one thing quietly when the win sheet will celebrate it anyway
function celebrateLater(day, was, el) {
  const o = getOne(day);
  save('onething', { ...o, done: true, doneAt: Date.now() });
  if (celebrate(day, was, el)) return true;
  save('onething', o); // nothing new to celebrate: let the One Thing's own moment play
  return false;
}

export function toggleHabit(day, hid, el) {
  const h = get('habits', hid);
  const was = dayScore(day), wasMet = h && habitState(h, day).met;
  const log = logFor(day);
  const done = log.done.includes(hid) ? log.done.filter(x => x !== hid) : [...log.done, hid];
  save('habitlogs', { ...log, done, updated: Date.now() });
  haptic(8);
  if (celebrate(day, was, el)) return;
  const now = dayScore(day);
  if (h && rhythmOf(h) !== 'daily' && !wasMet && habitState(h, day).met) {
    haptic([10, 40, 10]);
    toast(`${h.name}: done for the ${PERIOD[rhythmOf(h)]} ✓`);
  }
}

// ---------- one habit's streak, counted in its own rhythm ----------
function habitStreak(h) {
  const t = today(), r = rhythmOf(h), target = targetOf(h);
  const metIn = p => countBetween(h, p.start, p.end > t ? t : p.end) >= target;
  const prevPeriod = p => periodOf(r, addDays(p.start, -1));
  let p = periodOf(r, t);
  if (!metIn(p)) p = prevPeriod(p);
  let streak = 0;
  while (p.end >= startOf(h) && metIn(p)) { streak++; p = prevPeriod(p); }
  // best run since it started
  let best = 0, run = 0;
  for (let q = periodOf(r, startOf(h)); q.start <= t; q = periodOf(r, addDays(q.end, 1))) { if (metIn(q)) run++; else if (q.end < t) run = 0; best = Math.max(best, run); }
  // rate: last 30 days for daily, last 8 finished periods otherwise
  let n = 0, hit = 0;
  if (r === 'daily') { for (let i = 0; i < 30; i++) { const k = addDays(t, -i); if (k < startOf(h)) break; n++; if (doneOn(h, k)) hit++; } }
  else { let q = prevPeriod(periodOf(r, t)); for (let i = 0; i < 8 && q.end >= startOf(h); i++, q = prevPeriod(q)) { n++; if (metIn(q)) hit++; } }
  return { streak, best: Math.max(best, streak), rate: n ? Math.round(100 * hit / n) : null, unit: PERIOD[r], doneToday: doneOn(h, t) };
}
const streakLabel = st => (st.unit === 'day' ? `${st.streak}` : `${st.streak} ${st.unit[0]}`);

// Done days (or periods) in a row join into one chain
const join = (cells, i) => (cells[i]?.state === 'on' ? `${cells[i - 1]?.state === 'on' ? ' jl' : ''}${cells[i + 1]?.state === 'on' ? ' jr' : ''}` : '');
function habitStrip(h) {
  const t = today(), r = rhythmOf(h), target = targetOf(h);
  if (r === 'daily') {
    const cells = [];
    for (let i = 13; i >= 0; i--) { const d = addDays(t, -i); cells.push({ day: d, state: !countsOn(h, d) ? 'none' : doneOn(h, d) ? 'on' : d === t ? 'todo' : 'off' }); }
    return `<div class="hs-strip" role="group" aria-label="${esc(h.name)}, last 14 days">${cells.map((c, i) => c.state === 'none' ? '<i class="hs-cell none"></i>'
      : `<button class="hs-cell ${c.state}${join(cells, i)}" data-hcell="${h.id}" data-day="${c.day}" aria-label="${fmtDay(c.day)}: ${c.state === 'on' ? 'done' : c.state === 'todo' ? 'not done yet' : 'missed'}" aria-pressed="${c.state === 'on'}"></button>`).join('')}</div>`;
  }
  // weekly / monthly / quarterly: the last 8 periods, each filled as far as it got
  const cells = [];
  let p = periodOf(r, t);
  for (let i = 0; i < 8; i++) { cells.unshift(p); p = periodOf(r, addDays(p.start, -1)); }
  const view = cells.map(q => {
    const cur = q.start <= t && t <= q.end;
    if (q.end < startOf(h)) return { state: 'none' };
    const n = countBetween(h, q.start, cur ? t : q.end);
    return { q, n, cur, state: n >= target ? 'on' : cur ? 'todo' : 'off' };
  });
  const name = q => (r === 'week' ? `Week of ${fmtDay(q.start, { month: 'short', day: 'numeric' })}` : r === 'month' ? fmtDay(q.start, { month: 'long', year: 'numeric' }) : `Q${Math.floor(parseDay(q.start).getMonth() / 3) + 1} ${q.start.slice(0, 4)}`);
  return `<div class="hs-strip periods" role="img" aria-label="${esc(h.name)}, last 8 ${PERIOD[r]}s">${view.map((c, i) => c.state === 'none' ? '<i class="hs-cell none"></i>'
    : `<i class="hs-cell ${c.state}${join(view, i)}" title="${name(c.q)}: ${c.n} of ${target}">${c.state !== 'on' && c.n ? `<b style="width:${Math.round(100 * c.n / target)}%"></b>` : ''}</i>`).join('')}</div>`;
}

// ---------- the win card and today's list ----------
function ring(done, target, size = 76) {
  const r = size / 2 - 6, c = 2 * Math.PI * r, f = Math.min(1, done / target);
  return `<span class="win-ring" role="img" aria-label="${done} of ${target} checks toward winning the day" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="track"/>${f > 0 ? `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="fill ${f >= 1 ? 'full' : ''}" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>` : ''}</svg>
    <b>${f >= 1 ? icon('trophy') : `${done}/${target}`}</b></span>`;
}

function winCard(day = today(), { compact = false } = {}) {
  const sc = dayScore(day), s = day === today() ? habitStats() : null;
  const head = sc.won ? (sc.perfect ? 'Perfect day' : 'Day won')
    : sc.done >= sc.target ? `Finish ${sc.dailyLeft} daily habit${sc.dailyLeft === 1 ? '' : 's'} to win`
    : `${sc.target - sc.done} more to win the day`;
  return `<div class="win-card ${sc.won ? 'won' : ''} ${compact ? 'compact' : ''}">
    ${ring(sc.done, sc.target, compact ? 60 : 76)}
    <div class="win-text">
      <b class="win-head">${head}</b>
      <div class="win-tiers"><span class="${sc.showedUp ? 'on' : ''}">Showed up</span><span class="${sc.dailyLeft === 0 ? 'on' : ''}">All daily</span><span class="${sc.won ? 'on gold' : ''}">Win at ${sc.target}</span><span class="${sc.perfect ? 'on' : ''}">Perfect ${sc.due}</span></div>
      ${s ? `<span class="win-streak ${s.streak ? 'lit' : ''}">${icon('flame')}${s.streak ? `${plural(s.streak, 'day')} won in a row` : 'Win today to start a streak'}</span>` : ''}
    </div>
    ${compact ? '' : '<button class="link small win-edit" data-win-target aria-label="Change how many checks win the day">Change</button>'}
  </div>`;
}

const GROUPS = [['daily', 'Every day'], ['week', 'This week'], ['month', 'This month'], ['quarter', 'This quarter']];
function untilLabel(st) {
  if (st.daysLeft <= 1) return 'today';
  if (st.r === 'week') return st.daysLeft === 2 ? 'tomorrow' : fmtDay(st.end, { weekday: 'long' });
  return fmtDay(st.end, { month: 'short', day: 'numeric' });
}
function groupMeta(st) {
  if (st.daysLeft <= 1) return ['ends today', true];
  if (st.daysLeft === 2) return ['ends tomorrow', true];
  return [`${st.daysLeft} days left`, false];
}

function habitRow(h, st, day) {
  const sub = st.r === 'daily' ? esc(h.cue || '')
    : st.met ? `Done for the ${PERIOD[st.r]} ✓`
    : st.daysLeft <= 1 ? `${st.remaining} more today` : `${st.remaining} more by ${untilLabel(st)}`;
  const urgent = st.r !== 'daily' && !st.met && st.remaining >= st.daysLeft;
  const dots = st.r === 'daily' ? '' : `<span class="ht-dots" aria-hidden="true">${Array.from({ length: Math.min(st.target, 7) }, (_, i) => `<i class="${i < st.count ? 'on' : ''}"></i>`).join('')}</span>`;
  return `<button class="ht-row ${st.doneToday ? 'on' : ''}" data-habit-toggle="${h.id}" data-day="${day}" role="checkbox" aria-checked="${st.doneToday}">
    <span class="check-circle">${icon('check')}</span><span class="habit-emoji">${esc(h.emoji || '✨')}</span>
    <span class="ht-text"><span class="ht-name">${esc(h.name)}</span>${sub ? `<span class="ht-sub ${urgent ? 'urgent' : st.met ? 'met' : ''}">${sub}</span>` : ''}</span>${dots}</button>`;
}

// The day's One Thing as the first "Every day" row, once it's written
function oneThingRow(o, day) {
  if (!o) return `<button class="ht-row ht-one empty" data-habit-one="${day}" aria-disabled="true" aria-label="The one thing: not written yet">
    <span class="check-circle"></span><span class="habit-emoji">${icon('target')}</span>
    <span class="ht-text"><span class="ht-name">The one thing</span><span class="ht-sub">Not written yet</span></span></button>`;
  return `<button class="ht-row ht-one ${o.done ? 'on' : ''}" data-habit-one="${day}" role="checkbox" aria-checked="${!!o.done}">
    <span class="check-circle">${icon('check')}</span><span class="habit-emoji">${icon('target')}</span>
    <span class="ht-text"><span class="ht-name">${esc(o.text)}</span><span class="ht-sub">The one thing</span></span></button>`;
}

function todayListHTML(day = today()) {
  const hs = day === today() ? activeHabits() : habitsOn(day);
  const states = hs.map(h => [h, habitState(h, day)]);
  const one = oneOf(day);
  const groups = GROUPS.map(([r, label]) => {
    const rows = states.filter(([h, st]) => st.r === r && st.due);
    const withOne = r === 'daily' && oneSlot(day);
    if (!rows.length && !withOne) return '';
    const n = rows.length + (withOne ? 1 : 0), nDone = rows.filter(([, st]) => st.doneToday).length + (withOne && one?.done ? 1 : 0);
    const [meta, urgent] = r === 'daily' ? [`${nDone} of ${n}`, false] : groupMeta(rows[0][1]);
    return `<section class="ht-group"><div class="ht-label"><span>${label}</span><span class="${urgent ? 'urgent' : ''}">${meta}</span></div>
      <div class="card list-card">${withOne ? oneThingRow(one, day) : ''}${rows.map(([h, st]) => habitRow(h, st, day)).join('')}</div></section>`;
  }).join('');
  const rested = states.filter(([, st]) => st.restedBefore && !st.due);
  return groups + (rested.length ? `<p class="ht-rested">${icon('check')}<span>Done for now: ${rested.map(([h, st]) => `<b>${esc(h.name)}</b> <span class="faint">(${PERIOD[st.r]})</span>`).join(', ')}</span></p>` : '');
}

const emptyHabits = () => `<div class="card pad habits-card">
  <p class="muted">Add the habits you want to keep: every day, a few times a week, monthly or quarterly. Check enough of them and you win the day.</p>
  <button class="btn primary" data-habit-new>${icon('plus')}Add your first habit</button></div>`;

// The checklist on the Today page (and for a past day, in a sheet)
export function habitsCard(day = today(), { showHeader = true } = {}) {
  const hs = day === today() ? activeHabits() : habitsOn(day);
  if (!hs.length) return emptyHabits();
  return `<div class="card pad habits-card">
    ${showHeader ? `<div class="card-head"><h3>${icon('habits')}Habits</h3><a class="link small" href="#/habits">All</a></div>` : ''}
    ${winCard(day, { compact: true })}
    <div class="ht-list">${todayListHTML(day)}</div>
  </div>`;
}

export function bindHabits(root, after = rerender) {
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-habit-toggle]');
    if (t) { toggleHabit(t.dataset.day, t.dataset.habitToggle, t); after(); return; }
    const o = e.target.closest('[data-habit-one]');
    if (o) { toggleOneThing(o.dataset.habitOne, o); after(); return; }
    if (e.target.closest('[data-habit-new]')) habitSheet(null, after);
    if (e.target.closest('[data-win-target]')) winTargetSheet(after);
  });
}

// ---------- the moment the day is won ----------
function winSheet() {
  const s = habitStats(), sc = dayScore(today()), t = today();
  const ws = periodOf('week', t);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws.start, i));
  sheet({
    title: '',
    className: 'win-sheet',
    render(body, close) {
      body.innerHTML = `<div class="win-burst">${icon('trophy')}</div>
        <h2>Day won</h2>
        <p>${sc.done} of ${sc.target} done. ${s.streak > 1 ? `That’s <b>${s.streak} days won in a row</b>${s.streak >= s.best ? ', your best yet' : ''}.` : 'A new streak starts today.'}</p>
        <div class="win-week">${days.map(d => { const w = d <= t && dayScore(d).won; return `<span class="${w ? 'won' : d > t ? 'future' : ''} ${d === t ? 'today' : ''}"><i>${icon(w ? 'trophy' : d > t ? 'trophy' : 'x')}</i>${fmtDay(d, { weekday: 'narrow' })}</span>`; }).join('')}</div>
        ${sc.perfect ? '<p class="win-next">Everything due today is done: a perfect day.</p>' : `<p class="win-next">${icon('sparkle')}<span><b>${sc.due - dayScore(t).done} more</b> for a perfect day.</span></p>`}
        <button class="btn primary block" data-close-win>Keep going</button>`;
      body.querySelector('[data-close-win]').onclick = () => close();
    },
  });
}

function winTargetSheet(after = rerender) {
  sheet({
    title: 'Win the day',
    render(body, close) {
      let n = winTarget();
      const draw = () => {
        body.innerHTML = `<p class="muted">A day is won when every daily habit is checked, including your One Thing, and the day reaches this many checks in all. Weekly, monthly and quarterly habits help make up the rest.</p>
          <div class="win-stepper"><button class="btn ghost" data-step="-1" aria-label="Fewer">−</button><b>${n}</b><button class="btn ghost" data-step="1" aria-label="More">+</button></div>
          <p class="muted small">If your daily habits alone add up to more, they set the number.</p>
          <div class="row-end"><button class="btn ghost" data-cancel>Cancel</button><button class="btn primary" data-save>Save</button></div>`;
      };
      draw();
      body.addEventListener('click', e => {
        const st = e.target.closest('[data-step]');
        if (st) { n = Math.min(20, Math.max(1, n + +st.dataset.step)); draw(); return; }
        if (e.target.closest('[data-cancel]')) close();
        if (e.target.closest('[data-save]')) { setSettings({ winTarget: n }); close(); after(); toast(`You win a day at ${n} check${n === 1 ? '' : 's'}`); }
      });
    },
  });
}

// tick / untick one habit on one day; past days get an Undo
function toggleDay(hid, day, el, after = rerender) {
  const was = logFor(day).done.includes(hid);
  toggleHabit(day, hid, el); after();
  if (day !== today()) toast(`${fmtDay(day)}: ${was ? 'unticked' : 'ticked'}`, { action: 'Undo', onAction: () => { toggleHabit(day, hid); after(); } });
}

// ---------- the Habits page ----------
const ui = { tab: 'today' };

export function renderHabits(main, params = {}) {
  if (params.id) return renderHabitDetail(main, params.id);
  const hs = activeHabits();
  const archived = list('habits').filter(h => h.archivedAt);
  const t = today();
  const tabs = `<nav class="seg ht-tabs" role="tablist">${[['today', 'Today'], ['progress', 'Progress']].map(([k, l]) => `<button role="tab" class="${ui.tab === k ? 'on' : ''}" aria-selected="${ui.tab === k}" data-htab="${k}">${l}</button>`).join('')}</nav>`;
  let body = '';
  if (!hs.length) body = emptyHabits();
  else if (ui.tab === 'today') body = `${winCard(t)}<div class="ht-list">${todayListHTML(t)}</div>
    <div class="tip card pad">${icon('info')}<div><b>Make them anchors.</b> Tie each habit to something you already do: “After I pour coffee, I write one line.” Keep them small enough to do on your worst day.</div></div>`;
  else body = progressHTML(hs, archived);
  main.innerHTML = `<div class="page ht-page">
    <header class="page-head"><div class="page-title-row"><div><p class="eyebrow">${fmtLongDay(t)}</p><h1>Habits</h1></div>
      <div class="head-actions"><button class="icon-btn accent" data-habit-new aria-label="New habit">${icon('plus')}</button></div></div></header>
    ${hs.length ? tabs : ''}
    ${body}
  </div>`;
  const page = main.querySelector('.page');
  bindHabits(page);
  page.addEventListener('click', e => {
    const tb = e.target.closest('[data-htab]');
    if (tb) { ui.tab = tb.dataset.htab; rerender(); return; }
    const m = e.target.closest('[data-habit-menu]');
    if (m) return habitMenu(m, get('habits', m.dataset.habitMenu));
    const ua = e.target.closest('[data-unarchive]');
    if (ua) { const h = get('habits', ua.dataset.unarchive); save('habits', { ...h, archivedAt: null, startDay: today(), order: activeHabits().length }); rerender(); return; }
    const hc = e.target.closest('[data-hcell]');
    if (hc) { toggleDay(hc.dataset.hcell, hc.dataset.day, hc); return; }
  });
}

function habitMenu(anchor, h) {
  const arr = activeHabits(), at = arr.findIndex(x => x.id === h.id);
  const move = dir => { const j = at + dir; [arr[at], arr[j]] = [arr[j], arr[at]]; arr.forEach((x, k) => save('habits', { ...x, order: k })); rerender(); };
  menu(anchor, [
    { label: 'Open', icon: 'chevR', action: () => navigate(`#/habits/${h.id}`) },
    { label: 'Edit', icon: 'edit', action: () => habitSheet(h) },
    at > 0 ? { label: 'Move up', icon: 'sort', action: () => move(-1) } : null,
    at >= 0 && at < arr.length - 1 ? { label: 'Move down', icon: 'sort', action: () => move(1) } : null,
    { label: 'Archive', icon: 'archive', action: () => { save('habits', { ...h, archivedAt: Date.now() }); toast('Archived. Past streaks are kept'); rerender(); } },
    { label: 'Delete', icon: 'trash', danger: true, action: async () => {
      if (!await confirmDialog(`Delete “${h.name}” and its history? Archiving keeps history instead.`)) return;
      remove('habits', h.id);
      list('habitlogs').forEach(l => l.done.includes(h.id) && save('habitlogs', { ...l, done: l.done.filter(x => x !== h.id) }));
      navigate('#/habits');
    } },
  ]);
}

function progressHTML(hs, archived) {
  const t = today(), s = habitStats();
  const ws = periodOf('week', t);
  const week = Array.from({ length: 7 }, (_, i) => addDays(ws.start, i));
  const periodic = hs.filter(h => rhythmOf(h) !== 'daily');
  const paceOf = st => (daysBetween(st.start, today()) + 1) / (daysBetween(st.start, st.end) + 1);
  const periodRows = GROUPS.slice(1).map(([r, label]) => {
    const rows = periodic.filter(h => rhythmOf(h) === r);
    if (!rows.length) return '';
    const st0 = habitState(rows[0], t), [meta] = groupMeta(st0);
    return `<section class="ht-group"><div class="ht-label"><span>${label}</span><span>${meta}</span></div><div class="card list-card">
      ${rows.map(h => { const st = habitState(h, t); return `<a class="pp-row" href="#/habits/${h.id}">
        <span class="pp-top"><span class="habit-emoji">${esc(h.emoji || '✨')}</span><b>${esc(h.name)}</b><em class="${st.met ? 'met' : st.remaining >= st.daysLeft ? 'urgent' : ''}">${st.met ? 'Done' : `${st.count} of ${st.target}`}</em></span>
        <span class="pp-bar" role="img" aria-label="${st.count} of ${st.target}"><i class="${st.met ? 'met' : ''}" style="width:${Math.min(100, Math.round(100 * st.count / st.target))}%"></i><u style="left:${Math.round(100 * paceOf(st))}%"></u></span></a>`; }).join('')}
    </div></section>`;
  }).join('');
  return `<section class="card pad pp-week">
      <div class="hs-head"><h3>Days won</h3><span class="muted small">${s.streak ? `${plural(s.streak, 'day')} in a row · best ${s.best}` : `best streak ${s.best}`}</span></div>
      <div class="win-week">${week.map(d => { const sc = d <= t ? dayScore(d) : null; return `<span class="${sc?.won ? 'won' : d > t ? 'future' : ''} ${d === t ? 'today' : ''}"><i>${icon(sc && !sc.won && d < t ? 'x' : 'trophy')}</i>${fmtDay(d, { weekday: 'narrow' })}</span>`; }).join('')}</div>
    </section>
    ${periodRows}
    ${periodRows ? '<p class="muted small pad-x">The thin line marks how much of the period has passed; a bar short of it is behind pace.</p>' : ''}
    <section class="card pad hs-card">
      <div class="hs-head"><h3>Your habits</h3><span class="muted small">tap a day to fix it</span></div>
      ${hs.map(h => { const st = habitStreak(h); return `<div class="hs-habit">
        <div class="hs-top">
          <a class="hs-name" href="#/habits/${h.id}"><span class="habit-emoji">${esc(h.emoji || '✨')}</span><b>${esc(h.name)}</b></a>
          <span class="hs-streak ${st.streak >= (st.unit === 'day' ? 7 : 3) ? 'hot' : ''}" title="${plural(st.streak, st.unit)} in a row">${icon('flame')}${streakLabel(st)}</span>
          <button class="icon-btn sm" data-habit-menu="${h.id}" aria-label="Options for ${esc(h.name)}">${icon('more')}</button>
        </div>
        ${habitStrip(h)}
        <a class="hs-meta muted small" href="#/habits/${h.id}">${rhythmLabel(h)}${h.cue ? ' · ' + esc(h.cue) : ''}${st.rate !== null ? ` · ${st.rate}% ${st.unit === 'day' ? 'of the last 30 days' : `of the last ${st.unit}s`}` : ''}${icon('chevR')}</a>
      </div>`; }).join('')}
    </section>
    <section class="section"><h3 class="group-label">Days won</h3>
      <div class="card pad">${heatmap(d => { const sc = dayScore(d); return sc.perfect ? 4 : sc.won ? 3 : sc.showedUp ? 1 : 0; }, { weeks: 26, legend: [['Showed up', 1], ['Won', 3], ['Perfect', 4]], title: d => { const sc = dayScore(d); return `${fmtDay(d)}${sc.perfect ? ': perfect' : sc.won ? ': won' : ''}`; } })}</div>
    </section>
    ${archived.length ? `<section class="section"><h3 class="group-label">Archived</h3><div class="card list-card">${archived.map(h => `<div class="list-row"><span class="habit-emoji">${esc(h.emoji || '✨')}</span><div class="grow muted">${esc(h.name)}</div><button class="btn ghost sm" data-unarchive="${h.id}">Restore</button></div>`).join('')}</div></section>` : ''}`;
}

export function dayHabitsSheet(day) {
  sheet({
    title: fmtLongDay(day),
    onClose: () => rerender(),
    render(body) {
      const draw = () => { body.innerHTML = habitsOn(day).length ? habitsCard(day, { showHeader: false }) : '<p class="muted">No habits existed on this day.</p>'; };
      draw();
      body.addEventListener('click', e => {
        const t = e.target.closest('[data-habit-toggle]'); if (t) { toggleHabit(day, t.dataset.habitToggle, t); draw(); }
        const o = e.target.closest('[data-habit-one]'); if (o) { toggleOneThing(day, o); draw(); }
      });
    },
  });
}

// ---------- add / edit ----------
// [emoji, name, cue, rhythm, times]
const SUGGESTED = [
  ['🫁', 'Cyclic sighing, 5 min', 'After I wake up', 'daily', 1], ['💧', 'Drink a glass of water', 'After I wake up', 'daily', 1],
  ['📚', 'Read 10 pages', 'Before bed', 'daily', 1], ['🏋️', 'Exercise', 'After work', 'week', 3],
  ['📞', 'Call family', 'Sunday afternoon', 'week', 1], ['🧹', 'Deep clean the room', 'First Saturday', 'month', 1],
  ['❤️', 'Date night', '', 'month', 2], ['🦷', 'Dentist check-up', '', 'quarter', 1], ['🎯', 'Review my goals', '', 'quarter', 1],
];

export function habitSheet(h, after = rerender) {
  const isNew = !h;
  h = h || { emoji: '✨', name: '', cue: '', rhythm: 'daily', target: 1 };
  let rhythm = rhythmOf(h), target = targetOf(h), hide = h.hideWhenDone !== false, counts = h.countsToWin !== false, emoji = h.emoji;
  sheet({
    title: isNew ? 'New habit' : 'Edit habit',
    render(body, close) {
      body.innerHTML = `<form class="stack">
        <div class="emoji-field"><button type="button" class="emoji-big" data-emoji-toggle>${esc(emoji)}</button>
          <label class="field grow"><span>Habit</span><input class="input" name="name" value="${esc(h.name)}" placeholder="e.g. Exercise" maxlength="60" required autofocus></label></div>
        <div class="emoji-wrap" hidden>${emojiPicker(emoji)}</div>
        <div class="field"><span>Rhythm</span><div class="seg mini hs-rhythm" role="radiogroup" aria-label="Rhythm">${RHYTHMS.map(([k, l]) => `<button type="button" role="radio" data-rhythm="${k}">${l}</button>`).join('')}</div></div>
        <div class="hs-times"><span class="grow"><b data-times></b></span><button type="button" class="btn ghost sm" data-times-step="-1" aria-label="Fewer">−</button><button type="button" class="btn ghost sm" data-times-step="1" aria-label="More">+</button></div>
        <label class="field"><span>Anchor / cue <em class="faint">optional</em></span><input class="input" name="cue" value="${esc(h.cue || '')}" placeholder="After I…" maxlength="80"></label>
        <div class="card list-card hs-switches">
          <label class="list-row" data-hide-row><span class="grow">Leave today’s list once done<span class="muted small" data-hide-sub></span></span><input type="checkbox" class="switch" name="hide"></label>
          <label class="list-row"><span class="grow">Counts toward winning the day<span class="muted small">Each check adds to the day’s ring.</span></span><input type="checkbox" class="switch" name="counts"></label>
        </div>
        ${isNew ? `<div><div class="muted small" style="margin-bottom:6px">Or start from a suggestion</div><div class="chip-row wrap">${SUGGESTED.map((s, i) => `<button type="button" class="chip" data-sug="${i}">${s[0]} ${esc(s[1])}</button>`).join('')}</div></div>` : ''}
        <div class="row-end"><button type="button" class="btn ghost" data-cancel>Cancel</button><button class="btn primary">${isNew ? 'Add habit' : 'Save'}</button></div>
      </form>`;
      const f = body.querySelector('form');
      const draw = () => {
        body.querySelectorAll('[data-rhythm]').forEach(b => { const on = b.dataset.rhythm === rhythm; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
        body.querySelector('.hs-times').hidden = rhythm === 'daily';
        body.querySelector('[data-times]').textContent = rhythmLabel({ rhythm, target });
        body.querySelector('[data-hide-row]').hidden = rhythm === 'daily';
        body.querySelector('[data-hide-sub]').textContent = `After the ${target === 1 ? '' : target === 2 ? '2nd ' : target === 3 ? '3rd ' : `${target}th `}time it moves to “Done for now” until the next ${PERIOD[rhythm]}.`.replace('the time', 'it’s done');
        f.hide.checked = hide; f.counts.checked = counts;
      };
      draw();
      body.querySelector('[data-cancel]').onclick = () => close();
      body.addEventListener('change', e => { if (e.target.name === 'hide') hide = e.target.checked; if (e.target.name === 'counts') counts = e.target.checked; });
      body.addEventListener('click', e => {
        if (e.target.closest('[data-emoji-toggle]')) { const w = body.querySelector('.emoji-wrap'); w.hidden = !w.hidden; }
        const em = e.target.closest('[data-emoji]');
        if (em) { emoji = em.dataset.emoji; body.querySelector('.emoji-big').textContent = emoji; body.querySelector('.emoji-wrap').hidden = true; }
        const rb = e.target.closest('[data-rhythm]');
        if (rb) { rhythm = rb.dataset.rhythm; if (rhythm !== 'daily' && target < 1) target = 1; draw(); }
        const ts = e.target.closest('[data-times-step]');
        if (ts) { target = Math.min(rhythm === 'week' ? 7 : 31, Math.max(1, target + +ts.dataset.timesStep)); draw(); }
        const sg = e.target.closest('[data-sug]');
        if (sg) { const [e2, n, c, r, x] = SUGGESTED[+sg.dataset.sug]; emoji = e2; body.querySelector('.emoji-big').textContent = e2; f.name.value = n; f.cue.value = c; rhythm = r; target = x; draw(); }
      });
      f.onsubmit = e => {
        e.preventDefault();
        const name = f.name.value.trim(); if (!name) return;
        const fields = { name, cue: f.cue.value.trim(), emoji, rhythm, target: rhythm === 'daily' ? 1 : target, hideWhenDone: hide, countsToWin: counts };
        if (isNew) save('habits', { id: uid(), ...fields, created: Date.now(), startDay: today(), order: activeHabits().length, archivedAt: null });
        else save('habits', { ...h, ...fields });
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
  const st = habitStreak(h), now = habitState(h, t);
  const daily = rhythmOf(h) === 'daily';
  const ws = settings().weekStart;

  // month calendar: done days join into chains within each week row
  const first = new Date(detailUi.y, detailUi.m, 1);
  const lead = (first.getDay() - ws + 7) % 7;
  const n = new Date(detailUi.y, detailUi.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push({ state: 'blank' });
  for (let k = 1; k <= n; k++) {
    const d = `${detailUi.y}-${String(detailUi.m + 1).padStart(2, '0')}-${String(k).padStart(2, '0')}`;
    cells.push({ day: d, n: k, state: !countsOn(h, d) ? 'none' : doneOn(h, d) ? 'on' : d === t && daily ? 'todo' : 'off' });
  }
  while (cells.length % 7) cells.push({ state: 'blank' });
  const inMonth = cells.filter(c => ['on', 'off', 'todo'].includes(c.state));
  const month = cells.map((c, i) => {
    if (c.state === 'blank') return '<span></span>';
    const row = [Math.floor(i / 7) * 7, Math.floor(i / 7) * 7 + 6];
    const nb = j => (j >= row[0] && j <= row[1] ? cells[j] : null);
    const jn = c.state === 'on' ? `${nb(i - 1)?.state === 'on' ? ' jl' : ''}${nb(i + 1)?.state === 'on' ? ' jr' : ''}` : '';
    return c.state === 'none'
      ? `<span class="hd-day none">${c.n}</span>`
      : `<button class="hd-day ${c.state}${jn}" data-hcell="${h.id}" data-day="${c.day}" aria-label="${fmtDay(c.day)}: ${c.state === 'on' ? 'done' : 'not done'}" aria-pressed="${c.state === 'on'}">${c.n}</button>`;
  }).join('');
  const thisMonth = t.slice(0, 7) === `${detailUi.y}-${String(detailUi.m + 1).padStart(2, '0')}`;

  // 26 weeks, one column per week
  const weekStart = addDays(t, -((parseDay(t).getDay() - ws + 7) % 7));
  const from = addDays(weekStart, -25 * 7);
  let heatDone = 0;
  const heat = [];
  for (let i = 0; i < 26 * 7; i++) {
    const d = addDays(from, i);
    if (!countsOn(h, d)) { heat.push(`<i class="hd-heat ${d > t ? 'future' : 'none'}"></i>`); continue; }
    const on = doneOn(h, d); if (on) heatDone++;
    heat.push(`<i class="hd-heat ${on ? 'on' : 'off'}" title="${fmtDay(d)}: ${on ? 'done' : 'not done'}"></i>`);
  }

  // by weekday (daily habits), over the last 12 weeks it existed
  let weekdayHTML = '';
  if (daily) {
    const byDow = Array.from({ length: 7 }, () => [0, 0]);
    for (let i = 0; i < 84; i++) { const d = addDays(t, -i); if (!countsOn(h, d) || (d === t && !doneOn(h, d))) continue; const w = (parseDay(d).getDay() - ws + 7) % 7; byDow[w][1]++; if (doneOn(h, d)) byDow[w][0]++; }
    const pct = byDow.map(([a, b]) => (b ? Math.round(100 * a / b) : null));
    const enough = byDow.every(([, b]) => b >= 2);
    const valid = pct.filter(v => v !== null);
    const lowI = enough ? pct.indexOf(Math.min(...valid)) : -1;
    const names = weekdayNames(ws);
    const fullNames = names.map((_, i) => fmtDay(addDays(weekStart, i), { weekday: 'long' }));
    const weakest = enough && Math.max(...valid) - pct[lowI] >= 10 ? `${fullNames[lowI]}s slip most` : enough ? 'Steady across the week' : '';
    weekdayHTML = `<section class="card pad">
      <div class="hd-sec-head"><b>By weekday</b><span class="muted small">${weakest}</span></div>
      ${enough ? `<div class="hd-bars">${pct.map((v, i) => `<div class="hd-bar" title="${fullNames[i]}: ${v}%"><span>${v}%</span><i class="${i === lowI && weakest.includes('slip') ? 'low' : ''}" style="height:${Math.max(4, Math.round(v * 0.5))}px"></i></div>`).join('')}</div>
        <div class="hd-bar-labels">${names.map(x => `<span>${x.slice(0, 1)}</span>`).join('')}</div>`
      : '<p class="muted small">Shows up after two weeks, once there’s enough to compare days.</p>'}
    </section>`;
  }

  main.innerHTML = `<div class="page hd-page">
    <header class="detail-head"><a class="link" href="#/habits">${icon('back')}Habits</a>
      <button class="icon-btn" data-habit-menu="${h.id}" aria-label="Options">${icon('more')}</button></header>
    <div class="hd-title"><span class="habit-emoji big">${esc(h.emoji || '✨')}</span><div><h1>${esc(h.name)}</h1>
      <p class="muted small">${rhythmLabel(h)}${h.cue ? ' · ' + esc(h.cue) : ''} · since ${fmtDay(startOf(h), { month: 'short', day: 'numeric', year: 'numeric' })}${h.archivedAt ? ' · archived' : ''}</p></div></div>
    <div class="hd-stats">
      <div class="card ${st.streak >= (daily ? 7 : 3) ? 'hd-hot' : ''}"><b>${icon('flame')}${st.streak}</b><span>${st.unit} streak</span></div>
      <div class="card"><b>${st.best}</b><span>best streak</span></div>
      ${daily ? `<div class="card"><b>${st.rate ?? 0}%</b><span>last 30 days</span></div>`
        : `<div class="card"><b>${now.count}/${now.target}</b><span>this ${st.unit}</span></div>`}
    </div>
    <section class="card pad hd-month">
      <div class="hd-month-head"><b>${MONTHS[detailUi.m]}${detailUi.y !== parseDay(t).getFullYear() ? ' ' + detailUi.y : ''}</b>
        <span><button class="icon-btn sm" data-hm="-1" aria-label="Previous month">${icon('back')}</button><button class="icon-btn sm" data-hm="1" aria-label="Next month" ${thisMonth ? 'disabled' : ''}>${icon('chevR')}</button></span></div>
      <div class="hd-dow">${weekdayNames(ws).map(x => `<span>${x.slice(0, 1)}</span>`).join('')}</div>
      <div class="hd-grid">${month}</div>
      <p class="muted small">${inMonth.filter(c => c.state === 'on').length} day${inMonth.filter(c => c.state === 'on').length === 1 ? '' : 's'} done this month · tap a day to tick or untick it</p>
    </section>
    ${daily ? '' : `<section class="card pad"><div class="hd-sec-head"><b>Last 8 ${st.unit}s</b><span class="muted small">${st.rate !== null ? `target met ${st.rate}% of the time` : ''}</span></div>${habitStrip(h)}</section>`}
    <section class="card pad">
      <div class="hd-sec-head"><b>Last 6 months</b><span class="muted small">${heatDone} day${heatDone === 1 ? '' : 's'} done</span></div>
      <div class="hd-heatmap" role="img" aria-label="Done ${heatDone} days in the last 26 weeks">${heat.join('')}</div>
    </section>
    ${weekdayHTML}
  </div>`;
  const page = main.querySelector('.page');
  page.addEventListener('click', e => {
    const mm = e.target.closest('[data-hm]');
    if (mm) { const d = new Date(detailUi.y, detailUi.m + +mm.dataset.hm, 1); detailUi.y = d.getFullYear(); detailUi.m = d.getMonth(); rerender(); return; }
    const hc = e.target.closest('[data-hcell]');
    if (hc) { toggleDay(hc.dataset.hcell, hc.dataset.day, hc); return; }
    const m = e.target.closest('[data-habit-menu]');
    if (m) habitMenu(m, get('habits', id));
  });
}
