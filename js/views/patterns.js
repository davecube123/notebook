// Behavioural patterns on a person: "When (situation), she (does this)", plus what helps.
// The if-then form follows Mischel & Shoda's behavioural signatures; "what helps" turns
// each one into a way to relate. Every sighting (from the Log or "Seen again") adds evidence,
// so a hunch seen once is told apart from something reliable.
import { get, save, uid } from '../db.js';
import { esc, today, fmtDay, relDays, haptic } from '../util.js';
import { icon } from '../icons.js';
import { sheet, toast, menu, confirmDialog } from '../ui.js';

const PRONOUNS = { '': null, she: ['she', 'her'], he: ['he', 'him'], they: ['they', 'them'] };
const firstName = p => (p.name || '').trim().split(/\s+/)[0] || 'They';
// How the person is called in a pattern: their first name, or the pronoun chosen on their profile
export const subjectOf = p => PRONOUNS[p.pronoun || '']?.[0] || firstName(p);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

export const LEVELS = [
  [1, 'Seen once', 'A hunch for now'],
  [2, 'A few times', 'Seen 2–3 times'],
  [4, 'Reliable', 'Seen 4 times or more'],
];
export const levelOf = pt => { const n = (pt.seen || []).length; return n >= 4 ? 2 : n >= 2 ? 1 : 0; };
const lastSeenOf = pt => (pt.seen || []).map(s => s.date).sort().at(-1);
const sorted = p => [...(p.patterns || [])].sort((a, b) => levelOf(b) - levelOf(a) || (lastSeenOf(b) || '').localeCompare(lastSeenOf(a) || ''));

const sentence = (p, pt) => `When <b>${esc(pt.when)}</b>, ${esc(subjectOf(p))} <b>${esc(pt.does)}</b>.`;
const plain = (p, pt) => `When ${pt.when}, ${subjectOf(p)} ${pt.does}.`;

function meter(pt, last) {
  const l = levelOf(pt), n = (pt.seen || []).length;
  return `<span class="pt-level l${l}" title="${LEVELS[l][2]}${last ? `, last ${relDays(last)}` : ''}"><span class="pt-dots">${[0, 1, 2].map(i => `<i class="${i <= l ? 'on' : ''}"></i>`).join('')}</span>${LEVELS[l][1]}${n > 1 ? ` · ${n}×` : ''}</span>`;
}

function card(p, pt) {
  const last = lastSeenOf(pt);
  return `<div class="card pad pt-card">
    <p class="pt-line">${sentence(p, pt)}</p>
    ${pt.helps ? `<div class="pt-helps">${icon('check')}<span><em>What helps:</em> ${esc(pt.helps)}</span></div>` : ''}
    <div class="pt-foot">${meter(pt, last)}
      <button class="chip pt-again" data-pat-seen="${pt.id}">${icon('plus')}Seen again</button>
      <button class="icon-btn sm" data-pat-menu="${pt.id}" aria-label="Options">${icon('more')}</button></div>
  </div>`;
}

export function patternsTab(p) {
  const pts = sorted(p), subj = subjectOf(p);
  return `<div class="pt-tab">
    <div class="pt-head"><p class="muted small">Behavioural patterns: what ${esc(subj === firstName(p) ? subj : firstName(p))} tends to do, and when.</p>
      <button class="chip" data-pat-pronoun>${icon('people')}Say “${esc(subj)}”${icon('chevD')}</button></div>
    <form class="card pad pt-form" data-pat-form>
      <label class="pt-field"><span>When</span><input class="input" name="when" maxlength="160" placeholder="${esc(PRONOUNS[p.pronoun || ''] ? PRONOUNS[p.pronoun][0] : firstName(p))} is criticised in front of others" autocomplete="off" aria-label="When (the situation)"></label>
      <label class="pt-field"><span>${esc(cap(subj))}</span><input class="input" name="does" maxlength="160" placeholder="goes quiet, then brings it up days later" autocomplete="off" aria-label="What ${esc(subj)} does"></label>
      <details class="pt-more"><summary>${icon('plus')}What helps <span class="muted">(optional)</span></summary>
        <label class="pt-field"><span>Helps</span><input class="input" name="helps" maxlength="200" placeholder="raise it privately, later that day" autocomplete="off" aria-label="What helps"></label></details>
      <div class="row-end"><button class="btn primary sm">${icon('plus')}Add pattern</button></div>
    </form>
    ${pts.length ? pts.map(pt => card(p, pt)).join('') : `<div class="pt-empty muted small"><p>A pattern is an <b>if–then</b>: a situation, and what this person reliably does in it. Psychologists Walter Mischel and Yuichi Shoda found these “behavioural signatures” predict people better than broad traits do.</p>
      <p>Write what you’ve seen, add what helps, and tap <b>Seen again</b> (or tick it when you log an encounter) each time it happens. A pattern seen once stays a hunch until it repeats.</p></div>`}
  </div>`;
}

// Chips under the Log form: tick the patterns this encounter showed
export function logPatternPicker(p) {
  const pts = sorted(p);
  if (!pts.length) return '';
  return `<div class="pt-pick"><span class="muted small">Did a pattern show up?</span>
    <div class="chip-row wrap">${pts.map(pt => `<button type="button" class="chip" data-pat-pick="${pt.id}" aria-pressed="false">${esc(pt.does.length > 38 ? pt.does.slice(0, 38) + '…' : pt.does)}</button>`).join('')}</div></div>`;
}
export const pickedPatterns = form => [...form.querySelectorAll('[data-pat-pick][aria-pressed="true"]')].map(b => b.dataset.patPick);

// Patterns seen in one Log entry, for the timeline
export function patternsForEncounter(p, intId) {
  const pts = (p.patterns || []).filter(pt => (pt.seen || []).some(s => s.intId === intId));
  return pts.length ? `<div class="pt-seen-in">${pts.map(pt => `<span class="pt-tag">${icon('restore')}${esc(pt.does)}</span>`).join('')}</div>` : '';
}

// Add sightings for a new Log entry
export function addSightings(p, ids, intId, date) {
  if (!ids.length) return p.patterns;
  return (p.patterns || []).map(pt => (ids.includes(pt.id) ? { ...pt, seen: [...(pt.seen || []), { date, intId }] } : pt));
}

function editSheet(p, pt, onSave) {
  sheet({
    title: 'Edit pattern',
    render(body, close) {
      body.innerHTML = `<form class="pt-form" data-pat-edit>
        <label class="pt-field"><span>When</span><input class="input" name="when" value="${esc(pt.when)}" maxlength="160"></label>
        <label class="pt-field"><span>${esc(cap(subjectOf(p)))}</span><input class="input" name="does" value="${esc(pt.does)}" maxlength="160"></label>
        <label class="pt-field"><span>Helps</span><input class="input" name="helps" value="${esc(pt.helps || '')}" maxlength="200" placeholder="optional"></label>
        <div class="row-end"><button type="button" class="btn ghost" data-cancel>Cancel</button><button class="btn primary">Save</button></div></form>`;
      const f = body.querySelector('form');
      body.querySelector('[data-cancel]').onclick = () => close();
      f.onsubmit = e => {
        e.preventDefault();
        if (!f.when.value.trim() || !f.does.value.trim()) { toast('Fill in both “When” and what they do'); return; }
        onSave({ when: f.when.value.trim(), does: f.does.value.trim(), helps: f.helps.value.trim() }); close();
      };
    },
  });
}

// Click and submit handling on the person page; returns true when handled
export function handlePatterns(e, id, redraw) {
  const p = get('people', id);
  const setPatterns = patterns => { save('people', { ...get('people', id), patterns, updated: Date.now() }, { silent: true }); redraw(); };
  const pick = e.target.closest('[data-pat-pick]');
  if (pick) { const on = pick.getAttribute('aria-pressed') !== 'true'; pick.setAttribute('aria-pressed', on); pick.classList.toggle('on', on); haptic(6); return true; }
  const pr = e.target.closest('[data-pat-pronoun]');
  if (pr) {
    const set = v => { save('people', { ...get('people', id), pronoun: v, updated: Date.now() }, { silent: true }); redraw(); };
    menu(pr, [['', `By name (${firstName(p)})`], ['she', 'She / her'], ['he', 'He / him'], ['they', 'They / them']].map(([v, l]) => ({ label: l, checked: (p.pronoun || '') === v, action: () => set(v) })));
    return true;
  }
  const sn = e.target.closest('[data-pat-seen]');
  if (sn) {
    const before = p.patterns, was = levelOf(p.patterns.find(x => x.id === sn.dataset.patSeen));
    const next = p.patterns.map(pt => (pt.id === sn.dataset.patSeen ? { ...pt, seen: [...(pt.seen || []), { date: today() }] } : pt));
    setPatterns(next); haptic(8);
    const now = levelOf(next.find(x => x.id === sn.dataset.patSeen));
    toast(now > was ? `Now: ${LEVELS[now][1].toLowerCase()}` : 'Seen again, today', { action: 'Undo', onAction: () => setPatterns(before) });
    return true;
  }
  const pm = e.target.closest('[data-pat-menu]');
  if (pm) {
    const pt = p.patterns.find(x => x.id === pm.dataset.patMenu);
    menu(pm, [
      { label: 'Edit', icon: 'edit', action: () => editSheet(p, pt, patch => setPatterns(get('people', id).patterns.map(x => (x.id === pt.id ? { ...x, ...patch } : x)))) },
      (pt.seen || []).length > 1 ? { label: 'Remove last sighting', icon: 'undo', action: () => setPatterns(get('people', id).patterns.map(x => (x.id === pt.id ? { ...x, seen: x.seen.slice(0, -1) } : x))) } : null,
      '-',
      { label: 'Delete pattern', icon: 'trash', danger: true, action: async () => { if (await confirmDialog('Delete this pattern and its sightings?')) { const before = get('people', id).patterns; setPatterns(before.filter(x => x.id !== pt.id)); toast('Pattern deleted', { action: 'Undo', onAction: () => setPatterns(before) }); } } },
    ].filter(Boolean));
    return true;
  }
  return false;
}

export function submitPattern(form, id, redraw) {
  const when = form.when.value.trim(), does = form.does.value.trim();
  if (!when || !does) { toast('Fill in both “When” and what they do'); return; }
  const p = get('people', id);
  const pt = { id: uid(), when, does, helps: form.helps.value.trim(), seen: [{ date: today() }], created: Date.now() };
  save('people', { ...p, patterns: [...(p.patterns || []), pt], updated: Date.now() }, { silent: true });
  haptic(); redraw(); toast('Pattern added: seen once');
}

export function patternsText(p) {
  const pts = sorted(p);
  if (!pts.length) return [];
  return ['## Patterns', ...pts.map(pt => `- ${plain(p, pt)}${pt.helps ? ` What helps: ${pt.helps}.` : ''} (${LEVELS[levelOf(pt)][1].toLowerCase()}, ${pt.seen.length}×, last ${fmtDay(lastSeenOf(pt))})`), ''];
}
