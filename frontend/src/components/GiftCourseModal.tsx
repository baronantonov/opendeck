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
  X,
  Sparkles,
  Send,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button } from './ui';
import { ShimmerButton } from './MotionWrappers';
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
      setStep('input');
      setGiftResult(null);
      setRawInput('');
      setBusy(false);
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

  const modalContent = (
    <div
      className="fixed inset-0 z-[999] flex items-end justify-center bg-black/72 p-0 backdrop-blur-xl sm:items-center sm:p-4"
      onClick={handleClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-spring relative w-full max-w-[480px] overflow-y-auto overflow-x-hidden rounded-t-3xl sm:rounded-3xl p-5 pb-[calc(var(--app-safe-bottom,var(--safe-bottom,16px))+20px)] text-[var(--color-text)] backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),0_-16px_48px_rgba(0,0,0,0.68)] transform-gpu select-none"
        style={{
          background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
          maxHeight: '90dvh',
        }}
      >
        <AbstractGeometryBg variant="modal" spheres={1} accent="coral" />

        {/* Индикатор шторки */}
        <div className="relative z-10 mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

        {/* Шапка модального окна */}
        <div className="relative z-10 mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[var(--brand-coral)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.16)]"
              style={{
                background: 'color-mix(in srgb, var(--brand-coral) 18%, var(--color-surface-2))',
              }}
            >
              <Gift size={20} />
            </div>
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--brand-coral)]">
                Подарок другу
              </div>
              <h3 className="m-0 text-lg font-extrabold text-[var(--color-text)]">
                {step === 'input' ? `Подарить курс «${courseTitle}»` : 'Подарок оформлен!'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Закрыть"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--color-text-dim)] backdrop-blur-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)] active:scale-[0.97] transition-all duration-200 ease-out"
            style={{
              background: 'color-mix(in srgb, var(--color-surface-2) 75%, transparent)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ЭКРАН 1: ВВОД USERNAME И ПОДТВЕРЖДЕНИЕ */}
        {step === 'input' && (
          <div className="relative z-10 flex flex-col gap-4">
            <p className="m-0 text-[13px] leading-relaxed text-[var(--color-text-dim)]">
              Укажи Telegram-юзернейм друга. Мы оформим подарочный доступ ко всем 10 урокам, интерактивной деке и закрытому DJ Camp.
            </p>

            {/* Карточка состава подарка */}
            <div
              className="flex flex-col gap-2.5 rounded-2xl p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
              style={{
                background: 'color-mix(in srgb, var(--color-surface-2) 30%, transparent)',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-bold text-[var(--color-text)]">
                  Полный курс «{courseTitle}»
                </span>
                <span className="text-[13.5px] font-extrabold text-[var(--brand-gold)]">
                  {priceStars.toLocaleString('ru-RU')} Stars
                </span>
              </div>
              <div className="flex flex-col gap-1.5 text-xs text-[var(--color-text-dim)]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0 text-[var(--brand-mint)]" />
                  <span>10 практических уроков от первого бита до сета</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0 text-[var(--brand-mint)]" />
                  <span>Виртуальная DJ-дека Pioneer Rekordbox на телефоне</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0 text-[var(--brand-mint)]" />
                  <span>Мгновенный пропуск в закрытый DJ Camp («Племя»)</span>
                </div>
              </div>
            </div>

            {/* Поле ввода Telegram @username */}
            <div className="flex flex-col gap-2">
              <label htmlFor={inputId} className="text-xs font-bold text-[var(--color-text)]">
                Юзернейм получателя в Telegram:
              </label>

              <div
                className="flex items-center rounded-2xl px-3.5 py-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] transition-all duration-200"
                style={{
                  background: 'rgba(14, 17, 16, 0.55)',
                  boxShadow:
                    isSelfGift || isTooShort
                      ? 'inset 0 0 0 1.5px var(--brand-coral)'
                      : isValid
                        ? 'inset 0 0 0 1.5px var(--brand-mint)'
                        : 'inset 0 1px 1px rgba(255, 255, 255, 0.14)',
                }}
              >
                <span
                  className="mr-1 select-none text-base font-extrabold"
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
                    className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-xs text-[var(--color-text-dim)] active:scale-95"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Сообщения валидации */}
              {isSelfGift ? (
                <div className="flex items-center gap-1.5 text-xs text-[var(--brand-coral)]">
                  <AlertCircle size={13} />
                  <span>Ты указал собственный юзернейм. Подарок предназначен другу!</span>
                </div>
              ) : isTooShort ? (
                <div className="flex items-center gap-1.5 text-xs text-[var(--brand-coral)]">
                  <AlertCircle size={13} />
                  <span>Минимум 5 символов по стандарту Telegram</span>
                </div>
              ) : isTooLong ? (
                <div className="flex items-center gap-1.5 text-xs text-[var(--brand-coral)]">
                  <AlertCircle size={13} />
                  <span>Максимум 32 символа по стандарту Telegram</span>
                </div>
              ) : isFormatInvalid ? (
                <div className="flex items-center gap-1.5 text-xs text-[var(--brand-coral)]">
                  <AlertCircle size={13} />
                  <span>Допустимы только латиница, цифры и символ _</span>
                </div>
              ) : isValid ? (
                <div className="flex items-center gap-1.5 text-xs text-[var(--brand-mint)]">
                  <CheckCircle2 size={13} />
                  <span>Подарок будет оформлен для @{cleanRecipient}</span>
                </div>
              ) : (
                <div className="text-[11.5px] text-[var(--color-text-dim)]">
                  Можно вставить ссылку (t.me/username) или ник с @ — мы очистим автоматически.
                </div>
              )}
            </div>

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
                  <span>Подарить курс · {priceStars.toLocaleString('ru-RU')} Stars</span>
                </>
              )}
            </ShimmerButton>
          </div>
        )}

        {/* ЭКРАН 2: УСПЕХ И ОТПРАВКА ИНВАЙТА ДРУГУ */}
        {step === 'success' && giftResult && (
          <div className="relative z-10 flex flex-col gap-4 py-2 text-center">
            <div
              className="mx-auto grid h-16 w-16 place-items-center rounded-3xl text-[var(--brand-mint)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_0_24px_rgba(140,226,200,0.3)]"
              style={{
                background: 'color-mix(in srgb, var(--brand-mint) 18%, var(--color-surface-2))',
              }}
            >
              <Sparkles size={32} />
            </div>

            <div>
              <h3 className="m-0 mb-1.5 text-xl font-extrabold text-[var(--color-text)]">
                Подарок готов к вручению!
              </h3>
              <p className="m-0 text-[13px] leading-relaxed text-[var(--color-text-dim)]">
                Курс «{courseTitle}» успешно оплачен для пользователя{' '}
                <b className="text-[var(--brand-mint)]">@{giftResult.recipient}</b>.
              </p>
            </div>

            <div
              className="rounded-2xl p-3.5 text-left text-xs leading-relaxed text-[var(--color-text-dim)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
              style={{ background: 'rgba(14, 17, 16, 0.45)' }}
            >
              Отправь персональный инвайт другу в Telegram — он перейдет по ссылке и сразу получит открытый курс.
            </div>

            <div className="flex flex-col gap-2.5">
              <ShimmerButton
                variant="mint"
                block
                shimmer
                hapticFeedback="light"
                onClick={handleSendTelegramInvite}
              >
                <Send size={18} />
                <span>Отправить инвайт другу в Telegram</span>
              </ShimmerButton>

              <Button variant="ghost" block onClick={handleClose}>
                Закрыть
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
