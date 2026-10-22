// Rich note editor: contenteditable + toolbar + markdown shortcuts + checklists + tags.
import { get, save, remove, list, uid } from '../db.js';
import { esc, htmlToText, debounce, normTag, fmtDateTime, download, haptic } from '../util.js';
import { icon } from '../icons.js';
import { navigate, onLeave } from '../router.js';
import { menu, toast, promptDialog, confirmDialog, sheet } from '../ui.js';
import { attachMentions, personLine } from './mentions.js';

// ---------- sanitizer (for paste + stored content) ----------
const ALLOWED = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'H1', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'A', 'MARK', 'HR', 'DIV']);
export function sanitize(html) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const walk = node => {
    [...node.childNodes].forEach(ch => {
      if (ch.nodeType === 3) return;
      if (ch.nodeType !== 1) { ch.remove(); return; }
      walk(ch);
      if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'TEMPLATE', 'META', 'LINK'].includes(ch.tagName)) { ch.remove(); return; }
      if (!ALLOWED.has(ch.tagName)) {
        const blockish = /^(SECTION|ARTICLE|HEADER|FOOTER|TABLE|TR|H4|H5|H6)$/.test(ch.tagName);
        if (blockish) { const p = doc.createElement('p'); p.append(...ch.childNodes); ch.replaceWith(p); }
        else ch.replaceWith(...ch.childNodes);
        return;
      }
      const keep = {};
      if (ch.tagName === 'A') { const h = ch.getAttribute('href') || ''; if (/^(https?:|mailto:|tel:|#)/i.test(h)) keep.href = h; }
      // person mentions: keep the person id so the link survives renames and same names
      if (ch.tagName === 'A' && ch.classList.contains('mention') && /^[\w-]+$/.test(ch.dataset.person || '')) Object.assign(keep, { class: 'mention', 'data-person': ch.dataset.person, contenteditable: 'false', href: `#/people/${ch.dataset.person}` });
      if ((ch.tagName === 'UL' && ch.classList.contains('checklist')) ) keep.class = 'checklist';
      if (ch.tagName === 'LI' && ch.classList.contains('checked')) keep.class = 'checked';
      [...ch.attributes].forEach(a => ch.removeAttribute(a.name));
      Object.entries(keep).forEach(([k, v]) => ch.setAttribute(k, v));
    });
  };
  walk(doc.body);
  return doc.body.innerHTML;
}

// ---------- block helpers ----------
function topBlock(editor, node) {
  if (!node) return null;
  if (node === editor) return null;
  while (node && node.parentNode !== editor) node = node.parentNode;
  return node && node.nodeType === 1 ? node : null;
}
function caretNode() {
  const s = getSelection();
  return s.rangeCount ? s.getRangeAt(0).startContainer : null;
}
function placeCaretIn(el, atEnd = true) {
  const r = document.createRange();
  r.selectNodeContents(el); r.collapse(!atEnd);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}
function selectedBlocks(editor) {
  const s = getSelection();
  if (!s.rangeCount) return [];
  const r = s.getRangeAt(0);
  const a = topBlock(editor, r.startContainer), b = topBlock(editor, r.endContainer);
  if (!a) return [];
  const out = [a];
  let n = a;
  while (n !== b && n.nextElementSibling) { n = n.nextElementSibling; out.push(n); }
  return out;
}
function retag(el, tag) {
  const n = document.createElement(tag);
  while (el.firstChild) n.append(el.firstChild);
  if (!n.childNodes.length) n.append(document.createElement('br'));
  el.replaceWith(n);
  return n;
}
// Toggle a block-level style (h1/h2/h3/blockquote/pre) on the selected blocks
function toggleBlock(editor, tag) {
  const s = getSelection();
  const r = s.rangeCount ? s.getRangeAt(0).cloneRange() : null;
  ensureBlock(editor);
  let blocks = selectedBlocks(editor);
  if (!blocks.length) { document.execCommand('formatBlock', false, tag); return; }
  const allSame = blocks.every(b => b.tagName === tag.toUpperCase());
  let last;
  blocks.forEach(b => {
    if (/^(UL|OL|HR)$/.test(b.tagName)) return;
    last = retag(b, allSame ? 'p' : tag);
  });
  try { if (r && editor.contains(r.startContainer)) { s.removeAllRanges(); s.addRange(r); } else if (last) placeCaretIn(last); }
  catch { if (last) placeCaretIn(last); }
}

function closestIn(editor, sel) {
  let n = caretNode();
  if (n?.nodeType === 3) n = n.parentNode;
  const el = n?.closest?.(sel);
  return el && editor.contains(el) ? el : null;
}

function toggleChecklist(editor) {
  const ul = closestIn(editor, 'ul, ol');
  if (ul && ul.tagName === 'UL' && ul.classList.contains('checklist')) { document.execCommand('insertUnorderedList'); return; }
  if (ul && ul.tagName === 'UL') { ul.classList.add('checklist'); return; }
  if (ul && ul.tagName === 'OL') document.execCommand('insertUnorderedList');
  else document.execCommand('insertUnorderedList');
  const nu = closestIn(editor, 'ul');
  nu?.classList.add('checklist');
}
function toggleList(editor, ordered) {
  const cl = closestIn(editor, 'ul.checklist');
  if (cl && !ordered) { cl.classList.remove('checklist'); return; }
  document.execCommand(ordered ? 'insertOrderedList' : 'insertUnorderedList');
}

function toggleMark(editor) {
  const m = closestIn(editor, 'mark');
  if (m) { m.replaceWith(...m.childNodes); return; }
  const s = getSelection();
  if (!s.rangeCount || s.isCollapsed) { toast('Select some text to highlight'); return; }
  const div = document.createElement('div');
  div.append(s.getRangeAt(0).cloneContents());
  document.execCommand('insertHTML', false, `<mark>${div.innerHTML}</mark>`);
}

async function insertLink(editor, saved) {
  const existing = closestIn(editor, 'a');
  const url = await promptDialog(existing ? 'Edit link' : 'Add link', { value: existing?.getAttribute('href') || 'https://', placeholder: 'https://…' });
  editor.focus();
  if (saved) { const s = getSelection(); s.removeAllRanges(); s.addRange(saved); }
  if (url === null) return;
  if (!url || url === 'https://') { if (existing) existing.replaceWith(...existing.childNodes); return; }
  const href = /^(https?:|mailto:|tel:)/i.test(url) ? url : 'https://' + url;
  if (existing) { existing.setAttribute('href', href); return; }
  const s = getSelection();
  if (s.isCollapsed) document.execCommand('insertHTML', false, `<a href="${esc(href)}">${esc(url)}</a>&nbsp;`);
  else document.execCommand('createLink', false, href);
}

// Markdown-style shortcuts at the start of a paragraph
const SHORTCUTS = [
  [/^#$/, ed => toggleBlock(ed, 'h1')],
  [/^##$/, ed => toggleBlock(ed, 'h2')],
  [/^###$/, ed => toggleBlock(ed, 'h3')],
  [/^[-*•]$/, (ed, b) => makeList(b, 'ul')],
  [/^1[.)]$/, (ed, b) => makeList(b, 'ol')],
  [/^\[ ?\]$/, (ed, b) => makeList(b, 'ul', 'checklist')],
  [/^\[x\]$/i, (ed, b) => makeList(b, 'ul', 'checklist').classList.add('checked')],
  [/^>$/, ed => toggleBlock(ed, 'blockquote')],
  [/^```$/, ed => toggleBlock(ed, 'pre')],
  [/^(---|\*\*\*)$/, ed => { document.execCommand('insertHorizontalRule'); }],
];
// Replace a paragraph with a fresh list; returns the <li>
function makeList(block, tag, cls = '') {
  const list = document.createElement(tag);
  if (cls) list.className = cls;
  const li = document.createElement('li');
  li.append(document.createElement('br'));
  list.append(li);
  block.replaceWith(list);
  placeCaretIn(li, false);
  return li;
}

// Browsers sometimes nest block elements inside <p>; flatten them
function normalize(editor) {
  editor.querySelectorAll(':scope > p').forEach(p => {
    if (p.querySelector(':scope > ul, :scope > ol, :scope > blockquote, :scope > pre, :scope > h1, :scope > h2, :scope > h3, :scope > hr')) {
      const s = getSelection(); const r = s.rangeCount ? s.getRangeAt(0).cloneRange() : null;
      p.replaceWith(...p.childNodes);
      if (r) { try { s.removeAllRanges(); s.addRange(r); } catch {} }
    }
  });
}

// The first line typed into an empty editor is a bare text node; give it a <p>
function ensureBlock(editor) {
  const n = caretNode();
  if (n && (n === editor || n.parentNode === editor) && !topBlock(editor, n)) document.execCommand('formatBlock', false, 'p');
}

function tryShortcut(editor) {
  ensureBlock(editor);
  const n = caretNode();
  const block = topBlock(editor, n);
  if (!block || !/^(P|DIV)$/.test(block.tagName)) return false;
  const txt = block.textContent.replace(/ /g, ' ');
  if (!txt.endsWith(' ')) return false;
  const key = txt.slice(0, -1);
  for (const [re, fn] of SHORTCUTS) {
    if (re.test(key)) {
      block.innerHTML = '<br>';
      placeCaretIn(block, false);
      fn(editor, block);
      normalize(editor);
      return true;
    }
  }
  return false;
}

// ---------- toolbar ----------
// Most-used first: on a phone only the first ~9 fit without scrolling
const TOOLS = [
  ['checklist', 'Checklist (⌘⇧C)', 'checklist'], ['list', 'Bulleted list', 'list'], ['olist', 'Numbered list', 'olist'], ['quote', 'Quote', 'quote'], '|',
  ['bold', 'Bold (⌘B)', 'bold'], ['italic', 'Italic (⌘I)', 'italic'], ['underline', 'Underline (⌘U)', 'underline'], ['strike', 'Strikethrough', 'strike'], ['highlight', 'Highlight', 'highlight'], '|',
  ['h1', 'Heading', 'h1'], ['h2', 'Subheading', 'h2'], ['code', 'Code block', 'code'], ['divider', 'Divider', 'divider'], ['link', 'Link (⌘K)', 'link'], '|',
  ['clear', 'Clear formatting', 'clear'], ['undo', 'Undo', 'undo'], ['redo', 'Redo', 'redo'],
];
function toolbarHTML() {
  return TOOLS.map(t => t === '|' ? '<span class="tb-sep"></span>' :
    `<button type="button" class="tb-btn" data-cmd="${t[0]}" title="${t[1]}" aria-label="${t[1]}">${icon(t[2])}</button>`).join('');
}

function runCmd(editor, cmd, savedRange) {
  editor.focus();
  switch (cmd) {
    case 'h1': case 'h2': return toggleBlock(editor, cmd);
    case 'quote': return toggleBlock(editor, 'blockquote');
    case 'code': return toggleBlock(editor, 'pre');
    case 'bold': case 'italic': case 'underline': return document.execCommand(cmd);
    case 'strike': return document.execCommand('strikeThrough');
    case 'highlight': return toggleMark(editor);
    case 'checklist': return toggleChecklist(editor);
    case 'list': return toggleList(editor, false);
    case 'olist': return toggleList(editor, true);
    case 'divider': return document.execCommand('insertHorizontalRule');
    case 'link': return insertLink(editor, savedRange);
    case 'clear': {
      document.execCommand('removeFormat');
      selectedBlocks(editor).forEach(b => { if (/^(H1|H2|H3|BLOCKQUOTE|PRE)$/.test(b.tagName)) retag(b, 'p'); });
      return;
    }
    case 'undo': return document.execCommand('undo');
    case 'redo': return document.execCommand('redo');
  }
}

function updateToolbarState(editor, tb) {
  const is = sel => !!closestIn(editor, sel);
  const block = topBlock(editor, caretNode());
  const tag = block?.tagName;
  const st = {
    h1: tag === 'H1', h2: tag === 'H2', quote: tag === 'BLOCKQUOTE', code: tag === 'PRE',
    bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic'),
    underline: is('u'), strike: is('s, strike, del'),
    checklist: is('ul.checklist'), list: is('ul:not(.checklist)'), olist: is('ol'), highlight: is('mark'), link: is('a'),
  };
  tb.querySelectorAll('[data-cmd]').forEach(b => b.classList.toggle('on', !!st[b.dataset.cmd]));
}

function countTodos(editor) {
  const items = editor.querySelectorAll('ul.checklist > li');
  const done = editor.querySelectorAll('ul.checklist > li.checked').length;
  return { total: items.length, done };
}

// ---------- main ----------
export function renderEditor(container, id, { embedded = false, onChange } = {}) {
  let note = get('notes', id);
  container.innerHTML = `
  <div class="editor-view ${embedded ? 'embedded' : ''}">
    <header class="editor-head">
      ${embedded ? '<span></span>' : `<button class="icon-btn" data-act="back" aria-label="Back">${icon('back')}</button>`}
      <div class="editor-status muted small" aria-live="polite"></div>
      <div class="head-actions">
        <button class="icon-btn ${note.pinned ? 'on' : ''}" data-act="pin" aria-label="Pin" title="Pin">${icon('pin')}</button>
        <button class="icon-btn" data-act="more" aria-label="More">${icon('more')}</button>
        ${embedded ? '' : `<button class="btn primary sm" data-act="done">Done</button>`}
      </div>
    </header>
    <div class="editor-scroll">
      <div class="editor-paper">
        ${note.trashed ? `<div class="banner">This note is in Trash. <button class="link" data-act="restore">Restore</button></div>` : ''}
        <textarea class="note-title" rows="1" placeholder="Title" aria-label="Title">${esc(note.title)}</textarea>
        <div class="tag-editor">
          <div class="tag-list"></div>
          <div class="tag-input-wrap"><span class="hash">#</span><input class="tag-input" placeholder="add tag" aria-label="Add tag" autocomplete="off" autocapitalize="off" enterkeyhint="done"><div class="tag-suggest"></div></div>
        </div>
        <div class="note-body" contenteditable="true" spellcheck="true" data-placeholder="Start writing… Add #tags and @people anywhere. Type  [ ]  for a checklist,  -  for bullets,  >  for a quote."></div>
      </div>
    </div>
    <div class="toolbar" role="toolbar" aria-label="Formatting">${toolbarHTML()}</div>
  </div>`;

  const view = container.querySelector('.editor-view');
  const titleEl = view.querySelector('.note-title');
  const body = view.querySelector('.note-body');
  const tb = view.querySelector('.toolbar');
  const status = view.querySelector('.editor-status');
  const tagList = view.querySelector('.tag-list');
  const tagInput = view.querySelector('.tag-input');
  const suggest = view.querySelector('.tag-suggest');
  body.innerHTML = sanitize(note.html || '');
  // mentions show the person's current name
  body.querySelectorAll('a.mention').forEach(a => { const p = get('people', a.dataset.person); if (p) a.textContent = '@' + p.name; });
  // the browser re-serializes stored HTML slightly differently (' vs &#x27;), so compare edits against what it shows
  let savedHtml = body.innerHTML;
  if (note.trashed) { body.contentEditable = 'false'; titleEl.readOnly = true; }
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch {}

  const autosize = () => { titleEl.style.height = 'auto'; titleEl.style.height = titleEl.scrollHeight + 'px'; };
  requestAnimationFrame(autosize);

  const words = () => (body.innerText.match(/\S+/g) || []).length;
  const setStatus = () => { status.textContent = `${words()} words · edited ${fmtDateTime(note.updated)}`; };
  setStatus();

  // #tags typed in the text become tags once finished (followed by a space or line break;
  // on leaving, the end of the note counts too). Tags removed by hand aren't re-added.
  const removedTags = new Set();
  const inlineTags = (text, final) => [...text.matchAll(final ? /(^|\s)#([a-z][\w/-]*)(?=\s|$)/gi : /(^|\s)#([a-z][\w/-]*)(?=\s)/gi)]
    .map(m => normTag(m[2])).filter(t => t && !removedTags.has(t));

  const persist = (final = false) => {
    note = get('notes', id) || note;
    const html = body.innerHTML === '<br>' ? '' : body.innerHTML;
    const title = titleEl.value.trim();
    const text = htmlToText(html);
    const newTags = inlineTags(text, final).filter(t => !(note.tags || []).includes(t));
    if ((html === savedHtml || html === note.html) && title === note.title && !newTags.length) return;
    savedHtml = html;
    const people = [...new Set([...body.querySelectorAll('a.mention[data-person]')].map(a => a.dataset.person))];
    note = { ...note, html, title, text, people, tags: [...new Set([...(note.tags || []), ...newTags])], updated: Date.now(), todo: countTodos(body), draft: false };
    save('notes', note, { silent: true });
    if (newTags.length) drawTags();
    setStatus();
    onChange?.(note);
  };
  const persistSoon = debounce(persist, 350);

  // tags
  const drawTags = () => {
    tagList.innerHTML = (note.tags || []).map(t => `<span class="tag-chip">#${esc(t)}<button data-rmtag="${esc(t)}" aria-label="Remove ${esc(t)}">${icon('x')}</button></span>`).join('');
  };
  drawTags();
  const addTag = raw => {
    const t = normTag(raw);
    if (!t) return;
    note = get('notes', id);
    if (!note.tags.includes(t)) { note = { ...note, tags: [...note.tags, t], updated: Date.now(), draft: false }; save('notes', note, { silent: true }); onChange?.(note); }
    tagInput.value = ''; suggest.innerHTML = ''; drawTags(); haptic();
  };
  const showSuggest = () => {
    const q = normTag(tagInput.value);
    const all = new Map();
    list('notes').forEach(n => !n.trashed && (n.tags || []).forEach(t => all.set(t, (all.get(t) || 0) + 1)));
    const opts = [...all].filter(([t]) => !note.tags.includes(t) && (!q || t.includes(q))).sort((a, b) => b[1] - a[1]).slice(0, 6);
    suggest.innerHTML = opts.map(([t]) => `<button type="button" data-addtag="${esc(t)}">#${esc(t)}</button>`).join('') +
      (q && !all.has(q) ? `<button type="button" data-addtag="${esc(q)}">Create <b>#${esc(q)}</b></button>` : '');
    suggest.classList.toggle('open', !!suggest.innerHTML && document.activeElement === tagInput);
  };
  tagInput.addEventListener('input', showSuggest);
  tagInput.addEventListener('focus', showSuggest);
  tagInput.addEventListener('blur', () => setTimeout(() => { suggest.classList.remove('open'); if (tagInput.value.trim()) addTag(tagInput.value); }, 150));
  tagInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',' || (e.key === ' ' && tagInput.value.trim())) { e.preventDefault(); addTag(tagInput.value); showSuggest(); }
    if (e.key === 'Backspace' && !tagInput.value && note.tags.length) { removedTags.add(note.tags.at(-1)); note = { ...note, tags: note.tags.slice(0, -1) }; save('notes', note, { silent: true }); drawTags(); onChange?.(note); }
  });
  view.addEventListener('mousedown', e => { if (e.target.closest('[data-addtag]')) e.preventDefault(); });
  view.addEventListener('click', e => {
    const a = e.target.closest('[data-addtag]'); if (a) { addTag(a.dataset.addtag); tagInput.focus(); return; }
    const r = e.target.closest('[data-rmtag]');
    if (r) { removedTags.add(r.dataset.rmtag); note = get('notes', id); note = { ...note, tags: note.tags.filter(t => t !== r.dataset.rmtag), updated: Date.now() }; save('notes', note, { silent: true }); drawTags(); onChange?.(note); }
  });

  // title
  titleEl.addEventListener('input', () => { autosize(); persistSoon(); });
  titleEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); body.focus(); placeCaretIn(body, false); } });

  // body
  body.addEventListener('input', e => {
    if (e.inputType === 'insertText' && e.data === ' ') tryShortcut(body);
    persistSoon();
  });
  body.addEventListener('keydown', e => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); const s = getSelection(); insertLink(body, s.rangeCount ? s.getRangeAt(0).cloneRange() : null); }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'c') { e.preventDefault(); toggleChecklist(body); persistSoon(); }
    if (mod && e.shiftKey && e.key === '7') { e.preventDefault(); toggleList(body, true); }
    if (mod && e.shiftKey && e.key === '8') { e.preventDefault(); toggleList(body, false); }
    if (mod && e.altKey && (e.key === '1' || e.key === '2')) { e.preventDefault(); toggleBlock(body, 'h' + e.key); }
    if (e.key === 'Tab') {
      if (closestIn(body, 'li')) { e.preventDefault(); document.execCommand(e.shiftKey ? 'outdent' : 'indent'); }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      const li = closestIn(body, 'li');
      // empty list item + Enter exits the list; new checklist items start unchecked
      setTimeout(() => { const nli = closestIn(body, 'ul.checklist > li'); if (nli && !nli.textContent.trim()) nli.classList.remove('checked'); });
      const pre = closestIn(body, 'pre');
      if (pre && !li) { e.preventDefault(); document.execCommand('insertText', false, '\n'); }
      const bq = closestIn(body, 'blockquote, h1, h2, h3');
      if (bq && !bq.textContent.trim()) { e.preventDefault(); retag(bq, 'p'); placeCaretIn(topBlock(body, caretNode()) || body); }
    }
    if (e.key === 'Backspace') {
      // backspace at start of a styled block turns it back into a paragraph
      const blk = topBlock(body, caretNode());
      const s = getSelection();
      if (blk && /^(H1|H2|H3|BLOCKQUOTE|PRE)$/.test(blk.tagName) && s.isCollapsed) {
        const r = s.getRangeAt(0).cloneRange(); r.setStart(blk, 0);
        if (!r.toString().length) { e.preventDefault(); const p = retag(blk, 'p'); placeCaretIn(p, false); persistSoon(); }
      }
    }
  });
  // checkbox toggling
  body.addEventListener('click', e => {
    const li = e.target.closest('ul.checklist > li');
    if (li && body.contains(li)) {
      const x = e.clientX - li.getBoundingClientRect().left;
      if (x < 30) {
        e.preventDefault();
        li.classList.toggle('checked'); haptic(8);
        persist();
        return;
      }
    }
    const pm = e.target.closest('a.mention');
    if (pm) {
      e.preventDefault();
      const p = get('people', pm.dataset.person);
      if (p) toast(`${p.name} · ${personLine(p)}`, { action: 'Open', onAction: () => navigate(`#/people/${p.id}`) });
      else toast('This person was deleted');
      return;
    }
    const a = e.target.closest('a[href]');
    if (a) {
      if (e.metaKey || e.ctrlKey) window.open(a.href, '_blank', 'noopener');
      else toast(a.href.replace(/^https?:\/\//, '').slice(0, 40), { action: 'Open', onAction: () => window.open(a.href, '_blank', 'noopener') });
    }
  });
  body.addEventListener('paste', e => {
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    e.preventDefault();
    if (html) document.execCommand('insertHTML', false, sanitize(html));
    else document.execCommand('insertText', false, text);
  });
  body.addEventListener('drop', e => { if (e.dataTransfer?.files?.length) e.preventDefault(); });

  // toolbar (mousedown keeps focus/selection in the editor)
  let savedRange = null;
  tb.addEventListener('pointerdown', e => {
    if (!e.target.closest('[data-cmd]')) return;
    e.preventDefault();
    const s = getSelection();
    savedRange = s.rangeCount && body.contains(s.anchorNode) ? s.getRangeAt(0).cloneRange() : null;
  });
  tb.addEventListener('click', e => {
    const b = e.target.closest('[data-cmd]');
    if (!b || note.trashed) return;
    if (savedRange && !body.contains(getSelection().anchorNode)) { body.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(savedRange); }
    else if (!body.contains(getSelection().anchorNode)) { body.focus(); placeCaretIn(body); }
    runCmd(body, b.dataset.cmd, savedRange);
    normalize(body);
    haptic(5);
    persistSoon();
    updateToolbarState(body, tb);
  });
  // @ to mention a person
  const detachMentions = note.trashed ? () => {} : attachMentions(body, { onInsert: () => persistSoon() });

  const onSel = () => { if (body.contains(getSelection().anchorNode)) updateToolbarState(body, tb); };
  document.addEventListener('selectionchange', onSel);

  // keep the toolbar above the on-screen keyboard
  const vv = window.visualViewport;
  const onVV = () => {
    if (!vv) return;
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    view.style.setProperty('--kb', kb + 'px');
    view.classList.toggle('kb-open', kb > 80);
  };
  vv?.addEventListener('resize', onVV); vv?.addEventListener('scroll', onVV);
  const focusIn = () => view.classList.add('editing');
  const focusOut = () => setTimeout(() => { if (!view.contains(document.activeElement)) view.classList.remove('editing'); }, 50);
  view.addEventListener('focusin', focusIn);
  view.addEventListener('focusout', focusOut);

  // header actions
  view.querySelector('.editor-head').addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'back' || act === 'done') { persistSoon.flush(true); history.length > 1 ? history.back() : navigate('#/notes'); }
    if (act === 'pin') {
      persistSoon.flush(true); note = get('notes', id);
      note = { ...note, pinned: !note.pinned, draft: false }; save('notes', note, { silent: true });
      b.classList.toggle('on', note.pinned); onChange?.(note); toast(note.pinned ? 'Pinned' : 'Unpinned'); haptic();
    }
    if (act === 'more') moreMenu(b);
  });
  view.addEventListener('click', e => {
    if (e.target.closest('[data-act="restore"]')) { save('notes', { ...get('notes', id), trashed: false }); toast('Note restored'); navigate(`#/notes/${id}`, { replace: true }); }
  });

  function moreMenu(anchor) {
    persistSoon.flush(true); note = get('notes', id);
    menu(anchor, [
      { label: note.archived ? 'Unarchive' : 'Archive', icon: 'archive', action: () => { save('notes', { ...note, archived: !note.archived, draft: false }); toast(note.archived ? 'Moved to Notes' : 'Archived'); navigate('#/notes'); } },
      { label: 'Duplicate', icon: 'copy', action: () => { const n = { ...note, id: uid(), title: (note.title || 'Untitled') + ' copy', created: Date.now(), updated: Date.now(), pinned: false }; save('notes', n); navigate(`#/notes/${n.id}`); } },
      { label: 'Copy as text', icon: 'copy', action: () => navigator.clipboard?.writeText((note.title ? note.title + '\n\n' : '') + note.text).then(() => toast('Copied')) },
      { label: 'Export as Markdown', icon: 'download', action: () => download(`${(note.title || 'note').replace(/[^\w-]+/g, '-')}.md`, toMarkdown(note), 'text/markdown') },
      { label: 'Note info', icon: 'info', action: () => infoSheet(note, body) },
      '-',
      note.trashed
        ? { label: 'Delete forever', icon: 'trash', danger: true, action: async () => { if (await confirmDialog('This cannot be undone.')) { remove('notes', id); navigate('#/notes'); } } }
        : { label: 'Move to Trash', icon: 'trash', danger: true, action: () => {
            save('notes', { ...note, trashed: true, pinned: false, draft: false });
            navigate('#/notes');
            toast('Moved to Trash', { action: 'Undo', onAction: () => { save('notes', { ...get('notes', id), trashed: false }); navigate(`#/notes/${id}`); } });
          } },
    ]);
  }

  // Focus: new notes start straight in the body (the first line names the note), existing ones stay put
  if ((!note.title && !note.text || note.seeded && note.draft) && !note.trashed) setTimeout(() => { body.focus(); placeCaretIn(body); }, 50);

  // Discard empty drafts when leaving
  const offLeave = onLeave(next => {
    if (next.params?.id === id) return;
    persistSoon.flush(true);
    const n = get('notes', id);
    // still a draft = never touched, so tags it inherited from the search don't keep it alive
    if (n && !n.title && !n.text && !n.html.includes('<hr') && (n.draft || !(n.tags || []).length)) remove('notes', id);
    else if (n?.draft && n.seeded) remove('notes', id); // a "new note about…" that was never written in
  });
  const beforeUnload = () => persistSoon.flush(true);
  window.addEventListener('pagehide', beforeUnload);

  return () => {
    persistSoon.flush(true);
    offLeave();
    document.removeEventListener('selectionchange', onSel);
    detachMentions();
    vv?.removeEventListener('resize', onVV); vv?.removeEventListener('scroll', onVV);
    window.removeEventListener('pagehide', beforeUnload);
  };
}

function infoSheet(note, body) {
  const t = countTodos(body);
  sheet({
    title: 'Note info',
    render(b) {
      b.innerHTML = `<dl class="info-list">
        <dt>Created</dt><dd>${fmtDateTime(note.created)}</dd>
        <dt>Last edited</dt><dd>${fmtDateTime(note.updated)}</dd>
        <dt>Words</dt><dd>${(body.innerText.match(/\S+/g) || []).length}</dd>
        <dt>Characters</dt><dd>${body.innerText.length}</dd>
        ${t.total ? `<dt>Checklist</dt><dd>${t.done} of ${t.total} done</dd>` : ''}
        <dt>Tags</dt><dd>${note.tags.length ? note.tags.map(t => '#' + esc(t)).join(' ') : '—'}</dd></dl>`;
    },
  });
}

export function toMarkdown(note) {
  const d = document.createElement('div');
  d.innerHTML = note.html || '';
  const inline = n => [...n.childNodes].map(c => {
    if (c.nodeType === 3) return c.textContent;
    const t = c.tagName, x = inline(c);
    if (t === 'B' || t === 'STRONG') return `**${x}**`;
    if (t === 'I' || t === 'EM') return `*${x}*`;
    if (t === 'S' || t === 'STRIKE' || t === 'DEL') return `~~${x}~~`;
    if (t === 'CODE') return '`' + x + '`';
    if (t === 'MARK') return `==${x}==`;
    if (t === 'A') return c.classList.contains('mention') ? x : `[${x}](${c.getAttribute('href')})`;
    if (t === 'BR') return '\n';
    return x;
  }).join('');
  const block = (n, depth = 0) => [...n.children].map(c => {
    const t = c.tagName;
    if (t === 'H1') return `# ${inline(c)}`;
    if (t === 'H2') return `## ${inline(c)}`;
    if (t === 'H3') return `### ${inline(c)}`;
    if (t === 'BLOCKQUOTE') return inline(c).split('\n').map(l => '> ' + l).join('\n');
    if (t === 'PRE') return '```\n' + c.textContent + '\n```';
    if (t === 'HR') return '---';
    if (t === 'UL' || t === 'OL') return [...c.children].map((li, i) => {
      const nested = [...li.children].filter(x => /^(UL|OL)$/.test(x.tagName));
      const clone = li.cloneNode(true); clone.querySelectorAll('ul,ol').forEach(x => x.remove());
      const pre = '  '.repeat(depth) + (c.classList.contains('checklist') ? `- [${li.classList.contains('checked') ? 'x' : ' '}] ` : t === 'OL' ? `${i + 1}. ` : '- ');
      return pre + inline(clone).trim() + nested.map(x => '\n' + block({ children: [x] }, depth + 1)).join('');
    }).join('\n');
    return inline(c);
  }).join('\n\n');
  const tags = note.tags.length ? '\n\n' + note.tags.map(t => '#' + t).join(' ') : '';
  return (note.title ? `# ${note.title}\n\n` : '') + block(d) + tags + '\n';
}
