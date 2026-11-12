// Beat FX одной деки (по мотивам rekordbox Beat FX): ECHO, REVERB, FLANGER, TRANS.
// Все времена привязаны к эффективному BPM деки (BPM трека × темп).
// ECHO/REVERB работают через send — при выключении хвосты затухают естественно.

export type FxType = 'echo' | 'reverb' | 'flanger' | 'trans';

export const FX_LIST: { id: FxType; label: string }[] = [
  { id: 'echo', label: 'ECHO' },
  { id: 'reverb', label: 'REVERB' },
  { id: 'flanger', label: 'FLANGER' },
  { id: 'trans', label: 'TRANS' },
];

export const FX_BEATS = [0.25, 0.5, 0.75, 1, 2, 4, 8];

const TC = 0.015; // time-constant для плавных переключений

function makeImpulse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  const pre = Math.floor(ctx.sampleRate * 0.012);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / (len - pre);
      // мягкий lowpass по ходу хвоста — реверб «темнеет», как в железе
      const a = 0.15 + 0.8 * t;
      lp = lp * a + (Math.random() * 2 - 1) * (1 - a);
      d[i] = lp * Math.pow(1 - t, decay) * 2.2;
    }
  }
  return buf;
}

export class BeatFx {
  readonly input: GainNode;
  readonly output: GainNode;
  private ctx: AudioContext;
  private trans: GainNode;
  private transLfo: OscillatorNode | null = null;
  private transDepth: GainNode;
  private transSmooth: BiquadFilterNode;
  private echoSend: GainNode;
  private echoDelay: DelayNode;
  private echoFb: GainNode;
  private echoWet: GainNode;
  private revSend: GainNode;
  private revWet: GainNode;
  private flDelay: DelayNode;
  private flWet: GainNode;
  private flFb: GainNode;
  private flLfo: OscillatorNode;
  private flLfoGain: GainNode;

  type: FxType = 'echo';
  on = false;
  beats = 1;
  level = 0.6;
  private bpm = 128;

  constructor(ctx: AudioContext, private nextBeatTime: () => number) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();

    // TRANS — гейт прямо в основной цепи
    this.trans = ctx.createGain();
    this.transDepth = ctx.createGain();
    this.transDepth.gain.value = 0;
    this.transSmooth = ctx.createBiquadFilter();
    this.transSmooth.type = 'lowpass';
    this.transSmooth.frequency.value = 180;
    this.transSmooth.connect(this.transDepth);
    this.transDepth.connect(this.trans.gain);
    this.input.connect(this.trans);
    this.trans.connect(this.output);

    // ECHO
    this.echoSend = ctx.createGain();
    this.echoSend.gain.value = 0;
    this.echoDelay = ctx.createDelay(6);
    this.echoFb = ctx.createGain();
    const echoHp = ctx.createBiquadFilter();
    echoHp.type = 'highpass';
    echoHp.frequency.value = 160;
    const echoLp = ctx.createBiquadFilter();
    echoLp.type = 'lowpass';
    echoLp.frequency.value = 7000;
    this.echoWet = ctx.createGain();
    this.trans.connect(this.echoSend);
    this.echoSend.connect(this.echoDelay);
    this.echoDelay.connect(echoHp);
    echoHp.connect(echoLp);
    echoLp.connect(this.echoFb);
    this.echoFb.connect(this.echoDelay);
    echoLp.connect(this.echoWet);
    this.echoWet.connect(this.output);

    // REVERB
    this.revSend = ctx.createGain();
    this.revSend.gain.value = 0;
    const conv = ctx.createConvolver();
    conv.buffer = makeImpulse(ctx, 2.8, 2.6);
    this.revWet = ctx.createGain();
    this.trans.connect(this.revSend);
    this.revSend.connect(conv);
    conv.connect(this.revWet);
    this.revWet.connect(this.output);

    // FLANGER
    this.flDelay = ctx.createDelay(0.05);
    this.flDelay.delayTime.value = 0.004;
    this.flFb = ctx.createGain();
    this.flFb.gain.value = 0.55;
    this.flWet = ctx.createGain();
    this.flWet.gain.value = 0;
    this.flLfo = ctx.createOscillator();
    this.flLfo.type = 'triangle';
    this.flLfoGain = ctx.createGain();
    this.flLfoGain.gain.value = 0.0032;
    this.flLfo.connect(this.flLfoGain);
    this.flLfoGain.connect(this.flDelay.delayTime);
    this.flLfo.start();
    this.trans.connect(this.flDelay);
    this.flDelay.connect(this.flFb);
    this.flFb.connect(this.flDelay);
    this.flDelay.connect(this.flWet);
    this.flWet.connect(this.output);

    this.applyTiming();
    this.applyLevel();
  }

  private get beatSec() {
    return 60 / Math.max(40, this.bpm);
  }

  setBpm(bpm: number) {
    if (!Number.isFinite(bpm) || bpm <= 0 || Math.abs(bpm - this.bpm) < 0.001) return;
    this.bpm = bpm;
    this.applyTiming();
  }

  private applyTiming() {
    const now = this.ctx.currentTime;
    const period = this.beats * this.beatSec;
    this.echoDelay.delayTime.setTargetAtTime(Math.min(5.9, period), now, 0.02);
    // флэнжер: полный цикл LFO = beats × 4 (как «cycle» в rekordbox)
    this.flLfo.frequency.setTargetAtTime(1 / Math.max(0.05, period * 4), now, 0.02);
    if (this.transLfo) this.transLfo.frequency.setTargetAtTime(1 / Math.max(0.03, period), now, 0.01);
  }

  private applyLevel() {
    const now = this.ctx.currentTime;
    const lv = this.level;
    this.echoWet.gain.setTargetAtTime(0.25 + 0.75 * lv, now, TC);
    this.echoFb.gain.setTargetAtTime(0.3 + 0.38 * lv, now, TC);
    this.revWet.gain.setTargetAtTime(0.15 + 1.1 * lv, now, TC);
    this.flFb.gain.setTargetAtTime(0.25 + 0.55 * lv, now, TC);
    this.refreshActive();
  }

  setType(t: FxType) {
    if (t === this.type) return;
    const wasOn = this.on;
    if (wasOn) this.setOn(false);
    this.type = t;
    if (wasOn) this.setOn(true);
  }

  setBeats(b: number) {
    this.beats = b;
    this.applyTiming();
  }

  setLevel(v: number) {
    this.level = Math.max(0, Math.min(1, v));
    this.applyLevel();
  }

  setOn(on: boolean) {
    this.on = on;
    this.refreshActive();
  }

  private refreshActive() {
    const now = this.ctx.currentTime;
    const on = this.on;
    const t = this.type;
    this.echoSend.gain.setTargetAtTime(on && t === 'echo' ? 1 : 0, now, TC);
    this.revSend.gain.setTargetAtTime(on && t === 'reverb' ? 1 : 0, now, TC);
    this.flWet.gain.setTargetAtTime(on && t === 'flanger' ? 0.55 + 0.35 * this.level : 0, now, TC);

    if (on && t === 'trans') {
      const depth = 0.35 + 0.65 * this.level;
      this.trans.gain.setTargetAtTime(1 - depth / 2, now, TC);
      this.transDepth.gain.setTargetAtTime(depth / 2, now, TC);
      if (!this.transLfo) {
        const lfo = this.ctx.createOscillator();
        lfo.type = 'square';
        lfo.frequency.value = 1 / Math.max(0.03, this.beats * this.beatSec);
        lfo.connect(this.transSmooth);
        const nextB = this.nextBeatTime();
        const start = Number.isFinite(nextB) && nextB > now ? nextB : now + 0.005;
        lfo.start(start);
        this.transLfo = lfo;
      }
    } else {
      this.trans.gain.setTargetAtTime(1, now, TC);
      this.transDepth.gain.setTargetAtTime(0, now, TC);
      if (this.transLfo) {
        const lfo = this.transLfo;
        this.transLfo = null;
        try {
          lfo.stop(now + 0.1);
        } catch {
          /* ignore */
        }
        window.setTimeout(() => lfo.disconnect(), 200);
      }
    }
  }
}
