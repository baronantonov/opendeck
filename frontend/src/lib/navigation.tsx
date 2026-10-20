import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getTelegramWebApp } from '../types';
import { haptic } from './theme';

interface ModalEntry {
  id: string;
  onClose: () => void;
}

export interface NavigationContextType {
  isExitModalOpen: boolean;
  openExitModal: () => void;
  closeExitModal: () => void;
  registerModal: (id: string, onClose: () => void) => () => void;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const modalStackRef = useRef<ModalEntry[]>([]);
  const isExitModalOpenRef = useRef(false);
  isExitModalOpenRef.current = isExitModalOpen;

  const registerModal = useCallback((id: string, onClose: () => void) => {
    // Добавляем модалку в стек, предварительно удаляя дубликат с таким же ID
    modalStackRef.current = modalStackRef.current.filter((m) => m.id !== id);
    modalStackRef.current.push({ id, onClose });

    return () => {
      modalStackRef.current = modalStackRef.current.filter((m) => m.id !== id);
    };
  }, []);

  const openExitModal = useCallback(() => {
    haptic('warning');
    setIsExitModalOpen(true);
  }, []);

  const closeExitModal = useCallback(() => {
    haptic('light');
    setIsExitModalOpen(false);
  }, []);

  useEffect(() => {
    const tw = getTelegramWebApp();
    if (!tw) return;

    // Включаем нативную кнопку «Назад» Telegram на всех экранах приложения
    try {
      tw.BackButton.show();
    } catch {}

    const handleBackClick = () => {
      // 0. Если открыт ExitConfirmModal — повторное нажатие «Назад» закрывает попап
      if (isExitModalOpenRef.current) {
        closeExitModal();
        return;
      }

      // 1. Если открыта внутренняя модалка (из modalStack) — закрываем ее
      if (modalStackRef.current.length > 0) {
        const topModal = modalStackRef.current.pop();
        if (topModal) {
          haptic('light');
          topModal.onClose();
          return;
        }
      }

      // 2. Если открыт внутренний экран (не на Главной) — возвращаем на Главную
      const path = location.pathname;
      const isHome = path === '/' || path === '/home';
      if (!isHome) {
        haptic('light');
        navigate('/');
        return;
      }

      // 3. Одиночный тап «Назад» на Главной — открываем ExitConfirmModal с тактильным предупреждением
      openExitModal();
    };

    try {
      tw.BackButton.onClick(handleBackClick);
    } catch {}

    return () => {
      try {
        tw.BackButton.offClick(handleBackClick);
      } catch {}
    };
  }, [location.pathname, navigate, openExitModal]);

  return (
    <NavigationContext.Provider
      value={{
        isExitModalOpen,
        openExitModal,
        closeExitModal,
        registerModal,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationContextType {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return ctx;
}

/**
 * Хук для регистрации любой модалки в сквозном стеке кнопки «Назад»
 */
export function useRegisterModal(id: string, isOpen: boolean, onClose: () => void) {
  const { registerModal } = useNavigation();

  useEffect(() => {
    if (!isOpen) return;
    const unregister = registerModal(id, onClose);
    return unregister;
  }, [id, isOpen, onClose, registerModal]);
}
