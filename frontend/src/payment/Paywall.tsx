import { PaywallModal } from '../components/PaywallModal';
import { MentorPay } from './MentorPayModal';
import {
  openTelegramStarsInvoice,
  openTelegramLinkFallback,
  openInvoiceOrLink,
  useStarsCheckout,
  type InvoiceStatus,
} from './starsCheckout';

export function Paywall({
  courseId = 'dj-basics',
  open,
  onClose,
}: {
  courseId?: string;
  open: boolean;
  onClose: () => void;
}) {
  return <PaywallModal open={open} onClose={onClose} courseId={courseId} />;
}

export {
  PaywallModal,
  MentorPay,
  openTelegramStarsInvoice,
  openTelegramLinkFallback,
  openInvoiceOrLink,
  useStarsCheckout,
};
export type { InvoiceStatus };
