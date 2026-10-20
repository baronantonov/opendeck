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
      className="min-h-screen w-full flex flex-col text-[var(--color-text)] bg-gradient-to-b from-[#1b2220] via-[var(--color-bg,#242b28)] to-[#181d1c]"
      style={{
        paddingTop: 'var(--app-safe-top, var(--safe-top, 0px))',
        paddingBottom: 'calc(var(--app-safe-bottom, var(--safe-bottom, 0px)) + 28px)',
        boxSizing: 'border-box',
      }}
    >
      {/* ── ВЕРХНИЙ ХЕДЕР ЭКРАНА УРОКА ── */}
      <header className="px-4 py-3 flex items-center justify-between border-b border-white/[0.07] bg-black/20 backdrop-blur-md sticky top-0 z-30">
        <button
          type="button"
          onClick={() => {
            haptic('light');
            navigate('/learn');
          }}
          className="flex items-center gap-1.5 py-1 px-2.5 -ml-1 rounded-xl text-sm font-semibold text-white/80 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 transition-all"
        >
          <ArrowLeft size={16} />
          <span>К урокам</span>
        </button>

        <div className="flex items-center gap-2">
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: 'var(--brand-mint)',
              background: 'rgba(140, 226, 200, 0.12)',
              border: '1px solid rgba(140, 226, 200, 0.28)',
              padding: '2px 8px',
              borderRadius: 99,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Pocket DJ
          </span>

          {alreadyCompleted && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--brand-mint)',
              }}
            >
              <CheckCircle2 size={14} />
              <span>Пройден</span>
            </span>
          )}
        </div>
      </header>

      {/* ── ОСНОВНОЙ КОНТЕНТ ── */}
      <main className="flex-1 flex flex-col p-4 max-w-lg mx-auto w-full gap-4">
        {/* Кастомный брендовый плеер со строгой Anti-Skip защитой */}
        <div className="w-full">
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

        {/* Информационная карточка урока */}
        <div
          className="rounded-2xl p-4.5 border border-white/[0.08] shadow-lg flex flex-col gap-3.5"
          style={{
            background: 'var(--color-surface, #2e3432)',
          }}
        >
          {/* Номер и подзаголовок */}
          <div className="flex items-center justify-between">
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: 'var(--brand-coral)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              УРОК {lesson.id} ИЗ 10
            </span>

            <span className="flex items-center gap-1 text-[11px] font-semibold text-white/50">
              <Clock size={12} />
              <span>~{Math.round(lesson.durationSeconds / 60)} мин</span>
            </span>
          </div>

          {/* Заголовок */}
          <div>
            <h1 className="text-lg font-bold text-white leading-tight m-0">
              {lesson.title}
            </h1>
            <p className="text-xs text-white/60 mt-1 m-0">
              {lesson.subtitle}
            </p>
          </div>

          {/* Краткое резюме */}
          <div
            className="p-3 rounded-xl border border-white/[0.06] text-xs leading-relaxed text-white/85 font-medium"
            style={{
              background: 'rgba(0, 0, 0, 0.22)',
            }}
          >
            {lesson.summary}
          </div>

          {/* Тезисы и навыки */}
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider">
              Что освоишь в уроке:
            </span>
            <ul className="m-0 p-0 pl-4 space-y-1.5 text-xs text-white/75 leading-normal">
              {lesson.description.map((item, idx) => (
                <li key={idx} className="marker:text-[var(--brand-mint)]">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Интерактивная консоль Rekordbox для Урока 1 */}
          {lesson.id === 1 && (
            <button
              type="button"
              onClick={() => {
                haptic('heavy');
                setDeckModalOpen(true);
              }}
              className="mt-1 w-full py-3 px-4 rounded-xl font-bold text-sm text-[#11322a] bg-[var(--brand-mint)] hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md shadow-[rgba(140,226,200,0.2)]"
            >
              <Sliders size={18} />
              <span>Встать за пульт Rekordbox</span>
            </button>
          )}
        </div>

        {/* ── БЛОК ЗАВЕРШЕНИЯ УРОКА ── */}
        <div className="mt-auto pt-2 flex flex-col gap-2">
          <button
            type="button"
            disabled={!canComplete || isFinishing}
            onClick={handleCompleteClick}
            className={`w-full py-3.5 px-5 rounded-2xl font-bold text-[15px] transition-all duration-200 flex items-center justify-center gap-2 select-none ${
              canComplete
                ? 'bg-gradient-to-r from-[var(--brand-mint)] to-[var(--brand-coral)] text-[#11322a] cursor-pointer shadow-lg shadow-[rgba(140,226,200,0.25)] active:scale-[0.98]'
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

          {/* Статус-подсказка под кнопкой */}
          <div className="text-center text-[11.5px] font-medium text-white/50 min-h-[18px]">
            {alreadyCompleted ? (
              <span className="text-[var(--brand-mint)]">Урок уже зачтён в твоём профиле</span>
            ) : canComplete ? (
              <span className="text-[var(--brand-mint)]">Видео досмотрено! Нажми, чтобы зафиксировать прогресс</span>
            ) : (
              <span>Досмотри видео до конца, чтобы завершить урок</span>
            )}
          </div>
        </div>
      </main>

      {/* Интерактивный виртуальный пульт Rekordbox для практики */}
      <HorizontalDeckModal
        isOpen={deckModalOpen}
        onClose={() => setDeckModalOpen(false)}
        lesson={fallbackLessonForDeck}
      />
    </div>
  );
}
