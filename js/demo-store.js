/* Wersja pokazowa panelu.
   Realizacje dodane w panelu zapisują się w przeglądarce (IndexedDB) na tym jednym urządzeniu,
   a strona otwarta na tym urządzeniu pokazuje je zamiast danych z serwera.
   Po przeniesieniu strony na serwer wystarczy podmienić ten moduł na zapis przez API serwera. */
(() => {
  "use strict";
  const DB_NAME = "mg-demo";
  const FLAG = "mg-demo";
  let dbPromise = null;

  const supported = () => {
    try { return "indexedDB" in window && window.indexedDB !== null; } catch (e) { return false; }
  };

  const open = () => {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("media")) db.createObjectStore("media");
        if (!db.objectStoreNames.contains("state")) db.createObjectStore("state");
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); dbPromise = null; };
        resolve(db);
      };
      req.onerror = () => { dbPromise = null; reject(req.error); };
    });
    return dbPromise;
  };

  const request = async (store, mode, action) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = action(tx.objectStore(store));
      let result;
      if (req) req.onsuccess = () => { result = req.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("abort"));
    });
  };

  const flagOn = () => { try { return localStorage.getItem(FLAG) === "1"; } catch (e) { return false; } };

  window.MGDemo = {
    supported,
    /** czy na tym urządzeniu są zmiany z panelu */
    active: () => supported() && flagOn(),

    async loadData() {
      if (!this.active()) return null;
      return (await request("state", "readonly", (s) => s.get("data"))) || null;
    },

    async saveData(data) {
      await request("state", "readwrite", (s) => s.put(data, "data"));
      try { localStorage.setItem(FLAG, "1"); } catch (e) { /* bez flagi strona pokaże dane z serwera */ }
    },

    putMedia: (path, blob) => request("media", "readwrite", (s) => s.put(blob, path)),
    getMedia: (path) => request("media", "readonly", (s) => s.get(path)),

    async deleteMedia(paths) {
      for (const p of paths) await request("media", "readwrite", (s) => s.delete(p));
    },

    /** usuwa wszystkie zmiany z tego urządzenia */
    async reset() {
      try { localStorage.removeItem(FLAG); } catch (e) { /* nic */ }
      if (dbPromise) { try { (await dbPromise).close(); } catch (e) { /* nic */ } dbPromise = null; }
      await new Promise((resolve) => {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      });
    },

    /** zwraca kopię danych, w której ścieżki local/... są zamienione na adresy blob: */
    async resolve(data) {
      const out = JSON.parse(JSON.stringify(data));
      for (const it of out.items || []) {
        for (const key of ["src", "thumb", "poster"]) {
          if (typeof it[key] === "string" && it[key].indexOf("local/") === 0) {
            const blob = await this.getMedia(it[key]);
            it[key] = blob ? URL.createObjectURL(blob) : "";
          }
        }
      }
      return out;
    }
  };
})();
