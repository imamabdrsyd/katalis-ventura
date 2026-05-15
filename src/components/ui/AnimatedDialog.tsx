'use client';

import { useEffect, useState } from 'react';

interface AnimatedDialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  panelClassName?: string;
  backdropClassName?: string;
}

const DEFAULT_PANEL =
  'bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto';

const DEFAULT_BACKDROP =
  'fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm';

export function AnimatedDialog({
  isOpen,
  onClose,
  children,
  panelClassName = DEFAULT_PANEL,
  backdropClassName = DEFAULT_BACKDROP,
}: AnimatedDialogProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

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

  if (!shouldRender) return null;

  return (
    <div
      className={`${backdropClassName} transition-opacity duration-200 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      <div
        className={`${panelClassName} transition-all duration-200 ease-out ${isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
