import { useState, useMemo } from 'react';
import { useApp, COURSE_LESSONS } from '../state/store';
import { BONUS_LESSONS, PRICES, mentorStarsPrice } from '../lib/constants';
import { Button, Card, Star } from '../components/ui';
import { Paywall, MentorPay } from '../payment/Paywall';
import { LessonPlayer } from '../components/LessonPlayer';
import { haptic } from '../lib/theme';

interface TrackItem {
  type: 'course' | 'bonus';
  index: number;
  lesson: (typeof COURSE_LESSONS)[0];
  rewardGp: number;
  icon: string;
  unit: 1 | 2;
}

export function Learn() {
  const { user, course, bonusDone, isPaid, adminMode } = useApp();
  const [payOpen, setPayOpen] = useState(false);
  const [mentorOpen, setMentorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'course' | 'bonus'>('all');
  const [selectedLesson, setSelectedLesson] = useState<{ type: 'course' | 'bonus'; index: number } | null>(null);

  const discount = Math.min(Math.max(user.groovePoints, 0), PRICES.mentor.gpCap);
  const finalStars = mentorStarsPrice(user.groovePoints);

  // Combined Duolingo-style unified path
  const trackItems: TrackItem[] = useMemo(() => [
    // UNIT 1: Базовый трек: от интерфейса к первым миксам
    {
      type: 'course',
      index: 0,
      lesson: COURSE_LESSONS[0],
      rewardGp: 50,
      icon: '🎚️',
      unit: 1,
    },
    {
      type: 'bonus',
      index: 0,
      lesson: BONUS_LESSONS[0],
      rewardGp: 30,
      icon: '🎧',
      unit: 1,
    },
    {
      type: 'course',
      index: 1,
      lesson: COURSE_LESSONS[1],
      rewardGp: 50,
      icon: '⏱️',
      unit: 1,
    },
    {
      type: 'course',
      index: 2,
      lesson: COURSE_LESSONS[2],
      rewardGp: 50,
      icon: '🎛️',
      unit: 1,
    },
    // UNIT 2: Мастерство, эффекты и личный стиль
    {
      type: 'bonus',
      index: 1,
      lesson: BONUS_LESSONS[1],
      rewardGp: 30,
      icon: '📜',
      unit: 2,
    },
    {
      type: 'course',
      index: 3,
      lesson: COURSE_LESSONS[3],
      rewardGp: 50,
      icon: '🔁',
      unit: 2,
    },
    {
      type: 'bonus',
      index: 2,
      lesson: BONUS_LESSONS[2],
      rewardGp: 30,
      icon: '🧭',
      unit: 2,
    },
    {
      type: 'course',
      index: 4,
      lesson: COURSE_LESSONS[4],
      rewardGp: 50,
      icon: '🎨',
      unit: 2,
    },
    {
      type: 'bonus',
      index: 3,
      lesson: BONUS_LESSONS[3],
      rewardGp: 30,
      icon: '🎵',
      unit: 2,
    },
    {
      type: 'course',
      index: 5,
      lesson: COURSE_LESSONS[5],
      rewardGp: 50,
      icon: '🏆',
      unit: 2,
    },
  ], []);

  const isItemCompleted = (item: TrackItem) => {
    if (item.type === 'course') {
      return course.completedLessons.includes(item.index + 1);
    }
    return bonusDone >= item.index + 1;
  };

  const isItemUnlocked = (item: TrackItem) => {
    if (adminMode || isPaid) return true;
    if (item.type === 'course') {
      return item.index < course.freeLessons;
    }
    return false; // bonus lessons unlocked with full course
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
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-mauve) 35%, var(--color-surface)), var(--color-surface))',
          borderRadius: 20,
          padding: 16,
          border: '1px solid color-mix(in srgb, var(--brand-mauve) 25%, transparent)',
          boxShadow: '0 8px 24px -10px color-mix(in srgb, var(--brand-mauve) 40%, transparent)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-mint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Duolingo DJ Path · {completedCount}/{totalCount}
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(0,0,0,0.35)',
              padding: '4px 10px',
              borderRadius: 99,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <Star size={13} />
            <span>{user.groovePoints} GP</span>
          </div>
        </div>

        <h2 style={{ fontSize: 22, margin: '0 0 6px', fontWeight: 800 }}>
          Обучение и Бонусы
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-dim)', lineHeight: 1.45 }}>
          Проходи уроки, получай GP-баллы и копи скидку на личные созвоны с Фридой DJ.
        </p>

        {/* Mentor Discount Pill */}
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 14,
            background: 'color-mix(in srgb, var(--brand-mint) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--brand-mint) 25%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--brand-mint)', fontWeight: 700 }}>
              Твоя скидка на созвон с Фридой DJ:
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, marginTop: 1 }}>
              −{discount.toLocaleString('ru-RU')} ★ ({user.groovePoints} GP)
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
              borderRadius: 10,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Созвон 🎧
          </button>
        </div>
      </div>

      {/* Category Pills */}
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
              border: 'none',
              borderRadius: 12,
              padding: '8px 10px',
              fontSize: 12,
              fontWeight: activeTab === tab.id ? 700 : 500,
              background: activeTab === tab.id ? 'var(--brand-mauve)' : 'var(--color-surface)',
              color: activeTab === tab.id ? '#1d1f1e' : 'var(--color-text-dim)',
              transition: 'all 0.2s',
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
            borderColor: 'color-mix(in srgb, var(--brand-coral) 40%, transparent)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            Бесплатно доступен Урок 1
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-dim)', marginTop: 4, marginBottom: 10 }}>
            Открой полный курс, чтобы разблокировать все 6 уроков и 4 бонус-урока от Фриды DJ.
          </div>
          <Button variant="coral" block onClick={() => setPayOpen(true)}>
            Открыть полный курс · 500 ★
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
            width: 4,
            transform: 'translateX(-50%)',
            background: 'linear-gradient(to bottom, var(--brand-mint) 0%, var(--brand-mauve) 50%, var(--brand-coral) 100%)',
            opacity: 0.35,
            borderRadius: 99,
            zIndex: 0,
          }}
        />

        {filteredItems.map((item, idx) => {
          const completed = isItemCompleted(item);
          const unlocked = isItemUnlocked(item);
          const isBonus = item.type === 'bonus';
          
          // Zig-zag offset for Duolingo feel (0 = center, -36 = left, 36 = right)
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
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  border: completed
                    ? '3px solid var(--brand-mint)'
                    : unlocked
                      ? '3px solid var(--brand-mauve)'
                      : '3px solid color-mix(in srgb, var(--color-text) 18%, transparent)',
                  background: completed
                    ? 'color-mix(in srgb, var(--brand-mint) 22%, var(--color-surface))'
                    : unlocked
                      ? 'color-mix(in srgb, var(--brand-mauve) 22%, var(--color-surface))'
                      : 'var(--color-surface)',
                  boxShadow: unlocked
                    ? completed
                      ? '0 0 16px color-mix(in srgb, var(--brand-mint) 35%, transparent)'
                      : '0 0 16px color-mix(in srgb, var(--brand-mauve) 40%, transparent)'
                    : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                {completed ? '✓' : unlocked ? item.icon : '🔒'}

                {/* Top Mini Pill Badge */}
                <span
                  style={{
                    position: 'absolute',
                    top: -8,
                    background: isBonus ? 'var(--brand-coral)' : completed ? 'var(--brand-mint)' : 'var(--brand-mauve)',
                    color: isBonus ? '#fff' : '#1d1f1e',
                    fontSize: 9.5,
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
                      ? 'color-mix(in srgb, var(--brand-mint) 15%, transparent)'
                      : 'color-mix(in srgb, var(--brand-mauve) 12%, transparent)',
                    fontSize: 11,
                    fontWeight: 700,
                    color: completed ? 'var(--brand-mint)' : 'var(--brand-gold)',
                  }}
                >
                  {completed ? 'Пройдено' : `+${item.rewardGp} GP к скидке`}
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
          borderRadius: 22,
          padding: 20,
          background: 'linear-gradient(135deg, rgba(30, 26, 20, 0.95), rgba(18, 16, 24, 0.95))',
          border: '2px solid color-mix(in srgb, var(--brand-gold) 45%, transparent)',
          boxShadow: '0 12px 36px -12px color-mix(in srgb, var(--brand-gold) 35%, transparent)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -20,
            right: -20,
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: 'color-mix(in srgb, var(--brand-gold) 15%, transparent)',
            filter: 'blur(20px)',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: 'linear-gradient(135deg, var(--brand-gold), var(--brand-coral))',
              display: 'grid',
              placeItems: 'center',
              fontSize: 26,
              flexShrink: 0,
            }}
          >
            👑
          </div>
          <div>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                color: 'var(--brand-gold)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              ФИНАЛ ТРЕКА · ЛИЧНОЕ НАСТАВНИЧЕСТВО
            </span>
            <h3 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 800 }}>
              Личные созвоны с Фридой DJ
            </h3>
          </div>
        </div>

        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--color-text-dim)', lineHeight: 1.5 }}>
          4 персональные онлайн-сессии по 1.5ч с FREEDA DJ: разбор твоих миксов, постановка техники, ответы на любые вопросы и дорожная карта выступлений.
        </p>

        {/* Pricing & GP Discount Breakdown */}
        <div
          style={{
            background: 'rgba(0,0,0,0.4)',
            borderRadius: 14,
            padding: '12px 14px',
            marginBottom: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--color-text-dim)' }}>
            <span>Базовая цена созвонов:</span>
            <span style={{ textDecoration: discount > 0 ? 'line-through' : 'none' }}>
              28 000 ★ ($230)
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--brand-mint)' }}>
            <span>Твоя скидка за {user.groovePoints} GP:</span>
            <b>−{discount.toLocaleString('ru-RU')} ★</b>
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
            <span style={{ fontWeight: 700, fontSize: 14 }}>Итого со скидкой:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Star size={16} />
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand-gold)' }}>
                {finalStars.toLocaleString('ru-RU')} ★
              </span>
            </div>
          </div>
        </div>

        <Button
          variant="gradient"
          block
          onClick={() => {
            haptic('heavy');
            setMentorOpen(true);
          }}
        >
          🎧 Записаться на созвоны с Фридой
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
              <div style={{ fontWeight: 800, fontSize: 17 }}>
                {selectedLesson.type === 'bonus' ? '🎁 Бонус-урок от Фриды' : `🎚️ Урок ${selectedLesson.index + 1}`}
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
                icon: '🎵',
                unit: 1,
              })}
              onUnlock={() => {
                setSelectedLesson(null);
                setPayOpen(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Paywalls */}
      <Paywall courseId="dj-basics" open={payOpen} onClose={() => setPayOpen(false)} />
      <MentorPay open={mentorOpen} onClose={() => setMentorOpen(false)} />
    </div>
  );
}
