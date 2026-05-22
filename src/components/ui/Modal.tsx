'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Lebar maksimum modal. Default 'md' (448px). */
  size?: ModalSize;
  sideNavPrev?: { onClick: () => void; disabled: boolean; title?: string };
  sideNavNext?: { onClick: () => void; disabled: boolean; title?: string };
  /**
   * Sub-panel yang nempel di kiri modal. Di-render dalam flex container yang sama
   * sehingga ikut animasi & posisi modal. Caller bebas isi konten apa saja
   * (mis. preview hasil OCR). Disembunyikan otomatis di layar <lg.
   */
  sidePanel?: React.ReactNode;
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '3xl': 'sm:max-w-3xl',
};

export function Modal({ isOpen, onClose, title, children, footer, size = 'md', sideNavPrev, sideNavNext, sidePanel }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

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

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!shouldRender || !mounted) return null;

  const modalContent = (
    <div
      className={`fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      {/* Side nav — prev */}
      {sideNavPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); sideNavPrev.onClick(); }}
          disabled={sideNavPrev.disabled}
          title={sideNavPrev.title}
          className="absolute left-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/90 dark:bg-gray-700/90 shadow-lg text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
      )}
      {/* Side nav — next */}
      {sideNavNext && (
        <button
          onClick={(e) => { e.stopPropagation(); sideNavNext.onClick(); }}
          disabled={sideNavNext.disabled}
          title={sideNavNext.title}
          className="absolute right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/90 dark:bg-gray-700/90 shadow-lg text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      )}
      <div
        className={`relative flex items-stretch gap-3 max-w-[calc(100vw-2rem)] transition-all duration-200 ease-out ${isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'}`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh' }}
      >
        {/* Side panel — nempel di kiri modal */}
        {sidePanel && (
          <div className="hidden lg:flex shrink-0">
            {sidePanel}
          </div>
        )}

        <div
          className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-[calc(100vw-2rem)] ${SIZE_CLASSES[size]} max-h-[90vh] overflow-hidden flex flex-col`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-500 dark:text-gray-400"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
            {children}
          </div>
          {footer && (
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
