// Open Deck DJ engine: 2 деки на AudioWorklet + микшер + Beat FX + sync.
//
// Цепь деки:
//   od-deck (playhead/scratch/loop) → TRIM(+auto gain) → EQ LOW/MID/HI → COLOR FILTER (LPF/HPF)
//   → Beat FX → CH FADER → CROSSFADER → MASTER → LIMITER → output
//
// UI подписывается через subscribe()/version (useSyncExternalStore), а позиции
// читает каждый кадр через getPos() — без лишних ре-рендеров.

import { WORKLET_SOURCE, createMainThreadCore } from './dspCore';
import { BeatFx, FxType } from './fx';
import type { WaveData } from './analysis';

export type DeckId = 'A' | 'B';
export const DECK_IDS: DeckId[] = ['A', 'B'];
/** 33⅓ об/мин — один оборот пластины = 1.8 сек аудио */
export const PLATTER_DEG_PER_SEC = 200;
export const TEMPO_RANGES = [0.06, 0.1, 0.16, 0.5];
export const HOT_CUE_COUNT = 8;

export interface TrackInfo {
  id: string;
  title: string;
  artist: string;
  key: string;
  duration: number;
  bpm: number;
  firstBeat: number;
  cues: number[];
  wave: WaveData;
  artUrl?: string;
  source: 'demo' | 'user';
  /** auto gain (как в rekordbox) */
  gain: number;
}

export interface DeckState {
  id: DeckId;
  track: TrackInfo | null;
  loading: string | null;
  playing: boolean;
  cue: number;
  tempo: number;
  tempoRange: number;
  bend: number;
  sync: boolean;
  slip: boolean;
  quantize: boolean;
  scratching: boolean;
  hotCues: (number | null)[];
  loop: { start: number; end: number; beats: number } | null;
  eq: { hi: number; mid: number; low: number };
  filter: number;
  trim: number;
  fader: number;
  fx: { type: FxType; on: boolean; beats: number; level: number };
}

interface SlipAnchor {
  pos: number;
  at: number;
  rate: number;
}

interface Runtime {
  post: (m: Record<string, unknown>, transfer?: Transferable[]) => void;
  rpos: number;
  rspeed: number;
  rstamp: number;
  seekPending: number | null;
  seekAt: number;
  cuePreview: boolean;
  slipScratch: SlipAnchor | null;
  slipLoop: SlipAnchor | null;
  trim: GainNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  lp: BiquadFilterNode;
  hp: BiquadFilterNode;
  fx: BeatFx;
  fader: GainNode;
  xf: GainNode;
  analyser: AnalyserNode;
  meterBuf: Float32Array;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const frac = (v: number) => v - Math.floor(v);
const other = (d: DeckId): DeckId => (d === 'A' ? 'B' : 'A');

function initialDeck(id: DeckId): DeckState {
  return {
    id,
    track: null,
    loading: null,
    playing: false,
    cue: 0,
    tempo: 0,
    tempoRange: 0.1,
    bend: 0,
    sync: true,
    slip: false,
    quantize: true,
    scratching: false,
    hotCues: Array(HOT_CUE_COUNT).fill(null),
    loop: null,
    eq: { hi: 0, mid: 0, low: 0 },
    filter: 0,
    trim: 0.5,
    fader: 1,
    fx: { type: 'echo', on: false, beats: 1, level: 0.6 },
  };
}

function eqDb(v: number): number {
  if (v >= 0) return 6 * v;
  if (v <= -0.97) return -40;
  return 26 * v;
}

class DjEngine {
  ctx: AudioContext | null = null;
  decks: Record<DeckId, DeckState> = { A: initialDeck('A'), B: initialDeck('B') };
  crossfader = 0;
  master: DeckId = 'A';
  usingWorklet = false;
  version = 0;

  private rt: Partial<Record<DeckId, Runtime>> = {};
  private listeners = new Set<() => void>();
  private ready: Promise<void> | null = null;
  private unlocked = false;

  // ------------------------------------------------------------ store
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getVersion = () => this.version;

  private emit() {
    this.version++;
    this.listeners.forEach((f) => f());
  }

  private patch(d: DeckId, p: Partial<DeckState>) {
    this.decks = { ...this.decks, [d]: { ...this.decks[d], ...p } };
  }

  // ------------------------------------------------------------ lifecycle
  ensure(): Promise<void> {
    if (!this.ready) {
      this.ready = this.build().catch((e) => {
        this.ready = null;
        throw e;
      });
    }
    return this.ready;
  }

  private async build() {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    let ctx: AudioContext;
    try {
      ctx = new Ctor({ latencyHint: 'interactive' });
    } catch {
      ctx = new Ctor();
    }
    this.ctx = ctx;
    try {
      // iOS 16.4+: играть даже при включённом бесшумном режиме
      const nav = navigator as unknown as { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = 'playback';
    } catch {
      /* ignore */
    }

    const master = ctx.createGain();
    master.gain.value = 0.9;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    const mAn = ctx.createAnalyser();
    mAn.fftSize = 256;
    master.connect(limiter);
    limiter.connect(ctx.destination);
    limiter.connect(mAn);

    let worklet = false;
    if (ctx.audioWorklet && typeof AudioWorkletNode === 'function') {
      try {
        const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'text/javascript' }));
        await ctx.audioWorklet.addModule(url);
        worklet = true;
      } catch (e) {
        console.warn('[dj] AudioWorklet unavailable, fallback to ScriptProcessor', e);
      }
    }
    this.usingWorklet = worklet;

    for (const d of DECK_IDS) {
      let src: AudioNode;
      let post: Runtime['post'];
      if (worklet) {
        const node = new AudioWorkletNode(ctx, 'od-deck', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
        node.port.onmessage = (e: MessageEvent) => this.onReport(d, e.data);
        post = (m, tr) => node.port.postMessage(m, tr || []);
        src = node;
      } else {
        const core = createMainThreadCore(ctx.sampleRate);
        const sp = ctx.createScriptProcessor(1024, 1, 2);
        sp.onaudioprocess = (ev) => {
          const o = ev.outputBuffer;
          core.render(o.getChannelData(0), o.getChannelData(1), o.length);
          this.onReport(d, { p: core.pos / core.srcSr, s: core.speed, e: core.endedFlag });
          core.endedFlag = false;
        };
        post = (m) => core.msg(m);
        src = sp;
      }

      const trim = ctx.createGain();
      const eqLow = ctx.createBiquadFilter();
      eqLow.type = 'lowshelf';
      eqLow.frequency.value = 180;
      const eqMid = ctx.createBiquadFilter();
      eqMid.type = 'peaking';
      eqMid.frequency.value = 1000;
      eqMid.Q.value = 0.7;
      const eqHigh = ctx.createBiquadFilter();
      eqHigh.type = 'highshelf';
      eqHigh.frequency.value = 3800;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 22000;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 10;
      const fx = new BeatFx(ctx, () => this.nextBeatTime(d));
      const fader = ctx.createGain();
      const xf = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      src.connect(trim);
      trim.connect(eqLow);
      eqLow.connect(eqMid);
      eqMid.connect(eqHigh);
      eqHigh.connect(lp);
      lp.connect(hp);
      hp.connect(fx.input);
      fx.output.connect(fader);
      fader.connect(xf);
      fader.connect(analyser);
      xf.connect(master);

      this.rt[d] = {
        post,
        rpos: 0,
        rspeed: 0,
        rstamp: performance.now(),
        seekPending: null,
        seekAt: 0,
        cuePreview: false,
        slipScratch: null,
        slipLoop: null,
        trim,
        eqLow,
        eqMid,
        eqHigh,
        lp,
        hp,
        fx,
        fader,
        xf,
        analyser,
        meterBuf: new Float32Array(analyser.fftSize),
      };
      this.applyMixer(d);
    }
    this.applyCrossfader();
  }

  /** Вызывать из обработчиков жестов (iOS требует resume внутри user gesture). */
  resume() {
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state !== 'running') void ctx.resume().catch(() => {});
    if (!this.unlocked) {
      this.unlocked = true;
      try {
        const b = ctx.createBuffer(1, 1, ctx.sampleRate);
        const s = ctx.createBufferSource();
        s.buffer = b;
        s.connect(ctx.destination);
        s.start(0);
      } catch {
        /* ignore */
      }
    }
  }

  suspend() {
    for (const d of DECK_IDS) {
      if (this.decks[d].playing) this.pause(d);
      if (this.decks[d].scratching) this.scratchEnd(d);
    }
    const ctx = this.ctx;
    if (ctx) window.setTimeout(() => void ctx.suspend().catch(() => {}), 150);
  }

  private r(d: DeckId): Runtime | null {
    return this.rt[d] ?? null;
  }

  // ------------------------------------------------------------ position
  private onReport(d: DeckId, m: { p: number; s: number; e?: boolean }) {
    const r = this.r(d);
    if (!r) return;
    const now = performance.now();
    if (r.seekPending !== null) {
      if (Math.abs(m.p - r.seekPending) < 0.08 || now - r.seekAt > 160) r.seekPending = null;
      else return;
    }
    r.rpos = m.p;
    r.rspeed = m.s;
    r.rstamp = now;
    if (m.e) this.onEnded(d);
  }

  private latency(): number {
    const c = this.ctx as (AudioContext & { outputLatency?: number }) | null;
    if (!c) return 0;
    return Math.min(0.25, (c.outputLatency || 0) + (c.baseLatency || 0));
  }

  /** Позиция (сек), которую сейчас слышно (с учётом задержки вывода). */
  getPos(d: DeckId): number {
    const k = this.decks[d];
    const r = this.r(d);
    if (!k.track || !r) return 0;
    if (r.seekPending !== null) return r.seekPending;
    const dt = Math.min(0.08, (performance.now() - r.rstamp) / 1000);
    return clamp(r.rpos + r.rspeed * (dt - this.latency()), 0, k.track.duration);
  }

  getSpeed(d: DeckId): number {
    return this.r(d)?.rspeed ?? 0;
  }

  beatLen(d: DeckId): number {
    const t = this.decks[d].track;
    return t ? 60 / t.bpm : 0.5;
  }

  effBpm(d: DeckId): number {
    const k = this.decks[d];
    return k.track ? k.track.bpm * (1 + k.tempo) : 0;
  }

  /** Номер бита (дробный) относительно сетки трека. */
  beatAt(d: DeckId, t: number): number {
    const tr = this.decks[d].track;
    if (!tr) return 0;
    return ((t - tr.firstBeat) * tr.bpm) / 60;
  }

  snapBeat(d: DeckId, t: number): number {
    const tr = this.decks[d].track;
    if (!tr) return t;
    const bl = 60 / tr.bpm;
    return Math.max(0, tr.firstBeat + Math.round((t - tr.firstBeat) / bl) * bl);
  }

  private nextBeatTime(d: DeckId): number {
    const ctx = this.ctx;
    if (!ctx) return 0;
    const k = this.decks[d];
    const sp = this.getSpeed(d);
    if (!k.track || !k.playing || sp < 0.2) return ctx.currentTime;
    const b = this.beatAt(d, this.getPos(d));
    if (!Number.isFinite(b)) return ctx.currentTime;
    const delta = Math.ceil(b) - b;
    const nextDelta = delta < 0.02 ? delta + 1 : delta;
    return ctx.currentTime + this.latency() + (nextDelta * this.beatLen(d)) / sp;
  }

  getLevel(d: DeckId): number {
    const r = this.r(d);
    if (!r) return 0;
    r.analyser.getFloatTimeDomainData(r.meterBuf as Float32Array<ArrayBuffer>);
    let p = 0;
    for (let i = 0; i < r.meterBuf.length; i++) {
      const a = Math.abs(r.meterBuf[i]);
      if (a > p) p = a;
    }
    return p;
  }

  // ------------------------------------------------------------ transport
  private applySpeed(d: DeckId, tau: number) {
    const k = this.decks[d];
    const r = this.r(d);
    if (!r || k.scratching) return;
    const v = k.playing ? (1 + k.tempo) * (1 + k.bend) : 0;
    r.post({ t: 'speed', v, tau });
    r.fx.setBpm(this.effBpm(d) || 128);
  }

  play(d: DeckId) {
    const k = this.decks[d];
    const r = this.r(d);
    if (!k.track || k.loading || !r) return;
    this.resume();
    if (this.getPos(d) >= k.track.duration - 0.05) this.seek(d, k.cue);
    const o = this.decks[other(d)];
    if (k.sync && o.track && o.playing && this.master !== d) {
      this.matchTempo(d);
      this.alignPhase(d);
    }
    if (!o.playing) this.master = d;
    r.cuePreview = false;
    this.patch(d, { playing: true });
    this.applySpeed(d, 0.008);
    this.emit();
  }

  pause(d: DeckId) {
    const r = this.r(d);
    if (r) r.cuePreview = false;
    this.patch(d, { playing: false });
    this.applySpeed(d, 0.025);
    this.emit();
  }

  togglePlay(d: DeckId) {
    const r = this.r(d);
    if (r?.cuePreview) {
      r.cuePreview = false; // PLAY во время удержания CUE — продолжаем играть
      this.emit();
      return;
    }
    if (this.decks[d].playing) this.pause(d);
    else this.play(d);
  }

  /** CUE в стиле CDJ: играет → назад на CUE и стоп; стоит на CUE → превью пока держишь; иначе — ставит CUE. */
  cueDown(d: DeckId) {
    const k = this.decks[d];
    const r = this.r(d);
    if (!k.track || !r) return;
    this.resume();
    if (k.playing && !r.cuePreview) {
      this.patch(d, { playing: false });
      this.applySpeed(d, 0.004);
      this.seek(d, k.cue);
      this.emit();
      return;
    }
    const pos = this.getPos(d);
    if (Math.abs(pos - k.cue) < 0.03) {
      r.cuePreview = true;
      this.patch(d, { playing: true });
      this.applySpeed(d, 0.006);
    } else {
      const cue = k.quantize ? this.snapBeat(d, pos) : pos;
      this.patch(d, { cue });
      this.seek(d, cue);
    }
    this.emit();
  }

  cueUp(d: DeckId) {
    const r = this.r(d);
    if (!r?.cuePreview) return;
    r.cuePreview = false;
    this.patch(d, { playing: false });
    this.applySpeed(d, 0.004);
    this.seek(d, this.decks[d].cue);
    this.emit();
  }

  seek(d: DeckId, t: number) {
    const k = this.decks[d];
    const r = this.r(d);
    if (!k.track || !r) return;
    const v = clamp(t, 0, Math.max(0, k.track.duration - 0.02));
    r.post({ t: 'seek', v });
    const now = performance.now();
    r.seekPending = v;
    r.seekAt = now;
    r.rpos = v;
    r.rstamp = now;
  }

  private onEnded(d: DeckId) {
    if (!this.decks[d].playing) return;
    this.pause(d);
  }

  // ------------------------------------------------------------ jog
  scratchStart(d: DeckId) {
    const k = this.decks[d];
    const r = this.r(d);
    if (!k.track || !r) return;
    this.resume();
    r.cuePreview = false;
    if (k.slip && k.playing && this.ctx) r.slipScratch = { pos: this.getPos(d), at: this.ctx.currentTime, rate: 1 + k.tempo };
    r.post({ t: 'scratchStart' });
    this.patch(d, { scratching: true });
    this.emit();
  }

  /** disp — смещение пластины с начала касания (сек аудио), vel — скорость (1 = номинал). */
  scratchMove(d: DeckId, disp: number, vel: number) {
    this.r(d)?.post({ t: 'scratch', d: disp, v: vel });
  }

  scratchEnd(d: DeckId) {
    const k = this.decks[d];
    const r = this.r(d);
    if (!r || !k.scratching) return;
    this.patch(d, { scratching: false });
    if (r.slipScratch && this.ctx) {
      const s = r.slipScratch;
      r.slipScratch = null;
      if (k.playing) this.seek(d, s.pos + (this.ctx.currentTime - s.at) * s.rate);
    }
    this.applySpeed(d, k.playing ? 0.05 : 0.012);
    const o = this.decks[other(d)];
    if (k.sync && k.playing && o.playing && this.master !== d) {
      window.setTimeout(() => {
        if (!this.decks[d].scratching) this.alignPhase(d);
      }, 140);
    }
    this.emit();
  }

  setBend(d: DeckId, b: number) {
    const k = this.decks[d];
    const v = clamp(b, -0.6, 0.6);
    if (Math.abs(v - k.bend) < 1e-4) return;
    this.patch(d, { bend: v });
    this.applySpeed(d, 0.04);
  }

  // ------------------------------------------------------------ tempo / sync
  setTempo(d: DeckId, t: number, fromUser = true) {
    const k = this.decks[d];
    const tempo = clamp(t, -k.tempoRange, k.tempoRange);
    const p: Partial<DeckState> = { tempo };
    if (fromUser && k.sync && this.master !== d && this.decks[other(d)].track) p.sync = false;
    this.patch(d, p);
    this.applySpeed(d, 0.05);
    const o = other(d);
    if (this.decks[o].sync && this.master === d) this.matchTempo(o);
    this.emit();
  }

  setTempoRange(d: DeckId, range: number) {
    const k = this.decks[d];
    this.patch(d, { tempoRange: range, tempo: clamp(k.tempo, -range, range) });
    this.applySpeed(d, 0.05);
    this.emit();
  }

  private matchTempo(d: DeckId) {
    const k = this.decks[d];
    const o = this.decks[other(d)];
    if (!k.track || !o.track) return;
    let ratio = (o.track.bpm * (1 + o.tempo)) / k.track.bpm;
    if (ratio > 1.5) ratio /= 2;
    else if (ratio < 0.75) ratio *= 2;
    const t = clamp(ratio - 1, -0.5, 0.5);
    let range = k.tempoRange;
    if (Math.abs(t) > range) range = TEMPO_RANGES.find((x) => x >= Math.abs(t)) ?? 0.5;
    this.patch(d, { tempo: t, tempoRange: range });
    this.applySpeed(d, 0.05);
  }

  alignPhase(d: DeckId) {
    const k = this.decks[d];
    const o = this.decks[other(d)];
    if (!k.track || !o.track) return;
    const pM = this.getPos(other(d));
    const pD = this.getPos(d);
    const effM = this.effBpm(other(d));
    const effD = this.effBpm(d);
    if (!effM || !effD) return;
    const target = frac((this.beatAt(other(d), pM) * effD) / effM);
    let diff = target - frac(this.beatAt(d, pD));
    if (diff > 0.5) diff -= 1;
    if (diff < -0.5) diff += 1;
    if (Math.abs(diff) < 0.004) return;
    this.seek(d, pD + diff * this.beatLen(d));
  }

  setSync(d: DeckId, on: boolean) {
    const o = other(d);
    this.patch(d, { sync: on });
    if (on && this.decks[o].track) {
      this.master = o;
      this.matchTempo(d);
      if (this.decks[d].playing && this.decks[o].playing) this.alignPhase(d);
    }
    this.emit();
  }

  setSlip(d: DeckId, on: boolean) {
    const r = this.r(d);
    if (!on && r) {
      r.slipScratch = null;
      r.slipLoop = null;
    }
    this.patch(d, { slip: on });
    this.emit();
  }

  setQuantize(d: DeckId, on: boolean) {
    this.patch(d, { quantize: on });
    this.emit();
  }

  // ------------------------------------------------------------ hot cues / loops
  private hotCueKey(id: string) {
    return `od_hotcues_${id}`;
  }

  private saveHotCues(d: DeckId) {
    const k = this.decks[d];
    if (!k.track) return;
    try {
      localStorage.setItem(this.hotCueKey(k.track.id), JSON.stringify(k.hotCues));
    } catch {
      /* ignore */
    }
  }

  hotCue(d: DeckId, i: number): 'set' | 'jump' | null {
    const k = this.decks[d];
    if (!k.track) return null;
    const c = k.hotCues[i];
    if (c === null || c === undefined) {
      const pos = this.getPos(d);
      const hc = k.hotCues.slice();
      hc[i] = k.quantize ? this.snapBeat(d, pos) : pos;
      this.patch(d, { hotCues: hc });
      this.saveHotCues(d);
      this.emit();
      return 'set';
    }
    if (k.loop) this.exitLoop(d, false);
    let target = c;
    if (k.quantize && k.playing) target = c + frac(this.beatAt(d, this.getPos(d))) * this.beatLen(d);
    this.seek(d, target);
    if (!this.decks[d].playing) this.play(d);
    else this.emit();
    return 'jump';
  }

  deleteHotCue(d: DeckId, i: number) {
    const hc = this.decks[d].hotCues.slice();
    hc[i] = null;
    this.patch(d, { hotCues: hc });
    this.saveHotCues(d);
    this.emit();
  }

  toggleBeatLoop(d: DeckId, beats: number) {
    const k = this.decks[d];
    const r = this.r(d);
    if (!k.track || !r) return;
    if (k.loop && Math.abs(k.loop.beats - beats) < 1e-6) {
      this.exitLoop(d, true);
      return;
    }
    const bl = this.beatLen(d);
    const pos = this.getPos(d);
    let start: number;
    if (k.loop) start = k.loop.start;
    else {
      const q = Math.min(1, beats) * bl;
      start = k.quantize ? k.track.firstBeat + Math.floor((pos - k.track.firstBeat) / q + 1e-6) * q : pos;
      if (start < 0) start = 0;
      if (k.slip && k.playing && this.ctx) r.slipLoop = { pos, at: this.ctx.currentTime, rate: 1 + k.tempo };
    }
    const end = Math.min(k.track.duration - 0.01, start + beats * bl);
    r.post({ t: 'loop', s: start, e: end });
    if (pos >= end || pos < start) {
      const len = end - start;
      this.seek(d, start + (((pos - start) % len) + len) % len);
    }
    this.patch(d, { loop: { start, end, beats } });
    this.emit();
  }

  exitLoop(d: DeckId, emit = true) {
    const r = this.r(d);
    if (!r) return;
    r.post({ t: 'loop', s: -1 });
    if (r.slipLoop && this.ctx) {
      const s = r.slipLoop;
      r.slipLoop = null;
      if (this.decks[d].playing) this.seek(d, s.pos + (this.ctx.currentTime - s.at) * s.rate);
    }
    this.patch(d, { loop: null });
    if (emit) this.emit();
  }

  // ------------------------------------------------------------ mixer
  private applyMixer(d: DeckId) {
    const r = this.r(d);
    const ctx = this.ctx;
    if (!r || !ctx) return;
    const k = this.decks[d];
    const now = ctx.currentTime;
    const auto = k.track?.gain ?? 1;
    r.trim.gain.setTargetAtTime(auto * Math.pow(10, ((k.trim - 0.5) * 24) / 20), now, 0.02);
    r.eqLow.gain.setTargetAtTime(eqDb(k.eq.low), now, 0.015);
    r.eqMid.gain.setTargetAtTime(eqDb(k.eq.mid), now, 0.015);
    r.eqHigh.gain.setTargetAtTime(eqDb(k.eq.hi), now, 0.015);
    const f = k.filter;
    if (f < -0.02) {
      const a = Math.min(1, (-f - 0.02) / 0.98);
      r.lp.frequency.setTargetAtTime(20000 * Math.pow(180 / 20000, a), now, 0.02);
      r.lp.Q.setTargetAtTime(0.7 + 2.2 * a, now, 0.02);
      r.hp.frequency.setTargetAtTime(10, now, 0.02);
      r.hp.Q.setTargetAtTime(0.7, now, 0.02);
    } else if (f > 0.02) {
      const a = Math.min(1, (f - 0.02) / 0.98);
      r.hp.frequency.setTargetAtTime(20 * Math.pow(7000 / 20, a), now, 0.02);
      r.hp.Q.setTargetAtTime(0.7 + 2.2 * a, now, 0.02);
      r.lp.frequency.setTargetAtTime(22000, now, 0.02);
      r.lp.Q.setTargetAtTime(0.7, now, 0.02);
    } else {
      r.lp.frequency.setTargetAtTime(22000, now, 0.02);
      r.hp.frequency.setTargetAtTime(10, now, 0.02);
      r.lp.Q.setTargetAtTime(0.7, now, 0.02);
      r.hp.Q.setTargetAtTime(0.7, now, 0.02);
    }
    r.fader.gain.setTargetAtTime(Math.pow(k.fader, 1.5), now, 0.012);
  }

  private applyCrossfader() {
    const ctx = this.ctx;
    if (!ctx) return;
    const v = this.crossfader;
    const now = ctx.currentTime;
    this.r('A')?.xf.gain.setTargetAtTime(Math.cos(v * 0.5 * Math.PI), now, 0.01);
    this.r('B')?.xf.gain.setTargetAtTime(Math.cos((1 - v) * 0.5 * Math.PI), now, 0.01);
  }

  setEq(d: DeckId, band: 'hi' | 'mid' | 'low', v: number) {
    this.patch(d, { eq: { ...this.decks[d].eq, [band]: clamp(v, -1, 1) } });
    this.applyMixer(d);
    this.emit();
  }

  setFilter(d: DeckId, v: number) {
    this.patch(d, { filter: clamp(v, -1, 1) });
    this.applyMixer(d);
    this.emit();
  }

  setTrim(d: DeckId, v: number) {
    this.patch(d, { trim: clamp(v, 0, 1) });
    this.applyMixer(d);
    this.emit();
  }

  setFader(d: DeckId, v: number) {
    this.patch(d, { fader: clamp(v, 0, 1) });
    this.applyMixer(d);
    this.emit();
  }

  setCrossfader(v: number) {
    this.crossfader = clamp(v, 0, 1);
    this.applyCrossfader();
    this.emit();
  }

  /** Сколько дека слышна в мастере (канал × кроссфейдер), 0..1 */
  audibility(d: DeckId): number {
    const k = this.decks[d];
    const x = d === 'A' ? Math.cos(this.crossfader * 0.5 * Math.PI) : Math.cos((1 - this.crossfader) * 0.5 * Math.PI);
    return Math.pow(k.fader, 1.5) * x;
  }

  // ------------------------------------------------------------ fx
  setFx(d: DeckId, p: Partial<DeckState['fx']>) {
    const r = this.r(d);
    const fx = { ...this.decks[d].fx, ...p };
    this.patch(d, { fx });
    if (r) {
      r.fx.setBpm(this.effBpm(d) || 128);
      if (p.type !== undefined) r.fx.setType(p.type);
      if (p.beats !== undefined) r.fx.setBeats(p.beats);
      if (p.level !== undefined) r.fx.setLevel(p.level);
      if (p.on !== undefined) r.fx.setOn(p.on);
    }
    this.emit();
  }

  // ------------------------------------------------------------ loading
  setLoading(d: DeckId, msg: string | null) {
    this.patch(d, { loading: msg });
    this.emit();
  }

  async loadTrack(d: DeckId, info: TrackInfo, L: Float32Array, R: Float32Array | null, sr: number) {
    await this.ensure();
    const r = this.r(d);
    if (!r) return;
    if (this.decks[d].playing) this.pause(d);
    if (this.decks[d].scratching) this.scratchEnd(d);
    r.post({ t: 'loop', s: -1 });
    r.slipScratch = null;
    r.slipLoop = null;
    r.cuePreview = false;
    const transfer: Transferable[] = [L.buffer as ArrayBuffer];
    if (R) transfer.push(R.buffer as ArrayBuffer);
    r.post({ t: 'load', L, R, sr }, this.usingWorklet ? transfer : undefined);

    let hotCues: (number | null)[] = Array(HOT_CUE_COUNT).fill(null);
    try {
      const raw = localStorage.getItem(this.hotCueKey(info.id));
      if (raw) {
        const arr = JSON.parse(raw) as (number | null)[];
        if (Array.isArray(arr)) hotCues = Array.from({ length: HOT_CUE_COUNT }, (_, i) => (typeof arr[i] === 'number' ? arr[i] : null));
      }
    } catch {
      /* ignore */
    }
    const bl = 60 / info.bpm;
    const firstGrid = info.source === 'demo' ? 0 : info.firstBeat - Math.floor(info.firstBeat / bl) * bl;
    this.patch(d, { track: info, loop: null, hotCues, cue: firstGrid, playing: false, scratching: false, bend: 0, loading: null });
    r.rpos = 0;
    r.rspeed = 0;
    r.rstamp = performance.now();
    if (firstGrid > 0) this.seek(d, firstGrid);
    const o = other(d);
    if (this.decks[d].sync && this.decks[o].track && this.master !== d) this.matchTempo(d);
    this.applyMixer(d);
    this.applySpeed(d, 0.01);
    this.emit();
  }
}

export const djEngine = new DjEngine();
