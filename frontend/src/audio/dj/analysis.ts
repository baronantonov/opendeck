// Анализ трека: 3-полосная волна (как в rekordbox: low=красный, mid=зелёный, high=синий),
// детект BPM, фаза бит-сетки и даунбит. Чистый JS, без зависимостей.

export interface WaveData {
  low: Float32Array;
  mid: Float32Array;
  high: Float32Array;
  /** точек волны в секунду */
  pps: number;
  duration: number;
}

export interface TrackAnalysis {
  wave: WaveData;
  bpm: number;
  /** время (сек) первого даунбита сетки (может быть > 0) */
  firstBeat: number;
  rms: number;
  peak: number;
}

const PPS = 120;
const ONSET_FPS = 200;

interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

function biquad(type: 'lowpass' | 'highpass', f: number, sr: number, q = Math.SQRT1_2): Biquad {
  const w = (2 * Math.PI * f) / sr;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  if (type === 'lowpass') {
    return { b0: (1 - cos) / 2 / a0, b1: (1 - cos) / a0, b2: (1 - cos) / 2 / a0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0 };
  }
  return { b0: (1 + cos) / 2 / a0, b1: -(1 + cos) / a0, b2: (1 + cos) / 2 / a0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0 };
}

const tick = () => new Promise<void>((r) => window.setTimeout(r, 0));

function percentile(arr: Float32Array, p: number): number {
  const step = Math.max(1, Math.floor(arr.length / 20000));
  const s: number[] = [];
  for (let i = 0; i < arr.length; i += step) s.push(arr[i]);
  s.sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))] || 0;
}

export async function analyzeAudio(
  L: Float32Array,
  R: Float32Array | null,
  sr: number,
  known?: { bpm: number; firstBeat: number },
): Promise<TrackAnalysis> {
  const n = L.length;
  const duration = n / sr;
  const waveHop = sr / PPS;
  const onsetHop = sr / ONSET_FPS;
  const nw = Math.max(1, Math.ceil(n / waveHop));
  const no = Math.max(1, Math.ceil(n / onsetHop));
  const low = new Float32Array(nw);
  const mid = new Float32Array(nw);
  const high = new Float32Array(nw);
  const eLow = new Float32Array(no);
  const eHigh = new Float32Array(no);

  const lp = biquad('lowpass', 180, sr);
  const hp = biquad('highpass', 3500, sr);
  let lx1 = 0, lx2 = 0, ly1 = 0, ly2 = 0;
  let hx1 = 0, hx2 = 0, hy1 = 0, hy2 = 0;
  let sumSq = 0;
  let peak = 0;

  const CHUNK = 1 << 19;
  for (let start = 0; start < n; start += CHUNK) {
    const end = Math.min(n, start + CHUNK);
    for (let i = start; i < end; i++) {
      const x = R ? (L[i] + R[i]) * 0.5 : L[i];
      const ly = lp.b0 * x + lp.b1 * lx1 + lp.b2 * lx2 - lp.a1 * ly1 - lp.a2 * ly2;
      lx2 = lx1; lx1 = x; ly2 = ly1; ly1 = ly;
      const hy = hp.b0 * x + hp.b1 * hx1 + hp.b2 * hx2 - hp.a1 * hy1 - hp.a2 * hy2;
      hx2 = hx1; hx1 = x; hy2 = hy1; hy1 = hy;
      const my = x - ly - hy;

      const wi = (i / waveHop) | 0;
      const al = ly < 0 ? -ly : ly;
      const am = my < 0 ? -my : my;
      const ah = hy < 0 ? -hy : hy;
      if (al > low[wi]) low[wi] = al;
      if (am > mid[wi]) mid[wi] = am;
      if (ah > high[wi]) high[wi] = ah;

      const oi = (i / onsetHop) | 0;
      eLow[oi] += ly * ly;
      eHigh[oi] += hy * hy;

      sumSq += x * x;
      const ax = x < 0 ? -x : x;
      if (ax > peak) peak = ax;
    }
    await tick();
  }

  // нормализация волны: общая шкала + веса полос (верх обычно тише по амплитуде)
  const wl = 1.0, wm = 1.25, wh = 2.1;
  const comb = new Float32Array(nw);
  for (let i = 0; i < nw; i++) comb[i] = Math.max(low[i] * wl, mid[i] * wm, high[i] * wh);
  const norm = Math.max(1e-4, percentile(comb, 0.985));
  for (let i = 0; i < nw; i++) {
    low[i] = Math.min(1, (low[i] * wl) / norm);
    mid[i] = Math.min(1, (mid[i] * wm) / norm);
    high[i] = Math.min(1, (high[i] * wh) / norm);
  }

  const rms = Math.sqrt(sumSq / Math.max(1, n));
  const wave: WaveData = { low, mid, high, pps: PPS, duration };

  if (known) return { wave, bpm: known.bpm, firstBeat: known.firstBeat, rms, peak };

  // onset-огибающая (лог-энергия, положительная производная)
  const onset = new Float32Array(no);
  let pl = 0, ph = 0;
  for (let i = 0; i < no; i++) {
    const vl = Math.log1p(eLow[i] * 400);
    const vh = Math.log1p(eHigh[i] * 4000);
    const dl = vl - pl;
    const dh = vh - ph;
    onset[i] = (dl > 0 ? dl : 0) + 0.45 * (dh > 0 ? dh : 0);
    pl = vl;
    ph = vh;
  }
  await tick();
  const { bpm, offset } = detectTempo(onset, ONSET_FPS);
  await tick();
  const beatLen = 60 / bpm;
  // даунбит: из 4 возможных фаз выбираем ту, где суммарно сильнее «бочка»
  let bestK = 0;
  let bestScore = -1;
  for (let k = 0; k < 4; k++) {
    let s = 0;
    for (let t = offset + k * beatLen; t < duration; t += beatLen * 4) {
      const i = Math.round(t * ONSET_FPS);
      for (let j = -2; j <= 2; j++) {
        const v = eLow[i + j];
        if (v !== undefined) s += v;
      }
    }
    if (s > bestScore) {
      bestScore = s;
      bestK = k;
    }
  }
  const firstBeat = offset + bestK * beatLen;
  return { wave, bpm, firstBeat, rms, peak };
}

/** BPM по автокорреляции + уточнение по фазовой когерентности (DFT огибающей на частоте бита). */
export function detectTempo(onset: Float32Array, fps: number): { bpm: number; offset: number } {
  const N = onset.length;
  if (N < fps * 6) return { bpm: 120, offset: 0 };
  let mean = 0;
  for (let i = 0; i < N; i++) mean += onset[i];
  mean /= N;
  const o = new Float32Array(N);
  for (let i = 0; i < N; i++) o[i] = onset[i] - mean;

  const minBpm = 60;
  const maxBpm = 200;
  const minLag = Math.floor((fps * 60) / maxBpm);
  const maxLag = Math.ceil((fps * 60) / minBpm);
  const ac = new Float32Array(maxLag * 2 + 2);
  const lim = Math.min(N, fps * 120); // хватает ~2 минут для грубой оценки
  for (let lag = minLag; lag <= Math.min(maxLag * 2, lim - 1); lag++) {
    let s = 0;
    for (let i = lag; i < lim; i++) s += o[i] * o[i - lag];
    ac[lag] = s / (lim - lag);
  }
  let bestLag = 0;
  let best = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = (fps * 60) / lag;
    if (bpm < 70 || bpm > 180) continue;
    const z = Math.log2(bpm / 125) / 0.6;
    const w = Math.exp(-0.5 * z * z);
    const score = (ac[lag] + 0.5 * (ac[lag * 2] || 0)) * w;
    if (score > best) {
      best = score;
      bestLag = lag;
    }
  }
  if (!bestLag) return { bpm: 120, offset: 0 };
  // параболическая интерполяция пика
  const y0 = ac[bestLag - 1] || 0, y1 = ac[bestLag], y2 = ac[bestLag + 1] || 0;
  const den = y0 - 2 * y1 + y2;
  const lagF = bestLag + (den !== 0 ? (0.5 * (y0 - y2)) / den : 0);
  const coarse = (fps * 60) / lagF;

  // точное уточнение: максимум |DFT| на частоте бита
  const dft = (bpm: number) => {
    const w = (2 * Math.PI * bpm) / 60 / fps;
    const cw = Math.cos(w), sw = Math.sin(w);
    let c = 1, s = 0, re = 0, im = 0;
    for (let i = 0; i < N; i++) {
      re += o[i] * c;
      im += o[i] * s;
      const nc = c * cw - s * sw;
      s = s * cw + c * sw;
      c = nc;
      if ((i & 1023) === 0) {
        const m = Math.hypot(c, s);
        c /= m;
        s /= m;
      }
    }
    return { re, im, mag: Math.hypot(re, im) };
  };
  let bestBpm = coarse;
  let bestMag = -1;
  const span = coarse * 0.02;
  for (let b = coarse - span; b <= coarse + span; b += 0.02) {
    const { mag } = dft(b);
    if (mag > bestMag) {
      bestMag = mag;
      bestBpm = b;
    }
  }
  for (let b = bestBpm - 0.02; b <= bestBpm + 0.02; b += 0.004) {
    const { mag } = dft(b);
    if (mag > bestMag) {
      bestMag = mag;
      bestBpm = b;
    }
  }
  let bpm = bestBpm;
  const rounded = Math.round(bpm);
  if (Math.abs(bpm - rounded) < 0.08) bpm = rounded;
  else bpm = Math.round(bpm * 100) / 100;

  const { re, im } = dft(bpm);
  const phase = Math.atan2(im, re); // пики косинуса там, где w*n = phase
  const beatFrames = (fps * 60) / bpm;
  let n0 = (phase / (2 * Math.PI)) * beatFrames;
  n0 = ((n0 % beatFrames) + beatFrames) % beatFrames;
  return { bpm, offset: n0 / fps };
}
