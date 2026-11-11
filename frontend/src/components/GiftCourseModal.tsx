import { useState, useId, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { haptic } from '../lib/theme';
import { useRegisterModal } from '../lib/navigation';
import { useToast } from './Toast';
import { apiCreateInvoice } from '../api/client';
import { openTelegramStarsInvoice } from '../payment/Paywall';
import { getTelegramWebApp } from '../types';
import {
  Gift,
  ArrowLeft,
  Sparkles,
  Send,
  CheckCircle2,
  AlertCircle,
  Headphones,
  Sliders,
  Users,
  ShieldCheck,
} from 'lucide-react';
import { ShimmerButton, StaggerContainer, StaggerItem } from './MotionWrappers';
import { AbstractGeometryBg } from './LiquidGlassGeometry';

export interface GiftCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId?: string;
  courseTitle?: string;
  priceStars?: number;
}

export interface GiftRecord {
  id: string;
  recipient: string;
  courseId: string;
  date: number;
  token?: string;
}

export const TELEGRAM_USERNAME_REGEX = /^[a-zA-Z0-9_]{5,32}$/;

export function normalizeTelegramUsername(input: string): string {
  if (!input) return '';
  let cleaned = input.trim();
  cleaned = cleaned.replace(/^(?:https?:\/\/)?(?:www\.)?(?:t\.me\/|telegram\.me\/)/i, '');
  cleaned = cleaned.replace(/^@+/, '');
  cleaned = cleaned.replace(/[^a-zA-Z0-9_]/g, '');
  return cleaned;
}

export function GiftCourseModal({
  isOpen,
  onClose,
  courseId = 'dj-basics',
  courseTitle = 'Pocket DJ',
  priceStars = 2500,
}: GiftCourseModalProps) {
  const [rawInput, setRawInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<'input' | 'success'>('input');
  const [giftResult, setGiftResult] = useState<GiftRecord | null>(null);
  const inputId = useId();
  const { toast } = useToast();

  useRegisterModal('gift-course-modal', isOpen, () => {
    if (!busy) {
      handleClose();
    }
  });

  useEffect(() => {
    if (isOpen) {
      haptic('light');
      setStep('input');
      setGiftResult(null);
      setRawInput('');
      setBusy(false);

      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const tw = getTelegramWebApp();
  const myUsername = (tw?.initDataUnsafe?.user?.username || '').toLowerCase();

  const cleanRecipient = normalizeTelegramUsername(rawInput);
  const isTooShort = cleanRecipient.length > 0 && cleanRecipient.length < 5;
  const isTooLong = cleanRecipient.length > 32;
  const isFormatInvalid = cleanRecipient.length >= 5 && !TELEGRAM_USERNAME_REGEX.test(cleanRecipient);
  const isSelfGift = cleanRecipient.length > 0 && cleanRecipient.toLowerCase() === myUsername;
  const isValid = TELEGRAM_USERNAME_REGEX.test(cleanRecipient) && !isSelfGift;

  const handleClose = () => {
    if (busy) return;
    haptic('light');
    onClose();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRawInput(e.target.value);
  };

  const handleCheckoutGift = async () => {
    if (!isValid || busy) return;
    setBusy(true);
    haptic('light');

    try {
      const invoiceData = await apiCreateInvoice({
        course_id: courseId,
        provider: 'stars',
        gift_recipient: cleanRecipient,
      });

      const invoiceLink = invoiceData?.invoice_link;
      if (!invoiceLink) {
        toast('✕', 'Не удалось сформировать счёт подарка.');
        setBusy(false);
        return;
      }

      const status = await openTelegramStarsInvoice(invoiceLink, {
        onPaid: () => {
          haptic('success');
          const gift: GiftRecord = {
            id: `gift_${Date.now()}_${cleanRecipient}`,
            recipient: cleanRecipient,
            courseId,
            date: Date.now(),
            token: invoiceData?.gift_token,
          };

          try {
            const rawStored = localStorage.getItem('opendeck_gifts_history') || '[]';
            const history: GiftRecord[] = JSON.parse(rawStored);
            history.unshift(gift);
            localStorage.setItem('opendeck_gifts_history', JSON.stringify(history));

            tw?.CloudStorage?.setItem?.(
              'opendeck_gifts_history',
              JSON.stringify(history.slice(0, 10)),
              () => {},
            );
          } catch {
            /* ignore storage issues */
          }

          setGiftResult(gift);
          setStep('success');
        },
        onFailed: () => {
          haptic('error');
          toast('✕', 'Оплата подарка не прошла.');
        },
        onCancelled: () => {},
        onPending: () => {
          toast('ℹ', 'Платёж обрабатывается...');
        },
      });

      if (status === 'fallback') {
        toast('ℹ', 'Счёт Telegram Stars открыт в приложении Telegram.');
      }
    } catch (err) {
      console.error('Gift checkout error:', err);
      toast('✕', 'Ошибка сети при создании подарка.');
    } finally {
      setBusy(false);
    }
  };

  const handleSendTelegramInvite = () => {
    if (!giftResult) return;
    haptic('light');

    const botUsername = 'OpenDeck_bot';
    const recipient = giftResult.recipient;
    const sender = tw?.initDataUnsafe?.user?.first_name || 'Твой друг';

    const shareText = `Привет, @${recipient}! ${sender} дарит тебе полный курс «${courseTitle}» в Open Deck DJ School!\n\nТебя ждут 10 практических уроков сведения, виртуальная DJ-дека в телефоне и пропуск в закрытый DJ camp.\n\nЗабирай доступ по ссылке:`;
    const giftParam = giftResult.token ? `gift_${recipient}__${giftResult.token}` : `gift_${recipient}`;
    const shareUrl = `https://t.me/${botUsername}/app?startapp=${giftParam}`;
    const shareLink = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;

    if (tw?.openTelegramLink) {
      tw.openTelegramLink(shareLink);
    } else {
      window.open(shareLink, '_blank');
    }
  };

  const screenContent = (
    <div
      className="fixed inset-0 z-[999] flex h-[100dvh] w-full flex-col overflow-y-auto overflow-x-hidden bg-[#2b302e] text-[var(--color-text)] select-none scroll-y"
      style={{
        paddingTop:
          'calc(max(env(safe-area-inset-top, 0px), var(--app-safe-top, 0px), var(--safe-top, 0px)) + 16px)',
        paddingBottom:
          'calc(max(env(safe-area-inset-bottom, 0px), var(--app-safe-bottom, 0px), var(--safe-bottom, 0px)) + 32px)',
        boxSizing: 'border-box',
      }}
      aria-modal="true"
      role="dialog"
    >
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-4 px-4">
        {/* Верхняя навигационная панель в стиле Liquid Glass */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="liquid-glass-pill inline-flex cursor-pointer items-center gap-1.5 rounded-2xl border-0 px-3.5 py-2 text-xs font-bold text-[#f4f7f5] active:scale-[0.97] transition-all duration-200 ease-out"
          >
            <ArrowLeft size={15} />
            <span>Назад</span>
          </button>

          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--brand-coral)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)]"
            style={{
              background: 'color-mix(in srgb, var(--brand-coral) 15%, var(--color-surface-2))',
            }}
          >
            <Gift size={12} />
            <span>Подарок другу</span>
          </div>
        </div>

        {step === 'input' && (
          <StaggerContainer stepMs={60} className="flex flex-1 flex-col gap-4">
            {/* 1. Флагманская Hero-карточка подарка */}
            <StaggerItem index={0}>
              <div
                className="relative overflow-hidden rounded-3xl p-5 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),0_16px_42px_rgba(0,0,0,0.48)]"
                style={{
                  background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
                }}
              >
                <AbstractGeometryBg variant="hero" spheres={2} accent="coral" />

                <div className="relative z-10 flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--brand-mint)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)]"
                      style={{
                        background: 'color-mix(in srgb, var(--brand-mint) 14%, var(--color-surface-2))',
                      }}
                    >
                      <Sparkles size={12} />
                      <span>Эксклюзивный инвайт</span>
                    </span>

                    <span
                      className="rounded-full px-3 py-1 text-xs font-extrabold text-[var(--brand-gold)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)]"
                      style={{
                        background: 'color-mix(in srgb, var(--brand-gold) 15%, var(--color-surface-2))',
                      }}
                    >
                      {priceStars.toLocaleString('ru-RU')} Stars
                    </span>
                  </div>

                  <div className="flex items-center gap-3.5">
                    <div
                      className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-[var(--brand-coral)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.18),0_0_24px_rgba(245,146,110,0.2)]"
                      style={{
                        background: 'color-mix(in srgb, var(--brand-coral) 16%, var(--color-surface-2))',
                      }}
                    >
                      <Gift size={26} />
                    </div>
                    <div>
                      <h1 className="brand-text m-0 text-2xl font-extrabold tracking-tight">
                        ПОДАРИТЬ «{courseTitle.toUpperCase()}»
                      </h1>
                      <p className="m-0 mt-1 text-xs font-semibold text-[var(--color-text-dim)]">
                        Мгновенный доступ другу по @username
                      </p>
                    </div>
                  </div>

                  <p className="m-0 text-[13.5px] leading-relaxed text-[var(--color-text-dim)]">
                    Подари близкому человеку не просто курс, а новую точку опоры и творческий поток. Мы сформируем именной доступ сразу после оплаты.
                  </p>

                  {/* Состав подарка в матовых капсулах */}
                  <div
                    className="flex flex-col gap-3 rounded-2xl p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                    style={{
                      background: 'color-mix(in srgb, var(--color-surface-2) 30%, transparent)',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[var(--brand-mint)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
                        style={{ background: 'color-mix(in srgb, var(--brand-mint) 15%, transparent)' }}
                      >
                        <Headphones size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-bold text-[var(--color-text)]">
                          10 практических уроков «{courseTitle}»
                        </div>
                        <div className="text-xs text-[var(--color-text-dim)]">
                          От первого бита и колеса Камелота до записи собственного сета.
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div
                        className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[var(--brand-coral)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
                        style={{ background: 'color-mix(in srgb, var(--brand-coral) 15%, transparent)' }}
                      >
                        <Users size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-bold text-[var(--color-text)]">
                          Пропуск в закрытое «Племя» (DJ Camp)
                        </div>
                        <div className="text-xs text-[var(--color-text-dim)]">
                          Доступ в закрытый чат резидентов, поддержка и разборы миксов.
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div
                        className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[var(--brand-gold)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
                        style={{ background: 'color-mix(in srgb, var(--brand-gold) 15%, transparent)' }}
                      >
                        <Sliders size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-bold text-[var(--color-text)]">
                          Виртуальный пульт Rekordbox + скидка $100
                        </div>
                        <div className="text-xs text-[var(--color-text-dim)]">
                          Тренажер в смартфоне и до −$100 за прохождение на личное менторство.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </StaggerItem>

            {/* 2. Карточка получателя и оформления */}
            <StaggerItem index={1}>
              <div
                className="relative overflow-hidden rounded-3xl p-5 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_12px_32px_rgba(0,0,0,0.4)]"
                style={{
                  background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
                }}
              >
                <AbstractGeometryBg variant="card" spheres={0} accent="mint" />

                <div className="relative z-10 flex flex-col gap-3.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor={inputId}
                      className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-text)]"
                    >
                      Получатель подарка в Telegram
                    </label>
                    <span className="text-[11px] font-semibold text-[var(--brand-mint)]">
                      @username
                    </span>
                  </div>

                  <div
                    className="flex items-center rounded-2xl px-4 py-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] transition-all duration-200"
                    style={{
                      background: 'rgba(14, 17, 16, 0.55)',
                      boxShadow:
                        isSelfGift || isTooShort || isTooLong || isFormatInvalid
                          ? 'inset 0 0 0 1.5px var(--brand-coral)'
                          : isValid
                            ? 'inset 0 0 0 1.5px var(--brand-mint)'
                            : 'inset 0 1px 1px rgba(255, 255, 255, 0.14)',
                    }}
                  >
                    <span
                      className="mr-1.5 select-none text-base font-extrabold"
                      style={{
                        color: isValid ? 'var(--brand-mint)' : 'var(--color-text-dim)',
                      }}
                    >
                      @
                    </span>
                    <input
                      id={inputId}
                      type="text"
                      value={rawInput}
                      onChange={handleInputChange}
                      placeholder="username_druga"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck="false"
                      className="flex-1 bg-transparent py-2.5 text-[15px] font-bold text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-dim)]/50"
                    />
                    {cleanRecipient && (
                      <button
                        type="button"
                        onClick={() => setRawInput('')}
                        className="grid h-6 w-6 cursor-pointer place-items-center rounded-full border-0 bg-white/10 text-xs text-[var(--color-text-dim)] active:scale-95"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Статус валидации */}
                  {isSelfGift ? (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--brand-coral)]">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>Ты указал собственный юзернейм. Подарок предназначен другу!</span>
                    </div>
                  ) : isTooShort ? (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--brand-coral)]">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>Минимум 5 символов по стандарту Telegram</span>
                    </div>
                  ) : isTooLong ? (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--brand-coral)]">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>Максимум 32 символа по стандарту Telegram</span>
                    </div>
                  ) : isFormatInvalid ? (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--brand-coral)]">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>Допустимы только латиница, цифры и символ _</span>
                    </div>
                  ) : isValid ? (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--brand-mint)]">
                      <CheckCircle2 size={14} className="shrink-0" />
                      <span>Именной доступ будет активирован для @{cleanRecipient}</span>
                    </div>
                  ) : (
                    <div className="text-[11.5px] leading-snug text-[var(--color-text-dim)]">
                      Можно вставить прямую ссылку (t.me/username) или ник через @ — мы распознаем автоматически.
                    </div>
                  )}

                  <div className="pt-1 flex flex-col gap-2.5">
                    <ShimmerButton
                      variant="coral"
                      block
                      shimmer
                      hapticFeedback="light"
                      disabled={!isValid || busy}
                      onClick={handleCheckoutGift}
                      className="h-13 py-3.5 rounded-2xl text-base font-bold"
                    >
                      {busy ? (
                        'Открываем Telegram Stars...'
                      ) : (
                        <>
                          <Gift size={18} />
                          <span>Оформить подарок · {priceStars.toLocaleString('ru-RU')} Stars</span>
                        </>
                      )}
                    </ShimmerButton>

                    <div className="flex items-center justify-center gap-1.5 text-center text-[11.5px] text-[var(--color-text-dim)]">
                      <ShieldCheck size={14} className="text-[var(--brand-mint)]" />
                      <span>Мгновенная генерация подарочной ссылки после оплаты</span>
                    </div>
                  </div>
                </div>
              </div>
            </StaggerItem>
          </StaggerContainer>
        )}

        {/* ЭКРАН 2: ПОЛНОЭКРАННЫЙ УСПЕХ И ОТПРАВКА ПОДАРКА */}
        {step === 'success' && giftResult && (
          <StaggerContainer stepMs={60} className="flex flex-1 flex-col justify-center gap-4">
            <StaggerItem index={0}>
              <div
                className="relative overflow-hidden rounded-3xl p-6 text-center backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),0_16px_42px_rgba(0,0,0,0.48)]"
                style={{
                  background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
                }}
              >
                <AbstractGeometryBg variant="hero" spheres={2} accent="mint" />

                <div className="relative z-10 flex flex-col items-center gap-4">
                  <div
                    className="grid h-18 w-18 place-items-center rounded-3xl text-[var(--brand-mint)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),0_0_28px_rgba(140,226,200,0.32)]"
                    style={{
                      background: 'color-mix(in srgb, var(--brand-mint) 18%, var(--color-surface-2))',
                    }}
                  >
                    <Sparkles size={34} />
                  </div>

                  <div>
                    <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wider text-[var(--brand-mint)]">
                      Подарок активирован
                    </div>
                    <h2 className="brand-text m-0 text-2xl font-extrabold tracking-tight">
                      ГОТОВО К ВРУЧЕНИЮ!
                    </h2>
                    <p className="m-0 mt-2 text-[13.5px] leading-relaxed text-[var(--color-text-dim)]">
                      Полный курс «{courseTitle}» успешно закреплён за пользователем{' '}
                      <b className="text-[var(--brand-mint)]">@{giftResult.recipient}</b>.
                    </p>
                  </div>

                  <div
                    className="w-full rounded-2xl p-4 text-left text-xs leading-relaxed text-[var(--color-text-dim)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                    style={{
                      background: 'color-mix(in srgb, var(--color-surface-2) 35%, transparent)',
                    }}
                  >
                    Нажми кнопку ниже, чтобы отправить красивое приглашение в Telegram. Как только{' '}
                    <b className="text-[var(--color-text)]">@{giftResult.recipient}</b> откроет приложение, все 10 уроков и DJ Camp разблокируются автоматически!
                  </div>

                  <div className="flex w-full flex-col gap-2.5 pt-1">
                    <ShimmerButton
                      variant="mint"
                      block
                      shimmer
                      hapticFeedback="light"
                      onClick={handleSendTelegramInvite}
                      className="button-glow-pulse h-13 py-3.5 rounded-2xl text-base font-bold"
                    >
                      <Send size={18} />
                      <span>Отправить подарок в Telegram</span>
                    </ShimmerButton>

                    <button
                      type="button"
                      onClick={handleClose}
                      className="inline-flex h-13 w-full cursor-pointer items-center justify-center rounded-2xl border-0 py-3.5 text-base font-bold text-[var(--color-text)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)] active:scale-[0.97] transition-all duration-200 ease-out"
                      style={{
                        background: 'color-mix(in srgb, var(--color-surface-2) 75%, transparent)',
                      }}
                    >
                      Вернуться в приложение
                    </button>
                  </div>
                </div>
              </div>
            </StaggerItem>
          </StaggerContainer>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(screenContent, document.body) : screenContent;
}
