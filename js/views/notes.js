// Notes list: search (text, #tags, dates), tag filters, grouping, archive & trash.
import { list, get, save, remove, uid, settings, setSettings } from '../db.js';
import { esc, ymd, today, addDays, parseDay, fmtShort, fmtMonth, snippet, highlight, normTag, debounce, $ } from '../util.js';
import { icon } from '../icons.js';
import { navigate, rerender } from '../router.js';
import { menu, sheet, toast, confirmDialog, promptDialog } from '../ui.js';
import { renderEditor } from './editor.js';
import { templateSheet } from './templates.js';

// persisted-for-session UI state
const ui = { q: '', tags: [], range: 'any', from: '', to: '', dateField: 'updated', box: 'notes' };

export function newNote(extra = {}) {
  const now = Date.now();
  const n = { id: uid(), title: '', html: '', text: '', tags: [], pinned: false, archived: false, trashed: false, created: now, updated: now, draft: true, ...extra };
  if (!extra.tags) {
    // a new note picks up the tags you're filtering by, from the chips or typed in the search
    const known = new Set(allTags().map(([t]) => t));
    n.tags = [...new Set([...ui.tags, ...parseQuery(ui.q).tags.filter(t => known.has(t))])];
  }
  save('notes', n, { silent: true });
  return n;
}

export const noteTitle = n => n.title?.trim() || (n.text || '').split('\n').find(l => l.trim())?.trim().slice(0, 80) || 'New note';

export function allTags() {
  const counts = new Map();
  for (const n of list('notes')) if (!n.trashed) for (const t of n.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

// Parse the search box: "#tag", "from:2026-01-01", "to:…", "on:…", "is:pinned", rest = text
export function parseQuery(q) {
  const out = { text: [], tags: [], from: '', to: '', pinned: false, todo: false };
  for (const tok of q.trim().split(/\s+/).filter(Boolean)) {
    if (tok.startsWith('#') && tok.length > 1) out.tags.push(normTag(tok));
    else if (/^from:\d{4}-\d{2}-\d{2}$/.test(tok)) out.from = tok.slice(5);
    else if (/^to:\d{4}-\d{2}-\d{2}$/.test(tok)) out.to = tok.slice(3);
    else if (/^on:\d{4}-\d{2}-\d{2}$/.test(tok)) out.from = out.to = tok.slice(3);
    else if (tok === 'is:pinned') out.pinned = true;
    else if (tok === 'is:todo') out.todo = true;
    else out.text.push(tok);
  }
  out.text = out.text.join(' ');
  return out;
}

function rangeBounds() {
  const t = today();
  switch (ui.range) {
    case 'today': return [t, t];
    case 'week': return [addDays(t, -6), t];
    case 'month': return [addDays(t, -29), t];
    case 'year': return [`${t.slice(0, 4)}-01-01`, t];
    case 'custom': return [ui.from, ui.to];
    default: return ['', ''];
  }
}

export function filterNotes({ q = ui.q, tags = ui.tags, box = ui.box } = {}) {
  const pq = parseQuery(q);
  let [from, to] = rangeBounds();
  if (pq.from) from = pq.from;
  if (pq.to) to = pq.to;
  const text = pq.text.toLowerCase();
  const field = ui.dateField;
  return list('notes').filter(n => {
    if (n.draft && !n.text && !n.title) return false;
    if (box === 'trash') { if (!n.trashed) return false; }
    else if (n.trashed) return false;
    else if (box === 'archive' ? !n.archived : n.archived) return false;
    // chip tags match exactly (plus nested ones); typed tags match as you type, so "#la" finds #lakbay
    if (tags.length && !tags.every(t => (n.tags || []).some(nt => nt === t || nt.startsWith(t + '/')))) return false;
    if (pq.tags.length && !pq.tags.every(t => (n.tags || []).some(nt => nt.startsWith(t)))) return false;
    if (pq.pinned && !n.pinned) return false;
    if (pq.todo && !(n.todo && n.todo.total > n.todo.done)) return false;
    const day = ymd(new Date(n[field]));
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (text) {
      const hay = (n.title + '\n' + n.text + '\n' + (n.tags || []).join(' ')).toLowerCase();
      if (!text.split(' ').every(w => hay.includes(w))) return false;
    }
    return true;
  });
}

function sortNotes(arr) {
  const s = settings().noteSort;
  const by = {
    updated: (a, b) => b.updated - a.updated,
    created: (a, b) => b.created - a.created,
    title: (a, b) => noteTitle(a).localeCompare(noteTitle(b)),
  }[s] || ((a, b) => b.updated - a.updated);
  return arr.sort(by);
}

// Apple-Notes-style date buckets
function bucket(ts) {
  const d = ymd(new Date(ts)), t = today();
  if (d === t) return 'Today';
  if (d === addDays(t, -1)) return 'Yesterday';
  if (d >= addDays(t, -7)) return 'Previous 7 days';
  if (d >= addDays(t, -30)) return 'Previous 30 days';
  const dt = parseDay(d);
  return dt.getFullYear() === new Date().getFullYear() ? fmtMonth(dt.getFullYear(), dt.getMonth()).split(' ')[0] : String(dt.getFullYear());
}

function groupNotes(arr) {
  const st = settings();
  const groups = [];
  const push = (name, n) => { let g = groups.find(g => g.name === name); if (!g) groups.push(g = { name, items: [] }); g.items.push(n); };
  const pinned = ui.box === 'notes' ? arr.filter(n => n.pinned) : [];
  const rest = ui.box === 'notes' ? arr.filter(n => !n.pinned) : arr;
  if (pinned.length) groups.push({ name: 'Pinned', items: pinned });
  if (st.noteGroup === 'none' || st.noteSort === 'title') { if (rest.length) groups.push({ name: pinned.length ? 'Notes' : '', items: rest }); }
  else if (st.noteGroup === 'tag') {
    rest.forEach(n => (n.tags?.length ? n.tags : ['Untagged']).forEach(t => push(t === 'Untagged' ? t : '#' + t, n)));
    groups.sort((a, b) => (a.name === 'Untagged') - (b.name === 'Untagged') || (a.name === 'Pinned' ? -1 : 0));
  } else rest.forEach(n => push(bucket(n[st.noteSort === 'created' ? 'created' : 'updated']), n));
  return groups;
}

function noteItem(n, q, activeId) {
  const pq = parseQuery(q);
  const title = noteTitle(n);
  // untitled notes use their first line as the title, so the preview starts at the second line
  const lines = (n.text || '').split('\n').map(l => l.trim()).filter(Boolean);
  const body = snippet((n.title?.trim() ? lines : lines.slice(1)).join(' '), pq.text);
  const dateTs = settings().noteSort === 'created' ? n.created : n.updated;
  return `<a class="note-item ${n.id === activeId ? 'active' : ''}" href="#/notes/${n.id}" data-note-id="${n.id}">
    <div class="note-item-title">${n.pinned ? `<span class="pin-dot">${icon('pin')}</span>` : ''}${highlight(title, pq.text)}</div>
    <div class="note-item-meta"><time>${fmtShort(dateTs)}</time><span class="note-snip">${highlight(body, pq.text) || '<span class="faint">No additional text</span>'}</span></div>
    ${(n.tags?.length || n.todo?.total) ? `<div class="note-item-tags">
      ${n.todo?.total ? `<span class="todo-pill ${n.todo.done === n.todo.total ? 'done' : ''}">${icon('check')}${n.todo.done}/${n.todo.total}</span>` : ''}
      ${(n.tags || []).map(t => `<span class="tag-chip sm">#${esc(t)}</span>`).join('')}</div>` : ''}
  </a>`;
}

function listHTML(activeId) {
  const notes = sortNotes(filterNotes());
  const groups = groupNotes(notes);
  const tags = allTags();
  const [from, to] = rangeBounds();
  const boxTitle = { notes: 'Notes', archive: 'Archive', trash: 'Trash' }[ui.box];
  const rangeLabel = { any: 'Any time', today: 'Today', week: 'Last 7 days', month: 'Last 30 days', year: 'This year', custom: from || to ? `${from || '…'} → ${to || '…'}` : 'Custom' }[ui.range];
  return `
  <header class="page-head sticky">
    <div class="page-title-row">
      <h1>${boxTitle}</h1>
      <div class="head-actions">
        <button class="icon-btn" data-act="viewmenu" aria-label="View options">${icon('sort')}</button>
        ${ui.box === 'notes' ? `<button class="icon-btn" data-act="templates" aria-label="Daily note and templates" title="Daily note and templates (D for today)">${icon('today')}</button>` : ''}
        ${ui.box === 'notes' ? `<button class="icon-btn accent" data-act="new" aria-label="New note" title="New note (N)">${icon('edit')}</button>` : ''}
      </div>
    </div>
    <label class="search-field">${icon('search')}<input id="note-search" type="search" placeholder="Search notes, #tags, from:2026-01-01" value="${esc(ui.q)}" autocomplete="off" enterkeyhint="search">${ui.q ? `<button class="clear-btn" data-act="clearq" aria-label="Clear">${icon('x')}</button>` : ''}</label>
    <div class="chip-row" role="toolbar" aria-label="Filters">
      <button class="chip ${ui.range !== 'any' ? 'on' : ''}" data-act="range">${icon('calendar')}${esc(rangeLabel)}${icon('chevD')}</button>
      <button class="chip ${!ui.tags.length ? 'on' : ''}" data-tag="">All</button>
      ${tags.map(([t, c]) => `<button class="chip ${ui.tags.includes(t) ? 'on' : ''}" data-tag="${esc(t)}">#${esc(t)}<span class="chip-count">${c}</span></button>`).join('')}
      ${tags.length ? `<button class="chip ghost" data-act="tags">${icon('tag')}Manage</button>` : ''}
    </div>
  </header>
  <div class="note-list">
    ${ui.box === 'trash' && notes.length ? `<div class="banner">Notes in Trash are kept until you empty it. <button class="link" data-act="empty">Empty Trash</button></div>` : ''}
    ${groups.map(g => `<section class="note-group">${g.name ? `<h3 class="group-label">${esc(g.name)}</h3>` : ''}<div class="card list-card">${g.items.map(n => noteItem(n, ui.q, activeId)).join('')}</div></section>`).join('')}
    ${!notes.length ? emptyState() : ''}
    <div class="list-foot muted">${notes.length} note${notes.length === 1 ? '' : 's'}</div>
  </div>`;
}

function emptyState() {
  if (ui.q || ui.tags.length || ui.range !== 'any') return `<div class="empty">${icon('search', 'empty-ic')}<h3>No matches</h3><p>Try fewer words, another tag, or a wider date range.</p><button class="btn ghost" data-act="reset">Clear filters</button></div>`;
  if (ui.box === 'trash') return `<div class="empty">${icon('trash', 'empty-ic')}<h3>Trash is empty</h3></div>`;
  if (ui.box === 'archive') return `<div class="empty">${icon('archive', 'empty-ic')}<h3>Nothing archived</h3><p>Archive notes you want to keep but not see every day.</p></div>`;
  return `<div class="empty">${icon('notes', 'empty-ic')}<h3>Your notebook is empty</h3><p>Capture a thought, a list, a quote. Tag it so you can find it later.</p><button class="btn primary" data-act="new">${icon('plus')}New note</button></div>`;
}

// The word being typed at the caret in the search box, e.g. "#lak" or "lak"
function tokenAtCaret(input) {
  const pos = input.selectionStart ?? input.value.length;
  const m = input.value.slice(0, pos).match(/(^|\s)(#?[\w/-]*)$/);
  return m ? { text: m[2], start: pos - m[2].length, end: pos } : null;
}

// "#" lists every tag; "#la" or a plain "la" (2+ letters) lists matching tags, prefix matches first
function tagSuggestions(tok) {
  if (!tok) return [];
  const hash = tok.text.startsWith('#');
  const q = normTag(tok.text);
  if (!hash && q.length < 2) return [];
  const used = new Set(parseQuery(ui.q).tags.concat(ui.tags));
  return allTags()
    .filter(([t]) => (!q || t.includes(q)) && !(used.has(t) && t === q))
    .sort((a, b) => (b[0].startsWith(q) - a[0].startsWith(q)) || b[1] - a[1])
    .slice(0, 6);
}

function bindList(root, activeId) {
  const sug = { items: [], sel: null, tok: null };
  const closeSuggest = () => { root.querySelector('.search-suggest')?.remove(); sug.items = []; };
  const showSuggest = () => {
    const input = root.querySelector('#note-search');
    closeSuggest();
    if (!input || document.activeElement !== input) return;
    sug.tok = tokenAtCaret(input);
    sug.items = tagSuggestions(sug.tok);
    // after "#" the top tag is preselected; for a plain word nothing is, so Enter still searches the text
    if (!sug.items.length) { sug.sel = null; return; }
    if (sug.sel === null) sug.sel = sug.tok.text.startsWith('#') ? 0 : -1;
    sug.sel = Math.min(sug.sel, sug.items.length - 1);
    const field = input.closest('.search-field');
    field.insertAdjacentHTML('afterend', `<div class="search-suggest" role="listbox" aria-label="Tags"
      style="top:${field.offsetTop + field.offsetHeight + 6}px;left:${field.offsetLeft}px;width:${field.offsetWidth}px">
      ${sug.items.map(([t, c], i) => `<button type="button" role="option" class="${i === sug.sel ? 'sel' : ''}" aria-selected="${i === sug.sel}" data-sugtag="${esc(t)}">
        ${icon('tag')}<span class="grow">${highlight('#' + t, normTag(sug.tok.text))}</span><span class="muted small">${c}</span></button>`).join('')}
    </div>`);
  };
  const pickTag = t => {
    const input = root.querySelector('#note-search');
    const { start, end } = sug.tok;
    const after = input.value.slice(end).replace(/^[^\s]*/, '');
    const insert = `#${t} `;
    ui.q = input.value.slice(0, start) + insert + after.replace(/^\s+/, '');
    sug.sel = null;
    refreshList();
    const s = root.querySelector('#note-search');
    s.setSelectionRange(start + insert.length, start + insert.length); s.focus();
    closeSuggest();
  };
  const refreshList = () => {
    const wrap = root.querySelector('.notes-list-pane') || root;
    const st = wrap.scrollTop;
    const searchFocused = document.activeElement?.id === 'note-search';
    const caret = searchFocused ? document.activeElement.selectionStart : null;
    wrap.innerHTML = listHTML(activeId);
    wrap.scrollTop = st;
    if (searchFocused) { const s = wrap.querySelector('#note-search'); s.setSelectionRange(caret, caret); s.focus(); showSuggest(); }
  };
  const onSearch = debounce(() => refreshList(), 120);
  root.addEventListener('input', e => { if (e.target.id === 'note-search') { ui.q = e.target.value; sug.sel = null; showSuggest(); onSearch(); } });
  root.addEventListener('focusin', e => { if (e.target.id === 'note-search') showSuggest(); });
  root.addEventListener('focusout', e => { if (e.target.id === 'note-search') setTimeout(() => { if (document.activeElement?.id !== 'note-search') closeSuggest(); }, 120); });
  root.addEventListener('keyup', e => { if (e.target.id === 'note-search' && /^Arrow(Left|Right)$|^Home$|^End$/.test(e.key)) showSuggest(); });
  root.addEventListener('keydown', e => {
    if (e.target.id !== 'note-search' || !sug.items.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      sug.sel = sug.sel < 0 && e.key === 'ArrowUp' ? sug.items.length - 1 : (sug.sel + (e.key === 'ArrowDown' ? 1 : -1) + sug.items.length) % sug.items.length;
      showSuggest();
    } else if ((e.key === 'Enter' || e.key === 'Tab') && sug.sel >= 0) {
      e.preventDefault(); pickTag(sug.items[sug.sel][0]);
    } else if (e.key === 'Enter') {
      closeSuggest();
    } else if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation(); closeSuggest();
    }
  });
  // keep focus in the search box while tapping a suggestion
  root.addEventListener('pointerdown', e => { if (e.target.closest('[data-sugtag]')) e.preventDefault(); });
  // long-press (phone) or right-click: quick actions without opening the note
  root.addEventListener('contextmenu', e => {
    const item = e.target.closest('[data-note-id]');
    if (!item) return;
    e.preventDefault();
    const n = get('notes', item.dataset.noteId);
    const put = (patch, msg, undo) => { save('notes', { ...n, ...patch }); refreshList(); toast(msg, undo ? { action: 'Undo', onAction: () => { save('notes', n); refreshList(); } } : {}); };
    menu(item, n.trashed ? [
      { label: 'Restore', icon: 'restore', action: () => put({ trashed: false }, 'Restored') },
      { label: 'Delete forever', icon: 'trash', danger: true, action: async () => { if (await confirmDialog('This cannot be undone.')) { remove('notes', n.id); refreshList(); } } },
    ] : [
      { label: n.pinned ? 'Unpin' : 'Pin', icon: 'pin', action: () => put({ pinned: !n.pinned }, n.pinned ? 'Unpinned' : 'Pinned') },
      { label: n.archived ? 'Unarchive' : 'Archive', icon: 'archive', action: () => put({ archived: !n.archived }, n.archived ? 'Moved to Notes' : 'Archived', true) },
      '-',
      { label: 'Move to Trash', icon: 'trash', danger: true, action: () => put({ trashed: true, pinned: false }, 'Moved to Trash', true) },
    ]);
  });
  root.addEventListener('click', async e => {
    const st = e.target.closest('[data-sugtag]');
    if (st) return pickTag(st.dataset.sugtag);
    const tagBtn = e.target.closest('[data-tag]');
    if (tagBtn) {
      const t = tagBtn.dataset.tag;
      if (!t) ui.tags = [];
      else ui.tags = ui.tags.includes(t) ? ui.tags.filter(x => x !== t) : [...ui.tags, t];
      return refreshList();
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'new') { const n = newNote(); navigate(`#/notes/${n.id}`); }
    if (act === 'templates') templateSheet();
    if (act === 'clearq') { ui.q = ''; refreshList(); }
    if (act === 'reset') { Object.assign(ui, { q: '', tags: [], range: 'any', from: '', to: '' }); refreshList(); }
    if (act === 'range') rangeMenu(b, refreshList);
    if (act === 'viewmenu') viewMenu(b, refreshList);
    if (act === 'tags') manageTags(refreshList);
    if (act === 'empty') {
      if (await confirmDialog('Permanently delete every note in Trash?', { ok: 'Empty Trash' })) {
        list('notes').filter(n => n.trashed).forEach(n => remove('notes', n.id));
        refreshList(); toast('Trash emptied');
      }
    }
  });
  return refreshList;
}

function rangeMenu(anchor, refresh) {
  const set = r => () => { ui.range = r; refresh(); };
  menu(anchor, [
    { label: 'Any time', action: set('any'), checked: ui.range === 'any' },
    { label: 'Today', action: set('today'), checked: ui.range === 'today' },
    { label: 'Last 7 days', action: set('week'), checked: ui.range === 'week' },
    { label: 'Last 30 days', action: set('month'), checked: ui.range === 'month' },
    { label: 'This year', action: set('year'), checked: ui.range === 'year' },
    { label: 'Custom range…', icon: 'calendar', checked: ui.range === 'custom', action: () => customRange(refresh) },
    '-',
    { label: 'Filter by last edited', action: () => { ui.dateField = 'updated'; refresh(); }, checked: ui.dateField === 'updated' },
    { label: 'Filter by created', action: () => { ui.dateField = 'created'; refresh(); }, checked: ui.dateField === 'created' },
  ]);
}

function customRange(refresh) {
  sheet({
    title: 'Date range',
    render(body, close) {
      body.innerHTML = `<form class="stack">
        <div class="grid2"><label class="field"><span>From</span><input type="date" class="input" name="from" value="${ui.from}"></label>
        <label class="field"><span>To</span><input type="date" class="input" name="to" value="${ui.to}"></label></div>
        <div class="row-end"><button type="button" class="btn ghost" data-clear>Clear</button><button class="btn primary">Apply</button></div></form>`;
      const f = body.querySelector('form');
      body.querySelector('[data-clear]').onclick = () => { ui.range = 'any'; ui.from = ui.to = ''; close(); refresh(); };
      f.onsubmit = e => { e.preventDefault(); ui.range = 'custom'; ui.from = f.from.value; ui.to = f.to.value; close(); refresh(); };
    },
  });
}

function viewMenu(anchor, refresh) {
  const st = settings();
  const set = patch => () => { setSettings(patch); refresh(); };
  menu(anchor, [
    { label: 'Sort by last edited', action: set({ noteSort: 'updated' }), checked: st.noteSort === 'updated' },
    { label: 'Sort by created', action: set({ noteSort: 'created' }), checked: st.noteSort === 'created' },
    { label: 'Sort by title', action: set({ noteSort: 'title' }), checked: st.noteSort === 'title' },
    '-',
    { label: 'Group by date', action: set({ noteGroup: 'date' }), checked: st.noteGroup === 'date' },
    { label: 'Group by tag', action: set({ noteGroup: 'tag' }), checked: st.noteGroup === 'tag' },
    { label: 'No grouping', action: set({ noteGroup: 'none' }), checked: st.noteGroup === 'none' },
    '-',
    { label: 'Notes', icon: 'notes', action: () => { ui.box = 'notes'; refresh(); }, checked: ui.box === 'notes' },
    { label: 'Archive', icon: 'archive', action: () => { ui.box = 'archive'; refresh(); }, checked: ui.box === 'archive' },
    { label: 'Trash', icon: 'trash', action: () => { ui.box = 'trash'; refresh(); }, checked: ui.box === 'trash' },
  ]);
}

export function manageTags(refresh) {
  sheet({
    title: 'Tags',
    render(body) {
      const draw = () => {
        const tags = allTags();
        body.innerHTML = tags.length ? `<p class="muted small">Tip: use slashes for nested tags, like <b>#work/meetings</b>. Filtering by #work includes them.</p>
        <div class="card list-card">${tags.map(([t, c]) => `<div class="list-row"><span class="tag-chip">#${esc(t)}</span><span class="muted small grow">${c} note${c > 1 ? 's' : ''}</span>
          <button class="icon-btn sm" data-rename="${esc(t)}" aria-label="Rename">${icon('edit')}</button>
          <button class="icon-btn sm" data-del="${esc(t)}" aria-label="Delete">${icon('trash')}</button></div>`).join('')}</div>` : '<p class="muted">No tags yet.</p>';
      };
      draw();
      body.addEventListener('click', async e => {
        const r = e.target.closest('[data-rename]'), d = e.target.closest('[data-del]');
        if (r) {
          const old = r.dataset.rename;
          const nv = await promptDialog('Rename tag', { value: old });
          if (!nv) return;
          const nt = normTag(nv);
          list('notes').forEach(n => { if (n.tags?.includes(old)) save('notes', { ...n, tags: [...new Set(n.tags.map(t => t === old ? nt : t))] }); });
          ui.tags = ui.tags.map(t => t === old ? nt : t);
          draw(); refresh?.();
        }
        if (d) {
          const t = d.dataset.del;
          if (!await confirmDialog(`Remove #${t} from all notes? The notes stay.`, { ok: 'Remove tag' })) return;
          list('notes').forEach(n => { if (n.tags?.includes(t)) save('notes', { ...n, tags: n.tags.filter(x => x !== t) }); });
          ui.tags = ui.tags.filter(x => x !== t);
          draw(); refresh?.();
        }
      });
    },
  });
}

// ---------- route renderers ----------
const wide = () => matchMedia('(min-width: 980px)').matches;

export function renderNotes(main, params, query) {
  if (query.tag) { ui.tags = [normTag(query.tag)]; ui.box = 'notes'; }
  if (query.q !== undefined) ui.q = query.q;
  if (query.box) ui.box = query.box;
  if (query.new) { const n = newNote(); navigate(`#/notes/${n.id}`, { replace: true }); return; }
  const id = params.id;
  if (id && !get('notes', id)) { navigate('#/notes', { replace: true }); return; }

  if (id && !wide()) return renderEditor(main, id);

  if (wide()) {
    main.innerHTML = `<div class="split"><div class="notes-list-pane"></div><div class="notes-editor-pane"></div></div>`;
    const lp = main.querySelector('.notes-list-pane'), ep = main.querySelector('.notes-editor-pane');
    lp.innerHTML = listHTML(id);
    const refresh = bindList(main.querySelector('.split'), id);
    let cleanupEditor;
    if (id) cleanupEditor = renderEditor(ep, id, { embedded: true, onChange: n => updateListItem(lp, n) });
    else ep.innerHTML = `<div class="empty pane-empty">${icon('notes', 'empty-ic')}<p>Select a note, or press <kbd>N</kbd> to start a new one.</p></div>`;
    const mq = matchMedia('(min-width: 980px)');
    const onMq = () => rerender();
    mq.addEventListener('change', onMq);
    return () => { cleanupEditor?.(); mq.removeEventListener('change', onMq); };
  }

  main.innerHTML = `<div class="page notes-page">${listHTML()}</div>`;
  bindList(main.querySelector('.notes-page'));
  if (!main.querySelector('.fab')) main.insertAdjacentHTML('beforeend', `<button class="fab" data-fab aria-label="New note">${icon('plus')}</button>`);
  main.querySelector('[data-fab]').onclick = () => { const n = newNote(); navigate(`#/notes/${n.id}`); };
}

function updateListItem(pane, n) {
  const el = pane.querySelector(`[data-note-id="${n.id}"]`);
  if (el) { const tmp = document.createElement('div'); tmp.innerHTML = noteItem(n, ui.q, n.id); el.replaceWith(tmp.firstElementChild); }
  else if (!n.draft || n.text || n.title) {
    const st = pane.scrollTop; pane.innerHTML = listHTML(n.id); pane.scrollTop = st;
  }
}
