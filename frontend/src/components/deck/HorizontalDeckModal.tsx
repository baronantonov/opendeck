import { createPortal } from 'react-dom';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { audioEngine, DeckId } from '../../audio/AudioEngine';
import { useApp } from '../../state/store';
import { haptic as rawHaptic } from '../../lib/theme';
import { triggerCelebrationConfetti } from '../ConfettiEffect';
import type { Lesson } from '../../types';
import { drawOverview, drawVertical, generateTrack, isKickAt, levelAt, TrackWave } from './waveform';

interface HorizontalDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson?: Lesson | any;
}

const BPM = 128;
const ORANGE = '#f39321';
const GREEN = '#f5926e'; // Replaced with Coral as per user request
const SYNC_BLUE = '#1a73e8';

const TRACKS: Record<DeckId, { title: string; artist: string; key: string; beats: number; style: 'acid' | 'hypno'; seed: number }> = {
  A: { title: 'Berlin Vault', artist: 'Open Deck Records', key: '4A', beats: 368, style: 'acid', seed: 7 },
  B: { title: 'Dark Matter', artist: 'FREEDA', key: '4A', beats: 272, style: 'hypno', seed: 21 },
};

interface DeckRuntime {
  playing: boolean;
  pos: number; // beats
  cue: number; // beats
  angle: number; // jog platter angle
  level: number; // smoothed meter level
}

const fmtRemain = (beats: number) => {
  const secs = Math.max(0, (beats * 60) / BPM);
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `-${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// ------------------------------------------------------------------ icons

const RekordboxLogo = () => (
  <svg viewBox="0 0 24 24" className="h-[60%] w-[60%]" fill="none">
    <path d="M12 2.5 20.2 7.25v9.5L12 21.5l-8.2-4.75v-9.5L12 2.5Z" stroke="#e8e8e8" strokeWidth="2" strokeLinejoin="round" />
    <path d="M12 8.2 15.3 10.1v3.8L12 15.8l-3.3-1.9v-3.8L12 8.2Z" fill="#e8e8e8" />
    <path d="M12 2.5v5.7M20.2 16.75l-4.9-2.85M3.8 16.75l4.9-2.85" stroke="#e8e8e8" strokeWidth="2" />
  </svg>
);

const MixerIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="#d6d6d6">
    <rect x="5" y="3" width="2" height="18" rx="1" />
    <rect x="11" y="3" width="2" height="18" rx="1" />
    <rect x="17" y="3" width="2" height="18" rx="1" />
    <rect x="3" y="13" width="6" height="3" rx="0.6" />
    <rect x="9" y="7" width="6" height="3" rx="0.6" />
    <rect x="15" y="15" width="6" height="3" rx="0.6" />
  </svg>
);

const PadIcon = ({ className = 'h-[52%] w-[64%]' }: { className?: string }) => (
  <svg viewBox="0 0 28 14" className={className} fill="#d6d6d6">
    {[0, 1].map((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={c * 7 + 0.5} y={r * 7 + 0.5} width="6" height="6" rx="0.8" />))}
  </svg>
);

const VinylArt = () => (
  <svg viewBox="0 0 40 40" className="h-full w-full">
    <rect width="40" height="40" fill="#3a3a3a" />
    <circle cx="20" cy="20" r="14" fill="#262626" />
    <circle cx="20" cy="20" r="10.5" fill="none" stroke="#323232" strokeWidth="0.6" />
    <circle cx="20" cy="20" r="7.5" fill="none" stroke="#323232" strokeWidth="0.6" />
    <circle cx="20" cy="20" r="4.5" fill="#3a3a3a" />
    <circle cx="20" cy="20" r="1" fill="#1d1d1d" />
  </svg>
);

const PlayGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-[38%] w-[38%]" fill="currentColor">
    <path d="M7 4.5v15l12.5-7.5L7 4.5Z" />
  </svg>
);

// ------------------------------------------------------------------ jog wheel (rekordbox mobile style)

const GROOVES = Array.from({ length: 15 }, (_, i) => 16.5 + i * 1.3);

interface JogProps {
  id: string;
  markerRef: React.RefObject<any>;
  ringRef: React.RefObject<any>;
  highlight: boolean;
  onTouch: () => void;
}

const JogWheel: React.FC<JogProps> = ({ id, markerRef, ringRef, highlight, onTouch }) => (
  <svg
    viewBox="0 0 100 100"
    className="h-full w-full"
    preserveAspectRatio="xMidYMid meet"
    onPointerDown={onTouch}
    style={{ filter: highlight ? `drop-shadow(0 0 10px ${ORANGE}88)` : undefined }}
  >
    <defs>
      <linearGradient id={`sheen-${id}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset="0.45" stopColor="#fff" stopOpacity="0.07" />
        <stop offset="0.55" stopColor="#fff" stopOpacity="0.02" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
    </defs>
    {/* base */}
    <circle cx="50" cy="50" r="49.5" fill="#141414" />
    {/* remaining-time ring (depletes clockwise from 12 o'clock) */}
    <circle cx="50" cy="50" r="45" fill="none" stroke="#3a3a3a" strokeWidth="7" />
    <circle
      ref={ringRef}
      cx="50"
      cy="50"
      r="45"
      fill="none"
      stroke="#c7c7c7"
      strokeWidth="7"
      pathLength={100}
      strokeDasharray="100 100"
      transform="rotate(-90 50 50)"
    />
    {/* inner dark band */}
    <circle cx="50" cy="50" r="41.4" fill="#2b2b2b" />
    {/* vinyl */}
    <circle cx="50" cy="50" r="36" fill="#0c0c0c" />
    {GROOVES.map((r) => (
      <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="#1c1c1c" strokeWidth="0.35" />
    ))}
    <circle cx="50" cy="50" r="36" fill={`url(#sheen-${id})`} />
    {/* centre label */}
    <circle cx="50" cy="50" r="14" fill="#3b3b3b" />
    <circle cx="50" cy="50" r="13.2" fill="none" stroke="#2e2e2e" strokeWidth="0.6" />
    <circle cx="50" cy="50" r="1.7" fill="#171717" />
    {/* rotating position marker */}
    <g ref={markerRef}>
      <rect x="46.4" y="1.4" width="7.2" height="8.4" rx="0.6" fill={ORANGE} stroke="#000" strokeWidth="0.5" />
    </g>
  </svg>
);

// ------------------------------------------------------------------ small building blocks

const SideButton: React.FC<{ active?: boolean; activeColor?: string; onClick?: () => void; children: React.ReactNode }> = ({
  active,
  activeColor = SYNC_BLUE,
  onClick,
  children,
}) => (
  <button
    onClick={onClick}
    className="flex h-[16%] min-h-[26px] w-full items-center justify-center rounded-[3px] text-[11px] tracking-wide transition-colors active:brightness-125"
    style={{ background: active ? activeColor : '#383838', color: active ? '#fff' : '#d4d4d4' }}
  >
    {children}
  </button>
);

const BpmBox: React.FC<{ mirrored?: boolean; keyName: string }> = ({ mirrored, keyName }) => {
  const bpm = (
    <div className="flex min-w-[88px] items-center justify-center px-3">
      <span className="text-[22px] font-light leading-none tabular-nums text-white">
        128<span className="text-[13px]">.0</span>
      </span>
    </div>
  );
  const info = (
    <div className="flex flex-col items-center justify-center px-3 text-[11px] leading-[1.15] text-white">
      <span>0%</span>
      <span>{keyName}</span>
    </div>
  );
  return (
    <div className="flex h-[78%] max-h-[38px] items-stretch rounded-[3px] border border-[#3c3c3c] bg-[#0b0b0b]">
      {mirrored ? info : bpm}
      <div className="w-px bg-[#3c3c3c]" />
      {mirrored ? bpm : info}
    </div>
  );
};

// ================================================================== component

export const HorizontalDeckModal: React.FC<HorizontalDeckModalProps> = ({ isOpen, onClose, lesson }) => {
  const { completeLesson, course } = useApp();
  const haptic = useMemo(() => {
    const fn = (kind: any = 'light') => rawHaptic(kind);
    fn.light = () => rawHaptic('light');
    fn.medium = () => rawHaptic('medium');
    fn.heavy = () => rawHaptic('heavy');
    fn.success = () => rawHaptic('success');
    fn.selection = () => rawHaptic('selection');
    fn.error = () => rawHaptic('error');
    return fn;
  }, []);

  const tracks = useMemo<Record<DeckId, TrackWave>>(
    () => ({
      A: generateTrack(TRACKS.A.style, TRACKS.A.beats, TRACKS.A.seed),
      B: generateTrack(TRACKS.B.style, TRACKS.B.beats, TRACKS.B.seed),
    }),
    [],
  );

  const [playingA, setPlayingA] = useState(false);
  const [playingB, setPlayingB] = useState(false);
  const [sync, setSync] = useState<Record<DeckId, boolean>>({ A: true, B: true });
  const [fx, setFx] = useState<Record<DeckId, boolean>>({ A: false, B: false });
  const [slip, setSlip] = useState<Record<DeckId, boolean>>({ A: false, B: false });
  const [crossfader, setCrossfader] = useState(0);
  const [isMatched, setIsMatched] = useState(false);

  // runtime (mutated every frame, no re-render)
  const rt = useRef<Record<DeckId, DeckRuntime>>({
    A: { playing: false, pos: 0, cue: 0, angle: 0, level: 0 },
    B: { playing: false, pos: 0, cue: 0, angle: 0, level: 0 },
  });
  const xfRef = useRef(0);
  const syncRef = useRef(sync);
  syncRef.current = sync;
  const isLessonDone = (lesson as any)?.isCompleted ?? course.completedLessons.includes(1);
  const claimedRef = useRef(isLessonDone);
  const lastHapticXf = useRef(0);

  // DOM refs
  const ovA = useRef<HTMLCanvasElement>(null);
  const ovB = useRef<HTMLCanvasElement>(null);
  const vA = useRef<HTMLCanvasElement>(null);
  const vB = useRef<HTMLCanvasElement>(null);
  const jogA = useRef<SVGGElement>(null);
  const jogB = useRef<SVGGElement>(null);
  const ringA = useRef<SVGCircleElement>(null);
  const ringB = useRef<SVGCircleElement>(null);
  const timeA = useRef<HTMLSpanElement>(null);
  const timeB = useRef<HTMLSpanElement>(null);
  const barsA = useRef<HTMLSpanElement>(null);
  const barsB = useRef<HTMLSpanElement>(null);
  const meterA = useRef<HTMLDivElement>(null);
  const meterB = useRef<HTMLDivElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });
  const [portrait, setPortrait] = useState(false);
  const [flip180, setFlip180] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.BackButton) {
      tg.BackButton.show();
      const handler = () => onClose();
      tg.BackButton.onClick(handler);
      return () => {
        try {
          tg.BackButton.offClick(handler);
          tg.BackButton.hide();
        } catch {}
      };
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setFrameSize({ w: width, h: height });
      setPortrait(height > width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isOpen]);

  const setDeckPlaying = useCallback(
    (d: DeckId, next: boolean) => {
      const r = rt.current;
      const me = r[d];
      const other = r[d === 'A' ? 'B' : 'A'];
      if (next) {
        if (me.pos >= tracks[d].totalBeats - 0.05) me.pos = me.cue;
        if (other.playing && syncRef.current[d]) {
          // BEAT SYNC: lock phase to the playing deck
          me.pos = Math.floor(me.pos) + (other.pos % 1);
        } else if (!other.playing) {
          // sequencer restarts on a beat → snap to the grid
          me.pos = Math.round(me.pos);
        }
      }
      me.playing = next;
      audioEngine.setDeckActive(d, next);
      audioEngine.setKickMuted(d, !isKickAt(tracks[d], me.pos));
      if (r.A.playing || r.B.playing) {
        audioEngine.startPlayback();
        audioEngine.setCrossfader(xfRef.current);
      } else {
        audioEngine.stopPlayback();
      }
      (d === 'A' ? setPlayingA : setPlayingB)(next);
    },
    [tracks],
  );

  // open / close lifecycle
  useEffect(() => {
    if (!isOpen) return;
    audioEngine.setDeckActive('A', false);
    audioEngine.setDeckActive('B', false);
    claimedRef.current = isLessonDone;
    setIsMatched(false);
    const runtime = rt.current;
    return () => {
      audioEngine.stopPlayback();
      audioEngine.setDeckActive('A', true);
      audioEngine.setDeckActive('B', true);
      audioEngine.setKickMuted('A', false);
      audioEngine.setKickMuted('B', false);
      runtime.A.playing = false;
      runtime.B.playing = false;
      setPlayingA(false);
      setPlayingB(false);
    };
  }, [isOpen, isLessonDone]);

  // render loop
  useEffect(() => {
    if (!isOpen) return;
    let raf = 0;
    let last = performance.now();

    const decks: { d: DeckId; ov: typeof ovA; v: typeof vA; jog: typeof jogA; ring: typeof ringA; time: typeof timeA; bars: typeof barsA; meter: typeof meterA; side: 'left' | 'right'; phase: string }[] = [
      { d: 'A', ov: ovA, v: vA, jog: jogA, ring: ringA, time: timeA, bars: barsA, meter: meterA, side: 'left', phase: '#e8322b' },
      { d: 'B', ov: ovB, v: vB, jog: jogB, ring: ringB, time: timeB, bars: barsB, meter: meterB, side: 'right', phase: '#e6e6e6' },
    ];

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const xf = xfRef.current;

      for (const k of decks) {
        const deck = rt.current[k.d];
        const track = tracks[k.d];

        if (deck.playing) {
          deck.pos += (dt * BPM) / 60;
          deck.angle = (deck.angle + dt * 200) % 360; // 33⅓ rpm
          if (deck.pos >= track.totalBeats) {
            deck.pos = track.totalBeats;
            setDeckPlaying(k.d, false);
          }
          audioEngine.setKickMuted(k.d, !isKickAt(track, deck.pos));
        }

        if (k.ov.current) drawOverview(k.ov.current, track, deck.pos, deck.cue);
        if (k.v.current) drawVertical(k.v.current, track, deck.pos, deck.cue, { markerSide: k.side, phaseColor: k.phase });

        const progress = deck.pos / track.totalBeats;
        k.jog.current?.setAttribute('transform', `rotate(${deck.angle} 50 50)`);
        k.ring.current?.setAttribute('stroke-dasharray', `${(1 - progress) * 100} 100`);
        k.ring.current?.setAttribute('transform', `rotate(${-90 + progress * 360} 50 50)`);
        if (k.time.current) k.time.current.textContent = fmtRemain(track.totalBeats - deck.pos);

        if (k.bars.current) {
          const next = track.cues.find((c) => c > deck.pos + 0.01);
          if (next === undefined) k.bars.current.textContent = '--.- Bars';
          else {
            const left = next - deck.pos;
            k.bars.current.textContent = `${Math.floor(left / 4)}.${Math.floor(left % 4) + 1} Bars`;
          }
        }

        // channel level meter (post-crossfader)
        const gain = k.d === 'A' ? Math.cos(xf * 0.5 * Math.PI) : Math.cos((1 - xf) * 0.5 * Math.PI);
        const target = deck.playing ? levelAt(track, deck.pos) * gain : 0;
        deck.level = target > deck.level ? target : deck.level * 0.88 + target * 0.12;
        if (k.meter.current) k.meter.current.style.height = `${Math.min(100, deck.level * 100)}%`;
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isOpen, tracks, setDeckPlaying]);

  const togglePlay = (d: DeckId) => {
    haptic.medium();
    setDeckPlaying(d, !rt.current[d].playing);
  };

  // CDJ-style CUE: while playing → return to cue & pause; while paused → set cue here
  const handleCue = (d: DeckId) => {
    haptic.heavy();
    const me = rt.current[d];
    if (me.playing) {
      setDeckPlaying(d, false);
      me.pos = me.cue;
    } else {
      me.cue = Math.max(0, Math.round(me.pos));
      me.pos = me.cue;
    }
  };

  const handleSuccessfulBeatmatch = () => {
    claimedRef.current = true;
    setIsMatched(true);
    haptic.success();
    triggerCelebrationConfetti();
    completeLesson(1);
    window.setTimeout(() => {
      onClose();
    }, 2500);
  };

  const handleCrossfader = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    xfRef.current = v;
    setCrossfader(v);
    audioEngine.setCrossfader(v);
    if (Math.abs(v - lastHapticXf.current) > 0.06) {
      lastHapticXf.current = v;
      haptic.selection();
    }
    const r = rt.current;
    if (!claimedRef.current && r.A.playing && r.B.playing && v >= 0.45 && v <= 0.55) {
      handleSuccessfulBeatmatch();
    }
  };

  if (!isOpen) return null;

  const step = isMatched ? 'matched' : !playingA ? 'play_a' : !playingB ? 'play_b' : 'crossfade';
  const hint =
    step === 'play_a'
      ? { text: 'Шаг 1 · Нажми PLAY на левой деке', color: ORANGE }
      : step === 'play_b'
      ? { text: 'Шаг 2 · Нажми PLAY на правой деке', color: ORANGE }
      : step === 'crossfade'
      ? { text: 'Шаг 3 · Двигай кроссфейдер к центру — введи второй трек', color: '#8ce2c8' }
      : null;

  const frameStyle: React.CSSProperties = portrait
    ? {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: `${frameSize.h}px`,
        height: `${frameSize.w}px`,
        transform: `translate(-50%, -50%) rotate(${flip180 ? -90 : 90}deg)`,
      }
    : { position: 'absolute', inset: 0 };

  const playBtn = (d: DeckId, playing: boolean, coach: boolean) => (
    <button
      onClick={() => togglePlay(d)}
      className={`flex aspect-square h-[68%] min-h-[44px] min-w-[44px] max-h-[52px] items-center justify-center rounded-full border-[1.5px] transition-colors active:scale-95 ${coach ? 'animate-pulse' : ''}`}
      style={{
        borderColor: playing ? GREEN : coach ? GREEN : '#8a8a8a',
        color: playing ? GREEN : '#d6d6d6',
        boxShadow: coach ? `0 0 0 4px ${GREEN}44, 0 0 18px ${GREEN}88` : playing ? `0 0 10px ${GREEN}55` : undefined,
      }}
      aria-label={`Play deck ${d}`}
    >
      <PlayGlyph />
    </button>
  );

  const cueBtn = (d: DeckId, playing: boolean) => (
    <button
      onClick={() => handleCue(d)}
      className="flex aspect-square h-[68%] min-h-[44px] min-w-[44px] max-h-[52px] items-center justify-center rounded-full border-[1.5px] text-[12px] tracking-wide active:scale-95 active:brightness-150"
      style={{ borderColor: playing ? '#8a8a8a' : ORANGE + 'aa', color: ORANGE }}
    >
      CUE
    </button>
  );

  const sideButtons = (d: DeckId) => (
    <div className="flex h-full w-[46px] shrink-0 flex-col justify-around py-[2%]">
      <SideButton active={sync[d]} onClick={() => { haptic.light(); setSync((s) => ({ ...s, [d]: !s[d] })); }}>
        SYNC
      </SideButton>
      <SideButton onClick={() => haptic.light()}>
        <PadIcon />
      </SideButton>
      <SideButton active={fx[d]} activeColor="#5a5a5a" onClick={() => { haptic.light(); setFx((s) => ({ ...s, [d]: !s[d] })); }}>
        FX
      </SideButton>
      <SideButton active={slip[d]} activeColor="#5a5a5a" onClick={() => { haptic.light(); setSlip((s) => ({ ...s, [d]: !s[d] })); }}>
        SLIP
      </SideButton>
    </div>
  );

  const header = (d: DeckId) => (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex items-baseline justify-between leading-none">
        <span className="truncate text-[13px] text-white">{TRACKS[d].title}</span>
        <span ref={d === 'A' ? timeA : timeB} className="ml-2 text-[13px] tabular-nums text-white">
          -00:00
        </span>
      </div>
      <span className="mt-[2px] truncate text-[10px] leading-none text-[#8c8c8c]">{TRACKS[d].artist}</span>
      <canvas ref={d === 'A' ? ovA : ovB} className="mt-[4px] block min-h-0 w-full flex-1" />
    </div>
  );

  const modalContent = (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 touch-none select-none overflow-hidden bg-black"
      style={{ fontFamily: '"Helvetica Neue", Roboto, "Segoe UI", Arial, sans-serif' }}
    >
      <div style={frameStyle} className="flex flex-col overflow-hidden bg-black text-[#d6d6d6]">
        {/* ============ ROW 1 · track info + overview waveforms ============ */}
        <div className="flex shrink-0 items-stretch gap-2 px-2 pt-[0.8%]" style={{ height: '15%' }}>
          <div className="aspect-square h-full shrink-0 overflow-hidden rounded-[2px]">
            <VinylArt />
          </div>
          {header('A')}
          <div className="flex shrink-0 items-center justify-center gap-1.5">
            <button
              onClick={onClose}
              title="Выйти из пульта"
              className="flex h-[76%] min-h-[36px] items-center justify-center gap-1.5 rounded-[4px] border border-[#5a5a5a] bg-[#2c2c2c] px-2.5 text-[11px] font-bold text-white hover:bg-[#3a3a3a] active:scale-95 shadow-md"
            >
              <div className="h-4 w-4 flex items-center justify-center">
                <RekordboxLogo />
              </div>
              <span className="text-xs font-black text-[#f5926e]">✕</span>
              <span className="text-[10px] tracking-wider uppercase">ВЫХОД</span>
            </button>
            {portrait && (
              <button
                onClick={() => {
                  haptic.light();
                  setFlip180((f) => !f);
                }}
                title="Повернуть на 180°"
                className="flex h-[76%] min-h-[36px] px-1.5 items-center justify-center rounded-[4px] border border-[#4a4a4a] bg-[#2c2c2c] text-[10px] font-bold text-[#bbb] active:bg-[#3a3a3a]"
              >
                180°
              </button>
            )}
          </div>
          {header('B')}
          <div className="aspect-square h-full shrink-0 overflow-hidden rounded-[2px]">
            <VinylArt />
          </div>
        </div>

        {/* ============ ROW 2 · BPM / key / mixer ============ */}
        <div className="flex shrink-0 items-center justify-between px-2" style={{ height: '12%' }}>
          <BpmBox keyName={TRACKS.A.key} />
          <div className="flex h-full items-center gap-3">
            <button className="flex aspect-square h-[72%] items-center justify-center rounded-[3px] bg-[#383838]" onClick={() => haptic.light()}>
              <MixerIcon />
            </button>
            <div className="flex h-[72%] gap-[5px]">
              {[meterA, meterB].map((ref, i) => (
                <div key={i} className="relative h-full w-[5px] overflow-hidden rounded-[1px] bg-[#1e1e1e]">
                  <div
                    ref={ref}
                    className="absolute bottom-0 left-0 right-0"
                    style={{ height: '0%', background: 'linear-gradient(to top, #2fbf4a 0%, #2fbf4a 55%, #f2d01c 78%, #ff3b30 100%)', backgroundSize: '100% 100%' }}
                  />
                </div>
              ))}
            </div>
            <button className="flex aspect-square h-[72%] items-center justify-center rounded-[3px] bg-[#383838]" onClick={() => haptic.light()}>
              <PadIcon className="h-[40%] w-[64%]" />
            </button>
          </div>
          <BpmBox mirrored keyName={TRACKS.B.key} />
        </div>

        {/* ============ MAIN · side buttons, jogs, vertical waveforms ============ */}
        <div className="relative flex min-h-0 flex-1 items-center gap-1 px-2">
          {sideButtons('A')}
          <div className="flex h-full min-w-0 flex-1 items-center justify-center py-[1.2%]">
            <JogWheel id="A" markerRef={jogA} ringRef={ringA} highlight={step === 'play_a'} onTouch={() => haptic.light()} />
          </div>

          <div className="flex h-full shrink-0 gap-[6px] py-[0.8%]" style={{ width: '17%' }}>
            {(['A', 'B'] as DeckId[]).map((d) => (
              <div key={d} className="flex min-w-0 flex-1 flex-col">
                <canvas ref={d === 'A' ? vA : vB} className="block min-h-0 w-full flex-1" />
                <span ref={d === 'A' ? barsA : barsB} className="pt-[2px] text-center text-[9px] leading-none tabular-nums text-[#3d8bff]">
                  --.- Bars
                </span>
              </div>
            ))}
          </div>

          <div className="flex h-full min-w-0 flex-1 items-center justify-center py-[1.2%]">
            <JogWheel id="B" markerRef={jogB} ringRef={ringB} highlight={step === 'play_b'} onTouch={() => haptic.light()} />
          </div>
          {sideButtons('B')}

          {/* Coach-mark hint */}
          {hint && (
            <div className="pointer-events-none absolute bottom-[3%] left-1/2 z-20 -translate-x-1/2 whitespace-nowrap">
              <div
                className="animate-pulse rounded-full border bg-black/85 px-3.5 py-1 text-[11px] font-semibold"
                style={{ borderColor: hint.color, color: hint.color, boxShadow: `0 0 14px ${hint.color}55` }}
              >
                {hint.text}
              </div>
            </div>
          )}

          {/* Success flash */}
          {isMatched && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
              <div className="absolute inset-0 animate-pulse bg-[#8ce2c8]/10" />
              <div className="relative flex items-center gap-3 rounded-2xl border-2 border-[#8ce2c8] bg-black/85 px-5 py-3 shadow-[0_0_40px_rgba(140,226,200,0.55)]">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-[#8ce2c8]" />
                <div>
                  <div className="text-sm font-bold text-white">Твоё первое сведение — поздравляю! 🎉</div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs font-bold text-[#8ce2c8]">
                    <Sparkles className="h-3.5 w-3.5" /> +50 GP
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============ BOTTOM · transport + crossfader ============ */}
        <div className="flex shrink-0 items-center bg-[#1c1c1c] px-2 pb-[max(env(safe-area-inset-bottom,0px),4px)]" style={{ height: '17%' }}>
          <div className="flex h-full items-center justify-center gap-[18%]" style={{ width: '31%' }}>
            {playBtn('A', playingA, step === 'play_a')}
            {cueBtn('A', playingA)}
          </div>

          <div className="relative h-[72%] flex-1">
            {step === 'crossfade' && (
              <div
                className="pointer-events-none absolute -top-[46%] z-10 -translate-x-1/2 animate-bounce whitespace-nowrap rounded-full bg-[#8ce2c8] px-2 py-[1px] text-[9px] font-bold text-black"
                style={{ left: `calc(${crossfader} * (100% - 14px) + 7px)` }}
              >
                ← →
              </div>
            )}
            <div className="absolute bottom-[8%] left-0 top-[8%] w-[2px] bg-[#cfcfcf]" />
            <div className="absolute bottom-[8%] right-0 top-[8%] w-[2px] bg-[#cfcfcf]" />
            <div className="absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 bg-[#5c5c5c]" />
            <div className="absolute bottom-[30%] left-1/2 top-[30%] w-px -translate-x-1/2 bg-[#777]" />
            <div
              className="pointer-events-none absolute bottom-[4%] top-[4%] flex w-[14px] justify-between"
              style={{
                left: `calc(${crossfader} * (100% - 14px))`,
                filter: step === 'crossfade' ? 'drop-shadow(0 0 6px #8ce2c8)' : undefined,
              }}
            >
              <div className="h-full w-[5px] rounded-[1px] bg-[#dcdcdc]" />
              <div className="h-full w-[5px] rounded-[1px] bg-[#dcdcdc]" />
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.005}
              value={crossfader}
              onChange={handleCrossfader}
              aria-label="Crossfader"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>

          <div className="flex h-full items-center justify-center gap-[18%]" style={{ width: '31%' }}>
            {cueBtn('B', playingB)}
            {playBtn('B', playingB, step === 'play_b')}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};
