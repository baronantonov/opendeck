import { memo } from 'react';

export type UserTier = 'guest' | 'player';

export interface StatusBadgeProps {
  /** Флаг статуса: true — 'player' (курс куплен), false — 'guest' (без курса) */
  isPlayer?: boolean;
  /** Альтернативно явный tier */
  tier?: UserTier;
  /** Размер бейджа: 'sm' (для шапок/виджетов) | 'md' (для карточек/паспорта) */
  size?: 'sm' | 'md';
  /** Дополнительные CSS-классы */
  className?: string;
  /** Кастомные стили */
  style?: React.CSSProperties;
}

/**
 * Единый эталонный значок статуса пользователя в Open Deck DJ School:
 * — До покупки курса: серебристый значок "GUEST" (с матовым металлическим отливом).
 * — После покупки курса: благородный золотой значок "PLAYER" (с мягким золотым свечением).
 *
 * Выглядит абсолютно идентично и консистентно во всех экранах и полях приложения.
 */
export const StatusBadge = memo(function StatusBadge({
  isPlayer,
  tier,
  size = 'sm',
  className = '',
  style,
}: StatusBadgeProps) {
  const activeTier: UserTier = tier ?? (isPlayer ? 'player' : 'guest');
  const isGold = activeTier === 'player';

  const sizeClasses =
    size === 'md'
      ? 'px-2.5 py-1 text-[10.5px] gap-1.5'
      : 'px-2 py-0.5 text-[9.5px] gap-1.5';

  const dotSizeClass = size === 'md' ? 'w-1.5 h-1.5' : 'w-1.5 h-1.5';

  return (
    <span
      className={`inline-flex items-center shrink-0 rounded-full font-black uppercase tracking-wider leading-none select-none transition-all duration-200 transform-gpu ${sizeClasses} ${
        isGold
          ? 'bg-gradient-to-r from-[#f3c969]/28 via-[#e5b746]/20 to-[#f3c969]/28 text-[#f3c969] border border-[#f3c969]/60 shadow-[inset_0_1px_1px_rgba(255,240,180,0.55),0_0_12px_rgba(243,201,105,0.32)]'
          : 'bg-gradient-to-r from-white/[0.14] via-slate-200/[0.08] to-white/[0.12] text-[#e2e8f0] border border-slate-300/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.3)]'
      } ${className}`}
      style={style}
    >
      <span
        className={`rounded-full shrink-0 ${dotSizeClass} ${
          isGold
            ? 'bg-[#f3c969] shadow-[0_0_8px_#f3c969] animate-organic-pulse'
            : 'bg-slate-200 shadow-[0_0_6px_rgba(255,255,255,0.9)]'
        }`}
      />
      <span className="font-extrabold tracking-widest">
        {isGold ? 'PLAYER' : 'GUEST'}
      </span>
    </span>
  );
});

export default StatusBadge;
