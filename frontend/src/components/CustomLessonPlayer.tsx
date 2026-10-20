import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  Maximize2,
  Minimize2,
  RotateCcw,
  Volume2,
  VolumeX,
  Lock,
} from 'lucide-react';
import { haptic } from '../lib/theme';
import { useToast } from './Toast';

export interface CustomLessonPlayerProps {
  src: string;
  poster?: string;
  lessonId: number;
  lessonTitle: string;
  isCompleted: boolean;
  onProgress?: (progressPct: number, currentTime: number, duration: number) => void;
  onEnded?: () => void;
}

const PLAYBACK_RATES = [1.0, 1.25, 1.5, 1.75, 2.0];

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const mm = m < 10 ? `0${m}` : `${m}`;
  const ss = s < 10 ? `0${s}` : `${s}`;
  return `${mm}:${ss}`;
}

export function CustomLessonPlayer({
  src,
  poster,
  lessonId,
  lessonTitle,
  isCompleted,
  onProgress,
  onEnded,
}: CustomLessonPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { toast } = useToast();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPct, setBufferedPct] = useState(0);
  const [playbackRateIndex, setPlaybackRateIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showCenterFeedback, setShowCenterFeedback] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Anti-skip: отслеживаем максимальную просмотренную секунду при первом просмотре
  const maxWatchedTimeRef = useRef<number>(0);

  // Сброс при смене урока
  useEffect(() => {
    maxWatchedTimeRef.current = 0;
    setCurrentTime(0);
    setDuration(0);
    setBufferedPct(0);
    setIsPlaying(false);
  }, [lessonId]);

  // Сброс и запуск таймера автоскрытия контролов (3 секунды)
  const resetHideTimer = useCallback(() => {
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }

    setShowControls(true);

    // Автоскрытие только если видео активно воспроизводится и пользователь не перетаскивает ползунок
    if (isPlaying && !isScrubbing) {
      hideControlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying, isScrubbing]);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, [resetHideTimer]);

  // Обработчик Play / Pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    haptic('light');

    if (video.paused || video.ended) {
      video.play().catch(() => {
        /* автоплей блокировка браузера */
      });
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
      setShowControls(true);
    }

    // Анимационный центральный фидбек
    setShowCenterFeedback(true);
    setTimeout(() => {
      setShowCenterFeedback(false);
    }, 450);
  }, []);

  // Переключение скорости воспроизведения
  const handleRateChange = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const video = videoRef.current;
      if (!video) return;

      const nextIndex = (playbackRateIndex + 1) % PLAYBACK_RATES.length;
      const nextRate = PLAYBACK_RATES[nextIndex];

      video.playbackRate = nextRate;
      setPlaybackRateIndex(nextIndex);
      haptic('light');
      resetHideTimer();
    },
    [playbackRateIndex, resetHideTimer],
  );

  // Переключение звука
  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
    haptic('light');
  }, []);

  // Перемотка на 10 сек назад
  const rewind10 = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const video = videoRef.current;
      if (!video) return;

      video.currentTime = Math.max(0, video.currentTime - 10);
      haptic('light');
      resetHideTimer();
    },
    [resetHideTimer],
  );

  // Полноэкранный режим
  const toggleFullscreen = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container) return;

    haptic('medium');

    try {
      if (!document.fullscreenElement) {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          (container as any).webkitRequestFullscreen();
        } else if ((video as any)?.webkitEnterFullscreen) {
          // iOS Safari fallback для <video>
          (video as any).webkitEnterFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
      }
    } catch {
      /* fallback */
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(isFull);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Вычисление буферизации
  const updateBuffered = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.duration) return;

    const buffered = video.buffered;
    if (buffered.length > 0) {
      let currentBuffered = 0;
      for (let i = 0; i < buffered.length; i++) {
        if (buffered.start(i) <= video.currentTime && video.currentTime <= buffered.end(i)) {
          currentBuffered = buffered.end(i);
          break;
        }
      }
      setBufferedPct(Math.min(100, (currentBuffered / video.duration) * 100));
    }
  }, []);

  // TimeUpdate: фиксация максимального времени и защита от перемотки вперед
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const cur = video.currentTime;
    const dur = video.duration || 0;

    setCurrentTime(cur);

    // Если урок еще не завершен, непрерывно накапливаем maxWatchedTime
    if (!isCompleted) {
      if (cur > maxWatchedTimeRef.current) {
        maxWatchedTimeRef.current = cur;
      }
    }

    if (dur > 0) {
      const pct = (cur / dur) * 100;
      onProgress?.(pct, cur, dur);
    }

    updateBuffered();
  }, [isCompleted, onProgress, updateBuffered]);

  // Защита при попытке перемотки: seeking
  const handleSeeking = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // Если урок пройден ранее — разрешена любая перемотка
    if (isCompleted) {
      return;
    }

    // Если пользователь пытается перескочить дальше максимальной просмотренной секунды + допустимый буфер 1.5с
    const target = video.currentTime;
    const maxAllowed = maxWatchedTimeRef.current + 1.5;

    if (target > maxAllowed) {
      video.currentTime = maxWatchedTimeRef.current;
      haptic('warning');
      toast('🔒', 'Перемотка вперед заблокирована при первом просмотре');
    }
  }, [isCompleted, toast]);

  // Обработка клика/перетаскивания по кастомному прогресс-бару
  const seekToPosition = useCallback(
    (clientX: number) => {
      const video = videoRef.current;
      const bar = progressBarRef.current;
      if (!video || !bar) return;

      const rect = bar.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percentage = clickX / rect.width;
      const targetTime = percentage * (video.duration || 0);

      // Проверка anti-skip
      if (!isCompleted && targetTime > maxWatchedTimeRef.current + 1.5) {
        video.currentTime = maxWatchedTimeRef.current;
        haptic('warning');
        toast('🔒', 'Перемотка вперед заблокирована при первом просмотре');
        resetHideTimer();
        return;
      }

      video.currentTime = targetTime;
      haptic('light');
      resetHideTimer();
    },
    [isCompleted, resetHideTimer, toast],
  );

  const handleProgressBarMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsScrubbing(true);
    seekToPosition(e.clientX);

    const onMouseMove = (moveEvent: MouseEvent) => {
      seekToPosition(moveEvent.clientX);
    };

    const onMouseUp = () => {
      setIsScrubbing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleProgressBarTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    setIsScrubbing(true);
    if (e.touches.length > 0) {
      seekToPosition(e.touches[0].clientX);
    }

    const onTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length > 0) {
        seekToPosition(moveEvent.touches[0].clientX);
      }
    };

    const onTouchEnd = () => {
      setIsScrubbing(false);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };

    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
  };

  const progressPct = useMemo(() => {
    if (!duration || duration <= 0) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  const maxWatchedPct = useMemo(() => {
    if (!duration || duration <= 0) return 0;
    if (isCompleted) return 100;
    return Math.min(100, Math.max(0, (maxWatchedTimeRef.current / duration) * 100));
  }, [duration, isCompleted]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={`Видеоплеер урока ${lessonTitle}`}
      onClick={togglePlay}
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden select-none shadow-2xl group"
      style={{
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* Нативный HTML5 видеопоток */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        webkit-playsinline="true"
        preload="metadata"
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onSeeking={handleSeeking}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || 0);
          updateBuffered();
        }}
        onProgress={updateBuffered}
        onEnded={() => {
          setIsPlaying(false);
          setShowControls(true);
          onEnded?.();
        }}
        className="w-full h-full object-contain bg-black cursor-pointer"
      />

      {/* Центральный анимированный оверлей Play / Pause */}
      <div
        className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300 ${
          showCenterFeedback || (!isPlaying && showControls) ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: '50%',
            background: 'rgba(17, 50, 42, 0.82)',
            backdropFilter: 'blur(8px)',
            border: '2px solid var(--brand-mint)',
            color: 'var(--brand-mint)',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 0 28px rgba(140, 226, 200, 0.35)',
            transform: showCenterFeedback ? 'scale(1.12)' : 'scale(1)',
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {isPlaying ? (
            <Pause size={32} fill="currentColor" strokeWidth={0} />
          ) : (
            <Play size={32} fill="currentColor" strokeWidth={0} style={{ marginLeft: 3 }} />
          )}
        </div>
      </div>

      {/* Верхний статус-бар плеера */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute top-0 inset-x-0 p-3 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent transition-opacity duration-300 z-20 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: 'var(--brand-mint)',
              background: 'rgba(140, 226, 200, 0.15)',
              border: '1px solid rgba(140, 226, 200, 0.3)',
              padding: '2px 8px',
              borderRadius: 6,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Урок {lessonId}
          </span>
          <span
            className="text-xs font-semibold text-white/90 truncate max-w-[200px]"
            title={lessonTitle}
          >
            {lessonTitle}
          </span>
        </div>

        {!isCompleted && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--brand-coral)',
              background: 'rgba(245, 146, 110, 0.12)',
              border: '1px solid rgba(245, 146, 110, 0.25)',
              padding: '2px 7px',
              borderRadius: 6,
            }}
          >
            <Lock size={11} />
            <span>Anti-Skip</span>
          </div>
        )}
      </div>

      {/* Нижняя брендовая панель управления */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute bottom-0 inset-x-0 p-3 pt-8 flex flex-col gap-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300 z-20 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Интерактивный кастомный прогресс-бар */}
        <div
          ref={progressBarRef}
          onMouseDown={handleProgressBarMouseDown}
          onTouchStart={handleProgressBarTouchStart}
          className="relative w-full h-4 flex items-center cursor-pointer group/bar"
        >
          {/* Фоновая подложка дорожки */}
          <div
            className="w-full h-1.5 rounded-full overflow-hidden relative transition-all duration-150 group-hover/bar:h-2"
            style={{ background: 'rgba(255, 255, 255, 0.18)' }}
          >
            {/* Дорожка буферизации */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full transition-all duration-200"
              style={{ width: `${bufferedPct}%` }}
            />

            {/* Дорожка разрешенной зоны при Anti-Skip */}
            {!isCompleted && maxWatchedPct > 0 && (
              <div
                className="absolute left-0 top-0 bottom-0 rounded-full opacity-40"
                style={{
                  width: `${maxWatchedPct}%`,
                  background: 'rgba(140, 226, 200, 0.35)',
                }}
              />
            )}

            {/* Активная полоса воспроизведения */}
            <div
              className="absolute left-0 top-0 bottom-0 rounded-full transition-all duration-75"
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, var(--brand-mint) 0%, var(--brand-coral) 100%)',
                boxShadow: '0 0 10px rgba(140, 226, 200, 0.5)',
              }}
            />
          </div>

          {/* Бегунок Thumb */}
          <div
            className="absolute -translate-x-1/2 pointer-events-none transition-transform duration-100 group-hover/bar:scale-125"
            style={{
              left: `${progressPct}%`,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#ffffff',
              boxShadow: '0 0 8px rgba(0,0,0,0.6), 0 0 6px var(--brand-mint)',
              border: '2px solid var(--brand-mint)',
            }}
          />
        </div>

        {/* Нижний ряд кнопок и таймкодов */}
        <div className="flex items-center justify-between text-white text-xs">
          <div className="flex items-center gap-3">
            {/* Кнопка Play/Pause в панели */}
            <button
              type="button"
              onClick={togglePlay}
              className="p-1 hover:text-[var(--brand-mint)] transition-colors active:scale-90"
              aria-label={isPlaying ? 'Пауза' : 'Воспроизведение'}
            >
              {isPlaying ? (
                <Pause size={18} fill="currentColor" strokeWidth={0} />
              ) : (
                <Play size={18} fill="currentColor" strokeWidth={0} />
              )}
            </button>

            {/* Перемотка на -10 сек */}
            <button
              type="button"
              onClick={rewind10}
              className="p-1 hover:text-[var(--brand-mint)] transition-colors active:scale-90"
              title="Перемотать на 10 сек назад"
            >
              <RotateCcw size={16} />
            </button>

            {/* Вкл/Выкл звук */}
            <button
              type="button"
              onClick={toggleMute}
              className="p-1 hover:text-[var(--brand-mint)] transition-colors active:scale-90"
              title={isMuted ? 'Включить звук' : 'Выключить звук'}
            >
              {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>

            {/* Таймкод */}
            <div className="font-mono text-[11px] text-white/80 tabular-nums select-none">
              <span className="text-[var(--brand-mint)] font-bold">{formatTime(currentTime)}</span>
              <span className="mx-1 text-white/40">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Кнопка скорости */}
            <button
              type="button"
              onClick={handleRateChange}
              className="px-2 py-0.5 rounded-md font-bold text-[11px] transition-all bg-white/10 hover:bg-white/20 active:scale-95 text-[var(--brand-gold)] border border-white/10"
              title="Скорость воспроизведения"
            >
              {PLAYBACK_RATES[playbackRateIndex]}x
            </button>

            {/* Кнопка Fullscreen */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 rounded-md hover:text-[var(--brand-mint)] transition-colors active:scale-90 text-white/90"
              title={isFullscreen ? 'Свернуть' : 'Во весь экран'}
            >
              {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
