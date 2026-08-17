import { useNavigate } from 'react-router-dom';
import { useApp, COURSE_LESSONS } from '../state/store';
import { Button, Card, ProgressBar, Star } from '../components/ui';
import { ARCHETYPES } from '../lib/constants';
import { haptic } from '../lib/theme';

export function Home() {
  const nav = useNavigate();
  const { user, course, isPaid } = useApp();
  const dc = course.completedLessons.length;
  const tc = COURSE_LESSONS.length;
  const pct = Math.round((dc / tc) * 100);
  const nextId = Math.min(dc + 1, tc);
  const archLine = ARCHETYPES[user.archetype] || 'Твой путь DJ начинается здесь';

  const playLabel =
    dc === 0
      ? 'Начать урок 1'
      : dc >= tc
        ? 'Курс пройден'
        : !isPaid
          ? 'Открыть доступ · 500 ★'
          : `Продолжить · урок ${nextId}`;

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          className="user-avatar"
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            background: 'var(--color-accent)',
            color: '#1d1f1e',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            fontSize: 18,
          }}
        >
          {user.name[0] || 'Д'}
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>Привет,</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{user.name}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Star />
          <b style={{ fontSize: 15 }}>{user.groovePoints}</b>
        </div>
      </header>

      <Card
        style={{
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 30%, var(--color-surface)), var(--color-surface))',
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginBottom: 4 }}>
          {user.archetype}
        </div>
        <h1 style={{ fontSize: 24, margin: '0 0 6px' }}>Open Deck</h1>
        <p style={{ margin: 0, fontSize: 13.5, opacity: 0.85 }}>{archLine}</p>
        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <Button
            variant="mint"
            block
            onClick={() => {
              haptic('medium');
              nav('/course');
            }}
          >
            {playLabel}
          </Button>
        </div>
      </Card>

      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: 'var(--color-text-dim)',
            marginBottom: 6,
          }}
        >
          <span>Прогресс курса</span>
          <span>
            {dc} / {tc}
          </span>
        </div>
        <ProgressBar value={pct} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { ic: '🎚️', t: 'С нуля', d: '6 уроков до сета' },
          { ic: '🎁', t: 'Бонусы', d: '★ за просмотры' },
          { ic: '🎧', t: 'Свой вайб', d: 'играй по-своему' },
        ].map((v) => (
          <div
            key={v.t}
            style={{
              background: 'var(--color-surface)',
              borderRadius: 14,
              padding: 12,
            }}
          >
            <div style={{ fontSize: 20 }}>{v.ic}</div>
            <div style={{ fontWeight: 700, fontSize: 13, marginTop: 6 }}>{v.t}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{v.d}</div>
          </div>
        ))}
      </div>

      {!isPaid && (
        <Card style={{ borderColor: 'color-mix(in srgb, var(--color-coral) 40%, transparent)' }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Открой полный курс</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-dim)', marginBottom: 10 }}>
            Урок 1 бесплатно. Дальше — доступ за 500 ★.
          </div>
          <Button variant="coral" block onClick={() => nav('/course')}>
            Выбрать план
          </Button>
        </Card>
      )}
    </div>
  );
}
