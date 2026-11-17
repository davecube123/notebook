// Find the "prompts" in a note or template, however they were typed:
// headings, a line that is all bold, a short line ending in ":" or "?",
// or an inline label like "Mood: good". Shared by the Today's note card
// (to show the sections) and the editor (to open a note at one).
const norm = s => (s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const boldText = nodes => nodes.map(n => n.nodeType !== 1 ? '' : /^(B|STRONG)$/.test(n.tagName) ? n.textContent : [...n.querySelectorAll('b, strong')].map(b => b.textContent).join('')).join('');
const BLOCKS = 'p, div, ul, ol, h1, h2, h3, blockquote, pre';

// Every visual line, with the element to put the caret in
// (and, for a line inside a paragraph, the <br> that ends it)
function linesOf(root, out = []) {
  for (const el of root.children) {
    const t = el.tagName;
    if (/^(UL|OL)$/.test(t)) { for (const li of el.children) out.push({ el: li, text: norm([...li.childNodes].filter(n => !(n.nodeType === 1 && /^(UL|OL)$/.test(n.tagName))).map(n => n.textContent).join('')), kind: 'li' }); continue; }
    if (/^H[1-3]$/.test(t)) { out.push({ el, text: norm(el.textContent), kind: 'h' }); continue; }
    if (t === 'DIV' && el.querySelector(BLOCKS)) { linesOf(el, out); continue; }
    // a paragraph can hold several lines separated by <br>
    let seg = [];
    const flush = (br = null) => { const text = norm(seg.map(n => n.textContent).join('')); out.push({ el, br, text, bold: norm(boldText(seg)), kind: 'p' }); seg = []; };
    for (const n of el.childNodes) { if (n.nodeName === 'BR') flush(n); else seg.push(n); }
    if (seg.length || !out.length || out.at(-1).el !== el) flush();
  }
  return out;
}

function headOf(line) {
  const t = line.text;
  if (!t) return null;
  if (line.kind === 'h') return { title: t };
  if (line.kind !== 'p' || t.length > 80) return null;
  if (line.bold && line.bold === t) return { title: t.replace(/:$/, '') };
  if (t.length <= 60 && /[:?]$/.test(t)) return { title: t.replace(/:$/, '') };
  const m = t.match(/^([A-Za-zÀ-￿][^:]{0,38}):\s+(.+)$/);
  if (m) return { title: m[1], value: m[2] };
  return null;
}

// [{ title, lines: [text], head: line, last: line }]
export function noteSections(root) {
  const out = [];
  for (const line of linesOf(root)) {
    const h = headOf(line);
    if (h) { out.push({ title: h.title, lines: h.value ? [h.value] : [], head: line, last: line }); continue; }
    if (!out.length) continue;
    const s = out.at(-1);
    s.last = line;
    if (line.text) s.lines.push(line.text);
  }
  return out;
}

export function htmlSections(html) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  return noteSections(d);
}

// The first few written lines, for notes with no prompts at all
export function htmlLines(html, n = 4) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  return linesOf(d).map(l => l.text).filter(Boolean).slice(0, n);
}
