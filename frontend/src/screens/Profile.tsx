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
        toast('✓', `${label}: +${j.amount} GP`);
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
      {/* DJ Profile Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #1f2530 0%, #12151a 100%)',
            border: '1.5px solid #00e5ff',
            color: '#00e5ff',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            fontSize: 18,
            boxShadow: '0 0 10px rgba(0, 229, 255, 0.25)',
            flexShrink: 0,
          }}
        >
          {user.name[0] || 'D'}
        </div>
        <div>
          <div
            className="font-mono"
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#657283',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            DJ PROFILE · {user.archetype || 'ROOKIE'}
          </div>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#f0f3f6' }}>{user.name}</div>
        </div>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#101318',
            border: '1px solid rgba(255, 214, 0, 0.25)',
            padding: '6px 12px',
            borderRadius: 10,
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
          }}
        >
          <Star size={13} />
          <span
            className="font-mono"
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#ffd600',
            }}
          >
            {user.groovePoints.toLocaleString()} GP
          </span>
        </div>
      </div>

      {/* Free GP Earn */}
      <Card>
        <div
          className="font-mono"
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: '#00e5ff',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          BONUS GROOVE POINTS
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
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              padding: '12px 0',
              color: '#f0f3f6',
              fontSize: 13.5,
              fontWeight: 600,
              opacity: busy === a.action ? 0.5 : 1,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 18 }}>{a.icon}</span>
            <span style={{ flex: 1, textAlign: 'left' }}>{a.label}</span>
            <b className="font-mono" style={{ color: '#ffd600', fontSize: 13 }}>
              +{a.reward} GP
            </b>
          </button>
        ))}
      </Card>

      {/* Referral */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontWeight: 800, fontSize: 14.5, color: '#f0f3f6' }}>Пригласи друга в Open Deck</div>
          <span className="font-mono" style={{ fontSize: 11, fontWeight: 700, color: '#ff5a00' }}>
            +100 / +200 GP
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: '#8e98a5', marginBottom: 10 }}>
          {referralFriends} друзей приглашено · {referralGpEarned} GP заработано
        </div>
        {user.referralCode && (
          <div
            className="font-mono"
            style={{
              background: '#090b0e',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 12,
              color: '#00e5ff',
              marginBottom: 10,
              wordBreak: 'break-all',
            }}
          >
            ref_{user.referralCode}
          </div>
        )}
        <Button variant="primary" block onClick={shareArchetype}>
          Пригласить друга в Telegram
        </Button>
      </Card>

      {/* Achievements */}
      <Card>
        <div
          className="font-mono"
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: '#00e5ff',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          DJ ACHIEVEMENTS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {achs.map((a) => (
            <div
              key={a.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                background: a.got ? 'rgba(0, 240, 118, 0.08)' : '#0d1014',
                border: a.got ? '1px solid rgba(0, 240, 118, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                opacity: a.got ? 1 : 0.6,
              }}
            >
              <span style={{ fontSize: 18 }}>{a.got ? '🏆' : '🔒'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: a.got ? '#00f076' : '#f0f3f6' }}>
                  {a.name}
                </div>
                <div style={{ fontSize: 11.5, color: '#828e9e' }}>{a.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <p style={{ fontSize: 11, color: '#657283', textAlign: 'center', margin: '4px 0 0' }}>
        Open Deck DJ School · {ARCHETYPES[user.archetype] || ''}
      </p>
    </div>
  );
}
