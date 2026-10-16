import { useState, useMemo } from 'react';
import { useApp } from '../state/store';
import {
  Button,
  Card,
  ProgressBar,
  Star,
  IconHeadphones,
  IconFader,
  IconWaveform,
  IconDisc,
  IconTrophy,
  IconSparkles,
  IconShare,
  IconUsers,
  IconFlame,
  IconLock,
} from '../components/ui';
import { useToast } from '../components/Toast';
import { apiArchetypeShare, apiGpEarn } from '../api/client';
import { haptic } from '../lib/theme';
import { ARCHETYPES } from '../lib/constants';

interface Rank {
  title: string;
  minGp: number;
  tag: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}

const RANKS: Rank[] = [
  { title: 'Bedroom DJ', minGp: 0, tag: 'LVL 1', desc: 'Первые шаги за деками и знакомство с софтом', icon: IconHeadphones },
  { title: 'Beatmatcher', minGp: 100, tag: 'LVL 2', desc: 'Чувствуешь BPM, сетку и синхронизацию', icon: IconFader },
  { title: 'Groove Selector', minGp: 250, tag: 'LVL 3', desc: 'Мастер лупов, Beat Jump и переходов', icon: IconWaveform },
  { title: 'Club Resident', minGp: 450, tag: 'LVL 4', desc: 'Собрал свой первый сет и держишь танцпол', icon: IconDisc },
  { title: 'Festival Headliner', minGp: 700, tag: 'LVL 5', desc: 'Высший ранг Open Deck DJ School', icon: IconTrophy },
];

const EARN_ACTIONS = [
  { action: 'daily', label: 'Ежедневный бонус за активность', reward: 25, icon: IconSparkles },
  { action: 'share_achievement', label: 'Поделиться достижением', reward: 25, icon: IconShare },
  { action: 'invite_team', label: 'Пригласить друга в команду', reward: 50, icon: IconUsers },
  { action: 'review', label: 'Оставить честный отзыв о школе', reward: 50, icon: IconTrophy },
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
        toast('i', 'Доступно через 24 часа');
      } else if (j?._err) {
        toast('✕', 'Ошибка начисления');
      } else {
        toast('✓', `${label}: +${j.amount || 25} GP`);
      }
    } catch {
      toast('✕', 'Ошибка сети');
    } finally {
      setBusy(null);
    }
  };

  const inviteFriend = async () => {
    haptic('medium');
    const refCode = user.referralCode || 'opendeck';
    const archetype = user.archetype || 'Куратор Вайба';
    try {
      const tw = (window as any).Telegram?.WebApp;
      if (tw?.sendData) {
        tw.sendData(JSON.stringify({ action: 'invite', code: refCode, archetype }));
      } else {
        // Fallback для тестирования вне Telegram WebView
        const botUrl = `https://t.me/OpenDeck_bot?start=ref_${refCode}`;
        const text = `Привет! Учусь диджеингу в Open Deck DJ School на базе Rekordbox. Лови +100 GP при регистрации в моей команде:`;
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(botUrl)}&text=${encodeURIComponent(text)}`;
        window.open(shareUrl, '_blank');
      }
      await earn('invite_team', 'Приглашение в команду');
    } catch {
      // ignore
    }
  };

  const shareProfile = async () => {
    haptic('medium');
    const shareUrl = `https://baronantonov.github.io/opendeck/`;
    const text = `Мой DJ-профиль в Open Deck:
Звание: ${currentRank.title}
Архетип: ${user.archetype}
Прогресс: ${user.groovePoints} GP · ${dc}/6 уроков
Обучение диджеингу на базе Rekordbox. Присоединяйся!`;
    const link = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;

    try {
      (window as any).Telegram?.WebApp?.openTelegramLink?.(link) || window.open(link, '_blank');
      const res = await apiArchetypeShare();
      if (res?.amount > 0) {
        toast('✓', `Поделился профилем: +${res.amount} GP`);
      }
    } catch {
      /* ignore */
    }
  };

  const shareAchievement = async (achName: string) => {
    haptic('medium');
    const shareUrl = `https://baronantonov.github.io/opendeck/`;
    const text = `Я открыл достижение «${achName}» в Open Deck DJ School! Учусь сведению на Rekordbox:`;
    const link = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;

    try {
      (window as any).Telegram?.WebApp?.openTelegramLink?.(link) || window.open(link, '_blank');
      await earn('share_achievement', `Достижение «${achName}»`);
    } catch {
      /* ignore */
    }
  };

  const achs = [
    { name: 'Первый бит', got: dc >= 1, desc: 'Пройди урок 1 по контроллеру', icon: IconFader },
    { name: 'Половина пути', got: dc >= 3, desc: 'Пройди первые 3 урока курса', icon: IconWaveform },
    { name: 'DJ-сет собран', got: dc >= 6, desc: 'Заверши все 6 основных уроков', icon: IconDisc },
    { name: 'Теоретик музыки', got: bonusDone >= 4, desc: 'Пройди все 4 бонус-урока от FREEDA DJ', icon: IconSparkles },
    { name: 'Мастер нетворкинга', got: referralFriends >= 3, desc: 'Пригласи 3 друзей в школу', icon: IconUsers },
    { name: 'Архетип раскрыт', got: !!user.archetype, desc: 'Определи свой персональный вайб', icon: IconFlame },
    { name: 'Золотой резерв', got: user.groovePoints >= 300, desc: 'Накопи 300+ GP на скидку созвона', icon: IconTrophy },
  ];

  const RankIcon = currentRank.icon;

  return (
    <div style={{ padding: '16px 16px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* User Info Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          className="user-avatar"
          style={{
            width: 54,
            height: 54,
            borderRadius: 16,
            background: 'var(--color-surface)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: 'var(--brand-mint)',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            fontSize: 20,
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
            background: 'color-mix(in srgb, var(--brand-gold) 12%, var(--color-surface))',
            border: '1px solid color-mix(in srgb, var(--brand-gold) 24%, transparent)',
            padding: '6px 12px',
            borderRadius: 99,
            fontWeight: 800,
          }}
        >
          <Star size={14} />
          <span style={{ color: 'var(--brand-gold)', fontSize: 13 }}>{user.groovePoints} GP</span>
        </div>
      </div>

      {/* DJ Titles & Ranks Section (Звания) */}
      <Card
        strip
        style={{
          background: 'var(--color-surface)',
          borderColor: 'rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-mauve)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Твоё звание DJ
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-text-dim)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 6 }}>
            Уровень {currentRankIndex + 1} из {RANKS.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--brand-gold)',
              flexShrink: 0,
            }}
          >
            <RankIcon size={22} color="var(--brand-gold)" />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{currentRank.title}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginTop: 2 }}>
              {currentRank.desc}
            </div>
          </div>
        </div>

        {nextRank && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--color-text-dim)', marginBottom: 6 }}>
              <span>До звания «{nextRank.title}»</span>
              <span style={{ fontWeight: 600, color: 'var(--brand-mint)' }}>{user.groovePoints} / {nextRank.minGp} GP</span>
            </div>
            <ProgressBar value={rankProgress} />
          </div>
        )}
      </Card>

      {/* Detailed Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div
          style={{
            background: 'var(--color-surface)',
            borderRadius: 14,
            padding: '12px 8px',
            textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ display: 'inline-flex', color: 'var(--brand-mint)', marginBottom: 2 }}>
            <IconFader size={18} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{dc}/6</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>Уроков</div>
        </div>
        <div
          style={{
            background: 'var(--color-surface)',
            borderRadius: 14,
            padding: '12px 8px',
            textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ display: 'inline-flex', color: 'var(--brand-mauve)', marginBottom: 2 }}>
            <IconSparkles size={18} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{bonusDone}/4</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>Бонусов</div>
        </div>
        <div
          style={{
            background: 'var(--color-surface)',
            borderRadius: 14,
            padding: '12px 8px',
            textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ display: 'inline-flex', color: 'var(--brand-gold)', marginBottom: 2 }}>
            <IconUsers size={18} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{referralFriends}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>Друзей</div>
        </div>
      </div>

      {/* Referral Program & Share Buttons */}
      <Card
        strip
        style={{
          background: 'var(--color-surface)',
          borderColor: 'rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
          Команда и реферальная программа
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-dim)', marginBottom: 12, lineHeight: 1.45 }}>
          Получай <b>+100 GP</b> за каждого приглашённого друга и <b>+200 GP</b> при его покупке курса. Друг получает бонусные +100 GP на старте! Очки дают прямую скидку на созвоны с FREEDA DJ.
          {referralGpEarned > 0 && (
            <div style={{ marginTop: 6, color: 'var(--brand-gold)', fontWeight: 700 }}>
              Заработано на рефералах: +{referralGpEarned} GP
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
            <IconUsers size={16} />
            Пригласить друга в команду (+50 GP)
          </Button>
          <Button variant="secondary" block onClick={shareProfile}>
            <IconShare size={16} />
            Поделиться профилем (+20 GP)
          </Button>
        </div>
      </Card>

      {/* Free GP & Bonus Actions */}
      <Card
        style={{
          background: 'var(--color-surface)',
          borderColor: 'rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-dim)', marginBottom: 8 }}>
          Заработок Groove Points (GP)
        </div>
        {EARN_ACTIONS.map((a) => {
          const ActionIcon = a.icon;
          return (
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
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                padding: '12px 0',
                color: 'var(--color-text)',
                fontSize: 13,
                fontWeight: 600,
                opacity: busy === a.action ? 0.5 : 1,
                cursor: 'pointer',
              }}
            >
              <div style={{ color: 'var(--brand-mint)', display: 'grid', placeItems: 'center' }}>
                <ActionIcon size={17} />
              </div>
              <span style={{ flex: 1, textAlign: 'left' }}>{a.label}</span>
              <b style={{ color: 'var(--brand-gold)', fontSize: 12.5 }}>+{a.reward} GP</b>
            </button>
          );
        })}
      </Card>

      {/* Achievements (Ачивки) */}
      <Card
        strip
        style={{
          background: 'var(--color-surface)',
          borderColor: 'rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Достижения и ачивки</div>
          <span style={{ fontSize: 11.5, color: 'var(--color-text-dim)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 6 }}>
            {achs.filter((a) => a.got).length} / {achs.length}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {achs.map((a) => {
            const AchIcon = a.icon;
            return (
              <div
                key={a.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: a.got
                    ? 'color-mix(in srgb, var(--brand-mint) 8%, var(--color-surface))'
                    : 'rgba(255, 255, 255, 0.02)',
                  border: a.got
                    ? '1px solid color-mix(in srgb, var(--brand-mint) 20%, transparent)'
                    : '1px solid rgba(255, 255, 255, 0.05)',
                  opacity: a.got ? 1 : 0.55,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: a.got ? 'rgba(140, 226, 200, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                    display: 'grid',
                    placeItems: 'center',
                    color: a.got ? 'var(--brand-mint)' : 'var(--color-text-dim)',
                    flexShrink: 0,
                  }}
                >
                  {a.got ? <AchIcon size={18} /> : <IconLock size={16} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{a.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-dim)', marginTop: 1 }}>{a.desc}</div>
                </div>
                {a.got && (
                  <button
                    onClick={() => shareAchievement(a.name)}
                    style={{
                      border: '1px solid color-mix(in srgb, var(--brand-mint) 30%, transparent)',
                      background: 'color-mix(in srgb, var(--brand-mint) 12%, transparent)',
                      color: 'var(--brand-mint)',
                      borderRadius: 8,
                      padding: '4px 8px',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer',
                    }}
                  >
                    <IconShare size={12} />
                    <span>+25 GP</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <p style={{ fontSize: 11, color: 'var(--color-text-dim)', textAlign: 'center', margin: '4px 0 0' }}>
        Open Deck DJ School · Обучение на базе Rekordbox
      </p>
    </div>
  );
}