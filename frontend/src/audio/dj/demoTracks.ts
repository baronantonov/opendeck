// Демо-треки Open Deck (128 BPM, 4A): «Berlin Vault» и «Dark Matter».
// Синтезируются один раз через OfflineAudioContext (8-тактовые лупы в трёх вариантах),
// затем собираются в полноценный трек со структурой intro → build → break → drop → outro.
// Результат — обычный PCM, который играет та же дека, что и треки с телефона.

import type { TrackAnalysis } from './analysis';
import { analyzeAudio } from './analysis';

export type DemoId = 'berlin-vault' | 'dark-matter';
type Style = 'acid' | 'hypno';
type Variant = 'intro' | 'full' | 'break';
type Section = 'intro' | 'build' | 'break' | 'drop' | 'outro';

export const DEMO_BPM = 128;
const SR = 32000; // 1 такт = 60000 сэмплов ровно -> сетка без дрейфа
const STEP = 60 / DEMO_BPM / 4;
const BAR_SAMPLES = Math.round(16 * STEP * SR);
const LOOP_BARS = 8;

export const DEMOS: Record<DemoId, { title: string; artist: string; key: string; style: Style; plan: [Section, number][] }> = {
  'berlin-vault': {
    title: 'Berlin Vault',
    artist: 'Open Deck Records',
    key: '4A',
    style: 'acid',
    plan: [['intro', 16], ['build', 16], ['break', 8], ['drop', 32], ['outro', 20]],
  },
  'dark-matter': {
    title: 'Dark Matter',
    artist: 'FREEDA',
    key: '4A',
    style: 'hypno',
    plan: [['intro', 8], ['build', 16], ['break', 8], ['drop', 24], ['outro', 12]],
  },
};

// ------------------------------------------------------------------ synth voices

interface Voice {
  ctx: BaseAudioContext;
  out: AudioNode;
  noise: AudioBuffer;
}

function kick(v: Voice, t: number, startFreq: number) {
  const osc = v.ctx.createOscillator();
  const g = v.ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(startFreq, t);
  osc.frequency.exponentialRampToValueAtTime(48, t + 0.06);
  osc.frequency.exponentialRampToValueAtTime(30, t + 0.22);
  g.gain.setValueAtTime(1.1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  osc.connect(g);
  g.connect(v.out);
  osc.start(t);
  osc.stop(t + 0.26);
}

function tone(v: Voice, t: number, type: OscillatorType, freq: number, fType: BiquadFilterType, f0: number, f1: number | null, q: number, vol: number, len: number, detune = 0) {
  const osc = v.ctx.createOscillator();
  const f = v.ctx.createBiquadFilter();
  const g = v.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (detune) osc.detune.setValueAtTime(detune, t);
  f.type = fType;
  f.frequency.setValueAtTime(f0, t);
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + len * 0.85);
  f.Q.setValueAtTime(q, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  osc.connect(f);
  f.connect(g);
  g.connect(v.out);
  osc.start(t);
  osc.stop(t + len + 0.01);
}

function noise(v: Voice, t: number, seconds: number, type: BiquadFilterType, freq: number, q: number, vol: number) {
  const src = v.ctx.createBufferSource();
  src.buffer = v.noise;
  const f = v.ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  f.Q.setValueAtTime(q, t);
  const g = v.ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + seconds * 0.95);
  src.connect(f);
  f.connect(g);
  g.connect(v.out);
  src.start(t, Math.random() * 1.5);
  src.stop(t + seconds);
}

const ACID = [43.65, 43.65, 51.9, 43.65, 43.65, 58.27, 43.65, 51.9, 43.65, 65.41, 58.27, 51.9, 43.65, 51.9, 43.65, 38.89];
const MODULAR = [174.61, 207.65, 261.63, 311.13, 349.23, 311.13, 261.63, 207.65];
const CHORDS = [
  [174.61, 207.65, 261.63, 311.13, 349.23],
  [174.61, 207.65, 261.63, 311.13, 349.23],
  [138.59, 174.61, 207.65, 261.63],
  [138.59, 174.61, 207.65, 261.63],
  [116.54, 174.61, 207.65, 233.08],
  [116.54, 174.61, 207.65, 233.08],
  [130.81, 164.81, 196.0, 233.08],
  [130.81, 164.81, 196.0, 233.08],
];

function triggerStep(v: Voice, style: Style, variant: Variant, step: number, bar: number, t: number) {
  const kickOn = variant !== 'break';
  const lead = variant !== 'intro';
  if (style === 'acid') {
    if (kickOn && step % 4 === 0) kick(v, t, 175);
    if (kickOn && step % 2 === 1) tone(v, t, 'sawtooth', 43.65, 'lowpass', 120, null, 1, 0.5, 0.11);
    if (lead && (step % 2 === 1 || step === 2 || step === 10 || step === 14)) {
      tone(v, t, 'sawtooth', ACID[step], 'lowpass', 750 + 350 * Math.sin(bar * 0.9 + step * 0.2), 140, 9, 0.7, 0.13);
    }
    if (step % 4 === 2) noise(v, t, 0.18, 'bandpass', 9500, 3, 0.4);
    if (kickOn && (step === 4 || step === 12)) noise(v, t, 0.13, 'bandpass', 1600, 1.8, 0.7);
  } else {
    if (kickOn && step % 4 === 0) kick(v, t, 150);
    tone(v, t, 'square', MODULAR[(step + bar * 2) % MODULAR.length], 'bandpass', MODULAR[(step + bar * 2) % MODULAR.length] * 1.8, null, 4, 0.3, 0.09);
    if (lead && (step === 0 || step === 6 || step === 10)) {
      CHORDS[bar % 8].forEach((f, idx) => tone(v, t, 'sawtooth', f, 'lowpass', 1400, null, 3, 0.2, 0.38, (idx - 1.5) * 12));
    }
    if (step % 4 === 2) noise(v, t, 0.14, 'highpass', 8000, 0.7, 0.45);
    noise(v, t, 0.03, 'bandpass', 9200, 4, (step % 2 === 1 ? 0.22 : 0.1) * 0.5);
  }
}

// ------------------------------------------------------------------ offline render

type OfflineCtor = new (channels: number, length: number, sampleRate: number) => OfflineAudioContext;

function renderOffline(ctx: OfflineAudioContext): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    let done = false;
    ctx.oncomplete = (e) => {
      if (!done) {
        done = true;
        resolve(e.renderedBuffer);
      }
    };
    try {
      const p = ctx.startRendering() as Promise<AudioBuffer> | undefined;
      if (p && typeof p.then === 'function') {
        p.then((b) => {
          if (!done) {
            done = true;
            resolve(b);
          }
        }, reject);
      }
    } catch (e) {
      reject(e);
    }
  });
}

async function renderLoop(style: Style, variant: Variant): Promise<Float32Array> {
  const Ctor: OfflineCtor = (window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: OfflineCtor }).webkitOfflineAudioContext) as OfflineCtor;
  const loopLen = BAR_SAMPLES * LOOP_BARS;
  const tail = SR;
  const ctx = new Ctor(1, loopLen + tail, SR);
  const out = ctx.createGain();
  out.gain.value = 0.8;
  out.connect(ctx.destination);
  const nb = ctx.createBuffer(1, SR * 2, SR);
  const nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const v: Voice = { ctx, out, noise: nb };
  for (let bar = 0; bar < LOOP_BARS; bar++) {
    for (let s = 0; s < 16; s++) triggerStep(v, style, variant, s, bar, (bar * 16 + s) * STEP);
  }
  const buf = await renderOffline(ctx);
  const src = buf.getChannelData(0);
  const loop = new Float32Array(loopLen);
  loop.set(src.subarray(0, loopLen));
  // заворачиваем хвост последнего такта в начало — луп бесшовный
  for (let j = 0; j < tail; j++) loop[j] += src[loopLen + j];
  return loop;
}

const loopCache = new Map<Style, Promise<Record<Variant, Float32Array>>>();

function getLoops(style: Style) {
  let p = loopCache.get(style);
  if (!p) {
    p = (async () => {
      const [intro, full, brk] = await Promise.all([renderLoop(style, 'intro'), renderLoop(style, 'full'), renderLoop(style, 'break')]);
      let peak = 0;
      for (const a of [intro, full, brk]) for (let i = 0; i < a.length; i++) peak = Math.max(peak, Math.abs(a[i]));
      const k = peak > 0 ? 0.89 / peak : 1;
      for (const a of [intro, full, brk]) for (let i = 0; i < a.length; i++) a[i] *= k;
      return { intro, full, break: brk };
    })();
    loopCache.set(style, p);
  }
  return p;
}

export interface DemoTrackData {
  L: Float32Array;
  sr: number;
  cues: number[];
  analysis: TrackAnalysis;
}

const analysisCache = new Map<DemoId, TrackAnalysis>();

/** Собирает демо-трек (новый буфер на каждый вызов — его можно передать в worklet). */
export async function buildDemoTrack(id: DemoId): Promise<DemoTrackData> {
  const meta = DEMOS[id];
  const loops = await getLoops(meta.style);
  const totalBars = meta.plan.reduce((s, [, n]) => s + n, 0);
  const L = new Float32Array(totalBars * BAR_SAMPLES);
  const cues: number[] = [];
  let bar = 0;
  let seed = 12345;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (const [section, len] of meta.plan) {
    cues.push((bar * BAR_SAMPLES) / SR);
    const variant: Variant = section === 'intro' ? 'intro' : section === 'break' ? 'break' : 'full';
    const src = loops[variant];
    const startS = bar * BAR_SAMPLES;
    const secLen = len * BAR_SAMPLES;
    let hpPrev = 0;
    let hpOut = 0;
    for (let i = 0; i < secLen; i++) {
      const prog = i / secLen;
      let g = 1;
      if (section === 'intro') g = 0.78 + 0.14 * prog;
      else if (section === 'build') g = 0.92 + 0.08 * prog;
      else if (section === 'break') g = 0.85;
      else if (section === 'outro') g = prog < 0.75 ? 1 - 0.25 * (prog / 0.75) : 0.75 * (1 - (prog - 0.75) / 0.25);
      let s = src[(i + (startS % src.length)) % src.length] * g;
      if (section === 'break') {
        // riser: белый шум с highpass, нарастает к дропу
        const nz = rnd() * 2 - 1;
        hpOut = 0.97 * (hpOut + nz - hpPrev);
        hpPrev = nz;
        s += hpOut * 0.16 * prog * prog;
      }
      L[startS + i] = s;
    }
    bar += len;
  }
  let analysis = analysisCache.get(id);
  if (!analysis) {
    analysis = await analyzeAudio(L, null, SR, { bpm: DEMO_BPM, firstBeat: 0 });
    analysisCache.set(id, analysis);
  }
  return { L, sr: SR, cues, analysis };
}
