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

// More icons without names, shown under "More icons". Same shape: the label is used
// only for screen readers.
const ring = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
export const EXTRA_ICONS = [
  ['gift', 'Gift', '#FF6482', 'M3 8h18v4H3ZM5 12v9h14v-9M12 8v13M12 8S10 3 7.5 4.5 9 8 12 8ZM12 8s2-5 4.5-3.5S15 8 12 8Z', ['gift', 'gifts', 'present']],
  ['film', 'Movie', '#BF5AF2', 'M4 4h16v16H4ZM8 4v16M16 4v16M4 9h4M4 15h4M16 9h4M16 15h4', ['movie', 'movies', 'film', 'cinema', 'netflix', 'series']],
  ['game', 'Games', '#7D7AFF', 'M6 9h12a4 4 0 0 1 0 8c-1.5 0-2.5-1-3-2H9c-.5 1-1.5 2-3 2a4 4 0 0 1 0-8ZM8 11v3M6.5 12.5h3M15.5 12h.01M17.5 14h.01', ['game', 'games', 'gaming', 'played', 'board game', 'chess']],
  ['camera', 'Photo', '#8E8E93', 'M4 8h3l2-3h6l2 3h3v11H4Z' + ring(12, 13.5, 3.5), ['photo', 'photos', 'photoshoot', 'pictures', 'camera']],
  ['car', 'Drive', '#64D2FF', 'M3 13l2-6h14l2 6v4H3ZM5 17v2M19 17v2M7 13.5h.01M17 13.5h.01', ['drive', 'drove', 'car', 'traffic', 'ride']],
  ['plane', 'Flight', '#40C8E0', 'M22 2 11 13M22 2l-7 20-4-9-9-4Z', ['flight', 'flew', 'plane', 'airport']],
  ['bike', 'Bike', '#32D74B', ring(5.5, 17, 3.5) + ring(18.5, 17, 3.5) + 'M5.5 17 9 9h6l3.5 8M9 9l3 8M14 5h3', ['bike', 'biked', 'cycling', 'cycled']],
  ['tree', 'Nature', '#30D158', 'M12 3 6 12h3l-4 6h14l-4-6h3ZM12 18v3', ['nature', 'forest', 'trees', 'camping']],
  ['leaf', 'Plants', '#34C759', 'M5 19C5 10 11 5 20 4c-1 9-6 15-15 15ZM5 19l8-8', ['plant', 'plants', 'garden', 'gardening']],
  ['mountain', 'Mountain', '#40C8E0', 'M3 20 9 9l4 6 3-4 5 9Z', ['mountain', 'summit', 'hiked']],
  ['wave', 'Sea', '#0A84FF', 'M2 12c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2M2 17c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2', ['sea', 'ocean', 'swim', 'swam', 'surf', 'island']],
  ['snow', 'Cold', '#64D2FF', 'M12 2v20M4 6l16 12M20 6 4 18', ['snow', 'cold', 'freezing']],
  ['bolt', 'Energy', '#FFD60A', 'M13 2 4 14h7l-1 8 9-12h-7Z', ['energy', 'power', 'brownout', 'blackout']],
  ['fire', 'Fire', '#FF9F0A', 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5c0 2 1 3 2 3c0-3-.5-5.5.5-8Z', ['bonfire', 'fire', 'grill', 'bbq']],
  ['drop', 'Water', '#0A84FF', 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z', ['water', 'hydrate']],
  ['pill', 'Medicine', '#FF453A', 'M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7ZM8.5 8.5l7 7', ['pill', 'pills', 'vitamins']],
  ['chat', 'Talk', '#0A84FF', 'M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12Z', ['talk', 'talked', 'chat', 'conversation', 'texted', 'messaged']],
  ['phone', 'Call', '#32D74B', 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2', ['phone', 'facetime', 'video call']],
  ['mail', 'Mail', '#8E8E93', 'M3 6h18v12H3ZM3 7l9 6 9-6', ['email', 'letter', 'mail', 'package', 'parcel']],
  ['pen', 'Writing', '#BF5AF2', 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z', ['journal', 'journaled', 'poem', 'poems', 'essay']],
  ['code', 'Code', '#8E8E93', 'm8 8-4 4 4 4M16 8l4 4-4 4M14 4l-4 16', ['code', 'coded', 'coding', 'bug', 'app']],
  ['laptop', 'Laptop', '#AEAEB2', 'M4 5h16v11H4ZM2 19h20', ['laptop', 'computer', 'online']],
  ['cart', 'Shopping', '#30B0C7', 'M3 4h2l2.5 11h11L21 7H6.5M9 20h.01M18 20h.01', ['groceries', 'grocery', 'mall', 'market', 'shopee', 'lazada']],
  ['bag', 'Luggage', '#40C8E0', 'M6 7h12v13H6ZM9 7V4h6v3M9 11v6M15 11v6', ['packed', 'packing', 'luggage', 'vacation', 'holiday']],
  ['glass', 'Drinks', '#FF6482', 'M6 3h12l-2 8a4 4 0 0 1-8 0ZM12 15v6M8 21h8', ['drinks', 'drinking', 'cocktails', 'bar', 'toast']],
  ['cake', 'Cake', '#FF6482', 'M4 21V12a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9M4 16c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5M3 21h18M12 10V6M12 3v.01', ['cake', 'dessert', 'baked', 'baking']],
  ['tv', 'TV', '#7D7AFF', 'M3 6h18v12H3ZM8 21h8M8 2l4 4 4-4', ['tv', 'show', 'anime', 'binge', 'binged']],
  ['paw', 'Pet', '#A2845E', 'M8 21c-2 0-3-1.5-3-3 0-3 4-6 7-6s7 3 7 6c0 1.5-1 3-3 3-1.5 0-2.5-1-4-1s-2.5 1-4 1Z' + ring(5, 10, 1.8) + ring(9.5, 6, 1.8) + ring(14.5, 6, 1.8) + ring(19, 10, 1.8), ['dog', 'cat', 'pet', 'puppy', 'kitten', 'vet']],
  ['church', 'Faith', '#AC8E68', 'M12 2v5M9.5 4.5h5M6 21V11l6-4 6 4v10M10 21v-4a2 2 0 0 1 4 0v4', ['church', 'mass', 'pray', 'prayed', 'prayer']],
  ['trophy', 'Win', '#FFD60A', 'M8 4h8v5a4 4 0 0 1-8 0ZM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6', ['trophy', 'champion', 'award', 'medal']],
  ['flag', 'Goal', '#FF453A', 'M5 21V4M5 4h11l-2 4 2 4H5', ['goal', 'goals', 'started', 'decided']],
  ['clock', 'Time', '#8E8E93', ring(12, 12, 9) + 'M12 7v5l3 2', ['late', 'early', 'overtime']],
  ['umbrella', 'Umbrella', '#0A84FF', 'M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9ZM12 12v7a2 2 0 0 0 4 0', ['umbrella', 'drizzle']],
  ['key', 'Key', '#FFD60A', ring(7.5, 15.5, 4.5) + 'M10.7 12.3 20 3M17 6l3 3M15 8l2 2', ['keys', 'new place', 'moved in', 'locked']],
  ['crown', 'Crown', '#FFD60A', 'M3 8l4 4 5-7 5 7 4-4-2 11H5Z', ['queen', 'king', 'proud']],
  ['sparkles', 'Magic', '#BF5AF2', 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z', ['magic', 'magical', 'amazing', 'wow', 'surprise', 'surprised']],
];
const BY_KEY = new Map([...MOMENT_ICONS, ...EXTRA_ICONS].map(i => [i[0], i]));
export const momentIcon = key => BY_KEY.get(key) || MOMENT_ICONS[0];

// The icon whose words appear earliest in the text ("Movie night at home" → movie).
// Ties go to the more specific icon; the broad ones ("with", "trip") come last.
export function guessIcon(text) {
  const t = ` ${(text || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ')} `;
  const at = w => { const i = t.indexOf(` ${w} `); return i >= 0 ? i : w.length > 4 ? t.indexOf(` ${w}`) : -1; };
  const order = ['sun', 'love', 'workout', 'health', 'food', 'music', 'learn', 'work', 'rain', 'rest', 'home', 'money', ...EXTRA_ICONS.map(i => i[0]), 'star', 'place', 'people'];
  let best = null, bestAt = Infinity;
  for (const k of order) {
    const pos = Math.min(...momentIcon(k)[4].map(at).filter(x => x >= 0));
    if (pos < bestAt) { best = k; bestAt = pos; }
  }
  return best;
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
        <details class="mo-more" ${EXTRA_ICONS.some(i => i[0] === moment?.icon) ? 'open' : ''}><summary>More icons</summary>
          <div class="mo-grid mini" role="radiogroup" aria-label="More icons">${EXTRA_ICONS.map(([k, label, color]) => `<button type="button" class="mo-pick mini" role="radio" data-icon="${k}" style="--c:${color}" aria-label="${label}" title="${label}">${iconSVG(k, 22)}</button>`).join('')}</div>
        </details>
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
