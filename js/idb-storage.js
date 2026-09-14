/**
 * IndexedDB storage с кэшем в памяти + localStorage write-through.
 * Чтения — синхронные (из кэша).
 * Записи — синхронные (cache + localStorage), async IDB flush.
 */
const IdbStorage = (() => {
  const DB_NAME = 'sport_tournaments';
  const DB_VERSION = 1;
  const LS_PREFIX = 'idb_';
  let db = null;
  const cache = {};
  const pending = {};
  let ready = false;
  let _readyResolve;
  const readyPromise = new Promise((r) => { _readyResolve = r; });

  function lsKey(key) { return LS_PREFIX + key; }

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(db); };
      req.onerror = () => reject(req.error);
    });
  }

  function idbSet(store, key, value) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function idbDelete(store, key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function idbKeys(store) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAllKeys();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function idbGet(store, key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function flush(key) {
    if (!db || !ready) return;
    const entry = pending[key];
    if (!entry) return;
    delete pending[key];
    if (entry.deleted) {
      idbDelete('kv', key).catch(() => {});
    } else {
      idbSet('kv', key, entry.value).catch(() => {});
    }
  }

  function scheduleFlush(key, value, deleted) {
    if (pending[key]) clearTimeout(pending[key].timer);
    pending[key] = { value, deleted: !!deleted, timer: setTimeout(() => flush(key), 0) };
  }

  function lsWrite(key, value) {
    try { localStorage.setItem(lsKey(key), JSON.stringify(value)); } catch {}
  }

  function lsRead(key) {
    try {
      const raw = localStorage.getItem(lsKey(key));
      if (raw === null) return undefined;
      return JSON.parse(raw);
    } catch { return undefined; }
  }

  function lsDelete(key) {
    try { localStorage.removeItem(lsKey(key)); } catch {}
  }

  async function init() {
    await open();
    const keys = await idbKeys('kv');
    for (const key of keys) {
      const val = await idbGet('kv', key);
      if (val != null) cache[key] = val;
    }
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const lsRawKey = localStorage.key(i);
        if (lsRawKey && lsRawKey.startsWith(LS_PREFIX)) {
          const key = lsRawKey.slice(LS_PREFIX.length);
          if (cache[key] == null) {
            const val = lsRead(key);
            if (val != null) cache[key] = val;
          }
        }
      }
    } catch {}
    ready = true;
    _readyResolve();
    console.log('[IdbStorage] init done, cache keys:', Object.keys(cache).filter(k => cache[k] != null));
  }

  function get(key, fallback) {
    if (fallback === undefined) fallback = null;
    return cache[key] !== undefined ? cache[key] : fallback;
  }

  function set(key, value) {
    cache[key] = value;
    lsWrite(key, value);
    scheduleFlush(key, value, false);
  }

  function del(key) {
    delete cache[key];
    lsDelete(key);
    scheduleFlush(key, null, true);
  }

  function keys() {
    return Object.keys(cache);
  }

  function onChange(key, cb) {
    const bc = new BroadcastChannel('idb-storage');
    bc.onmessage = (e) => {
      if (e.data.key === key) cb(e.data);
    };
    return bc;
  }

  return { init, get, set, del, keys, onChange, ready: () => readyPromise };
})();

window.IdbStorage = IdbStorage;
