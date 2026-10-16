import { useState, useMemo } from 'react';
import { useApp, COURSE_LESSONS } from '../state/store';
import { BONUS_LESSONS, mentorPrices } from '../lib/constants';
import { Button, Card, Star } from '../components/ui';
import { useStarsCheckout, MentorPay } from '../payment/Paywall';
import { LessonPlayer } from '../components/LessonPlayer';
import { haptic } from '../lib/theme';

interface TrackItem {
  type: 'course' | 'bonus';
  index: number;
  lesson: (typeof COURSE_LESSONS)[0];
  rewardGp: number;
  tag: string;
  unit: 1 | 2;
}

export function Learn() {
  const { user, course, bonusDone, isPaid, adminMode } = useApp();
  const { checkoutCourse, busy: checkoutBusy } = useStarsCheckout();
  const [mentorOpen, setMentorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'course' | 'bonus'>('all');
  const [selectedLesson, setSelectedLesson] = useState<{
    type: 'course' | 'bonus';
    index: number;
  } | null>(null);

  const { discountUsd, discountRub, finalUsd, finalRub, cappedGp } = mentorPrices(user.groovePoints);

  // Combined Duolingo-style unified path
  const trackItems: TrackItem[] = useMemo(
    () => [
      // UNIT 1: Базовый трек
      {
        type: 'course',
        index: 0,
        lesson: COURSE_LESSONS[0],
        rewardGp: 50,
        tag: '01',
        unit: 1,
      },
      {
        type: 'bonus',
        index: 0,
        lesson: BONUS_LESSONS[0],
        rewardGp: 30,
        tag: 'B1',
        unit: 1,
      },
      {
        type: 'course',
        index: 1,
        lesson: COURSE_LESSONS[1],
        rewardGp: 50,
        tag: '02',
        unit: 1,
      },
      {
        type: 'course',
        index: 2,
        lesson: COURSE_LESSONS[2],
        rewardGp: 50,
        tag: '03',
        unit: 1,
      },
      // UNIT 2: Мастерство и сведение
      {
        type: 'bonus',
        index: 1,
        lesson: BONUS_LESSONS[1],
        rewardGp: 30,
        tag: 'B2',
        unit: 2,
      },
      {
        type: 'course',
        index: 3,
        lesson: COURSE_LESSONS[3],
        rewardGp: 50,
        tag: '04',
        unit: 2,
      },
      {
        type: 'bonus',
        index: 2,
        lesson: BONUS_LESSONS[2],
        rewardGp: 30,
        tag: 'B3',
        unit: 2,
      },
      {
        type: 'course',
        index: 4,
        lesson: COURSE_LESSONS[4],
        rewardGp: 50,
        tag: '05',
        unit: 2,
      },
      {
        type: 'bonus',
        index: 3,
        lesson: BONUS_LESSONS[3],
        rewardGp: 30,
        tag: 'B4',
        unit: 2,
      },
      {
        type: 'course',
        index: 5,
        lesson: COURSE_LESSONS[5],
        rewardGp: 50,
        tag: '06',
        unit: 2,
      },
    ],
    [],
  );

  const isItemCompleted = (item: TrackItem) => {
    if (item.type === 'course') {
      return course.completedLessons.includes(item.index + 1);
    }
    return bonusDone >= item.index + 1;
  };

  const isLesson1Done = course.completedLessons.includes(1);

  const isItemUnlocked = (item: TrackItem) => {
    if (adminMode) return true;
    if (item.type === 'course') {
      if (item.index === 0) return true; // Урок 1 всегда открыт бесплатно
      return isPaid; // Уроки 2-6 открыты после покупки всего курса
    }
    if (item.type === 'bonus') {
      if (item.index === 0) return true; // Бонус 1 (Знакомство) открыт бесплатно
      // Все остальные бонусы открыты сразу после покупки курса и прохождения урока 1:
      return isPaid && isLesson1Done;
    }
    return false;
  };

  const completedCount = trackItems.filter(isItemCompleted).length;
  const totalCount = trackItems.length;

  const filteredItems = trackItems.filter((item) => {
    if (activeTab === 'course') return item.type === 'course';
    if (activeTab === 'bonus') return item.type === 'bonus';
    return true;
  });

  return (
    <div style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Sticky Header with GP & Mentor Discount Info */}
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 18,
          padding: 16,
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-mint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Программа курса · {completedCount}/{totalCount}
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(0,0,0,0.3)',
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

        <h2 style={{ fontSize: 21, margin: '4px 0 6px', fontWeight: 800 }}>
          Обучение и Бонусы
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-dim)', lineHeight: 1.45 }}>
          Проходи уроки, получай GP-баллы и копи скидку на личные созвоны с FREEDA DJ.
        </p>

        {/* Mentor Discount Pill */}
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 12,
            background: 'color-mix(in srgb, var(--brand-mint) 10%, var(--color-surface))',
            border: '1px solid color-mix(in srgb, var(--brand-mint) 20%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--brand-mint)', fontWeight: 700 }}>
              Скидка на созвоны с FREEDA DJ:
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, marginTop: 1 }}>
              −${discountUsd} (−{discountRub.toLocaleString('ru-RU')} ₽) · {user.groovePoints} GP
            </div>
          </div>
          <button
            onClick={() => {
              haptic('medium');
              setMentorOpen(true);
            }}
            style={{
              border: 'none',
              background: 'var(--brand-mint)',
              color: '#11322a',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Созвон
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { id: 'all', label: `Все этапы (${totalCount})` },
          { id: 'course', label: `Уроки (6)` },
          { id: 'bonus', label: `Бонусы Фриды (4)` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              haptic('light');
              setActiveTab(tab.id as any);
            }}
            style={{
              flex: 1,
              border: '1px solid',
              borderColor: activeTab === tab.id ? 'var(--brand-mauve)' : 'rgba(255,255,255,0.06)',
              borderRadius: 10,
              padding: '8px 6px',
              fontSize: 11.5,
              fontWeight: activeTab === tab.id ? 700 : 500,
              background: activeTab === tab.id ? 'var(--brand-mauve)' : 'var(--color-surface)',
              color: activeTab === tab.id ? '#1d1f1e' : 'var(--color-text-dim)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Paywall Banner if course is locked */}
      {!isPaid && !adminMode && (
        <Card
          strip
          style={{
            borderColor: 'color-mix(in srgb, var(--brand-coral) 35%, transparent)',
            background: 'var(--color-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--brand-coral)' }}>
              Полный курс и практика
            </span>
            <span style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--brand-gold)' }}>
              2 500 Stars
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-dim)', marginBottom: 12, lineHeight: 1.45 }}>
            Урок 1 и первый бонус открыты бесплатно. Разблокируй все остальные уроки сведения и 3 бонусных урока от FREEDA DJ за 2 500 Stars, чтобы собрать сет и накопить скидку на личный созвон.
          </div>
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

      {/* Duolingo Tree Track */}
      <div style={{ position: 'relative', marginTop: 8, paddingBottom: 16 }}>
        {/* Center Connecting Track Line */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 24,
            bottom: 40,
            width: 3,
            transform: 'translateX(-50%)',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 99,
            zIndex: 0,
          }}
        />

        {filteredItems.map((item, idx) => {
          const completed = isItemCompleted(item);
          const unlocked = isItemUnlocked(item);
          const isBonus = item.type === 'bonus';

          // Zig-zag offset for Duolingo feel
          const offsets = [0, -32, 0, 32, -32, 0, 32, -32, 0, 32];
          const offset = activeTab === 'all' ? offsets[idx % offsets.length] : 0;

          return (
            <div
              key={`${item.type}-${item.index}`}
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginBottom: 28,
                transform: `translateX(${offset}px)`,
                transition: 'transform 0.3s ease',
              }}
            >
              {/* Duolingo Circular Node */}
              <button
                onClick={() => {
                  haptic('medium');
                  setSelectedLesson({
                    type: item.type,
                    index: item.index,
                  });
                }}
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  border: completed
                    ? '2px solid var(--brand-mint)'
                    : unlocked
                      ? isBonus
                        ? '2px solid var(--brand-coral)'
                        : '2px solid var(--brand-mauve)'
                      : '2px solid rgba(255, 255, 255, 0.12)',
                  background: completed
                    ? 'color-mix(in srgb, var(--brand-mint) 15%, var(--color-surface))'
                    : unlocked
                      ? 'var(--color-surface)'
                      : 'rgba(255, 255, 255, 0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                {completed ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--brand-mint)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : unlocked ? (
                  <span style={{ fontSize: 15, fontWeight: 800, color: isBonus ? 'var(--brand-coral)' : 'var(--brand-mauve)' }}>
                    {item.tag}
                  </span>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                )}

                {/* Top Mini Pill Badge */}
                <span
                  style={{
                    position: 'absolute',
                    top: -8,
                    background: isBonus ? 'var(--brand-coral)' : completed ? 'var(--brand-mint)' : 'var(--brand-mauve)',
                    color: isBonus ? '#fff' : '#1d1f1e',
                    fontSize: 9,
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: 99,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {isBonus ? 'БОНУС' : `УРОК ${item.index + 1}`}
                </span>
              </button>

              {/* Label & Reward Pill Below Node */}
              <div
                onClick={() => {
                  haptic('light');
                  setSelectedLesson({ type: item.type, index: item.index });
                }}
                style={{
                  marginTop: 8,
                  maxWidth: 220,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: unlocked ? 'var(--color-text)' : 'var(--color-text-dim)',
                    lineHeight: 1.25,
                  }}
                >
                  {item.lesson.t}
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    marginTop: 3,
                    padding: '2px 8px',
                    borderRadius: 99,
                    background: completed
                      ? 'color-mix(in srgb, var(--brand-mint) 12%, transparent)'
                      : 'rgba(255, 255, 255, 0.05)',
                    fontSize: 11,
                    fontWeight: 700,
                    color: completed
                      ? 'var(--brand-mint)'
                      : unlocked
                        ? 'var(--brand-gold)'
                        : 'var(--color-text-dim)',
                  }}
                >
                  {completed
                    ? 'Пройдено'
                    : unlocked
                      ? `+${item.rewardGp} GP к скидке`
                      : isBonus && isPaid && !isLesson1Done
                        ? 'Пройди Урок 1 для открытия'
                        : 'Требуется доступ'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* End of Track: Buy Frida DJ Mentorship & Calls */}
      <div
        style={{
          marginTop: 12,
          borderRadius: 18,
          padding: 18,
          background: 'var(--color-surface)',
          border: '1px solid color-mix(in srgb, var(--brand-gold) 30%, transparent)',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'color-mix(in srgb, var(--brand-gold) 15%, var(--color-surface))',
              border: '1px solid color-mix(in srgb, var(--brand-gold) 30%, transparent)',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
              fontSize: 11,
              color: 'var(--brand-gold)',
              letterSpacing: '0.06em',
              flexShrink: 0,
            }}
          >
            MENTOR
          </div>
          <div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: 'var(--brand-gold)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              ФИНАЛ ТРЕКА · НАСТАВНИЧЕСТВО
            </span>
            <h3 style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 800 }}>
              Личные созвоны с FREEDA DJ
            </h3>
          </div>
        </div>

        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--color-text-dim)', lineHeight: 1.5 }}>
          4 персональные онлайн-сессии по 1.5ч с FREEDA DJ: разбор твоих миксов, постановка техники, сведение и дорожная карта выступлений.
        </p>

        {/* Pricing & GP Discount Breakdown */}
        <div
          style={{
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--color-text-dim)' }}>
            <span>Базовая цена созвонов:</span>
            <span style={{ textDecoration: discountUsd > 0 ? 'line-through' : 'none' }}>
              $250 (23 900 ₽)
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--brand-mint)' }}>
            <span>Твоя скидка за {cappedGp} GP:</span>
            <b>−${discountUsd} (−{discountRub.toLocaleString('ru-RU')} ₽)</b>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 8,
              borderTop: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 13.5 }}>Итого со скидкой:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--brand-gold)' }}>
                ${finalUsd} · {finalRub.toLocaleString('ru-RU')} ₽
              </span>
            </div>
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

      {/* Lesson Drawer / Modal when clicked */}
      {selectedLesson && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
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
              padding: '20px 16px 28px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>
                {selectedLesson.type === 'bonus' ? 'Бонус-урок от FREEDA DJ' : `Урок ${selectedLesson.index + 1}`}
              </div>
              <button
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
              locked={!isItemUnlocked({
                type: selectedLesson.type,
                index: selectedLesson.index,
                lesson: selectedLesson.type === 'course' ? COURSE_LESSONS[selectedLesson.index] : BONUS_LESSONS[selectedLesson.index],
                rewardGp: selectedLesson.type === 'course' ? 50 : 30,
                tag: selectedLesson.type === 'course' ? `0${selectedLesson.index + 1}` : `B${selectedLesson.index + 1}`,
                unit: 1,
              })}
              onUnlock={() => {
                setSelectedLesson(null);
                void checkoutCourse('dj-basics');
              }}
            />
          </div>
        </div>
      )}

      {/* Paywalls */}
      <MentorPay open={mentorOpen} onClose={() => setMentorOpen(false)} />
    </div>
  );
}
