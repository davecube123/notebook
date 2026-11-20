// The One Thing: a single must-finish task per day. Completions are recorded forever.
import { get, save, remove, list } from '../db.js';
import { esc, today, ymd, addDays, fmtDay, fmtLongDay, fmtTime, parseDay, fmtMonth, haptic } from '../util.js';
import { icon } from '../icons.js';
import { rerender } from '../router.js';
import { confetti, toast, confirmDialog, promptDialog } from '../ui.js';
import { heatmap } from './heatmap.js';

export const getOne = (day = today()) => get('onething', day);

// A day's to-do list. One task can be marked as the day's One Thing; the record's
// text / done / doneAt always mirror that task, so streaks and habits keep working.
// Days saved before the list existed become a one-task list.
export function todosOf(day = today()) {
  const o = getOne(day);
  if (!o) return { todos: [], oneId: null };
  if (Array.isArray(o.todos)) return { todos: o.todos, oneId: o.oneId || null };
  return o.text ? { todos: [{ id: 'one', text: o.text, done: !!o.done, doneAt: o.doneAt || null }], oneId: 'one' } : { todos: [], oneId: null };
}

export function saveTodos(day, todos, oneId) {
  const ex = getOne(day), now = Date.now();
  const star = todos.find(t => t.id === oneId) || null;
  if (!todos.length && !ex?.note) { if (ex) remove('onething', day); return null; }
  return save('onething', { created: now, ...(ex || {}), id: day, todos, oneId: star ? oneId : null, text: star?.text || '', done: !!star?.done, doneAt: star?.done ? star.doneAt || now : null, updated: now });
}

const tid = () => Math.random().toString(36).slice(2, 9);
export function addTodo(day, text, { asOne = false } = {}) {
  const { todos, oneId } = todosOf(day);
  const t = { id: tid(), text, done: false, doneAt: null };
  saveTodos(day, [...todos, t], asOne ? t.id : oneId);
  return t;
}
export function updateTodo(day, id, patch) {
  const { todos, oneId } = todosOf(day);
  saveTodos(day, todos.map(t => (t.id === id ? { ...t, ...patch } : t)), oneId);
}
export function removeTodo(day, id) {
  const { todos, oneId } = todosOf(day);
  saveTodos(day, todos.filter(t => t.id !== id), oneId === id ? null : oneId);
}
export function markOne(day, id) {
  const { todos, oneId } = todosOf(day);
  saveTodos(day, todos, oneId === id ? null : id);
}
export function toggleTodo(day, id) {
  const t = todosOf(day).todos.find(x => x.id === id);
  if (t) updateTodo(day, id, { done: !t.done, doneAt: t.done ? null : Date.now() });
}

// Set the One Thing's text: renames the marked task, or adds one and marks it
export function setOne(day, text) {
  const { oneId } = todosOf(day);
  if (oneId) updateTodo(day, oneId, { text }); else addTodo(day, text, { asOne: true });
  return getOne(day);
}
// Tick or untick the One Thing (and its task)
export function setOneDone(day, done) {
  const { oneId } = todosOf(day);
  if (oneId) updateTodo(day, oneId, { done, doneAt: done ? Date.now() : null });
}

export function toggleOne(day, el) {
  const o = getOne(day);
  if (!o?.text) return;
  const done = !o.done;
  setOneDone(day, done);
  if (done) { confetti(el); haptic([12, 40, 18]); toast('Recorded. That was the one. 🎯'); }
  return done;
}

export function oneStats() {
  const all = list('onething').filter(o => o.text);
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

// The day's to-do list (Today page and the To-do page). The task marked ◎ is the One Thing.
export function todoCard(day = today(), { link = false, big = false } = {}) {
  const { todos, oneId } = todosOf(day);
  const o = getOne(day);
  const one = todos.find(t => t.id === oneId);
  const rest = todos.filter(t => t.id !== oneId);
  const order = [...(one ? [one] : []), ...rest.filter(t => !t.done), ...rest.filter(t => t.done)];
  const y = day === today() ? todosOf(addDays(day, -1)).todos.filter(t => !t.done) : [];
  const yLeft = y.filter(t => !todos.some(x => x.text === t.text));
  const row = t => `<div class="td-row ${t.done ? 'done' : ''} ${t.id === oneId ? 'is-one' : ''}">
      <button class="td-check" data-td-toggle="${t.id}" role="checkbox" aria-checked="${t.done}" aria-label="${t.done ? 'Done' : 'Mark done'}: ${esc(t.text)}">${icon('check')}</button>
      <button class="td-text" data-td-edit="${t.id}">${t.id === oneId ? '<span class="td-eyebrow">The one thing</span>' : ''}<span>${esc(t.text)}</span></button>
      <button class="td-star ${t.id === oneId ? 'on' : ''}" data-td-one="${t.id}" aria-pressed="${t.id === oneId}" aria-label="${t.id === oneId ? 'Unmark as the One Thing' : 'Make this the One Thing'}" title="The one thing">${icon('target')}</button>
    </div>`;
  return `<div class="card pad todo-card ${big ? 'big' : ''}" data-td-day="${day}">
    <div class="card-head"><h3>${icon('target')}${big ? 'Today' : 'To-do'}${one?.done ? ' <span class="td-won">· one thing done</span>' : ''}</h3>${link ? '<a class="link small" href="#/onething">History</a>' : ''}</div>
    ${todos.length ? `<div class="td-list">${order.map(row).join('')}</div>` : ''}
    ${todos.length && !one ? `<p class="td-hint">${icon('target')}<span>Tap the target on a task to make it your <b>One Thing</b>: the one that would make ${day === today() ? 'today' : 'the day'} a win. It counts as a daily habit.</span></p>` : ''}
    <form class="td-add" data-td-add><span class="td-plus">${icon('plus')}</span><input class="input" name="text" maxlength="140" placeholder="${todos.length ? 'Add a to-do' : `What do you need to do ${day === today() ? 'today' : 'this day'}?`}" autocomplete="off" enterkeyhint="done" aria-label="Add a to-do"></form>
    ${yLeft.length ? `<button class="carry" data-td-carry>${icon('restore')}Carry over ${yLeft.length} unfinished from yesterday</button>` : ''}
    ${one?.done && o?.note ? `<p class="one-note">“${esc(o.note)}”</p>` : ''}
    ${one?.done && !o?.note && big ? `<button class="link small" data-one-reflect="${day}">Add a reflection on your One Thing</button>` : ''}
  </div>`;
}

export function bindTodos(root, after = rerender) {
  const dayOf = el => el.closest('[data-td-day]').dataset.tdDay;
  root.addEventListener('submit', e => {
    const f = e.target.closest('[data-td-add]');
    if (!f) return;
    e.preventDefault();
    const text = f.text.value.trim();
    if (!text) return;
    addTodo(dayOf(f), text); haptic(6); after();
    setTimeout(() => root.querySelector(`[data-td-day="${dayOf(f)}"] [data-td-add] input`)?.focus(), 30);
  });
  root.addEventListener('click', async e => {
    const tg = e.target.closest('[data-td-toggle]');
    if (tg) {
      const day = dayOf(tg), id = tg.dataset.tdToggle;
      if (id === todosOf(day).oneId) { const m = await import('./habits.js'); m.toggleOneThing(day, tg); }
      else { toggleTodo(day, id); haptic(8); }
      after(); return;
    }
    const st = e.target.closest('[data-td-one]');
    if (st) {
      const day = dayOf(st), id = st.dataset.tdOne, was = todosOf(day).oneId;
      markOne(day, id); haptic(10); after();
      if (was !== id) toast(was ? 'Your One Thing changed' : 'That’s your One Thing: it counts as a daily habit');
      return;
    }
    const ed = e.target.closest('[data-td-edit]');
    if (ed) {
      const day = dayOf(ed), id = ed.dataset.tdEdit, t = todosOf(day).todos.find(x => x.id === id);
      if (!t) return;
      const v = await promptDialog('Edit to-do', { value: t.text, ok: 'Save', placeholder: 'Leave empty to delete' });
      if (v === null) return;
      if (!v.trim()) { const before = getOne(day); removeTodo(day, id); toast('Deleted', { action: 'Undo', onAction: () => { save('onething', before); after(); } }); }
      else updateTodo(day, id, { text: v.trim() });
      after(); return;
    }
    const c = e.target.closest('[data-td-carry]');
    if (c) {
      const day = dayOf(c), { todos } = todosOf(day);
      todosOf(addDays(day, -1)).todos.filter(t => !t.done && !todos.some(x => x.text === t.text)).forEach(t => addTodo(day, t.text));
      after(); return;
    }
    const rf = e.target.closest('[data-one-reflect]');
    if (rf) {
      const v = await promptDialog('How did it go?', { multiline: true, placeholder: 'One line for future you…' });
      if (v) { save('onething', { ...getOne(rf.dataset.oneReflect), note: v }); after(); }
    }
  });
}

export function renderOneThing(main) {
  const s = oneStats();
  const all = list('onething').filter(o => o.text).sort((a, b) => b.id.localeCompare(a.id));
  const months = [];
  all.forEach(o => {
    const d = parseDay(o.id); const k = fmtMonth(d.getFullYear(), d.getMonth());
    let m = months.find(x => x.k === k); if (!m) months.push(m = { k, items: [] }); m.items.push(o);
  });
  const t = today();
  main.innerHTML = `<div class="page">
    <header class="page-head"><div class="page-title-row"><h1>To-do</h1></div>
      <p class="muted">${fmtLongDay(t)}</p></header>
    ${todoCard(t, { big: true })}
    <h3 class="group-label one-stats-label">Your One Thing</h3>
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
      <h3 class="group-label">One Thing log</h3>
      ${months.length ? months.map(m => `<h4 class="sub-label">${m.k}</h4><div class="card list-card">${m.items.map(o => `
        <div class="list-row one-log ${o.done ? 'done' : o.id < t ? 'missed' : ''}">
          <div class="one-log-date"><b>${parseDay(o.id).getDate()}</b><span>${fmtDay(o.id, { weekday: 'short' })}</span></div>
          <div class="grow"><div class="one-log-text">${esc(o.text)}</div>
            <div class="muted small">${o.done ? `Done at ${fmtTime(o.doneAt)}${ymd(new Date(o.doneAt)) > o.id ? ' (later)' : ''}` : o.id < t ? 'Not finished' : o.id === t ? 'In progress' : 'Planned'}${o.note ? ` · “${esc(o.note)}”` : ''}</div></div>
          <span class="status-dot">${o.done ? icon('check') : ''}</span>
        </div>`).join('')}</div>`).join('') : `<div class="empty">${icon('target', 'empty-ic')}<p>Your history of “one things” will collect here.</p></div>`}
    </section>
  </div>`;
  bindTodos(main.querySelector('.page'));
}
