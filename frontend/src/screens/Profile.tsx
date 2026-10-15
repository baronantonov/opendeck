import { useState, useMemo } from 'react';
import { useApp } from '../state/store';
import { Button, Card, ProgressBar, Star } from '../components/ui';
import { useToast } from '../components/Toast';
import { apiArchetypeShare, apiGpEarn } from '../api/client';
import { haptic } from '../lib/theme';
import { ARCHETYPES } from '../lib/constants';

interface Rank {
  title: string;
  minGp: number;
  icon: string;
  desc: string;
}

const RANKS: Rank[] = [
  { title: 'Bedroom DJ', minGp: 0, icon: '🎧', desc: 'Первые шаги за деками и знакомство с софтом' },
  { title: 'Beatmatcher', minGp: 100, icon: '🎚️', desc: 'Чувствуешь BPM, сетку и синхронизацию' },
  { title: 'Groove Selector', minGp: 250, icon: '🎛️', desc: 'Мастер лупов, Beat Jump и переходов' },
  { title: 'Club Resident', minGp: 450, icon: '🔊', desc: 'Собрал свой первый сет и держишь танцпол' },
  { title: 'Festival Headliner', minGp: 700, icon: '👑', desc: 'Высший ранг Open Deck DJ School' },
];

const EARN_ACTIONS = [
  { action: 'daily', icon: '📅', label: 'Ежедневный бонус за активность', reward: 10 },
  { action: 'share', icon: '🔗', label: 'Поделиться курсом в соцсетях', reward: 20 },
  { action: 'review', icon: '⭐', label: 'Оставить честный отзыв о школе', reward: 50 },
];

export function Profile() {
  const { user, course, bonusDone, referralFriends, referralGpEarned } = useApp();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const dc = course.completedLessons.length;

  // Compute current rank and progress to next rank
  const currentRankIndex = useMemo(() => {
    let idx = 0;
    for (let i = 0; i < RANKS.length; i++) {
      if (user.groovePoints >= RANKS[i].minGp) {
        idx = i;
      }
    }
    return idx;
  }, [user.groovePoints]);

  const currentRank = RANKS[currentRankIndex];
  const nextRank = RANKS[currentRankIndex + 1] || null;
  
  const rankProgress = useMemo(() => {
    if (!nextRank) return 100;
    const currentBase = currentRank.minGp;
    const needed = nextRank.minGp - currentBase;
    const progress = user.groovePoints - currentBase;
    return Math.min(100, Math.max(0, Math.round((progress / needed) * 100)));
  }, [currentRank, nextRank, user.groovePoints]);

  const earn = async (action: string, label: string) => {
    setBusy(action);
    try {
      const j: any = await apiGpEarn(action);
      if (j?._err === 'cooldown') {
        toast('🔄', 'Доступно через 24 часа');
      } else if (j?._err) {
        toast('✕', 'Ошибка начисления');
      } else {
        toast('✓', `${label}: +${j.amount} ★`);
      }
    } catch {
      toast('✕', 'Ошибка сети');
    } finally {
      setBusy(null);
    }
  };

  const inviteFriend = () => {
    haptic('medium');
    const refCode = user.referralCode || 'opendeck';
    const botUrl = `https://t.me/OpenDeck_bot?start=ref_${refCode}`;
    const text = `🎧 Привет! Учусь диджеингу в Open Deck DJ School на базе Rekordbox. Лови +100 ★ при регистрации по моей ссылке:`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(botUrl)}&text=${encodeURIComponent(text)}`;
    
    try {
      (window as any).Telegram?.WebApp?.openTelegramLink?.(shareUrl) || window.open(shareUrl, '_blank');
    } catch {
      window.open(shareUrl, '_blank');
    }
  };

  const shareProfile = async () => {
    haptic('medium');
    const shareUrl = `https://baronantonov.github.io/opendeck/`;
    const text = `🎚️ Мой DJ-профиль в Open Deck:
👑 Звание: ${currentRank.title}
🔮 Архетип: ${user.archetype}
⭐️ Прогресс: ${user.groovePoints} GP · ${dc}/6 уроков
Собери свою колоду и встань за пульт!`;
    const link = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;
    
    try {
      (window as any).Telegram?.WebApp?.openTelegramLink?.(link) || window.open(link, '_blank');
      await apiArchetypeShare();
    } catch {
      /* ignore */
    }
  };

  const achs = [
    { name: 'Первый бит', got: dc >= 1, desc: 'Пройди урок 1 по контроллеру', icon: '🎚️' },
    { name: 'Половина пути', got: dc >= 3, desc: 'Пройди первые 3 урока курса', icon: '⏱️' },
    { name: 'DJ-сет собран', got: dc >= 6, desc: 'Заверши все 6 основных уроков', icon: '🏆' },
    { name: 'Теоретик музыки', got: bonusDone >= 4, desc: 'Пройди все 4 бонус-урока от Фриды', icon: '📚' },
    { name: 'Мастер нетворкинга', got: referralFriends >= 3, desc: 'Пригласи 3 друзей в школу', icon: '🤝' },
    { name: 'Архетип раскрыт', got: !!user.archetype, desc: 'Определи свой персональный вайб', icon: '🔮' },
    { name: 'Золотой резерв', got: user.groovePoints >= 300, desc: 'Накопи 300+ GP на скидку созвона', icon: '🌟' },
  ];

  return (
    <div style={{ padding: '16px 16px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* User Info Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          className="user-avatar"
          style={{
            width: 58,
            height: 58,
            borderRadius: 18,
            background: 'linear-gradient(135deg, var(--brand-mauve), var(--brand-mint))',
            color: '#1d1f1e',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            fontSize: 22,
            boxShadow: '0 4px 16px -4px var(--brand-mauve)',
            flexShrink: 0,
          }}
        >
          {user.name[0] || 'D'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>{user.name}</div>
          <div style={{ fontSize: 13, color: 'var(--brand-mint)', fontWeight: 600, marginTop: 2 }}>
            {user.archetype}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-dim)', marginTop: 1 }}>
            {ARCHETYPES[user.archetype] || 'Резидент Open Deck DJ'}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'color-mix(in srgb, var(--brand-gold) 16%, transparent)',
            border: '1px solid color-mix(in srgb, var(--brand-gold) 28%, transparent)',
            padding: '7px 12px',
            borderRadius: 99,
            fontWeight: 800,
          }}
        >
          <Star size={15} />
          <span style={{ color: 'var(--brand-gold)', fontSize: 14 }}>{user.groovePoints} ★</span>
        </div>
      </div>

      {/* DJ Titles & Ranks Section (Звания) */}
      <Card
        strip
        style={{
          background: 'linear-gradient(135deg, rgba(28, 24, 30, 0.95), rgba(18, 16, 22, 0.95))',
          borderColor: 'color-mix(in srgb, var(--brand-mauve) 35%, transparent)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-mauve)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Твоё звание DJ
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
            Уровень {currentRankIndex + 1} из {RANKS.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 32 }}>{currentRank.icon}</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{currentRank.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-dim)', marginTop: 2 }}>
              {currentRank.desc}
            </div>
          </div>
        </div>

        {nextRank && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--color-text-dim)', marginBottom: 6 }}>
              <span>До звания «{nextRank.title}»</span>
              <span>{user.groovePoints} / {nextRank.minGp} GP</span>
            </div>
            <ProgressBar value={rankProgress} />
          </div>
        )}
      </Card>

      {/* Detailed Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div style={{ background: 'var(--color-surface)', borderRadius: 14, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 18 }}>🎚️</div>
          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{dc}/6</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>Уроков</div>
        </div>
        <div style={{ background: 'var(--color-surface)', borderRadius: 14, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 18 }}>🎁</div>
          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{bonusDone}/4</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>Бонусов</div>
        </div>
        <div style={{ background: 'var(--color-surface)', borderRadius: 14, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 18 }}>👥</div>
          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{referralFriends}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>Друзей</div>
        </div>
      </div>

      {/* Referral Program & Share Buttons */}
      <Card strip>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
          Реферальная программа и Шеринг
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-dim)', marginBottom: 12, lineHeight: 1.45 }}>
          Получай <b>+100 ★</b> за каждого приглашённого друга и <b>+200 ★</b> при его покупке курса. Друг получает бонусные +100 ★ на старте!
          {referralGpEarned > 0 && (
            <div style={{ marginTop: 6, color: 'var(--brand-gold)', fontWeight: 700 }}>
              Уже заработано на рефералах: +{referralGpEarned} ★
            </div>
          )}
        </div>

        {user.referralCode && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginBottom: 4 }}>
              Твой реферальный код:
            </div>
            <code
              style={{
                display: 'block',
                background: 'rgba(0,0,0,0.3)',
                padding: '9px 12px',
                borderRadius: 10,
                fontSize: 13.5,
                fontWeight: 700,
                color: 'var(--brand-mint)',
              }}
            >
              ref_{user.referralCode}
            </code>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button variant="mint" block onClick={inviteFriend}>
            👥 Пригласить друга (+100 ★)
          </Button>
          <Button variant="secondary" block onClick={shareProfile}>
            📤 Поделиться профилем в Telegram
          </Button>
        </div>
      </Card>

      {/* Free GP & Bonus Actions */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-dim)', marginBottom: 8 }}>
          Список бонусов для заработка GP
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
              gap: 12,
              background: 'transparent',
              border: 'none',
              borderTop: '1px solid color-mix(in srgb, var(--color-text) 7%, transparent)',
              padding: '12px 0',
              color: 'var(--color-text)',
              fontSize: 13.5,
              fontWeight: 600,
              opacity: busy === a.action ? 0.5 : 1,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 20 }}>{a.icon}</span>
            <span style={{ flex: 1, textAlign: 'left' }}>{a.label}</span>
            <b style={{ color: 'var(--brand-gold)' }}>+{a.reward} ★</b>
          </button>
        ))}
      </Card>

      {/* Achievements (Ачивки) */}
      <Card strip>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Достижения и ачивки</div>
          <span style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>
            {achs.filter((a) => a.got).length} / {achs.length}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {achs.map((a) => (
            <div
              key={a.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                borderRadius: 14,
                background: a.got
                  ? 'color-mix(in srgb, var(--brand-mint) 12%, transparent)'
                  : 'color-mix(in srgb, var(--color-text) 3%, transparent)',
                border: a.got
                  ? '1px solid color-mix(in srgb, var(--brand-mint) 25%, transparent)'
                  : '1px solid transparent',
                opacity: a.got ? 1 : 0.55,
              }}
            >
              <span style={{ fontSize: 22 }}>{a.got ? a.icon : '🔒'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{a.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--color-text-dim)' }}>{a.desc}</div>
              </div>
              {a.got && (
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-mint)' }}>
                  Получено
                </span>
              )}
            </div>
          ))}
        </div>
      </Card>

      <p style={{ fontSize: 11, color: 'var(--color-text-dim)', textAlign: 'center', margin: '4px 0 0' }}>
        Open Deck DJ School · Обучение на базе Rekordbox
      </p>
    </div>
  );
}
