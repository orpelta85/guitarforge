import type { SavedRecording } from "@/lib/types";

const IDB_NAME = "gf-recorder";
const IDB_STORE = "recordings";

export function openRecorderDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSaveRecording(key: string, list: SavedRecording[], blobs: Map<number, Blob>): Promise<void> {
  const db = await openRecorderDB();
  // Use actual blob map keys (newest-first) to match list order
  const blobKeys = Array.from(blobs.keys()).sort((a, b) => b - a);
  const metaList = list.map((r, i) => ({ dt: r.dt, idx: blobKeys[i] ?? i }));
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    store.put(JSON.stringify(metaList), `meta-${key}`);
    for (const [idx, blob] of blobs.entries()) {
      store.put(blob, `blob-${key}-${idx}`);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbLoadRecordings(key: string): Promise<{ list: SavedRecording[]; blobs: Map<number, Blob> }> {
  const db = await openRecorderDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const metaReq = store.get(`meta-${key}`);
    metaReq.onsuccess = () => {
      if (!metaReq.result) {
        resolve({ list: [], blobs: new Map() });
        return;
      }
      const metaList: { dt: string; idx: number }[] = JSON.parse(metaReq.result);
      const blobs = new Map<number, Blob>();
      const list: SavedRecording[] = [];
      let loaded = 0;
      if (metaList.length === 0) { resolve({ list, blobs }); return; }
      for (const meta of metaList) {
        const blobReq = store.get(`blob-${key}-${meta.idx}`);
        blobReq.onsuccess = () => {
          if (blobReq.result instanceof Blob) {
            blobs.set(meta.idx, blobReq.result);
            list.push({ dt: meta.dt, d: URL.createObjectURL(blobReq.result) });
          }
          loaded++;
          if (loaded === metaList.length) resolve({ list, blobs });
        };
        blobReq.onerror = () => { loaded++; if (loaded === metaList.length) resolve({ list, blobs }); };
      }
    };
    metaReq.onerror = () => reject(metaReq.error);
  });
}

export async function idbDeleteRecording(key: string, idx: number): Promise<void> {
  const db = await openRecorderDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    store.delete(`blob-${key}-${idx}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
