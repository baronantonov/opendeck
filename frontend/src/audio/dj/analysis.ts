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
const ONSET_FPS = 400; // 2.5 ms шаг огибающей
const RAW_FPS = 1000;  // 1.0 ms огибающая исходного PCM (0 ms групповой задержки)

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

function percentile(arr: Float32Array | number[], p: number): number {
  const len = arr.length;
  if (len === 0) return 0;
  const step = Math.max(1, Math.floor(len / 20000));
  const s: number[] = [];
  for (let i = 0; i < len; i += step) s.push(arr[i]);
  s.sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))] || 0;
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
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
  const rawHop = sr / RAW_FPS;
  const nw = Math.max(1, Math.ceil(n / waveHop));
  const no = Math.max(1, Math.ceil(n / onsetHop));
  const nr = Math.max(1, Math.ceil(n / rawHop));
  const low = new Float32Array(nw);
  const mid = new Float32Array(nw);
  const high = new Float32Array(nw);
  const eLow = new Float32Array(no);
  const eMid = new Float32Array(no);
  const eHigh = new Float32Array(no);
  const rawPeak = known ? null : new Float32Array(nr);

  const lp = biquad('lowpass', 170, sr);
  const hp = biquad('highpass', 3400, sr);
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

      const wi = Math.min(nw - 1, (i / waveHop) | 0);
      const al = ly < 0 ? -ly : ly;
      const am = my < 0 ? -my : my;
      const ah = hy < 0 ? -hy : hy;
      if (al > low[wi]) low[wi] = al;
      if (am > mid[wi]) mid[wi] = am;
      if (ah > high[wi]) high[wi] = ah;

      const oi = Math.min(no - 1, (i / onsetHop) | 0);
      eLow[oi] += ly * ly;
      eMid[oi] += my * my;
      eHigh[oi] += hy * hy;

      const ax = x < 0 ? -x : x;
      if (rawPeak) {
        const ri = Math.min(nr - 1, (i / rawHop) | 0);
        if (ax > rawPeak[ri]) rawPeak[ri] = ax;
      }

      sumSq += x * x;
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

  // Сглаживание НЧ-энергии с окном адаптивного среднего для отбеливания тихих интро/брейков
  const kickNovelty = buildAdaptiveNovelty(eLow, eMid, ONSET_FPS);
  const broadFlux = buildWideNovelty(eLow, eMid, eHigh, ONSET_FPS);
  await tick();

  const { bpm, offset } = detectTempoAndPhase(kickNovelty, broadFlux, eLow, eHigh, rawPeak!, ONSET_FPS, RAW_FPS, duration);
  await tick();

  const firstBeat = detectDownbeat(offset, bpm, duration, eLow, eHigh, rawPeak!, ONSET_FPS, RAW_FPS);
  return { wave, bpm, firstBeat, rms, peak };
}

function buildAdaptiveNovelty(eLow: Float32Array, eMid: Float32Array, fps: number): Float32Array {
  const no = eLow.length;
  const flux = new Float32Array(no);
  const lowS = Math.max(1e-6, percentile(eLow, 0.9) * 0.02);
  const midS = Math.max(1e-6, percentile(eMid, 0.9) * 0.02);
  let pl = 0;
  let pm = 0;
  for (let i = 0; i < no; i++) {
    const vl = Math.log1p(eLow[i] / lowS);
    const vm = Math.log1p(eMid[i] / midS);
    const dl = vl > pl ? vl - pl : 0;
    const dm = vm > pm ? vm - pm : 0;
    flux[i] = dl + 0.35 * dm;
    pl = vl;
    pm = vm;
  }
  return subtractLocalMean(flux, Math.round(fps * 0.16));
}

function buildWideNovelty(eLow: Float32Array, eMid: Float32Array, eHigh: Float32Array, fps: number): Float32Array {
  const no = eLow.length;
  const flux = new Float32Array(no);
  const lowS = Math.max(1e-6, percentile(eLow, 0.9) * 0.02);
  const midS = Math.max(1e-6, percentile(eMid, 0.9) * 0.02);
  const hiS = Math.max(1e-6, percentile(eHigh, 0.9) * 0.02);
  let pl = 0, pm = 0, ph = 0;
  for (let i = 0; i < no; i++) {
    const vl = Math.log1p(eLow[i] / lowS);
    const vm = Math.log1p(eMid[i] / midS);
    const vh = Math.log1p(eHigh[i] / hiS);
    const dl = vl > pl ? vl - pl : 0;
    const dm = vm > pm ? vm - pm : 0;
    const dh = vh > ph ? vh - ph : 0;
    flux[i] = dl + 0.35 * dm + 0.25 * dh;
    pl = vl;
    pm = vm;
    ph = vh;
  }
  return subtractLocalMean(flux, Math.round(fps * 0.16));
}

function subtractLocalMean(flux: Float32Array, halfWin: number): Float32Array {
  const N = flux.length;
  const prefix = new Float64Array(N + 1);
  for (let i = 0; i < N; i++) prefix[i + 1] = prefix[i] + flux[i];
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = Math.max(0, i - halfWin);
    const b = Math.min(N, i + halfWin + 1);
    const mean = (prefix[b] - prefix[a]) / (b - a);
    const v = flux[i] - mean * 1.15;
    out[i] = v > 0 ? v : 0;
  }
  return out;
}

interface PeakHit {
  t: number; // время пика (сек)
  w: number; // сила
}

function extractOnsetPeaks(novelty: Float32Array, fps: number, minGapSec = 0.11): PeakHit[] {
  const p97 = Math.max(1e-6, percentile(novelty, 0.97));
  const thr = p97 * 0.16;
  const minGap = Math.max(1, Math.round(minGapSec * fps));
  const peaks: PeakHit[] = [];
  for (let i = 1; i + 1 < novelty.length; i++) {
    const v = novelty[i];
    if (v < thr || v < novelty[i - 1] || v < novelty[i + 1]) continue;
    const last = peaks.length ? peaks[peaks.length - 1] : null;
    if (last && i - Math.round(last.t * fps) < minGap) {
      if (v > last.w) {
        last.t = i / fps;
        last.w = v;
      }
      continue;
    }
    peaks.push({ t: i / fps, w: v });
  }
  return peaks;
}

/** Ищет фазовый максимум методом фазовой свёртки пиков и возвращает оценку phase (0..beatLen) + score. */
function foldPhaseScore(peaks: PeakHit[], bpm: number, bins = 240, sigmaBins = 4.5): { phase: number; score: number } {
  const beatLen = 60 / bpm;
  const hist = new Float64Array(bins);
  for (let i = 0; i < peaks.length; i++) {
    const b = Math.floor((((peaks[i].t % beatLen) + beatLen) % beatLen) / beatLen * bins) % bins;
    hist[b] += peaks[i].w;
  }
  // Круговая свёртка гауссианом для устойчивости к микроджиттеру атак
  const r = Math.ceil(sigmaBins * 2.5);
  const kernel = new Float64Array(r * 2 + 1);
  for (let k = -r; k <= r; k++) kernel[k + r] = Math.exp(-0.5 * (k / sigmaBins) ** 2);

  let bestBin = 0;
  let bestVal = -1;
  for (let b = 0; b < bins; b++) {
    let s = 0;
    for (let k = -r; k <= r; k++) {
      const idx = (b + k + bins * 4) % bins;
      s += hist[idx] * kernel[k + r];
    }
    if (s > bestVal) {
      bestVal = s;
      bestBin = b;
    }
  }
  return { phase: ((bestBin + 0.5) / bins) * beatLen, score: bestVal };
}

/** Определяет грубый BPM на 100 FPS нормализованной автокорреляцией. */
function estimateCoarseBpm(broadFlux: Float32Array, fps: number): number {
  const ds = Math.max(1, Math.round(fps / 100)); // 100 FPS -> 10 мс бины
  const dfps = fps / ds;
  const M = Math.floor(broadFlux.length / ds);
  if (M < dfps * 6) return 120;
  const dsBuf = new Float32Array(M);
  for (let i = 0; i < M; i++) {
    let s = 0;
    for (let j = 0; j < ds; j++) s += broadFlux[i * ds + j];
    dsBuf[i] = s;
  }

  let mean = 0;
  for (let i = 0; i < M; i++) mean += dsBuf[i];
  mean /= M;
  const o = new Float32Array(M);
  for (let i = 0; i < M; i++) o[i] = dsBuf[i] - mean;

  const lim = Math.min(M, Math.round(dfps * 120));
  const minBpm = 62;
  const maxBpm = 198;
  const minLag = Math.max(2, Math.floor((dfps * 60) / maxBpm));
  const maxLag = Math.min(lim - 2, Math.ceil((dfps * 60) / minBpm));
  const ac = new Float32Array(maxLag * 2 + 4);

  for (let lag = minLag; lag <= Math.min(maxLag * 2 + 1, lim - 1); lag++) {
    let num = 0;
    let ea = 0;
    let eb = 0;
    for (let i = lag; i < lim; i++) {
      const a = o[i];
      const b = o[i - lag];
      num += a * b;
      ea += a * a;
      eb += b * b;
    }
    const den = Math.sqrt(ea * eb);
    ac[lag] = den > 0 ? num / den : 0;
  }

  let bestLag = 0;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = (dfps * 60) / lag;
    if (bpm < 68 || bpm > 190) continue;
    const z = Math.log2(bpm / 124) / 0.62;
    const prior = Math.exp(-0.5 * z * z);
    const sub = ac[lag * 2] || 0;
    const score = (ac[lag] + 0.45 * sub) * prior;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  if (!bestLag) return 120;

  const y0 = ac[bestLag - 1] || 0;
  const y1 = ac[bestLag];
  const y2 = ac[bestLag + 1] || 0;
  const den = y0 - 2 * y1 + y2;
  const shift = den < 0 && y1 >= y0 && y1 >= y2 ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / den)) : 0;
  return (dfps * 60) / Math.max(minLag, bestLag + shift);
}

/**
 * Уточнение BPM + Zero-Lag Attack Edge Snap по 1 мс огибающей rawPeak.
 * Полностью убирает групповую задержку Biquad-фильтров и смещение саб-хвоста бочки.
 */
function detectTempoAndPhase(
  kickNovelty: Float32Array,
  broadFlux: Float32Array,
  eLow: Float32Array,
  _eHigh: Float32Array,
  rawPeak: Float32Array,
  fps: number,
  rawFps: number,
  duration: number,
): { bpm: number; offset: number } {
  if (kickNovelty.length < fps * 6) return { bpm: 120, offset: 0 };

  let coarse = estimateCoarseBpm(broadFlux, fps);
  let peaks = extractOnsetPeaks(kickNovelty, fps, 0.11);
  if (peaks.length < 6) peaks = extractOnsetPeaks(broadFlux, fps, 0.11);
  if (peaks.length < 4) return { bpm: Math.round(coarse * 100) / 100, offset: 0 };

  // Проверка octave ambiguity (x2 / x0.5): если на половине периода (полубитах) нет НЧ-бочек, не удваивать 128->256 или 70->140;
  // наоборот, если на полубитах регулярная НЧ-бочка (>= 65% от чётных битов), выбираем быстрый темп.
  const scoreKickAtPhase = (bpm: number, phase: number, subDiv = 1) => {
    const bl = 60 / bpm;
    let sum = 0;
    let cnt = 0;
    for (let t = phase + bl / subDiv; t < duration; t += bl) {
      const idx = Math.round(t * fps);
      let mx = 0;
      for (let j = -4; j <= 4; j++) {
        const v = eLow[idx + j];
        if (v !== undefined && v > mx) mx = v;
      }
      sum += mx;
      cnt++;
    }
    return cnt > 0 ? sum / cnt : 0;
  };

  if (coarse < 92 && coarse * 2 <= 185) {
    const main = foldPhaseScore(peaks, coarse, 240, 4);
    const onBeat = scoreKickAtPhase(coarse, main.phase - (60 / coarse), 1);
    const midBeat = scoreKickAtPhase(coarse, main.phase, 2);
    if (midBeat > onBeat * 0.58) coarse *= 2;
  } else if (coarse > 152 && coarse * 0.5 >= 72) {
    const half = coarse * 0.5;
    const hFold = foldPhaseScore(peaks, half, 240, 4);
    const onBeat = scoreKickAtPhase(half, hFold.phase - (60 / half), 1);
    const midBeat = scoreKickAtPhase(half, hFold.phase, 2);
    if (midBeat < onBeat * 0.32) coarse = half;
  }

  // Тонкий поиск точного BPM через пик-свёртку (устойчиво к брейкдаунам и несинхронным хэтам)
  let bestBpm = coarse;
  let bestComb = -1;
  for (let b = coarse * 0.97; b <= coarse * 1.03; b += 0.025) {
    const { score } = foldPhaseScore(peaks, b, 240, 4);
    if (score > bestComb) {
      bestComb = score;
      bestBpm = b;
    }
  }
  for (let b = bestBpm - 0.04; b <= bestBpm + 0.04; b += 0.004) {
    const { score } = foldPhaseScore(peaks, b, 300, 3);
    if (score > bestComb) {
      bestComb = score;
      bestBpm = b;
    }
  }

  // Находим опорную фазу бочки при bestBpm (сначала широкий σ, потом узкий)
  let { phase: roughPhase } = foldPhaseScore(peaks, bestBpm, 360, 4);

  // Регрессионная полировка BPM и точная фиксация фронта атаки по 1мс огибающей rawPeak
  const snapResult = snapGridToAttackEdges(roughPhase, bestBpm, duration, eLow, rawPeak, fps, rawFps);
  let finalBpm = snapResult.fittedBpm ?? bestBpm;

  // Умное округление до целого BPM (Mixxx rule): округляем ТОЛЬКО если реальный дрейф на длине трека <= 12 мс и combScore не падает
  const rounded = Math.round(finalBpm);
  if (Math.abs(finalBpm - rounded) < 0.05) {
    const driftSec = (Math.abs(finalBpm - rounded) / rounded) * duration;
    const { score: roundScore } = foldPhaseScore(peaks, rounded, 300, 3);
    const { score: fineScore } = foldPhaseScore(peaks, finalBpm, 300, 3);
    if (driftSec <= 0.012 || roundScore >= fineScore * 0.96) {
      finalBpm = rounded;
    } else {
      finalBpm = Math.round(finalBpm * 100) / 100;
    }
  } else {
    finalBpm = Math.round(finalBpm * 100) / 100;
  }

  // Финальный пересчёт точной фазы переднего фронта атаки при итоговом finalBpm
  const { phase: finalRough } = foldPhaseScore(peaks, finalBpm, 360, 3);
  const finalSnap = snapGridToAttackEdges(finalRough, finalBpm, duration, eLow, rawPeak, fps, rawFps);
  const beatLen = 60 / finalBpm;
  const offset = ((finalSnap.phase % beatLen) + beatLen) % beatLen;
  return { bpm: finalBpm, offset };
}

/**
 * Ключевая часть Zero-Lag Beatgrid:
 * Для каждого бита i, где действительно звучит бочка, смотрим в окно [t_i - 35ms .. t_i + 15ms]
 * на БЕЗФАЗОВУЮ 1 мс огибающую rawPeak и находим первую миллисекунду резкого нарастания удара.
 * Возвращает медианную фазу начала атаки + линейно-подогнанный BPM по битам.
 */
function snapGridToAttackEdges(
  roughPhase: number,
  bpm: number,
  duration: number,
  eLow: Float32Array,
  rawPeak: Float32Array,
  fps: number,
  rawFps: number,
): { phase: number; fittedBpm: number | null } {
  const beatLen = 60 / bpm;
  const pLowCut = percentile(eLow, 0.85) * 0.15;
  const beatIndices: number[] = [];
  const edgeOffsetsMs: number[] = [];
  const edgeTimes: number[] = [];

  const totalBeats = Math.floor((duration - roughPhase) / beatLen);
  const preMs = 42;
  const postMs = 15;

  for (let b = 0; b < totalBeats; b++) {
    const tBeat = roughPhase + b * beatLen;
    const oi = Math.round(tBeat * fps);
    let lowMax = 0;
    for (let j = -6; j <= 10; j++) {
      const v = eLow[oi + j];
      if (v !== undefined && v > lowMax) lowMax = v;
    }
    if (lowMax < pLowCut) continue; // пропускаем тишину/брейкдаун без бочки

    const centerR = Math.round(tBeat * rawFps);
    const startR = Math.max(4, centerR - preMs);
    const endR = Math.min(rawPeak.length - 4, centerR + postMs);
    if (endR - startR < 10) continue;

    // 1) Вычисляем самый резкий положительный фронт атаки (а не саб-хвост баса до бочки!)
    let bestSlope = 0;
    let slopeIdx = centerR;
    let localPeak = 0;
    for (let r = startR; r <= endR; r++) {
      if (rawPeak[r] > localPeak) localPeak = rawPeak[r];
      const pre = Math.max(rawPeak[r - 5], rawPeak[r - 4], rawPeak[r - 3], rawPeak[r - 2]);
      const post = Math.max(rawPeak[r], rawPeak[r + 1]);
      const slope = post - pre;
      if (slope > bestSlope) {
        bestSlope = slope;
        slopeIdx = r;
      }
    }
    if (localPeak < 0.03 || bestSlope < localPeak * 0.12) continue;

    // 2) От точки максимального наклона шагаем к основанию переднего фронта (в точке >= 22% высоты ступеньки)
    let edgeR = slopeIdx;
    const baseLevel = Math.min(rawPeak[slopeIdx - 3] || 0, rawPeak[slopeIdx - 2] || 0, rawPeak[slopeIdx - 1] || 0);
    const stepPeak = Math.max(rawPeak[slopeIdx], rawPeak[slopeIdx + 1]);
    const edgeThr = baseLevel + (stepPeak - baseLevel) * 0.22;
    const minPre = Math.max(startR - 2, slopeIdx - 5);
    while (edgeR > minPre && rawPeak[edgeR - 1] >= edgeThr && rawPeak[edgeR - 1] <= rawPeak[edgeR]) {
      edgeR--;
    }

    const edgeTime = edgeR / rawFps;
    const offsetMs = (edgeTime - tBeat) * 1000;
    if (offsetMs >= -preMs && offsetMs <= postMs) {
      beatIndices.push(b);
      edgeOffsetsMs.push(offsetMs);
      edgeTimes.push(edgeTime);
    }
  }

  if (edgeOffsetsMs.length < 4) {
    return { phase: roughPhase, fittedBpm: null };
  }

  const medOffsetSec = medianOf(edgeOffsetsMs) / 1000;
  let fittedBpm: number | null = null;

  // Линейная регрессия только по инлайнерам (±6 ms от медианы), чтобы шумные доли не портили период
  const inliers: { b: number; t: number }[] = [];
  for (let i = 0; i < beatIndices.length; i++) {
    if (Math.abs(edgeOffsetsMs[i] - medOffsetSec * 1000) <= 6) {
      inliers.push({ b: beatIndices[i], t: edgeTimes[i] });
    }
  }
  if (inliers.length >= 12) {
    let bx = 0, ty = 0;
    for (const p of inliers) { bx += p.b; ty += p.t; }
    bx /= inliers.length;
    ty /= inliers.length;
    let cov = 0, varB = 0;
    for (const p of inliers) {
      cov += (p.b - bx) * (p.t - ty);
      varB += (p.b - bx) ** 2;
    }
    if (varB > 0) {
      const period = cov / varB;
      const candBpm = 60 / period;
      if (Math.abs(candBpm / bpm - 1) < 0.015) {
        fittedBpm = candBpm;
      }
    }
  }

  return {
    phase: roughPhase + medOffsetSec,
    fittedBpm,
  };
}

/**
 * Выбирает первую долю такта (1 из 4 ударов) среди активных ударных квадратов:
 * на 1 и 3 долях максимален НЧ-кик и ниже отношение ВЧ-клэпа/снейра, плюс первый сильный вход ритма.
 */
function detectDownbeat(
  offset: number,
  bpm: number,
  duration: number,
  eLow: Float32Array,
  eHigh: Float32Array,
  _rawPeak: Float32Array,
  fps: number,
  _rawFps: number,
): number {
  const beatLen = 60 / bpm;
  const barScore = new Float64Array(4);
  const lowCut = Math.max(1e-6, percentile(eLow, 0.85) * 0.25);

  // Определяем первый реальный удар бочки в треке (как якорь Beat 1 для ровных интро)
  let firstActiveK = 0;
  let foundActive = false;
  for (let t = offset, idx = 0; t < duration; t += beatLen, idx++) {
    const oi = Math.round(t * fps);
    let l = 0;
    for (let j = -2; j <= 8; j++) {
      if (eLow[oi + j] !== undefined && eLow[oi + j] > l) l = eLow[oi + j];
    }
    if (l >= lowCut) {
      firstActiveK = idx % 4;
      foundActive = true;
      break;
    }
  }

  // Оцениваем, какой из 4 битов сильнее по бочке и беднее по снейрам/клэпам (доля 1 vs доли 2/4)
  for (let k = 0; k < 4; k++) {
    let lowSum = 0;
    let highSum = 0;
    let cnt = 0;
    for (let t = offset + k * beatLen; t < duration; t += beatLen * 4) {
      if (t < beatLen * 2) continue; // пропускаем warm-up biquad на самых первых сэмплах
      const oi = Math.round(t * fps);
      let l = 0, h = 0;
      for (let j = -2; j <= 8; j++) {
        if (eLow[oi + j] !== undefined) l += eLow[oi + j];
        if (eHigh[oi + j] !== undefined) h += eHigh[oi + j];
      }
      if (l > lowCut * 0.5) {
        lowSum += l;
        highSum += h;
        cnt++;
      }
    }
    barScore[k] = cnt > 0 ? (lowSum - 0.2 * highSum) / cnt : 0;
  }

  let bestK = foundActive ? firstActiveK : 0;
  for (let k = 0; k < 4; k++) {
    if (barScore[k] > barScore[bestK] * 1.03) bestK = k;
  }
  return offset + bestK * beatLen;
}

/** Обратно-совместимый экспорт для внешних вызовов, если используются напрямую. */
export function detectTempo(onset: Float32Array, fps: number): { bpm: number; offset: number } {
  const dummyLow = onset;
  const dummyRaw = new Float32Array(Math.max(1, Math.round((onset.length / fps) * 1000)));
  for (let i = 0; i < dummyRaw.length; i++) {
    dummyRaw[i] = onset[Math.min(onset.length - 1, Math.floor((i / 1000) * fps))] || 0;
  }
  const N = subtractLocalMean(onset, Math.round(fps * 0.16));
  return detectTempoAndPhase(N, N, dummyLow, dummyLow, dummyRaw, fps, 1000, onset.length / fps);
}
