// Feelings: frequent check-ins that train affect labelling and emotional granularity,
// plus a bird's-eye view of mood, energy, drive and desire over time.
import { list, get, save, remove, uid, settings } from '../db.js';
import { esc, today, ymd, addDays, parseDay, fmtDay, fmtLongDay, fmtTime, relDays, haptic, weekdayNames } from '../util.js';
import { icon } from '../icons.js';
import { rerender, navigate } from '../router.js';
import { sheet, toast, menu } from '../ui.js';
import { ZONES, ZONE_ORDER, FAMILIES, VOCAB, HEAVY, NEEDS, NEXT_STEP } from './emotions.js';
import { isPerfect } from './habits.js';

const ui = { range: 7 };
const BODY = [['energy', 'Energy', 'Drained', 'Wired'], ['drive', 'Drive', 'Unmotivated', 'Driven'], ['desire', 'Desire', 'None', 'Strong']];

export const moods = () => list('moods').sort((a, b) => a.ts - b.ts);
const moodsOn = day => moods().filter(m => m.date === day);
const lastMood = () => moods().at(-1);

// Position on the Mood Meter: the average of the chosen words' coordinates
function place(words, zone) {
  const pts = words.map(w => VOCAB.get(w) || { x: ZONES[zone].p * 3, y: ZONES[zone].e * 3 });
  const avg = k => Math.round(10 * pts.reduce((s, p) => s + p[k], 0) / pts.length) / 10;
  return { x: avg('x'), y: avg('y') };
}
const zoneOf = m => m.zone || (VOCAB.get(m.words[0])?.zone ?? 'lp');
const dot = zone => `<i class="zone-dot" style="background:${ZONES[zone].color}"></i>`;
const localDT = ts => { const d = new Date(ts); return `${ymd(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

// ---------- zone picker (2 × 2, energy up, pleasant right) ----------
function zoneGrid(selected = null, attr = 'data-zone') {
  return `<div class="zone-grid ${selected ? 'has-sel' : ''}">
    ${ZONE_ORDER.map(z => `<button type="button" class="zone-btn ${selected === z ? 'sel' : ''}" ${attr}="${z}" style="--z:${ZONES[z].color}">
      <b>${ZONES[z].short}</b><span>${ZONES[z].sample}</span></button>`).join('')}
    <span class="zone-axis y">more energy →</span><span class="zone-axis x">more pleasant →</span>
  </div>`;
}

// ---------- check-in sheet ----------
export function checkInSheet({ zone = null, entry = null } = {}) {
  const st = entry
    ? { zone: zoneOf(entry), words: [...entry.words], intensity: entry.intensity || 3, energy: entry.energy ?? null, drive: entry.drive ?? null, desire: entry.desire ?? null, note: entry.note || '', needs: [...(entry.needs || [])], when: localDT(entry.ts) }
    : { zone, words: [], intensity: 3, energy: null, drive: null, desire: null, note: '', needs: [], when: localDT(Date.now()) };
  // carry over body levels from a check-in earlier today, so they're one tap to confirm
  if (!entry) { const prev = moodsOn(today()).at(-1); if (prev) BODY.forEach(([k]) => { st[k] = prev[k] ?? null; }); }
  let q = '', focusWord = null;

  sheet({
    title: entry ? 'Edit check-in' : 'How are you feeling?',
    render(body, close) {
      const draw = () => {
        if (!st.zone) {
          body.innerHTML = `<p class="muted small">First, roughly: how pleasant does it feel, and how much energy is in your body?</p>${zoneGrid(null)}`;
          return;
        }
        const z = ZONES[st.zone];
        body.innerHTML = `
          <div class="feel-zone-row">${dot(st.zone)}<b>${z.name}</b><button type="button" class="link small" data-rezone>Change</button></div>
          <label class="search-field">${icon('search')}<input data-q type="search" placeholder="Find the precise word…" value="${esc(q)}" autocomplete="off"></label>
          <div class="feel-picked">${st.words.length ? st.words.map(w => `<span class="word-chip on" style="--z:${ZONES[VOCAB.get(w)?.zone || st.zone].color}">${esc(w)}<button type="button" data-unpick="${esc(w)}" aria-label="Remove">${icon('x')}</button></span>`).join('') : '<span class="muted small">Pick up to 3 words. The more precise, the better.</span>'}</div>
          <div class="word-def" aria-live="polite">${defLine()}</div>
          <div class="feel-words"></div>
          <div class="feel-more">
            <div class="feel-label">How strong?</div>
            <div class="intensity" role="radiogroup">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="${st.intensity === n}" class="${n <= st.intensity ? 'on' : ''}" data-int="${n}" aria-label="${n} of 5"></button>`).join('')}<span class="muted small">${['', 'A little', 'Some', 'Clearly', 'Strongly', 'Intensely'][st.intensity]}</span></div>
            <div class="feel-label">Body &amp; drive <span class="faint">optional</span></div>
            ${BODY.map(([k, label, lo, hi]) => `<div class="body-row"><span>${label}</span><div class="level" data-level="${k}">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="${st[k] && n <= st[k] ? 'on' : ''}" data-v="${n}" aria-label="${label} ${n} of 5"></button>`).join('')}</div><span class="muted small level-word">${st[k] ? (st[k] <= 2 ? lo : st[k] >= 4 ? hi : 'Medium') : '—'}</span></div>`).join('')}
            <div class="feel-label">What's behind it? <span class="faint">optional</span></div>
            <textarea class="input" data-note rows="2" placeholder="${st.words[0] ? `I feel ${esc(st.words[0])} because…` : 'I feel … because…'}">${esc(st.note)}</textarea>
            <div class="feel-label">What do you need? <span class="faint">optional</span></div>
            <div class="chip-row wrap">${NEEDS.map(n => `<button type="button" class="chip ${st.needs.includes(n) ? 'on' : ''}" data-need="${esc(n)}">${esc(n)}</button>`).join('')}</div>
            <label class="feel-when"><span class="muted small">When</span><input class="input" type="datetime-local" data-when value="${st.when}"></label>
          </div>
          <div class="row-end feel-save"><button type="button" class="btn ghost" data-cancel>Cancel</button><button type="button" class="btn primary" data-save ${st.words.length ? '' : 'disabled'}>${entry ? 'Save' : 'Name it'}</button></div>`;
        drawWords();
      };
      const defLine = () => {
        const w = focusWord || st.words.at(-1);
        const v = w && VOCAB.get(w);
        return v ? `<b>${esc(w)}</b> — ${esc(v.def)}` : w ? `<b>${esc(w)}</b> — your own word` : '<span class="faint">Tap a word to see what it means.</span>';
      };
      const chip = v => `<button type="button" class="word-chip ${st.words.includes(v.word) ? 'on' : ''}" data-word="${esc(v.word)}" style="--z:${ZONES[v.zone].color}">${esc(v.word)}</button>`;
      const drawWords = () => {
        const box = body.querySelector('.feel-words');
        if (!box) return;
        const query = q.trim().toLowerCase();
        if (query) {
          const hits = [...VOCAB.values()].filter(v => v.word.includes(query) || v.def.toLowerCase().includes(query)).slice(0, 18);
          box.innerHTML = `<div class="word-wrap">${hits.map(chip).join('')}
            ${!VOCAB.has(query) ? `<button type="button" class="word-chip own" data-word="${esc(query)}">Use “${esc(query)}”</button>` : ''}</div>`;
          return;
        }
        box.innerHTML = FAMILIES.filter(f => f.zone === st.zone).map(f => `<div class="word-family"><div class="feel-label">${esc(f.name)}</div><div class="word-wrap">${f.words.map(([w]) => chip(VOCAB.get(w))).join('')}</div></div>`).join('');
      };
      draw();

      body.addEventListener('input', e => {
        if (e.target.matches('[data-q]')) { q = e.target.value; drawWords(); }
        if (e.target.matches('[data-note]')) st.note = e.target.value;
        if (e.target.matches('[data-when]')) st.when = e.target.value;
      });
      body.addEventListener('click', e => {
        const t = e.target;
        const zb = t.closest('[data-zone]');
        if (zb) { st.zone = zb.dataset.zone; haptic(5); draw(); setTimeout(() => body.querySelector('[data-q]')?.blur()); return; }
        if (t.closest('[data-rezone]')) { st.zone = null; draw(); return; }
        const w = t.closest('[data-word]');
        if (w) {
          const word = w.dataset.word;
          focusWord = word;
          if (st.words.includes(word)) st.words = st.words.filter(x => x !== word);
          else if (st.words.length < 3) st.words.push(word);
          else toast('Three words is plenty. Remove one to swap it.');
          if (q && st.words.includes(word)) q = '';
          haptic(5);
          const scroll = body.scrollTop; draw(); body.scrollTop = scroll;
          return;
        }
        const un = t.closest('[data-unpick]');
        if (un) { st.words = st.words.filter(x => x !== un.dataset.unpick); focusWord = null; draw(); return; }
        const it = t.closest('[data-int]');
        if (it) { st.intensity = +it.dataset.int; const s = body.scrollTop; draw(); body.scrollTop = s; return; }
        const lv = t.closest('[data-level] button');
        if (lv) { const k = lv.parentElement.dataset.level, v = +lv.dataset.v; st[k] = st[k] === v ? null : v; const s = body.scrollTop; draw(); body.scrollTop = s; return; }
        const nd = t.closest('[data-need]');
        if (nd) { const n = nd.dataset.need; st.needs = st.needs.includes(n) ? st.needs.filter(x => x !== n) : [...st.needs, n]; nd.classList.toggle('on'); return; }
        if (t.closest('[data-cancel]')) return close();
        if (t.closest('[data-save]') && st.words.length) {
          const ts = st.when ? new Date(st.when).getTime() : Date.now();
          const rec = {
            id: entry?.id || uid(), ts, date: ymd(new Date(ts)), zone: VOCAB.get(st.words[0])?.zone || st.zone,
            words: st.words, ...place(st.words, st.zone), intensity: st.intensity,
            energy: st.energy, drive: st.drive, desire: st.desire, note: st.note.trim(), needs: st.needs,
            created: entry?.created || Date.now(),
          };
          save('moods', rec); haptic([10, 40, 10]);
          if (entry) { close(); rerender(); return; }
          reflect(body, close, rec);
        }
      });
    },
    onClose: () => rerender(),
  });
}

// After naming: reflect the words back, plus one small next step for this zone
function reflect(body, close, m) {
  const step = NEXT_STEP[m.zone];
  const heavy = m.intensity >= 4 && m.words.some(w => HEAVY.has(w));
  const usedBefore = new Set(moods().filter(x => x.id !== m.id).flatMap(x => x.words));
  const fresh = m.words.filter(w => !usedBefore.has(w));
  body.innerHTML = `<div class="reflect">
    <div class="reflect-dot" style="--z:${ZONES[m.zone].color}"></div>
    <p class="muted small">You named it</p>
    <h3 class="reflect-words">${m.words.map(esc).join(', ')}</h3>
    <p class="muted">Putting a feeling into precise words tends to take some of its edge off. That's the whole exercise, and you just did it.</p>
    ${fresh.length && moods().length > 1 ? `<p class="reflect-new">${icon('sparkle')}New word${fresh.length > 1 ? 's' : ''} in your vocabulary: <b>${fresh.map(esc).join(', ')}</b></p>` : ''}
    <div class="card pad step-card"><div class="feel-label">${esc(step.title)}</div><p>${esc(step.text)}</p></div>
    ${heavy ? `<div class="card pad care-card"><div class="feel-label">You don't have to carry this alone</div><p>If it feels too heavy, reach out to someone you trust today. In the Philippines you can call the NCMH crisis line at <a href="tel:1553" class="link-inline">1553</a>, free and open 24/7.</p></div>` : ''}
    <button type="button" class="btn primary block" data-done>Done</button>
  </div>`;
  body.querySelector('[data-done]').onclick = () => close();
}

// ---------- Today card ----------
export function feelingsCard() {
  const todays = moodsOn(today());
  const last = lastMood();
  return `<div class="card pad feel-card">
    <div class="card-head"><h3>${icon('heart')}How are you feeling?</h3><a class="link small" href="#/feel">Overview</a></div>
    ${zoneGrid(null, 'data-feel-zone')}
    ${todays.length ? `<div class="feel-today">${todays.map(m => `<button class="word-chip on sm" data-feel-edit="${m.id}" style="--z:${ZONES[zoneOf(m)].color}"><time>${fmtTime(m.ts)}</time> ${esc(m.words.join(', '))}</button>`).join('')}</div>`
      : `<p class="muted small feel-hint">${last ? `Last check-in ${relDays(last.date)}: ${esc(last.words.join(', '))}.` : 'Check in a few times a day. Naming what you feel, precisely, is a skill that grows with practice.'}</p>`}
  </div>`;
}

export function bindFeelings(root) {
  root.addEventListener('click', e => {
    const z = e.target.closest('[data-feel-zone]');
    if (z) return checkInSheet({ zone: z.dataset.feelZone });
    const ed = e.target.closest('[data-feel-edit]');
    if (ed) return entryMenu(ed, get('moods', ed.dataset.feelEdit));
  });
}

function entryMenu(anchor, m) {
  menu(anchor, [
    { label: 'Edit', icon: 'edit', action: () => checkInSheet({ entry: m }) },
    { label: 'Delete', icon: 'trash', danger: true, action: () => { remove('moods', m.id); rerender(); toast('Check-in deleted', { action: 'Undo', onAction: () => { save('moods', m); rerender(); } }); } },
  ]);
}

// ---------- charts ----------
function moodMap(entries) {
  const S = 300, C = S / 2, k = (C - 14) / 5;
  const now = Date.now(), span = ui.range * 864e5;
  const pts = entries.map(m => {
    const age = Math.min(1, (now - m.ts) / span);
    return `<circle cx="${(C + m.x * k).toFixed(1)}" cy="${(C - m.y * k).toFixed(1)}" r="${4 + (m.intensity || 3)}" fill="${ZONES[zoneOf(m)].color}" fill-opacity="${(1 - age * .6).toFixed(2)}" class="mm-dot"><title>${esc(`${fmtDay(m.date)} ${fmtTime(m.ts)} — ${m.words.join(', ')}`)}</title></circle>`;
  }).join('');
  const quad = (z, x, y) => `<rect x="${x}" y="${y}" width="${C - 1}" height="${C - 1}" rx="10" fill="${ZONES[z].color}" fill-opacity=".09"/>`;
  const lab = (t, x, y, a) => `<text x="${x}" y="${y}" text-anchor="${a}" class="mm-label">${t}</text>`;
  return `<svg class="mood-map" viewBox="0 0 ${S} ${S}" role="img" aria-label="Mood map: ${entries.length} check-ins">
    ${quad('hu', 0, 0)}${quad('hp', C + 1, 0)}${quad('lu', 0, C + 1)}${quad('lp', C + 1, C + 1)}
    <line x1="${C}" y1="6" x2="${C}" y2="${S - 6}" class="mm-axis"/><line x1="6" y1="${C}" x2="${S - 6}" y2="${C}" class="mm-axis"/>
    ${pts}
    ${lab('Tense', 10, 20, 'start')}${lab('Charged', S - 10, 20, 'end')}${lab('Low', 10, S - 10, 'start')}${lab('Calm', S - 10, S - 10, 'end')}
  </svg>`;
}

function dailyAvg(entries, key, days) {
  const t = today();
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(t, i - days + 1);
    const vals = entries.filter(m => m.date === d && m[key] != null).map(m => m[key]);
    return { d, v: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
  });
}

// Small single-series line chart (one per measure, so no shared or dual axes)
function spark(series, { min, max, zero = null, fmt = v => v.toFixed(1) }) {
  const W = 300, H = 64, pad = 6, n = series.length;
  const X = i => pad + (i * (W - 2 * pad)) / (n - 1);
  const Y = v => H - pad - ((v - min) / (max - min)) * (H - 2 * pad);
  let path = '', pen = false;
  series.forEach((p, i) => {
    if (p.v == null) { pen = false; return; }
    path += `${pen ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`; pen = true;
  });
  const marks = series.map((p, i) => p.v == null ? '' :
    `<g class="sp-hit"><rect x="${(X(i) - 5).toFixed(1)}" y="0" width="10" height="${H}" fill="transparent"/><circle cx="${X(i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="3"/><title>${esc(`${fmtDay(p.d)}: ${fmt(p.v)}`)}</title></g>`).join('');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img">
    ${zero != null ? `<line x1="0" x2="${W}" y1="${Y(zero)}" y2="${Y(zero)}" class="sp-zero"/>` : ''}
    <path d="${path}" class="sp-line"/>${marks}</svg>`;
}

function trends(entries) {
  const days = 30;
  const rows = [
    ['Mood', dailyAvg(entries, 'x', days), { min: -5, max: 5, zero: 0, fmt: v => (v > 0 ? '+' : '') + v.toFixed(1) }, 'Unpleasant ↔ pleasant'],
    ...BODY.map(([k, label, lo, hi]) => [label, dailyAvg(entries, k, days), { min: 1, max: 5, fmt: v => v.toFixed(1) + ' / 5' }, `${lo} ↔ ${hi}`]),
  ];
  return rows.map(([name, s, opt, hint]) => {
    const vals = s.filter(p => p.v != null);
    if (!vals.length) return `<div class="trend"><div class="trend-head"><b>${name}</b><span class="muted small">no data yet</span></div></div>`;
    const recent = vals.slice(-7), avg = recent.reduce((a, p) => a + p.v, 0) / recent.length;
    return `<div class="trend"><div class="trend-head"><b>${name}</b><span class="muted small">${hint}</span><span class="trend-val">${opt.fmt(avg)}<small> avg, last 7 days logged</small></span></div>${spark(s, opt)}</div>`;
  }).join('');
}

function monthDots() {
  const t = today(), ws = settings().weekStart;
  const startDow = (parseDay(t).getDay() - ws + 7) % 7;
  const start = addDays(t, -28 - startDow);
  const all = moods();
  const cells = [];
  for (let i = 0; i < 35; i++) {
    const d = addDays(start, i);
    const es = all.filter(m => m.date === d);
    cells.push(`<button class="md-cell ${d === t ? 'today' : ''} ${d > t ? 'future' : ''}" data-md-day="${d}" ${d > t ? 'disabled' : ''} aria-label="${fmtLongDay(d)}: ${es.length} check-ins">
      <span class="md-num">${parseDay(d).getDate()}</span>
      <span class="md-dots">${es.slice(0, 6).map(m => dot(zoneOf(m))).join('')}</span></button>`);
  }
  return `<div class="cal-week">${weekdayNames(ws).map(n => `<span>${n}</span>`).join('')}</div><div class="md-grid">${cells.join('')}</div>`;
}

function vocabulary(entries30) {
  const counts = new Map();
  entries30.forEach(m => m.words.forEach(w => counts.set(w, (counts.get(w) || 0) + 1)));
  const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxC = top[0]?.[1] || 1;
  const used = new Set(moods().flatMap(m => m.words));
  // suggest unused words from the zones you visit most; rotates daily
  const zoneCount = {};
  entries30.forEach(m => { zoneCount[zoneOf(m)] = (zoneCount[zoneOf(m)] || 0) + 1; });
  const zones = Object.keys(zoneCount).sort((a, b) => zoneCount[b] - zoneCount[a]);
  const pool = [...VOCAB.values()].filter(v => !used.has(v.word) && (!zones.length || zones.slice(0, 2).includes(v.zone)));
  const seed = Math.floor(parseDay(today()) / 864e5);
  const tryWords = pool.length ? [0, 1, 2].map(i => pool[(seed * 7 + i * 13) % pool.length]).filter((v, i, a) => a.indexOf(v) === i) : [];
  return `
    <div class="vocab-stats"><div><b>${counts.size}</b><span>different words, last 30 days</span></div><div><b>${used.size}</b><span>of ${VOCAB.size} words used, ever</span></div></div>
    ${top.length ? `<div class="top-words">${top.map(([w, c]) => { const z = VOCAB.get(w)?.zone || 'lp'; return `<div class="tw-row"><span class="tw-word">${esc(w)}</span><span class="tw-bar"><i style="width:${(100 * c / maxC).toFixed(0)}%;background:${ZONES[z].color}"></i></span><span class="tw-n">${c}</span></div>`; }).join('')}</div>` : ''}
    ${tryWords.length ? `<div class="feel-label">Words to try</div>${tryWords.map(v => `<div class="try-word">${dot(v.zone)}<b>${esc(v.word)}</b><span class="muted small">${esc(v.def)}</span></div>`).join('')}` : ''}`;
}

// What tends to go with your better days: average mood with vs without each factor
function insights() {
  const byDay = new Map();
  moods().forEach(m => { if (!byDay.has(m.date)) byDay.set(m.date, []); byDay.get(m.date).push(m.x); });
  const days = [...byDay.keys()];
  if (days.length < 7) return `<p class="muted small">After a week of check-ins, this shows what tends to come with your better days: trackers, perfect habit days, your One Thing. Currently ${days.length} day${days.length === 1 ? '' : 's'} logged.</p>`;
  const avgOf = ds => ds.reduce((s, d) => s + byDay.get(d).reduce((a, b) => a + b, 0) / byDay.get(d).length, 0) / ds.length;
  const factors = [];
  list('trackers').forEach(t => {
    const on = new Set(list('events').filter(e => e.trackerId === t.id).map(e => e.date));
    factors.push([`${t.emoji} ${t.name}`, d => on.has(d)]);
  });
  factors.push(['All habits done', d => isPerfect(d)]);
  factors.push(['One Thing done', d => !!get('onething', d)?.done]);
  const rows = factors.map(([name, has]) => {
    const yes = days.filter(has), no = days.filter(d => !has(d));
    if (yes.length < 3 || no.length < 3) return null;
    return { name, diff: avgOf(yes) - avgOf(no), n: yes.length };
  }).filter(r => r && Math.abs(r.diff) >= 0.5).sort((a, b) => b.diff - a.diff).slice(0, 5);
  if (!rows.length) return '<p class="muted small">No clear patterns yet. Keep checking in; they show up over a few weeks.</p>';
  return `<div class="insights">${rows.map(r => `<div class="insight"><span class="ins-diff ${r.diff > 0 ? 'up' : 'down'}">${r.diff > 0 ? '+' : ''}${r.diff.toFixed(1)}</span><span>mood on days with <b>${esc(r.name)}</b> <span class="muted small">(${r.n} days)</span></span></div>`).join('')}</div>
    <p class="muted small">Patterns, not proof. A difference can run either way: good days may lead to the habit as much as the habit to good days.</p>`;
}

function daySheet(day) {
  sheet({
    title: fmtLongDay(day),
    render(body) {
      const es = moodsOn(day);
      body.innerHTML = es.length ? `<div class="card list-card">${es.map(entryRow).join('')}</div>` : '<p class="muted">No check-ins this day.</p>';
      body.addEventListener('click', e => { const r = e.target.closest('[data-entry]'); if (r) entryMenu(r, get('moods', r.dataset.entry)); });
    },
  });
}

const entryRow = m => `<button class="list-row feel-row" data-entry="${m.id}">
  <time class="muted small">${fmtTime(m.ts)}</time>${dot(zoneOf(m))}
  <span class="grow"><b>${esc(m.words.join(', '))}</b>${m.intensity ? ` <span class="muted small">${'●'.repeat(m.intensity)}</span>` : ''}
  ${m.note ? `<span class="feel-note">${esc(m.note)}</span>` : ''}
  ${m.needs?.length ? `<span class="muted small">Needed: ${esc(m.needs.join(', '))}</span>` : ''}</span></button>`;

// ---------- page ----------
export function renderFeelings(main, params, query) {
  if (query.checkin) { navigate('#/feel', { replace: true }); setTimeout(() => checkInSheet()); return; }
  const all = moods();
  const since = addDays(today(), -(ui.range - 1));
  const inRange = all.filter(m => m.date >= since);
  const last30 = all.filter(m => m.date >= addDays(today(), -29));
  const recentDays = [...new Set(all.map(m => m.date))].sort().reverse().slice(0, 7);
  main.innerHTML = `<div class="page feel-page">
    <header class="page-head"><div class="page-title-row"><h1>Feelings</h1>
      <div class="head-actions"><button class="btn primary sm" data-checkin>${icon('plus')}Check in</button></div></div>
      <p class="muted">Name what you feel, precisely, a few times a day.</p></header>

    <div class="card pad">${zoneGrid(null, 'data-feel-zone')}</div>

    ${all.length ? `
    <section class="section"><div class="row-between"><h3 class="group-label">Mood map</h3>
      <div class="seg mini">${[7, 30].map(r => `<button class="${ui.range === r ? 'on' : ''}" data-range="${r}">${r} days</button>`).join('')}</div></div>
      <div class="card pad">${moodMap(inRange)}<p class="muted small center">${inRange.length} check-in${inRange.length === 1 ? '' : 's'}. Bigger dots were stronger, fainter ones are older.</p></div></section>

    <section class="section"><h3 class="group-label">Last 5 weeks</h3><div class="card pad">${monthDots()}</div></section>

    <section class="section"><h3 class="group-label">Trends · 30 days</h3><div class="card pad trends">${trends(all)}</div></section>

    <section class="section"><h3 class="group-label">Your emotional vocabulary</h3><div class="card pad">${vocabulary(last30)}</div></section>

    <section class="section"><h3 class="group-label">What goes with your good days</h3><div class="card pad">${insights()}</div></section>

    <section class="section"><h3 class="group-label">Recent check-ins</h3>
      ${recentDays.map(d => `<h4 class="sub-label">${fmtDay(d)} · ${relDays(d)}</h4><div class="card list-card">${all.filter(m => m.date === d).map(entryRow).join('')}</div>`).join('')}
    </section>` : `<div class="empty">${icon('heart', 'empty-ic')}<h3>Your first check-in</h3><p>Pick the zone that fits, then the most precise word you can find. Over time you'll see your moods, energy, drive and desire from above.</p></div>`}

    <details class="card pad why"><summary><b>Why this helps</b></summary>
      <p><b>Naming a feeling softens it.</b> In studies of “affect labelling”, putting feelings into words reduced activity in the brain's threat response and made emotions feel less intense. Therapists call it “name it to tame it”.</p>
      <p><b>Precision matters.</b> People who tell apart irritated, resentful and disappointed (high “emotional granularity”) tend to regulate emotions better and reach less for drinking or lashing out under stress.</p>
      <p><b>Patterns become visible.</b> Logging energy, drive and desire next to your emotions shows what your good days have in common, so you can do more of it.</p>
      <p class="muted small">This is a self-awareness tool, not a diagnosis or a substitute for professional care.</p>
    </details>
  </div>`;
  const page = main.querySelector('.page');
  bindFeelings(page);
  page.addEventListener('click', e => {
    if (e.target.closest('[data-checkin]')) return checkInSheet();
    const r = e.target.closest('[data-range]');
    if (r) { ui.range = +r.dataset.range; return rerender(); }
    const d = e.target.closest('[data-md-day]');
    if (d) return daySheet(d.dataset.mdDay);
    const en = e.target.closest('[data-entry]');
    if (en) return entryMenu(en, get('moods', en.dataset.entry));
  });
}

// Calendar day panel line
export function feelingsLine(day) {
  const es = moodsOn(day);
  if (!es.length) return '';
  return `<a class="day-line" href="#/feel">${icon('heart')}<span class="feel-line">${es.map(m => `${dot(zoneOf(m))}${esc(m.words.join(', '))}`).join('<span class="faint"> · </span>')}</span>${icon('chevR', 'day-chev')}</a>`;
}
