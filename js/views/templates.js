// Note templates and the daily note. The built-in templates are each based on a writing
// or reflection technique with research behind it; "Why it works" cites the sources.
import { list, save, uid, settings, setSettings } from '../db.js';
import { esc, today, fmtLongDay, fmtDay, parseDay } from '../util.js';
import { icon } from '../icons.js';
import { navigate } from '../router.js';
import { sheet, toast, confirmDialog, promptDialog } from '../ui.js';
import { newNote } from './notes.js';

// ---------- building blocks ----------
const blank = '<p><br></p>';
const items = (n, cls = '') => `<ul${cls ? ` class="${cls}"` : ''}>${'<li><br></li>'.repeat(n)}</ul>`;
const numbered = n => `<ol>${'<li><br></li>'.repeat(n)}</ol>`;
const sec = (heading, body = blank) => `<h3>${heading}</h3>${body}`;

function isoWeek(key) {
  const d = parseDay(key);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const jan4 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - jan4) / 864e5 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}

// why: [[claim, source], …]
export const TEMPLATES = [
  { id: 'daily', name: 'Daily note', icon: 'today', tags: ['daily'],
    purpose: 'Plan the morning, reflect at night: an if–then plan, a feeling, three good things, a free write and tomorrow’s list.',
    title: d => fmtLongDay(d),
    html: () => sec('If–then plan for today: “If [moment], then I will [action]”')
      + sec('How I feel, in a word or two')
      + sec('Three good things today, and why they happened', numbered(3))
      + sec('On my mind')
      + sec('Tomorrow’s to-do', items(3, 'checklist')),
    why: [
      ['Turning an intention into “If it’s 7 am, then I’ll write for 20 minutes” has a medium-to-large effect on actually doing it.', 'Gollwitzer & Sheeran (2006), meta-analysis of 94 studies, Advances in Experimental Social Psychology'],
      ['Putting a feeling into words (affect labelling) calms the brain’s alarm response to it.', 'Lieberman et al. (2007), Psychological Science'],
      ['Writing three good things and why they happened each evening raised happiness and lowered depressive symptoms for six months.', 'Seligman, Steen, Park & Peterson (2005), American Psychologist'],
      ['Writing freely about what’s on your mind has small but reliable benefits for wellbeing.', 'Pennebaker & Beall (1986); Frattaroli (2006), meta-analysis, Psychological Bulletin'],
      ['Writing tomorrow’s to-do list before bed helped people fall asleep faster than writing about what they had already done.', 'Scullin et al. (2018), Journal of Experimental Psychology: General'],
    ] },
  { id: 'weekly', name: 'Weekly review', icon: 'history', tags: ['weekly-review'],
    purpose: 'Look back at the week, learn from it, and set next week’s top three.',
    title: d => `Week ${isoWeek(d)} review`,
    html: () => sec('Wins this week', items(1))
      + sec('What didn’t go to plan, and why')
      + sec('What I learned')
      + sec('Top 3 for next week', items(3, 'checklist'))
      + sec('If–then plan for the hardest one: “If [moment], then I will [action]”'),
    why: [
      ['Monitoring progress toward a goal makes reaching it more likely, especially when the progress is written down.', 'Harkin et al. (2016), meta-analysis of 138 studies, Psychological Bulletin'],
      ['Structured debriefs (what happened, why, what next) improve later performance by about 20–25%.', 'Tannenbaum & Cerasoli (2013), meta-analysis, Human Factors'],
      ['An if–then plan for the hardest task makes follow-through much more likely.', 'Gollwitzer & Sheeran (2006)'],
    ] },
  { id: 'decision', name: 'Decision journal', icon: 'target', tags: ['decision'],
    purpose: 'Record a decision before you know how it turns out, with a pre-mortem, so you can learn from it later.',
    title: d => `Decision · ${fmtDay(d, { month: 'short', day: 'numeric' })}`,
    html: () => sec('The decision')
      + sec('Options I considered', items(2))
      + sec('What I expect to happen, and how sure I am (%)')
      + sec('Pre-mortem: it’s a year from now and this went badly. Why?', items(3))
      + sec('How I feel right now')
      + sec('Review it on'),
    why: [
      ['Writing your expectations down before the outcome protects you from hindsight bias (“I knew it all along”), so you can tell a bad decision from bad luck.', 'Fischhoff (1975), Journal of Experimental Psychology: Human Perception and Performance'],
      ['Imagining that the outcome has already happened (“prospective hindsight”) helped people come up with about 30% more reasons for it. This is the basis of the pre-mortem.', 'Mitchell, Russo & Pennington (1989); Klein (2007), Harvard Business Review'],
      ['Putting a % on your confidence, and checking it later, is how forecasters improve their calibration.', 'Tetlock & Gardner (2015), Superforecasting'],
    ] },
  { id: 'thought', name: 'Thought record', icon: 'brain', tags: ['thought-record'],
    purpose: 'Untangle a strong feeling: the situation, the automatic thought, the evidence, and a more balanced view.',
    title: d => `Thought record · ${fmtDay(d, { month: 'short', day: 'numeric' })}`,
    html: () => sec('Situation: what happened, where, when')
      + sec('Feelings, and how strong (0–100%)')
      + sec('Automatic thought: what went through my mind')
      + sec('Evidence for the thought', items(1))
      + sec('Evidence against the thought', items(1))
      + sec('A more balanced thought')
      + sec('Feelings now (0–100%)'),
    why: [
      ['This is the thought record from cognitive behavioural therapy (CBT), used to catch and test automatic thoughts.', 'Beck et al. (1979), Cognitive Therapy of Depression; Greenberger & Padesky (2016), Mind Over Mood'],
      ['CBT is one of the best-supported psychological treatments, especially for anxiety and depression.', 'Hofmann et al. (2012), review of 269 meta-analyses, Cognitive Therapy and Research'],
      ['Rating the feeling before and after shows whether the reframe actually helped. If you’re struggling, it works best alongside a therapist, not instead of one.', ''],
    ] },
  { id: 'bestself', name: 'Best possible self', icon: 'sparkle', tags: ['best-self'],
    purpose: 'Write about a future where everything has gone as well as it could, then pick one step toward it.',
    title: () => 'My best possible self',
    html: () => sec('A few years from now, everything has gone as well as it possibly could. What does my life look like?')
      + sec('What this tells me I really want')
      + sec('One step toward it this week', items(1, 'checklist')),
    why: [
      ['Writing about your best possible future self for about 20 minutes raised positive mood and optimism.', 'King (2001), Personality and Social Psychology Bulletin; Peters et al. (2010), Journal of Positive Psychology'],
      ['In a meta-analysis of interventions to increase optimism, the best-possible-self exercise had the largest effect.', 'Malouff & Schutte (2017), Journal of Happiness Studies'],
    ] },
  { id: 'learning', name: 'Learning note', icon: 'notes', tags: ['learning'],
    purpose: 'For a book, talk or course: the key ideas from memory, in your own words, plus questions to test yourself.',
    title: () => '',
    html: () => sec('Source')
      + sec('Key ideas in my own words (try first without looking)', items(3))
      + sec('What surprised me, or what I disagree with')
      + sec('Questions to test myself later', items(2))
      + sec('How I’ll use it'),
    why: [
      ['Recalling ideas from memory makes them stick far better than re-reading them.', 'Roediger & Karpicke (2006), Psychological Science'],
      ['Explaining ideas in your own words and linking them to what you already know strengthens memory further.', 'Slamecka & Graf (1978), generation effect; Dunlosky et al. (2013), Psychological Science in the Public Interest'],
      ['Writing test questions makes it easy to come back and review later, which beats cramming.', 'Cepeda et al. (2006), meta-analysis of spaced practice, Psychological Bulletin'],
    ] },
  { id: 'debrief', name: 'Conversation debrief', icon: 'chat', tags: ['debrief'],
    purpose: 'Right after meeting someone: what they told you, what matters to them, and what to follow up on.',
    title: d => `Conversation · ${fmtDay(d, { month: 'short', day: 'numeric' })}`,
    html: () => sec('Who (type @ to link them)')
      + sec('What they told me: names, plans, worries', items(2))
      + sec('What seems to matter to them')
      + sec('Follow-ups', items(1, 'checklist')),
    why: [
      ['We forget much of what we hear within a day, most of it in the first hours, so writing it down soon after keeps the details.', 'Ebbinghaus (1885), replicated by Murre & Dros (2015), PLoS ONE'],
      ['Remembering what someone told you and asking follow-up questions makes people like you more.', 'Huang et al. (2017), Journal of Personality and Social Psychology'],
    ] },
];

// ---------- lookup ----------
const userTemplates = () => settings().noteTemplates || [];
export const findTemplate = id => TEMPLATES.find(t => t.id === id) || userTemplates().find(t => t.id === id) || null;

function render(tpl, date) {
  return tpl.html instanceof Function
    ? { html: tpl.html(), title: tpl.title(date) }
    : { html: tpl.html, title: tpl.titleText ? tpl.titleText : '' };
}

// Make a note from a template. The note is "seeded": if you leave without writing, it's discarded.
export function noteFromTemplate(id, { date = today(), extra = {} } = {}) {
  const tpl = findTemplate(id) || TEMPLATES[0];
  const { html, title } = render(tpl, date);
  const text = new DOMParser().parseFromString(html, 'text/html').body.innerText || '';
  return newNote({ html, title, text, tags: [...(tpl.tags || [])], seeded: true, template: tpl.id, ...extra });
}

// ---------- daily note ----------
export const dailyNote = (date = today()) => list('notes').find(n => n.daily === date && !n.trashed) || null;

export function openDaily(date = today(), { replace = false } = {}) {
  const existing = dailyNote(date);
  if (existing) { navigate(`#/notes/${existing.id}`, { replace }); return existing; }
  const tplId = findTemplate(settings().dailyTemplate) ? settings().dailyTemplate : 'daily';
  const n = noteFromTemplate(tplId, { date, extra: { daily: date } });
  // the daily note always carries #daily and the date as its title
  save('notes', { ...n, title: fmtLongDay(date), tags: [...new Set(['daily', ...n.tags])] }, { silent: true });
  navigate(`#/notes/${n.id}`, { replace });
  return n;
}

// ---------- save a note as a template ----------
export async function saveAsTemplate(note) {
  const name = await promptDialog('Save as template', { placeholder: 'Template name', value: note.title || '' });
  if (!name?.trim()) return;
  // keep the structure, not the ticks
  const html = (note.html || '').replace(/<li class="checked">/g, '<li>');
  const tpl = { id: 'u_' + uid(), name: name.trim(), html, tags: (note.tags || []).filter(t => t !== 'daily'), titleText: '', created: Date.now() };
  setSettings({ noteTemplates: [...userTemplates(), tpl] });
  toast(`Saved template “${tpl.name}”`);
}

// ---------- picker ----------
export function templateSheet({ onPick } = {}) {
  sheet({
    title: 'Templates',
    render(body, close) {
      const draw = () => {
        const st = settings(), mine = userTemplates(), todayNote = dailyNote();
        const dailyTpl = findTemplate(st.dailyTemplate) ? st.dailyTemplate : 'daily';
        const row = t => `<div class="tpl-item">
            <button class="tpl-pick" data-tpl="${esc(t.id)}">${icon(t.icon || 'notes')}<span><b>${esc(t.name)}</b><span class="muted small">${esc(t.purpose || 'Your template')}</span></span>${icon('chevR')}</button>
            ${t.why ? `<details class="ty-info"><summary>${icon('info')}Why it works</summary><div>${t.why.map(([c, s]) => `<p>${esc(c)}${s ? `<br><span class="muted small">${esc(s)}</span>` : ''}</p>`).join('')}</div></details>` : ''}
          </div>`;
        body.innerHTML = `
          <button class="btn primary block" data-daily>${icon('today')}${todayNote ? 'Open today’s note' : 'Start today’s note'}</button>
          <div class="feel-label">Research-backed</div>
          <div class="card list-card tpl-list">${TEMPLATES.map(row).join('')}</div>
          <div class="feel-label">Yours</div>
          ${mine.length ? `<div class="card list-card tpl-list">${mine.map(t => `<div class="tpl-item row-between"><button class="tpl-pick grow" data-tpl="${esc(t.id)}">${icon('notes')}<span><b>${esc(t.name)}</b></span></button><button class="icon-btn sm" data-del="${esc(t.id)}" aria-label="Delete ${esc(t.name)}">${icon('trash')}</button></div>`).join('')}</div>`
            : '<p class="muted small">Make your own: open any note, tap ⋯ and choose “Save as template”.</p>'}
          <label class="field tpl-daily"><span>The daily note uses</span><select class="input" data-daily-tpl>${[...TEMPLATES, ...mine].map(t => `<option value="${esc(t.id)}" ${t.id === dailyTpl ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>`;
      };
      draw();
      body.addEventListener('click', async e => {
        if (e.target.closest('[data-daily]')) { close(); openDaily(); return; }
        const pick = e.target.closest('[data-tpl]');
        if (pick) { close(); if (onPick) onPick(pick.dataset.tpl); else { const n = noteFromTemplate(pick.dataset.tpl); navigate(`#/notes/${n.id}`); } return; }
        const del = e.target.closest('[data-del]');
        if (del) {
          const t = findTemplate(del.dataset.del);
          if (!(await confirmDialog(`Delete the template “${t.name}”? Notes made from it stay.`))) return;
          setSettings({ noteTemplates: userTemplates().filter(x => x.id !== t.id), ...(settings().dailyTemplate === t.id ? { dailyTemplate: 'daily' } : {}) });
          draw();
        }
      });
      body.addEventListener('change', e => {
        if (e.target.matches('[data-daily-tpl]')) { setSettings({ dailyTemplate: e.target.value }); toast('Daily note template set'); }
      });
    },
  });
}
