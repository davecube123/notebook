// Tiny IndexedDB layer. Every collection is loaded into memory at startup;
// writes go to memory first (so the UI is instant) and are persisted async.

const DB_NAME = 'almanac';
const DB_VERSION = 2;
export const STORES = ['notes', 'onething', 'trackers', 'events', 'people', 'habits', 'habitlogs', 'moods', 'meta'];

let dbp;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const db = {
  all: store => tx(store, 'readonly', s => s.getAll()),
  put: (store, obj) => tx(store, 'readwrite', s => s.put(obj)),
  del: (store, id) => tx(store, 'readwrite', s => s.delete(id)),
  clear: store => tx(store, 'readwrite', s => s.clear()),
  bulkPut: (store, list) => tx(store, 'readwrite', s => { list.forEach(o => s.put(o)); }),
};

// In-memory state: { notes: Map, onething: Map, ... }
export const state = Object.fromEntries(STORES.map(s => [s, new Map()]));

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
let notifyQueued = false;
function notify(store) {
  if (notifyQueued) return;
  notifyQueued = true;
  queueMicrotask(() => { notifyQueued = false; listeners.forEach(fn => fn(store)); });
}

export async function loadAll() {
  for (const s of STORES) {
    const rows = await db.all(s);
    state[s] = new Map(rows.map(r => [r.id, r]));
  }
}

export function save(store, obj, { silent = false } = {}) {
  state[store].set(obj.id, obj);
  db.put(store, obj).catch(err => console.error('save failed', store, err));
  if (!silent) notify(store);
  return obj;
}

export function remove(store, id) {
  state[store].delete(id);
  db.del(store, id).catch(err => console.error('delete failed', store, err));
  notify(store);
}

export function list(store) { return [...state[store].values()]; }
export function get(store, id) { return state[store].get(id); }

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- settings live in the meta store ----
const DEFAULT_SETTINGS = {
  id: 'settings',
  theme: 'system',
  accent: '#007AFF',
  weekStart: 1,
  name: '',
  hiddenPersonFields: [],
  customPersonFields: [],
  noteTemplates: [],
  dailyTemplate: 'daily',
  lockHash: null,
  noteSort: 'updated',
  noteGroup: 'date',
};
export function settings() {
  const saved = state.meta.get('settings') || {};
  // the pre-minimal default accent becomes the new system blue
  const accent = saved.accent === '#E0583A' ? DEFAULT_SETTINGS.accent : saved.accent;
  return { ...DEFAULT_SETTINGS, ...saved, ...(accent ? { accent } : {}) };
}
export function setSettings(patch) {
  return save('meta', { ...settings(), ...patch });
}

// ---- backup ----
export function exportData() {
  const out = { app: 'almanac', version: 1, exportedAt: new Date().toISOString() };
  for (const s of STORES) out[s] = list(s);
  return out;
}

export async function importData(data, { merge = true } = {}) {
  if (!data || data.app !== 'almanac') throw new Error('This file is not an Almanac backup.');
  for (const s of STORES) {
    if (!Array.isArray(data[s])) continue;
    if (!merge) { await db.clear(s); state[s].clear(); }
    await db.bulkPut(s, data[s]);
    data[s].forEach(o => state[s].set(o.id, o));
  }
  notify('*');
}

export async function wipeAll() {
  for (const s of STORES) { await db.clear(s); state[s].clear(); }
  notify('*');
}
