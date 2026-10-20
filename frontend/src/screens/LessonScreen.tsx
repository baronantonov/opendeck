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
  const isFirstLesson = lessonId === 1;

  // Флаг разблокировки кнопки завершения: в уроке 1 видео нет (доступен сразу), в остальных — при просмотре >= 98%
  const [videoFinished, setVideoFinished] = useState(alreadyCompleted || isFirstLesson);
  const [deckModalOpen, setDeckModalOpen] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // Сброс состояния завершения при переходе на другой урок
  useEffect(() => {
    setVideoFinished(alreadyCompleted || isFirstLesson);
    setIsFinishing(false);
  }, [lessonId, alreadyCompleted, isFirstLesson]);

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
    if (!isFirstLesson && !videoFinished && !alreadyCompleted) return;

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
      className="h-full max-h-full w-full flex flex-col justify-between text-[var(--color-text)] bg-[var(--color-bg)] overflow-hidden select-none"
      style={{
        paddingTop: 0,
        paddingBottom: 'calc(var(--app-safe-bottom, var(--safe-bottom, 0px)) + 8px)',
        boxSizing: 'border-box',
      }}
    >
      {/* ── ВЕРХНИЙ БАР С ОХРАННЫМИ ПОЛЯМИ ── */}
      <div className="flex items-center justify-between px-4 pt-2.5 pb-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            haptic('light');
            navigate('/learn');
          }}
          className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold text-white/75 hover:text-white bg-white/[0.06] active:scale-95 transition-all"
        >
          <ArrowLeft size={14} />
          <span>К урокам</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-[var(--brand-mint)]/10 text-[var(--brand-mint)] border border-[var(--brand-mint)]/20 tracking-wider">
            Pocket DJ · {lesson.id}/10
          </span>

          {alreadyCompleted && (
            <span className="flex items-center gap-1 text-xs font-bold text-[var(--brand-mint)]">
              <CheckCircle2 size={14} />
              <span>Пройден</span>
            </span>
          )}
        </div>
      </div>

      {/* ── ВИДЕОПЛЕЕР УРОКА (В УРОКЕ 1 ПЛЕЕРА И ВИДЕО НЕТ ВООБЩЕ) ── */}
      {!isFirstLesson && (
        <div className="px-4 shrink-0 mb-2">
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

      {/* ── ОСНОВНОЙ КОНТЕНТ УРОКА (ФОН КАК ВСЕ ПРИЛОЖЕНИЕ, ПРОСТОРНЫЕ ОХРАННЫЕ ПОЛЯ) ── */}
      <div className="flex-1 min-h-0 px-4 pb-2 overflow-y-auto scroll-y flex flex-col gap-3.5">
        {/* Информационная карточка урока: фон совпадает со всем приложением */}
        <div className="rounded-2xl p-4 sm:p-5 border border-white/[0.08] bg-[var(--color-bg)] flex flex-col gap-3 shadow-lg">
          {/* Мета-информация */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--brand-coral)]">
              {lesson.subtitle || `УРОК ${lesson.id} ИЗ 10`}
            </span>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-white/50">
              {isFirstLesson ? (
                <>
                  <Sliders size={13} className="text-[var(--brand-mint)]" />
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

          {/* Заголовок урока */}
          <h1 className="text-lg sm:text-xl font-bold text-white leading-snug m-0">
            {lesson.title}
          </h1>

          {/* Краткое резюме */}
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs sm:text-[13.5px] leading-relaxed text-white/85 font-normal">
            {lesson.summary}
          </div>

          {/* Ключевые тезисы: полный структурированный список */}
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-white/45">
              Что освоишь в уроке:
            </span>
            <ul className="m-0 p-0 space-y-2 list-none">
              {lesson.description.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-white/75 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-mint)] shrink-0 mt-2" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Интерактивная практика Rekordbox для Урока 1 (отдельный просторный блок с кнопкой в стиле приложения) */}
        {isFirstLesson && (
          <div className="rounded-2xl p-4 bg-[var(--color-bg)] border border-[var(--brand-mint)]/25 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[var(--brand-mint)]/10 border border-[var(--brand-mint)]/20 flex items-center justify-center text-[var(--brand-mint)] shrink-0">
                <Sliders size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white leading-tight">
                  Виртуальный пульт Rekordbox
                </div>
                <div className="text-xs text-white/60 leading-tight mt-1">
                  Попробуй деку, кроссфейдер и фильтры в реальном интерактиве
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                haptic('heavy');
                setDeckModalOpen(true);
              }}
              className="w-full py-3.5 px-4 rounded-[14px] font-bold text-sm text-[#11322a] bg-[var(--brand-mint)] hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Sliders size={16} />
              <span>Встать за пульт Rekordbox</span>
            </button>
          </div>
        )}
      </div>

      {/* ── БЛОК ЗАВЕРШЕНИЯ УРОКА (ЕДИНЫЙ СТИЛЬ КНОПОК ПРИЛОЖЕНИЯ, ОТДЕЛЬНО С ОХРАННЫМИ ПОЛЯМИ) ── */}
      <div className="px-4 pt-3 pb-1 shrink-0 flex flex-col gap-2 border-t border-white/[0.06] bg-[var(--color-bg)]">
        <button
          type="button"
          disabled={!canComplete || isFinishing}
          onClick={handleCompleteClick}
          className={`w-full py-3.5 px-4 rounded-[14px] font-bold text-[15px] transition-all duration-200 flex items-center justify-center gap-2 select-none ${
            canComplete
              ? 'bg-gradient-to-r from-[var(--brand-mint)] to-[var(--brand-coral)] text-[#11322a] cursor-pointer shadow-md shadow-[rgba(140,226,200,0.2)] active:scale-[0.98]'
              : 'bg-white/10 text-white/40 cursor-not-allowed opacity-55 border border-white/5'
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

        {/* Статус-подсказка под кнопкой с охранным полем */}
        <div className="text-center text-xs font-medium text-white/50 min-h-[16px] leading-tight">
          {alreadyCompleted ? (
            <span className="text-[var(--brand-mint)]">Урок уже зачтён в твоём профиле</span>
          ) : isFirstLesson ? (
            <span className="text-[var(--brand-mint)]">Опробуй пульт или зафиксируй прохождение (+50 GP)</span>
          ) : canComplete ? (
            <span className="text-[var(--brand-mint)]">Видео досмотрено! Зафиксируй прогресс (+50 GP)</span>
          ) : (
            <span>Досмотри видео до конца, чтобы завершить урок</span>
          )}
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
