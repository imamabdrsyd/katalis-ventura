'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  sideNavPrev?: { onClick: () => void; disabled: boolean; title?: string };
  sideNavNext?: { onClick: () => void; disabled: boolean; title?: string };
}

export function Modal({ isOpen, onClose, title, children, footer, sideNavPrev, sideNavNext }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
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
        className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
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
  );

  return createPortal(modalContent, document.body);
}
