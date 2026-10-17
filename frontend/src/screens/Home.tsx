import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, COURSE_LESSONS } from '../state/store';
import { mentorPrices } from '../lib/constants';
import { Button, Card, ProgressBar } from '../components/ui';
import { haptic } from '../lib/theme';
import { HorizontalDeckModal } from '../components/deck/HorizontalDeckModal';
import { MentorPay } from '../payment/Paywall';

import { ProfileWidget } from '../components/profile/ProfileWidget';
import { StaggerContainer, StaggerItem, ShimmerButton } from '../components/MotionWrappers';
import { PocketDjPromoWidget } from '../components/PocketDjPromoWidget';

export function Home() {
  const nav = useNavigate();
  const { user, course } = useApp();
  const [deckOpen, setDeckOpen] = useState(false);
  const [mentorOpen, setMentorOpen] = useState(false);

  const dc = course.completedLessons.length;
  const tc = COURSE_LESSONS.length;
  const pct = Math.round((dc / tc) * 100);
  const nextLessonIndex = Math.min(dc, tc - 1);
  const nextLesson = COURSE_LESSONS[nextLessonIndex];
  const nextId = nextLessonIndex + 1;

  const { discountUsd, finalUsd, finalRub } = mentorPrices(user.groovePoints);

  return (
    <div style={{ padding: '16px 16px 24px' }}>
      <StaggerContainer stepMs={65}>
        {/* 1. Profile Header Widget */}
        <StaggerItem index={0}>
          <ProfileWidget />
        </StaggerItem>

        {/* 2. Main Pocket DJ Promo Magnet Widget */}
        <StaggerItem index={1}>
          <PocketDjPromoWidget badgeText="Главный курс · Выбор школы" />
        </StaggerItem>

        {/* 3. Progress Bar & Course Milestones Section */}
        <StaggerItem index={2}>
          <Card strip>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-mauve)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Прогресс курса
                </span>
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  {pct}% завершено
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-dim)' }}>
                {dc} из {tc} уроков
              </div>
            </div>

            <ProgressBar value={pct} />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--color-text-dim)', marginTop: 8 }}>
              <span>Шаг 1: Интерфейс</span>
              <span>Шаг 6: Финальный сет</span>
            </div>
          </Card>
        </StaggerItem>

        {/* 4. Next Lesson Section with Shimmer CTA Button */}
        <StaggerItem index={3}>
          <Card
            strip
            style={{
              background: 'var(--color-surface)',
              borderColor: 'color-mix(in srgb, var(--brand-mint) 25%, transparent)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: 'var(--brand-mint)',
                  background: 'color-mix(in srgb, var(--brand-mint) 12%, transparent)',
                  padding: '3px 8px',
                  borderRadius: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {dc >= tc ? 'Курс завершён' : `Следующий урок · Урок ${nextId}`}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-gold)' }}>
                +50 GP к скидке
              </span>
            </div>

            <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 6px' }}>
              {dc >= tc ? 'Все 6 основных уроков пройдены' : nextLesson.t}
            </h3>

            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--color-text-dim)', lineHeight: 1.45 }}>
              {dc >= tc
                ? 'Ты освоил базовую траекторию. Переходи в раздел Обучение для просмотра бонусов от FREEDA DJ или записи на персональный созвон.'
                : nextLesson.d[0]}
            </p>

            <ShimmerButton
              variant="gradient"
              block
              shimmer
              onClick={() => {
                haptic('medium');
                nav('/learn');
              }}
            >
              {dc >= tc ? 'Смотреть бонусы и созвоны' : `Продолжить: Урок ${nextId}`}
            </ShimmerButton>
          </Card>
        </StaggerItem>

        {/* 5. Virtual Rekordbox Console Pioneer DJ (Спокойный вторичный виджет) */}
        <StaggerItem index={4}>
          <Card
            strip
            style={{
              background: 'var(--color-surface)',
              borderColor: 'rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-mint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Rekordbox Simulator
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-text-dim)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                Dual Deck A/B
              </span>
            </div>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
              Виртуальная DJ-консоль
            </div>
            <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--color-text-dim)', lineHeight: 1.45 }}>
              Интерактивный пульт: запускай треки, управляй темпом и своди в реальном времени прямо с телефона.
            </p>
            <Button
              variant="secondary"
              block
              onClick={() => {
                haptic('heavy');
                setDeckOpen(true);
              }}
            >
              Практика на пульте
            </Button>
          </Card>
        </StaggerItem>

        {/* 6. Frida DJ Mentorship Callout */}
        <StaggerItem index={5}>
          <Card
            strip
            style={{
              background: 'var(--color-surface)',
              borderColor: 'color-mix(in srgb, var(--brand-gold) 25%, transparent)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span
                style={{
                  background: 'color-mix(in srgb, var(--brand-gold) 15%, transparent)',
                  color: 'var(--brand-gold)',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '4px 8px',
                  borderRadius: 6,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                MENTOR
              </span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-gold)', textTransform: 'uppercase' }}>
                  Личное наставничество
                </div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>Созвоны с FREEDA DJ</div>
              </div>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--color-text-dim)', lineHeight: 1.45 }}>
              Копи GP за уроки: каждые 100 GP дают $10 скидки на 4 персональные сессии с FREEDA DJ (до −$50 скидки).
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, fontSize: 13 }}>
              <span style={{ color: 'var(--color-text-dim)' }}>Твоя текущая цена:</span>
              <span style={{ fontWeight: 800, color: 'var(--brand-gold)' }}>
                ${finalUsd} · {finalRub.toLocaleString('ru-RU')} ₽
                {discountUsd > 0 && <span style={{ color: 'var(--brand-mint)', fontSize: 12, marginLeft: 6 }}>(-${discountUsd})</span>}
              </span>
            </div>
            <Button
              variant="primary"
              block
              onClick={() => {
                haptic('medium');
                setMentorOpen(true);
              }}
            >
              Записаться на созвон со скидкой
            </Button>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      <HorizontalDeckModal isOpen={deckOpen} onClose={() => setDeckOpen(false)} />
      <MentorPay open={mentorOpen} onClose={() => setMentorOpen(false)} />
    </div>
  );
}
