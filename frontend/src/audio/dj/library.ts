// Библиотека «Мои треки»: файлы с телефона (input type=file), ID3-теги, обложка,
// хранение в IndexedDB (треки переживают перезапуск Mini App).

export interface StoredTrack {
  id: string;
  title: string;
  artist: string;
  name: string;
  size: number;
  addedAt: number;
  bpm?: number;
  duration?: number;
  blob: Blob;
  art?: Blob;
}

export interface TagInfo {
  title?: string;
  artist?: string;
  art?: Blob;
}

const DB_NAME = 'opendeck-dj';
const STORE = 'tracks';
const MAX_TRACKS = 30;

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memoryFallback = new Map<string, StoredTrack>();

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (!('indexedDB' in window)) return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listTracks(): Promise<StoredTrack[]> {
  const db = await openDb();
  let all: StoredTrack[] = [...memoryFallback.values()];
  if (db) {
    try {
      all = all.concat((await tx(db, 'readonly', (s) => s.getAll())) as StoredTrack[]);
    } catch {
      /* ignore */
    }
  }
  return all.sort((a, b) => b.addedAt - a.addedAt);
}

export async function saveTrack(t: StoredTrack): Promise<void> {
  const db = await openDb();
  if (!db) {
    memoryFallback.set(t.id, t);
    return;
  }
  try {
    await tx(db, 'readwrite', (s) => s.put(t));
    const all = await listTracks();
    for (const old of all.slice(MAX_TRACKS)) await deleteTrack(old.id);
  } catch {
    // квота/приватный режим — держим трек хотя бы в памяти сессии
    memoryFallback.set(t.id, t);
  }
}

export async function updateTrack(id: string, patch: Partial<StoredTrack>): Promise<void> {
  const mem = memoryFallback.get(id);
  if (mem) {
    memoryFallback.set(id, { ...mem, ...patch });
    return;
  }
  const db = await openDb();
  if (!db) return;
  try {
    const cur = (await tx(db, 'readonly', (s) => s.get(id))) as StoredTrack | undefined;
    if (cur) await tx(db, 'readwrite', (s) => s.put({ ...cur, ...patch }));
  } catch {
    /* ignore */
  }
}

export async function deleteTrack(id: string): Promise<void> {
  memoryFallback.delete(id);
  const db = await openDb();
  if (!db) return;
  try {
    await tx(db, 'readwrite', (s) => s.delete(id));
  } catch {
    /* ignore */
  }
}

// ------------------------------------------------------------------ ID3v2

function decodeText(bytes: Uint8Array, enc: number): string {
  try {
    let label = 'latin1';
    if (enc === 1) label = 'utf-16';
    else if (enc === 2) label = 'utf-16be';
    else if (enc === 3) label = 'utf-8';
    return new TextDecoder(label).decode(bytes).replace(/\0+$/g, '').replace(/^\uFEFF/, '').trim();
  } catch {
    return '';
  }
}

function findTerminator(b: Uint8Array, from: number, enc: number): number {
  if (enc === 1 || enc === 2) {
    for (let i = from; i + 1 < b.length; i += 2) if (b[i] === 0 && b[i + 1] === 0) return i;
    return b.length;
  }
  for (let i = from; i < b.length; i++) if (b[i] === 0) return i;
  return b.length;
}

export async function readTags(file: Blob): Promise<TagInfo> {
  try {
    const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    if (head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return {};
    const ver = head[3];
    const size = ((head[6] & 0x7f) << 21) | ((head[7] & 0x7f) << 14) | ((head[8] & 0x7f) << 7) | (head[9] & 0x7f);
    const b = new Uint8Array(await file.slice(10, 10 + Math.min(size, 8_000_000)).arrayBuffer());
    const info: TagInfo = {};
    let p = 0;
    const v22 = ver === 2;
    const hdr = v22 ? 6 : 10;
    while (p + hdr <= b.length) {
      const id = String.fromCharCode(...b.subarray(p, p + (v22 ? 3 : 4)));
      if (!/^[A-Z0-9]{3,4}$/.test(id)) break;
      let len: number;
      if (v22) len = (b[p + 3] << 16) | (b[p + 4] << 8) | b[p + 5];
      else if (ver === 4) len = ((b[p + 4] & 0x7f) << 21) | ((b[p + 5] & 0x7f) << 14) | ((b[p + 6] & 0x7f) << 7) | (b[p + 7] & 0x7f);
      else len = ((b[p + 4] << 24) | (b[p + 5] << 16) | (b[p + 6] << 8) | b[p + 7]) >>> 0;
      const body = b.subarray(p + hdr, p + hdr + len);
      p += hdr + len;
      if (!len || body.length < 2) continue;
      if (id === 'TIT2' || id === 'TT2') info.title = decodeText(body.subarray(1), body[0]);
      else if (id === 'TPE1' || id === 'TP1') info.artist = decodeText(body.subarray(1), body[0]);
      else if ((id === 'APIC' || id === 'PIC') && !info.art) {
        const enc = body[0];
        let q = 1;
        let mime = 'image/jpeg';
        if (v22) {
          const fmt = String.fromCharCode(body[1], body[2], body[3]).toUpperCase();
          mime = fmt === 'PNG' ? 'image/png' : 'image/jpeg';
          q = 4;
        } else {
          const mEnd = findTerminator(body, 1, 0);
          mime = decodeText(body.subarray(1, mEnd), 0) || mime;
          if (!mime.includes('/')) mime = `image/${mime.toLowerCase()}`;
          q = mEnd + 1;
        }
        q += 1; // picture type
        const dEnd = findTerminator(body, q, enc);
        q = dEnd + (enc === 1 || enc === 2 ? 2 : 1);
        if (q < body.length) info.art = new Blob([body.slice(q)], { type: mime });
      }
    }
    return info;
  } catch {
    return {};
  }
}

/** «Artist - Title.mp3» -> {artist, title} */
export function parseFileName(name: string): { title: string; artist: string } {
  const base = name.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/_/g, ' ').trim();
  const m = base.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (m) return { artist: m[1].trim(), title: m[2].trim() };
  return { artist: 'Мой трек', title: base || 'Без названия' };
}

export function decodeAudio(ctx: BaseAudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    let done = false;
    const ok = (b: AudioBuffer) => {
      if (!done) {
        done = true;
        resolve(b);
      }
    };
    const fail = (e: unknown) => {
      if (!done) {
        done = true;
        reject(e instanceof Error ? e : new Error('decode failed'));
      }
    };
    try {
      const p = ctx.decodeAudioData(data, ok, fail) as Promise<AudioBuffer> | undefined;
      if (p && typeof p.then === 'function') p.then(ok, fail);
    } catch (e) {
      fail(e);
    }
  });
}

export function newTrackId(): string {
  return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export const AUDIO_ACCEPT = 'audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.oga,.opus,.aif,.aiff';
