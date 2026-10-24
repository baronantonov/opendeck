import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, COURSE_LESSONS } from '../state/store';
import { useCourseProgress } from '../state/CourseProgressContext';
import { isLessonUnlocked, mentorPrices } from '../lib/constants';
import { ProgressBar, Star } from '../components/ui';
import { useToast } from '../components/Toast';
import { MentorPay } from '../payment/Paywall';
import { PaywallModal } from '../components/PaywallModal';
import { haptic } from '../lib/theme';
import {
  ChevronDown,
  CheckCircle2,
  Lock,
  Play,
  Headphones,
  Sparkles,
  Clock,
  Flame,
  Sliders,
  Award,
  Gift,
} from 'lucide-react';
import { useRegisterModal } from '../lib/navigation';
import { GiftCourseModal } from '../components/GiftCourseModal';
import { StaggerContainer, StaggerItem, ShimmerButton } from '../components/MotionWrappers';
import { AbstractGeometryBg } from '../components/LiquidGlassGeometry';

export function LearningScreen() {
  const navigate = useNavigate();
  const { user, course, isPaid, adminMode } = useApp();
  const { guardLessonAccess } = useCourseProgress();
  const { toast } = useToast();
  const [mentorOpen, setMentorOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['pocket-dj']));
  const [shakingCard, setShakingCard] = useState<string | null>(null);

  useRegisterModal('learn-mentor-modal', mentorOpen, () => setMentorOpen(false));

  const { discountUsd, discountRub, finalUsd, finalRub, cappedGp } = mentorPrices(user.groovePoints);

  const dc = course.completedLessons.length;
  const tc = COURSE_LESSONS.length;
  const progressPct = Math.min(100, Math.round((dc / tc) * 100));
  const hasFullAccess = isPaid || adminMode;

  const handleOpenLesson = (index: number) => {
    haptic('light');
    const access = guardLessonAccess(index);

    if (!access.allowed) {
      if (access.reason === 'needs_paywall') {
        setPaywallOpen(true);
      } else {
        toast('🔒', 'Сначала заверши предыдущий урок');
      }
      return;
    }

    navigate(`/lesson/${index + 1}`);
  };

  const toggleSection = (sectionKey: string) => {
    haptic('light');
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
  };

  const handleLockedCardClick = (cardId: string) => {
    haptic('light');
    setShakingCard(cardId);
    setTimeout(() => {
      setShakingCard((current) => (current === cardId ? null : current));
    }, 500);
  };

  const isPocketDjOpen = openSections.has('pocket-dj');
  const isMentorOpen = openSections.has('mentor');

  return (
    <div
      className="flex w-full max-w-full flex-col gap-4 px-4 pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-[calc(env(safe-area-inset-bottom,0px)+96px)] select-none"
      style={{
        paddingTop:
          'calc(max(env(safe-area-inset-top, 0px), var(--app-safe-top, 0px), var(--safe-top, 0px)) + 16px)',
      }}
    >
      <StaggerContainer stepMs={60} className="gap-4">
        {/* 0. ВЕРХНИЙ СТЕКЛЯННЫЙ ПИЛЛ СТАТУСА С МЯГКИМ ПУЛЬСИРУЮЩИМ ИНДИКАТОРОМ */}
        <StaggerItem index={0}>
          <div
            className="flex items-center justify-between gap-2 rounded-full px-4 py-2.5 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),0_8px_24px_rgba(0,0,0,0.38)]"
            style={{
              background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="animate-organic-pulse inline-block h-2 w-2 rounded-full shrink-0"
                style={{
                  background: 'var(--brand-mint)',
                  boxShadow: '0 0 8px var(--brand-mint)',
                }}
              />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--brand-mint)] whitespace-nowrap truncate">
                {hasFullAccess ? 'PRO ДОСТУП' : 'БАЗОВЫЙ ДОСТУП'}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-extrabold text-[var(--color-text)] whitespace-nowrap">
                {dc} / {tc}
              </span>
              <div
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
                style={{
                  background: 'color-mix(in srgb, var(--brand-gold) 15%, var(--color-surface-2))',
                }}
              >
                <Star size={12} />
                <span className="text-[var(--brand-gold)] font-extrabold whitespace-nowrap">{user.groovePoints} GP</span>
              </div>
            </div>
          </div>
        </StaggerItem>

        {/* 1. КАРТОЧКА «Pocket DJ» (АКТИВНЫЙ КУРС ИЗ 10 ПОСЛЕДОВАТЕЛЬНЫХ УРОКОВ) */}
        <StaggerItem index={1}>
          <div
            className="relative w-full overflow-hidden rounded-3xl backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_14px_36px_rgba(0,0,0,0.44)] transition-all duration-200"
            style={{
              background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
            }}
          >
            <AbstractGeometryBg variant="hero" spheres={1} accent="mint" />

            {/* Шапка спойлера */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleSection('pocket-dj')}
              className="relative z-10 flex cursor-pointer flex-col gap-3 p-5 active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[var(--brand-mint)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.16)]"
                      style={{
                        background: 'color-mix(in srgb, var(--brand-mint) 15%, var(--color-surface-2))',
                      }}
                    >
                      <Headphones size={20} />
                    </div>
                    <div>
                      <h2 className="m-0 text-xl font-extrabold tracking-tight text-[var(--color-text)]">
                        Pocket DJ
                      </h2>
                      <div className="text-xs font-semibold text-[var(--brand-mint)]">
                        10 последовательных уроков
                      </div>
                    </div>
                  </div>
                  <p className="m-0 mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
                    Базовый курс сведения треков на смартфоне без дорогого оборудования.
                  </p>
                </div>

                <div
                  className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl transition-colors duration-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
                  style={{
                    background: isPocketDjOpen
                      ? 'color-mix(in srgb, var(--brand-mint) 16%, var(--color-surface-2))'
                      : 'color-mix(in srgb, var(--color-surface-2) 65%, transparent)',
                    color: isPocketDjOpen ? 'var(--brand-mint)' : 'var(--color-text-dim)',
                  }}
                >
                  <ChevronDown
                    size={18}
                    className={`transition-transform duration-300 ease-out ${
                      isPocketDjOpen ? 'rotate-180' : 'rotate-0'
                    }`}
                  />
                </div>
              </div>

              {/* Шкала прогресса */}
              <div className="flex flex-col gap-1.5 pt-0.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-[var(--color-text)]">
                    {dc} из {tc} уроков пройдено
                  </span>
                  <span className="text-[var(--brand-mint)]">{progressPct}%</span>
                </div>
                <ProgressBar value={progressPct} />
              </div>
            </div>

            {/* Выпадающее содержимое спойлера (без горизонтальных полос border-t) */}
            <div className={`accordion-grid relative z-10 ${isPocketDjOpen ? 'open' : ''}`}>
              <div className="accordion-content-overflow">
                <div className="flex flex-col gap-4 px-4 pb-4 pt-1">
                  {/* Плашка разблокировки полного курса / подарка */}
                  <div
                    className="flex flex-col gap-3 rounded-2xl p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
                    style={{
                      background: 'color-mix(in srgb, var(--brand-coral) 10%, var(--color-surface-2))',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[13.5px] font-extrabold text-[var(--brand-coral)]">
                        {hasFullAccess ? 'Подарить курс «Pocket DJ»' : 'Полный курс и практика'}
                      </span>
                      <span className="text-[13.5px] font-extrabold text-[var(--brand-gold)]">
                        2 500 Stars
                      </span>
                    </div>
                    <p className="m-0 text-xs leading-relaxed text-[var(--color-text-dim)]">
                      {hasFullAccess
                        ? 'Подари доступ другу в Telegram: 10 уроков сведения, виртуальная дека и закрытый DJ Camp.'
                        : 'Уроки 1 и 2 открыты бесплатно. Разблокируй все 10 уроков, тренажер и доступ в Camp.'}
                    </p>
                    <div className="flex flex-col gap-2.5">
                      {!hasFullAccess && (
                        <ShimmerButton
                          variant="coral"
                          block
                          shimmer
                          hapticFeedback="light"
                          onClick={() => setPaywallOpen(true)}
                          className="h-13 py-3.5 rounded-2xl text-[15px] sm:text-base font-bold whitespace-nowrap"
                        >
                          <Sparkles size={18} className="shrink-0" />
                          <span className="whitespace-nowrap">Открыть курс · 2 500 Stars</span>
                        </ShimmerButton>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          haptic('light');
                          setGiftOpen(true);
                        }}
                        className="inline-flex h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl py-3.5 px-4 text-base font-bold text-[var(--brand-coral)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)] active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
                        style={{
                          background: 'color-mix(in srgb, var(--brand-coral) 14%, var(--color-surface))',
                        }}
                      >
                        <Gift size={18} />
                        <span>Подарить курс другу</span>
                      </button>
                    </div>
                  </div>

                  {/* Список 10 последовательных уроков */}
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-text-dim)]">
                        Уроки основной траектории
                      </span>
                      <span className="text-[11px] font-semibold text-[var(--color-text-dim)]">
                        10 уроков
                      </span>
                    </div>

                    {COURSE_LESSONS.map((lesson, idx) => {
                      const stepNumber = idx + 1;
                      const completed = course.completedLessons.includes(stepNumber);
                      const status = isLessonUnlocked(idx, course.completedLessons, isPaid, adminMode);
                      const unlocked = status.unlocked;
                      const isCurrent =
                        unlocked && !completed && (idx === 0 || course.completedLessons.includes(idx));
                      const isPaidLesson = idx >= 2;
                      const showPaywallBadge = isPaidLesson && !isPaid && !adminMode;

                      return (
                        <div
                          key={`course-lesson-${idx}`}
                          onClick={() => handleOpenLesson(idx)}
                          role="button"
                          tabIndex={0}
                          className="flex w-full cursor-pointer items-center gap-2.5 rounded-2xl p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
                          style={{
                            background: isCurrent
                              ? 'color-mix(in srgb, var(--brand-mint) 12%, var(--color-surface-2))'
                              : showPaywallBadge
                                ? 'color-mix(in srgb, var(--brand-coral) 6%, var(--color-surface-2))'
                                : 'color-mix(in srgb, var(--color-surface-2) 30%, transparent)',
                            opacity: !unlocked && !showPaywallBadge ? 0.65 : 1,
                          }}
                        >
                          {/* Индикатор шага */}
                          <div
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-extrabold shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)]"
                            style={{
                              background: completed
                                ? 'var(--brand-mint)'
                                : isCurrent
                                  ? 'color-mix(in srgb, var(--brand-mint) 22%, var(--color-surface))'
                                  : showPaywallBadge
                                    ? 'color-mix(in srgb, var(--brand-coral) 16%, transparent)'
                                    : 'rgba(255, 255, 255, 0.05)',
                              color: completed
                                ? '#11322a'
                                : isCurrent
                                  ? 'var(--brand-mint)'
                                  : showPaywallBadge
                                    ? 'var(--brand-coral)'
                                    : 'var(--color-text-dim)',
                            }}
                          >
                            {completed ? (
                              <CheckCircle2 size={18} strokeWidth={2.5} />
                            ) : showPaywallBadge || !unlocked ? (
                              <Lock size={15} />
                            ) : isCurrent ? (
                              <Play size={15} fill="currentColor" />
                            ) : (
                              <span>{stepNumber < 10 ? `0${stepNumber}` : stepNumber}</span>
                            )}
                          </div>

                          {/* Текст урока во всю ширину карточки */}
                          <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {completed ? (
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-mint)] whitespace-nowrap">
                                    Пройден ✓
                                  </span>
                                ) : isCurrent ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-mint)] whitespace-nowrap">
                                    <span className="animate-organic-pulse inline-block h-1.5 w-1.5 rounded-full bg-[var(--brand-mint)]" />
                                    Текущий урок
                                  </span>
                                ) : showPaywallBadge ? (
                                  <span
                                    className="rounded-md px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider text-[var(--brand-coral)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] whitespace-nowrap"
                                    style={{
                                      background: 'color-mix(in srgb, var(--brand-coral) 16%, transparent)',
                                    }}
                                  >
                                    Pocket DJ
                                  </span>
                                ) : idx === 0 || idx === 1 ? (
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-mint)] whitespace-nowrap">
                                    Бесплатный урок
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-text-dim)] whitespace-nowrap">
                                    Урок {stepNumber}
                                  </span>
                                )}

                                <span
                                  className="text-[10px] font-bold whitespace-nowrap"
                                  style={{
                                    color: completed ? 'var(--color-text-dim)' : 'var(--brand-gold)',
                                  }}
                                >
                                  +50 GP
                                </span>
                              </div>

                              {/* Компактный статус-пилл в верхней строке */}
                              <div className="shrink-0">
                                {isCurrent ? (
                                  <span
                                    className="inline-flex items-center whitespace-nowrap rounded-lg px-2 py-0.5 text-[10px] font-extrabold text-[#11322a] shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]"
                                    style={{ background: 'var(--brand-mint)' }}
                                  >
                                    Смотреть
                                  </span>
                                ) : showPaywallBadge ? (
                                  <span
                                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-0.5 text-[10px] font-extrabold text-[var(--brand-coral)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
                                    style={{
                                      background: 'color-mix(in srgb, var(--brand-coral) 14%, transparent)',
                                    }}
                                  >
                                    <Lock size={10} />
                                    <span>Открыть</span>
                                  </span>
                                ) : !unlocked ? (
                                  <span className="inline-flex items-center justify-center rounded-lg bg-white/5 p-1 text-[var(--color-text-dim)]">
                                    <Lock size={11} />
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="whitespace-nowrap text-[13px] font-bold leading-snug tracking-[-0.01em] text-[var(--color-text)]">
                              {lesson.t}
                            </div>

                            <div className="whitespace-nowrap text-[11px] leading-snug tracking-[-0.01em] text-[var(--color-text-dim)]">
                              {lesson.d[0]}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </StaggerItem>

        {/* 2. КАРТОЧКА «Beginner DJ» (В РАЗРАБОТКЕ, LIQUID GLASS) */}
        <StaggerItem index={2}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleLockedCardClick('beginner')}
            className="relative w-full cursor-pointer overflow-hidden rounded-3xl p-5 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_12px_32px_rgba(0,0,0,0.38)] active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
            style={{
              background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
            }}
          >
            <AbstractGeometryBg variant="card" spheres={0} accent="mauve" />

            <div className="relative z-10 mb-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className="grid h-9 w-9 place-items-center rounded-xl text-[var(--brand-mauve)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)]"
                  style={{
                    background: 'color-mix(in srgb, var(--brand-mauve) 16%, var(--color-surface-2))',
                  }}
                >
                  <Sliders size={18} />
                </div>
                <h3 className="m-0 text-lg font-extrabold text-[var(--color-text)]">
                  Beginner DJ
                </h3>
              </div>

              <div
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold text-[var(--brand-gold)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)] ${
                  shakingCard === 'beginner' ? 'animate-badge-shake' : ''
                }`}
                style={{
                  background: 'color-mix(in srgb, var(--brand-gold) 14%, var(--color-surface-2))',
                }}
              >
                <Clock size={12} strokeWidth={2.5} />
                <span>В разработке</span>
              </div>
            </div>

            <p className="relative z-10 m-0 mb-3 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
              Перекладываем знания и осваиваем физический контроллер, изучаем устройство и подключение оборудования.
            </p>

            <div className="relative z-10 flex flex-wrap gap-1.5">
              {['Физический контроллер', 'Коммутация и аудиокарта', 'Архитектура сета'].map((tag) => (
                <span
                  key={tag}
                  className="rounded-xl px-2.5 py-1 text-[10.5px] font-semibold text-[var(--color-text-dim)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
                  style={{
                    background: 'color-mix(in srgb, var(--color-surface-2) 60%, transparent)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </StaggerItem>

        {/* 3. КАРТОЧКА «Advanced DJ» (В РАЗРАБОТКЕ, LIQUID GLASS) */}
        <StaggerItem index={3}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleLockedCardClick('advanced')}
            className="relative w-full cursor-pointer overflow-hidden rounded-3xl p-5 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_12px_32px_rgba(0,0,0,0.38)] active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
            style={{
              background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
            }}
          >
            <AbstractGeometryBg variant="card" spheres={0} accent="coral" />

            <div className="relative z-10 mb-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className="grid h-9 w-9 place-items-center rounded-xl text-[var(--brand-coral)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)]"
                  style={{
                    background: 'color-mix(in srgb, var(--brand-coral) 16%, var(--color-surface-2))',
                  }}
                >
                  <Flame size={18} />
                </div>
                <h3 className="m-0 text-lg font-extrabold text-[var(--color-text)]">
                  Advanced DJ
                </h3>
              </div>

              <div
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold text-[var(--brand-gold)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)] ${
                  shakingCard === 'advanced' ? 'animate-badge-shake' : ''
                }`}
                style={{
                  background: 'color-mix(in srgb, var(--brand-gold) 14%, var(--color-surface-2))',
                }}
              >
                <Clock size={12} strokeWidth={2.5} />
                <span>В разработке</span>
              </div>
            </div>

            <p className="relative z-10 m-0 mb-3 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
              Фишки и приёмы опытных диджеев, глубокое погружение в плотные слои вайба и работа с танцполом.
            </p>

            <div className="relative z-10 flex flex-wrap gap-1.5">
              {['Креативный лайв-миксинг', 'Работа с аудиторией', 'Собственный почерк'].map((tag) => (
                <span
                  key={tag}
                  className="rounded-xl px-2.5 py-1 text-[10.5px] font-semibold text-[var(--color-text-dim)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
                  style={{
                    background: 'color-mix(in srgb, var(--color-surface-2) 60%, transparent)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </StaggerItem>

        {/* 4. КАРТОЧКА HIGH-TICKET ОФФЕРА «Живое менторство FREEDA» */}
        <StaggerItem index={4}>
          <div
            className="relative w-full overflow-hidden rounded-3xl backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),0_16px_38px_rgba(0,0,0,0.45)] transition-all duration-200"
            style={{
              background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
            }}
          >
            <AbstractGeometryBg variant="mentor" spheres={1} accent="gold" />

            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleSection('mentor')}
              className="relative z-10 flex cursor-pointer flex-col gap-3 p-5 active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
            >
              <div className="flex items-center justify-between gap-2">
                <div
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--brand-gold)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)]"
                  style={{
                    background: 'color-mix(in srgb, var(--brand-gold) 15%, var(--color-surface-2))',
                  }}
                >
                  <Sparkles size={12} />
                  <span>1-НА-1 МЕНТОРСТВО · PREMIUM</span>
                </div>

                <div className="text-[13.5px] font-extrabold text-[var(--brand-gold)]">
                  ${finalUsd} · {finalRub.toLocaleString('ru-RU')} ₽
                </div>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[var(--brand-gold)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.16)]"
                      style={{
                        background: 'color-mix(in srgb, var(--brand-gold) 16%, var(--color-surface-2))',
                      }}
                    >
                      <Award size={20} />
                    </div>
                    <h3 className="m-0 text-lg font-extrabold tracking-tight text-[var(--color-text)]">
                      Живое менторство FREEDA
                    </h3>
                  </div>
                  <p className="m-0 mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
                    4 персональные сессии по 1.5ч с разбором твоих миксов и треком выступлений.
                  </p>
                </div>

                <div
                  className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl transition-colors duration-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
                  style={{
                    background: isMentorOpen
                      ? 'color-mix(in srgb, var(--brand-gold) 18%, var(--color-surface-2))'
                      : 'color-mix(in srgb, var(--color-surface-2) 65%, transparent)',
                    color: isMentorOpen ? 'var(--brand-gold)' : 'var(--color-text-dim)',
                  }}
                >
                  <ChevronDown
                    size={18}
                    className={`transition-transform duration-300 ease-out ${
                      isMentorOpen ? 'rotate-180' : 'rotate-0'
                    }`}
                  />
                </div>
              </div>
            </div>

            <div className={`accordion-grid relative z-10 ${isMentorOpen ? 'open' : ''}`}>
              <div className="accordion-content-overflow">
                <div className="flex flex-col gap-3.5 px-5 pb-5 pt-1">
                  <p className="m-0 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
                    Индивидуальная работа с основателем школы FREEDA DJ: разбор каждого твоего перехода, постановка слуха и чувства тайминга, построение драматургии сета и подготовка к первому живому выступлению.
                  </p>

                  <div className="flex flex-col gap-2">
                    {[
                      '4 персональные сессии по 90 минут в Zoom/Telegram',
                      'Глубокий аудит твоих миксов и техники сведения',
                      'Персональная селекция и музыкальная библиотека',
                      'Индивидуальная дорожная карта для первых клубных сетов',
                    ].map((item, i) => (
                      <div
                        key={`mentor-feat-${i}`}
                        className="flex items-center gap-2.5 text-xs text-[var(--color-text)]"
                      >
                        <CheckCircle2 size={15} className="shrink-0 text-[var(--brand-mint)]" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>

                  {/* Расчет цены со скидкой GP без горизонтальных полос */}
                  <div
                    className="flex flex-col gap-2 rounded-2xl p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                    style={{
                      background: 'color-mix(in srgb, var(--color-surface-2) 30%, transparent)',
                    }}
                  >
                    <div className="flex justify-between text-xs text-[var(--color-text-dim)]">
                      <span>Базовая стоимость:</span>
                      <span className={discountUsd > 0 ? 'line-through' : ''}>
                        $250 (23 900 ₽)
                      </span>
                    </div>

                    {discountUsd > 0 && (
                      <div className="flex justify-between text-xs text-[var(--brand-mint)]">
                        <span>Скидка за {cappedGp} GP:</span>
                        <b>−${discountUsd} (−{discountRub.toLocaleString('ru-RU')} ₽)</b>
                      </div>
                    )}

                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[13px] font-extrabold text-[var(--color-text)]">
                        Итого к оплате:
                      </span>
                      <span className="text-base font-extrabold text-[var(--brand-gold)]">
                        ${finalUsd} · {finalRub.toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  </div>

                  <ShimmerButton
                    variant="gradient"
                    block
                    shimmer
                    hapticFeedback="light"
                    onClick={() => setMentorOpen(true)}
                    className="h-13 py-3.5 rounded-2xl text-base font-bold"
                  >
                    <Sparkles size={18} />
                    <span>Записаться на созвоны со скидкой</span>
                  </ShimmerButton>
                </div>
              </div>
            </div>
          </div>
        </StaggerItem>
      </StaggerContainer>

      <MentorPay open={mentorOpen} onClose={() => setMentorOpen(false)} />

      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        courseId="dj-basics"
      />

      <GiftCourseModal
        isOpen={giftOpen}
        onClose={() => setGiftOpen(false)}
        courseId="dj-basics"
        courseTitle="Pocket DJ"
        priceStars={2500}
      />
    </div>
  );
}

export default LearningScreen;
