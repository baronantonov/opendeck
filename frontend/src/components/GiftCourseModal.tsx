import { useState, useId, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { haptic } from '../lib/theme';
import { useRegisterModal } from '../lib/navigation';
import { useToast } from './Toast';
import { apiCreateInvoice } from '../api/client';
import { openTelegramStarsInvoice } from '../payment/Paywall';
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
}

/**
 * Строгий формат Telegram Username: от 5 до 32 символов (латиница, цифры, нижнее подчеркивание)
 */
export const TELEGRAM_USERNAME_REGEX = /^[a-zA-Z0-9_]{5,32}$/;

/**
 * Нормализатор ввода юзернейма:
 * Извлекает чистый юзернейм из ссылок вида https://t.me/username, @username, или просто username.
 */
export function normalizeTelegramUsername(input: string): string {
  if (!input) return '';
  let cleaned = input.trim();
  // Удаляем префиксы веб-ссылок
  cleaned = cleaned.replace(/^(?:https?:\/\/)?(?:www\.)?(?:t\.me\/|telegram\.me\/)/i, '');
  // Удаляем начальный символ @
  cleaned = cleaned.replace(/^@+/, '');
  // Оставляем только допустимые в Telegram символы (латиница, цифры, нижнее подчеркивание)
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

  // Регистрация в стеке навигации TMA: физический BackButton закрывает модалку
  useRegisterModal('gift-course-modal', isOpen, () => {
    if (!busy) {
      handleClose();
    }
  });

  // Сброс состояния при открытии/закрытии
  useEffect(() => {
    if (isOpen) {
      setStep('input');
      setGiftResult(null);
      setRawInput('');
      setBusy(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const tw = (window as any).Telegram?.WebApp;
  const myUsername = (
    tw?.initDataUnsafe?.user?.username || ''
  ).toLowerCase();

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
    haptic('medium');

    try {
      // 1. Создаем инвойс на полный курс для подарка (подарок регистрируется
      //    на сервере; активируется только после реальной оплаты Stars)
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

      // 2. Открываем официальное окно Telegram Stars
      const status = await openTelegramStarsInvoice(invoiceLink, {
        onPaid: () => {
          haptic('success');
          const gift: GiftRecord = {
            id: `gift_${Date.now()}_${cleanRecipient}`,
            recipient: cleanRecipient,
            courseId,
            date: Date.now(),
          };

          // 3. Сохраняем в CloudStorage и localStorage
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
        onCancelled: () => {
          // Пользователь отменил шторку Stars
        },
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
    haptic('medium');

    const botUsername = 'OpenDeck_bot';
    const recipient = giftResult.recipient;
    const sender = tw?.initDataUnsafe?.user?.first_name || 'Твой друг';

    const shareText = `Привет, @${recipient}! 🎁 ${sender} дарит тебе полный курс «${courseTitle}» в Open Deck DJ School!\n\nТебя ждут 6 практических уроков сведения, виртуальная DJ-дека в телефоне и пропуск в закрытый DJ camp.\n\nЗабирай доступ по ссылке:`;
    const shareUrl = `https://t.me/${botUsername}/app?startapp=gift_${recipient}`;
    const shareLink = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;

    if (tw?.openTelegramLink) {
      tw.openTelegramLink(shareLink);
    } else {
      window.open(shareLink, '_blank');
    }
  };

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 0,
        boxSizing: 'border-box',
      }}
      onClick={handleClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--color-surface)',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderBottom: 'none',
          boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.5)',
          padding: '20px 18px calc(var(--app-safe-bottom, var(--safe-bottom, 16px)) + 16px)',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка модального окна */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'color-mix(in srgb, var(--brand-coral) 18%, transparent)',
                color: 'var(--brand-coral)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Gift size={20} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand-coral)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Подарок другу
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                {step === 'input' ? `Подарить курс «${courseTitle}»` : 'Подарок оформлен!'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Закрыть"
            style={{
              border: 'none',
              background: 'rgba(255, 255, 255, 0.06)',
              color: 'var(--color-text-dim)',
              width: 32,
              height: 32,
              borderRadius: 16,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ──────── ЭКРАН 1: ВВОД USERNAME И ПОДТВЕРЖДЕНИЕ ──────── */}
        {step === 'input' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-dim)', lineHeight: 1.45 }}>
              Укажи Telegram-юзернейм друга. Мы оформим подарочный доступ ко всем 6 урокам, интерактивной деке и закрытому DJ Camp.
            </p>

            {/* Карточка состава подарка */}
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                borderRadius: 16,
                padding: '12px 14px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Полный курс «{courseTitle}»</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand-gold)' }}>
                  {priceStars.toLocaleString('ru-RU')} Stars
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-dim)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={13} color="var(--brand-mint)" />
                  <span>6 практических уроков от первого бита до сета</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={13} color="var(--brand-mint)" />
                  <span>Виртуальная DJ-дека Pioneer Rekordbox на телефоне</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={13} color="var(--brand-mint)" />
                  <span>4 бонуса от FREEDA DJ + доступ в DJ Camp</span>
                </div>
              </div>
            </div>

            {/* Поле ввода Telegram @username */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor={inputId} style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>
                Юзернейм получателя в Telegram:
              </label>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(0, 0, 0, 0.35)',
                  borderRadius: 14,
                  border: isSelfGift || isTooShort
                    ? '1.5px solid var(--brand-coral)'
                    : isValid
                      ? '1.5px solid var(--brand-mint)'
                      : '1px solid rgba(255, 255, 255, 0.12)',
                  padding: '4px 12px',
                  transition: 'border-color 0.2s ease',
                }}
              >
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: isValid ? 'var(--brand-mint)' : 'var(--color-text-dim)',
                    marginRight: 4,
                    userSelect: 'none',
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
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--color-text)',
                    fontSize: 15,
                    fontWeight: 700,
                    padding: '10px 0',
                    fontFamily: 'inherit',
                  }}
                />
                {cleanRecipient && (
                  <button
                    type="button"
                    onClick={() => setRawInput('')}
                    style={{
                      border: 'none',
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: 'var(--color-text-dim)',
                      borderRadius: 10,
                      width: 22,
                      height: 22,
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                      fontSize: 11,
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Сообщения валидации */}
              {isSelfGift ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--brand-coral)' }}>
                  <AlertCircle size={13} />
                  <span>Ты указал собственный юзернейм. Подарок предназначен другу!</span>
                </div>
              ) : isTooShort ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--brand-coral)' }}>
                  <AlertCircle size={13} />
                  <span>Минимум 5 символов по стандарту Telegram</span>
                </div>
              ) : isTooLong ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--brand-coral)' }}>
                  <AlertCircle size={13} />
                  <span>Максимум 32 символа по стандарту Telegram</span>
                </div>
              ) : isFormatInvalid ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--brand-coral)' }}>
                  <AlertCircle size={13} />
                  <span>Допустимы только латиница, цифры и символ _</span>
                </div>
              ) : isValid ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--brand-mint)' }}>
                  <CheckCircle2 size={13} />
                  <span>Подарок будет оформлен для @{cleanRecipient}</span>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
                  Можно вставить ссылку (t.me/username) или ник с @ — мы очистим автоматически.
                </div>
              )}
            </div>

            {/* Кнопка оформления подарка */}
            <ShimmerButton
              variant="coral"
              block
              disabled={!isValid || busy}
              onClick={handleCheckoutGift}
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

        {/* ──────── ЭКРАН 2: УСПЕХ И ОТПРАВКА ИНВАЙТА ДРУГУ ──────── */}
        {step === 'success' && giftResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center', padding: '8px 0' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                background: 'color-mix(in srgb, var(--brand-mint) 18%, transparent)',
                color: 'var(--brand-mint)',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto',
                boxShadow: '0 0 24px rgba(140, 226, 200, 0.35)',
              }}
            >
              <Sparkles size={32} />
            </div>

            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800 }}>
                Подарок готов к вручению!
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-dim)', lineHeight: 1.45 }}>
                Курс «{courseTitle}» успешно оплачен для пользователя{' '}
                <b style={{ color: 'var(--brand-mint)' }}>@{giftResult.recipient}</b>.
              </p>
            </div>

            <div
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: 14,
                padding: '12px 14px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: 12,
                color: 'var(--color-text-dim)',
                textAlign: 'left',
                lineHeight: 1.4,
              }}
            >
              Отправь персональный инвайт другу в Telegram — он перейдет по ссылке и сразу получит открытый курс.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Button
                variant="mint"
                block
                onClick={handleSendTelegramInvite}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Send size={18} />
                <span>Отправить инвайт другу в Telegram</span>
              </Button>

              <Button
                variant="ghost"
                block
                onClick={handleClose}
              >
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
