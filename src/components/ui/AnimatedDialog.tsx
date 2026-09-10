'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialogA11y } from '@/hooks/useDialogA11y';

interface AnimatedDialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  panelClassName?: string;
  backdropClassName?: string;
  /**
   * Nama dialog untuk screen reader. Wajib diisi salah satu — ini ATAU
   * `ariaLabelledBy` — supaya dialog tidak diumumkan tanpa identitas.
   */
  ariaLabel?: string;
  /** `id` heading di dalam dialog, bila judulnya sudah dirender sebagai teks. */
  ariaLabelledBy?: string;
}

const DEFAULT_PANEL =
  'bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full max-h-modal overflow-y-auto';

const DEFAULT_BACKDROP =
  'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';

export function AnimatedDialog({
  isOpen,
  onClose,
  children,
  panelClassName = DEFAULT_PANEL,
  backdropClassName = DEFAULT_BACKDROP,
  ariaLabel,
  ariaLabelledBy,
}: AnimatedDialogProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Fokus awal, kurungan Tab, Escape, kunci scroll body, dan pengembalian fokus
  // ke pemicu — perilaku yang sama persis dengan <Modal>.
  const panelRef = useDialogA11y(isOpen, { onEscape: onClose });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const raf = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setIsVisible(false);
    const timeout = setTimeout(() => setShouldRender(false), 200);
    return () => clearTimeout(timeout);
  }, [isOpen]);

  if (!shouldRender || !mounted) return null;

  return createPortal(
    <div
      className={`${backdropClassName} transition-opacity duration-200 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabelledBy ? undefined : ariaLabel}
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
        className={`${panelClassName} focus:outline-none transition-all duration-200 ease-out ${isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
