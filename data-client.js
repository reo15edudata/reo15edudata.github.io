const EDU15DataClient = (() => {
  const DB_NAME = "edu15-dashboard-cache";
  const STORE_NAME = "datasets";
  const CACHE_TTL = 60 * 60 * 1000;
  const STALE_TTL = 24 * 60 * 60 * 1000;
  const CACHE_VERSION = "schema-2026-07-31-v4";
  const pendingRequests = new Map();

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
        if (!record || Date.now() - record.savedAt > STALE_TTL) {
          resolve(null);
          return;
        }
        resolve({
          value: record.value ?? record.rows,
          fresh: Date.now() - record.savedAt < CACHE_TTL
        });
      };
      request.onerror = () => reject(request.error);
    }).finally(() => database.close());
  }

  async function writeCache(key, value) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({ key, value, savedAt: Date.now() });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    }).finally(() => database.close());
  }

  function normalizedOptions(options = {}) {
    const filters = Object.fromEntries(
      Object.entries(options.filters || {})
        .filter(([, value]) => value !== "" && value !== null && value !== undefined && (!Array.isArray(value) || value.length))
        .sort(([left], [right]) => left.localeCompare(right))
    );
    return { ...options, filters };
  }

  function cacheKey(type, dbKey, sheetName, options = {}) {
    return `${CACHE_VERSION}|${type}|${dbKey}|${sheetName}|${JSON.stringify(normalizedOptions(options))}`;
  }

  function buildUrl(baseUrl, parameters) {
    const url = new URL(baseUrl);
    Object.entries(parameters).forEach(([name, value]) => {
      if (value === "" || value === null || value === undefined) return;
      const serialized = Array.isArray(value) ? value.join("|") : String(value);
      if (serialized) url.searchParams.set(name, serialized);
    });
    return url.toString();
  }

  async function requestJson(url, progressKey = "") {
    if (progressKey) window.reportPageProgress?.(progressKey, 8, 100);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (progressKey) window.reportPageProgress?.(progressKey, 42, 100);
    let responseText;
    const totalBytes = Number(response.headers.get("content-length"));
    if (progressKey && response.body && Number.isFinite(totalBytes) && totalBytes > 0) {
      const reader = response.body.getReader();
      const chunks = [];
      let loadedBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loadedBytes += value.byteLength;
        window.reportPageProgress?.(progressKey, 42 + Math.min(48, loadedBytes / totalBytes * 48), 100);
      }
      const combined = new Uint8Array(loadedBytes);
      let offset = 0;
      chunks.forEach(chunk => {
        combined.set(chunk, offset);
        offset += chunk.byteLength;
      });
      responseText = new TextDecoder().decode(combined);
    } else {
      responseText = await response.text();
    }
    if (progressKey) window.reportPageProgress?.(progressKey, 94, 100);
    const result = JSON.parse(responseText);
    if (!result.success) throw new Error(result.message || "โหลดข้อมูลไม่สำเร็จ");
    return result;
  }

  async function fetchRowsFromNetwork(baseUrl, dbKey, sheetName, options = {}, progressKey, reportProgress = true) {
    const normalized = normalizedOptions(options);
    const rows = [];
    let offset = 0;
    const limit = 10000;
    if (reportProgress) window.reportPageProgress?.(progressKey, 0, 1);

    while (true) {
      const url = buildUrl(baseUrl, {
        dbKey,
        sheetName,
        limit,
        offset,
        ...normalized.filters
      });
      const result = await requestJson(url);
      rows.push(...(result.data || []));
      if (reportProgress) {
        window.reportPageProgress?.(progressKey, rows.length, result.totalRows || rows.length);
      }
      if (!result.hasMore || !result.data?.length) break;
      offset += result.data.length;
    }

    if (reportProgress) window.reportPageProgress?.(progressKey, 1, 1);
    return rows;
  }

  function refreshInBackground(key, loader) {
    loader()
      .then(value => writeCache(key, value).then(() => {
        window.dispatchEvent(new CustomEvent("edu15:data-updated", { detail: { key } }));
      }))
      .catch(error => console.warn("Dashboard background refresh skipped", error));
  }

  async function cachedRequest(key, loader, backgroundLoader = loader) {
    if (pendingRequests.has(key)) return pendingRequests.get(key);
    window.reportPageProgress?.(key, 2, 100);

    try {
      const cached = await readCache(key);
      if (cached) {
        window.reportPageProgress?.(key, 1, 1);
        if (!cached.fresh) refreshInBackground(key, backgroundLoader);
        return cached.value;
      }
    } catch (error) {
      console.warn("Dashboard cache read skipped", error);
    }

    if (pendingRequests.has(key)) return pendingRequests.get(key);
    const request = loader()
      .then(value => {
        window.reportPageProgress?.(key, 1, 1);
        writeCache(key, value).catch(error => console.warn("Dashboard cache write skipped", error));
        return value;
      })
      .finally(() => pendingRequests.delete(key));
    pendingRequests.set(key, request);
    return request;
  }

  async function fetchAllPages(baseUrl, dbKey, sheetName, options = {}) {
    const key = cacheKey("rows", dbKey, sheetName, options);
    return cachedRequest(
      key,
      () => fetchRowsFromNetwork(baseUrl, dbKey, sheetName, options, key, true),
      () => fetchRowsFromNetwork(baseUrl, dbKey, sheetName, options, key, false)
    );
  }

  async function fetchMetadata(baseUrl, dbKey, sheetName, fields) {
    const options = { fields: [...fields].sort() };
    const key = cacheKey("metadata", dbKey, sheetName, options);
    return cachedRequest(key, async () => {
      try {
        const result = await requestJson(buildUrl(baseUrl, {
          action: "metadata",
          dbKey,
          sheetName,
          fields
        }), key);
        if (result.mode === "metadata" && result.data && !Array.isArray(result.data)) return result.data;
      } catch (error) {
        console.warn(`Metadata endpoint fallback for ${sheetName}`, error);
      }

      const rows = await fetchAllPages(baseUrl, dbKey, sheetName);
      return Object.fromEntries(fields.map(field => [
        field,
        [...new Set(rows.map(row => String(row[field] ?? "").trim()).filter(Boolean))]
      ]));
    });
  }

  async function fetchSummary(baseUrl, dbKey, sheetName, { groupBy = [], metrics = [], filters = {} } = {}) {
    const options = { groupBy: [...groupBy], metrics: [...metrics], filters };
    const key = cacheKey("summary", dbKey, sheetName, options);
    return cachedRequest(key, async () => {
      try {
        const result = await requestJson(buildUrl(baseUrl, {
          action: "summary",
          dbKey,
          sheetName,
          groupBy,
          metrics,
          ...filters
        }), key);
        if (result.mode === "summary" && Array.isArray(result.data)) return result.data;
      } catch (error) {
        console.warn(`Summary endpoint fallback for ${sheetName}`, error);
      }

      const rows = await fetchAllPages(baseUrl, dbKey, sheetName, { filters });
      const groups = new Map();
      rows.forEach(row => {
        const keyValues = groupBy.map(field => String(row[field] ?? ""));
        const groupKey = JSON.stringify(keyValues);
        if (!groups.has(groupKey)) {
          groups.set(groupKey, Object.fromEntries([
            ...groupBy.map((field, index) => [field, keyValues[index]]),
            ...metrics.map(field => [field, 0])
          ]));
        }
        const target = groups.get(groupKey);
        metrics.forEach(field => {
          const value = Number(String(row[field] ?? 0).replace(/,/g, ""));
          target[field] += Number.isFinite(value) ? value : 0;
        });
      });
      return [...groups.values()];
    });
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

  return { fetchAllPages, fetchMetadata, fetchSummary, clear };
})();

window.EDU15DataClient = EDU15DataClient;
