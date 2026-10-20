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
import { useStarsCheckout } from '../payment/Paywall';
import { HorizontalDeckModal } from '../components/deck/HorizontalDeckModal';
import { useToast } from '../components/Toast';
import { getTelegramWebApp } from '../types';
import { haptic } from '../lib/theme';
import { COURSE_LESSONS } from '../lib/constants';

export function LessonScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { checkoutCourse } = useStarsCheckout();

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

  // Флаг разблокировки кнопки завершения: видео просмотрено на >= 98% или урок уже пройден
  const [videoFinished, setVideoFinished] = useState(alreadyCompleted);
  const [deckModalOpen, setDeckModalOpen] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // Сброс состояния завершения при переходе на другой урок
  useEffect(() => {
    setVideoFinished(alreadyCompleted);
    setIsFinishing(false);
  }, [lessonId, alreadyCompleted]);

  // Настройка Telegram WebApp SDK: защита от свайпов и перехват кнопки «Назад»
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
        tw?.enableVerticalSwipes?.();
      } catch {
        /* fallback */
      }
    };
  }, [navigate]);

  // Если доступ заблокирован (например, попытка перехода по URL без сдачи предыдущих уроков)
  useEffect(() => {
    if (!accessGuard.allowed) {
      haptic('warning');
      if (accessGuard.reason === 'needs_paywall') {
        toast('🔒', 'Урок доступен в полной версии Pocket DJ');
        void checkoutCourse('dj-basics');
      } else {
        toast('🔒', 'Сначала заверши предыдущий урок');
      }
      navigate('/learn', { replace: true });
    }
  }, [accessGuard, checkoutCourse, navigate, toast]);

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
    if (!videoFinished && !alreadyCompleted) return;

    haptic('success');
    setIsFinishing(true);

    // 1. Фиксация урока как пройденного в контексте и Telegram CloudStorage
    completeLesson(lessonId);
    toast('✓', `Урок ${lessonId} завершён! +50 GP`);

    // 2. Если завершён Урок 2 («Знакомство с FREEDA») и курс еще не куплен
    if (lessonId === 2 && !isCoursePurchased) {
      setTimeout(() => {
        setIsFinishing(false);
        void checkoutCourse('dj-basics');
        navigate('/learn');
      }, 400);
      return;
    }

    // 3. Для остальных уроков — плавный возврат на экран обучения
    setTimeout(() => {
      setIsFinishing(false);
      navigate('/learn');
    }, 450);
  }, [
    alreadyCompleted,
    checkoutCourse,
    completeLesson,
    isCoursePurchased,
    lessonId,
    navigate,
    toast,
    videoFinished,
  ]);

  const canComplete = videoFinished || alreadyCompleted;
  const videoSourceUrl = resolveVideoSource(lesson);
  const fallbackLessonForDeck = COURSE_LESSONS[lessonIndex] || COURSE_LESSONS[0];

  return (
    <div
      className="h-full max-h-full w-full flex flex-col justify-between text-[var(--color-text)] bg-gradient-to-b from-[#1b2220] via-[var(--color-bg,#242b28)] to-[#181d1c] overflow-hidden select-none"
      style={{
        paddingTop: 0,
        paddingBottom: 'calc(var(--app-safe-bottom, var(--safe-bottom, 0px)) + 8px)',
        boxSizing: 'border-box',
      }}
    >
      {/* ── КОМПАКТНЫЙ ВЕРХНИЙ БАР ── */}
      <div className="flex items-center justify-between px-3 pt-1.5 pb-1 shrink-0">
        <button
          type="button"
          onClick={() => {
            haptic('light');
            navigate('/learn');
          }}
          className="flex items-center gap-1 py-1 px-2.5 rounded-lg text-xs font-semibold text-white/70 hover:text-white bg-white/[0.06] active:scale-95 transition-all"
        >
          <ArrowLeft size={13} />
          <span>К урокам</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[10.5px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[var(--brand-mint)]/10 text-[var(--brand-mint)] border border-[var(--brand-mint)]/20 tracking-wider">
            Pocket DJ · {lesson.id}/10
          </span>

          {alreadyCompleted && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-[var(--brand-mint)]">
              <CheckCircle2 size={13} />
              <span>Пройден</span>
            </span>
          )}
        </div>
      </div>

      {/* ── ВИДЕОПЛЕЕР УРОКА ── */}
      <div className="px-3 shrink-0">
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

      {/* ── КОНТЕНТ УРОКА И ЗАВЕРШЕНИЕ (БЕЗ ПРОКРУТКИ) ── */}
      <div className="flex-1 min-h-0 flex flex-col justify-between px-3 pt-2 pb-1 overflow-hidden">
        {/* Информационная карточка */}
        <div className="rounded-xl p-2.5 sm:p-3 border border-white/[0.08] bg-[var(--color-surface,#2e3432)] flex flex-col gap-1.5 shrink-0 shadow-lg">
          {/* Подзаголовок и длительность */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-coral)]">
              {lesson.subtitle || `УРОК ${lesson.id} ИЗ 10`}
            </span>
            <span className="flex items-center gap-1 text-[10px] font-semibold text-white/50">
              <Clock size={11} />
              <span>~{Math.round(lesson.durationSeconds / 60)} мин</span>
            </span>
          </div>

          {/* Заголовок */}
          <h1 className="text-[13.5px] sm:text-[15px] font-bold text-white leading-tight m-0 line-clamp-1">
            {lesson.title}
          </h1>

          {/* Краткое резюме */}
          <div className="p-2 rounded-lg bg-black/25 border border-white/[0.05] text-[11px] sm:text-[11.5px] leading-snug text-white/80 font-normal line-clamp-2">
            {lesson.summary}
          </div>

          {/* Ключевые тезисы (2 емких пункта) */}
          <ul className="m-0 p-0 pl-3.5 space-y-0.5 text-[10.5px] sm:text-[11px] text-white/70 leading-tight">
            {lesson.description.slice(0, 2).map((item, idx) => (
              <li key={idx} className="marker:text-[var(--brand-mint)] line-clamp-1">
                {item}
              </li>
            ))}
          </ul>

          {/* Интерактивная консоль Rekordbox для Урока 1 */}
          {lesson.id === 1 && (
            <button
              type="button"
              onClick={() => {
                haptic('heavy');
                setDeckModalOpen(true);
              }}
              className="mt-0.5 w-full py-1.5 px-3 rounded-lg font-bold text-[11.5px] text-[#11322a] bg-[var(--brand-mint)] hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Sliders size={13} />
              <span>Встать за пульт Rekordbox</span>
            </button>
          )}
        </div>

        {/* ── БЛОК ЗАВЕРШЕНИЯ УРОКА ── */}
        <div className="pt-1.5 flex flex-col gap-1 shrink-0">
          <button
            type="button"
            disabled={!canComplete || isFinishing}
            onClick={handleCompleteClick}
            className={`w-full py-2.5 px-4 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 select-none ${
              canComplete
                ? 'bg-gradient-to-r from-[var(--brand-mint)] to-[var(--brand-coral)] text-[#11322a] cursor-pointer shadow-md shadow-[rgba(140,226,200,0.2)] active:scale-[0.98]'
                : 'bg-white/10 text-white/40 cursor-not-allowed opacity-55 border border-white/5'
            }`}
          >
            {isFinishing ? (
              <span>Сохраняем прогресс...</span>
            ) : alreadyCompleted ? (
              <>
                <CheckCircle2 size={16} />
                <span>Урок пройден · К списку уроков</span>
              </>
            ) : canComplete ? (
              <>
                <Sparkles size={16} />
                <span>Закончить урок (+50 GP)</span>
              </>
            ) : (
              <>
                <Lock size={14} />
                <span>Закончить урок</span>
              </>
            )}
          </button>

          {/* Статус-подсказка под кнопкой */}
          <div className="text-center text-[10.5px] font-medium text-white/50 min-h-[14px] leading-none">
            {alreadyCompleted ? (
              <span className="text-[var(--brand-mint)]">Урок уже зачтён в твоём профиле</span>
            ) : canComplete ? (
              <span className="text-[var(--brand-mint)]">Видео досмотрено! Зафиксируй прогресс</span>
            ) : (
              <span>Досмотри видео до конца, чтобы завершить урок</span>
            )}
          </div>
        </div>
      </div>

      {/* Интерактивный виртуальный пульт Rekordbox для практики */}
      <HorizontalDeckModal
        isOpen={deckModalOpen}
        onClose={() => setDeckModalOpen(false)}
        lesson={fallbackLessonForDeck}
      />
    </div>
  );
}
