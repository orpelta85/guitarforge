export interface LibraryRecording {
  id: string;
  exerciseId: string;
  exerciseName: string;
  savedAt: string;
  blob: Blob;
}

const IDB_NAME = "gf-recordings-library";
const IDB_STORE = "recordings";

function openLibraryDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveToLibrary(exerciseId: string, exerciseName: string, blob: Blob): Promise<string> {
  const db = await openLibraryDB();
  const id = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record = {
    id,
    exerciseId,
    exerciseName,
    savedAt: new Date().toISOString(),
    blob,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(record);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLibraryRecordings(): Promise<LibraryRecording[]> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = () => resolve(req.result as LibraryRecording[]);
    req.onerror = () => reject(req.error);
  });
}

export async function getExerciseRecordings(exerciseId: string): Promise<LibraryRecording[]> {
  const all = await getLibraryRecordings();
  return all.filter(r => r.exerciseId === exerciseId);
}

export async function deleteLibraryRecording(id: string): Promise<void> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
