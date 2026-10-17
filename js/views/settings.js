// Settings: appearance, profile, privacy lock, backup & restore, storage.
import { settings, setSettings, exportData, importData, wipeAll, list } from '../db.js';
import { esc, download, sha256, today } from '../util.js';
import { icon } from '../icons.js';
import { rerender } from '../router.js';
import { toast, confirmDialog, promptDialog } from '../ui.js';
import { applyTheme, installPrompt } from '../app.js';

// Apple system colors
const ACCENTS = ['#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#30B0C7', '#8E8E93'];

export function renderSettings(main) {
  const st = settings();
  const counts = { notes: list('notes').filter(n => !n.trashed).length, people: list('people').length, days: list('onething').length, events: list('events').length };
  main.innerHTML = `<div class="page settings-page">
    <header class="page-head"><div class="page-title-row"><h1>Settings</h1></div></header>

    <section class="section"><h3 class="group-label">You</h3>
      <div class="card list-card">
        <label class="list-row"><span class="grow">Your name</span><input class="input inline" data-set="name" value="${esc(st.name)}" placeholder="for the greeting"></label>
        <label class="list-row"><span class="grow">Week starts on</span><select class="input inline" data-set="weekStart"><option value="1" ${st.weekStart == 1 ? 'selected' : ''}>Monday</option><option value="0" ${st.weekStart == 0 ? 'selected' : ''}>Sunday</option><option value="6" ${st.weekStart == 6 ? 'selected' : ''}>Saturday</option></select></label>
      </div></section>

    <section class="section"><h3 class="group-label">Appearance</h3>
      <div class="card list-card">
        <div class="list-row"><span class="grow">Theme</span><div class="seg mini">${['system', 'light', 'dark'].map(t => `<button class="${st.theme === t ? 'on' : ''}" data-theme="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div></div>
        <div class="list-row"><span class="grow">Accent</span><div class="swatches">${ACCENTS.map(c => `<button class="swatch ${st.accent === c ? 'sel' : ''}" data-accent="${c}" style="background:${c}" aria-label="Accent ${c}"></button>`).join('')}</div></div>
      </div></section>

    <section class="section"><h3 class="group-label">Privacy</h3>
      <div class="card list-card">
        <div class="list-row"><span class="grow">Passcode lock<div class="muted small">Asks for a passcode when the app opens. It hides the app from casual eyes; data on this device is not encrypted.</div></span>
          ${st.lockHash ? `<button class="btn ghost sm" data-act="unlockset">Turn off</button>` : `<button class="btn ghost sm" data-act="lockset">Set up</button>`}</div>
        ${st.lockHash ? `<div class="list-row"><span class="grow">Lock now</span><button class="btn ghost sm" data-act="locknow">${icon('lock')}Lock</button></div>` : ''}
      </div>
      <p class="muted small pad-x">Everything stays on this device. Nothing is sent anywhere — there is no account and no server.</p>
    </section>

    <section class="section"><h3 class="group-label">Your data</h3>
      <div class="card list-card">
        <div class="list-row"><span class="grow">${counts.notes} notes · ${counts.people} people · ${counts.days} one-things · ${counts.events} logs<div class="muted small storage-line">Checking storage…</div></span></div>
        <div class="list-row"><span class="grow">Back up<div class="muted small">Download everything as a single file. Do this now and then.${st.lastBackup ? ` Last: ${esc(st.lastBackup)}.` : ''}</div></span><button class="btn ghost sm" data-act="export">${icon('download')}Export</button></div>
        <label class="list-row"><span class="grow">Restore<div class="muted small">Merge a backup file into this device.</div></span><span class="btn ghost sm">${icon('upload')}Import<input type="file" accept="application/json,.json" hidden data-import></span></label>
        <div class="list-row"><span class="grow">Keep data safe<div class="muted small">Ask the browser not to clear storage when space is low.</div></span><button class="btn ghost sm" data-act="persist">Protect</button></div>
        <div class="list-row install-row" hidden><span class="grow">Install app<div class="muted small">Add to your home screen for a full-screen, offline app.</div></span><button class="btn primary sm" data-act="install">${icon('install')}Install</button></div>
        <div class="list-row"><span class="grow danger-text">Erase everything</span><button class="btn danger sm" data-act="wipe">Erase</button></div>
      </div></section>

    <section class="section"><h3 class="group-label">Shortcuts</h3>
      <div class="card pad shortcuts">
        <div><kbd>/</kbd> or <kbd>⌘K</kbd> Search everything</div><div><kbd>N</kbd> New note</div>
        <div><kbd>G</kbd> then <kbd>T</kbd>/<kbd>N</kbd>/<kbd>O</kbd>/<kbd>C</kbd>/<kbd>P</kbd>/<kbd>H</kbd> Go to Today, Notes, One Thing, Calendar, People, Habits</div>
        <div>In notes: <kbd>[ ]</kbd> checklist · <kbd>-</kbd> bullet · <kbd>1.</kbd> numbered · <kbd>&gt;</kbd> quote · <kbd>#</kbd> heading · <kbd>\`\`\`</kbd> code · <kbd>---</kbd> divider, each followed by a space</div>
        <div><kbd>⌘B</kbd> <kbd>⌘I</kbd> <kbd>⌘U</kbd> <kbd>⌘K</kbd> link · <kbd>⌘⇧C</kbd> checklist · <kbd>Tab</kbd> indent list</div>
      </div></section>
    <p class="muted small center">Almanac · works offline · v1</p>
  </div>`;
  const page = main.querySelector('.page');

  if (navigator.storage?.estimate) navigator.storage.estimate().then(async e => {
    const persisted = await navigator.storage.persisted?.();
    page.querySelector('.storage-line').textContent = `${(e.usage / 1048576).toFixed(1)} MB used${persisted ? ' · protected from automatic clearing' : ''}`;
  });
  else page.querySelector('.storage-line').textContent = '';
  if (installPrompt.event) page.querySelector('.install-row').hidden = false;

  page.addEventListener('change', async e => {
    const k = e.target.dataset.set;
    if (k) { setSettings({ [k]: k === 'weekStart' ? +e.target.value : e.target.value.trim() }); toast('Saved'); }
    if (e.target.matches('[data-import]') && e.target.files[0]) {
      try {
        const data = JSON.parse(await e.target.files[0].text());
        await importData(data, { merge: true });
        toast('Backup restored'); rerender();
      } catch (err) { toast(err.message || 'Could not import that file'); }
    }
  });
  page.addEventListener('click', async e => {
    const th = e.target.closest('[data-theme]');
    if (th) { setSettings({ theme: th.dataset.theme }); applyTheme(); return rerender(); }
    const ac = e.target.closest('[data-accent]');
    if (ac) { setSettings({ accent: ac.dataset.accent }); applyTheme(); return rerender(); }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    switch (b.dataset.act) {
      case 'export': {
        download(`almanac-backup-${today()}.json`, JSON.stringify(exportData(), null, 1));
        setSettings({ lastBackup: today() }); toast('Backup downloaded'); break;
      }
      case 'persist': {
        const ok = await navigator.storage?.persist?.();
        toast(ok ? 'Storage protected' : 'Your browser decides this — installing the app usually helps'); rerender(); break;
      }
      case 'install': installPrompt.event?.prompt(); break;
      case 'wipe':
        if (await confirmDialog('Delete all notes, people, habits, logs and settings from this device? Export a backup first if unsure.', { ok: 'Erase everything' })) {
          await wipeAll(); toast('Everything erased'); rerender();
        }
        break;
      case 'lockset': {
        const a = await promptDialog('Choose a passcode', { placeholder: '4+ characters', type: 'password' });
        if (!a || a.length < 4) { if (a !== null) toast('Use at least 4 characters'); return; }
        const b2 = await promptDialog('Repeat passcode', { type: 'password' });
        if (a !== b2) { toast("Passcodes didn't match"); return; }
        setSettings({ lockHash: await sha256('almanac:' + a) }); toast('Passcode set'); rerender(); break;
      }
      case 'unlockset': setSettings({ lockHash: null }); toast('Passcode removed'); rerender(); break;
      case 'locknow': document.dispatchEvent(new CustomEvent('lock-now')); break;
    }
  });
}
