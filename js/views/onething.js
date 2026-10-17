// The One Thing: a single must-finish task per day. Completions are recorded forever.
import { get, save, remove, list } from '../db.js';
import { esc, today, ymd, addDays, fmtDay, fmtLongDay, fmtTime, parseDay, fmtMonth, haptic } from '../util.js';
import { icon } from '../icons.js';
import { rerender } from '../router.js';
import { confetti, toast, confirmDialog, promptDialog } from '../ui.js';
import { heatmap } from './heatmap.js';

export const getOne = (day = today()) => get('onething', day);

export function setOne(day, text) {
  const ex = getOne(day);
  const now = Date.now();
  return save('onething', ex ? { ...ex, text, updated: now } : { id: day, text, done: false, doneAt: null, created: now, updated: now });
}

export function toggleOne(day, el) {
  const o = getOne(day);
  if (!o) return;
  const done = !o.done;
  save('onething', { ...o, done, doneAt: done ? Date.now() : null });
  if (done) { confetti(el); haptic([12, 40, 18]); toast('Recorded. That was the one. 🎯'); }
  return done;
}

export function oneStats() {
  const all = list('onething');
  const doneSet = new Set(all.filter(o => o.done).map(o => o.id));
  const t = today();
  let streak = 0, d = doneSet.has(t) ? t : addDays(t, -1);
  while (doneSet.has(d)) { streak++; d = addDays(d, -1); }
  let best = 0, run = 0, prev = null;
  [...doneSet].sort().forEach(k => { run = prev && addDays(prev, 1) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; });
  const last30 = all.filter(o => o.id > addDays(t, -30) && o.id <= t);
  const rate = last30.length ? Math.round(100 * last30.filter(o => o.done).length / last30.length) : 0;
  return { streak, best, rate, total: doneSet.size, set: all.length };
}

// Card used on the Today page and at the top of the One Thing page
export function oneThingCard(day = today(), { big = false, link = false } = {}) {
  const more = link ? `<a class="one-more" href="#/onething">History</a>` : '';
  const o = getOne(day);
  const y = getOne(addDays(day, -1));
  if (!o) {
    return `<div class="one-card empty-one ${big ? 'big' : ''}">
      <div class="one-eyebrow">${icon('target')}The one thing${more}</div>
      <form class="one-form" data-one-form="${day}">
        <input class="one-input" name="text" maxlength="140" placeholder="What must you finish ${day === today() ? 'today' : 'this day'}?" autocomplete="off" enterkeyhint="done" aria-label="Your one thing">
        <button class="btn primary" aria-label="Set">${icon('check')}</button>
      </form>
      <p class="one-hint">Just one. If you only got this done, the day would be a win.</p>
      ${y && !y.done && day === today() ? `<button class="carry" data-one-carry="${esc(y.text)}">${icon('restore')}Carry over yesterday's: <b>${esc(y.text)}</b></button>` : ''}
    </div>`;
  }
  return `<div class="one-card ${o.done ? 'is-done' : ''} ${big ? 'big' : ''}">
    <div class="one-eyebrow">${icon('target')}The one thing${o.done ? ` · <span>done ${fmtTime(o.doneAt)}</span>` : ''}${more}</div>
    <div class="one-row">
      <button class="one-check" data-one-toggle="${day}" role="checkbox" aria-checked="${o.done}" aria-label="Mark done">${icon('check')}</button>
      <div class="one-text">${esc(o.text)}</div>
      ${o.done ? '' : `<button class="icon-btn sm" data-one-edit="${day}" aria-label="Edit">${icon('edit')}</button>`}
    </div>
    ${o.done && o.note ? `<p class="one-note">“${esc(o.note)}”</p>` : ''}
    ${o.done && !o.note && big ? `<button class="link small" data-one-reflect="${day}">Add a reflection</button>` : ''}
  </div>`;
}

// Shared event wiring for one-thing cards inside `root`
export function bindOneThing(root, after = rerender) {
  root.addEventListener('submit', e => {
    const f = e.target.closest('[data-one-form]');
    if (!f) return;
    e.preventDefault();
    const text = f.text.value.trim();
    if (!text) return;
    setOne(f.dataset.oneForm, text); haptic(); after();
  });
  root.addEventListener('click', async e => {
    const tg = e.target.closest('[data-one-toggle]');
    if (tg) {
      const day = tg.dataset.oneToggle;
      const o = getOne(day);
      if (o.done && !(await confirmDialog('Mark it as not done? Its completion record will be cleared.', { ok: 'Mark not done', title: 'Undo completion' }))) return;
      toggleOne(day, tg); after(); return;
    }
    const ed = e.target.closest('[data-one-edit]');
    if (ed) {
      const day = ed.dataset.oneEdit, o = getOne(day);
      const v = await promptDialog('Your one thing', { value: o.text, ok: 'Save' });
      if (v === null) return;
      if (!v) { remove('onething', day); toast('Cleared'); } else setOne(day, v);
      after(); return;
    }
    const c = e.target.closest('[data-one-carry]');
    if (c) { setOne(today(), c.dataset.oneCarry); after(); return; }
    const rf = e.target.closest('[data-one-reflect]');
    if (rf) {
      const v = await promptDialog('How did it go?', { multiline: true, placeholder: 'One line for future you…' });
      if (v) { save('onething', { ...getOne(rf.dataset.oneReflect), note: v }); after(); }
    }
  });
}

export function renderOneThing(main) {
  const s = oneStats();
  const all = list('onething').sort((a, b) => b.id.localeCompare(a.id));
  const months = [];
  all.forEach(o => {
    const d = parseDay(o.id); const k = fmtMonth(d.getFullYear(), d.getMonth());
    let m = months.find(x => x.k === k); if (!m) months.push(m = { k, items: [] }); m.items.push(o);
  });
  const t = today();
  main.innerHTML = `<div class="page">
    <header class="page-head"><div class="page-title-row"><h1>One Thing</h1></div>
      <p class="muted">${fmtLongDay(t)}</p></header>
    ${oneThingCard(t, { big: true })}
    <div class="stat-row">
      <div class="stat"><div class="stat-n">${s.streak}<small>${icon('flame')}</small></div><div class="stat-l">Day streak</div></div>
      <div class="stat"><div class="stat-n">${s.best}</div><div class="stat-l">Best streak</div></div>
      <div class="stat"><div class="stat-n">${s.rate}%</div><div class="stat-l">Last 30 days</div></div>
      <div class="stat"><div class="stat-n">${s.total}</div><div class="stat-l">Done, all time</div></div>
    </div>
    <section class="section">
      <h3 class="group-label">Last 6 months</h3>
      <div class="card pad">${heatmap(day => { const o = getOne(day); return o ? (o.done ? 2 : day < t ? 1 : 0) : 0; }, { weeks: 26, cls: 'hm-one', legend: [['Missed', 1], ['Done', 2]], title: d => { const o = getOne(d); return `${fmtDay(d)}${o ? ' — ' + o.text + (o.done ? ' ✓' : '') : ''}`; } })}</div>
    </section>
    <section class="section">
      <h3 class="group-label">Log</h3>
      ${months.length ? months.map(m => `<h4 class="sub-label">${m.k}</h4><div class="card list-card">${m.items.map(o => `
        <div class="list-row one-log ${o.done ? 'done' : o.id < t ? 'missed' : ''}">
          <div class="one-log-date"><b>${parseDay(o.id).getDate()}</b><span>${fmtDay(o.id, { weekday: 'short' })}</span></div>
          <div class="grow"><div class="one-log-text">${esc(o.text)}</div>
            <div class="muted small">${o.done ? `Done at ${fmtTime(o.doneAt)}${ymd(new Date(o.doneAt)) > o.id ? ' (later)' : ''}` : o.id < t ? 'Not finished' : o.id === t ? 'In progress' : 'Planned'}${o.note ? ` · “${esc(o.note)}”` : ''}</div></div>
          <span class="status-dot">${o.done ? icon('check') : ''}</span>
        </div>`).join('')}</div>`).join('') : `<div class="empty">${icon('target', 'empty-ic')}<p>Your history of “one things” will collect here.</p></div>`}
    </section>
  </div>`;
  bindOneThing(main.querySelector('.page'));
}
