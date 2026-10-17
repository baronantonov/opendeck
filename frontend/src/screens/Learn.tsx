import { useState } from 'react';
import { useApp, COURSE_LESSONS } from '../state/store';
import { BONUS_LESSONS, mentorPrices } from '../lib/constants';
import { Button, Card, ProgressBar, Star } from '../components/ui';
import { useStarsCheckout, MentorPay } from '../payment/Paywall';
import { LessonPlayer } from '../components/LessonPlayer';
import { haptic } from '../lib/theme';
import { CheckCircle2, Lock, Play, Sparkles } from 'lucide-react';
import { useRegisterModal } from '../lib/navigation';

export function Learn() {
  const { user, course, bonusDone, isPaid, adminMode } = useApp();
  const { checkoutCourse, busy: checkoutBusy } = useStarsCheckout();
  const [mentorOpen, setMentorOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<{
    type: 'course' | 'bonus';
    index: number;
  } | null>(null);

  useRegisterModal('learn-lesson-modal', selectedLesson !== null, () => setSelectedLesson(null));
  useRegisterModal('learn-mentor-modal', mentorOpen, () => setMentorOpen(false));

  const { discountUsd, discountRub, finalUsd, finalRub, cappedGp } = mentorPrices(user.groovePoints);

  // Прогресс основного курса
  const dc = course.completedLessons.length;
  const tc = COURSE_LESSONS.length;
  const progressPct = Math.round((dc / tc) * 100);

  // Вычисляем индекс текущего активного урока (первый незавершенный открытый)
  const currentLessonIndex = Math.min(dc, tc - 1);

  // Логика разблокировки основного урока
  const isCourseLessonUnlocked = (idx: number): boolean => {
    if (adminMode) return true;
    if (idx === 0) return true; // Урок 1 всегда открыт бесплатно
    return isPaid; // Уроки 2-6 открываются при оплате курса
  };

  // Логика разблокировки бонусных уроков:
  // Бонус 1 (Знакомство) открыт бесплатно всегда.
  // Бонусы 2, 3, 4 открываются мгновенно, как только курс оплачен (isPaid === true).
  const isBonusLessonUnlocked = (idx: number): boolean => {
    if (adminMode) return true;
    if (idx === 0) return true; // Бонус 1 открыт бесплатно
    return isPaid; // Все остальные бонусы открыты сразу после покупки курса
  };

  const handleOpenLesson = (type: 'course' | 'bonus', index: number) => {
    haptic('medium');
    const unlocked = type === 'course' ? isCourseLessonUnlocked(index) : isBonusLessonUnlocked(index);
    if (!unlocked) {
      void checkoutCourse('dj-basics');
      return;
    }
    setSelectedLesson({ type, index });
  };

  return (
    <div
      className="w-full max-w-full overflow-x-hidden box-border"
      style={{
        width: '100%',
        maxWidth: '100%',
        padding: '16px 16px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxSizing: 'border-box',
      }}
    >
      {/* ──────────────── 1. ШАПКА КУРСА: ПРОГРЕСС И БАЛАНС ──────────────── */}
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 20,
          padding: '16px 18px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
          boxSizing: 'border-box',
          width: '100%',
          maxWidth: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: 'var(--brand-mint)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {isPaid ? 'PRO ДОСТУП · ВСЕ УРОКИ' : 'ОСНОВНОЙ КУРС'}
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(0, 0, 0, 0.3)',
              padding: '4px 10px',
              borderRadius: 99,
              fontSize: 12.5,
              fontWeight: 700,
            }}
          >
            <Star size={13} />
            <span style={{ color: 'var(--brand-gold)' }}>{user.groovePoints} GP</span>
          </div>
        </div>

        <h1 style={{ fontSize: 22, margin: '2px 0 6px', fontWeight: 800, letterSpacing: '-0.3px' }}>
          Обучение диджеингу
        </h1>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--color-text-dim)', lineHeight: 1.45 }}>
          Пошаговый трек от первого бита до готового сета на 5 треков.
        </p>

        {/* Прогресс-бар курса */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
            <span style={{ color: 'var(--color-text)' }}>
              {dc} из {tc} уроков пройдено
            </span>
            <span style={{ color: 'var(--brand-mint)' }}>{progressPct}%</span>
          </div>
          <ProgressBar value={progressPct} />
        </div>
      </div>

      {/* ──────────────── 2. БАННЕР РАЗБЛОКИРОВКИ КУРСА (ЕСЛИ ЗАКРЫТ) ──────────────── */}
      {!isPaid && !adminMode && (
        <Card
          strip
          style={{
            borderColor: 'color-mix(in srgb, var(--brand-coral) 35%, transparent)',
            background: 'var(--color-surface)',
            boxSizing: 'border-box',
            width: '100%',
            maxWidth: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--brand-coral)' }}>
              Полный курс и практика
            </span>
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--brand-gold)' }}>
              2 500 Stars
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--color-text-dim)', margin: '0 0 12px', lineHeight: 1.45 }}>
            Урок 1 и первый бонус открыты бесплатно. Открой полный курс, чтобы разблокировать все 6 уроков сведения, 4 бонусных видео и накапливать скидку на личный созвон.
          </p>
          <Button
            variant="coral"
            block
            disabled={checkoutBusy}
            onClick={() => checkoutCourse('dj-basics')}
          >
            {checkoutBusy ? 'Открываем Telegram Stars...' : 'Открыть полный курс · 2 500 Stars'}
          </Button>
        </Card>
      )}

      {/* ──────────────── 3. ОСНОВНОЙ ТРЕК УРОКОВ (ВЕРТИКАЛЬНЫЙ ТАЙМЛАЙН) ──────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Основная траектория
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>
            6 шагов
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', boxSizing: 'border-box' }}>
          {COURSE_LESSONS.map((lesson, idx) => {
            const stepNumber = idx + 1;
            const completed = course.completedLessons.includes(stepNumber);
            const unlocked = isCourseLessonUnlocked(idx);
            const isCurrent = unlocked && !completed && idx === currentLessonIndex;

            return (
              <div
                key={`course-lesson-${idx}`}
                onClick={() => handleOpenLesson('course', idx)}
                role="button"
                tabIndex={0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 14px',
                  borderRadius: 16,
                  background: isCurrent
                    ? 'color-mix(in srgb, var(--brand-mint) 6%, var(--color-surface))'
                    : 'var(--color-surface)',
                  border: isCurrent
                    ? '1.5px solid color-mix(in srgb, var(--brand-mint) 45%, transparent)'
                    : completed
                      ? '1px solid color-mix(in srgb, var(--brand-mint) 20%, transparent)'
                      : '1px solid rgba(255, 255, 255, 0.07)',
                  boxShadow: isCurrent ? '0 4px 16px rgba(140, 226, 200, 0.12)' : 'none',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  width: '100%',
                  maxWidth: '100%',
                  opacity: !unlocked ? 0.6 : 1,
                  transition: 'transform 0.15s ease, background 0.15s ease',
                  userSelect: 'none',
                }}
                className="active:scale-[0.99]"
              >
                {/* Левая колонка: Круглый индикатор шага */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    flexShrink: 0,
                    display: 'grid',
                    placeItems: 'center',
                    background: completed
                      ? 'var(--brand-mint)'
                      : isCurrent
                        ? 'color-mix(in srgb, var(--brand-mint) 18%, var(--color-surface))'
                        : 'rgba(255, 255, 255, 0.05)',
                    color: completed
                      ? '#11322a'
                      : isCurrent
                        ? 'var(--brand-mint)'
                        : 'var(--color-text-dim)',
                    border: isCurrent ? '1.5px solid var(--brand-mint)' : '1px solid rgba(255, 255, 255, 0.08)',
                    fontWeight: 800,
                    fontSize: 15,
                  }}
                >
                  {completed ? (
                    <CheckCircle2 size={22} strokeWidth={2.5} />
                  ) : !unlocked ? (
                    <Lock size={18} />
                  ) : isCurrent ? (
                    <Play size={18} fill="currentColor" />
                  ) : (
                    <span>0{stepNumber}</span>
                  )}
                </div>

                {/* Центральная колонка: Название и описание урока */}
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: completed
                          ? 'var(--brand-mint)'
                          : isCurrent
                            ? 'var(--brand-mint)'
                            : 'var(--color-text-dim)',
                      }}
                    >
                      {completed
                        ? 'Пройден ✓'
                        : isCurrent
                          ? 'Текущий урок'
                          : idx === 0
                            ? 'Бесплатный урок'
                            : `Урок ${stepNumber}`}
                    </span>
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
                      fontSize: 14,
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
                      fontSize: 11.5,
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

                {/* Правая колонка: Статус / Кнопка действия */}
                <div style={{ flexShrink: 0 }}>
                  {isCurrent ? (
                    <div
                      style={{
                        background: 'var(--brand-mint)',
                        color: '#11322a',
                        fontWeight: 800,
                        fontSize: 11.5,
                        padding: '6px 12px',
                        borderRadius: 10,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Смотреть
                    </div>
                  ) : !unlocked ? (
                    <div
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--color-text-dim)',
                        padding: '6px 8px',
                        borderRadius: 10,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <Lock size={15} />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ──────────────── 4. БОНУСНЫЕ УРОКИ (САМОСТОЯТЕЛЬНЫЙ БЛОК) ──────────────── */}
      <div
        style={{
          marginTop: 6,
          background: 'var(--color-surface)',
          borderRadius: 20,
          padding: '16px 16px 18px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxSizing: 'border-box',
          width: '100%',
          maxWidth: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={16} color="var(--brand-coral)" />
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand-coral)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Бонусные материалы
            </span>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: isPaid ? 'var(--brand-mint)' : 'var(--brand-gold)',
              background: 'rgba(0,0,0,0.25)',
              padding: '2px 8px',
              borderRadius: 6,
            }}
          >
            {isPaid ? 'Все 4 открыты ✓' : `${bonusDone}/4 пройдено`}
          </span>
        </div>

        <h3 style={{ margin: '2px 0 4px', fontSize: 17, fontWeight: 800 }}>
          Бонусы от FREEDA DJ
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--color-text-dim)', lineHeight: 1.4 }}>
          Теория музыки, история появления диджеинга, колесо Камелота и выбор оборудования.
        </p>

        {/* Список 4 бонусов */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', boxSizing: 'border-box' }}>
          {BONUS_LESSONS.map((bonus, bIdx) => {
            const completed = bonusDone >= bIdx + 1;
            const unlocked = isBonusLessonUnlocked(bIdx);

            return (
              <div
                key={`bonus-lesson-${bIdx}`}
                onClick={() => handleOpenLesson('bonus', bIdx)}
                role="button"
                tabIndex={0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 12px',
                  borderRadius: 14,
                  background: completed
                    ? 'color-mix(in srgb, var(--brand-mint) 8%, var(--color-surface))'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: completed
                    ? '1px solid color-mix(in srgb, var(--brand-mint) 25%, transparent)'
                    : '1px solid rgba(255, 255, 255, 0.06)',
                  cursor: 'pointer',
                  opacity: !unlocked ? 0.65 : 1,
                  boxSizing: 'border-box',
                  width: '100%',
                  maxWidth: '100%',
                  transition: 'background 0.15s ease',
                  userSelect: 'none',
                }}
                className="active:scale-[0.99]"
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    flexShrink: 0,
                    display: 'grid',
                    placeItems: 'center',
                    background: completed
                      ? 'rgba(140, 226, 200, 0.15)'
                      : unlocked
                        ? 'color-mix(in srgb, var(--brand-coral) 12%, transparent)'
                        : 'rgba(255, 255, 255, 0.04)',
                    color: completed
                      ? 'var(--brand-mint)'
                      : unlocked
                        ? 'var(--brand-coral)'
                        : 'var(--color-text-dim)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  {completed ? (
                    <CheckCircle2 size={18} />
                  ) : !unlocked ? (
                    <Lock size={15} />
                  ) : (
                    <span>B{bIdx + 1}</span>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: bIdx === 0 ? 'var(--brand-mint)' : 'var(--brand-coral)', textTransform: 'uppercase' }}>
                      {bIdx === 0 ? 'Бесплатно' : completed ? 'Пройден' : 'PRO'}
                    </span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--brand-gold)' }}>
                      +30 GP
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--color-text)',
                      marginTop: 1,
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                    }}
                  >
                    {bonus.t}
                  </div>
                </div>

                <div style={{ flexShrink: 0 }}>
                  {unlocked ? (
                    <div style={{ color: 'var(--brand-mint)', display: 'grid', placeItems: 'center' }}>
                      <Play size={16} fill="currentColor" />
                    </div>
                  ) : (
                    <div style={{ color: 'var(--color-text-dim)', display: 'grid', placeItems: 'center' }}>
                      <Lock size={14} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ──────────────── 5. ФИНАЛ: ЛИЧНЫЕ СОЗВОНЫ С FREEDA DJ ──────────────── */}
      <div
        style={{
          borderRadius: 20,
          padding: '16px 18px',
          background: 'var(--color-surface)',
          border: '1px solid color-mix(in srgb, var(--brand-gold) 30%, transparent)',
          boxSizing: 'border-box',
          width: '100%',
          maxWidth: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'color-mix(in srgb, var(--brand-gold) 15%, var(--color-surface))',
              border: '1px solid color-mix(in srgb, var(--brand-gold) 30%, transparent)',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
              fontSize: 10.5,
              color: 'var(--brand-gold)',
              letterSpacing: '0.04em',
              flexShrink: 0,
            }}
          >
            MENTOR
          </div>
          <div>
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--brand-gold)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ФИНАЛ ТРЕКА · НАСТАВНИЧЕСТВО
            </span>
            <h3 style={{ margin: '1px 0 0', fontSize: 16, fontWeight: 800 }}>
              Личные созвоны с FREEDA DJ
            </h3>
          </div>
        </div>

        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--color-text-dim)', lineHeight: 1.45 }}>
          4 персональные сессии по 1.5ч с разбором твоих миксов, постановкой техники и дорожной картой выступлений.
        </p>

        {/* Блок цены со скидкой GP */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: 12,
            padding: '10px 12px',
            marginBottom: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-dim)' }}>
            <span>Базовая цена:</span>
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
              paddingTop: 6,
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 13 }}>Итого:</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--brand-gold)' }}>
              ${finalUsd} · {finalRub.toLocaleString('ru-RU')} ₽
            </span>
          </div>
        </div>

        <Button
          variant="primary"
          block
          onClick={() => {
            haptic('heavy');
            setMentorOpen(true);
          }}
        >
          Записаться на созвоны со скидкой
        </Button>
      </div>

      {/* ──────────────── 6. МОДАЛЬНОЕ ОКНО ПЛЕЕРА УРОКА ──────────────── */}
      {selectedLesson && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.78)',
            backdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            boxSizing: 'border-box',
          }}
          onClick={() => setSelectedLesson(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              background: 'var(--color-surface)',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: '18px 16px 28px',
              maxHeight: 'calc(100vh - var(--safe-top, 0px) - 20px)',
              overflowY: 'auto',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>
                {selectedLesson.type === 'bonus'
                  ? `Бонус ${selectedLesson.index + 1} от FREEDA DJ`
                  : `Урок ${selectedLesson.index + 1}`}
              </div>
              <button
                type="button"
                onClick={() => setSelectedLesson(null)}
                style={{
                  border: 'none',
                  background: 'color-mix(in srgb, var(--color-text) 10%, transparent)',
                  color: 'var(--color-text)',
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <LessonPlayer
              lesson={
                selectedLesson.type === 'course'
                  ? COURSE_LESSONS[selectedLesson.index]
                  : BONUS_LESSONS[selectedLesson.index]
              }
              index={selectedLesson.index}
              courseId={selectedLesson.type === 'course' ? 'dj-basics' : 'dj-bonus'}
              defaultOpen={true}
              locked={
                selectedLesson.type === 'course'
                  ? !isCourseLessonUnlocked(selectedLesson.index)
                  : !isBonusLessonUnlocked(selectedLesson.index)
              }
              onUnlock={() => {
                setSelectedLesson(null);
                void checkoutCourse('dj-basics');
              }}
            />
          </div>
        </div>
      )}

      {/* Модалка оплаты менторства */}
      <MentorPay open={mentorOpen} onClose={() => setMentorOpen(false)} />
    </div>
  );
}
