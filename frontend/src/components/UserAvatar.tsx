import { memo } from 'react';
import { useUserAvatar } from '../hooks/useUserAvatar';

export type UserAvatarSize = 'sm' | 'md' | 'lg';

export interface UserAvatarProps {
  /** Размер аватара: sm (шапка 48px), md (карточки 56px), lg (профиль 80px) */
  size?: UserAvatarSize;
  /** Пользовательский CSS-класс для контейнера */
  className?: string;
  /** Текст атрибута alt для изображения */
  alt?: string;
  /** Флаг статуса Telegram Premium */
  isPremium?: boolean;
  /** Принудительный URL фото (переопределяет хук при необходимости) */
  customPhotoUrl?: string;
  /** Принудительное имя пользователя для монограммы */
  customName?: string;
}

const SIZE_CONFIGS: Record<
  UserAvatarSize,
  {
    containerSize: string;
    borderRadius: string;
    fontSize: string;
    glowClass: string;
    premiumBadge: { size: string; iconSize: number; offset: string };
  }
> = {
  sm: {
    containerSize: 'w-12 h-12 min-w-12 min-h-12',
    borderRadius: 'rounded-[15px]',
    fontSize: 'text-[17px]',
    glowClass:
      'border border-white/12 shadow-[0_4px_12px_rgba(0,0,0,0.25)]',
    premiumBadge: { size: 'w-4 h-4', iconSize: 9, offset: '-bottom-0.5 -right-0.5' },
  },
  md: {
    containerSize: 'w-14 h-14 min-w-14 min-h-14',
    borderRadius: 'rounded-[18px]',
    fontSize: 'text-[20px]',
    glowClass:
      'border border-[var(--brand-mint)]/40 shadow-[0_4px_16px_rgba(0,0,0,0.35)]',
    premiumBadge: { size: 'w-4.5 h-4.5', iconSize: 10, offset: '-bottom-1 -right-1' },
  },
  lg: {
    containerSize: 'w-20 h-20 min-w-20 min-h-20',
    borderRadius: 'rounded-full',
    fontSize: 'text-[28px]',
    glowClass:
      'border-[2.5px] border-[var(--brand-mint)]/60 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.5),0_0_16px_-2px_rgba(140,226,200,0.25)]',
    premiumBadge: { size: 'w-5 h-5', iconSize: 11, offset: 'bottom-0 right-0' },
  },
};

/**
 * Отказоустойчивый компонент аватара пользователя (OpenDeck SWR Avatar).
 *
 * Особенности:
 * 1. Zero Delay: мгновенно отображает закэшированный аватар из localStorage.
 * 2. Seamless Cross-Fade: аппаратный переход между текущим и обновленным фото (300ms ease-in-out).
 * 3. Fallback: отображает контрастную монограмму на брендовом градиенте при отсутствии или ошибке фото.
 * 4. Telegram Premium: аккуратный индикатор статуса с градиентной подложкой.
 */
export const UserAvatar = memo(function UserAvatar({
  size = 'md',
  className = '',
  alt = 'Аватар пользователя',
  isPremium = false,
  customPhotoUrl,
  customName,
}: UserAvatarProps) {
  const {
    currentUrl,
    incomingUrl,
    isCrossFading,
    monogram,
    completeCrossFade,
  } = useUserAvatar();

  const config = SIZE_CONFIGS[size];

  // Эффективный текущий URL
  const effectiveCurrentUrl = customPhotoUrl !== undefined ? customPhotoUrl : currentUrl;
  const effectiveIncomingUrl = customPhotoUrl !== undefined ? null : incomingUrl;

  // Эффективная монограмма
  const effectiveMonogram = customName
    ? (customName.trim().charAt(0) || 'D').toUpperCase()
    : monogram;

  const hasPhoto = Boolean(effectiveCurrentUrl || effectiveIncomingUrl);

  return (
    <div
      className={`relative select-none flex-shrink-0 ${config.containerSize} ${className}`}
      style={{ userSelect: 'none' }}
    >
      {/* Основной контейнер изображения и монограммы */}
      <div
        className={`relative w-full h-full overflow-hidden flex items-center justify-center ${config.borderRadius} ${config.glowClass}`}
        style={{
          background: hasPhoto
            ? '#161817'
            : 'linear-gradient(135deg, var(--brand-mauve, #c0a0a8) 0%, color-mix(in srgb, var(--brand-mint, #8ce2c8) 50%, var(--brand-mauve, #c0a0a8)) 100%)',
        }}
      >
        {/* Базовый слой: фирменная монограмма (всегда под изображением) */}
        <span
          className={`font-black tracking-tight text-[#1d1f1e] ${config.fontSize}`}
          style={{ textShadow: '0 1px 2px rgba(255,255,255,0.2)' }}
        >
          {effectiveMonogram}
        </span>

        {/* Слой текущего изображения из SWR-кэша */}
        {effectiveCurrentUrl && (
          <img
            src={effectiveCurrentUrl}
            alt={alt}
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        )}

        {/* Слой входящего обновленного изображения (Cross-Fade Transition) */}
        {effectiveIncomingUrl && (
          <img
            src={effectiveIncomingUrl}
            alt={alt}
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            onTransitionEnd={completeCrossFade}
            className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-300 ease-in-out ${
              isCrossFading ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}
      </div>

      {/* Бейдж Telegram Premium */}
      {isPremium && (
        <div
          title="Telegram Premium"
          className={`absolute ${config.premiumBadge.offset} ${config.premiumBadge.size} rounded-full flex items-center justify-center z-10 border-2 border-[var(--color-bg,#0f1110)] shadow-[0_2px_6px_rgba(0,0,0,0.5)]`}
          style={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
          }}
        >
          <svg
            width={config.premiumBadge.iconSize}
            height={config.premiumBadge.iconSize}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M12 2L14.8 8.6L22 9.2L16.5 14L18.2 21L12 17.2L5.8 21L7.5 14L2 9.2L9.2 8.6L12 2Z"
              fill="#ffffff"
            />
          </svg>
        </div>
      )}
    </div>
  );
});
