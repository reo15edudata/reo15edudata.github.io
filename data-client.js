const EDU15DataClient = (() => {
  const DB_NAME = "edu15-dashboard-cache";
  const STORE_NAME = "datasets";
  const CACHE_TTL = 5 * 60 * 1000;
  const CACHE_VERSION = "schema-2026-07-26";

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("IndexedDB unavailable"));
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function readCache(key) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME).objectStore(STORE_NAME).get(key);
      request.onsuccess = () => {
        const record = request.result;
        resolve(record && Date.now() - record.savedAt < CACHE_TTL ? record.rows : null);
      };
      request.onerror = () => reject(request.error);
    }).finally(() => database.close());
  }

  async function writeCache(key, rows) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({ key, rows, savedAt: Date.now() });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    }).finally(() => database.close());
  }

  async function fetchAllPages(baseUrl, dbKey, sheetName) {
    const key = `${CACHE_VERSION}|${dbKey}|${sheetName}`;
    window.reportPageProgress?.(key, 0, 1);
    try {
      const cachedRows = await readCache(key);
      if (cachedRows) {
        window.reportPageProgress?.(key, 1, 1);
        return cachedRows;
      }
    } catch (error) {
      console.warn("Dashboard cache read skipped", error);
    }

    const rows = [];
    let offset = 0;
    const limit = 10000;
    while (true) {
      const url = `${baseUrl}?dbKey=${encodeURIComponent(dbKey)}&sheetName=${encodeURIComponent(sheetName)}&limit=${limit}&offset=${offset}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${sheetName}: HTTP ${response.status}`);
      const result = await response.json();
      if (!result.success) throw new Error(`${sheetName}: ${result.message || "โหลดข้อมูลไม่สำเร็จ"}`);
      rows.push(...(result.data || []));
      window.reportPageProgress?.(key, rows.length, result.totalRows || rows.length);
      if (!result.hasMore || !result.data?.length) break;
      offset += result.data.length;
    }

    writeCache(key, rows).catch(error => console.warn("Dashboard cache write skipped", error));
    window.reportPageProgress?.(key, 1, 1);
    return rows;
  }

  async function clear() {
    try {
      const database = await openDatabase();
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).clear();
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    } catch (error) {
      console.warn("Dashboard cache clear skipped", error);
    }
  }

  return { fetchAllPages, clear };
})();

window.EDU15DataClient = EDU15DataClient;
