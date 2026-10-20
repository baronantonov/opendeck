import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, COURSE_LESSONS } from '../state/store';
import { useCourseProgress } from '../state/CourseProgressContext';
import { isLessonUnlocked, mentorPrices } from '../lib/constants';
import { Button, ProgressBar, Star } from '../components/ui';
import { useToast } from '../components/Toast';
import { useStarsCheckout, MentorPay } from '../payment/Paywall';
import { haptic } from '../lib/theme';
import {
  ChevronDown,
  CheckCircle2,
  Lock,
  Play,
  Sparkles,
  Clock,
  Headphones,
  Sliders,
  Flame,
  Award,
  Gift,
} from 'lucide-react';
import { useRegisterModal } from '../lib/navigation';
import { GiftCourseModal } from '../components/GiftCourseModal';

export function Learn() {
  const navigate = useNavigate();
  const { user, course, isPaid, adminMode } = useApp();
  const { guardLessonAccess, verifyIntegrity } = useCourseProgress();
  const { toast } = useToast();
  const { checkoutCourse, busy: checkoutBusy } = useStarsCheckout();
  const [mentorOpen, setMentorOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);

  // Состояние открытых карточек-спойлеров (Pocket DJ развернут по умолчанию)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['pocket-dj']));

  // Состояние покачивания (shake-эффект) для карточек в разработке
  const [shakingCard, setShakingCard] = useState<string | null>(null);

  useRegisterModal('learn-mentor-modal', mentorOpen, () => setMentorOpen(false));

  const { discountUsd, discountRub, finalUsd, finalRub, cappedGp } = mentorPrices(user.groovePoints);

  // Прогресс основного курса
  const dc = course.completedLessons.length;
  const tc = COURSE_LESSONS.length;
  const progressPct = Math.round((dc / tc) * 100);

  const handleOpenLesson = (index: number) => {
    // 1. Криптографическая проверка доступа через SecurityGuard
    const guard = guardLessonAccess(index);
    if (!guard.allowed) {
      haptic('warning');
      if (guard.reason === 'tampered') {
        toast('🔒', 'Нарушена цифровая подпись. Доступ ограничен');
        verifyIntegrity();
        void checkoutCourse('dj-basics');
        return;
      }
      if (guard.reason === 'needs_paywall') {
        void checkoutCourse('dj-basics');
        return;
      }
      toast('🔒', 'Сначала заверши предыдущий урок');
      return;
    }

    // 2. Стандартная проверка разблокировки
    const status = isLessonUnlocked(index, course.completedLessons, isPaid, adminMode);
    if (!status.unlocked) {
      haptic('warning');
      if (status.reason === 'needs_paywall') {
        void checkoutCourse('dj-basics');
      } else {
        toast('🔒', 'Сначала заверши предыдущий урок');
      }
      return;
    }

    haptic('medium');
    navigate(`/lesson/${index + 1}`);
  };

  // Переключение активных спойлеров
  const toggleSection = (sectionId: string) => {
    haptic('light');
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Клик по неактивным спойлерам в разработке
  const handleLockedCardClick = (cardId: string) => {
    haptic('warning');
    setShakingCard(cardId);
    setTimeout(() => {
      setShakingCard((current) => (current === cardId ? null : current));
    }, 500);
  };

  const isPocketDjOpen = openSections.has('pocket-dj');
  const isMentorOpen = openSections.has('mentor');

  return (
    <div
      className="w-full max-w-full overflow-x-hidden box-border"
      style={{
        width: '100%',
        maxWidth: '100%',
        padding: '16px 16px calc(var(--tabbar-height, 68px) + var(--app-safe-bottom, 16px) + 24px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxSizing: 'border-box',
      }}
    >
      {/* ──────────────── КАРТОЧКА 1: «Pocket DJ» (АКТИВНЫЙ БАЗОВЫЙ КУРС) ──────────────── */}
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 20,
          border: isPocketDjOpen
            ? '1.5px solid color-mix(in srgb, var(--brand-mint) 35%, transparent)'
            : '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: isPocketDjOpen
            ? '0 6px 20px rgba(140, 226, 200, 0.08)'
            : '0 4px 16px rgba(0, 0, 0, 0.2)',
          boxSizing: 'border-box',
          width: '100%',
          overflow: 'hidden',
          transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
        }}
      >
        {/* Шапка спойлера: Название, краткое описание, индикатор общего прогресса и шеврон */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleSection('pocket-dj')}
          className="active:opacity-90 cursor-pointer select-none"
          style={{
            padding: '16px 16px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* Верхняя строка статуса и баланса */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--brand-mint)',
                  boxShadow: '0 0 8px var(--brand-mint)',
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: 'var(--brand-mint)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {isPaid ? 'PRO ДОСТУП · АКТИВЕН' : 'АКТИВНЫЙ БАЗОВЫЙ КУРС'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'rgba(0, 0, 0, 0.35)',
                  padding: '3px 8px',
                  borderRadius: 99,
                  fontSize: 11.5,
                  fontWeight: 700,
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <Star size={12} />
                <span style={{ color: 'var(--brand-gold)' }}>{user.groovePoints} GP</span>
              </div>
            </div>
          </div>

          {/* Заголовок курса и шеврон */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Headphones size={20} color="var(--brand-mint)" style={{ flexShrink: 0 }} />
                <h2
                  style={{
                    fontSize: 20,
                    margin: 0,
                    fontWeight: 800,
                    letterSpacing: '-0.3px',
                    color: 'var(--color-text)',
                  }}
                >
                  Pocket DJ
                </h2>
              </div>
              <p
                style={{
                  margin: '5px 0 0',
                  fontSize: 12.5,
                  color: 'var(--color-text-dim)',
                  lineHeight: 1.4,
                }}
              >
                Базовый курс сведения треков на смартфоне без дорогого оборудования.
              </p>
            </div>

            {/* Плавный поворот шеврона при раскрытии */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: isPocketDjOpen
                  ? 'color-mix(in srgb, var(--brand-mint) 15%, transparent)'
                  : 'rgba(255, 255, 255, 0.05)',
                color: isPocketDjOpen ? 'var(--brand-mint)' : 'var(--color-text-dim)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                marginTop: 2,
                transition: 'background 0.25s ease, color 0.25s ease',
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

          {/* Индикатор общего прогресса */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 700 }}>
              <span style={{ color: 'var(--color-text)' }}>
                {dc} из {tc} уроков пройдено
              </span>
              <span style={{ color: 'var(--brand-mint)' }}>{progressPct}%</span>
            </div>
            <ProgressBar value={progressPct} />
          </div>
        </div>

        {/* Выпадающее содержимое спойлера (CSS Grid transition 0fr -> 1fr) */}
        <div className={`accordion-grid ${isPocketDjOpen ? 'open' : ''}`}>
          <div className="accordion-content-overflow">
            <div
              style={{
                padding: '0 16px 18px',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                paddingTop: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {/* Полное описание курса */}
              <p
                style={{
                  margin: 0,
                  fontSize: 12.5,
                  color: 'var(--color-text-dim)',
                  lineHeight: 1.45,
                }}
              >
                Пошаговый трек от первого бита до готового сета на 5 треков. Осваиваем квадратную сетку, фазирование, частоты (EQ) и тренируемся в интерактивной деке.
              </p>

              {/* Баннер разблокировки полного курса и кнопка подарка */}
              <div
                style={{
                  background: 'color-mix(in srgb, var(--brand-coral) 8%, var(--color-surface))',
                  borderRadius: 16,
                  padding: '14px 14px',
                  border: '1px solid color-mix(in srgb, var(--brand-coral) 35%, transparent)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--brand-coral)' }}>
                    {isPaid ? 'Подарить курс «Pocket DJ»' : 'Полный курс и практика'}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--brand-gold)' }}>
                    2 500 Stars
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-text-dim)', margin: 0, lineHeight: 1.4 }}>
                  {isPaid
                    ? 'Подари доступ другу в Telegram: 6 уроков сведения, виртуальная дека и закрытый DJ Camp.'
                    : 'Урок 1 и первый бонус открыты бесплатно. Разблокируй все 6 уроков, тренажер и 4 бонусных видео.'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {!isPaid && !adminMode && (
                    <Button
                      variant="coral"
                      block
                      disabled={checkoutBusy}
                      onClick={() => checkoutCourse('dj-basics')}
                    >
                      {checkoutBusy ? 'Открываем Telegram Stars...' : 'Открыть полный курс · 2 500 Stars'}
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      haptic('light');
                      setGiftOpen(true);
                    }}
                    className="active:scale-[0.98] transition-transform select-none"
                    style={{
                      border: '1px solid color-mix(in srgb, var(--brand-coral) 40%, transparent)',
                      background: 'color-mix(in srgb, var(--brand-coral) 12%, transparent)',
                      color: 'var(--brand-coral)',
                      borderRadius: 14,
                      padding: '10px 16px',
                      fontSize: 13.5,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 7,
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    <Gift size={16} />
                    <span>Подарить курс другу</span>
                  </button>
                </div>
              </div>

              {/* Список 6 уроков курса */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: 'var(--color-text-dim)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Уроки основной траектории
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
                    10 уроков
                  </span>
                </div>

                {COURSE_LESSONS.map((lesson, idx) => {
                  const stepNumber = idx + 1;
                  const completed = course.completedLessons.includes(stepNumber);
                  const status = isLessonUnlocked(idx, course.completedLessons, isPaid, adminMode);
                  const unlocked = status.unlocked;
                  const isCurrent = unlocked && !completed && (idx === 0 || course.completedLessons.includes(idx));
                  const isPaidLesson = idx >= 2;
                  const showPaywallBadge = isPaidLesson && !isPaid && !adminMode;

                  return (
                    <div
                      key={`course-lesson-${idx}`}
                      onClick={() => handleOpenLesson(idx)}
                      role="button"
                      tabIndex={0}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 12px',
                        borderRadius: 14,
                        background: isCurrent
                          ? 'color-mix(in srgb, var(--brand-mint) 7%, var(--color-surface))'
                          : showPaywallBadge
                            ? 'rgba(245, 146, 110, 0.03)'
                            : 'rgba(255, 255, 255, 0.03)',
                        border: isCurrent
                          ? '1.5px solid color-mix(in srgb, var(--brand-mint) 45%, transparent)'
                          : completed
                            ? '1px solid color-mix(in srgb, var(--brand-mint) 20%, transparent)'
                            : showPaywallBadge
                              ? '1px solid color-mix(in srgb, var(--brand-coral) 20%, transparent)'
                              : '1px solid rgba(255, 255, 255, 0.06)',
                        boxShadow: isCurrent ? '0 4px 16px rgba(140, 226, 200, 0.1)' : 'none',
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                        width: '100%',
                        opacity: !unlocked && !showPaywallBadge ? 0.6 : 1,
                        transition: 'transform 0.15s ease, background 0.15s ease',
                        userSelect: 'none',
                      }}
                      className="active:scale-[0.99]"
                    >
                      {/* Индикатор шага */}
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          flexShrink: 0,
                          display: 'grid',
                          placeItems: 'center',
                          background: completed
                            ? 'var(--brand-mint)'
                            : isCurrent
                              ? 'color-mix(in srgb, var(--brand-mint) 18%, var(--color-surface))'
                              : showPaywallBadge
                                ? 'color-mix(in srgb, var(--brand-coral) 12%, transparent)'
                                : 'rgba(255, 255, 255, 0.04)',
                          color: completed
                            ? '#11322a'
                            : isCurrent
                              ? 'var(--brand-mint)'
                              : showPaywallBadge
                                ? 'var(--brand-coral)'
                                : 'var(--color-text-dim)',
                          border: isCurrent
                            ? '1.5px solid var(--brand-mint)'
                            : showPaywallBadge
                              ? '1px solid color-mix(in srgb, var(--brand-coral) 30%, transparent)'
                              : '1px solid rgba(255, 255, 255, 0.08)',
                          fontWeight: 800,
                          fontSize: 14,
                        }}
                      >
                        {completed ? (
                          <CheckCircle2 size={20} strokeWidth={2.5} />
                        ) : showPaywallBadge ? (
                          <Lock size={16} />
                        ) : !unlocked ? (
                          <Lock size={16} />
                        ) : isCurrent ? (
                          <Play size={16} fill="currentColor" />
                        ) : (
                          <span>{stepNumber < 10 ? `0${stepNumber}` : stepNumber}</span>
                        )}
                      </div>

                      {/* Текст урока */}
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          {completed ? (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                color: 'var(--brand-mint)',
                              }}
                            >
                              Пройден ✓
                            </span>
                          ) : isCurrent ? (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                color: 'var(--brand-mint)',
                              }}
                            >
                              Текущий урок
                            </span>
                          ) : showPaywallBadge ? (
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 800,
                                color: 'var(--brand-coral)',
                                background: 'color-mix(in srgb, var(--brand-coral) 12%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--brand-coral) 30%, transparent)',
                                padding: '1px 6px',
                                borderRadius: 6,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                              }}
                            >
                              Pocket DJ
                            </span>
                          ) : idx === 0 || idx === 1 ? (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                color: 'var(--brand-mint)',
                              }}
                            >
                              Бесплатный урок
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                color: 'var(--color-text-dim)',
                              }}
                            >
                              Урок {stepNumber}
                            </span>
                          )}

                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: completed ? 'var(--color-text-dim)' : 'var(--brand-gold)',
                            }}
                          >
                            +50 GP
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: 'var(--color-text)',
                            lineHeight: 1.25,
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                          }}
                        >
                          {lesson.t}
                        </div>

                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--color-text-dim)',
                            marginTop: 2,
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                          }}
                        >
                          {lesson.d[0]}
                        </div>
                      </div>

                      {/* Статус справа */}
                      <div style={{ flexShrink: 0 }}>
                        {isCurrent ? (
                          <div
                            style={{
                              background: 'var(--brand-mint)',
                              color: '#11322a',
                              fontWeight: 800,
                              fontSize: 11,
                              padding: '5px 10px',
                              borderRadius: 8,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Смотреть
                          </div>
                        ) : showPaywallBadge ? (
                          <div
                            style={{
                              background: 'color-mix(in srgb, var(--brand-coral) 12%, transparent)',
                              color: 'var(--brand-coral)',
                              border: '1px solid color-mix(in srgb, var(--brand-coral) 30%, transparent)',
                              padding: '5px 8px',
                              borderRadius: 8,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11,
                              fontWeight: 800,
                            }}
                          >
                            <Lock size={12} />
                            <span>Открыть</span>
                          </div>
                        ) : !unlocked ? (
                          <div
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              color: 'var(--color-text-dim)',
                              padding: '5px 7px',
                              borderRadius: 8,
                              display: 'grid',
                              placeItems: 'center',
                            }}
                          >
                            <Lock size={14} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────── КАРТОЧКА 2: «Beginner DJ» (НЕАКТИВНАЯ ВКЛАДКА В РАЗРАБОТКЕ) ──────────────── */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => handleLockedCardClick('beginner')}
        className="active:opacity-85 select-none"
        style={{
          background: 'color-mix(in srgb, var(--color-surface) 92%, #000)',
          borderRadius: 20,
          padding: '16px 16px',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          boxSizing: 'border-box',
          width: '100%',
          cursor: 'pointer',
          opacity: 0.78,
          transition: 'transform 0.15s ease, opacity 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sliders size={18} color="var(--brand-mauve)" />
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--color-text)' }}>
              Beginner DJ
            </h3>
          </div>

          {/* Бейдж «В разработке» с иконкой и шейк-анимацией при клике */}
          <div
            className={shakingCard === 'beginner' ? 'animate-badge-shake' : ''}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 9px',
              borderRadius: 99,
              background: 'rgba(243, 201, 105, 0.1)',
              border: '1px solid rgba(243, 201, 105, 0.28)',
              color: 'var(--brand-gold)',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.03em',
            }}
          >
            <Clock size={12} strokeWidth={2.5} />
            <span>В разработке</span>
          </div>
        </div>

        <p
          style={{
            margin: '0 0 12px',
            fontSize: 12.5,
            color: 'var(--color-text-dim)',
            lineHeight: 1.45,
          }}
        >
          Перекладываем знания и осваиваем физический контроллер, изучаем устройство и подключение оборудования.
        </p>

        {/* Чипы программы */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['Физический контроллер', 'Коммутация и аудиокарта', 'Архитектура сета'].map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: 'var(--color-text-dim)',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                padding: '3px 8px',
                borderRadius: 8,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* ──────────────── КАРТОЧКА 3: «Advanced DJ» (НЕАКТИВНАЯ ВКЛАДКА В РАЗРАБОТКЕ) ──────────────── */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => handleLockedCardClick('advanced')}
        className="active:opacity-85 select-none"
        style={{
          background: 'color-mix(in srgb, var(--color-surface) 92%, #000)',
          borderRadius: 20,
          padding: '16px 16px',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          boxSizing: 'border-box',
          width: '100%',
          cursor: 'pointer',
          opacity: 0.78,
          transition: 'transform 0.15s ease, opacity 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Flame size={18} color="var(--brand-coral)" />
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--color-text)' }}>
              Advanced DJ
            </h3>
          </div>

          {/* Бейдж «В разработке» */}
          <div
            className={shakingCard === 'advanced' ? 'animate-badge-shake' : ''}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 9px',
              borderRadius: 99,
              background: 'rgba(243, 201, 105, 0.1)',
              border: '1px solid rgba(243, 201, 105, 0.28)',
              color: 'var(--brand-gold)',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.03em',
            }}
          >
            <Clock size={12} strokeWidth={2.5} />
            <span>В разработке</span>
          </div>
        </div>

        <p
          style={{
            margin: '0 0 12px',
            fontSize: 12.5,
            color: 'var(--color-text-dim)',
            lineHeight: 1.45,
          }}
        >
          Фишки и приёмы опытных диджеев, глубокое погружение в плотные слои вайба.
        </p>

        {/* Чипы программы */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['Креативный лайв-миксинг', 'Работа с аудиторией', 'Собственный почерк'].map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: 'var(--color-text-dim)',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                padding: '3px 8px',
                borderRadius: 8,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* ──────────────── КАРТОЧКА 4: «Живое менторство FREEDA» (АКТИВНЫЙ ПРЕМИАЛЬНЫЙ БЛОК) ──────────────── */}
      <div
        style={{
          borderRadius: 20,
          background: 'color-mix(in srgb, var(--brand-gold) 6%, var(--color-surface))',
          border: isMentorOpen
            ? '1.5px solid color-mix(in srgb, var(--brand-gold) 65%, transparent)'
            : '1px solid color-mix(in srgb, var(--brand-gold) 35%, transparent)',
          boxShadow: isMentorOpen
            ? '0 6px 24px -4px color-mix(in srgb, var(--brand-gold) 25%, transparent)'
            : '0 4px 16px rgba(0, 0, 0, 0.2)',
          boxSizing: 'border-box',
          width: '100%',
          overflow: 'hidden',
          transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
        }}
      >
        {/* Шапка премиального спойлера */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleSection('mentor')}
          className="active:opacity-90 cursor-pointer select-none"
          style={{
            padding: '16px 16px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 10.5,
                fontWeight: 800,
                color: 'var(--brand-gold)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                background: 'rgba(243, 201, 105, 0.12)',
                padding: '3px 8px',
                borderRadius: 99,
                border: '1px solid rgba(243, 201, 105, 0.3)',
              }}
            >
              <Sparkles size={12} color="var(--brand-gold)" />
              <span>1-НА-1 МЕНТОРСТВО · PREMIUM</span>
            </div>

            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand-gold)' }}>
              ${finalUsd} · {finalRub.toLocaleString('ru-RU')} ₽
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Award size={20} color="var(--brand-gold)" style={{ flexShrink: 0 }} />
                <h3
                  style={{
                    margin: 0,
                    fontSize: 19,
                    fontWeight: 800,
                    letterSpacing: '-0.2px',
                    color: 'var(--color-text)',
                  }}
                >
                  Живое менторство FREEDA
                </h3>
              </div>
              <p
                style={{
                  margin: '5px 0 0',
                  fontSize: 12.5,
                  color: 'var(--color-text-dim)',
                  lineHeight: 1.4,
                }}
              >
                4 персональные сессии по 1.5ч с разбором твоих миксов и треком выступлений.
              </p>
            </div>

            {/* Шеврон */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: isMentorOpen
                  ? 'color-mix(in srgb, var(--brand-gold) 20%, transparent)'
                  : 'rgba(255, 255, 255, 0.05)',
                color: 'var(--brand-gold)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                marginTop: 2,
                transition: 'background 0.25s ease',
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

        {/* Раскрывающийся контент менторства (CSS Grid 0fr -> 1fr) */}
        <div className={`accordion-grid ${isMentorOpen ? 'open' : ''}`}>
          <div className="accordion-content-overflow">
            <div
              style={{
                padding: '0 16px 18px',
                borderTop: '1px solid color-mix(in srgb, var(--brand-gold) 20%, transparent)',
                paddingTop: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 12.5,
                  color: 'var(--color-text-dim)',
                  lineHeight: 1.45,
                }}
              >
                Индивидуальная работа с основателем школы FREEDA DJ: разбор каждого твоего перехода, постановка слуха и чувства тайминга, построение драматургии сета и пошаговая подготовка к первому живому выступлению.
              </p>

              {/* Пункты программы менторства */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  '4 персональные сессии по 90 минут в Zoom/Telegram',
                  'Глубокий аудит твоих миксов и техники сведения',
                  'Персональная селекция и музыкальная библиотека',
                  'Индивидуальная дорожная карта для первых клубных сетов',
                ].map((item, i) => (
                  <div
                    key={`mentor-feat-${i}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      color: 'var(--color-text)',
                    }}
                  >
                    <CheckCircle2 size={15} color="var(--brand-mint)" style={{ flexShrink: 0 }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              {/* Блок цены со скидкой GP */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  borderRadius: 14,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-dim)' }}>
                  <span>Базовая стоимость:</span>
                  <span style={{ textDecoration: discountUsd > 0 ? 'line-through' : 'none' }}>
                    $250 (23 900 ₽)
                  </span>
                </div>

                {discountUsd > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--brand-mint)' }}>
                    <span>Скидка за {cappedGp} GP:</span>
                    <b>−${discountUsd} (−{discountRub.toLocaleString('ru-RU')} ₽)</b>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: 8,
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: 13 }}>Итого к оплате:</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--brand-gold)' }}>
                    ${finalUsd} · {finalRub.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </div>

              {/* Целевая кнопка записи */}
              <Button
                variant="gradient"
                block
                onClick={() => {
                  haptic('heavy');
                  setMentorOpen(true);
                }}
              >
                Записаться на созвоны со скидкой
              </Button>
            </div>
          </div>
        </div>
      </div>

              {/* Модалка оплаты менторства */}
              <MentorPay open={mentorOpen} onClose={() => setMentorOpen(false)} />

      {/* Модалка оформления подарка курса */}
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

