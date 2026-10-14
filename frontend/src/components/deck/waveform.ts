// Rekordbox-style waveform engine.
// - Generates 3-band (low / mid / high) analysis data that mirrors the
//   structure of the synthesized techno tracks (intro → build → break → drop → outro).
// - Renders RGB waveforms like rekordbox: low = red, mid = green, high = blue,
//   mirrored around the centre axis, with beat grid, downbeats, memory cues,
//   phase meter and playhead.

export type Section = 'intro' | 'build' | 'break' | 'drop' | 'outro';
export type TrackStyle = 'acid' | 'hypno';

export interface TrackWave {
  low: Float32Array;
  mid: Float32Array;
  high: Float32Array;
  /** analysis points per beat */
  ppb: number;
  totalBeats: number;
  /** section for every bar */
  sections: Section[];
  /** memory cues (in beats) at section boundaries */
  cues: number[];
}

function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PLANS: Record<TrackStyle, [Section, number][]> = {
  acid: [['intro', 16], ['build', 16], ['break', 8], ['drop', 32], ['outro', 999]],
  hypno: [['intro', 8], ['build', 16], ['break', 8], ['drop', 24], ['outro', 999]],
};

export function generateTrack(style: TrackStyle, totalBeats: number, seed: number): TrackWave {
  const ppb = 24;
  const n = Math.ceil(totalBeats * ppb);
  const totalBars = Math.ceil(totalBeats / 4);
  const low = new Float32Array(n);
  const mid = new Float32Array(n);
  const high = new Float32Array(n);
  const rnd = mulberry32(seed);

  // Section plan (bar-aligned, phrase based)
  const sections: Section[] = [];
  const secPos: number[] = [];
  const secLen: number[] = [];
  const cues: number[] = [];
  for (const [section, len] of PLANS[style]) {
    if (sections.length >= totalBars) break;
    const start = sections.length;
    cues.push(start * 4);
    const realLen = Math.min(len, totalBars - start);
    for (let k = 0; k < realLen; k++) {
      sections.push(section);
      secPos.push(k);
      secLen.push(realLen);
    }
  }

  const accents = Array.from({ length: Math.ceil(totalBeats * 4) + 1 }, () => rnd());

  for (let i = 0; i < n; i++) {
    const beat = i / ppb;
    const ph = beat % 1;
    const bar = Math.min(totalBars - 1, Math.floor(beat / 4));
    const beatInBar = Math.floor(beat) % 4;
    const s16 = Math.floor(beat * 4);
    const ph16 = (beat * 4) % 1;
    const s16bar = s16 % 16;
    const sec = sections[bar];
    const progress = (secPos[bar] + (beat % 4) / 4) / secLen[bar];

    let fullness = 1;
    if (sec === 'intro') fullness = 0.5 + 0.2 * progress;
    else if (sec === 'build') fullness = 0.75 + 0.2 * progress;
    else if (sec === 'outro') fullness = 0.85 - 0.45 * progress;

    let l = 0;
    let m = 0;
    let h = 0;

    // Kick (absent in breakdown)
    if (sec !== 'break') {
      l += 0.95 * Math.exp(-ph * 9);
      m += 0.22 * Math.exp(-ph * 28);
    }

    if (style === 'acid') {
      // Sub rumble + TB-303 on 16ths
      if (sec !== 'break' && s16 % 2 === 1) l += 0.28 * Math.exp(-ph16 * 6) * fullness;
      if (sec !== 'intro' && (s16 % 2 === 1 || s16bar === 2 || s16bar === 10 || s16bar === 14)) {
        const e = Math.exp(-ph16 * 4.5);
        const sweep = 0.55 + 0.45 * Math.sin(beat * 0.31);
        m += 0.42 * e * sweep * fullness;
        l += 0.12 * e;
      }
      // Ride on offbeat
      h += 0.5 * Math.exp(-Math.abs(ph - 0.5) * 12) * fullness;
      // Clap on 2 & 4
      if (sec !== 'break' && beatInBar % 2 === 1) {
        m += 0.32 * Math.exp(-ph * 14);
        h += 0.3 * Math.exp(-ph * 10);
      }
    } else {
      // Hypnotic modular sequence on every 16th
      const e = Math.exp(-ph16 * 7);
      m += (0.22 + 0.25 * accents[s16]) * e * fullness;
      h += 0.16 * e * fullness;
      // Open hats
      h += 0.48 * Math.exp(-Math.abs(ph - 0.5) * 15) * fullness;
      // Rave chord stabs
      if (sec !== 'intro' && (s16bar === 0 || s16bar === 6 || s16bar === 10)) {
        const ce = Math.exp(-ph16 * 1.4);
        m += 0.4 * ce;
        l += 0.08 * ce;
      }
      // Metallic percussion
      h += 0.08 * accents[s16] * e;
    }

    // Breakdown: rising pads + noise sweep
    if (sec === 'break') {
      m += 0.18 + 0.32 * progress;
      h += 0.12 + 0.45 * progress * (0.6 + 0.4 * rnd());
      l += 0.05;
    }

    // Noise floor / texture
    l += 0.04 * rnd();
    m += 0.05 * rnd();
    h += 0.07 * rnd();

    low[i] = Math.min(1, l);
    mid[i] = Math.min(1, m);
    high[i] = Math.min(1, h);
  }

  return { low, mid, high, ppb, totalBeats, sections, cues };
}

export function sectionAt(track: TrackWave, beat: number): Section {
  const bar = Math.max(0, Math.min(track.sections.length - 1, Math.floor(beat / 4)));
  return track.sections[bar];
}

export function isKickAt(track: TrackWave, beat: number): boolean {
  return sectionAt(track, beat) !== 'break';
}

// ---------------------------------------------------------------- rendering

function ampOf(l: number, m: number, h: number) {
  const v = 0.72 * Math.max(l, m, h * 0.8) + 0.18 * (l + m + h);
  return v > 1 ? 1 : v;
}

/** Instantaneous level at the playhead (0..1), used by channel meters. */
export function levelAt(track: TrackWave, beat: number): number {
  const i = Math.floor(beat * track.ppb);
  if (i < 0 || i >= track.low.length) return 0;
  return ampOf(track.low[i], track.mid[i], track.high[i]);
}

/** rekordbox RGB colouring: low → red, mid → green, high → blue. */
function rgb(l: number, m: number, h: number, dim: number): string {
  const mx = Math.max(l, m, h, 0.001);
  let r = l / mx;
  let g = (m / mx) * 0.82;
  let b = h / mx;
  // slight desaturation towards white for dense, full-band moments
  const density = Math.min(1, (l + m + h) / 2.2);
  r = r + (1 - r) * density * 0.35;
  g = g + (1 - g) * density * 0.3;
  b = b + (1 - b) * density * 0.25;
  return `rgb(${(r * 255 * dim) | 0},${(g * 255 * dim) | 0},${(b * 255 * dim) | 0})`;
}

function prepareCanvas(c: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // offsetWidth/Height ignore CSS transforms (the console may be rotated 90°)
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

function sampleRange(track: TrackWave, b0: number, b1: number): [number, number, number] | null {
  const n = track.low.length;
  let i0 = Math.floor(b0 * track.ppb);
  let i1 = Math.ceil(b1 * track.ppb);
  if (i1 <= 0 || i0 >= n) return null;
  i0 = Math.max(0, i0);
  i1 = Math.min(n, Math.max(i0 + 1, i1));
  let l = 0;
  let m = 0;
  let h = 0;
  for (let i = i0; i < i1; i++) {
    if (track.low[i] > l) l = track.low[i];
    if (track.mid[i] > m) m = track.mid[i];
    if (track.high[i] > h) h = track.high[i];
  }
  return [l, m, h];
}

export interface VerticalOptions {
  /** which side the cue triangle sits on */
  markerSide: 'left' | 'right';
  /** colour of the active phase-meter segment */
  phaseColor: string;
  beatsVisible?: number;
}

/** Zoomed, vertically scrolling waveform (rekordbox mobile centre view). */
export function drawVertical(
  canvas: HTMLCanvasElement,
  track: TrackWave,
  pos: number,
  cue: number,
  opts: VerticalOptions,
) {
  const { ctx, w, h } = prepareCanvas(canvas);
  if (!ctx || w < 2 || h < 2) return;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  // Phase meter (4 beats of the bar)
  const meterH = 4;
  const seg = (w - 3) / 4;
  const curBeat = Math.floor(Math.max(0, pos)) % 4;
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i === curBeat ? opts.phaseColor : '#262626';
    ctx.fillRect(i * (seg + 1), 0, seg, meterH);
  }

  const top = meterH + 3;
  const areaH = h - top;
  const playY = top + Math.round(areaH * 0.2);
  const ppx = areaH / (opts.beatsVisible ?? 8);
  const cx = w / 2;
  const maxHalf = w / 2 - 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, w, areaH);
  ctx.clip();

  for (let y = top; y < h; y++) {
    const b0 = pos + (y - playY) / ppx;
    const s = sampleRange(track, b0, b0 + 1 / ppx);
    if (!s || b0 >= track.totalBeats) continue;
    const [l, m, hh] = s;
    const half = Math.max(0.5, ampOf(l, m, hh) * maxHalf);
    const dim = y < playY ? 0.5 : 1;
    ctx.fillStyle = rgb(l, m, hh, dim);
    ctx.fillRect(cx - half, y, half * 2, 1);
    const core = Math.min(half, (hh * 0.45 + m * 0.35) * maxHalf * 0.55);
    if (core > 0.6) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 * dim})`;
      ctx.fillRect(cx - core, y, core * 2, 1);
    }
  }

  // Beat grid
  const firstBeat = Math.ceil(pos - (playY - top) / ppx);
  const lastBeat = Math.floor(pos + (h - playY) / ppx);
  for (let b = firstBeat; b <= lastBeat; b++) {
    if (b < 0 || b > track.totalBeats) continue;
    const y = Math.round(playY + (b - pos) * ppx);
    const down = b % 4 === 0;
    const tick = down ? 8 : 4;
    ctx.fillStyle = down ? 'rgba(255,48,48,0.95)' : 'rgba(255,255,255,0.5)';
    ctx.fillRect(0, y, tick, 1);
    ctx.fillRect(w - tick, y, tick, 1);
    if (down) {
      ctx.fillStyle = 'rgba(255,48,48,0.22)';
      ctx.fillRect(tick, y, w - tick * 2, 1);
    }
  }

  // Memory cues (red) + main cue (orange)
  const marker = (beat: number, color: string) => {
    const y = playY + (beat - pos) * ppx;
    if (y < top - 6 || y > h + 6) return;
    ctx.fillStyle = color;
    ctx.fillRect(0, y - 0.5, w, 1);
    ctx.beginPath();
    ctx.moveTo(w, y - 4);
    ctx.lineTo(w - 6, y);
    ctx.lineTo(w, y + 4);
    ctx.fill();
  };
  track.cues.forEach((c) => c > 0 && marker(c, 'rgba(255,40,40,0.9)'));
  marker(cue, '#f39321');

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
export function drawOverview(canvas: HTMLCanvasElement, track: TrackWave, pos: number, cue: number) {
  const { ctx, w, h } = prepareCanvas(canvas);
  if (!ctx || w < 2 || h < 2) return;

  ctx.fillStyle = '#121212';
  ctx.fillRect(0, 0, w, h);

  const tickH = 5;
  const waveH = h - tickH - 1;
  const total = track.totalBeats;

  for (let x = 0; x < w; x++) {
    const b0 = (x / w) * total;
    const b1 = ((x + 1) / w) * total;
    const s = sampleRange(track, b0, b1);
    if (!s) continue;
    const [l, m, hh] = s;
    const bh = Math.max(1, ampOf(l, m, hh) * waveH);
    const played = b1 <= pos;
    ctx.fillStyle = rgb(l, m, hh, played ? 0.42 : 1);
    ctx.fillRect(x, waveH - bh, 1, bh);
  }

  // Bar ticks every 16 bars
  ctx.fillStyle = '#9a9a9a';
  for (let b = 64; b < total; b += 64) {
    const x = Math.round((b / total) * w);
    ctx.fillRect(x, waveH + 2, 1, tickH - 1);
  }

  // Memory cues (red triangles) and main cue (orange)
  const tri = (beat: number, color: string) => {
    const x = (beat / total) * w;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - 3.5, h);
    ctx.lineTo(x + 3.5, h);
    ctx.lineTo(x, h - tickH);
    ctx.fill();
  };
  track.cues.forEach((c) => c > 0 && tri(c, '#ff2d2d'));
  tri(cue, '#f39321');

  // Playhead
  const px = (Math.max(0, Math.min(total, pos)) / total) * w;
  ctx.fillStyle = '#ff2d2d';
  ctx.fillRect(px - 1, 0, 2, waveH + 1);
}
