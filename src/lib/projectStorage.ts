// ── Studio Project Persistence ──
// Saves Studio session state (tracks, mixer settings, drum patterns, recorded
// audio blobs) to IndexedDB so a page refresh no longer wipes the user's work.
// Phase 3a — single "current-project" slot only; named project list is Phase 4.

const IDB_NAME = "gf-studio-projects";
const IDB_VERSION = 1;
const STORE_PROJECTS = "projects"; // meta + serialized state, keyed by project id
const STORE_BLOBS = "blobs";       // recorded audio blobs, keyed by `${projectId}:${trackId}`

export const CURRENT_PROJECT_ID = "current-project";

// Serializable subset of StudioTrack — strips Tone refs, audioUrl, and live blobs
// (blobs are stored separately in the BLOBS store and re-attached on load).
export interface SerializedTrack {
  id: number;
  name: string;
  color: string;
  type: "recording" | "import" | "suno" | "drum" | "youtube";
  volume: number;
  muted: boolean;
  solo: boolean;
  pan: number;
  drumPattern?: boolean[][];
  videoId?: string;
  videoTitle?: string;
  videoThumbnail?: string;
  hasBlob: boolean;
}

export interface StudioProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  bpm: number;
  masterVol: number;
  studioPresetId: string;
  metronomeOn: boolean;
  metronomeVolume: number;
  tracks: SerializedTrack[];
}

export interface StudioProjectMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  trackCount: number;
}

// Loaded project: same as StudioProject but blobs are attached as an id->Blob map
export interface LoadedProject extends StudioProject {
  blobs: Map<number, Blob>;
}

function openProjectsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS); // out-of-line keys: `${projectId}:${trackId}`
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function blobKey(projectId: string, trackId: number): string {
  return `${projectId}:${trackId}`;
}

export async function saveProject(
  project: StudioProject,
  blobs: Map<number, Blob>,
): Promise<void> {
  const db = await openProjectsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PROJECTS, STORE_BLOBS], "readwrite");
    const projectStore = tx.objectStore(STORE_PROJECTS);
    const blobStore = tx.objectStore(STORE_BLOBS);

    // Mark which tracks have blobs (so loadProject knows to look them up).
    const projectToSave: StudioProject = {
      ...project,
      tracks: project.tracks.map((t) => ({ ...t, hasBlob: blobs.has(t.id) })),
    };
    projectStore.put(projectToSave);

    // Replace blobs: delete any old ones for tracks we don't have anymore,
    // then put the current set.
    const trackIds = new Set(project.tracks.map((t) => t.id));
    const cursorReq = blobStore.openKeyCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        const key = String(cursor.key);
        if (key.startsWith(`${project.id}:`)) {
          const trackIdStr = key.slice(project.id.length + 1);
          const trackId = Number(trackIdStr);
          if (!trackIds.has(trackId) || !blobs.has(trackId)) {
            blobStore.delete(cursor.key);
          }
        }
        cursor.continue();
      } else {
        // Cursor done — write current blobs.
        for (const [trackId, blob] of blobs.entries()) {
          blobStore.put(blob, blobKey(project.id, trackId));
        }
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadProject(id: string): Promise<LoadedProject | null> {
  const db = await openProjectsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PROJECTS, STORE_BLOBS], "readonly");
    const projectReq = tx.objectStore(STORE_PROJECTS).get(id);
    projectReq.onsuccess = () => {
      const project = projectReq.result as StudioProject | undefined;
      if (!project) {
        resolve(null);
        return;
      }
      const blobs = new Map<number, Blob>();
      const tracksWithBlobs = project.tracks.filter((t) => t.hasBlob);
      if (tracksWithBlobs.length === 0) {
        resolve({ ...project, blobs });
        return;
      }
      const blobStore = tx.objectStore(STORE_BLOBS);
      let pending = tracksWithBlobs.length;
      for (const track of tracksWithBlobs) {
        const blobReq = blobStore.get(blobKey(id, track.id));
        blobReq.onsuccess = () => {
          if (blobReq.result instanceof Blob) {
            blobs.set(track.id, blobReq.result);
          }
          pending--;
          if (pending === 0) resolve({ ...project, blobs });
        };
        blobReq.onerror = () => {
          pending--;
          if (pending === 0) resolve({ ...project, blobs });
        };
      }
    };
    projectReq.onerror = () => reject(projectReq.error);
  });
}

export async function listProjects(): Promise<StudioProjectMeta[]> {
  const db = await openProjectsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, "readonly");
    const req = tx.objectStore(STORE_PROJECTS).getAll();
    req.onsuccess = () => {
      const projects = (req.result as StudioProject[]) || [];
      resolve(
        projects.map((p) => ({
          id: p.id,
          name: p.name,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          trackCount: p.tracks.length,
        })),
      );
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteProject(id: string): Promise<void> {
  const db = await openProjectsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PROJECTS, STORE_BLOBS], "readwrite");
    tx.objectStore(STORE_PROJECTS).delete(id);
    const blobStore = tx.objectStore(STORE_BLOBS);
    const cursorReq = blobStore.openKeyCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        if (String(cursor.key).startsWith(`${id}:`)) blobStore.delete(cursor.key);
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
