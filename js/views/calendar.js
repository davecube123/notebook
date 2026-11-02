// Calendar: a month of moments. Each day shows the icons of what happened;
// tap a day to read its moments, add one, or edit one.
import { list, settings } from '../db.js';
import { esc, today, ymd, addDays, parseDay, fmtLongDay, fmtDay, weekdayNames } from '../util.js';
import { icon } from '../icons.js';
import { rerender } from '../router.js';
import { noteTitle } from './notes.js';
import { momentsOn, moments, momentRow, iconSVG, bindMoments } from './moments.js';

const ui = { y: null, m: null, sel: null };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function monthGrid() {
  const ws = settings().weekStart;
  const first = new Date(ui.y, ui.m, 1);
  const lead = (first.getDay() - ws + 7) % 7;
  const start = addDays(ymd(first), -lead);
  const t = today();
  const byDay = new Map();
  moments().forEach(m => { if (!byDay.has(m.date)) byDay.set(m.date, []); byDay.get(m.date).push(m); });
  const weeks = Math.ceil((lead + new Date(ui.y, ui.m + 1, 0).getDate()) / 7);
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i);
    const inMonth = parseDay(d).getMonth() === ui.m;
    const ms = (byDay.get(d) || []).sort((a, b) => (a.time || '99').localeCompare(b.time || '99') || a.created - b.created);
    const icons = [...new Set(ms.map(m => m.icon))].slice(0, 3);
    cells.push(`<button class="mcal-cell ${inMonth ? '' : 'out'} ${d === t ? 'today' : ''} ${d === ui.sel ? 'sel' : ''}" data-day="${d}" aria-label="${fmtLongDay(d)}${ms.length ? `, ${ms.length} moment${ms.length > 1 ? 's' : ''}` : ''}" aria-pressed="${d === ui.sel}">
      <span class="mcal-num">${parseDay(d).getDate()}</span>
      <span class="mcal-icons">${icons.map(k => iconSVG(k, 12, 2.4)).join('')}</span>
    </button>`);
  }
  return `<div class="mcal-week">${weekdayNames(ws).map(n => `<span>${n.slice(0, 1)}</span>`).join('')}</div><div class="mcal-grid">${cells.join('')}</div>`;
}

function dayPanel(day) {
  const ms = momentsOn(day);
  const t = today();
  const notes = list('notes').filter(n => !n.trashed && !n.draft && ymd(new Date(n.created)) === day);
  const people = list('people');
  const met = people.flatMap(p => (p.interactions || []).filter(i => i.date === day).map(i => ({ p, i })));
  const bdays = people.filter(p => p.fields?.birthday && p.fields.birthday.slice(5) === day.slice(5));
  const also = [
    ...bdays.map(p => `<a class="day-line" href="#/people/${p.id}">${icon('cake')}<span><b>${esc(p.name)}</b>'s birthday</span>${icon('chevR', 'day-chev')}</a>`),
    ...met.map(({ p, i }) => `<a class="day-line" href="#/people/${p.id}">${icon('chat')}<span>Saw <b>${esc(p.name)}</b>${i.note ? ' — ' + esc(i.note.slice(0, 60)) : ''}</span>${icon('chevR', 'day-chev')}</a>`),
    ...notes.map(n => `<a class="day-line" href="#/notes/${n.id}">${icon('notes')}<span>${esc(noteTitle(n))}</span>${icon('chevR', 'day-chev')}</a>`),
  ];
  const when = day === t ? 'today' : `on ${fmtDay(day, { month: 'short', day: 'numeric' })}`;
  return `<div class="mcal-day">
    <div class="mcal-day-head"><h2>${fmtLongDay(day).replace(/,? \d{4}$/, '')}</h2><span class="muted small">${ms.length ? `${ms.length} moment${ms.length > 1 ? 's' : ''}` : day === t ? 'today' : ''}</span></div>
    ${ms.length ? `<div class="card list-card mo-list">${ms.map(momentRow).join('')}</div>` : `<p class="muted small mcal-empty">${day > t ? 'Nothing planned here yet.' : 'Nothing written for this day.'}</p>`}
    <button class="mo-add" data-add-moment="${day}"><span class="mo-plus">${icon('plus')}</span>What happened ${when}?</button>
    ${also.length ? `<section class="day-section"><h3 class="day-label">Also on this day</h3><div class="day-also">${also.join('')}</div></section>` : ''}
  </div>`;
}

export function renderCalendar(main, params, query) {
  const t = today();
  if (ui.y === null) { ui.y = parseDay(t).getFullYear(); ui.m = parseDay(t).getMonth(); ui.sel = t; }
  if (query.day) { ui.sel = query.day; ui.y = parseDay(query.day).getFullYear(); ui.m = parseDay(query.day).getMonth(); }
  const isNow = ui.y === parseDay(t).getFullYear() && ui.m === parseDay(t).getMonth();
  main.innerHTML = `<div class="page mcal-page">
    <header class="page-head mcal-head">
      <h1>${MONTHS[ui.m]} <span class="mcal-year">${ui.y}</span></h1>
      <div class="head-actions">
        ${isNow && ui.sel === t ? '' : '<button class="btn ghost sm" data-act="today">Today</button>'}
        <button class="icon-btn" data-act="prev" aria-label="Previous month">${icon('back')}</button>
        <button class="icon-btn" data-act="next" aria-label="Next month">${icon('chevR')}</button>
      </div>
    </header>
    <div class="cal-layout">
      <div class="mcal-month">${monthGrid()}</div>
      <div class="cal-side">${dayPanel(ui.sel)}</div>
    </div>
  </div>`;
  const page = main.querySelector('.page');
  const redraw = () => { const st = main.scrollTop; rerender(); main.scrollTop = st; };
  bindMoments(page, redraw);
  page.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b) {
      const a = b.dataset.act;
      if (a === 'prev' || a === 'next') { const d = new Date(ui.y, ui.m + (a === 'next' ? 1 : -1), 1); ui.y = d.getFullYear(); ui.m = d.getMonth(); return rerender(); }
      if (a === 'today') { ui.y = parseDay(t).getFullYear(); ui.m = parseDay(t).getMonth(); ui.sel = t; return rerender(); }
    }
    const day = e.target.closest('[data-day]');
    if (day) {
      ui.sel = day.dataset.day;
      if (parseDay(ui.sel).getMonth() !== ui.m) { ui.y = parseDay(ui.sel).getFullYear(); ui.m = parseDay(ui.sel).getMonth(); }
      redraw();
    }
  });
  // swipe between months
  const grid = page.querySelector('.mcal-grid');
  let x0 = null;
  grid.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  grid.addEventListener('touchend', e => {
    if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 60) { const d = new Date(ui.y, ui.m + (dx < 0 ? 1 : -1), 1); ui.y = d.getFullYear(); ui.m = d.getMonth(); rerender(); }
  });
}
