// DSP-ядро одной деки. Хранится как JS-строка, чтобы один и тот же код работал:
//  1) внутри AudioWorklet (основной путь, отдельный аудио-поток, без лагов UI);
//  2) в ScriptProcessorNode (fallback для старых WebView без AudioWorklet).
//
// Режимы:
//  - play    — скорость плавно стремится к target (tau задаёт разгон/торможение);
//  - scratch — playhead «следует за пальцем»: позиция-цель = якорь + смещение пальца,
//              между сообщениями цель экстраполируется по скорости пальца
//              (feed-forward + P-регулятор => звук идёт точно за рукой, туда и обратно).
// Seek делается с микро-фейдом (declick), loop — бесшовно.

export const DSP_CORE_SOURCE = String.raw`
class DeckCore {
  constructor(sr) {
    this.sr = sr;
    this.L = null; this.R = null; this.len = 0;
    this.srcSr = sr; this.ratio = 1;
    this.pos = 0; this.speed = 0;
    this.mode = 0;            // 0 play, 1 scratch
    this.target = 0; this.tau = 0.02;
    this.anchor = 0; this.sPos = 0; this.sVel = 0; this.sAge = 0;
    this.loopS = -1; this.loopE = -1;
    this.fade = 1; this.fadeDir = 0; this.pendingSeek = -1;
    this.ended = false; this.endedFlag = false;
  }
  msg(m) {
    switch (m.t) {
      case 'load':
        this.L = m.L; this.R = m.R || m.L; this.len = this.L.length;
        this.srcSr = m.sr; this.ratio = m.sr / this.sr;
        this.pos = 0; this.speed = 0; this.target = 0; this.mode = 0;
        this.loopS = -1; this.loopE = -1; this.ended = false; this.endedFlag = false;
        this.fade = 0; this.fadeDir = 1; this.pendingSeek = -1;
        break;
      case 'unload':
        this.L = null; this.R = null; this.len = 0; this.pos = 0; this.speed = 0; this.target = 0;
        break;
      case 'speed':
        this.target = m.v; this.tau = m.tau; this.mode = 0;
        break;
      case 'seek':
        this.pendingSeek = Math.max(0, Math.min(this.len - 2, m.v * this.srcSr));
        this.fadeDir = -1; this.ended = false;
        break;
      case 'scratchStart':
        this.mode = 1; this.anchor = this.pos; this.sPos = this.pos; this.sVel = 0; this.sAge = 0;
        break;
      case 'scratch':
        if (this.mode !== 1) { this.mode = 1; this.anchor = this.pos; }
        this.sPos = this.anchor + m.d * this.srcSr; this.sVel = m.v; this.sAge = 0;
        break;
      case 'loop':
        if (m.s < 0) { this.loopS = -1; this.loopE = -1; }
        else { this.loopS = m.s * this.srcSr; this.loopE = m.e * this.srcSr; }
        break;
    }
  }
  render(oL, oR, n) {
    const L = this.L, R = this.R, len = this.len;
    if (!L || len < 4) { for (let i = 0; i < n; i++) { oL[i] = 0; oR[i] = 0; } return; }
    const sr = this.sr, ratio = this.ratio;
    const kPlay = 1 - Math.exp(-1 / (Math.max(0.0005, this.tau) * sr));
    const kScr = 1 - Math.exp(-1 / (0.004 * sr));
    const follow = 1 / (0.025 * this.srcSr);
    const maxAge = 0.06 * sr;
    const fadeStep = 1 / 96;
    const last = len - 2;
    for (let i = 0; i < n; i++) {
      if (this.mode === 1) {
        if (this.sAge < maxAge) { this.sPos += this.sVel * ratio; this.sAge++; }
        if (this.sPos < 0) this.sPos = 0; else if (this.sPos > last) this.sPos = last;
        let want = (this.sAge < maxAge ? this.sVel : 0) + (this.sPos - this.pos) * follow;
        if (want > 16) want = 16; else if (want < -16) want = -16;
        this.speed += (want - this.speed) * kScr;
      } else {
        this.speed += (this.target - this.speed) * kPlay;
      }
      if (this.fadeDir !== 0) {
        this.fade += this.fadeDir * fadeStep;
        if (this.fade <= 0) {
          this.fade = 0;
          if (this.pendingSeek >= 0) {
            const delta = this.pendingSeek - this.pos;
            this.pos = this.pendingSeek; this.pendingSeek = -1;
            this.anchor += delta; this.sPos += delta;
          }
          this.fadeDir = 1;
        } else if (this.fade >= 1) { this.fade = 1; this.fadeDir = 0; }
      }
      const p = this.pos;
      let l = 0, r = 0;
      if (p >= 1 && p < last) {
        const i1 = p | 0, f = p - i1;
        const i0 = i1 - 1, i2 = i1 + 1, i3 = i1 + 2;
        // cubic Hermite (Catmull-Rom)
        let y0 = L[i0], y1 = L[i1], y2 = L[i2], y3 = L[i3];
        let c1 = 0.5 * (y2 - y0), c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3, c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
        l = ((c3 * f + c2) * f + c1) * f + y1;
        if (R !== L) {
          y0 = R[i0]; y1 = R[i1]; y2 = R[i2]; y3 = R[i3];
          c1 = 0.5 * (y2 - y0); c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3; c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
          r = ((c3 * f + c2) * f + c1) * f + y1;
        } else r = l;
      }
      const g = this.fade;
      oL[i] = l * g; oR[i] = r * g;
      this.pos += this.speed * ratio;
      if (this.loopS >= 0 && this.speed > 0 && this.pos >= this.loopE) {
        const w = this.loopE - this.loopS;
        this.pos -= w; this.anchor -= w; this.sPos -= w;
      } else if (this.loopS >= 0 && this.speed < 0 && this.pos < this.loopS) {
        const w = this.loopE - this.loopS;
        this.pos += w; this.anchor += w; this.sPos += w;
      }
      if (this.pos < 0) { this.pos = 0; if (this.speed < 0) this.speed = 0; }
      else if (this.pos >= last) {
        this.pos = last;
        if (this.speed > 0) this.speed = 0;
        if (!this.ended && this.mode === 0) { this.ended = true; this.endedFlag = true; }
      }
    }
  }
}
`;

export const WORKLET_SOURCE = `${DSP_CORE_SOURCE}
class OdDeckProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.core = new DeckCore(sampleRate);
    this.q = 0;
    this.port.onmessage = (e) => this.core.msg(e.data);
  }
  process(_inputs, outputs) {
    const o = outputs[0];
    const L = o[0];
    const R = o[1] || o[0];
    this.core.render(L, R, L.length);
    if (++this.q >= 3 || this.core.endedFlag) {
      this.q = 0;
      const c = this.core;
      this.port.postMessage({ p: c.pos / c.srcSr, s: c.speed, e: c.endedFlag, m: c.mode });
      c.endedFlag = false;
    }
    return true;
  }
}
registerProcessor('od-deck', OdDeckProcessor);
`;

export interface DeckCoreLike {
  pos: number;
  speed: number;
  srcSr: number;
  mode: number;
  endedFlag: boolean;
  msg(m: unknown): void;
  render(oL: Float32Array, oR: Float32Array, n: number): void;
}

/** Fallback: создаёт DeckCore в главном потоке (для ScriptProcessorNode). */
export function createMainThreadCore(sampleRate: number): DeckCoreLike {
  // eslint-disable-next-line no-new-func
  const Ctor = new Function(`${DSP_CORE_SOURCE}\nreturn DeckCore;`)() as new (sr: number) => DeckCoreLike;
  return new Ctor(sampleRate);
}
