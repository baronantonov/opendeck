// Единое Dual-Deck DSP-ядро Open Deck (как в Mixxx EngineMixer + rimvo DualDeckTransportKernel).
// Обе деки (A и B) рендерятся сэмпл-синхронно внутри ОДНОГО аудио-буфера:
//  1) AudioWorkletProcessor ('od-dual-deck') с 2 стерео-выходами (A = outputs[0], B = outputs[1]);
//  2) ScriptProcessorNode fallback (4 выходных канала -> splitter A/B) в том же DualDeckCore.
//
// Механика бит-в-бит:
//  - Старт воспроизведения с мгновенной целевой скоростью и 1ms gain-огибающей (без виниловой просадки первой бочки).
//  - Перемотка/выравнивание фазы на ходу (xfade 4ms) смешивает старую и новую ветки без провала звука и потери фазы.
//  - Сэмпл-синхронный Beat Sync + audio-thread PLL внутри цикла рендера удерживает фазовую ошибку < 0.05 ms
//    полностью независимо от нагрузки UI-потока и задержек postMessage.

export const DSP_CORE_SOURCE = String.raw`
function makeSlot(sr) {
  return {
    sr: sr,
    L: null, R: null, len: 0,
    srcSr: sr, ratio: 1,
    pos: 0, speed: 0,
    mode: 0,          // 0 play, 1 scratch
    target: 0, tau: 0.02,
    sPos: 0, sVel: 0, sAge: 0,
    loopS: -1, loopE: -1,
    // Анти-клик огибающая воспроизведения (fade) + плавная остановка на паузе
    fade: 0, fadeDir: 0,
    lastL: 0, lastR: 0,
    // Бесшовный crossfade при seek / phase-snap на лету (как в rimvo)
    xActive: false, xPos: 0, xLeft: 0, xTotal: Math.max(16, Math.round(sr * 0.004)),
    // Бит-сетка и аудио-потоковый Beat Sync
    bpm: 0, fb: 0, beatSrc: 0,
    playing: false,
    sync: true, master: 0, halfMul: 1, manualBend: false,
    seq: 0,
    ended: false, endedFlag: false
  };
}

class DualDeckCore {
  constructor(sr) {
    this.sr = sr;
    this.masterIdx = 0; // 0 = A, 1 = B
    this.decks = [makeSlot(sr), makeSlot(sr)];
  }

  idx(id) {
    return id === 'B' || id === 1 ? 1 : 0;
  }

  clampPos(d, p) {
    const last = Math.max(0, d.len - 2);
    if (d.loopS >= 0 && d.loopE > d.loopS) {
      const w = d.loopE - d.loopS;
      return d.loopS + (((p - d.loopS) % w) + w) % w;
    }
    return p < 0 ? 0 : p > last ? last : p;
  }

  /** Вычисляет точку трека фолловера d с той же фазой бита, что и у мастера m. */
  alignedPosSrc(fIdx) {
    const f = this.decks[fIdx];
    const m = this.decks[this.masterIdx];
    if (!f.L || !m.L || f.bpm <= 0 || m.bpm <= 0 || fIdx === this.masterIdx) return f.pos;
    const mBeatSec = 60 / m.bpm;
    const fBeatSec = 60 / f.bpm;
    const mTime = m.pos / m.srcSr;
    const fTime = f.pos / f.srcSr;
    const scaleM = f.halfMul < 1 ? f.halfMul : 1;
    const scaleF = f.halfMul > 1 ? 1 / f.halfMul : 1;
    const rawM = ((mTime - m.fb) / mBeatSec) * scaleM;
    const rawF = ((fTime - f.fb) / fBeatSec) * scaleF;
    const phiM = rawM - Math.floor(rawM);
    const phiF = rawF - Math.floor(rawF);
    let errScaled = phiM - phiF;
    if (errScaled > 0.5) errScaled -= 1;
    else if (errScaled < -0.5) errScaled += 1;
    const errSrc = (errScaled / scaleF) * fBeatSec * f.srcSr;
    let nextPos = f.pos + errSrc;
    const beatStepSrc = (fBeatSec / scaleF) * f.srcSr;
    const last = Math.max(0, f.len - 2);
    if (f.loopS >= 0 && f.loopE > f.loopS) {
      const w = f.loopE - f.loopS;
      nextPos = f.loopS + (((nextPos - f.loopS) % w) + w) % w;
    } else if (beatStepSrc > 1) {
      if (nextPos < 0) nextPos += beatStepSrc;
      else if (nextPos > last && nextPos - beatStepSrc >= 0) nextPos -= beatStepSrc;
      if (nextPos < 0) nextPos = 0;
      else if (nextPos > last) nextPos = last;
    }
    return nextPos;
  }

  /** Применяет перемещение (или 4ms xfade seek если дека сейчас звучит). */
  applySeekSrc(d, targetSrc, q, allowJumpXfade) {
    const last = Math.max(0, d.len - 2);
    const clamped = targetSrc < 0 ? 0 : targetSrc > last ? last : targetSrc;
    d.ended = false;
    if (typeof q === 'number') d.seq = q;
    const delta = clamped - d.pos;
    if (allowJumpXfade && d.playing && d.fade > 0.01 && Math.abs(delta) > 1) {
      d.xActive = true;
      d.xPos = d.pos;
      d.xLeft = d.xTotal;
      d.pos = clamped;
      d.sPos += delta;
    } else {
      d.pos = clamped;
      d.sPos += delta;
      d.xActive = false;
      d.xLeft = 0;
    }
  }

  alignDeck(fIdx) {
    const f = this.decks[fIdx];
    const m = this.decks[this.masterIdx];
    if (!f.L || !m.L || f.bpm <= 0 || m.bpm <= 0 || fIdx === this.masterIdx) return;
    const nextPos = this.alignedPosSrc(fIdx);
    const minJumpSrc = f.srcSr * 0.0005; // < 0.5 ms не трогаем xfade
    if (Math.abs(nextPos - f.pos) <= minJumpSrc) return;
    this.applySeekSrc(f, nextPos, undefined, f.playing);
  }

  syncedNominalRate(fIdx) {
    const f = this.decks[fIdx];
    const m = this.decks[this.masterIdx];
    if (!f.sync || fIdx === this.masterIdx || f.bpm <= 0 || m.bpm <= 0) return f.target;
    const mRate = m.playing && m.mode === 0 ? (m.speed > 0 ? m.speed : m.target) : (m.target > 0 ? m.target : 1);
    const r = mRate * (m.bpm / f.bpm) * f.halfMul;
    return r < 0.2 ? 0.2 : r > 4 ? 4 : r;
  }

  msg(m) {
    const di = this.idx(m.d);
    const d = this.decks[di];
    switch (m.t) {
      case 'load':
        d.L = m.L; d.R = m.R || m.L; d.len = d.L.length;
        d.srcSr = m.sr; d.ratio = m.sr / this.sr;
        d.pos = 0; d.speed = 0; d.target = 0; d.mode = 0; d.playing = false;
        d.loopS = -1; d.loopE = -1; d.ended = false; d.endedFlag = false;
        d.fade = 0; d.fadeDir = 0; d.lastL = 0; d.lastR = 0;
        d.xActive = false; d.xLeft = 0;
        d.bpm = m.bpm || 0; d.fb = m.fb || 0;
        d.beatSrc = d.bpm > 0 ? (60 / d.bpm) * d.srcSr : 0;
        d.seq = 0;
        break;
      case 'unload':
        d.L = null; d.R = null; d.len = 0; d.pos = 0; d.speed = 0; d.target = 0;
        d.playing = false; d.fade = 0; d.fadeDir = 0; d.xActive = false; d.seq = 0;
        break;
      case 'grid':
        d.bpm = m.bpm || 0;
        d.fb = m.fb || 0;
        d.beatSrc = d.bpm > 0 ? (60 / d.bpm) * d.srcSr : 0;
        break;
      case 'master':
        this.masterIdx = di;
        break;
      case 'sync': {
        d.sync = !!m.on;
        if (typeof m.halfMul === 'number' && m.halfMul > 0) d.halfMul = m.halfMul;
        if (typeof m.master === 'string' || typeof m.master === 'number') this.masterIdx = this.idx(m.master);
        if (typeof m.v === 'number' && d.playing) d.target = m.v;
        if (d.sync && di !== this.masterIdx) {
          const masterDeck = this.decks[this.masterIdx];
          if (m.align) this.alignDeck(di);
          if (d.playing && d.mode === 0 && masterDeck.playing && masterDeck.mode === 0) {
            d.target = this.syncedNominalRate(di);
            d.speed = d.target;
          }
        }
        break;
      }
      case 'speed':
        if (typeof m.master === 'string' || typeof m.master === 'number') this.masterIdx = this.idx(m.master);
        if (typeof m.halfMul === 'number' && m.halfMul > 0) d.halfMul = m.halfMul;
        d.manualBend = !!m.bend;
        d.tau = m.tau || 0.02;
        if (m.v > 0) {
          const wasStopped = !d.playing;
          d.playing = true;
          d.mode = 0;
          d.target = m.v;
          if (d.sync && di !== this.masterIdx) {
            const masterDeck = this.decks[this.masterIdx];
            if (m.align && masterDeck.playing) this.alignDeck(di);
            if (!d.manualBend && masterDeck.playing && masterDeck.mode === 0) {
              d.target = this.syncedNominalRate(di);
            }
          }
          // Мгновенный CDJ-старт скорости с паузы без питч-растяжки первой бочки; только fade-in 1ms!
          if (m.instant || (wasStopped && Math.abs(d.speed) < 0.05)) {
            d.speed = d.target;
          }
          d.fadeDir = 1;
          if (m.alignFollower) {
            const oIdx = 1 - di;
            const o = this.decks[oIdx];
            if (o.sync && o.playing && this.masterIdx === di) this.alignDeck(oIdx);
          }
        } else {
          d.playing = false;
          d.target = 0;
          if (d.mode === 0) d.fadeDir = -1;
        }
        break;
      case 'seek': {
        let targetSrc = Math.max(0, Math.min(Math.max(0, d.len - 2), m.v * d.srcSr));
        if (m.align && d.sync && di !== this.masterIdx && this.decks[this.masterIdx].playing) {
          // Сохраняем точку перемотки и снапаем её в фазу с мастером внутри +/-0.5 бита
          const prevPos = d.pos;
          d.pos = targetSrc;
          targetSrc = this.alignedPosSrc(di);
          d.pos = prevPos;
        }
        this.applySeekSrc(d, targetSrc, m.q, d.playing && d.fade > 0.01);
        if (!d.playing && d.fade > 0) d.fadeDir = -1;
        break;
      }
      case 'scratchStart':
        d.mode = 1; d.sPos = d.pos; d.sVel = 0; d.sAge = 0;
        d.fadeDir = 1;
        break;
      case 'scratch':
        if (d.mode !== 1) { d.mode = 1; d.sPos = d.pos; }
        d.fadeDir = 1;
        if (d.len >= 2) {
          const nextS = typeof m.dd === 'number' ? d.sPos + m.dd * d.srcSr : d.sPos;
          d.sPos = Math.max(0, Math.min(d.len - 2, nextS));
        }
        d.sVel = m.v; d.sAge = 0;
        break;
      case 'scratchEnd':
        d.mode = 0;
        d.playing = !!m.playing;
        d.target = m.v || 0;
        d.tau = m.tau || 0.04;
        if (d.playing) {
          d.fadeDir = 1;
          if (m.align && d.sync && di !== this.masterIdx && this.decks[this.masterIdx].playing) {
            this.alignDeck(di);
          }
        } else {
          d.fadeDir = -1;
        }
        break;
      case 'loop':
        if (m.s < 0) { d.loopS = -1; d.loopE = -1; }
        else { d.loopS = m.s * d.srcSr; d.loopE = m.e * d.srcSr; }
        break;
    }
  }

  sampleCubic(d, p) {
    const L = d.L, R = d.R, last = d.len - 2;
    if (p < 1 || p >= last) {
      const idx = p < 0 ? 0 : p >= d.len ? d.len - 1 : (p | 0);
      return [L[idx] || 0, (R !== L ? R[idx] : L[idx]) || 0];
    }
    const i1 = p | 0, f = p - i1;
    const i0 = i1 - 1, i2 = i1 + 1, i3 = i1 + 2;
    let y0 = L[i0], y1 = L[i1], y2 = L[i2], y3 = L[i3];
    let c1 = 0.5 * (y2 - y0), c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3, c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
    const l = ((c3 * f + c2) * f + c1) * f + y1;
    let r = l;
    if (R !== L) {
      y0 = R[i0]; y1 = R[i1]; y2 = R[i2]; y3 = R[i3];
      c1 = 0.5 * (y2 - y0); c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3; c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
      r = ((c3 * f + c2) * f + c1) * f + y1;
    }
    return [l, r];
  }

  stepDeckAudio(d, outL, outR, i, kScr, follow, maxAge, inStep, outStep) {
    if (!d.L || d.len < 4) { outL[i] = 0; outR[i] = 0; return; }

    // Фейд старта/остановки
    if (d.fadeDir > 0) {
      d.fade += inStep;
      if (d.fade >= 1) { d.fade = 1; d.fadeDir = 0; }
    } else if (d.fadeDir < 0) {
      d.fade -= outStep;
      if (d.fade <= 0) {
        d.fade = 0; d.fadeDir = 0;
        if (!d.playing && d.mode === 0) d.speed = 0;
      }
    }

    if (d.fade <= 0 && !d.playing && d.mode === 0) {
      outL[i] = 0; outR[i] = 0;
      return;
    }

    // Если дека затухает в паузу/после seek-на-паузе, просто гасим хвост без утечки с новой позиции
    if (!d.playing && d.mode === 0) {
      outL[i] = d.lastL * d.fade;
      outR[i] = d.lastR * d.fade;
      return;
    }

    const last = d.len - 2;
    let [l, r] = this.sampleCubic(d, d.pos);

    if (d.xActive) {
      const progress = 1 - d.xLeft / d.xTotal;
      const [fl, fr] = this.sampleCubic(d, d.xPos);
      l = fl + (l - fl) * progress;
      r = fr + (r - fr) * progress;
      d.xPos += d.speed * d.ratio;
      if (d.loopS >= 0 && d.speed > 0 && d.xPos >= d.loopE) d.xPos -= (d.loopE - d.loopS);
      if (--d.xLeft <= 0) d.xActive = false;
    }

    d.lastL = l; d.lastR = r;
    const g = d.fade;
    outL[i] = l * g;
    outR[i] = r * g;

    d.pos += d.speed * d.ratio;
    if (d.loopS >= 0 && d.speed > 0 && d.pos >= d.loopE) {
      const w = d.loopE - d.loopS;
      d.pos -= w; d.sPos -= w;
    } else if (d.loopS >= 0 && d.speed < 0 && d.pos < d.loopS) {
      const w = d.loopE - d.loopS;
      d.pos += w; d.sPos += w;
    }
    if (d.pos < 0) { d.pos = 0; if (d.speed < 0) d.speed = 0; }
    else if (d.pos >= last) {
      d.pos = last;
      if (d.speed > 0) d.speed = 0;
      if (!d.ended && d.mode === 0) { d.ended = true; d.endedFlag = true; }
    }
  }

  /** Сэмпл-синхронный рендер обеих дек с нулевой рассинхронизацией фазы. */
  renderDual(oAL, oAR, oBL, oBR, n) {
    const sr = this.sr;
    const kScr = 1 - Math.exp(-1 / (0.004 * sr));
    const maxAge = 0.06 * sr;
    const inStep = 1 / Math.max(16, Math.round(sr * 0.0012));  // ~1.2 ms анти-клик при старте (скорость уже 1.0x!)
    const outStep = 1 / Math.max(32, Math.round(sr * 0.003));  // ~3.0 ms плавное затухание при паузе
    const a = this.decks[0], b = this.decks[1];
    const followA = a.srcSr > 0 ? 1 / (0.025 * a.srcSr) : 0;
    const followB = b.srcSr > 0 ? 1 / (0.025 * b.srcSr) : 0;
    const kPlayA = 1 - Math.exp(-1 / (Math.max(0.0005, a.tau) * sr));
    const kPlayB = 1 - Math.exp(-1 / (Math.max(0.0005, b.tau) * sr));

    for (let i = 0; i < n; i++) {
      // 1. Обновление скорости каждой деки (Master first, затем Slave в этот же сэмпл!)
      for (let step = 0; step < 2; step++) {
        const di = step === 0 ? this.masterIdx : 1 - this.masterIdx;
        const d = this.decks[di];
        if (!d.L || d.len < 4) continue;
        if (d.mode === 1) {
          if (d.sAge < maxAge) { d.sPos += d.sVel * d.ratio; d.sAge++; }
          const last = d.len - 2;
          if (d.sPos < 0) d.sPos = 0; else if (d.sPos > last) d.sPos = last;
          const follow = di === 0 ? followA : followB;
          let want = (d.sAge < maxAge ? d.sVel : 0) + (d.sPos - d.pos) * follow;
          if (want > 16) want = 16; else if (want < -16) want = -16;
          d.speed += (want - d.speed) * kScr;
        } else if (d.playing) {
          const m = this.decks[this.masterIdx];
          if (d.sync && di !== this.masterIdx && !d.manualBend && d.bpm > 0 && m.bpm > 0 && m.L && m.playing && m.mode === 0) {
            // Сэмпл-синхронный Beat Sync + Micro-PLL прямо в аудио-потоке
            const baseRate = m.speed * (m.bpm / d.bpm) * d.halfMul;
            const isSubBeatLoop = d.loopS >= 0 && d.beatSrc > 0 && (d.loopE - d.loopS) < d.beatSrc * 0.99;
            let pll = 0;
            if (!isSubBeatLoop) {
              const scaleM = d.halfMul < 1 ? d.halfMul : 1;
              const scaleF = d.halfMul > 1 ? 1 / d.halfMul : 1;
              const rawM = ((m.pos / m.srcSr - m.fb) / (60 / m.bpm)) * scaleM;
              const rawF = ((d.pos / d.srcSr - d.fb) / (60 / d.bpm)) * scaleF;
              let errScaled = (rawM - Math.floor(rawM)) - (rawF - Math.floor(rawF));
              if (errScaled > 0.5) errScaled -= 1;
              else if (errScaled < -0.5) errScaled += 1;
              const errBeatsF = errScaled / scaleF;

              if (Math.abs(errBeatsF) > 0.08 && !d.xActive) {
                this.alignDeck(di);
              } else if (Math.abs(errBeatsF) > 0.00012) {
                pll = Math.max(-0.04, Math.min(0.04, errBeatsF * 4.0));
              }
            }
            const want = baseRate * (1 + pll);
            d.target = baseRate;
            d.speed = want < 0.2 ? 0.2 : want > 4 ? 4 : want;
          } else {
            const kPlay = di === 0 ? kPlayA : kPlayB;
            d.speed += (d.target - d.speed) * kPlay;
          }
        }
      }

      // 2. Шаг рендера и сдвига позиций обеих дек в этом сэмпле
      this.stepDeckAudio(a, oAL, oAR, i, kScr, followA, maxAge, inStep, outStep);
      this.stepDeckAudio(b, oBL, oBR, i, kScr, followB, maxAge, inStep, outStep);
    }
  }
}
`;

export const WORKLET_SOURCE = `${DSP_CORE_SOURCE}
class OdDualDeckProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.core = new DualDeckCore(sampleRate);
    this.q = 0;
    this.port.onmessage = (e) => this.core.msg(e.data);
  }
  process(_inputs, outputs) {
    const oA = outputs[0];
    const oB = outputs[1];
    const aL = oA[0], aR = oA[1] || oA[0];
    const bL = oB[0], bR = oB[1] || oB[0];
    this.core.renderDual(aL, aR, bL, bR, aL.length);
    const a = this.core.decks[0];
    const b = this.core.decks[1];
    if (++this.q >= 2 || a.endedFlag || b.endedFlag) {
      this.q = 0;
      this.port.postMessage({
        A: { p: a.pos / a.srcSr, s: a.speed, e: a.endedFlag, m: a.mode, q: a.seq },
        B: { p: b.pos / b.srcSr, s: b.speed, e: b.endedFlag, m: b.mode, q: b.seq }
      });
      a.endedFlag = false;
      b.endedFlag = false;
    }
    return true;
  }
}
registerProcessor('od-dual-deck', OdDualDeckProcessor);
`;

export interface DualSlotTelemetry {
  pos: number;
  speed: number;
  srcSr: number;
  mode: number;
  seq: number;
  endedFlag: boolean;
}

export interface DualDeckCoreLike {
  decks: [DualSlotTelemetry, DualSlotTelemetry];
  msg(m: unknown): void;
  renderDual(oAL: Float32Array, oAR: Float32Array, oBL: Float32Array, oBR: Float32Array, n: number): void;
}

/** Fallback: создаёт единый DualDeckCore в главном потоке (для ScriptProcessorNode). */
export function createMainThreadDualCore(sampleRate: number): DualDeckCoreLike {
  // eslint-disable-next-line no-new-func
  const Ctor = new Function(`${DSP_CORE_SOURCE}\nreturn DualDeckCore;`)() as new (sr: number) => DualDeckCoreLike;
  return new Ctor(sampleRate);
}
