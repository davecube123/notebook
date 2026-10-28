// Personality reading for a person: four lenses, each explained as you fill it in,
// each with a short guide on how to relate to them.
//   Big Five (Costa & McCrae) · Temperament (Keirsey, Please Understand Me II) ·
//   Enneagram core desire / fear / passion (Riso & Hudson; Ichazo, Naranjo) · Zodiac sun sign.
import { get, save } from '../db.js';
import { esc, haptic } from '../util.js';
import { icon } from '../icons.js';
import { sheet, toast } from '../ui.js';
import {
  TRAITS, LEVEL, traitsOf, TEMPERAMENTS, VARIANTS, QUESTIONS, resolveKeirsey, keirseyOf,
  ENNEA, ENNEA_PARTS, enneaOf, enneaVerdict, ENNEA_TEST, resolveEnnea, enneaNeighbours,
  ZODIAC, signFor, nearCusp, TRAIT_RELATE, TEMP_RELATE, ENNEA_RELATE, FACETS, ENNEA_PROFILE, CENTERS,
} from './typology-data.js';

const info = (summary, body) => `<details class="ty-info"><summary>${icon('info')}${summary}</summary><div>${body}</div></details>`;
const card = (title, sub, body) => `<section class="prop-section"><h3 class="group-label">${title}${sub ? `<span class="count">${sub}</span>` : ''}</h3><div class="card pad ty-card">${body}</div></section>`;
const scale5 = (attr, k, v, label) => `<div class="ty-scale" role="radiogroup" aria-label="${esc(label)}">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="${v === n}" class="${v === n ? 'on' : ''}" ${attr}="${k}" data-v="${n}">${n}</button>`).join('')}</div>`;
const disclaimer = html => `<p class="ty-disclaimer">${icon('info')}<span>${html}</span></p>`;
// rows: [[label or '', do, don't], …]
const relate = (name, rows) => rows.length ? `<div class="ty-relate"><div class="feel-label">How to relate to ${esc(name)}</div>
  ${rows.map(([l, d, n]) => `${l ? `<div class="ty-relate-for">${l}</div>` : ''}<div class="ty-do">${icon('check')}<span>${esc(d)}</span></div><div class="ty-dont">${icon('x')}<span>${esc(n)}</span></div>`).join('')}</div>` : '';

export const zodiacOf = p => ZODIAC.find(z => z[0] === p.zodiac) || signFor(p.fields?.birthday) || null;

export function personalityTab(p) {
  const first = p.name.split(/\s+/)[0];
  const fc = p.facets || {};
  const tr = traitsOf(p), kv = keirseyOf(p), en = enneaOf(p), zs = zodiacOf(p);
  const filled = [Object.keys(tr).length === 5, !!kv, !!(en.desire || en.fear || en.passion), !!zs].filter(Boolean).length;

  // Big Five
  const big5 = TRAITS.map(t => {
    const v = tr[t.k];
    const desc = !v ? '<span class="faint">Not rated</span>' : v <= 2 ? `<b>${LEVEL[v]}:</b> ${t.low}` : v >= 4 ? `<b>${LEVEL[v]}:</b> ${t.high}` : '<b>Average:</b> a mix of both, depending on the situation';
    return `<div class="ty-trait"><div class="ty-trait-head"><b>${t.name}</b>${t.alt ? `<span class="faint small">${t.alt}</span>` : ''}</div>
      ${scale5('data-trait', t.k, v, t.name)}<div class="ty-desc small">${desc}</div>
      ${info('What to look for', `<p>${esc(t.what)}</p><p><b>High:</b> ${esc(t.high)}.<br><b>Low:</b> ${esc(t.low)}.</p><p class="muted">${esc(t.look)}</p>`)}
      ${facetsHTML(t, fc, v)}</div>`;
  }).join('');
  const b5relate = relate(first, TRAITS.filter(t => tr[t.k] && tr[t.k] !== 3).map(t => [`${tr[t.k] > 3 ? 'High' : 'Low'} ${t.name.toLowerCase()}`, ...TRAIT_RELATE[t.k][tr[t.k] > 3 ? 'hi' : 'lo']]));

  // Temperament
  const temp = kv && TEMPERAMENTS[kv[1]];
  const keirsey = kv ? `<div class="ty-result"><div class="ty-big">${esc(kv[3])} <span class="faint">${kv[0]}</span></div>
      <div class="chip-row wrap"><span class="ty-pill">${temp.name}</span><span class="ty-pill">${kv[2]}</span><span class="ty-pill">${temp.words} · ${temp.tools}</span></div>
      <p>${esc(kv[4])}</p><p class="muted small"><b>${temp.name}s</b> seek ${esc(temp.core.charAt(0).toLowerCase() + temp.core.slice(1))}</p>
      <p class="muted small"><b>Needs:</b> ${esc(temp.needs)}. <b>Stressed by:</b> ${esc(temp.stress)}.</p></div>
      ${relate(first, [['', ...TEMP_RELATE[kv[1]]]])}
      <div class="row-end"><button class="btn ghost sm" data-ty="keirsey-clear">Clear</button><button class="btn ghost sm" data-ty="keirsey">Re-type</button></div>`
    : `<p class="muted small">Answer 4 questions about how they talk and act, and the type is worked out for you.</p><button class="btn primary sm" data-ty="keirsey">Find their type</button>`;

  // Enneagram
  const ennN = enneaLead(en);
  const ennea = `${!(en.desire || en.fear || en.passion) ? `<p class="muted small">Answer 2 questions to find their likely type, or pick the desire, fear and passion one by one below.</p><button class="btn primary sm" data-ty="ennea-test">Take the 2-question test</button>` : ''}
    ${ENNEA_PARTS.map(([k, label, idx, hint]) => { const n = en[k]; return `<button class="ty-pick" data-ty="ennea" data-part="${k}"><span class="ty-pick-label">${label}</span><span class="ty-pick-val">${n ? esc(ENNEA[n - 1][idx]) : `<span class="faint">${hint}</span>`}</span>${icon('chevR')}</button>`; }).join('')}
    ${enneaVerdict(en) ? `<p class="ty-verdict">${enneaVerdict(en)}</p>` : ''}
    ${ennN ? enneaProfileHTML(ennN, p.enneaWing) + relate(first, [['', ...ENNEA_RELATE[ennN]]]) : ''}
    ${en.desire || en.fear || en.passion ? '<div class="row-end"><button class="btn ghost sm" data-ty="ennea-test">Re-test</button></div>' : ''}`;

  // Zodiac
  const fromBday = !p.zodiac && zs;
  const zodiac = zs ? `<div class="ty-result"><div class="ty-big">${zs[2]} ${zs[1]}</div>
      <div class="chip-row wrap"><span class="ty-pill">${zs[4]}</span><span class="ty-pill">${zs[5]}</span>${fromBday ? '<span class="ty-pill">from birthday</span>' : ''}</div>
      <p>${esc(zs[6])}</p>${fromBday && nearCusp(p.fields.birthday) ? '<p class="muted small">Born on a cusp: depending on the year they may be the neighbouring sign. Tap Change to set it.</p>' : ''}</div>
      ${relate(first, [['', zs[7], zs[8]]])}
      <div class="row-end">${p.zodiac ? '<button class="btn ghost sm" data-ty="zodiac-clear">Use birthday</button>' : ''}<button class="btn ghost sm" data-ty="zodiac">Change</button></div>`
    : `<p class="muted small">Pick their sign; each one shows its birthday dates.</p><button class="btn primary sm" data-ty="zodiac">Pick sign</button>`;

  return `
    <p class="muted small pad-x ty-intro">Your read of ${esc(first)}, ${filled}/4 lenses filled. Tap <b>ⓘ</b> to learn what to look for. These are impressions to refine over time, not diagnoses.</p>
    ${card('Big Five traits', Object.keys(tr).length ? `${Object.keys(tr).length}/5` : '', big5 + b5relate + info('About the Big Five', '<p>The most researched model of personality (Costa &amp; McCrae). Each trait is a spectrum; most people sit near the middle. Each also splits into six <b>facets</b> (the NEO PI-R’s 30), which show where within a trait someone stands out: two people with the same Extraversion can differ a lot in Warmth versus Excitement seeking. Ratings by people who know someone well are valid and add to what they would say about themselves (Vazire, 2010).</p>'))}
    ${card('Temperament', 'Please Understand Me II', keirsey + info('About Keirsey’s temperaments', '<p>David Keirsey sorts people by two things you can observe: what they talk about (<b>concrete</b> vs <b>abstract</b>) and how they pursue goals (<b>cooperative</b> vs <b>utilitarian</b>). That gives four temperaments: Artisan, Guardian, Idealist and Rational. Each splits into two roles and four of the 16 types (e.g. Champion = ENFP).</p><p class="muted">Popular and practical, but with weaker scientific support than the Big Five. Treat it as a lens.</p>'))}
    ${card('Enneagram core', '', ennea + info('About the Enneagram core', '<p>Each of the nine types is driven by a <b>core desire</b>, defended against a <b>core fear</b> (Riso &amp; Hudson), and has a <b>passion</b>, the “sin” or emotional habit that takes over (Ichazo, Naranjo). Picking them separately lets you notice when someone does not fit one type neatly.</p><p>The quick test crosses two groupings Riso &amp; Hudson use in their QUEST sorter: how someone goes after what they want, and how they react when things go wrong. Each pair points to one type.</p><p class="muted">A reflection tool with little scientific validation.</p>'))}
    ${card('Zodiac', '', zodiac + disclaimer('Astrology has <b>no scientific support</b>. In a double-blind test, astrologers could not match birth charts to personality profiles better than chance (Carlson, <i>Nature</i>, 1985), and large studies find no link between sun sign and personality. Use it as a fun conversation lens, and because it matters to people who believe in it.'))}
    <details class="card pad why"><summary><b>Sources</b></summary>
      <p>Costa, P. &amp; McCrae, R. (1992). <i>NEO PI-R Professional Manual.</i> · Vazire, S. (2010). Who knows what about a person? <i>J. Personality &amp; Social Psychology.</i></p>
      <p>Keirsey, D. (1998). <i>Please Understand Me II.</i></p>
      <p>The Enneagram Institute, type descriptions (enneagraminstitute.com). · Riso, D. &amp; Hudson, R. (1996). <i>Personality Types</i> (rev. ed.). · Riso, D. &amp; Hudson, R. (1999). <i>The Wisdom of the Enneagram</i> (includes the QUEST). · Naranjo, C. (1994). <i>Character and Neurosis.</i> · Palmer, H. (1988). <i>The Enneagram.</i></p>
      <p>Carlson, S. (1985). A double-blind test of astrology. <i>Nature</i> 318.</p>
    </details>`;
}

// The six NEO PI-R facets under a trait. Which groups are open survives redraws.
const openFacets = new Set();
function facetsHTML(t, fc, cur) {
  const rated = FACETS[t.k].filter(f => fc[f[0]]);
  const avg = rated.length ? rated.reduce((s, f) => s + fc[f[0]], 0) / rated.length : null;
  return `<details class="ty-facets" data-facets="${t.k}" ${openFacets.has(t.k) ? 'open' : ''}><summary>${icon('chevR')}<span>6 facets${rated.length ? ` · ${rated.length} rated · average ${avg.toFixed(1)}` : ''}</span></summary>
    ${FACETS[t.k].map(([c, name, hi, lo]) => { const v = fc[c]; return `<div class="ty-facet"><div class="ty-facet-head"><b>${esc(name)}</b>${scale5('data-facet', c, v, name)}</div>
      <div class="ty-desc small">${!v ? `<span class="muted">High: ${esc(hi)}. Low: ${esc(lo)}.</span>` : v === 3 ? '<b>Average</b>' : `<b>${LEVEL[v]}:</b> ${esc(v > 3 ? hi : lo)}`}</div></div>`; }).join('')}
    ${rated.length >= 3 && Math.round(avg) !== cur ? `<button class="link small" data-trait="${t.k}" data-v="${Math.round(avg)}">Set ${esc(t.name)} to ${Math.round(avg)}, the facet average</button>` : ''}
  </details>`;
}

// Full Riso & Hudson profile of the lead type, with the wing you choose
function enneaProfileHTML(n, wing) {
  const t = ENNEA_PROFILE[n], c = CENTERS[t.center], name = x => `Type ${x}, ${ENNEA[x - 1][1]}`;
  const w = t.wings[wing] ? wing : null;
  const groups = ENNEA_TEST.map(q => q.opts.find(o => o[3].includes(n))[1]);
  return `<div class="ty-profile">
    <div class="ty-big">Type ${n} <span class="faint">${esc(ENNEA[n - 1][1])}${w ? ` · ${n}w${w}` : ''}</span></div>
    <p class="muted small">${esc(t.kind)}: ${esc(t.brief.toLowerCase())}</p>
    <div class="chip-row wrap"><span class="ty-pill">${c[0]} · ${c[1]}</span><span class="ty-pill">${esc(groups[0])}</span><span class="ty-pill">${esc(groups[1])}</span></div>
    <div class="feel-label">Wing</div>
    <div class="chip-row wrap">${Object.entries(t.wings).map(([k, l]) => `<button class="chip ${+k === w ? 'on' : ''}" data-ty="ennea-wing" data-wing="${k}">${n}w${k} · ${esc(l)}</button>`).join('')}</div>
    <p class="muted small">${w ? `${esc(t.wings[w])}: their type ${n} is coloured by type ${w} (${esc(ENNEA[w - 1][1])}): ${esc(ENNEA_PROFILE[w].brief.toLowerCase())}.` : 'The neighbouring type that colours theirs. Pick one if you can tell.'}</p>
    <dl class="ty-facts">
      <dt>Key motivations</dt><dd>${esc(t.motives)}</dd>
      <dt>At their best</dt><dd>${esc(t.healthy)}</dd>
      <dt>Day to day</dt><dd>${esc(t.average)}</dd>
      <dt>At their worst</dt><dd>${esc(t.unhealthy)}</dd>
      <dt>Under stress → ${name(t.stress[0])}</dt><dd>${esc(t.stress[1].charAt(0).toUpperCase() + t.stress[1].slice(1))}.</dd>
      <dt>In growth → ${name(t.growth[0])}</dt><dd>${esc(t.growth[1].charAt(0).toUpperCase() + t.growth[1].slice(1))}.</dd>
      <dt>Passion → Virtue</dt><dd>${esc(ENNEA[n - 1][4])} → ${esc(t.virtue)}</dd>
      <dt>Fixation</dt><dd>${esc(t.fixation)}</dd>
      <dt>Typical defence</dt><dd>${esc(t.defense)}</dd>
    </dl>
    ${info('What these mean', `<p><b>Centre:</b> ${esc(c[2])}</p><p><b>Wing:</b> one of the two neighbouring types on the circle, which adds its flavour.</p><p><b>Stress and growth:</b> under pressure people tend to take on the average traits of one type; as they mature they take on the healthy traits of another (Riso &amp; Hudson’s directions of disintegration and integration).</p><p><b>Best, day to day, worst:</b> condensed from Riso &amp; Hudson’s nine Levels of Development.</p><p><b>Passion → virtue:</b> the emotional habit, and the quality that replaces it as they grow (Ichazo, Naranjo). <b>Fixation</b> is the matching habit of mind.</p>`)}
  </div>`;
}

// the type most of the three parts point to (fear breaks ties)
function enneaLead(e) {
  const picks = ENNEA_PARTS.map(([k]) => e[k]).filter(Boolean);
  if (!picks.length) return null;
  const counts = picks.reduce((m, n) => m.set(n, (m.get(n) || 0) + 1), new Map());
  const top = Math.max(...counts.values());
  return top > 1 || picks.length === 1 ? [...counts].find(([, c]) => c === top)[0] : e.fear || null;
}

// ---------- interaction ----------
// Returns true when the click was handled. `redraw` re-renders the person page.
export function handlePersonality(e, id, redraw) {
  const p = () => get('people', id);
  const put = patch => save('people', { ...p(), ...patch, updated: Date.now() }, { silent: true });
  const undoable = (msg, patch) => { const prev = Object.fromEntries(Object.keys(patch).map(k => [k, p()[k]])); put(patch); redraw(); toast(msg, { action: 'Undo', onAction: () => { put(prev); redraw(); } }); };
  const fs = e.target.closest('.ty-facets > summary');
  if (fs) { const k = fs.parentElement.dataset.facets; openFacets.has(k) ? openFacets.delete(k) : openFacets.add(k); return true; } // native toggle still runs
  const fb = e.target.closest('[data-facet]');
  if (fb) { const fc = { ...(p().facets || {}) }, k = fb.dataset.facet, v = +fb.dataset.v; fc[k] === v ? delete fc[k] : fc[k] = v; put({ facets: fc }); haptic(5); redraw(); return true; }
  const tb = e.target.closest('[data-trait]');
  if (tb) { const tr = { ...traitsOf(p()) }, k = tb.dataset.trait, v = +tb.dataset.v; tr[k] === v ? delete tr[k] : tr[k] = v; put({ traits: tr }); haptic(5); redraw(); return true; }
  const b = e.target.closest('[data-ty]');
  if (!b) return false;
  const act = b.dataset.ty;
  if (act === 'keirsey') keirseySheet(p(), code => { put({ keirsey: code }); redraw(); });
  if (act === 'keirsey-clear') { const prev = keirseyOf(p())?.[0]; put({ keirsey: null, fields: { ...p().fields, mbti: '' } }); redraw(); toast('Cleared', { action: 'Undo', onAction: () => { put({ keirsey: prev }); redraw(); } }); }
  if (act === 'ennea') enneaSheet(p(), b.dataset.part, n => { put({ enneagram: { ...enneaOf(p()), [b.dataset.part]: n } }); redraw(); });
  if (act === 'ennea-wing') { const w = +b.dataset.wing; put({ enneaWing: p().enneaWing === w ? null : w }); redraw(); }
  if (act === 'ennea-test') enneaTestSheet(p(), n => { put({ enneagram: { desire: n, fear: n, passion: n } }); redraw(); });
  if (act === 'zodiac') zodiacSheet(p(), k => { put({ zodiac: k }); redraw(); });
  if (act === 'zodiac-clear') undoable('Using their birthday', { zodiac: null });
  return true;
}

const firstName = p => p.name.split(/\s+/)[0];
const steps = (n, at) => `<div class="ty-steps">${Array.from({ length: n }, (_, i) => `<i class="${i <= at ? 'on' : ''}"></i>`).join('')}</div>`;

function keirseySheet(p, done) {
  const ans = {};
  let step = 0;
  sheet({
    title: `${firstName(p)}’s temperament`,
    render(body, close) {
      const draw = () => {
        const result = resolveKeirsey(ans);
        if (step >= QUESTIONS.length && result) {
          const t = TEMPERAMENTS[result[1]];
          body.innerHTML = `<div class="ty-result center"><p class="muted small">From your answers</p><div class="ty-big">${esc(result[3])} <span class="faint">${result[0]}</span></div>
            <p><b>${t.name}</b> · ${esc(result[2])}</p><p>${esc(result[4])}</p><p class="muted small">${esc(t.core)}</p></div>
            <div class="row-end"><button class="btn ghost" data-redo>Start over</button><button class="btn primary" data-save>Save</button></div>`;
          body.querySelector('[data-save]').onclick = () => { done(result[0]); close(); toast(`Saved: ${result[3]} (${result[0]})`); };
          body.querySelector('[data-redo]').onclick = () => { step = 0; Object.keys(ans).forEach(k => delete ans[k]); draw(); };
          return;
        }
        const q = QUESTIONS[step];
        body.innerHTML = `${steps(QUESTIONS.length, step)}
          <h3 class="ty-q">${esc(q.q)}</h3><p class="muted small">${esc(q.why)}</p>
          ${[q.a, q.b].map(([v, l, d]) => `<button class="ty-option ${ans[q.id] === v ? 'sel' : ''}" data-answer="${v}"><b>${l}</b><span>${esc(d)}</span></button>`).join('')}
          <div class="row-between">${step ? '<button class="btn ghost sm" data-back>Back</button>' : '<span></span>'}<button class="link small" data-direct>I already know their type</button></div>`;
      };
      draw();
      body.addEventListener('click', e => {
        const a = e.target.closest('[data-answer]');
        if (a) { ans[QUESTIONS[step].id] = a.dataset.answer; step++; haptic(5); draw(); return; }
        if (e.target.closest('[data-back]')) { step = Math.max(0, step - 1); draw(); return; }
        if (e.target.closest('[data-direct]')) {
          body.innerHTML = Object.entries(TEMPERAMENTS).map(([k, t]) => `<div class="feel-label">${t.name}</div><div class="ty-grid">${VARIANTS.filter(v => v[1] === k).map(v => `<button class="ty-option compact" data-code="${v[0]}"><b>${v[3]}</b><span>${v[0]} · ${v[2]}</span></button>`).join('')}</div>`).join('');
          return;
        }
        const c = e.target.closest('[data-code]');
        if (c) { const v = VARIANTS.find(x => x[0] === c.dataset.code); done(v[0]); close(); toast(`Saved: ${v[3]} (${v[0]})`); }
      });
    },
  });
}

function enneaTestSheet(p, done) {
  const ans = {};
  let step = 0, shown = null;
  sheet({
    title: `${firstName(p)}’s Enneagram`,
    render(body, close) {
      const draw = () => {
        if (step >= ENNEA_TEST.length) {
          const n = shown || resolveEnnea(ans), row = ENNEA[n - 1];
          body.innerHTML = `<div class="ty-result center"><p class="muted small">${shown ? 'Alternative' : 'From your answers'}</p><div class="ty-big">Type ${n} <span class="faint">${esc(row[1])}</span></div></div>
            <div class="ty-card">${ENNEA_PARTS.map(([, l, i]) => `<div class="ty-pick static"><span class="ty-pick-label">${l}</span><span class="ty-pick-val">${esc(row[i])}</span></div>`).join('')}</div>
            <p class="muted small">Check the core fear: it’s usually the most telling. If it doesn’t ring true, try a neighbour with the same social style:</p>
            <div class="chip-row wrap">${[resolveEnnea(ans), ...enneaNeighbours(resolveEnnea(ans))].filter(x => x !== n).map(x => `<button class="chip" data-alt="${x}">Type ${x} · ${esc(ENNEA[x - 1][1])}</button>`).join('')}</div>
            <div class="row-end"><button class="btn ghost" data-redo>Start over</button><button class="btn primary" data-save="${n}">Save</button></div>`;
          return;
        }
        const q = ENNEA_TEST[step];
        body.innerHTML = `${steps(ENNEA_TEST.length, step)}
          <h3 class="ty-q">${esc(q.q)}</h3><p class="muted small">${esc(q.why)}</p>
          ${q.opts.map(([v, l, d]) => `<button class="ty-option ${ans[q.id] === v ? 'sel' : ''}" data-answer="${v}"><b>${l}</b><span>${esc(d)}</span></button>`).join('')}
          ${step ? '<div class="row-between"><button class="btn ghost sm" data-back>Back</button><span></span></div>' : ''}`;
      };
      draw();
      body.addEventListener('click', e => {
        const a = e.target.closest('[data-answer]');
        if (a) { ans[ENNEA_TEST[step].id] = a.dataset.answer; step++; shown = null; haptic(5); draw(); return; }
        if (e.target.closest('[data-back]')) { step = Math.max(0, step - 1); draw(); return; }
        const alt = e.target.closest('[data-alt]');
        if (alt) { shown = +alt.dataset.alt; draw(); return; }
        if (e.target.closest('[data-redo]')) { step = 0; shown = null; Object.keys(ans).forEach(k => delete ans[k]); draw(); return; }
        const s = e.target.closest('[data-save]');
        if (s) { const n = +s.dataset.save; done(n); close(); toast(`Saved: Type ${n}, ${ENNEA[n - 1][1]}`); }
      });
    },
  });
}

function enneaSheet(p, part, done) {
  const [, label, idx, hint] = ENNEA_PARTS.find(x => x[0] === part);
  const cur = enneaOf(p)[part];
  sheet({
    title: label,
    render(body, close) {
      body.innerHTML = `<p class="muted small">${esc(hint)} Pick the one that fits best${part === 'passion' ? '' : ', even if they would never say it out loud'}.</p>
        ${ENNEA.map(row => `<button class="ty-option ${cur === row[0] ? 'sel' : ''}" data-n="${row[0]}"><b>${esc(row[idx])}</b>${part === 'passion' ? `<span>${esc(row[5])}</span>` : ''}<span class="faint small">Type ${row[0]} · ${row[1]}</span></button>`).join('')}
        ${cur ? '<button class="btn ghost block" data-clear>Not sure, clear it</button>' : ''}`;
      body.addEventListener('click', e => {
        const b = e.target.closest('[data-n]');
        if (b) { done(+b.dataset.n); close(); return; }
        if (e.target.closest('[data-clear]')) { done(null); close(); }
      });
    },
  });
}

function zodiacSheet(p, done) {
  const cur = zodiacOf(p)?.[0];
  sheet({
    title: 'Zodiac sign',
    render(body, close) {
      const order = [...ZODIAC.slice(3), ...ZODIAC.slice(0, 3)]; // Aries first, as usual
      const range = i => { const z = order[i], next = order[(i + 1) % 12]; const d = new Date(`2001-${next[3]}T12:00`); d.setDate(d.getDate() - 1); return `${fmtMD(z[3])} – ${fmtMD(`${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)}`; };
      body.innerHTML = `<div class="ty-grid">${order.map((z, i) => `<button class="ty-option compact ${cur === z[0] ? 'sel' : ''}" data-sign="${z[0]}"><b>${z[2]} ${z[1]}</b><span>${range(i)}</span></button>`).join('')}</div>`;
      body.addEventListener('click', e => { const b = e.target.closest('[data-sign]'); if (b) { done(b.dataset.sign); close(); } });
    },
  });
}
const fmtMD = md => new Date(`2001-${md}T12:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// Plain-text version for export
export function personalityText(p) {
  const out = [];
  const tr = traitsOf(p);
  const fc = p.facets || {};
  const b5 = TRAITS.filter(t => tr[t.k] || FACETS[t.k].some(f => fc[f[0]])).flatMap(t => [
    `- ${t.name}: ${tr[t.k] ? `${tr[t.k]}/5 (${LEVEL[tr[t.k]]})` : 'not rated'}`,
    ...FACETS[t.k].filter(f => fc[f[0]]).map(f => `  - ${f[1]}: ${fc[f[0]]}/5`)]);
  if (b5.length) out.push('## Big Five', ...b5, '');
  const kv = keirseyOf(p);
  if (kv) out.push('## Temperament', `${kv[3]} (${kv[0]}), ${TEMPERAMENTS[kv[1]].name} ${kv[2]}`, '');
  const en = enneaOf(p);
  if (en.desire || en.fear || en.passion) {
    const n = enneaLead(en), t = n && ENNEA_PROFILE[n], w = t?.wings[p.enneaWing] ? p.enneaWing : null;
    out.push('## Enneagram', ...(t ? [`Type ${n}, ${ENNEA[n - 1][1]}${w ? ` (${n}w${w}, ${t.wings[w]})` : ''}: ${t.brief}`] : []),
      ...ENNEA_PARTS.filter(([k]) => en[k]).map(([k, l, i]) => `- ${l}: ${ENNEA[en[k] - 1][i]} (type ${en[k]})`),
      ...(t ? [`- Under stress → type ${t.stress[0]}: ${t.stress[1]}`, `- In growth → type ${t.growth[0]}: ${t.growth[1]}`] : []), '');
  }
  const zs = zodiacOf(p);
  if (zs) out.push('## Zodiac', `${zs[2]} ${zs[1]} (${zs[4]}, ${zs[5]})`, '');
  return out;
}
