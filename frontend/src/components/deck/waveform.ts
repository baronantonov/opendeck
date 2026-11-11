// Rekordbox-style RGB waveform renderer for both synthesized demo tracks and
// user-loaded smartphone audio files.
// - Low = red, Mid = green, High = blue, mirrored around the centre axis
// - Beat grid aligned to `track.firstBeat` and `track.bpm`
// - Renders main CUE (orange), memory cues (red), hot cues (mint/green), and active Beat Loop region.

import type { TrackInfo } from '../../audio/dj/DjEngine';

function ampOf(l: number, m: number, h: number) {
  const v = 0.72 * Math.max(l, m, h * 0.8) + 0.18 * (l + m + h);
  return v > 1 ? 1 : v;
}

/** Instantaneous waveform level at `posSec` (0..1), fallback for meters. */
export function levelAt(track: TrackInfo | null, posSec: number): number {
  if (!track) return 0;
  const { wave } = track;
  const i = Math.floor(posSec * wave.pps);
  if (i < 0 || i >= wave.low.length) return 0;
  return ampOf(wave.low[i], wave.mid[i], wave.high[i]);
}

/** rekordbox RGB colouring: low → red, mid → green, high → blue. */
function rgb(l: number, m: number, h: number, dim: number): string {
  const mx = Math.max(l, m, h, 0.001);
  let r = l / mx;
  let g = (m / mx) * 0.82;
  let b = h / mx;
  const density = Math.min(1, (l + m + h) / 2.2);
  r = r + (1 - r) * density * 0.35;
  g = g + (1 - g) * density * 0.3;
  b = b + (1 - b) * density * 0.25;
  return `rgb(${(r * 255 * dim) | 0},${(g * 255 * dim) | 0},${(b * 255 * dim) | 0})`;
}

function prepareCanvas(c: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = c.offsetWidth;
  const h = c.offsetHeight;
  const pw = Math.max(1, Math.round(w * dpr));
  const ph = Math.max(1, Math.round(h * dpr));
  if (c.width !== pw || c.height !== ph) {
    c.width = pw;
    c.height = ph;
  }
  const ctx = c.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function sampleRangeSec(track: TrackInfo, t0: number, t1: number): [number, number, number] | null {
  const { wave } = track;
  const n = wave.low.length;
  let i0 = Math.floor(t0 * wave.pps);
  let i1 = Math.ceil(t1 * wave.pps);
  if (i1 <= 0 || i0 >= n) return null;
  i0 = Math.max(0, i0);
  i1 = Math.min(n, Math.max(i0 + 1, i1));
  let l = 0;
  let m = 0;
  let h = 0;
  for (let i = i0; i < i1; i++) {
    if (wave.low[i] > l) l = wave.low[i];
    if (wave.mid[i] > m) m = wave.mid[i];
    if (wave.high[i] > h) h = wave.high[i];
  }
  return [l, m, h];
}

export interface VerticalOptions {
  markerSide: 'left' | 'right';
  phaseColor: string;
  beatsVisible?: number;
  loop?: { start: number; end: number; beats: number } | null;
  hotCues?: (number | null)[];
}

/** Zoomed, vertically scrolling waveform (rekordbox mobile centre view). */
export function drawVertical(
  canvas: HTMLCanvasElement,
  track: TrackInfo | null,
  posSec: number,
  cueSec: number,
  opts: VerticalOptions,
) {
  const { ctx, w, h } = prepareCanvas(canvas);
  if (!ctx || w < 2 || h < 2) return;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  if (!track) return;

  const beatLen = 60 / Math.max(40, track.bpm);
  const curBeatFloat = (posSec - track.firstBeat) / beatLen;

  // Phase meter (4 beats of the bar)
  const meterH = 4;
  const seg = (w - 3) / 4;
  const curBeat = ((Math.floor(curBeatFloat) % 4) + 4) % 4;
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i === curBeat ? opts.phaseColor : '#262626';
    ctx.fillRect(i * (seg + 1), 0, seg, meterH);
  }

  const top = meterH + 3;
  const areaH = h - top;
  const playY = top + Math.round(areaH * 0.25);
  const secsVisible = (opts.beatsVisible ?? 8) * beatLen;
  const ppsY = areaH / secsVisible; // pixels per second
  const cx = w / 2;
  const maxHalf = w / 2 - 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, w, areaH);
  ctx.clip();

  // Active loop highlight
  if (opts.loop) {
    const y0 = playY + (opts.loop.start - posSec) * ppsY;
    const y1 = playY + (opts.loop.end - posSec) * ppsY;
    if (y1 >= top && y0 <= h) {
      ctx.fillStyle = 'rgba(243, 147, 33, 0.16)';
      ctx.fillRect(0, Math.max(top, y0), w, Math.min(h, y1) - Math.max(top, y0));
      ctx.fillStyle = '#f39321';
      ctx.fillRect(0, y0 - 1, w, 2);
      ctx.fillRect(0, y1 - 1, w, 2);
    }
  }

  for (let y = top; y < h; y++) {
    const t0 = posSec + (y - playY) / ppsY;
    if (t0 < 0 || t0 >= track.duration) continue;
    const s = sampleRangeSec(track, t0, t0 + 1 / ppsY);
    if (!s) continue;
    const [l, m, hh] = s;
    const half = Math.max(0.5, ampOf(l, m, hh) * maxHalf);
    const dim = y < playY ? 0.48 : 1;
    ctx.fillStyle = rgb(l, m, hh, dim);
    ctx.fillRect(cx - half, y, half * 2, 1);
    const core = Math.min(half, (hh * 0.45 + m * 0.35) * maxHalf * 0.55);
    if (core > 0.6) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 * dim})`;
      ctx.fillRect(cx - core, y, core * 2, 1);
    }
  }

  // Beat grid
  const firstSec = posSec - (playY - top) / ppsY;
  const lastSec = posSec + (h - playY) / ppsY;
  const firstK = Math.ceil((firstSec - track.firstBeat) / beatLen);
  const lastK = Math.floor((lastSec - track.firstBeat) / beatLen);
  for (let k = firstK; k <= lastK; k++) {
    const t = track.firstBeat + k * beatLen;
    if (t < 0 || t > track.duration) continue;
    const y = Math.round(playY + (t - posSec) * ppsY);
    const down = ((k % 4) + 4) % 4 === 0;
    const tick = down ? 8 : 4;
    ctx.fillStyle = down ? 'rgba(255,48,48,0.95)' : 'rgba(255,255,255,0.45)';
    ctx.fillRect(0, y, tick, 1);
    ctx.fillRect(w - tick, y, tick, 1);
    if (down) {
      ctx.fillStyle = 'rgba(255,48,48,0.22)';
      ctx.fillRect(tick, y, w - tick * 2, 1);
    }
  }

  const marker = (sec: number, color: string) => {
    const y = playY + (sec - posSec) * ppsY;
    if (y < top - 6 || y > h + 6) return;
    ctx.fillStyle = color;
    ctx.fillRect(0, y - 0.5, w, 1);
    ctx.beginPath();
    ctx.moveTo(w, y - 4);
    ctx.lineTo(w - 6, y);
    ctx.lineTo(w, y + 4);
    ctx.fill();
  };
  track.cues.forEach((c) => c > 0.05 && marker(c, 'rgba(255,40,40,0.85)'));
  opts.hotCues?.forEach((c) => c !== null && marker(c, '#00f0b5'));
  marker(cueSec, '#f39321');

  ctx.restore();

  // Playhead
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillRect(0, playY - 1, w, 2);
  ctx.fillStyle = '#f39321';
  ctx.beginPath();
  if (opts.markerSide === 'left') {
    ctx.moveTo(0, playY - 5);
    ctx.lineTo(8, playY);
    ctx.lineTo(0, playY + 5);
  } else {
    ctx.moveTo(w, playY - 5);
    ctx.lineTo(w - 8, playY);
    ctx.lineTo(w, playY + 5);
  }
  ctx.fill();
}

/** Full-track overview (rekordbox header waveform), bottom-anchored. */
export function drawOverview(
  canvas: HTMLCanvasElement,
  track: TrackInfo | null,
  posSec: number,
  cueSec: number,
  loop?: { start: number; end: number; beats: number } | null,
  hotCues?: (number | null)[],
) {
  const { ctx, w, h } = prepareCanvas(canvas);
  if (!ctx || w < 2 || h < 2) return;

  ctx.fillStyle = '#121212';
  ctx.fillRect(0, 0, w, h);

  if (!track || track.duration <= 0) return;

  const tickH = 5;
  const waveH = h - tickH - 1;
  const total = track.duration;

  if (loop) {
    const x0 = Math.max(0, (loop.start / total) * w);
    const x1 = Math.min(w, (loop.end / total) * w);
    ctx.fillStyle = 'rgba(243, 147, 33, 0.25)';
    ctx.fillRect(x0, 0, Math.max(2, x1 - x0), waveH);
  }

  for (let x = 0; x < w; x++) {
    const t0 = (x / w) * total;
    const t1 = ((x + 1) / w) * total;
    const s = sampleRangeSec(track, t0, t1);
    if (!s) continue;
    const [l, m, hh] = s;
    const bh = Math.max(1, ampOf(l, m, hh) * waveH);
    const played = t1 <= posSec;
    ctx.fillStyle = rgb(l, m, hh, played ? 0.42 : 1);
    ctx.fillRect(x, waveH - bh, 1, bh);
  }

  // Bar ticks every 16 bars (64 beats)
  const phraseSec = (60 / Math.max(40, track.bpm)) * 64;
  ctx.fillStyle = '#9a9a9a';
  for (let t = track.firstBeat + phraseSec; t < total; t += phraseSec) {
    const x = Math.round((t / total) * w);
    ctx.fillRect(x, waveH + 2, 1, tickH - 1);
  }

  const tri = (sec: number, color: string) => {
    const x = (sec / total) * w;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - 3.5, h);
    ctx.lineTo(x + 3.5, h);
    ctx.lineTo(x, h - tickH);
    ctx.fill();
  };
  track.cues.forEach((c) => c > 0.05 && tri(c, '#ff2d2d'));
  hotCues?.forEach((c) => c !== null && tri(c, '#00f0b5'));
  tri(cueSec, '#f39321');

  // Playhead
  const px = (Math.max(0, Math.min(total, posSec)) / total) * w;
  ctx.fillStyle = '#ff2d2d';
  ctx.fillRect(px - 1, 0, 2, waveH + 1);
}
