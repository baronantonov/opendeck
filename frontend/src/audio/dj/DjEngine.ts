// Open Deck DJ engine: 2 деки на едином сэмпл-синхронном AudioWorklet + EQ микшер + постоянный Beat Sync.
//
// Цепь деки:
//   od-dual-deck (playhead/scratch/loop/sync) → TRIM(+auto gain) → EQ LOW/MID/HI
//   → CH FADER → CROSSFADER → MASTER → LIMITER → output
//
// UI подписывается через subscribe()/version (useSyncExternalStore), а позиции
// читает каждый кадр через getPos() — без лишних ре-рендеров.

import { WORKLET_SOURCE, createMainThreadDualCore } from './dspCore';
import type { WaveData } from './analysis';

export type DeckId = 'A' | 'B';
export const DECK_IDS: DeckId[] = ['A', 'B'];
/** 33⅓ об/мин — один оборот пластины = 1.8 сек аудио */
export const PLATTER_DEG_PER_SEC = 200;
export const TEMPO_RANGES = [0.06, 0.1, 0.16, 0.5];

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
  quantize: boolean;
  scratching: boolean;
  loop: { start: number; end: number; beats: number } | null;
  eq: { hi: number; mid: number; low: number };
  trim: number;
  fader: number;
}

interface CoreReport {
  p: number;
  s: number;
  e?: boolean;
  m?: number;
  q?: number;
}

interface Runtime {
  post: (m: Record<string, unknown>, transfer?: Transferable[]) => void;
  rpos: number;
  rspeed: number;
  rstamp: number;
  seekPending: number | null;
  seekAt: number;
  seekSeq: number;
  nextSeq: number;
  halfMul: number;
  cuePreview: boolean;
  trim: GainNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  fader: GainNode;
  xf: GainNode;
  analyser: AnalyserNode;
  meterBuf: Float32Array;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const other = (d: DeckId): DeckId => (d === 'A' ? 'B' : 'A');

/** Быстрая клубная кривая кроссфейдера: входящий трек открывается сразу от края, центр без провала. */
function xfCurve(open: number): number {
  const x = clamp(open, 0, 1);
  if (x <= 0) return 0;
  return Math.sin(Math.min(1, Math.pow(x / 0.65, 0.5)) * 0.5 * Math.PI);
}

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
    quantize: true,
    scratching: false,
    loop: null,
    eq: { hi: 0, mid: 0, low: 0 },
    trim: 0.5,
    fader: 1,
  };
}

function eqDb(v: number): number {
  if (v >= 0) return 6 * v;
  if (v <= -0.96) return -40;
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
  private sendCore: ((m: Record<string, unknown>, transfer?: Transferable[]) => void) | null = null;
  private listeners = new Set<() => void>();
  private ready: Promise<void> | null = null;
  private unlocked = false;
  private suspendTimer: number | null = null;

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
      const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'text/javascript' }));
      try {
        await ctx.audioWorklet.addModule(url);
        worklet = true;
      } catch (e) {
        console.warn('[dj] AudioWorklet unavailable, fallback to ScriptProcessor', e);
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    this.usingWorklet = worklet;

    let workletNode: AudioWorkletNode | null = null;
    let spSplitter: ChannelSplitterNode | null = null;
    let spMergerA: ChannelMergerNode | null = null;
    let spMergerB: ChannelMergerNode | null = null;

    if (worklet) {
      workletNode = new AudioWorkletNode(ctx, 'od-dual-deck', {
        numberOfInputs: 0,
        numberOfOutputs: 2,
        outputChannelCount: [2, 2],
      });
      workletNode.port.onmessage = (e: MessageEvent<{ A: CoreReport; B: CoreReport }>) => this.onDualReport(e.data);
      this.sendCore = (m, tr) => workletNode!.port.postMessage(m, tr || []);
    } else {
      const core = createMainThreadDualCore(ctx.sampleRate);
      const sp = ctx.createScriptProcessor(1024, 1, 4);
      spSplitter = ctx.createChannelSplitter(4);
      spMergerA = ctx.createChannelMerger(2);
      spMergerB = ctx.createChannelMerger(2);
      sp.connect(spSplitter);
      spSplitter.connect(spMergerA, 0, 0);
      spSplitter.connect(spMergerA, 1, 1);
      spSplitter.connect(spMergerB, 2, 0);
      spSplitter.connect(spMergerB, 3, 1);
      sp.onaudioprocess = (ev) => {
        const o = ev.outputBuffer;
        core.renderDual(o.getChannelData(0), o.getChannelData(1), o.getChannelData(2), o.getChannelData(3), o.length);
        const a = core.decks[0];
        const b = core.decks[1];
        this.onDualReport({
          A: { p: a.pos / Math.max(1, a.srcSr), s: a.speed, e: a.endedFlag, m: a.mode, q: a.seq },
          B: { p: b.pos / Math.max(1, b.srcSr), s: b.speed, e: b.endedFlag, m: b.mode, q: b.seq },
        });
        a.endedFlag = false;
        b.endedFlag = false;
      };
      this.sendCore = (m) => core.msg(m);
    }

    for (const d of DECK_IDS) {
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
      const fader = ctx.createGain();
      const xf = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      if (workletNode) {
        workletNode.connect(trim, d === 'A' ? 0 : 1, 0);
      } else if (d === 'A' && spMergerA) {
        spMergerA.connect(trim);
      } else if (d === 'B' && spMergerB) {
        spMergerB.connect(trim);
      }
      trim.connect(eqLow);
      eqLow.connect(eqMid);
      eqMid.connect(eqHigh);
      eqHigh.connect(fader);
      fader.connect(xf);
      fader.connect(analyser);
      xf.connect(master);

      this.rt[d] = {
        post: (m, tr) => this.sendCore?.({ ...m, d }, tr),
        rpos: 0,
        rspeed: 0,
        rstamp: performance.now(),
        seekPending: null,
        seekAt: 0,
        seekSeq: 0,
        nextSeq: 0,
        halfMul: 1,
        cuePreview: false,
        trim,
        eqLow,
        eqMid,
        eqHigh,
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
    if (this.suspendTimer !== null) {
      window.clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
    const now = performance.now();
    for (const d of DECK_IDS) {
      const r = this.r(d);
      if (r && r.seekPending !== null) r.seekAt = now;
    }
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
    if (this.suspendTimer !== null) {
      window.clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
    const ctx = this.ctx;
    if (ctx) {
      this.suspendTimer = window.setTimeout(() => {
        this.suspendTimer = null;
        void ctx.suspend().catch(() => {});
      }, 150);
    }
  }

  private r(d: DeckId): Runtime | null {
    return this.rt[d] ?? null;
  }

  // ------------------------------------------------------------ position (единый сэмпл-синхронный отчёт!)
  private onDualReport(msg: { A: CoreReport; B: CoreReport }) {
    const now = performance.now();
    for (const d of DECK_IDS) {
      const m = msg[d];
      const r = this.r(d);
      if (!r || !m) continue;
      if (r.seekPending !== null) {
        const q = typeof m.q === 'number' ? m.q : r.seekSeq;
        if (q === r.seekSeq || now - r.seekAt > 200) r.seekPending = null;
        else continue;
      }
      r.rpos = m.p;
      r.rspeed = m.s;
      r.rstamp = now;
      if (m.e) this.onEnded(d);
    }
  }

  private latency(): number {
    const c = this.ctx as (AudioContext & { outputLatency?: number }) | null;
    if (!c) return 0;
    return Math.min(0.25, (c.outputLatency || 0) + (c.baseLatency || 0));
  }

  /** Текущая позиция (сек) внутри аудио-ворклета (без вычета outputLatency). */
  private enginePos(d: DeckId): number {
    const k = this.decks[d];
    const r = this.r(d);
    if (!k.track || !r) return 0;
    if (r.seekPending !== null) return r.seekPending;
    const dt = Math.min(0.08, (performance.now() - r.rstamp) / 1000);
    return clamp(r.rpos + r.rspeed * dt, 0, k.track.duration);
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
    const snapped = Math.max(0, tr.firstBeat + Math.round((t - tr.firstBeat) / bl) * bl);
    return Math.min(Math.max(0, tr.duration - 0.05), snapped);
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
  private applySpeed(
    d: DeckId,
    tau: number,
    opts?: { instant?: boolean; align?: boolean; alignFollower?: boolean },
  ) {
    const k = this.decks[d];
    const r = this.r(d);
    if (!r || k.scratching) return;
    const v = k.playing ? (1 + k.tempo) * clamp(1 + k.bend, 0.2, 4) : 0;
    r.post({
      t: 'speed',
      v,
      tau,
      master: this.master,
      halfMul: r.halfMul,
      bend: Math.abs(k.bend) >= 1e-4,
      instant: opts?.instant ?? false,
      align: opts?.align ?? false,
      alignFollower: opts?.alignFollower ?? false,
    });
  }

  play(d: DeckId) {
    const k = this.decks[d];
    const r = this.r(d);
    if (!k.track || k.loading || !r) return;
    this.resume();
    if (this.enginePos(d) >= k.track.duration - 0.05) this.seek(d, k.cue);
    const oId = other(d);
    const o = this.decks[oId];
    let align = false;
    let alignFollower = false;

    if (k.sync && o.track && (o.playing || !o.sync)) {
      this.master = oId;
      this.syncTempoUi(d);
      align = o.playing;
    } else {
      if (!o.playing || (!k.sync && o.sync)) this.master = d;
      if (o.playing && o.sync && o.track) {
        this.syncTempoUi(oId);
        alignFollower = true;
      }
    }
    r.cuePreview = false;
    this.patch(d, { playing: true });
    this.applySpeed(d, 0.004, { instant: true, align, alignFollower });
    this.emit();
  }

  private releaseMasterOnStop(d: DeckId) {
    if (this.master === d && this.decks[other(d)].playing) {
      this.master = other(d);
    }
  }

  pause(d: DeckId) {
    const r = this.r(d);
    if (r) r.cuePreview = false;
    this.patch(d, { playing: false });
    this.releaseMasterOnStop(d);
    this.applySpeed(d, 0.025);
    this.emit();
  }

  togglePlay(d: DeckId) {
    const r = this.r(d);
    if (r?.cuePreview) {
      r.cuePreview = false; // PLAY во время удержания CUE — продолжаем играть
      const k = this.decks[d];
      const o = this.decks[other(d)];
      if (k.sync && o.track && o.playing && this.master !== d) {
        this.syncTempoUi(d);
        this.alignPhase(d);
      }
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
    if (!k.track || k.loading || !r) return;
    this.resume();
    if (k.playing && !r.cuePreview) {
      this.patch(d, { playing: false });
      this.releaseMasterOnStop(d);
      this.applySpeed(d, 0.004);
      this.seek(d, k.cue);
      this.emit();
      return;
    }
    const pos = this.getPos(d);
    if (Math.abs(pos - k.cue) < 0.03) {
      const oId = other(d);
      const o = this.decks[oId];
      let align = false;
      if (k.sync && o.track && (o.playing || !o.sync)) {
        this.master = oId;
        this.syncTempoUi(d);
        align = o.playing;
      }
      r.cuePreview = true;
      this.patch(d, { playing: true });
      this.applySpeed(d, 0.004, { instant: true, align });
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
    this.releaseMasterOnStop(d);
    this.applySpeed(d, 0.004);
    this.seek(d, this.decks[d].cue);
    this.emit();
  }

  seek(d: DeckId, t: number, alignPhase?: boolean) {
    const k = this.decks[d];
    const r = this.r(d);
    if (!k.track || !r) return;
    const v = clamp(t, 0, Math.max(0, k.track.duration - 0.02));
    const align = alignPhase ?? (k.sync && this.master !== d && k.playing && this.decks[other(d)].playing);
    r.nextSeq += 1;
    r.seekSeq = r.nextSeq;
    r.post({ t: 'seek', v, q: r.seekSeq, align });
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
    r.post({ t: 'scratchStart' });
    this.patch(d, { scratching: true });
    this.emit();
  }

  /** dDisp — дельта смещения пластины (сек аудио), vel — скорость (1 = номинал). */
  scratchMove(d: DeckId, dDisp: number, vel: number) {
    this.r(d)?.post({ t: 'scratch', dd: dDisp, v: vel });
  }

  scratchEnd(d: DeckId) {
    const k = this.decks[d];
    const r = this.r(d);
    if (!r || !k.scratching) return;
    this.patch(d, { scratching: false });
    const o = this.decks[other(d)];
    const v = k.playing ? (1 + k.tempo) * clamp(1 + k.bend, 0.2, 4) : 0;
    const align = k.playing && o.playing && this.master !== d;
    r.post({
      t: 'scratchEnd',
      playing: k.playing,
      v,
      tau: k.playing ? 0.04 : 0.012,
      align,
    });
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
  private pushSyncFollower(follower: DeckId, masterDeck: DeckId, align: boolean) {
    const halfMul = this.syncTempoUi(follower);
    const rf = this.r(follower);
    const kf = this.decks[follower];
    if (!rf) return;
    rf.post({
      t: 'sync',
      on: true,
      master: masterDeck,
      halfMul,
      v: kf.playing ? (1 + this.decks[follower].tempo) * clamp(1 + kf.bend, 0.2, 4) : undefined,
      align,
    });
  }

  setTempo(d: DeckId, t: number, _fromUser = true) {
    const k = this.decks[d];
    const tempo = clamp(t, -k.tempoRange, k.tempoRange);
    this.patch(d, { tempo, sync: true });
    const oId = other(d);
    if (this.decks[oId].track) {
      this.master = d;
      this.applySpeed(d, 0.02);
      this.pushSyncFollower(oId, d, false);
    } else {
      this.applySpeed(d, 0.02);
    }
    this.emit();
  }

  setTempoRange(d: DeckId, range: number) {
    const k = this.decks[d];
    this.patch(d, { tempoRange: range, tempo: clamp(k.tempo, -range, range), sync: true });
    this.applySpeed(d, 0.02);
    const oId = other(d);
    if (this.decks[oId].track && this.master === d) {
      this.pushSyncFollower(oId, d, false);
    }
    this.emit();
  }

  /** Вычисляет pitch/halfMul ведомой деки относительно мастера и обновляет UI без дрейфа в DSP. */
  private syncTempoUi(d: DeckId): number {
    const k = this.decks[d];
    const mId = this.master === d ? other(d) : this.master;
    const m = this.decks[mId];
    const r = this.r(d);
    if (!k.track || !m.track || !k.track.bpm || !m.track.bpm) return 1;
    const raw = (m.track.bpm * (1 + m.tempo)) / k.track.bpm;
    let halfMul = 1;
    while (raw * halfMul > 1.5 && halfMul > 0.25) halfMul *= 0.5;
    while (raw * halfMul < 0.75 && halfMul < 4) halfMul *= 2;
    const t = clamp(raw * halfMul - 1, -0.5, 0.5);
    let range = k.tempoRange;
    if (Math.abs(t) > range) range = TEMPO_RANGES.find((x) => x >= Math.abs(t)) ?? 0.5;
    if (r) r.halfMul = halfMul;
    this.patch(d, { tempo: t, tempoRange: range, sync: true });
    return halfMul;
  }

  alignPhase(d: DeckId) {
    const k = this.decks[d];
    const o = this.decks[other(d)];
    const r = this.r(d);
    if (!k.track || !o.track || !r) return;
    r.post({ t: 'sync', on: true, master: this.master, halfMul: r.halfMul, align: true });
  }

  /** SYNC всегда включён (для первого касания без рассинхрона): повторный тап выравнивает фазу. */
  setSync(d: DeckId, _on = true) {
    const oId = other(d);
    const k = this.decks[d];
    const o = this.decks[oId];
    const r = this.r(d);
    this.patch(d, { sync: true });
    if (o.track) {
      if (k.playing && !o.playing) {
        this.master = d;
        this.pushSyncFollower(oId, d, false);
        r?.post({ t: 'sync', on: true, master: this.master, halfMul: r.halfMul, align: false });
      } else {
        this.master = oId;
        this.pushSyncFollower(d, oId, k.playing && o.playing);
      }
    } else {
      this.master = d;
      r?.post({ t: 'sync', on: true, master: this.master, halfMul: 1, align: false });
    }
    this.emit();
  }

  setQuantize(d: DeckId, on: boolean) {
    this.patch(d, { quantize: on });
    this.emit();
  }

  // ------------------------------------------------------------ loops
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
      if (start >= k.track.duration - 0.05) {
        start = Math.max(0, k.track.duration - Math.max(0.05, beats * bl));
      }
    }
    const end = Math.min(k.track.duration - 0.01, start + beats * bl);
    if (end - start < 0.04) start = Math.max(0, end - 0.04);
    r.post({ t: 'loop', s: start, e: end });
    const len = end - start;
    if (len > 0 && (pos >= end || pos < start)) {
      this.seek(d, start + (((pos - start) % len) + len) % len);
    }
    this.patch(d, { loop: { start, end, beats } });
    this.emit();
  }

  exitLoop(d: DeckId, emit = true) {
    const r = this.r(d);
    if (!r) return;
    r.post({ t: 'loop', s: -1 });
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
    r.fader.gain.setTargetAtTime(Math.pow(k.fader, 1.5), now, 0.012);
  }

  private applyCrossfader() {
    const ctx = this.ctx;
    if (!ctx) return;
    const v = this.crossfader;
    const now = ctx.currentTime;
    this.r('A')?.xf.gain.setTargetAtTime(xfCurve(1 - v), now, 0.004);
    this.r('B')?.xf.gain.setTargetAtTime(xfCurve(v), now, 0.004);
  }

  setEq(d: DeckId, band: 'hi' | 'mid' | 'low', v: number) {
    this.patch(d, { eq: { ...this.decks[d].eq, [band]: clamp(v, -1, 1) } });
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
    const x = d === 'A' ? xfCurve(1 - this.crossfader) : xfCurve(this.crossfader);
    return Math.pow(k.fader, 1.5) * x;
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
    r.cuePreview = false;
    const transfer: Transferable[] = [L.buffer as ArrayBuffer];
    if (R) transfer.push(R.buffer as ArrayBuffer);
    r.post({ t: 'load', L, R, sr, bpm: info.bpm, fb: info.firstBeat }, this.usingWorklet ? transfer : undefined);

    const bl = 60 / info.bpm;
    const firstGrid = info.source === 'demo' ? 0 : info.firstBeat - Math.floor(info.firstBeat / bl) * bl;
    this.patch(d, {
      track: info,
      loop: null,
      cue: firstGrid,
      playing: false,
      scratching: false,
      tempo: 0,
      bend: 0,
      sync: true,
      loading: null,
    });
    r.halfMul = 1;
    r.rpos = 0;
    r.rspeed = 0;
    r.rstamp = performance.now();
    r.seekSeq = 0;
    r.nextSeq = 0;
    r.seekPending = null;
    if (firstGrid > 0) this.seek(d, firstGrid, false);

    const o = other(d);
    if (this.decks[o].playing) {
      this.master = o;
      this.pushSyncFollower(d, o, false);
    } else if (this.decks[o].track) {
      if (this.master === d) {
        r.post({ t: 'sync', on: true, master: d, halfMul: 1, align: false });
        this.pushSyncFollower(o, d, false);
      } else {
        this.master = o;
        this.r(o)?.post({ t: 'sync', on: true, master: o, halfMul: this.r(o)?.halfMul ?? 1, align: false });
        this.pushSyncFollower(d, o, false);
      }
    } else {
      this.master = d;
      r.post({ t: 'sync', on: true, master: d, halfMul: 1, align: false });
    }
    this.applyMixer(d);
    this.applySpeed(d, 0.01);
    this.emit();
  }
}

export const djEngine = new DjEngine();
