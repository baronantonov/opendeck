// High-level loader: loads either built-in synthesized techno demos or user
// audio files (MP3/WAV/M4A/FLAC/OGG/AAC) from smartphone into Deck A or Deck B.

import { analyzeAudio } from './analysis';
import { buildDemoTrack, DemoId, DEMOS } from './demoTracks';
import { DeckId, djEngine, TrackInfo } from './DjEngine';
import { decodeAudio, newTrackId, parseFileName, readTags, saveTrack, StoredTrack, updateTrack } from './library';

const artUrlCache = new Map<string, string>();

function getArtUrl(id: string, blob?: Blob): string | undefined {
  if (!blob) return undefined;
  let u = artUrlCache.get(id);
  if (!u) {
    u = URL.createObjectURL(blob);
    artUrlCache.set(id, u);
  }
  return u;
}

function buildPhraseCues(firstBeat: number, bpm: number, duration: number): number[] {
  const cues: number[] = [];
  const phraseSec = (60 / Math.max(40, bpm)) * 32; // every 8 bars
  for (let t = firstBeat; t < duration - 1; t += phraseSec) {
    if (t >= 0) cues.push(t);
  }
  return cues;
}

function computeAutoGain(rms: number, minGain = 0.35, maxGain = 2.2): number {
  return Math.max(minGain, Math.min(maxGain, 0.22 / Math.max(0.03, rms)));
}

const loadSeq: Record<DeckId, number> = { A: 0, B: 0 };

export async function loadDemoToDeck(d: DeckId, demoId: DemoId): Promise<void> {
  const seq = ++loadSeq[d];
  const meta = DEMOS[demoId];
  djEngine.setLoading(d, 'Синтез трека…');
  try {
    await djEngine.ensure();
    const { L, sr, cues, analysis } = await buildDemoTrack(demoId);
    if (loadSeq[d] !== seq) return;
    const info: TrackInfo = {
      id: `demo:${demoId}`,
      title: meta.title,
      artist: meta.artist,
      key: meta.key,
      duration: analysis.wave.duration,
      bpm: analysis.bpm,
      firstBeat: analysis.firstBeat,
      cues,
      wave: analysis.wave,
      source: 'demo',
      gain: computeAutoGain(analysis.rms, 0.65, 1.8),
    };
    await djEngine.loadTrack(d, info, L, null, sr);
  } finally {
    if (loadSeq[d] === seq) djEngine.setLoading(d, null);
  }
}

export async function loadBlobToDeck(
  d: DeckId,
  blob: Blob,
  opts: { id?: string; title?: string; artist?: string; name?: string; art?: Blob; save?: boolean },
): Promise<StoredTrack> {
  const seq = ++loadSeq[d];
  djEngine.setLoading(d, 'Декодирование аудио…');
  try {
    await djEngine.ensure();
    const ctx = djEngine.ctx!;
    const nameFallback = parseFileName(opts.name || 'Track.mp3');
    const tags = await readTags(blob);
    const title = (opts.title || tags.title || nameFallback.title).slice(0, 80);
    const artist = (opts.artist || tags.artist || nameFallback.artist).slice(0, 80);
    const art = opts.art || tags.art;
    const id = opts.id || newTrackId();

    const buf = await decodeAudio(ctx, await blob.arrayBuffer());
    if (loadSeq[d] === seq) djEngine.setLoading(d, 'Анализ BPM и волны…');

    // Copy channel data into standalone Float32Arrays (safe for transferable worklet postMessage)
    const ch0 = buf.getChannelData(0);
    const L = new Float32Array(ch0.length);
    L.set(ch0);
    let R: Float32Array | null = null;
    if (buf.numberOfChannels > 1) {
      const ch1 = buf.getChannelData(1);
      R = new Float32Array(ch1.length);
      R.set(ch1);
    }

    const analysis = await analyzeAudio(L, R, buf.sampleRate);
    const autoGain = computeAutoGain(analysis.rms);
    const cues = buildPhraseCues(analysis.firstBeat, analysis.bpm, analysis.wave.duration);

    const info: TrackInfo = {
      id,
      title,
      artist,
      key: '—',
      duration: analysis.wave.duration,
      bpm: analysis.bpm,
      firstBeat: analysis.firstBeat,
      cues,
      wave: analysis.wave,
      artUrl: getArtUrl(id, art),
      source: 'user',
      gain: autoGain,
    };

    const stored: StoredTrack = {
      id,
      title,
      artist,
      name: opts.name || title,
      size: blob.size,
      addedAt: Date.now(),
      bpm: analysis.bpm,
      duration: analysis.wave.duration,
      blob,
      art,
    };

    if (opts.save !== false) {
      await saveTrack(stored);
    } else {
      await updateTrack(id, { bpm: analysis.bpm, duration: analysis.wave.duration });
    }

    if (loadSeq[d] === seq) {
      await djEngine.loadTrack(d, info, L, R, buf.sampleRate);
    }
    return stored;
  } finally {
    if (loadSeq[d] === seq) djEngine.setLoading(d, null);
  }
}

export async function loadFileToDeck(d: DeckId, file: File): Promise<StoredTrack> {
  return loadBlobToDeck(d, file, { name: file.name, save: true });
}

export async function loadStoredToDeck(d: DeckId, track: StoredTrack): Promise<StoredTrack> {
  return loadBlobToDeck(d, track.blob, {
    id: track.id,
    title: track.title,
    artist: track.artist,
    name: track.name,
    art: track.art,
    save: false,
  });
}
