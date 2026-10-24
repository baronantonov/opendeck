import { useState, useMemo } from 'react';
import { useApp } from '../state/store';
import { useCourseProgress } from '../state/CourseProgressContext';
import { ProfileHeroCard } from '../components/profile/ProfileHeroCard';
import { ProducerDevPanel } from '../components/profile/ProducerDevPanel';
import {
  Button,
  Card,
  ProgressBar,
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
import { StaggerContainer, StaggerItem } from '../components/MotionWrappers';
import { AbstractGeometryBg } from '../components/LiquidGlassGeometry';
import { useToast } from '../components/Toast';
import { apiArchetypeShare, apiGpEarn } from '../api/client';
import { haptic } from '../lib/theme';
import { getCanonicalReferralUrl } from '../lib/securityGuard';
import { getTelegramWebApp } from '../types';

interface Rank {
  title: string;
  minGp: number;
  tag: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}

interface GpEarnResult {
  _err?: string;
  groove_points?: number;
  amount?: number;
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
  { action: 'invite_team', label: 'Позвать в команду', reward: 50, icon: IconUsers },
  { action: 'review', label: 'Оставить отзыв о курсе', reward: 50, icon: IconTrophy },
];

export function ProfileScreen() {
  const { user, setUser, course, referralFriends, referralGpEarned } = useApp();
  const { completedLessons, userId } = useCourseProgress();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const dc = Math.min(10, Math.max(course.completedLessons.length, completedLessons.length));
  const referralUrl = useMemo(
    () => getCanonicalReferralUrl(userId, user.referralCode),
    [userId, user.referralCode],
  );

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
    haptic('light');
    setBusy(action);
    try {
      const j = (await apiGpEarn(action)) as GpEarnResult;
      if (j?._err === 'cooldown') {
        toast('i', 'Доступно через 24 часа');
      } else if (j?._err) {
        toast('✕', 'Ошибка начисления');
      } else {
        if (typeof j?.groove_points === 'number') {
          setUser({ groovePoints: j.groove_points });
        }
        toast('✓', `${label}: +${j?.amount || 25} GP`);
      }
    } catch {
      toast('✕', 'Ошибка сети');
    } finally {
      setBusy(null);
    }
  };

  const inviteFriend = async () => {
    haptic('light');
    try {
      const tw = getTelegramWebApp();
      const text = `Залетай в мою команду в Open Deck DJ School (обучение на базе Rekordbox)! Лови +100 GP на старт по моей ссылке:`;
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent(text)}`;
      if (tw?.openTelegramLink) {
        tw.openTelegramLink(shareUrl);
      } else {
        window.open(shareUrl, '_blank');
      }
      await earn('invite_team', 'Позвать в команду');
    } catch {
      /* ignore */
    }
  };

  const shareProfile = async () => {
    haptic('light');
    const text = `Мой DJ-профиль в Open Deck DJ School:
Звание: ${currentRank.title} · Архетип: ${user.archetype}
Прогресс: ${user.groovePoints} GP · ${dc}/10 уроков
Залетай в мою команду на базе Rekordbox (+100 GP на старт):`;
    const link = `https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent(text)}`;

    try {
      const tw = getTelegramWebApp();
      if (tw?.openTelegramLink) {
        tw.openTelegramLink(link);
      } else {
        window.open(link, '_blank');
      }
      const res = (await apiArchetypeShare()) as GpEarnResult;
      if (typeof res?.amount === 'number' && res.amount > 0) {
        toast('✓', `Поделился профилем: +${res.amount} GP`);
      }
    } catch {
      /* ignore */
    }
  };

  const shareAchievement = async (achName: string) => {
    haptic('light');
    const text = `Я открыл достижение «${achName}» в Open Deck DJ School! Залетай в мою команду на базе Rekordbox (+100 GP на старт):`;
    const link = `https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent(text)}`;

    try {
      const tw = getTelegramWebApp();
      if (tw?.openTelegramLink) {
        tw.openTelegramLink(link);
      } else {
        window.open(link, '_blank');
      }
      await earn('share_achievement', `Достижение «${achName}»`);
    } catch {
      /* ignore */
    }
  };

  const achs = [
    { name: 'Первый бит', got: dc >= 1, desc: 'Пройди урок 1 по контроллеру', icon: IconFader },
    { name: 'Половина пути', got: dc >= 5, desc: 'Пройди первые 5 уроков курса', icon: IconWaveform },
    { name: 'Мастер сведения', got: dc >= 7, desc: 'Освой кроссфейдер, лупы и фильтры', icon: IconSparkles },
    { name: 'DJ-сет собран', got: dc >= 10, desc: 'Заверши все 10 уроков курса', icon: IconDisc },
    { name: 'Мастер нетворкинга', got: referralFriends >= 3, desc: 'Позови 3 участников в команду', icon: IconUsers },
    { name: 'Архетип раскрыт', got: !!user.archetype, desc: 'Определи свой персональный вайб', icon: IconFlame },
    { name: 'Золотой резерв', got: user.groovePoints >= 300, desc: 'Накопи 300+ GP на скидку созвона', icon: IconTrophy },
  ];

  const RankIcon = currentRank.icon;

  return (
    <StaggerContainer
      stepMs={60}
      className="px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+108px)] flex flex-col gap-4"
    >
      {/* 1. Единый Liquid Glass Паспорт Диджея (UserAvatar SWR + X/10 + статус) */}
      <StaggerItem>
        <ProfileHeroCard />
      </StaggerItem>

      {/* 2. Интегрированный Пульт Продюсера / Dev Mode (для владельца) */}
      <StaggerItem>
        <ProducerDevPanel />
      </StaggerItem>

      {/* 3. Звание DJ и прогресс ранга */}
      <StaggerItem>
        <Card className="p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-[#c0a0a8] uppercase tracking-wider">
              Твоё звание DJ
            </span>
            <span className="text-[11px] font-bold text-[#9aa3a0] bg-white/[0.06] px-2.5 py-0.5 rounded-full">
              Уровень {currentRankIndex + 1} из {RANKS.length}
            </span>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] flex items-center justify-center text-[#f3c969] shrink-0">
              <RankIcon size={22} color="var(--brand-gold)" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-base font-extrabold text-[#f4f7f5]">{currentRank.title}</div>
              <div className="text-xs text-[#9aa3a0] mt-0.5 leading-snug">{currentRank.desc}</div>
            </div>
          </div>

          {nextRank && (
            <div className="flex flex-col gap-1.5 pt-1">
              <div className="flex items-center justify-between text-xs text-[#9aa3a0]">
                <span>До звания «{nextRank.title}»</span>
                <span className="font-bold text-[#8ce2c8]">
                  {user.groovePoints} / {nextRank.minGp} GP
                </span>
              </div>
              <ProgressBar value={rankProgress} />
            </div>
          )}
        </Card>
      </StaggerItem>

      {/* 4. Компактные стеклянные виджеты статистики */}
      <StaggerItem>
        <div className="grid grid-cols-3 gap-3">
          <div className="liquid-glass-card rounded-2xl p-3 text-center flex flex-col items-center gap-1">
            <div className="text-[#8ce2c8]">
              <IconFader size={18} />
            </div>
            <div className="text-base font-extrabold text-[#f4f7f5]">{dc}/10</div>
            <div className="text-[11px] font-medium text-[#9aa3a0]">Уроков</div>
          </div>

          <div className="liquid-glass-card rounded-2xl p-3 text-center flex flex-col items-center gap-1">
            <div className="text-[#c0a0a8]">
              <IconSparkles size={18} />
            </div>
            <div className="text-base font-extrabold text-[#f4f7f5]">{user.groovePoints}</div>
            <div className="text-[11px] font-medium text-[#9aa3a0]">Баланс GP</div>
          </div>

          <div className="liquid-glass-card rounded-2xl p-3 text-center flex flex-col items-center gap-1">
            <div className="text-[#f3c969]">
              <IconUsers size={18} />
            </div>
            <div className="text-base font-extrabold text-[#f4f7f5]">{referralFriends}</div>
            <div className="text-[11px] font-medium text-[#9aa3a0]">Команда</div>
          </div>
        </div>
      </StaggerItem>

      {/* 5. Команда и реферальная программа (Liquid Glass + 2-я сфера на экране) */}
      <StaggerItem>
        <div className="liquid-glass-card relative overflow-hidden rounded-3xl p-5 flex flex-col gap-3.5">
          <AbstractGeometryBg
            variant="card"
            spheres={1}
            primaryColor="var(--brand-gold)"
            secondaryColor="var(--brand-mint)"
          />

          <div className="relative z-10 flex flex-col gap-1.5">
            <h3 className="m-0 text-base font-extrabold text-[#f4f7f5]">
              Команда и реферальная программа
            </h3>
            <p className="m-0 text-xs text-[#9aa3a0] leading-relaxed">
              Получай <b className="text-[#f4f7f5]">+100 GP</b> за каждого участника в команде и{' '}
              <b className="text-[#f4f7f5]">+500 GP</b> при покупке им курса. Очки дают прямую
              скидку на созвоны с FREEDA DJ.
            </p>
            {referralGpEarned > 0 && (
              <div className="text-xs font-extrabold text-[#f3c969] mt-0.5">
                Заработано с командой: +{referralGpEarned} GP
              </div>
            )}
          </div>

          <div className="relative z-10 flex flex-col gap-2.5">
            <Button
              variant="mint"
              block
              onClick={inviteFriend}
              className="whitespace-nowrap px-4 text-[15px] sm:text-base"
            >
              <IconUsers size={16} />
              <span className="whitespace-nowrap">Позвать в команду (+100 GP)</span>
            </Button>
            <Button
              variant="secondary"
              block
              onClick={shareProfile}
              className="whitespace-nowrap px-4 text-[15px] sm:text-base"
            >
              <IconShare size={16} />
              <span className="whitespace-nowrap">Поделиться профилем (+25 GP)</span>
            </Button>
          </div>
        </div>
      </StaggerItem>

      {/* 6. Заработок Groove Points (GP) — без горизонтальных полос, на стеклянных капсулах */}
      <StaggerItem>
        <Card className="p-5 flex flex-col gap-3">
          <div className="text-xs font-extrabold uppercase tracking-wider text-[#9aa3a0]">
            Заработок Groove Points (GP)
          </div>
          <div className="flex flex-col gap-2">
            {EARN_ACTIONS.map((a) => {
              const ActionIcon = a.icon;
              return (
                <button
                  key={a.action}
                  type="button"
                  disabled={busy === a.action}
                  onClick={() => {
                    if (a.action === 'invite_team') {
                      void inviteFriend();
                    } else if (a.action === 'share_achievement') {
                      void shareProfile();
                    } else {
                      void earn(a.action, a.label);
                    }
                  }}
                  className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-[#2b302e]/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] text-[#f4f7f5] text-xs font-bold active:scale-[0.97] transition-all duration-200 ease-out cursor-pointer border-0 disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#8ce2c8]/12 text-[#8ce2c8] flex items-center justify-center shrink-0">
                    <ActionIcon size={16} />
                  </div>
                  <span className="flex-1 text-left">{a.label}</span>
                  <b className="text-[#f3c969] text-xs font-extrabold shrink-0">+{a.reward} GP</b>
                </button>
              );
            })}
          </div>
        </Card>
      </StaggerItem>

      {/* 7. Достижения и ачивки */}
      <StaggerItem>
        <Card className="p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-base font-extrabold text-[#f4f7f5]">Достижения резидента</span>
            <span className="text-xs font-bold text-[#9aa3a0] bg-white/[0.06] px-2.5 py-0.5 rounded-full">
              {achs.filter((a) => a.got).length} / {achs.length}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {achs.map((a) => {
              const AchIcon = a.icon;
              return (
                <div
                  key={a.name}
                  className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${
                    a.got
                      ? 'bg-[#8ce2c8]/10 shadow-[inset_0_1px_1px_rgba(140,226,200,0.22)] opacity-100'
                      : 'bg-white/[0.03] shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] opacity-55'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      a.got ? 'bg-[#8ce2c8]/15 text-[#8ce2c8]' : 'bg-white/[0.05] text-[#9aa3a0]'
                    }`}
                  >
                    {a.got ? <AchIcon size={18} /> : <IconLock size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-[#f4f7f5]">{a.name}</div>
                    <div className="text-[11px] text-[#9aa3a0] mt-0.5 leading-snug">{a.desc}</div>
                  </div>
                  {a.got && (
                    <button
                      type="button"
                      onClick={() => void shareAchievement(a.name)}
                      className="px-2.5 py-1.5 rounded-xl bg-[#8ce2c8]/15 shadow-[inset_0_1px_1px_rgba(140,226,200,0.28)] text-[#8ce2c8] text-[11px] font-bold flex items-center gap-1 active:scale-[0.97] transition-all duration-200 ease-out cursor-pointer border-0 shrink-0"
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
      </StaggerItem>
    </StaggerContainer>
  );
}
