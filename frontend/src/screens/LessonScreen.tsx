import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Sparkles,
  Lock,
  Sliders,
} from 'lucide-react';
import { getLessonById, resolveVideoSource, POCKET_DJ_LESSONS } from '../data/lessonsData';
import { CustomLessonPlayer } from '../components/CustomLessonPlayer';
import { useCourseProgress } from '../state/CourseProgressContext';
import { PaywallModal } from '../components/PaywallModal';
import { HorizontalDeckModal } from '../components/deck/HorizontalDeckModal';
import { AbstractGeometryBg } from '../components/LiquidGlassGeometry';
import { useToast } from '../components/Toast';
import { getTelegramWebApp } from '../types';
import { haptic } from '../lib/theme';
import { COURSE_LESSONS } from '../lib/constants';

export function LessonScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    isCoursePurchased,
    isLessonCompleted,
    completeLesson,
    guardLessonAccess,
  } = useCourseProgress();

  const lessonId = useMemo(() => {
    const parsed = parseInt(id || '1', 10);
    return isNaN(parsed) || parsed < 1 || parsed > 10 ? 1 : parsed;
  }, [id]);

  const lesson = useMemo(() => getLessonById(lessonId) || POCKET_DJ_LESSONS[0], [lessonId]);
  const lessonIndex = lessonId - 1;

  // Проверка прав доступа к уроку
  const accessGuard = useMemo(() => {
    return guardLessonAccess(lessonIndex);
  }, [guardLessonAccess, lessonIndex]);

  // Статус прохождения урока
  const alreadyCompleted = isLessonCompleted(lessonId);
  const isFirstLesson = lessonId === 1;

  // Флаг разблокировки кнопки завершения: в уроке 1 видео нет (доступен сразу), в остальных — при просмотре >= 98%
  const [videoFinished, setVideoFinished] = useState(alreadyCompleted || isFirstLesson);
  const [deckModalOpen, setDeckModalOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // Сброс состояния завершения при переходе на другой урок
  useEffect(() => {
    setVideoFinished(alreadyCompleted || isFirstLesson);
    setIsFinishing(false);
  }, [lessonId, alreadyCompleted, isFirstLesson]);

  // Настройка Telegram WebApp SDK: защита от свайпов и перехват нативной кнопки «Назад»
  useEffect(() => {
    const tw = getTelegramWebApp();

    try {
      tw?.disableVerticalSwipes?.();
      tw?.enableClosingConfirmation?.();
      tw?.BackButton?.show?.();
    } catch {
      /* fallback */
    }

    const handleBack = () => {
      haptic('light');
      navigate('/learn');
    };

    try {
      tw?.BackButton?.onClick?.(handleBack);
    } catch {
      /* fallback */
    }

    return () => {
      try {
        tw?.BackButton?.offClick?.(handleBack);
      } catch {
        /* fallback */
      }
    };
  }, [navigate]);

  // Если доступ заблокирован (например, попытка перехода по URL без сдачи предыдущих уроков)
  useEffect(() => {
    if (!accessGuard.allowed && !paywallOpen) {
      haptic('warning');
      if (accessGuard.reason === 'needs_paywall') {
        toast('🔒', 'Урок доступен в полной версии Pocket DJ');
        setPaywallOpen(true);
      } else {
        toast('🔒', 'Сначала заверши предыдущий урок');
        navigate('/learn', { replace: true });
      }
    }
  }, [accessGuard, navigate, paywallOpen, toast]);

  // Обработчик прогресса воспроизведения видео
  const handleVideoProgress = useCallback(
    (progressPct: number) => {
      if (!videoFinished && progressPct >= 98) {
        setVideoFinished(true);
        haptic('light');
      }
    },
    [videoFinished],
  );

  // Обработчик завершения видеопотока
  const handleVideoEnded = useCallback(() => {
    setVideoFinished(true);
    haptic('success');
  }, []);

  // Нажатие кнопки «Закончить урок»
  const handleCompleteClick = useCallback(() => {
    if (!isFirstLesson && !videoFinished && !alreadyCompleted) return;

    haptic('light');
    setIsFinishing(true);

    // 1. Фиксация урока как пройденного в контексте и Telegram CloudStorage
    completeLesson(lessonId);
    toast('✓', `Урок ${lessonId} завершён! +50 GP`);

    // 2. Авто-вызов пейвола со значком «Pocket DJ» по окончании 2-го урока
    if (lessonId === 2 && !isCoursePurchased) {
      setTimeout(() => {
        setIsFinishing(false);
        setPaywallOpen(true);
      }, 320);
      return;
    }

    // 3. Для остальных уроков — плавный возврат на экран обучения
    setTimeout(() => {
      setIsFinishing(false);
      navigate('/learn');
    }, 420);
  }, [
    alreadyCompleted,
    completeLesson,
    isCoursePurchased,
    isFirstLesson,
    lessonId,
    navigate,
    toast,
    videoFinished,
  ]);

  const canComplete = isFirstLesson || videoFinished || alreadyCompleted;
  const videoSourceUrl = resolveVideoSource(lesson);
  const fallbackLessonForDeck = COURSE_LESSONS[lessonIndex] || COURSE_LESSONS[0];

  return (
    <div
      className="h-full max-h-full w-full flex flex-col justify-between text-[#f4f7f5] bg-[#2b302e] overflow-hidden select-none"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
        boxSizing: 'border-box',
      }}
    >
      {/* ── ВЕРХНИЙ БАР (БЕЗ ПОЛОС, НА LIQUID GLASS ПИЛЛАХ) ── */}
      <div className="flex items-center justify-between px-4 pb-2.5 shrink-0">
        <button
          type="button"
          onClick={() => {
            haptic('light');
            navigate('/learn');
          }}
          className="liquid-glass-pill flex items-center gap-1.5 py-2 px-3.5 rounded-2xl text-xs font-bold text-[#f4f7f5] active:scale-[0.97] transition-all duration-200 ease-out cursor-pointer border-0"
        >
          <ArrowLeft size={14} />
          <span>К урокам</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="liquid-glass-pill text-[11px] font-extrabold uppercase px-3 py-1.5 rounded-full text-[#8ce2c8] tracking-wider">
            Pocket DJ · {lesson.id}/10
          </span>

          {alreadyCompleted && (
            <span className="flex items-center gap-1 text-xs font-bold text-[#8ce2c8]">
              <CheckCircle2 size={14} />
              <span>Пройден</span>
            </span>
          )}
        </div>
      </div>

      {/* ── КАСТОМНЫЙ ВИДЕОПЛЕЕР УРОКА С ЗАЩИТОЙ ОТ ПЕРЕМОТКИ (УРОКИ 2–10) ── */}
      {!isFirstLesson && (
        <div className="px-4 shrink-0 mb-3">
          <CustomLessonPlayer
            src={videoSourceUrl}
            poster={lesson.poster}
            lessonId={lesson.id}
            lessonTitle={lesson.title}
            isCompleted={alreadyCompleted}
            onProgress={handleVideoProgress}
            onEnded={handleVideoEnded}
          />
        </div>
      )}

      {/* ── ОСНОВНОЙ КОНТЕНТ УРОКА В LIQUID GLASS ── */}
      <div className="flex-1 min-h-0 px-4 pb-2 overflow-y-auto scroll-y flex flex-col gap-4">
        {/* Информационная карточка урока */}
        <div className="liquid-glass-card relative overflow-hidden rounded-3xl p-5 flex flex-col gap-3">
          <AbstractGeometryBg
            variant="card"
            spheres={1}
            primaryColor="var(--brand-mint)"
            secondaryColor="var(--brand-coral)"
          />

          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#f5926e]">
              {lesson.subtitle || `УРОК ${lesson.id} ИЗ 10`}
            </span>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#9aa3a0]">
              {isFirstLesson ? (
                <>
                  <Sliders size={13} className="text-[#8ce2c8]" />
                  <span>Интерактивная практика</span>
                </>
              ) : (
                <>
                  <Clock size={13} />
                  <span>~{Math.round(lesson.durationSeconds / 60)} мин</span>
                </>
              )}
            </span>
          </div>

          <h1 className="relative z-10 text-lg sm:text-xl font-extrabold text-[#f4f7f5] leading-snug m-0">
            {lesson.title}
          </h1>

          <div className="relative z-10 p-3.5 rounded-2xl bg-[#2b302e]/65 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] text-xs sm:text-[13.5px] leading-relaxed text-[#f4f7f5]/90">
            {lesson.summary}
          </div>

          <div className="relative z-10 flex flex-col gap-2 pt-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#9aa3a0]">
              Что освоишь в уроке:
            </span>
            <ul className="m-0 p-0 space-y-2 list-none">
              {lesson.description.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-[#f4f7f5]/85 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8ce2c8] shrink-0 mt-2" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Интерактивная практика Rekordbox для Урока 1 */}
        {isFirstLesson && (
          <div className="liquid-glass-card relative overflow-hidden rounded-3xl p-5 flex flex-col gap-3.5">
            <AbstractGeometryBg variant="card" spheres={0} />

            <div className="relative z-10 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#8ce2c8]/15 shadow-[inset_0_1px_1px_rgba(140,226,200,0.28)] flex items-center justify-center text-[#8ce2c8] shrink-0">
                <Sliders size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-extrabold text-[#f4f7f5] leading-tight">
                  Виртуальный пульт Rekordbox
                </div>
                <div className="text-xs text-[#9aa3a0] leading-snug mt-1">
                  Попробуй деку, кроссфейдер и фильтры в реальном интерактиве
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                haptic('light');
                setDeckModalOpen(true);
              }}
              className="relative z-10 w-full h-13 py-3.5 px-4 rounded-2xl font-bold text-base text-[#11322a] bg-[#8ce2c8] shadow-[inset_0_1px_1px_rgba(255,255,255,0.45),0_10px_24px_-6px_rgba(140,226,200,0.45)] active:scale-[0.97] transition-all duration-200 ease-out flex items-center justify-center gap-2 cursor-pointer border-0"
            >
              <Sliders size={18} />
              <span>Встать за пульт Rekordbox</span>
            </button>
          </div>
        )}
      </div>

      {/* ── БЛОК ЗАВЕРШЕНИЯ УРОКА (БЕЗ ГОРИЗОНТАЛЬНЫХ ПОЛОС, TABBAR СКРЫТ) ── */}
      <div className="px-4 pt-3 pb-1 shrink-0 flex flex-col gap-2">
        <button
          type="button"
          disabled={!canComplete || isFinishing}
          onClick={handleCompleteClick}
          className={`w-full h-13 py-3.5 px-5 rounded-2xl font-bold text-base transition-all duration-200 ease-out flex items-center justify-center gap-2 select-none border-0 ${
            canComplete
              ? 'bg-gradient-to-r from-[#8ce2c8] to-[#f5926e] text-[#11322a] cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.45),0_12px_28px_-6px_rgba(140,226,200,0.4)] active:scale-[0.97]'
              : 'bg-white/[0.06] text-[#9aa3a0] cursor-not-allowed opacity-60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]'
          }`}
        >
          {isFinishing ? (
            <span>Сохраняем прогресс...</span>
          ) : alreadyCompleted ? (
            <>
              <CheckCircle2 size={18} />
              <span>Урок пройден · К списку уроков</span>
            </>
          ) : canComplete ? (
            <>
              <Sparkles size={18} />
              <span>Закончить урок (+50 GP)</span>
            </>
          ) : (
            <>
              <Lock size={16} />
              <span>Закончить урок</span>
            </>
          )}
        </button>

        <div className="text-center text-xs font-medium text-[#9aa3a0] min-h-[16px] leading-tight">
          {alreadyCompleted ? (
            <span className="text-[#8ce2c8]">Урок уже зачтён в твоём паспорте диджея</span>
          ) : isFirstLesson ? (
            <span className="text-[#8ce2c8]">Опробуй пульт или зафиксируй прохождение (+50 GP)</span>
          ) : canComplete ? (
            <span className="text-[#8ce2c8]">Видео досмотрено! Зафиксируй прогресс (+50 GP)</span>
          ) : (
            <span>Досмотри видео до конца, чтобы завершить урок</span>
          )}
        </div>
      </div>

      {/* Модальное окно Paywall со значком «Pocket DJ» (авто-вызов после 2-го урока) */}
      <PaywallModal
        open={paywallOpen}
        onClose={() => {
          setPaywallOpen(false);
          navigate('/learn');
        }}
      />

      {/* Интерактивный виртуальный пульт Rekordbox (DjDeckScreen — неприкосновенен) */}
      <HorizontalDeckModal
        isOpen={deckModalOpen}
        onClose={() => setDeckModalOpen(false)}
        lesson={fallbackLessonForDeck}
      />
    </div>
  );
}
