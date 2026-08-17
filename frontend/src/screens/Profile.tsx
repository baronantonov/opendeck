import { useState } from 'react';
import { useApp } from '../state/store';
import { Button, Card, Star } from '../components/ui';
import { useToast } from '../components/Toast';
import { apiArchetypeShare, apiGpEarn } from '../api/client';
import { haptic } from '../lib/theme';
import { ARCHETYPES } from '../lib/constants';

const EARN_ACTIONS = [
  { action: 'share', icon: '🔗', label: 'Поделиться курсом', reward: 20 },
  { action: 'daily', icon: '📅', label: 'Ежедневный бонус', reward: 10 },
  { action: 'review', icon: '⭐', label: 'Оставить отзыв', reward: 50 },
];

export function Profile() {
  const { user, course, bonusDone, referralFriends, referralGpEarned } = useApp();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const dc = course.completedLessons.length;

  const earn = async (action: string, label: string) => {
    setBusy(action);
    try {
      const j: any = await apiGpEarn(action);
      if (j?._err === 'cooldown') {
        toast('🔄', 'Доступно через 24ч');
      } else if (j?._err) {
        toast('✕', 'Ошибка начисления');
      } else {
        // update gp optimistically; reload will confirm
        toast('✓', `${label}: +${j.amount} ★`);
      }
    } catch {
      toast('✕', 'Ошибка сети');
    } finally {
      setBusy(null);
    }
  };

  const shareArchetype = async () => {
    haptic('light');
    try {
      const link = `https://t.me/share/url?url=https://baronantonov.github.io/opendeck/&text=${encodeURIComponent(
        `Я — ${user.archetype} в Open Deck. Собери свою колоду!`,
      )}`;
      (window as any).Telegram?.WebApp?.openTelegramLink?.(link) ||
        window.open(link, '_blank');
      await apiArchetypeShare();
    } catch {
      /* ignore */
    }
  };

  const achs = [
    { name: 'Первый бит', got: dc >= 1, desc: 'Пройди урок 1' },
    { name: 'Половина пути', got: dc >= 3, desc: 'Пройди 3 урока' },
    { name: 'DJ-сет собран', got: dc >= 6, desc: 'Пройди все 6 уроков' },
    { name: 'Теоретик', got: bonusDone >= 4, desc: 'Досмотри 4 бонус-урока' },
    { name: 'Наставник', got: referralFriends >= 3, desc: 'Пригласи 3 друзей' },
    { name: 'Архетип раскрыт', got: !!user.archetype, desc: 'Получи свой архетип' },
  ];

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          className="user-avatar"
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: 'var(--color-accent)',
            color: '#1d1f1e',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            fontSize: 20,
          }}
        >
          {user.name[0] || 'Д'}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{user.name}</div>
          <div style={{ fontSize: 12, color: 'var(--color-mint)' }}>{user.archetype}</div>
        </div>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'color-mix(in srgb, var(--color-gold) 14%, transparent)',
            padding: '6px 12px',
            borderRadius: 99,
            fontWeight: 700,
          }}
        >
          <Star />
          {user.groovePoints}
        </div>
      </div>

      <Card>
        <div style={{ fontSize: 13, color: 'var(--color-text-dim)', marginBottom: 10 }}>
          Бесплатные ★
        </div>
        {EARN_ACTIONS.map((a) => (
          <button
            key={a.action}
            disabled={busy === a.action}
            onClick={() => earn(a.action, a.label)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'transparent',
              border: 'none',
              borderTop:
                '1px solid color-mix(in srgb, var(--color-text) 7%, transparent)',
              padding: '12px 0',
              color: 'var(--color-text)',
              fontSize: 14,
              fontWeight: 600,
              opacity: busy === a.action ? 0.5 : 1,
            }}
          >
            <span style={{ fontSize: 18 }}>{a.icon}</span>
            <span style={{ flex: 1, textAlign: 'left' }}>{a.label}</span>
            <b style={{ color: 'var(--color-gold)' }}>+{a.reward} ★</b>
          </button>
        ))}
      </Card>

      <Card>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Пригласи друга</div>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-dim)', marginBottom: 8 }}>
          {referralFriends} друзей · {referralGpEarned} ★ заработано
        </div>
        {user.referralCode && (
          <code
            style={{
              display: 'block',
              background: 'color-mix(in srgb, var(--color-text) 8%, transparent)',
              padding: '8px 10px',
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 10,
            }}
          >
            ref_{user.referralCode}
          </code>
        )}
        <Button variant="mint" block onClick={shareArchetype}>
          Пригласить друга
        </Button>
      </Card>

      <Card>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Достижения</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {achs.map((a) => (
            <div
              key={a.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 12,
                background: a.got
                  ? 'color-mix(in srgb, var(--color-mint) 10%, transparent)'
                  : 'color-mix(in srgb, var(--color-text) 3%, transparent)',
                border: a.got
                  ? '1px solid color-mix(in srgb, var(--color-mint) 25%, transparent)'
                  : 'none',
                opacity: a.got ? 1 : 0.55,
              }}
            >
              <span style={{ fontSize: 18 }}>{a.got ? '🏆' : '🔒'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{a.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <p style={{ fontSize: 11, color: 'var(--color-text-dim)', textAlign: 'center' }}>
        Open Deck DJ School · архетип: {ARCHETYPES[user.archetype] || ''}
      </p>
    </div>
  );
}
