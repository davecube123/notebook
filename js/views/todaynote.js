// "Today's note" on the Today page: today's daily note, made from the template you
// choose, shown as its sections, with a quick capture that adds a line to it.
import { save, remove, setSettings } from '../db.js';
import { esc, today, hm, normTag, htmlToText, haptic } from '../util.js';
import { icon } from '../icons.js';
import { navigate } from '../router.js';
import { menu, toast } from '../ui.js';
import { sanitize, openNoteAtSection } from './editor.js';
import { TEMPLATES, userTemplates, findTemplate, dailyTemplateId, dailyNote, ensureDaily } from './templates.js';

// The note (or the template, before the note exists) as [heading, what's written under it]
function sections(html) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  const out = [];
  for (const el of d.children) {
    if (/^H[1-3]$/.test(el.tagName)) { out.push([el.textContent.trim(), []]); continue; }
    if (!out.length) continue;
    // one line per paragraph or list item
    const parts = /^(UL|OL)$/.test(el.tagName) ? [...el.children].map(li => li.textContent) : [el.textContent];
    out.at(-1)[1].push(...parts.map(x => (x || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
  }
  return out.map(([h, lines]) => [h, lines.length > 3 ? [...lines.slice(0, 3), `+${lines.length - 3} more`] : lines]);
}

const templateHTML = id => { const t = findTemplate(id); return t ? (t.html instanceof Function ? t.html() : t.html) : ''; };

export function todayNoteCard() {
  const n = dailyNote(today());
  const tid = dailyTemplateId(), tpl = findTemplate(tid);
  const secs = sections(n ? n.html : templateHTML(tid));
  return `<div class="card pad today-note">
    <div class="card-head"><h3>${icon('today')}Today’s note</h3>
      <button class="chip tn-template" data-tn-template aria-label="Daily template: ${esc(tpl?.name || 'Daily note')}">${esc(tpl?.name || 'Daily note')}${icon('chevD')}</button></div>
    ${secs.length ? `<div class="tn-sections">${secs.map(([h, txt], i) => `<button class="tn-sec" data-tn-sec="${i}">
      <span class="tn-h">${esc(h)}</span><span class="tn-v ${txt.length ? '' : 'faint'}">${txt.length ? txt.map(l => `<span>${esc(l.length > 90 ? l.slice(0, 90) + '…' : l)}</span>`).join('') : 'Tap to write'}</span></button>`).join('')}</div>`
      : `<button class="tn-sec" data-tn-open><span class="tn-v">${n?.text ? esc(n.text.slice(0, 120)) : 'Tap to start today’s note'}</span></button>`}
    <form class="capture" data-tn-capture><input class="input" name="q" placeholder="Capture a thought… (#tags)" autocomplete="off" enterkeyhint="done" aria-label="Capture to today’s note"><button class="icon-btn accent" aria-label="Add to today’s note">${icon('plus')}</button></form>
    ${n && !n.draft ? `<button class="link small tn-open" data-tn-open>Open today’s note${icon('chevR')}</button>` : ''}
  </div>`;
}

// Add a line to today's note under a "Captured" heading (made once)
function capture(raw) {
  const tags = [...raw.matchAll(/#([\w/-]+)/g)].map(m => normTag(m[1])).filter(Boolean);
  const text = raw.replace(/#[\w/-]+/g, '').replace(/\s+/g, ' ').trim();
  if (!text) return false;
  const n = ensureDaily(today());
  const d = document.createElement('div');
  d.innerHTML = sanitize(n.html || '');
  let h = [...d.querySelectorAll('h2, h3')].find(x => x.textContent.trim() === 'Captured');
  if (!h) { h = document.createElement('h3'); h.textContent = 'Captured'; d.append(h); }
  let list = h.nextElementSibling;
  if (!list || list.tagName !== 'UL') { list = document.createElement('ul'); h.after(list); }
  const li = document.createElement('li');
  li.textContent = `${hm()} · ${text}`;
  list.append(li);
  const html = d.innerHTML;
  save('notes', { ...n, html, text: htmlToText(html), tags: [...new Set([...(n.tags || []), ...tags])], draft: false, seeded: false, updated: Date.now() });
  return true;
}

export function bindTodayNote(root, after) {
  root.addEventListener('click', e => {
    const sec = e.target.closest('[data-tn-sec]');
    if (sec) { const n = ensureDaily(today()); openNoteAtSection(+sec.dataset.tnSec); navigate(`#/notes/${n.id}`); return; }
    if (e.target.closest('[data-tn-open]')) { const n = ensureDaily(today()); navigate(`#/notes/${n.id}`); return; }
    const tp = e.target.closest('[data-tn-template]');
    if (tp) {
      const cur = dailyTemplateId(), started = dailyNote(today()) && !dailyNote(today()).draft;
      const pick = id => {
        setSettings({ dailyTemplate: id });
        const d = dailyNote(today());
        if (d && d.draft) remove('notes', d.id); // nothing written yet: remake it from the new template
        toast(started ? `Today’s note is already started; tomorrow’s will use “${findTemplate(id).name}”` : `Daily note: ${findTemplate(id).name}`);
        after();
      };
      menu(tp, [
        ...TEMPLATES.map(t => ({ label: t.name, checked: t.id === cur, action: () => pick(t.id) })),
        ...(userTemplates().length ? ['-', ...userTemplates().map(t => ({ label: t.name, checked: t.id === cur, action: () => pick(t.id) }))] : []),
      ]);
    }
  });
  root.addEventListener('submit', e => {
    const f = e.target.closest('[data-tn-capture]');
    if (!f) return;
    e.preventDefault();
    const raw = f.q.value.trim(); if (!raw) return;
    if (capture(raw)) {
      haptic(8);
      toast('Added to today’s note', { action: 'Open', onAction: () => navigate(`#/notes/${dailyNote(today()).id}`) });
      after();
      setTimeout(() => document.querySelector('[data-tn-capture] input')?.focus(), 50);
    }
  });
}
