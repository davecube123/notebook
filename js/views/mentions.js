// People ↔ notes. A mention stores the person's id, never just a name, so two people
// called "Diane" stay apart. Plain-text name matches are offered as "possibly about"
// suggestions until you link them or say "not them".
import { list, get, save, uid } from '../db.js';
import { esc, fmtDay, ymd, snippet } from '../util.js';
import { toast } from '../ui.js';
import { navigate } from '../router.js';

const norm = s => (s || '').trim().toLowerCase();

// Names a person may be written as: full name, first name, nicknames
export function nameTerms(p) {
  const full = norm(p.name);
  const first = full.split(/\s+/)[0];
  const nicks = (p.fields?.nickname || '').split(/[,/]/).map(norm).filter(n => n.length >= 2);
  return [...new Set([full, first.length >= 3 ? first : null, ...nicks].filter(Boolean))];
}

// Other people who share a name or first name with p
export function namesakes(p) {
  const mine = new Set(nameTerms(p));
  return list('people').filter(q => q.id !== p.id && nameTerms(q).some(t => mine.has(t)));
}

// A short line that tells people apart in pickers and suggestions
export function personLine(p) {
  const bits = [p.summary, p.fields?.occupation, p.circle].filter(Boolean);
  return bits[0] || `Added ${fmtDay(ymd(new Date(p.created || Date.now())), { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export const peopleOf = n => [...new Set([...(n.people || []), ...(n.linkedPeople || [])])];
const liveNotes = () => list('notes').filter(n => !n.trashed && !(n.draft && !n.text));

const termRegex = terms => new RegExp(`(^|[^\\p{L}\\p{N}])(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?=$|[^\\p{L}\\p{N}])`, 'iu');

// Notes linked to this person (by @mention or by tapping Link)
export function notesAbout(p) {
  return liveNotes().filter(n => peopleOf(n).includes(p.id)).sort((a, b) => b.created - a.created);
}

// Notes that contain the person's name but aren't linked yet. A note already linked to a
// namesake counts as resolved to them; "not them" choices are remembered on the person.
export function possibleNotes(p) {
  const terms = nameTerms(p);
  if (!terms.length) return [];
  const re = termRegex(terms);
  const mine = new Set(terms);
  const sakes = namesakes(p);
  const notThem = new Set(p.notNotes || []);
  return liveNotes().filter(n => {
    const linked = peopleOf(n);
    if (linked.includes(p.id) || notThem.has(n.id)) return false;
    if (linked.some(id => { const q = get('people', id); return q && nameTerms(q).some(t => mine.has(t)); })) return false;
    return re.test(`${n.title || ''}\n${n.text || ''}`);
  }).map(n => ({ note: n, also: sakes.filter(q => termRegex(nameTerms(q)).test(`${n.title || ''}\n${n.text || ''}`) && !(q.notNotes || []).includes(n.id)) }))
    .sort((a, b) => b.note.created - a.note.created);
}

// The words around the first mention, for previews
export function contextFor(n, p) {
  const text = (n.text || '').replace(/\s+/g, ' ');
  const m = text.match(termRegex(nameTerms(p))) || text.match(new RegExp(`@${(p.name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
  return snippet(text, m ? m[0].trim().replace(/^@/, '') : '', 110);
}

export function linkNote(noteId, pid) {
  const n = get('notes', noteId);
  save('notes', { ...n, linkedPeople: [...new Set([...(n.linkedPeople || []), pid])] });
}
export function unlinkNote(noteId, pid) {
  const n = get('notes', noteId);
  save('notes', { ...n, linkedPeople: (n.linkedPeople || []).filter(x => x !== pid) });
}
export function notThem(noteId, pid) {
  const p = get('people', pid);
  save('people', { ...p, notNotes: [...new Set([...(p.notNotes || []), noteId])] });
}

export const mentionHTML = p => `<a class="mention" data-person="${esc(p.id)}" href="#/people/${esc(p.id)}" contenteditable="false">@${esc(p.name)}</a>`;

export function quickPerson(name) {
  const clean = name.trim().replace(/^./, c => c.toUpperCase());
  const p = { id: uid(), name: clean, summary: '', circle: '', tags: [], favorite: false, photo: null, trust: 0, closeness: 0, big5: {}, fields: {}, interactions: [], created: Date.now(), updated: Date.now() };
  save('people', p, { silent: true });
  return p;
}

// ---------- @ suggestions inside the note editor ----------
function lastSeenTs(p) { return Math.max(p.updated || 0, ...(p.interactions || []).map(i => Date.parse(i.date) || 0)); }

function matches(q) {
  const s = norm(q);
  const people = list('people');
  if (!s) return people.sort((a, b) => lastSeenTs(b) - lastSeenTs(a)).slice(0, 6);
  const score = p => {
    const name = norm(p.name), nicks = nameTerms(p);
    if (name.startsWith(s)) return 0;
    if (nicks.some(t => t.startsWith(s))) return 1;
    if (name.split(/\s+/).some(w => w.startsWith(s))) return 2;
    if (name.includes(s)) return 3;
    return 9;
  };
  return people.map(p => [score(p), p]).filter(([sc]) => sc < 9).sort((a, b) => a[0] - b[0] || lastSeenTs(b[1]) - lastSeenTs(a[1])).slice(0, 6).map(([, p]) => p);
}

export function attachMentions(body, { onInsert }) {
  const pop = document.createElement('div');
  pop.className = 'mention-pop';
  pop.setAttribute('role', 'listbox');
  pop.hidden = true;
  document.body.append(pop);
  let st = null; // { node, start, end, q, items, sel }

  const close = () => { pop.hidden = true; st = null; };
  const render = () => {
    const { items, q, sel } = st;
    const counts = new Map();
    list('people').forEach(p => { const k = norm(p.name); counts.set(k, (counts.get(k) || 0) + 1); });
    const exists = items.some(p => norm(p.name) === norm(q));
    pop.innerHTML = items.map((p, i) => `<button type="button" role="option" class="${i === sel ? 'sel' : ''}" data-pick="${esc(p.id)}">
        ${p.photo ? `<span class="avatar sm"><img src="${p.photo}" alt=""></span>` : `<span class="avatar sm">${esc((p.name || '?').slice(0, 1).toUpperCase())}</span>`}
        <span class="grow"><b>${esc(p.name)}</b>${counts.get(norm(p.name)) > 1 ? ' <span class="same-name">same name</span>' : ''}<span class="muted small">${esc(personLine(p))}</span></span></button>`).join('')
      + (q.length >= 2 ? `<button type="button" role="option" class="${items.length === sel ? 'sel' : ''} create" data-create>＋ <span class="grow">${exists ? `Another person named “${esc(q)}”` : `Add “${esc(q)}” to People`}</span></button>` : '')
      || '<div class="muted small mention-empty">Type a name</div>';
    // place under the caret, or above it when the keyboard leaves no room
    const r = document.createRange(); r.setStart(st.node, st.start); r.setEnd(st.node, st.end);
    const rect = r.getBoundingClientRect();
    pop.hidden = false;
    const vh = window.visualViewport?.height || innerHeight;
    const h = pop.offsetHeight, w = Math.min(320, innerWidth - 16);
    pop.style.width = w + 'px';
    pop.style.left = Math.max(8, Math.min(rect.left, innerWidth - w - 8)) + 'px';
    pop.style.top = (rect.bottom + 6 + h > vh ? Math.max(8, rect.top - h - 6) : rect.bottom + 6) + 'px';
  };
  const update = () => {
    const s = getSelection();
    if (!s.rangeCount || !s.isCollapsed) return close();
    const r = s.getRangeAt(0), n = r.startContainer;
    if (n.nodeType !== 3 || !body.contains(n) || n.parentElement.closest('a.mention')) return close();
    const m = n.textContent.slice(0, r.startOffset).match(/(?:^|[\s (])@([^\s@ ]{0,30})$/);
    if (!m) return close();
    const q = m[1];
    const prev = st?.q;
    st = { node: n, start: r.startOffset - q.length - 1, end: r.startOffset, q, items: matches(q), sel: prev === q ? st.sel : 0 };
    render();
  };
  const insert = p => {
    const { node, start, end } = st;
    const r = document.createRange(); r.setStart(node, start); r.setEnd(node, end);
    r.deleteContents();
    const tmp = document.createElement('div'); tmp.innerHTML = mentionHTML(p);
    const a = tmp.firstChild, space = document.createTextNode(' ');
    r.insertNode(space); r.insertNode(a);
    const s = getSelection(), c = document.createRange(); c.setStartAfter(space); c.collapse(true); s.removeAllRanges(); s.addRange(c);
    close(); onInsert?.();
  };
  const choose = i => {
    if (!st) return;
    if (i < st.items.length) return insert(st.items[i]);
    const p = quickPerson(st.q);
    insert(p);
    toast(`Added ${p.name} to People`, { action: 'Open', onAction: () => navigate(`#/people/${p.id}`) });
  };

  body.addEventListener('input', update);
  body.addEventListener('keyup', e => { if (/^Arrow(Left|Right)$|^Home$|^End$/.test(e.key)) update(); });
  body.addEventListener('click', update);
  body.addEventListener('blur', () => setTimeout(close, 150));
  // capture: runs before the editor's own Enter/Tab handling
  body.addEventListener('keydown', e => {
    if (!st || pop.hidden) return;
    const total = st.items.length + (st.q.length >= 2 ? 1 : 0);
    if (!total) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopImmediatePropagation(); st.sel = (st.sel + (e.key === 'ArrowDown' ? 1 : -1) + total) % total; render(); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); choose(st.sel); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
  }, true);
  pop.addEventListener('pointerdown', e => e.preventDefault()); // keep the caret in the note
  pop.addEventListener('click', e => {
    const b = e.target.closest('[data-pick], [data-create]');
    if (!b) return;
    choose(b.dataset.pick ? st.items.findIndex(p => p.id === b.dataset.pick) : st.items.length);
  });
  return () => pop.remove();
}
