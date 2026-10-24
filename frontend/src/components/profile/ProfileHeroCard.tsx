import { useApp } from '../../state/store';
import { useCourseProgress } from '../../state/CourseProgressContext';
import { getUserRank } from '../../lib/constants';
import { Star, IconHeadphones, IconSparkles } from '../ui';
import { useToast } from '../Toast';
import { haptic } from '../../lib/theme';
import { UserAvatar } from '../UserAvatar';
import { AbstractGeometryBg } from '../LiquidGlassGeometry';
import { getTelegramWebApp } from '../../types';
import { ShieldCheck } from 'lucide-react';

/**
 * Тип пользователя из официального Telegram Web App SDK.
 */
export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

/**
 * Безопасное чтение данных пользователя напрямую из window.Telegram.WebApp.initDataUnsafe.
 */
export function getTelegramUser(): TelegramUser | null {
  const tw = getTelegramWebApp();
  const u = tw?.initDataUnsafe?.user;
  if (!u || typeof u.id !== 'number') return null;
  return {
    id: u.id,
    first_name: u.first_name || 'DJ',
    last_name: u.last_name,
    username: u.username,
    language_code: u.language_code,
    is_premium: u.is_premium,
    photo_url: u.photo_url,
  };
}

/**
 * Скелетон паспорта диджея (Zero CLS, плавная пульсация).
 */
export function ProfileHeroCardSkeleton() {
  return (
    <div className="liquid-glass-card rounded-3xl p-5 animate-pulse flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-white/[0.08] shrink-0" />
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="w-2/3 h-5 rounded-md bg-white/[0.12]" />
          <div className="w-2/5 h-3.5 rounded bg-white/[0.06]" />
          <div className="flex gap-2 mt-1">
            <div className="w-20 h-6 rounded-full bg-white/[0.08]" />
            <div className="w-24 h-6 rounded-full bg-white/[0.08]" />
          </div>
        </div>
      </div>
      <div className="w-full h-12 rounded-2xl bg-white/[0.05]" />
    </div>
  );
}

/**
 * Единая стильная Liquid Glass карта резидента OpenDeck («Паспорт диджея»):
 * Крупный UserAvatar (SWR), статус доступа, шкала прогресса X / 10 и метрики резидента.
 */
export function ProfileHeroCard() {
  const { user, course, isPaid, loading } = useApp();
  const { isCoursePurchased, completedLessons } = useCourseProgress();
  const { toast } = useToast();

  // 1. Получение нативных данных Telegram SDK
  const tgUser = getTelegramUser();

  // 2. Сборка полного имени
  const firstName = tgUser?.first_name || user.name || 'DJ';
  const lastName = tgUser?.last_name || user.lastName || '';
  const displayName = lastName ? `${firstName} ${lastName}` : firstName;

  // 3. Юзернейм
  const username = tgUser?.username || user.username || '';
  const usernameDisplay = username ? `@${username}` : tgUser?.id ? `ID: ${tgUser.id}` : '';

  // 4. Статус Telegram Premium и доступ к курсу
  const isPremium = Boolean(tgUser?.is_premium || user.isPremium);
  const hasProAccess = isPaid || isCoursePurchased;

  // 5. Бизнес-метрики и прогресс X / 10
  const groovePoints = user.groovePoints ?? 0;
  const rank = getUserRank(groovePoints);
  const dc = Math.min(10, Math.max(course.completedLessons.length, completedLessons.length));
  const tc = 10;
  const progressPct = Math.round((dc / tc) * 100);
  const archetype = user.archetype || 'Куратор Вайба';

  const copyReferral = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    haptic('light');
    const code = user.referralCode || 'opendeck';
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(code);
      toast('✓', `Код скопирован: ${code}`);
    } else {
      toast('✓', `Твой код: ${code}`);
    }
  };

  if (loading) {
    return <ProfileHeroCardSkeleton />;
  }

  return (
    <div className="liquid-glass-card relative overflow-hidden rounded-3xl p-5 flex flex-col gap-4">
      <AbstractGeometryBg
        variant="passport"
        spheres={1}
        primaryColor="var(--brand-mint)"
        secondaryColor="var(--brand-mauve)"
      />

      {/* Верхняя плашка паспорта резидента */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <span className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-[#9aa3a0]">
          OPENDECK RESIDENT PASSPORT
        </span>

        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-extrabold uppercase tracking-wider ${
            hasProAccess
              ? 'bg-[#8ce2c8]/15 text-[#8ce2c8] shadow-[inset_0_1px_1px_rgba(140,226,200,0.28)]'
              : 'bg-white/[0.06] text-[#f3c969] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]'
          }`}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-organic-pulse"
            style={{ background: hasProAccess ? 'var(--brand-mint)' : 'var(--brand-gold)' }}
          />
          <ShieldCheck size={12} />
          <span>{hasProAccess ? 'PRO ДОСТУП' : 'БАЗОВЫЙ ДОСТУП'}</span>
        </div>
      </div>

      {/* Основной блок: Крупный UserAvatar + Имя и бейджи */}
      <div className="relative z-10 flex items-center gap-4">
        <div className="relative w-20 h-20 flex-shrink-0">
          <UserAvatar
            size="lg"
            alt={displayName}
            isPremium={isPremium}
            customName={displayName}
          />
          <div
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9.5px] font-extrabold uppercase tracking-wider whitespace-nowrap z-20 shadow-md"
            style={{
              background: 'var(--brand-mint)',
              color: '#11322a',
            }}
          >
            {rank.tag}
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <h2 className="m-0 text-lg font-extrabold text-[#f4f7f5] leading-tight truncate">
            {displayName}
          </h2>

          <div className="flex items-center gap-1.5 text-xs text-[#9aa3a0] truncate">
            {usernameDisplay ? (
              <span className="text-[#8ce2c8] font-semibold">{usernameDisplay}</span>
            ) : (
              <span>Резидент школы</span>
            )}
            <span>•</span>
            <span className="truncate">{archetype}</span>
          </div>

          {/* Бейджи метрик */}
          <div className="flex items-center flex-wrap gap-1.5 mt-1">
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f3c969]/12 shadow-[inset_0_1px_1px_rgba(243,201,105,0.25)]">
              <Star size={12} />
              <b className="text-xs text-[#f3c969]">{groovePoints} GP</b>
            </div>

            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] text-[11px] font-semibold text-[#f4f7f5]">
              <IconHeadphones size={12} color="var(--brand-mauve)" />
              <span>{rank.title}</span>
            </div>

            {user.referralCode && (
              <button
                type="button"
                onClick={copyReferral}
                title="Скопировать реферальный код"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] text-[10.5px] font-bold text-[#8ce2c8] active:scale-[0.97] transition-all duration-200 ease-out cursor-pointer border-0"
              >
                <IconSparkles size={11} color="var(--brand-mint)" />
                <span>{user.referralCode}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Интегрированная шкала прогресса курса Pocket DJ (X / 10) */}
      <div className="relative z-10 rounded-2xl p-3.5 bg-[#2b302e]/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[#f4f7f5]">Прогресс курса «Pocket DJ»</span>
          <span className="font-extrabold text-[#8ce2c8]">
            {dc} / {tc} уроков ({progressPct}%)
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-black/30 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${Math.max(4, progressPct)}%`,
              background: 'linear-gradient(90deg, var(--brand-mint) 0%, var(--brand-coral) 100%)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
