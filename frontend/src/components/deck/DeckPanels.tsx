import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  DeckId,
  DeckState,
  djEngine,
  HOT_CUE_COUNT,
  PLATTER_DEG_PER_SEC,
  TEMPO_RANGES,
} from '../../audio/dj/DjEngine';
import { FX_BEATS, FX_LIST, FxType } from '../../audio/dj/fx';
import { DEMOS, DemoId } from '../../audio/dj/demoTracks';
import { AUDIO_ACCEPT, deleteTrack, listTracks, StoredTrack } from '../../audio/dj/library';
import { loadDemoToDeck, loadFileToDeck, loadStoredToDeck } from '../../audio/dj/trackLoader';

const ORANGE = '#f39321';
const CORAL = '#f5926e';
const MINT = '#00f0b5';
const SYNC_BLUE = '#1a73e8';
const GROOVES = Array.from({ length: 15 }, (_, i) => 16.5 + i * 1.3);

export const DeckOrientationContext = createContext<{ portrait: boolean; flip180: boolean }>({
  portrait: false,
  flip180: false,
});

interface TouchSliderProps {
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  centerSnap?: number;
  accentColor: string;
  ariaLabel: string;
  haptic: HapticHelper;
  onChange: (value: number) => void;
  className?: string;
}

const TouchSlider: React.FC<TouchSliderProps> = ({
  value,
  min,
  max,
  defaultValue,
  centerSnap = 0,
  accentColor,
  ariaLabel,
  haptic,
  onChange,
  className = 'w-full',
}) => {
  const { flip180 } = useContext(DeckOrientationContext);
  const trackRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const lastTapRef = useRef<{ at: number; x: number; y: number }>({ at: 0, x: 0, y: 0 });
  const span = Math.max(1e-6, max - min);
  const clamped = Math.max(min, Math.min(max, value));
  const pct = ((clamped - min) / span) * 100;
  const bipolar = min < 0 && max > 0;

  const updateFromClient = (clientX: number, clientY: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const raw =
      rect.height > rect.width
        ? flip180
          ? (rect.bottom - clientY) / Math.max(1, rect.height)
          : (clientY - rect.top) / Math.max(1, rect.height)
        : (clientX - rect.left) / Math.max(1, rect.width);
    const frac = Math.max(0, Math.min(1, raw));
    let next = min + frac * span;
    if (centerSnap > 0 && Math.abs(next) <= centerSnap) next = 0;
    else next = Math.round(next * 10) / 10;
    onChange(next);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== null) return;
    e.preventDefault();
    e.stopPropagation();

    const now = performance.now();
    const prev = lastTapRef.current;
    if (now - prev.at < 280 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 18) {
      lastTapRef.current = { at: 0, x: 0, y: 0 };
      haptic.light();
      onChange(defaultValue);
      return;
    }
    lastTapRef.current = { at: now, x: e.clientX, y: e.clientY };

    pointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    updateFromClient(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    updateFromClient(e.clientX, e.clientY);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignore */
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = span * 0.05;
    let next = clamped;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(min, clamped - step);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(max, clamped + step);
    else if (e.key === 'Home') next = defaultValue;
    else return;
    e.preventDefault();
    if (centerSnap > 0 && Math.abs(next) <= centerSnap) next = 0;
    onChange(Math.round(next * 10) / 10);
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(clamped)}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onKeyDown={handleKeyDown}
      className={`relative flex h-6 touch-none select-none items-center cursor-pointer focus:outline-none ${className}`}
      style={{ touchAction: 'none' }}
    >
      <div className="relative h-1.5 w-full rounded-full bg-[#2a2a2a]">
        {bipolar ? (
          <>
            <div className="absolute top-[-2px] bottom-[-2px] left-1/2 w-px -translate-x-1/2 bg-[#666]" />
            <div
              className="absolute top-0 bottom-0 rounded-full"
              style={{
                background: accentColor,
                left: pct >= 50 ? '50%' : `${pct}%`,
                width: `${Math.abs(pct - 50)}%`,
              }}
            />
          </>
        ) : (
          <div
            className="absolute top-0 bottom-0 left-0 rounded-full"
            style={{ background: accentColor, width: `${pct}%` }}
          />
        )}
      </div>
      <div
        className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border border-black/70 shadow"
        style={{
          left: `calc(${pct}% - 7px)`,
          background: accentColor,
        }}
      />
    </div>
  );
};

export interface HapticHelper {
  (kind?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection'): void;
  light: () => void;
  medium: () => void;
  heavy: () => void;
  success: () => void;
  selection: () => void;
  error: () => void;
}

function pulseVibrate(ms: number) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
    }
  } catch {
    /* ignore */
  }
}

// ============================================================================
// 1. TACTILE SCRATCH JOG WHEEL
// ============================================================================

interface ScratchJogProps {
  id: DeckId;
  markerRef: React.RefObject<SVGGElement>;
  ringRef: React.RefObject<SVGCircleElement>;
  speedTextRef?: React.RefObject<SVGTextElement>;
  highlight: boolean;
  scratching: boolean;
  fxActive: boolean;
  loopActive: boolean;
  haptic: HapticHelper;
  onRotationDelta: (dDeg: number) => void;
}

interface JogDragState {
  pointerId: number;
  mode: 'scratch' | 'bend';
  cx: number;
  cy: number;
  prevAng: number;
  accumDeg: number;
  prevTime: number;
  smoothRate: number;
  lastTickStep: number;
  lastHapticAt: number;
}

export const ScratchJogWheel: React.FC<ScratchJogProps> = ({
  id,
  markerRef,
  ringRef,
  speedTextRef,
  highlight,
  scratching,
  fxActive,
  loopActive,
  haptic,
  onRotationDelta,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<JogDragState | null>(null);

  useEffect(() => {
    return () => {
      if (dragRef.current) {
        djEngine.scratchEnd(id);
        dragRef.current = null;
      }
    };
  }, [id]);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    const now = performance.now();

    // Whole platter surface triggers real-time vinyl scratch on mobile touch
    const mode: 'scratch' | 'bend' = 'scratch';

    dragRef.current = {
      pointerId: e.pointerId,
      mode,
      cx,
      cy,
      prevAng: ang,
      accumDeg: 0,
      prevTime: now,
      smoothRate: 0,
      lastTickStep: 0,
      lastHapticAt: now,
    };

    if (mode === 'scratch') {
      djEngine.scratchStart(id);
      haptic.medium();
      pulseVibrate(10);
    } else {
      haptic.light();
      pulseVibrate(5);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const st = dragRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();

    const svg = svgRef.current;
    if (svg) {
      const rect = svg.getBoundingClientRect();
      st.cx = rect.left + rect.width / 2;
      st.cy = rect.top + rect.height / 2;
    }

    const dx = e.clientX - st.cx;
    const dy = e.clientY - st.cy;
    // Ignore dead-zone right at the spindle center to avoid atan2 jumps
    if (dx * dx + dy * dy < 16) return;

    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    let dDeg = ((ang - st.prevAng + 540) % 360) - 180;
    st.prevAng = ang;

    // Guard against huge 1-frame spikes
    if (Math.abs(dDeg) > 110) dDeg = Math.sign(dDeg) * 110;

    const now = performance.now();
    const dt = Math.max(0.004, Math.min(0.1, (now - st.prevTime) / 1000));
    st.prevTime = now;

    st.accumDeg += dDeg;
    const instRate = dDeg / dt / PLATTER_DEG_PER_SEC;
    const prevRate = st.smoothRate;
    st.smoothRate = st.smoothRate * 0.4 + instRate * 0.6;

    onRotationDelta(dDeg);

    if (st.mode === 'scratch') {
      const dDisp = dDeg / PLATTER_DEG_PER_SEC;
      djEngine.scratchMove(id, dDisp, st.smoothRate);

      // Direction reversal "chirp" haptic
      if (prevRate * st.smoothRate < 0 && Math.abs(st.smoothRate - prevRate) > 0.35 && now - st.lastHapticAt > 24) {
        st.lastHapticAt = now;
        haptic.medium();
        pulseVibrate(8);
      } else {
        // Tactile encoder ticks every 14 degrees of rotation
        const tickStep = Math.trunc(st.accumDeg / 14);
        if (tickStep !== st.lastTickStep && now - st.lastHapticAt > 28) {
          st.lastTickStep = tickStep;
          st.lastHapticAt = now;
          haptic.selection();
          pulseVibrate(4);
        }
      }
    } else {
      const bend = Math.max(-0.35, Math.min(0.35, st.smoothRate * 0.18));
      djEngine.setBend(id, bend);
      const tickStep = Math.trunc(st.accumDeg / 20);
      if (tickStep !== st.lastTickStep && now - st.lastHapticAt > 35) {
        st.lastTickStep = tickStep;
        st.lastHapticAt = now;
        haptic.selection();
      }
    }
  };

  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    const st = dragRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignore */
    }
    if (st.mode === 'scratch') {
      djEngine.scratchEnd(id);
      haptic.light();
    } else {
      djEngine.setBend(id, 0);
    }
  };

  const ringStroke = scratching ? MINT : loopActive ? ORANGE : fxActive ? SYNC_BLUE : '#c7c7c7';

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      className="aspect-square h-full max-h-full max-w-full touch-none select-none cursor-grab active:cursor-grabbing"
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      style={{
        touchAction: 'none',
        filter: scratching
          ? `drop-shadow(0 0 12px ${MINT}88)`
          : highlight
          ? `drop-shadow(0 0 10px ${ORANGE}88)`
          : undefined,
      }}
      aria-label={`Jog wheel deck ${id}`}
    >
      <defs>
        <linearGradient id={`sheen-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0.02" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* base */}
      <circle cx="50" cy="50" r="49.5" fill="#141414" />
      {/* remaining-time / status ring */}
      <circle cx="50" cy="50" r="45" fill="none" stroke="#3a3a3a" strokeWidth="7" />
      <circle
        ref={ringRef}
        cx="50"
        cy="50"
        r="45"
        fill="none"
        stroke={ringStroke}
        strokeWidth="7"
        pathLength={100}
        strokeDasharray="100 100"
        transform="rotate(-90 50 50)"
      />
      {/* inner dark band */}
      <circle cx="50" cy="50" r="41.4" fill="#2b2b2b" />
      {/* vinyl surface */}
      <circle cx="50" cy="50" r="36" fill="#0c0c0c" />
      {GROOVES.map((r) => (
        <circle key={r} cx="50" cy="50" r={r} fill="none" stroke={scratching ? '#253833' : '#1c1c1c'} strokeWidth="0.35" />
      ))}
      <circle cx="50" cy="50" r="36" fill={`url(#sheen-${id})`} />
      {/* centre label */}
      <circle cx="50" cy="50" r="14.5" fill={scratching ? '#112a24' : '#2d2d2d'} />
      <circle
        cx="50"
        cy="50"
        r="13.5"
        fill="none"
        stroke={scratching ? MINT : id === 'A' ? CORAL : SYNC_BLUE}
        strokeWidth="0.9"
        strokeOpacity="0.85"
      />
      <text
        x="50"
        y="47.5"
        textAnchor="middle"
        fill="#a8a8a8"
        fontSize="4.2"
        fontWeight="700"
        letterSpacing="0.4"
      >
        {scratching ? 'SCRATCH' : `DECK ${id}`}
      </text>
      <text
        ref={speedTextRef}
        x="50"
        y="54.2"
        textAnchor="middle"
        fill={scratching ? MINT : '#ffffff'}
        fontSize="4.6"
        fontWeight="700"
      >
        0.00x
      </text>
      {/* rotating position marker */}
      <g ref={markerRef}>
        <rect
          x="46.4"
          y="1.4"
          width="7.2"
          height="8.8"
          rx="0.8"
          fill={scratching ? MINT : ORANGE}
          stroke="#000"
          strokeWidth="0.5"
        />
        <line x1="50" y1="14" x2="50" y2="35.5" stroke={scratching ? MINT : ORANGE} strokeWidth="1.3" strokeOpacity="0.7" />
      </g>
    </svg>
  );
};

// ============================================================================
// 2. BEAT FX + FILTER PANEL (per deck)
// ============================================================================

interface DeckFxPanelProps {
  deck: DeckState;
  haptic: HapticHelper;
  onClosePanel: () => void;
}

export const DeckFxPanel: React.FC<DeckFxPanelProps> = ({ deck, haptic, onClosePanel }) => {
  const { id, fx, filter } = deck;

  const selectType = (t: FxType) => {
    haptic.selection();
    djEngine.setFx(id, { type: t, on: true });
  };

  const selectBeat = (b: number) => {
    haptic.selection();
    djEngine.setFx(id, { beats: b });
  };

  const toggleOn = () => {
    haptic.medium();
    pulseVibrate(8);
    djEngine.setFx(id, { on: !fx.on });
  };

  const beatLabel = (b: number) => (b === 0.25 ? '1/4' : b === 0.5 ? '1/2' : b === 0.75 ? '3/4' : String(b));

  return (
    <div className="flex h-full w-full flex-col justify-between rounded-[6px] border border-[#363636] bg-[#121212] p-2 text-white">
      {/* Header row */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold tracking-wider text-[#9a9a9a]">BEAT FX · ДЕКА {id}</span>
          <button
            onClick={toggleOn}
            className="rounded-[3px] px-2 py-0.5 text-[10px] font-extrabold tracking-wider transition-all active:scale-95"
            style={{
              background: fx.on ? ORANGE : '#2e2e2e',
              color: fx.on ? '#000' : '#ccc',
              boxShadow: fx.on ? `0 0 10px ${ORANGE}88` : undefined,
            }}
          >
            {fx.on ? 'FX ON' : 'FX OFF'}
          </button>
        </div>
        <button
          onClick={() => {
            haptic.light();
            onClosePanel();
          }}
          className="rounded-[3px] border border-[#484848] bg-[#262626] px-2 py-0.5 text-[10px] font-semibold text-[#ddd] active:bg-[#383838]"
        >
          ДЖОГ
        </button>
      </div>

      {/* 4 FX Type buttons */}
      <div className="grid grid-cols-4 gap-1">
        {FX_LIST.map((item) => {
          const active = fx.type === item.id;
          return (
            <button
              key={item.id}
              onClick={() => selectType(item.id)}
              className="flex h-[26px] items-center justify-center rounded-[3px] text-[10px] font-bold tracking-wide active:scale-95"
              style={{
                background: active ? (fx.on ? ORANGE : '#4a4a4a') : '#262626',
                color: active && fx.on ? '#000' : '#e6e6e6',
                border: active ? `1px solid ${ORANGE}` : '1px solid #333',
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Beat division buttons */}
      <div className="grid grid-cols-6 gap-1">
        {FX_BEATS.slice(0, 6).map((b) => {
          const active = Math.abs(fx.beats - b) < 0.01;
          return (
            <button
              key={b}
              onClick={() => selectBeat(b)}
              className="flex h-[22px] items-center justify-center rounded-[3px] text-[10px] font-semibold tabular-nums"
              style={{
                background: active ? SYNC_BLUE : '#242424',
                color: active ? '#fff' : '#bbb',
              }}
            >
              {beatLabel(b)}
            </button>
          );
        })}
      </div>

      {/* FX Level / Depth slider */}
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between text-[9px] text-[#aaa]">
          <span>DEPTH / LEVEL</span>
          <span className="tabular-nums font-bold text-white">{Math.round(fx.level * 100)}%</span>
        </div>
        <TouchSlider
          value={fx.level * 100}
          min={0}
          max={100}
          defaultValue={60}
          accentColor={ORANGE}
          ariaLabel={`FX depth deck ${id}`}
          haptic={haptic}
          onChange={(v) => djEngine.setFx(id, { level: v / 100 })}
        />
      </div>

      {/* Color Filter (LPF <-> HPF) */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between text-[9px] text-[#aaa]">
          <span>
            FILTER:{' '}
            <strong className="text-white">
              {filter < -0.04 ? `LPF ${Math.round(-filter * 100)}%` : filter > 0.04 ? `HPF ${Math.round(filter * 100)}%` : 'OFF'}
            </strong>
          </span>
          {Math.abs(filter) > 0.02 && (
            <button
              onClick={() => {
                haptic.light();
                djEngine.setFilter(id, 0);
              }}
              className="rounded bg-[#2e2e2e] px-1.5 text-[9px] text-[#00f0b5]"
            >
              СБРОС
            </button>
          )}
        </div>
        <TouchSlider
          value={filter * 100}
          min={-100}
          max={100}
          defaultValue={0}
          centerSnap={5}
          accentColor={MINT}
          ariaLabel={`Color filter deck ${id}`}
          haptic={haptic}
          onChange={(v) => djEngine.setFilter(id, Math.abs(v) < 5 ? 0 : v / 100)}
        />
      </div>
    </div>
  );
};

// ============================================================================
// 3. PERFORMANCE PADS PANEL (Hot Cues + Beat Loop)
// ============================================================================

interface DeckPadPanelProps {
  deck: DeckState;
  haptic: HapticHelper;
  onClosePanel: () => void;
}

const LOOP_SIZES = [0.5, 1, 2, 4];

export const DeckPadPanel: React.FC<DeckPadPanelProps> = ({ deck, haptic, onClosePanel }) => {
  const { id, hotCues, loop } = deck;

  return (
    <div className="flex h-full w-full flex-col justify-between rounded-[6px] border border-[#363636] bg-[#121212] p-2 text-white">
      <div className="flex items-center justify-between gap-1">
        <span className="truncate whitespace-nowrap text-[9.5px] font-bold tracking-wider text-[#9a9a9a]">CUE / LOOP · {id}</span>
        <div className="flex shrink-0 items-center gap-1">
          {loop && (
            <button
              onClick={() => {
                haptic.medium();
                djEngine.exitLoop(id);
              }}
              className="whitespace-nowrap shrink-0 rounded-[3px] bg-[#f39321] px-2 py-0.5 text-[9px] font-bold text-black"
            >
              EXIT LOOP
            </button>
          )}
          <button
            onClick={() => {
              haptic.light();
              onClosePanel();
            }}
            className="whitespace-nowrap shrink-0 rounded-[3px] border border-[#484848] bg-[#262626] px-2 py-0.5 text-[10px] font-semibold text-[#ddd]"
          >
            ДЖОГ
          </button>
        </div>
      </div>

      {/* Row 1: 4 Hot Cues */}
      <div className="grid grid-cols-4 gap-1.5 flex-1 my-1">
        {[0, 1, 2, 3].slice(0, HOT_CUE_COUNT).map((idx) => {
          const val = hotCues[idx];
          const has = val !== null && val !== undefined;
          return (
            <div key={idx} className="relative flex">
              <button
                onClick={() => {
                  haptic.medium();
                  pulseVibrate(6);
                  djEngine.hotCue(id, idx);
                }}
                className="flex w-full flex-col items-center justify-center rounded-[4px] border text-[10px] font-bold transition-transform active:scale-95"
                style={{
                  background: has ? 'rgba(0, 240, 181, 0.16)' : '#222',
                  borderColor: has ? MINT : '#3a3a3a',
                  color: has ? MINT : '#999',
                }}
              >
                <span>CUE {String.fromCharCode(65 + idx)}</span>
                <span className="text-[8px] font-normal tabular-nums opacity-80">
                  {has ? `${Math.floor(val / 60)}:${String(Math.floor(val % 60)).padStart(2, '0')}` : 'ПУСТО'}
                </span>
              </button>
              {has && (
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    haptic.light();
                    djEngine.deleteHotCue(id, idx);
                  }}
                  title="Удалить метку"
                  className="absolute -top-1.5 -right-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-[#555] bg-black/90 text-[9px] font-bold text-[#bbb] transition-transform active:scale-90 active:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Row 2: 4 Beat Loops */}
      <div className="grid grid-cols-4 gap-1.5 flex-1">
        {LOOP_SIZES.map((beats) => {
          const active = loop !== null && Math.abs(loop.beats - beats) < 0.01;
          return (
            <button
              key={beats}
              onClick={() => {
                haptic.medium();
                pulseVibrate(6);
                djEngine.toggleBeatLoop(id, beats);
              }}
              className="flex flex-col items-center justify-center rounded-[4px] border text-[10px] font-bold transition-transform active:scale-95"
              style={{
                background: active ? ORANGE : '#222',
                borderColor: active ? ORANGE : '#3a3a3a',
                color: active ? '#000' : '#ddd',
              }}
            >
              <span>LOOP</span>
              <span className="text-[11px] font-extrabold tabular-nums">{beats === 0.5 ? '1/2' : beats} B</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// 4. TEMPO / PITCH PANEL
// ============================================================================

interface DeckTempoPanelProps {
  deck: DeckState;
  haptic: HapticHelper;
  onClosePanel: () => void;
}

export const DeckTempoPanel: React.FC<DeckTempoPanelProps> = ({ deck, haptic, onClosePanel }) => {
  const { id, tempo, tempoRange, track } = deck;
  const effBpm = track ? track.bpm * (1 + tempo) : 128;
  const pct = (tempo * 100).toFixed(1);

  return (
    <div className="flex h-full w-full flex-col justify-between rounded-[6px] border border-[#363636] bg-[#121212] p-2 text-white">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-wider text-[#9a9a9a]">TEMPO · ДЕКА {id}</span>
        <button
          onClick={() => {
            haptic.light();
            onClosePanel();
          }}
          className="rounded-[3px] border border-[#484848] bg-[#262626] px-2 py-0.5 text-[10px] font-semibold text-[#ddd]"
        >
          ДЖОГ
        </button>
      </div>

      <div className="flex items-baseline justify-between px-1">
        <span className="text-[18px] font-bold tabular-nums text-white">{effBpm.toFixed(1)} BPM</span>
        <span className="text-[12px] font-semibold tabular-nums text-[#00f0b5]">
          {tempo >= 0 ? `+${pct}%` : `${pct}%`}
        </span>
      </div>

      <TouchSlider
        value={(tempo / tempoRange) * 100}
        min={-100}
        max={100}
        defaultValue={0}
        centerSnap={2}
        accentColor={MINT}
        ariaLabel={`Tempo deck ${id}`}
        haptic={haptic}
        onChange={(norm) => {
          djEngine.setTempo(id, Math.abs(norm) < 2 ? 0 : (norm / 100) * tempoRange);
        }}
      />

      <div className="flex items-center justify-between gap-1">
        <div className="flex gap-1">
          {TEMPO_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => {
                haptic.selection();
                djEngine.setTempoRange(id, r);
              }}
              className="rounded-[3px] px-1.5 py-0.5 text-[9px] font-bold"
              style={{
                background: Math.abs(tempoRange - r) < 0.001 ? SYNC_BLUE : '#262626',
                color: '#fff',
              }}
            >
              ±{Math.round(r * 100)}%
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            haptic.light();
            djEngine.setTempo(id, 0);
          }}
          className="rounded-[3px] bg-[#2e2e2e] px-2 py-0.5 text-[9px] font-bold text-[#00f0b5]"
        >
          0.0%
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 5. 3-BAND EQ + COLOR FILTER MIXER OVERLAY
// ============================================================================

interface MixerOverlayProps {
  deckA: DeckState;
  deckB: DeckState;
  haptic: HapticHelper;
  onClose: () => void;
}

export const MixerOverlay: React.FC<MixerOverlayProps> = ({ deckA, deckB, haptic, onClose }) => {
  const renderDeckEq = (deck: DeckState) => {
    const { id, eq, filter, fader } = deck;
    const bands: { key: 'hi' | 'mid' | 'low'; label: string }[] = [
      { key: 'hi', label: 'HI' },
      { key: 'mid', label: 'MID' },
      { key: 'low', label: 'LOW' },
    ];
    return (
      <div className="flex flex-1 flex-col justify-between rounded-[6px] border border-[#333] bg-[#161616] p-2">
        <div className="flex items-center justify-between border-b border-[#2a2a2a] pb-1">
          <span className="text-[10px] font-extrabold tracking-wider" style={{ color: id === 'A' ? CORAL : SYNC_BLUE }}>
            КАНАЛ {id} · EQ & FILTER
          </span>
          <button
            onClick={() => {
              haptic.light();
              djEngine.setEq(id, 'hi', 0);
              djEngine.setEq(id, 'mid', 0);
              djEngine.setEq(id, 'low', 0);
              djEngine.setFilter(id, 0);
              djEngine.setFader(id, 1);
            }}
            className="rounded bg-[#282828] px-1.5 py-0.5 text-[9px] font-semibold text-[#bbb] active:text-white"
          >
            СБРОС
          </button>
        </div>

        {bands.map((b) => {
          const val = eq[b.key];
          return (
            <div key={b.key} className="flex items-center gap-2">
              <span className="w-7 text-[9px] font-bold text-[#aaa]">{b.label}</span>
              <TouchSlider
                value={val * 100}
                min={-100}
                max={100}
                defaultValue={0}
                centerSnap={5}
                accentColor={ORANGE}
                ariaLabel={`EQ ${b.label} deck ${id}`}
                haptic={haptic}
                className="min-w-0 flex-1"
                onChange={(v) => djEngine.setEq(id, b.key, Math.abs(v) < 5 ? 0 : v / 100)}
              />
              <span className="w-9 text-right text-[9px] tabular-nums text-[#ccc]">
                {val <= -0.96 ? 'KILL' : `${val >= 0 ? '+' : ''}${Math.round(val * (val >= 0 ? 6 : 26))}dB`}
              </span>
            </div>
          );
        })}

        {/* Color Filter */}
        <div className="flex items-center gap-2">
          <span className="w-7 text-[9px] font-bold text-[#00f0b5]">FLTR</span>
          <TouchSlider
            value={filter * 100}
            min={-100}
            max={100}
            defaultValue={0}
            centerSnap={5}
            accentColor={MINT}
            ariaLabel={`Mixer filter deck ${id}`}
            haptic={haptic}
            className="min-w-0 flex-1"
            onChange={(v) => djEngine.setFilter(id, Math.abs(v) < 5 ? 0 : v / 100)}
          />
          <span className="w-9 text-right text-[9px] tabular-nums text-[#00f0b5]">
            {filter < -0.04 ? 'LPF' : filter > 0.04 ? 'HPF' : 'OFF'}
          </span>
        </div>

        {/* Channel Volume */}
        <div className="flex items-center gap-2">
          <span className="w-7 text-[9px] font-bold text-[#aaa]">VOL</span>
          <TouchSlider
            value={fader * 100}
            min={0}
            max={100}
            defaultValue={100}
            accentColor="#ffffff"
            ariaLabel={`Volume deck ${id}`}
            haptic={haptic}
            className="min-w-0 flex-1"
            onChange={(v) => djEngine.setFader(id, v / 100)}
          />
          <span className="w-9 text-right text-[9px] tabular-nums text-[#ccc]">{Math.round(fader * 100)}%</span>
        </div>
      </div>
    );
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-black/95 p-2.5 text-white">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-wider text-white">МИКШЕР · 3-ПОЛОСНЫЙ EQ & SOUND COLOR FILTER</span>
        <button
          onClick={() => {
            haptic.light();
            onClose();
          }}
          className="rounded-[4px] border border-[#555] bg-[#2a2a2a] px-2.5 py-0.5 text-[10px] font-bold text-white"
        >
          ЗАКРЫТЬ
        </button>
      </div>
      <div className="flex min-h-0 flex-1 gap-2">
        {renderDeckEq(deckA)}
        {renderDeckEq(deckB)}
      </div>
    </div>
  );
};

// ============================================================================
// 6. SMARTPHONE TRACK BROWSER & FILE LOADER MODAL
// ============================================================================

interface TrackBrowserProps {
  targetDeck: DeckId;
  haptic: HapticHelper;
  onSelectDeck: (d: DeckId) => void;
  onClose: () => void;
}

export const TrackBrowserOverlay: React.FC<TrackBrowserProps> = ({
  targetDeck,
  haptic,
  onSelectDeck,
  onClose,
}) => {
  const [userTracks, setUserTracks] = useState<StoredTrack[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = async () => {
    const list = await listTracks();
    setUserTracks(list);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setErr(null);
    setBusy(`Загрузка «${file.name}» в Деку ${targetDeck}…`);
    haptic.medium();
    try {
      await loadFileToDeck(targetDeck, file);
      haptic.success();
      await refresh();
      onClose();
    } catch (e) {
      haptic.error();
      setErr('Не удалось декодировать аудиофайл. Выбери MP3, WAV, M4A, AAC, FLAC или OGG.');
    } finally {
      setBusy(null);
    }
  };

  const handleLoadStored = async (t: StoredTrack, d: DeckId) => {
    setErr(null);
    setBusy(`Загрузка «${t.title}» в Деку ${d}…`);
    haptic.medium();
    try {
      await loadStoredToDeck(d, t);
      haptic.success();
      onClose();
    } catch {
      haptic.error();
      setErr('Ошибка чтения сохранённого трека.');
    } finally {
      setBusy(null);
    }
  };

  const handleLoadDemo = async (demoId: DemoId, d: DeckId) => {
    setErr(null);
    setBusy(`Загрузка «${DEMOS[demoId].title}» в Деку ${d}…`);
    haptic.medium();
    try {
      await loadDemoToDeck(d, demoId);
      haptic.success();
      onClose();
    } catch {
      haptic.error();
      setErr('Не удалось загрузить встроенный трек.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#0d0d0f]/95 p-3 text-white">
      <input
        ref={fileInputRef}
        type="file"
        accept={AUDIO_ACCEPT}
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Top header */}
      <div className="flex items-center justify-between border-b border-[#2c2c2c] pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-extrabold tracking-wide text-white">ВЫБОР ТРЕКА</span>
          <div className="flex rounded-[4px] bg-[#1e1e1e] p-0.5">
            {(['A', 'B'] as DeckId[]).map((d) => (
              <button
                key={d}
                onClick={() => {
                  haptic.selection();
                  onSelectDeck(d);
                }}
                className="rounded-[3px] px-2.5 py-0.5 text-[10px] font-bold transition-colors"
                style={{
                  background: targetDeck === d ? (d === 'A' ? CORAL : SYNC_BLUE) : 'transparent',
                  color: targetDeck === d ? '#000' : '#aaa',
                }}
              >
                В ДЕКУ {d}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            haptic.light();
            onClose();
          }}
          className="rounded-[4px] border border-[#555] bg-[#262626] px-2.5 py-1 text-[10px] font-bold text-white"
        >
          НАЗАД К ПУЛЬТУ
        </button>
      </div>

      {/* Primary CTA: Pick audio file from smartphone */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          onClick={() => {
            haptic.light();
            fileInputRef.current?.click();
          }}
          disabled={Boolean(busy)}
          className="flex flex-1 items-center justify-center gap-2 rounded-[5px] border border-[#00f0b5]/60 bg-[#00f0b5]/15 py-2 px-3 text-[11px] font-bold text-[#00f0b5] active:scale-[0.99]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 16V4m0 0-4 4m4-4 4 4M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>ВЫБРАТЬ АУДИОФАЙЛ С ТЕЛЕФОНА (MP3 / WAV / M4A / FLAC) → ДЕКА {targetDeck}</span>
        </button>
      </div>

      {busy && <div className="mt-1.5 text-center text-[11px] font-semibold text-[#f39321]">{busy}</div>}
      {err && <div className="mt-1.5 text-center text-[11px] font-semibold text-[#ff5252]">{err}</div>}

      {/* Track list */}
      <div className="mt-2 flex-1 overflow-y-auto pr-1 space-y-1.5">
        {/* User phone tracks */}
        {userTracks.length > 0 && (
          <div className="text-[9px] font-bold uppercase tracking-wider text-[#8c8c8c]">Мои аудиофайлы ({userTracks.length})</div>
        )}
        {userTracks.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-[4px] border border-[#2a2a2a] bg-[#161618] px-2.5 py-1.5"
          >
            <div className="min-w-0 flex-1 pr-2">
              <div className="truncate text-[11px] font-bold text-white">{t.title}</div>
              <div className="truncate text-[9px] text-[#8c8c8c]">
                {t.artist} {t.bpm ? `· ${t.bpm.toFixed(1)} BPM` : ''}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={Boolean(busy)}
                onClick={() => void handleLoadStored(t, 'A')}
                className="rounded bg-[#f5926e]/20 border border-[#f5926e]/60 px-2 py-0.5 text-[10px] font-bold text-[#f5926e] disabled:opacity-50"
              >
                ДЕКА A
              </button>
              <button
                disabled={Boolean(busy)}
                onClick={() => void handleLoadStored(t, 'B')}
                className="rounded bg-[#1a73e8]/25 border border-[#1a73e8]/70 px-2 py-0.5 text-[10px] font-bold text-[#6eb0ff] disabled:opacity-50"
              >
                ДЕКА B
              </button>
              <button
                disabled={Boolean(busy)}
                onClick={async () => {
                  haptic.light();
                  await deleteTrack(t.id);
                  await refresh();
                }}
                className="ml-1 rounded bg-[#2a2a2a] px-1.5 py-0.5 text-[10px] text-[#999] hover:text-white disabled:opacity-50"
                title="Удалить из списка"
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        {/* Built-in Rekordbox school tracks */}
        <div className="pt-1 text-[9px] font-bold uppercase tracking-wider text-[#8c8c8c]">Базовые треки Open Deck</div>
        {(Object.keys(DEMOS) as DemoId[]).map((demoId) => {
          const m = DEMOS[demoId];
          return (
            <div
              key={demoId}
              className="flex items-center justify-between rounded-[4px] border border-[#2a2a2a] bg-[#161618] px-2.5 py-1.5"
            >
              <div className="min-w-0 flex-1 pr-2">
                <div className="truncate text-[11px] font-bold text-white">{m.title}</div>
                <div className="truncate text-[9px] text-[#8c8c8c]">
                  {m.artist} · 128.0 BPM · Key {m.key}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  disabled={Boolean(busy)}
                  onClick={() => void handleLoadDemo(demoId, 'A')}
                  className="rounded bg-[#f5926e]/20 border border-[#f5926e]/60 px-2 py-0.5 text-[10px] font-bold text-[#f5926e] disabled:opacity-50"
                >
                  ДЕКА A
                </button>
                <button
                  disabled={Boolean(busy)}
                  onClick={() => void handleLoadDemo(demoId, 'B')}
                  className="rounded bg-[#1a73e8]/25 border border-[#1a73e8]/70 px-2 py-0.5 text-[10px] font-bold text-[#6eb0ff] disabled:opacity-50"
                >
                  ДЕКА B
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
