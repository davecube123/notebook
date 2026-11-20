// Today: the daily dashboard: one thing, habits, moments, people nudges and today's note.
import { list, settings } from '../db.js';
import { APP_VERSION } from '../version.js';
import { esc, today, fmtLongDay, greeting, parseDay } from '../util.js';
import { icon } from '../icons.js';
import { navigate, rerender } from '../router.js';
import { todoCard, bindTodos } from './onething.js';
import { habitsCard, bindHabits } from './habits.js';
import { momentsOn, momentRow, bindMoments } from './moments.js';
import { todayNoteCard, bindTodayNote } from './todaynote.js';
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
  const todays = momentsOn(t);
  const people = list('people');
  const bdays = people.map(p => ({ p, b: nextBirthday(p) })).filter(x => x.b && x.b.inDays <= 7).sort((a, b) => a.b.inDays - b.b.inDays);
  const reconnect = people.filter(reconnectDue).slice(0, 3);
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
        ${todoCard(t, { link: true })}
        ${st.showFeelings ? feelingsCard() : ''}
        ${habitsCard(t)}
      </div>
      <div class="col">
        <div class="card pad">
          <div class="card-head"><h3>${icon('calendar')}Today’s moments</h3><a class="link small" href="#/calendar">Calendar</a></div>
          ${todays.length ? `<div class="mo-list today-moments">${todays.map(momentRow).join('')}</div>` : ''}
          <button class="mo-add" data-add-moment="${t}"><span class="mo-plus">${icon('plus')}</span>${todays.length ? 'Add another moment' : 'What happened today?'}</button>
        </div>

        ${bdays.length || reconnect.length ? `<div class="card pad">
          <div class="card-head"><h3>${icon('people')}People</h3><a class="link small" href="#/people">All</a></div>
          ${bdays.map(({ p, b }) => `<a class="mini-row" href="#/people/${p.id}">${avatar(p, 'sm')}<span>${icon('cake')} <b>${esc(p.name)}</b> — ${b.inDays === 0 ? 'birthday today!' : b.inDays === 1 ? 'birthday tomorrow' : `birthday in ${b.inDays} days`}</span></a>`).join('')}
          ${reconnect.map(p => `<a class="mini-row" href="#/people/${p.id}">${avatar(p, 'sm')}<span>Reach out to <b>${esc(p.name)}</b></span></a>`).join('')}
        </div>` : ''}

        ${todayNoteCard()}

        <blockquote class="daily-quote">“${esc(q[0])}”<cite>— ${esc(q[1])}</cite></blockquote>
        <p class="app-version today-version">Almanac · Version ${APP_VERSION}</p>
      </div>
    </div>
  </div>`;

  const page = main.querySelector('.page');
  bindTodos(page);
  bindHabits(page);
  bindInstall(page, rerender);
  bindMoments(page, rerender);
  bindFeelings(page);
  page.addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'search') document.dispatchEvent(new CustomEvent('open-search'));
  });
  bindTodayNote(page, rerender);
}
