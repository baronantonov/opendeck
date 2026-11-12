import { createPortal } from 'react-dom';
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { DeckId, djEngine, PLATTER_DEG_PER_SEC } from '../../audio/dj/DjEngine';
import { AUDIO_ACCEPT } from '../../audio/dj/library';
import { loadDemoToDeck, loadFileToDeck } from '../../audio/dj/trackLoader';
import { useApp } from '../../state/store';
import { haptic as rawHaptic } from '../../lib/theme';
import { triggerCelebrationConfetti } from '../ConfettiEffect';
import type { Lesson } from '../../types';
import { drawOverview, drawVertical, levelAt } from './waveform';
import {
  DeckFxPanel,
  DeckPadPanel,
  DeckTempoPanel,
  HapticHelper,
  MixerOverlay,
  ScratchJogWheel,
  TrackBrowserOverlay,
} from './DeckPanels';
import { useRegisterModal } from '../../lib/navigation';
import { useSafeArea } from '../../lib/safeArea';
import { apiProgress } from '../../api/client';

interface HorizontalDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson?: Lesson | any;
}

type DeckViewMode = 'jog' | 'fx' | 'pad' | 'tempo';

const ORANGE = '#f39321';
const GREEN = '#f5926e';
const MINT = '#00f0b5';
const SYNC_BLUE = '#1a73e8';

const fmtRemain = (secsInput: number) => {
  const secs = Math.max(0, secsInput);
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
  <svg viewBox="0 0 28 14" className={className} fill="currentColor">
    {[0, 1].map((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={c * 7 + 0.5} y={r * 7 + 0.5} width="6" height="6" rx="0.8" />))}
  </svg>
);

const FolderMusicIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.1">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" strokeLinejoin="round" />
    <path d="M12 15.5V11l4-1v4.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="10.8" cy="15.5" r="1.3" fill="currentColor" />
    <circle cx="14.8" cy="14.5" r="1.3" fill="currentColor" />
  </svg>
);

const VinylArt: React.FC<{ artUrl?: string }> = ({ artUrl }) =>
  artUrl ? (
    <img src={artUrl} alt="" className="h-full w-full object-cover" />
  ) : (
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

// ------------------------------------------------------------------ small building blocks

const SideButton: React.FC<{ active?: boolean; activeColor?: string; onClick?: () => void; children: React.ReactNode }> = ({
  active,
  activeColor = SYNC_BLUE,
  onClick,
  children,
}) => (
  <button
    onClick={onClick}
    className="flex h-[16%] min-h-[26px] w-full items-center justify-center rounded-[3px] text-[11px] font-semibold tracking-wide transition-colors active:brightness-125"
    style={{ background: active ? activeColor : '#383838', color: active ? '#fff' : '#d4d4d4' }}
  >
    {children}
  </button>
);

const BpmBox: React.FC<{
  mirrored?: boolean;
  bpmValue: number;
  tempoPct: number;
  keyName: string;
  active?: boolean;
  onClick?: () => void;
}> = ({ mirrored, bpmValue, tempoPct, keyName, active, onClick }) => {
  const whole = Math.floor(bpmValue);
  const tenths = Math.floor(Math.round((bpmValue - whole) * 10)) % 10;
  const pctStr = `${tempoPct >= 0 ? '+' : ''}${(tempoPct * 100).toFixed(1)}%`;

  const bpm = (
    <div className="flex min-w-[78px] items-center justify-center px-2.5">
      <span className="text-[20px] font-light leading-none tabular-nums text-white">
        {whole}
        <span className="text-[12px]">.{tenths}</span>
      </span>
    </div>
  );
  const info = (
    <div className="flex flex-col items-center justify-center px-2 text-[10px] leading-[1.15] text-white tabular-nums">
      <span style={{ color: Math.abs(tempoPct) > 0.001 ? MINT : '#fff' }}>{pctStr}</span>
      <span className="text-[#aaa]">{keyName}</span>
    </div>
  );
  return (
    <button
      onClick={onClick}
      title="Настройка темпа (Pitch)"
      className="flex h-[78%] max-h-[38px] items-stretch rounded-[3px] border bg-[#0b0b0b] transition-colors active:brightness-125"
      style={{ borderColor: active ? MINT : '#3c3c3c' }}
    >
      {mirrored ? info : bpm}
      <div className="w-px bg-[#3c3c3c]" />
      {mirrored ? bpm : info}
    </button>
  );
};

// ================================================================== component

export const HorizontalDeckModal: React.FC<HorizontalDeckModalProps> = ({ isOpen, onClose, lesson }) => {
  const { completeLesson, course } = useApp();
  const haptic = useMemo<HapticHelper>(() => {
    const fn = ((kind: any = 'light') => rawHaptic(kind)) as HapticHelper;
    fn.light = () => rawHaptic('light');
    fn.medium = () => rawHaptic('medium');
    fn.heavy = () => rawHaptic('heavy');
    fn.success = () => rawHaptic('success');
    fn.selection = () => rawHaptic('selection');
    fn.error = () => rawHaptic('error');
    return fn;
  }, []);

  // Subscribe to DjEngine reactive store
  useSyncExternalStore(djEngine.subscribe, djEngine.getVersion);
  const deckA = djEngine.decks.A;
  const deckB = djEngine.decks.B;
  const playingA = deckA.playing;
  const playingB = deckB.playing;

  const [crossfader, setCrossfader] = useState(0);
  const [isMatched, setIsMatched] = useState(false);
  const [viewMode, setViewMode] = useState<Record<DeckId, DeckViewMode>>({ A: 'jog', B: 'jog' });
  const [mixerOpen, setMixerOpen] = useState(false);
  const [browserDeck, setBrowserDeck] = useState<DeckId | null>(null);

  const angleRef = useRef<Record<DeckId, number>>({ A: 0, B: 0 });
  const meterSmoothRef = useRef<Record<DeckId, number>>({ A: 0, B: 0 });
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const celebrationTimerRef = useRef<number | null>(null);
  const quickFileTargetRef = useRef<DeckId>('A');
  const quickFileInputRef = useRef<HTMLInputElement | null>(null);

  const xfRef = useRef(0);
  const isLessonDone = lesson ? Boolean((lesson as any).isCompleted) : false;
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
  const speedA = useRef<SVGTextElement>(null);
  const speedB = useRef<SVGTextElement>(null);
  const timeA = useRef<HTMLSpanElement>(null);
  const timeB = useRef<HTMLSpanElement>(null);
  const barsA = useRef<HTMLSpanElement>(null);
  const barsB = useRef<HTMLSpanElement>(null);
  const meterA = useRef<HTMLDivElement>(null);
  const meterB = useRef<HTMLDivElement>(null);

  const safeArea = useSafeArea();
  const containerRef = useRef<HTMLDivElement>(null);
  const safeViewportRef = useRef<HTMLDivElement>(null);
  const crossfaderTrackRef = useRef<HTMLDivElement>(null);
  const isDraggingXf = useRef(false);
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });
  const [portrait, setPortrait] = useState(false);
  const [flip180, setFlip180] = useState(false);

  useRegisterModal('horizontal-deck-modal', isOpen, onClose);

  useEffect(() => {
    if (!safeViewportRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setFrameSize({ w: width, h: height });
        setPortrait(height > width);
      }
    });
    observer.observe(safeViewportRef.current);
    return () => observer.disconnect();
  }, [isOpen]);

  // Open / close lifecycle: load default Rekordbox school tracks if decks are empty
  useEffect(() => {
    if (!isOpen) return;
    claimedRef.current = isLessonDone;
    setIsMatched(false);
    djEngine.setCrossfader(xfRef.current);

    const tasks: Promise<void>[] = [];
    if (!djEngine.decks.A.track && !djEngine.decks.A.loading) {
      tasks.push(loadDemoToDeck('A', 'berlin-vault'));
    }
    if (!djEngine.decks.B.track && !djEngine.decks.B.loading) {
      tasks.push(loadDemoToDeck('B', 'dark-matter'));
    }
    if (tasks.length > 0) {
      initPromiseRef.current = Promise.all(tasks).then(() => {});
    }

    return () => {
      if (celebrationTimerRef.current !== null) {
        window.clearTimeout(celebrationTimerRef.current);
        celebrationTimerRef.current = null;
      }
      djEngine.suspend();
    };
  }, [isOpen, isLessonDone]);

  // 60fps render loop for waveforms, platter angle, time & VU meters
  useEffect(() => {
    if (!isOpen) return;
    let raf = 0;
    let last = performance.now();

    const decks: {
      d: DeckId;
      ov: typeof ovA;
      v: typeof vA;
      jog: typeof jogA;
      ring: typeof ringA;
      speed: typeof speedA;
      time: typeof timeA;
      bars: typeof barsA;
      meter: typeof meterA;
      side: 'left' | 'right';
      phase: string;
    }[] = [
      { d: 'A', ov: ovA, v: vA, jog: jogA, ring: ringA, speed: speedA, time: timeA, bars: barsA, meter: meterA, side: 'left', phase: '#e8322b' },
      { d: 'B', ov: ovB, v: vB, jog: jogB, ring: ringB, speed: speedB, time: timeB, bars: barsB, meter: meterB, side: 'right', phase: '#e6e6e6' },
    ];

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      for (const k of decks) {
        const deck = djEngine.decks[k.d];
        const track = deck.track;
        const pos = djEngine.getPos(k.d);
        const spd = djEngine.getSpeed(k.d);

        if (!deck.scratching && Math.abs(spd) > 0.001) {
          angleRef.current[k.d] = (angleRef.current[k.d] + dt * spd * PLATTER_DEG_PER_SEC) % 360;
        }

        if (k.ov.current) drawOverview(k.ov.current, track, pos, deck.cue, deck.loop, deck.hotCues);
        if (k.v.current) {
          drawVertical(k.v.current, track, pos, deck.cue, {
            markerSide: k.side,
            phaseColor: k.phase,
            loop: deck.loop,
            hotCues: deck.hotCues,
          });
        }

        const total = track?.duration || 1;
        const progress = Math.max(0, Math.min(1, pos / total));
        const ang = ((angleRef.current[k.d] % 360) + 360) % 360;
        k.jog.current?.setAttribute('transform', `rotate(${ang} 50 50)`);
        k.ring.current?.setAttribute('stroke-dasharray', `${(1 - progress) * 100} 100`);
        k.ring.current?.setAttribute('transform', `rotate(${-90 + progress * 360} 50 50)`);
        if (k.speed.current) {
          k.speed.current.textContent = `${spd >= 0 ? '' : ''}${spd.toFixed(2)}x`;
        }
        if (k.time.current) {
          k.time.current.textContent = track ? fmtRemain(track.duration - pos) : '-00:00';
        }

        if (k.bars.current) {
          if (!track) {
            k.bars.current.textContent = '--.- Bars';
          } else {
            const next = track.cues.find((c) => c > pos + 0.05);
            if (next === undefined) k.bars.current.textContent = '--.- Bars';
            else {
              const beatLen = 60 / Math.max(40, track.bpm);
              const leftBeats = Math.max(0, (next - pos) / beatLen);
              k.bars.current.textContent = `${Math.floor(leftBeats / 4)}.${Math.floor(leftBeats % 4) + 1} Bars`;
            }
          }
        }

        // Channel level meter (real audio analyser + waveform envelope fallback)
        const aud = djEngine.audibility(k.d);
        const liveLvl = djEngine.getLevel(k.d);
        const waveLvl = deck.playing || deck.scratching ? levelAt(track, pos) : 0;
        const target = Math.max(liveLvl * 1.35, waveLvl) * aud;
        const prev = meterSmoothRef.current[k.d];
        const nextLvl = target > prev ? target : prev * 0.86 + target * 0.14;
        meterSmoothRef.current[k.d] = nextLvl;
        if (k.meter.current) k.meter.current.style.transform = `scaleY(${Math.min(1, nextLvl)})`;
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isOpen]);

  const togglePlay = async (d: DeckId) => {
    haptic.medium();
    djEngine.resume();
    if (!djEngine.decks[d].track && initPromiseRef.current) {
      try {
        await initPromiseRef.current;
      } catch {
        /* ignore */
      }
    }
    djEngine.togglePlay(d);
  };

  const handleCueDown = (d: DeckId) => {
    haptic.heavy();
    djEngine.cueDown(d);
  };

  const handleCueUp = (d: DeckId) => {
    djEngine.cueUp(d);
  };

  const handleOverviewSeek = (d: DeckId, e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    const track = djEngine.decks[d].track;
    if (!track) return;
    const rect = e.currentTarget.getBoundingClientRect();
    let frac = 0;
    if (rect.height > rect.width) {
      frac = flip180 ? (rect.bottom - e.clientY) / rect.height : (e.clientY - rect.top) / rect.height;
    } else {
      frac = (e.clientX - rect.left) / rect.width;
    }
    djEngine.seek(d, Math.max(0, Math.min(1, frac)) * track.duration);
    haptic.selection();
  };

  const triggerQuickFilePick = (d: DeckId, e: React.MouseEvent) => {
    e.stopPropagation();
    haptic.light();
    quickFileTargetRef.current = d;
    quickFileInputRef.current?.click();
  };

  const handleQuickFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const d = quickFileTargetRef.current;
    haptic.medium();
    try {
      await loadFileToDeck(d, file);
      haptic.success();
    } catch {
      haptic.error();
    }
  };

  const handleSuccessfulBeatmatch = useCallback(() => {
    claimedRef.current = true;
    setIsMatched(true);
    haptic.success();
    triggerCelebrationConfetti();
    const lessonId = lesson?.id || 1;
    void apiProgress('dj-basics', lessonId).catch(() => {});
    completeLesson(lessonId);
    if (celebrationTimerRef.current !== null) {
      window.clearTimeout(celebrationTimerRef.current);
    }
    celebrationTimerRef.current = window.setTimeout(() => {
      celebrationTimerRef.current = null;
      onClose();
    }, 2500);
  }, [completeLesson, haptic, lesson, onClose]);

  const updateCrossfaderFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const track = crossfaderTrackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();

      let val = 0;
      if (rect.height > rect.width) {
        const raw = flip180 ? (rect.bottom - clientY) / rect.height : (clientY - rect.top) / rect.height;
        val = Math.max(0, Math.min(1, raw));
      } else {
        const raw = (clientX - rect.left) / rect.width;
        val = Math.max(0, Math.min(1, raw));
      }

      xfRef.current = val;
      setCrossfader(val);
      djEngine.setCrossfader(val);

      if (
        Math.abs(val - lastHapticXf.current) > 0.05 ||
        (val >= 0.48 && val <= 0.52 && Math.abs(0.5 - lastHapticXf.current) > 0.02)
      ) {
        lastHapticXf.current = val;
        haptic.selection();
      }

      if (!claimedRef.current && djEngine.decks.A.playing && djEngine.decks.B.playing && val >= 0.45 && val <= 0.55) {
        handleSuccessfulBeatmatch();
      }
    },
    [flip180, haptic, handleSuccessfulBeatmatch],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingXf.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    updateCrossfaderFromPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingXf.current && e.buttons === 0) return;
    e.preventDefault();
    e.stopPropagation();
    updateCrossfaderFromPointer(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingXf.current) return;
    isDraggingXf.current = false;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignore */
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingXf.current = false;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignore */
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let next = crossfader;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, crossfader - 0.05);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(1, crossfader + 0.05);
    else return;
    e.preventDefault();
    xfRef.current = next;
    setCrossfader(next);
    djEngine.setCrossfader(next);
    haptic.selection();
    if (!claimedRef.current && djEngine.decks.A.playing && djEngine.decks.B.playing && next >= 0.45 && next <= 0.55) {
      handleSuccessfulBeatmatch();
    }
  };

  if (!isOpen) return null;

  const step = isMatched ? 'matched' : !playingA ? 'play_a' : !playingB ? 'play_b' : 'crossfade';
  const hint =
    step === 'play_a'
      ? { text: 'Шаг 1 · Нажми PLAY на левой деке (крути джог для скретча)', color: ORANGE }
      : step === 'play_b'
      ? { text: 'Шаг 2 · Нажми PLAY на правой деке', color: ORANGE }
      : step === 'crossfade'
      ? {
          text: portrait
            ? 'Шаг 3 · Свайпай фейдер к центру – сведи два трека'
            : 'Шаг 3 · Двигай кроссфейдер к центру – сведи два трека',
          color: '#8ce2c8',
        }
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
    : { position: 'relative', width: '100%', height: '100%' };

  const playBtn = (d: DeckId, playing: boolean, coach: boolean) => (
    <button
      onClick={() => void togglePlay(d)}
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
      onPointerDown={() => handleCueDown(d)}
      onPointerUp={() => handleCueUp(d)}
      onPointerCancel={() => handleCueUp(d)}
      className="flex aspect-square h-[68%] min-h-[44px] min-w-[44px] max-h-[52px] items-center justify-center rounded-full border-[1.5px] text-[12px] tracking-wide active:scale-95 active:brightness-150"
      style={{ borderColor: playing ? '#8a8a8a' : ORANGE + 'aa', color: ORANGE }}
      aria-label={`Cue deck ${d}`}
    >
      CUE
    </button>
  );

  const toggleDeckView = (d: DeckId, target: DeckViewMode) => {
    setViewMode((prev) => {
      const next = prev[d] === target ? 'jog' : target;
      // When opening FX panel for the first time, engage Beat FX immediately so user hears it
      if (target === 'fx' && next === 'fx' && !djEngine.decks[d].fx.on) {
        djEngine.setFx(d, { on: true });
      }
      return { ...prev, [d]: next };
    });
  };

  const sideButtons = (d: DeckId) => {
    const deck = djEngine.decks[d];
    const mode = viewMode[d];
    return (
      <div className="flex h-full w-[46px] shrink-0 flex-col justify-around py-[2%]">
        <SideButton
          active={deck.sync}
          activeColor={SYNC_BLUE}
          onClick={() => {
            haptic.light();
            djEngine.setSync(d, !deck.sync);
          }}
        >
          SYNC
        </SideButton>
        <SideButton
          active={mode === 'pad' || deck.loop !== null}
          activeColor={deck.loop ? ORANGE : SYNC_BLUE}
          onClick={() => {
            haptic.light();
            toggleDeckView(d, 'pad');
          }}
        >
          <PadIcon />
        </SideButton>
        <SideButton
          active={deck.fx.on || mode === 'fx'}
          activeColor={deck.fx.on ? ORANGE : '#5a5a5a'}
          onClick={() => {
            haptic.light();
            toggleDeckView(d, 'fx');
          }}
        >
          FX
        </SideButton>
        <SideButton
          active={deck.slip}
          activeColor="#e04040"
          onClick={() => {
            haptic.light();
            djEngine.setSlip(d, !deck.slip);
          }}
        >
          SLIP
        </SideButton>
      </div>
    );
  };

  const header = (d: DeckId) => {
    const deck = djEngine.decks[d];
    const tr = deck.track;
    const title = deck.loading || tr?.title || (d === 'A' ? 'Berlin Vault' : 'Dark Matter');
    const artist = tr?.artist || (d === 'A' ? 'Open Deck Records' : 'FREEDA');
    return (
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-1 leading-none">
          <button
            onClick={() => {
              haptic.light();
              setBrowserDeck(d);
            }}
            title={`Выбрать трек для деки ${d}`}
            className="flex min-w-0 items-center gap-1 text-left hover:opacity-90 active:scale-[0.99]"
          >
            <span className="truncate text-[12px] font-semibold text-white">{title}</span>
          </button>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={(e) => triggerQuickFilePick(d, e)}
              title={`Загрузить аудиофайл с телефона в деку ${d}`}
              aria-label={`Load file deck ${d}`}
              className="flex items-center gap-1 rounded-[3px] border border-[#00f0b5]/50 bg-[#00f0b5]/15 px-1.5 py-[2px] text-[9px] font-bold text-[#00f0b5] active:scale-95"
            >
              <FolderMusicIcon />
              <span>ФАЙЛ</span>
            </button>
            <span ref={d === 'A' ? timeA : timeB} className="text-[12px] tabular-nums text-white">
              -00:00
            </span>
          </div>
        </div>
        <div className="mt-[1px] flex items-center justify-between">
          <span className="truncate text-[9px] leading-none text-[#8c8c8c]">{artist}</span>
          {(deck.fx.on || Math.abs(deck.filter) > 0.04 || deck.loop) && (
            <span className="text-[8px] font-bold uppercase tracking-wider text-[#f39321]">
              {[
                deck.fx.on ? deck.fx.type.toUpperCase() : '',
                deck.filter < -0.04 ? 'LPF' : deck.filter > 0.04 ? 'HPF' : '',
                deck.loop ? `LOOP ${deck.loop.beats}B` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </div>
        <canvas
          ref={d === 'A' ? ovA : ovB}
          onPointerDown={(e) => handleOverviewSeek(d, e)}
          className="mt-[3px] block min-h-0 w-full flex-1 cursor-pointer"
        />
      </div>
    );
  };

  const renderDeckCenter = (d: DeckId) => {
    const deck = djEngine.decks[d];
    const mode = viewMode[d];
    if (mode === 'fx') {
      return <DeckFxPanel deck={deck} haptic={haptic} onClosePanel={() => setViewMode((s) => ({ ...s, [d]: 'jog' }))} />;
    }
    if (mode === 'pad') {
      return <DeckPadPanel deck={deck} haptic={haptic} onClosePanel={() => setViewMode((s) => ({ ...s, [d]: 'jog' }))} />;
    }
    if (mode === 'tempo') {
      return <DeckTempoPanel deck={deck} haptic={haptic} onClosePanel={() => setViewMode((s) => ({ ...s, [d]: 'jog' }))} />;
    }
    return (
      <ScratchJogWheel
        id={d}
        markerRef={d === 'A' ? jogA : jogB}
        ringRef={d === 'A' ? ringA : ringB}
        speedTextRef={d === 'A' ? speedA : speedB}
        highlight={(d === 'A' && step === 'play_a') || (d === 'B' && step === 'play_b')}
        scratching={deck.scratching}
        fxActive={deck.fx.on}
        loopActive={deck.loop !== null}
        haptic={haptic}
        onRotationDelta={(dDeg) => {
          angleRef.current[d] = (angleRef.current[d] + dDeg) % 360;
          const marker = d === 'A' ? jogA.current : jogB.current;
          const ang = ((angleRef.current[d] % 360) + 360) % 360;
          marker?.setAttribute('transform', `rotate(${ang} 50 50)`);
        }}
      />
    );
  };

  const hasEqOrFilter =
    Math.abs(deckA.filter) > 0.04 ||
    Math.abs(deckB.filter) > 0.04 ||
    Math.abs(deckA.eq.low) > 0.04 ||
    Math.abs(deckB.eq.low) > 0.04 ||
    Math.abs(deckA.eq.mid) > 0.04 ||
    Math.abs(deckB.eq.mid) > 0.04 ||
    Math.abs(deckA.eq.hi) > 0.04 ||
    Math.abs(deckB.eq.hi) > 0.04;

  const modalContent = (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] touch-none select-none overflow-hidden bg-black"
      style={{
        zIndex: 9999,
        paddingTop: `max(env(safe-area-inset-top, 0px), var(--app-safe-top, ${safeArea.top}px))`,
        paddingBottom: `max(env(safe-area-inset-bottom, 0px), var(--app-safe-bottom, ${safeArea.bottom}px))`,
        paddingLeft: `max(env(safe-area-inset-left, 0px), var(--app-safe-left, ${safeArea.left}px))`,
        paddingRight: `max(env(safe-area-inset-right, 0px), var(--app-safe-right, ${safeArea.right}px))`,
        fontFamily: '"Helvetica Neue", Roboto, "Segoe UI", Arial, sans-serif',
      }}
    >
      {/* Hidden file input for 1-tap smartphone audio loading */}
      <input
        ref={quickFileInputRef}
        type="file"
        accept={AUDIO_ACCEPT}
        className="hidden"
        onChange={(e) => void handleQuickFileChange(e)}
      />

      <div
        ref={safeViewportRef}
        className="relative flex h-full w-full items-center justify-center overflow-hidden p-1 sm:p-2"
      >
        <div style={frameStyle} className="relative flex flex-col overflow-hidden bg-black text-[#d6d6d6]">
          {/* ============ ROW 1 · track info + overview waveforms ============ */}
          <div className="flex shrink-0 items-stretch gap-2 px-3 pt-1.5" style={{ height: '15%' }}>
            <button
              onClick={() => {
                haptic.light();
                setBrowserDeck('A');
              }}
              title="Открыть библиотеку треков (Дека A)"
              className="aspect-square h-full shrink-0 overflow-hidden rounded-[2px] border border-[#3a3a3a] active:scale-95"
            >
              <VinylArt artUrl={deckA.track?.artUrl} />
            </button>
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
            <button
              onClick={() => {
                haptic.light();
                setBrowserDeck('B');
              }}
              title="Открыть библиотеку треков (Дека B)"
              className="aspect-square h-full shrink-0 overflow-hidden rounded-[2px] border border-[#3a3a3a] active:scale-95"
            >
              <VinylArt artUrl={deckB.track?.artUrl} />
            </button>
          </div>

          {/* ============ ROW 2 · BPM / key / mixer ============ */}
          <div className="flex shrink-0 items-center justify-between px-3" style={{ height: '12%' }}>
            <BpmBox
              bpmValue={djEngine.effBpm('A') || 128}
              tempoPct={deckA.tempo}
              keyName={deckA.track?.key || '4A'}
              active={viewMode.A === 'tempo'}
              onClick={() => {
                haptic.light();
                toggleDeckView('A', 'tempo');
              }}
            />
            <div className="flex h-full items-center gap-2.5">
              <button
                className="flex aspect-square h-[72%] items-center justify-center rounded-[3px] transition-colors"
                style={{
                  background: mixerOpen ? ORANGE : hasEqOrFilter ? '#4a3820' : '#383838',
                  border: hasEqOrFilter ? `1px solid ${ORANGE}` : undefined,
                }}
                title="Открыть микшер (EQ и Фильтры)"
                aria-label="Open mixer"
                onClick={() => {
                  haptic.light();
                  setMixerOpen((o) => !o);
                }}
              >
                <MixerIcon />
              </button>
              <div className="flex h-[72%] gap-[5px]">
                {[meterA, meterB].map((ref, i) => (
                  <div key={i} className="relative h-full w-[5px] overflow-hidden rounded-[1px] bg-[#1e1e1e]">
                    <div
                      ref={ref}
                      className="absolute inset-0 h-full w-full origin-bottom"
                      style={{
                        transform: 'scaleY(0)',
                        background: 'linear-gradient(to top, #2fbf4a 0%, #2fbf4a 55%, #f2d01c 78%, #ff3b30 100%)',
                        backgroundSize: '100% 100%',
                      }}
                    />
                  </div>
                ))}
              </div>
              <button
                className="flex aspect-square h-[72%] items-center justify-center rounded-[3px] text-[#d6d6d6]"
                style={{
                  background: browserDeck ? MINT : '#383838',
                  color: browserDeck ? '#000' : '#d6d6d6',
                }}
                title="Открыть браузер треков со смартфона"
                aria-label="Open track browser"
                onClick={() => {
                  haptic.light();
                  setBrowserDeck((b) => (b ? null : 'A'));
                }}
              >
                <FolderMusicIcon />
              </button>
            </div>
            <BpmBox
              mirrored
              bpmValue={djEngine.effBpm('B') || 128}
              tempoPct={deckB.tempo}
              keyName={deckB.track?.key || '4A'}
              active={viewMode.B === 'tempo'}
              onClick={() => {
                haptic.light();
                toggleDeckView('B', 'tempo');
              }}
            />
          </div>

          {/* ============ MAIN · side buttons, jogs/panels, vertical waveforms ============ */}
          <div className="relative flex min-h-0 flex-1 items-center gap-1 px-3">
            {sideButtons('A')}
            <div className="flex h-full min-w-0 flex-1 items-center justify-center py-[1.2%]">
              {renderDeckCenter('A')}
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
              {renderDeckCenter('B')}
            </div>
            {sideButtons('B')}

            {/* Mixer Overlay (3-Band EQ + Color Filter) */}
            {mixerOpen && (
              <MixerOverlay
                deckA={deckA}
                deckB={deckB}
                haptic={haptic}
                onClose={() => setMixerOpen(false)}
              />
            )}

            {/* Coach-mark hint */}
            {hint && !mixerOpen && !browserDeck && (
              <div className="pointer-events-none absolute bottom-[3%] left-1/2 z-20 -translate-x-1/2 whitespace-nowrap">
                <div
                  className="animate-pulse rounded-full border bg-black/85 px-3.5 py-1 text-[11px] font-semibold shadow-lg"
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
                    <div className="text-sm font-bold text-white">Твоё первое сведение – в точку!</div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs font-bold text-[#8ce2c8]">
                      <Sparkles className="h-3.5 w-3.5" /> +50 GP
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ============ BOTTOM · transport + crossfader ============ */}
          <div className="flex shrink-0 items-center bg-[#1c1c1c] px-3 pb-1.5" style={{ height: '17%' }}>
            <div className="flex h-full items-center justify-center gap-[18%]" style={{ width: '31%' }}>
              {playBtn('A', playingA, step === 'play_a')}
              {cueBtn('A', playingA)}
            </div>

            <div
              ref={crossfaderTrackRef}
              role="slider"
              aria-label="Кроссфейдер"
              aria-valuemin={0}
              aria-valuemax={1}
              aria-valuenow={crossfader}
              tabIndex={0}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onKeyDown={handleKeyDown}
              className="group relative h-[72%] flex-1 touch-none select-none cursor-pointer focus:outline-none"
              style={{ touchAction: 'none' }}
            >
              <div className="absolute -inset-y-3 -inset-x-2" />

              {step === 'crossfade' && (
                <div
                  className="pointer-events-none absolute -top-[46%] z-10 -translate-x-1/2 animate-bounce whitespace-nowrap rounded-full bg-[#8ce2c8] px-2 py-[1px] text-[9px] font-bold text-black shadow-md"
                  style={{ left: `calc(${crossfader} * (100% - 16px) + 8px)` }}
                >
                  {portrait ? 'СВАЙП' : 'К ЦЕНТРУ'}
                </div>
              )}
              <div className="absolute bottom-[8%] left-0 top-[8%] w-[2px] bg-[#cfcfcf]" />
              <div className="absolute bottom-[8%] right-0 top-[8%] w-[2px] bg-[#cfcfcf]" />
              <div className="absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 rounded-[1px] bg-[#5c5c5c]" />
              <div className="absolute bottom-[30%] left-1/2 top-[30%] w-px -translate-x-1/2 bg-[#777]" />
              <div
                className="pointer-events-none absolute bottom-[4%] top-[4%] flex w-[16px] justify-between rounded-[2px]"
                style={{
                  left: `calc(${crossfader} * (100% - 16px))`,
                  filter: step === 'crossfade' ? 'drop-shadow(0 0 8px #8ce2c8)' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                }}
              >
                <div className="h-full w-[6px] rounded-[1px] bg-[#dcdcdc] border-r border-[#999]" />
                <div className="h-full w-[6px] rounded-[1px] bg-[#dcdcdc] border-l border-[#999]" />
              </div>
            </div>

            <div className="flex h-full items-center justify-center gap-[18%]" style={{ width: '31%' }}>
              {cueBtn('B', playingB)}
              {playBtn('B', playingB, step === 'play_b')}
            </div>
          </div>

          {/* Track Browser Modal (for loading smartphone audio files & switching tracks) */}
          {browserDeck && (
            <TrackBrowserOverlay
              targetDeck={browserDeck}
              haptic={haptic}
              onSelectDeck={(d) => setBrowserDeck(d)}
              onClose={() => setBrowserDeck(null)}
            />
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};
