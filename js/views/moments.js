// Moments: brief notes, each with an icon, on what happened during a day.
// Shown on the Calendar and on Today; added and edited through one sheet.
import { list, get, save, remove, uid, settings, setSettings } from '../db.js';
import { esc, today, hm, fmtDay, haptic } from '../util.js';
import { sheet, toast, confirmDialog } from '../ui.js';

// [key, label, color, svg path (24×24, stroked), words that suggest it]
export const MOMENT_ICONS = [
  ['moment', 'Moment', '#8E8E93', 'M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M6.3 17.7l2.1-2.1M15.6 8.4l2.1-2.1', []],
  ['sun', 'Sunset', '#FFB340', 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4M16 12a4 4 0 1 1-8 0a4 4 0 0 1 8 0Z', ['sunset', 'sunrise', 'sun', 'golden hour', 'sky', 'beach']],
  ['people', 'People', '#0A84FF', 'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7ZM22 20v-1a4 4 0 0 0-3-3.9M16 4.1a3.5 3.5 0 0 1 0 6.8', ['friend', 'friends', 'barkada', 'family', 'mama', 'mom', 'papa', 'dad', 'kuya', 'ate', 'met', 'call', 'called', 'visit', 'party', 'hangout', 'game night', 'with']],
  ['love', 'Love', '#FF375F', 'M12 20s-7.5-4.4-9-9.2C2 7.5 4.2 5 7 5c2 0 3.6 1.2 5 3c1.4-1.8 3-3 5-3c2.8 0 5 2.5 4 5.8C19.5 15.6 12 20 12 20Z', ['love', 'date', 'kiss', 'partner', 'anniversary', 'girlfriend', 'boyfriend', 'wife', 'husband', 'romantic', 'cuddle']],
  ['food', 'Food', '#FF9F0A', 'M4 8h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6V8ZM17 9h1.5a2.5 2.5 0 0 1 0 5H17M8 2v3M12 2v3', ['lunch', 'dinner', 'breakfast', 'brunch', 'eat', 'food', 'coffee', 'ramen', 'restaurant', 'cook', 'cooked', 'snack', 'drinks', 'beer', 'wine', 'cafe', 'pizza']],
  ['place', 'Place', '#40C8E0', 'M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12ZM12 11.5a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5Z', ['trip', 'travel', 'went to', 'visited', 'flight', 'hike', 'road trip', 'day trip', 'lakbay', 'explore', 'museum', 'park']],
  ['workout', 'Workout', '#32D74B', 'M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12', ['gym', 'run', 'ran', 'workout', 'yoga', 'swim', 'bike', 'cycling', '5k', '10k', 'lift', 'legs', 'exercise', 'walk', 'pr', 'training', 'sport', 'basketball']],
  ['work', 'Work', '#AC8E68', 'M3 8h18v12H3ZM8 8V5h8v3M3 13h18', ['work', 'meeting', 'shipped', 'client', 'office', 'pitch', 'deadline', 'project', 'presentation', 'interview', 'job']],
  ['learn', 'Learned', '#BF5AF2', 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5ZM4 19a2 2 0 0 1 2-2h13', ['read', 'finished', 'book', 'learned', 'learnt', 'course', 'class', 'studied', 'study', 'lesson', 'wrote', 'writing', 'podcast']],
  ['music', 'Music', '#FF6482', 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0a3 3 0 0 1 6 0ZM20 16a3 3 0 1 1-6 0a3 3 0 0 1 6 0Z', ['music', 'concert', 'song', 'sang', 'sing', 'karaoke', 'danced', 'dance', 'gig', 'playlist', 'guitar', 'piano']],
  ['star', 'Milestone', '#FFD60A', 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z', ['milestone', 'first', 'promoted', 'promotion', 'won', 'win', 'launch', 'launched', 'birthday', 'celebrate', 'celebrated', 'graduation', 'graduated', 'halloween', 'christmas', 'new year']],
  ['rain', 'Weather', '#64D2FF', 'M7 15a4 4 0 1 1 .9-7.9A5.5 5.5 0 0 1 18.5 9a3.5 3.5 0 0 1-.5 6H7ZM8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5', ['rain', 'rained', 'typhoon', 'storm', 'weather', 'flood', 'thunder', 'heat']],
  ['rest', 'Rest', '#7D7AFF', 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z', ['slept', 'sleep', 'nap', 'rest', 'rested', 'relax', 'relaxed', 'lazy', 'day off', 'sleep in', 'slept in']],
  ['home', 'Home', '#A2845E', 'M3 11 12 4l9 7M5 10v10h14V10', ['home', 'cleaned', 'clean', 'house', 'room', 'moved', 'repaint', 'repainted', 'laundry', 'garden', 'chores']],
  ['money', 'Money', '#30B0C7', 'M3 7h18v10H3ZM12 14.5a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5ZM6 10v.01M18 14v.01', ['paid', 'salary', 'payday', 'bought', 'buy', 'spent', 'money', 'bills', 'shopping', 'sold', 'saved']],
  ['health', 'Health', '#FF453A', 'M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7Z', ['doctor', 'dentist', 'sick', 'fever', 'hospital', 'medicine', 'checkup', 'headache', 'migraine']],
];
const BY_KEY = new Map(MOMENT_ICONS.map(i => [i[0], i]));
export const momentIcon = key => BY_KEY.get(key) || MOMENT_ICONS[0];

// The first icon whose words appear in the text. Specific ones are checked before "with".
export function guessIcon(text) {
  const t = ` ${(text || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ')} `;
  const has = w => t.includes(` ${w} `) || (w.length > 4 && t.includes(` ${w}`));
  const order = ['sun', 'love', 'workout', 'health', 'food', 'music', 'learn', 'work', 'rain', 'rest', 'home', 'money', 'star', 'place', 'people'];
  return order.find(k => momentIcon(k)[4].some(has)) || null;
}

export const iconSVG = (key, size = 18, sw = 2) => {
  const [, , color, d] = momentIcon(key);
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
};
export const iconBadge = (key, size = 32) => `<span class="mo-badge" style="--c:${momentIcon(key)[2]};width:${size}px;height:${size}px">${iconSVG(key, Math.round(size * 0.53))}</span>`;

export const moments = () => list('moments');
export const momentsOn = day => moments().filter(m => m.date === day).sort((a, b) => (a.time || '99').localeCompare(b.time || '99') || a.created - b.created);

export const momentRow = m => `<button class="mo-row" data-moment="${m.id}">${iconBadge(m.icon)}<span class="mo-text">${esc(m.text)}</span>${m.time ? `<span class="mo-time">${esc(m.time)}</span>` : ''}</button>`;

// One-time copy of the old tracker logs into moments (the logs themselves are kept)
export function migrateTrackerLogs() {
  if (settings().trackersMoved) return;
  const tr = new Map(list('trackers').map(t => [t.id, t]));
  list('events').forEach(e => {
    const t = tr.get(e.trackerId); if (!t) return;
    const text = t.name + (e.note ? ` — ${e.note}` : '');
    save('moments', { id: 'm_' + e.id, date: e.date, time: e.time || '', text, icon: guessIcon(`${t.name} ${e.note || ''}`) || 'moment', fromTracker: t.id, created: e.created || Date.now(), updated: Date.now() }, { silent: true });
  });
  setSettings({ trackersMoved: true });
}

// Add or edit a moment
export function momentSheet({ date = today(), moment = null, onDone } = {}) {
  const editing = !!moment;
  let picked = moment?.icon || null; // set once you tap an icon yourself
  sheet({
    title: editing ? 'Edit moment' : 'New moment',
    className: 'mo-sheet',
    render(body, close) {
      body.innerHTML = `<form class="stack" data-mo-form>
        <label class="mo-date">${'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v15H4ZM4 10h16M8 3v4M16 3v4"/></svg>'}<input type="date" name="date" value="${esc(moment?.date || date)}" aria-label="Day"></label>
        <label class="mo-input"><span class="mo-preview"></span><input name="text" placeholder="What happened?" autocomplete="off" enterkeyhint="done" maxlength="140" value="${esc(moment?.text || '')}" aria-label="What happened?"></label>
        <p class="muted small mo-hint"></p>
        <div class="mo-grid" role="radiogroup" aria-label="Icon">${MOMENT_ICONS.map(([k, label, color]) => `<button type="button" class="mo-pick" role="radio" data-icon="${k}" style="--c:${color}">${iconSVG(k, 22)}<span>${label}</span></button>`).join('')}</div>
        <div class="row-between">${editing ? '<button type="button" class="btn ghost danger-text" data-del>Delete</button>' : '<span></span>'}<button class="btn primary">${editing ? 'Save' : 'Add moment'}</button></div>
      </form>`;
      const f = body.querySelector('form'), inp = f.text, hint = body.querySelector('.mo-hint');
      const current = () => picked || guessIcon(inp.value) || 'moment';
      const draw = () => {
        const k = current();
        body.querySelector('.mo-preview').innerHTML = iconBadge(k, 34);
        body.querySelectorAll('.mo-pick').forEach(b => { const on = b.dataset.icon === k; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
        const g = !picked && guessIcon(inp.value);
        hint.textContent = g ? `Picked ${momentIcon(g)[1].toLowerCase()} from your words. Tap another to change it.` : 'Pick an icon, or type and one is picked for you.';
      };
      draw();
      setTimeout(() => { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 60);
      inp.addEventListener('input', draw);
      body.addEventListener('click', async e => {
        const b = e.target.closest('[data-icon]');
        if (b) { picked = b.dataset.icon; haptic(5); draw(); return; }
        if (e.target.closest('[data-del]')) {
          const m = get('moments', moment.id);
          remove('moments', moment.id); close(); onDone?.();
          toast('Moment deleted', { action: 'Undo', onAction: () => { save('moments', m); onDone?.(); } });
        }
      });
      f.addEventListener('submit', e => {
        e.preventDefault();
        const text = inp.value.trim();
        if (!text) { inp.focus(); toast('Write a few words about it'); return; }
        const day = f.date.value || date;
        const rec = editing
          ? { ...moment, text, icon: current(), date: day, updated: Date.now() }
          : { id: uid(), text, icon: current(), date: day, time: day === today() ? hm() : '', created: Date.now(), updated: Date.now() };
        save('moments', rec); haptic(10); close(); onDone?.(rec);
        if (!editing) toast(`Added to ${day === today() ? 'today' : fmtDay(day, { month: 'short', day: 'numeric' })}`);
      });
    },
  });
}

export function bindMoments(root, after) {
  root.addEventListener('click', e => {
    const r = e.target.closest('[data-moment]');
    if (r) return momentSheet({ moment: get('moments', r.dataset.moment), onDone: after });
    const a = e.target.closest('[data-add-moment]');
    if (a) return momentSheet({ date: a.dataset.addMoment || today(), onDone: after });
  });
}
