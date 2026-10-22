// Today: the daily dashboard — one thing, anchors, quick logs, nudges, memories.
import { list, settings } from '../db.js';
import { esc, today, ymd, fmtLongDay, greeting, addDays, relDays, fmtShort, parseDay } from '../util.js';
import { icon } from '../icons.js';
import { navigate, rerender } from '../router.js';
import { oneThingCard, bindOneThing } from './onething.js';
import { habitsCard, bindHabits } from './habits.js';
import { trackers, trackerStats, trackTiles, bindTrackTiles } from './calendar.js';
import { newNote, noteTitle } from './notes.js';
import { openDaily, dailyNote } from './templates.js';
import { nextBirthday, reconnectDue, avatar } from './people.js';
import { installCard, bindInstall } from '../install.js';
import { feelingsCard, bindFeelings } from './feelings.js';

const QUOTES = [
  ['What you do every day matters more than what you do once in a while.', 'Gretchen Rubin'],
  ['The main thing is to keep the main thing the main thing.', 'Stephen Covey'],
  ['How we spend our days is, of course, how we spend our lives.', 'Annie Dillard'],
  ['You do not rise to the level of your goals. You fall to the level of your systems.', 'James Clear'],
  ['Well begun is half done.', 'Aristotle'],
  ['Simplicity is the ultimate sophistication.', 'Leonardo da Vinci'],
  ['It is not that we have a short time to live, but that we waste a lot of it.', 'Seneca'],
  ['Action is the foundational key to all success.', 'Pablo Picasso'],
  ['Small deeds done are better than great deeds planned.', 'Peter Marshall'],
  ['Focus is a matter of deciding what things you’re not going to do.', 'John Carmack'],
];

export function renderToday(main) {
  const t = today();
  const st = settings();
  const ts = trackers();
  const overdue = ts.filter(x => trackerStats(x).overdue);
  const notes = list('notes').filter(n => !n.trashed && !n.draft);
  const recent = [...notes].sort((a, b) => b.updated - a.updated).slice(0, 4);
  const md = t.slice(5);
  const memories = notes.filter(n => { const d = ymd(new Date(n.created)); return d.slice(5) === md && d < t; })
    .concat(notes.filter(n => { const d = ymd(new Date(n.created)); return d === addDays(t, -7) || d === addDays(t, -30); }))
    .slice(0, 3);
  const people = list('people');
  const bdays = people.map(p => ({ p, b: nextBirthday(p) })).filter(x => x.b && x.b.inDays <= 7).sort((a, b) => a.b.inDays - b.b.inDays);
  const reconnect = people.filter(reconnectDue).slice(0, 3);
  const openTodos = notes.filter(n => n.todo && n.todo.total > n.todo.done && !n.archived).slice(0, 3);
  const q = QUOTES[Math.floor(parseDay(t) / 864e5) % QUOTES.length];

  main.innerHTML = `<div class="page today-page">
    <header class="page-head today-head">
      <div><p class="eyebrow">${fmtLongDay(t)}</p><h1>${greeting()}${st.name ? `, ${esc(st.name)}` : ''}</h1></div>
      <div class="head-actions">
        <button class="icon-btn" data-act="search" aria-label="Search everything" title="Search (/)">${icon('search')}</button>
        <a class="icon-btn" href="#/settings" aria-label="Settings">${icon('settings')}</a></div>
    </header>

    ${installCard()}
    <div class="today-grid">
      <div class="col">
        ${oneThingCard(t, { big: true, link: true })}
        ${feelingsCard()}
        ${habitsCard(t)}
      </div>
      <div class="col">
        <div class="card pad">
          <div class="card-head"><h3>${icon('calendar')}Log today</h3><a class="link small" href="#/calendar">Calendar</a></div>
          ${ts.length ? trackTiles(t)
            : `<p class="muted small">Make trackers for things that happen regularly — sunsets, workouts, calls home — and log them with one tap.</p><a class="btn ghost sm" href="#/calendar">${icon('plus')}Create a tracker</a>`}
          ${overdue.map(x => `<div class="nudge-line">${icon('bell')}It's been <b>${trackerStats(x).since} days</b> since ${esc(x.emoji)} ${esc(x.name)}.</div>`).join('')}
        </div>

        ${bdays.length || reconnect.length ? `<div class="card pad">
          <div class="card-head"><h3>${icon('people')}People</h3><a class="link small" href="#/people">All</a></div>
          ${bdays.map(({ p, b }) => `<a class="mini-row" href="#/people/${p.id}">${avatar(p, 'sm')}<span>${icon('cake')} <b>${esc(p.name)}</b> — ${b.inDays === 0 ? 'birthday today!' : b.inDays === 1 ? 'birthday tomorrow' : `birthday in ${b.inDays} days`}</span></a>`).join('')}
          ${reconnect.map(p => `<a class="mini-row" href="#/people/${p.id}">${avatar(p, 'sm')}<span>Reach out to <b>${esc(p.name)}</b></span></a>`).join('')}
        </div>` : ''}

        <div class="card pad">
          <div class="card-head"><h3>${icon('notes')}Notes</h3><button class="link small" data-act="newnote">${icon('plus')}New</button></div>
          <button class="mini-row daily-row" data-act="daily">${icon('today')}<span>${dailyNote() ? '<b>Today’s note</b>' : 'Start <b>today’s note</b>'}</span><span class="muted small">${dailyNote() ? 'continue' : 'plan · reflect'}</span></button>
          <form class="capture" data-capture><input class="input" name="q" placeholder="Quick capture… (add #tags)" autocomplete="off" enterkeyhint="done"><button class="icon-btn accent" aria-label="Save">${icon('plus')}</button></form>
          ${openTodos.map(n => `<a class="mini-row" href="#/notes/${n.id}">${icon('checklist')}<span>${esc(noteTitle(n))} <span class="muted small">${n.todo.done}/${n.todo.total}</span></span></a>`).join('')}
          ${recent.map(n => `<a class="mini-row" href="#/notes/${n.id}">${icon('notes')}<span class="ellipsis">${esc(noteTitle(n))}</span><time class="muted small">${fmtShort(n.updated)}</time></a>`).join('') || '<p class="muted small">No notes yet.</p>'}
        </div>

        ${memories.length ? `<div class="card pad memory">
          <div class="card-head"><h3>${icon('history')}On this day</h3></div>
          ${memories.map(n => `<a class="mini-row" href="#/notes/${n.id}"><span><b>${esc(noteTitle(n))}</b> <span class="muted small">· ${relDays(ymd(new Date(n.created)))}</span></span></a>`).join('')}
        </div>` : ''}

        <blockquote class="daily-quote">“${esc(q[0])}”<cite>— ${esc(q[1])}</cite></blockquote>
      </div>
    </div>
  </div>`;

  const page = main.querySelector('.page');
  bindOneThing(page);
  bindHabits(page);
  bindInstall(page, rerender);
  bindTrackTiles(page);
  bindFeelings(page);
  page.addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'newnote') { const n = newNote(); navigate(`#/notes/${n.id}`); }
    if (a.dataset.act === 'daily') openDaily();
    if (a.dataset.act === 'search') document.dispatchEvent(new CustomEvent('open-search'));
  });
  page.addEventListener('submit', e => {
    const f = e.target.closest('[data-capture]');
    if (!f) return;
    e.preventDefault();
    const raw = f.q.value.trim(); if (!raw) return;
    const tags = [...raw.matchAll(/#([\w/-]+)/g)].map(m => m[1].toLowerCase());
    const text = raw.replace(/#[\w/-]+/g, '').replace(/\s+/g, ' ').trim();
    const n = newNote({ tags, title: '', html: `<p>${esc(text)}</p>`, text, draft: false });
    import('../db.js').then(({ save }) => { save('notes', n); import('../ui.js').then(u => u.toast('Captured', { action: 'Open', onAction: () => navigate(`#/notes/${n.id}`) })); rerender(); });
  });
}
