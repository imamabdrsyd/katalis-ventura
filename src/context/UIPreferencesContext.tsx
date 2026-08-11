'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';

/**
 * Preferensi tampilan per-perangkat (localStorage, bukan DB).
 * Sejajar dengan pola LanguageContext & ThemeProvider.
 */

const AI_FAB_KEY = 'katalis_show_ai_fab';

/** Default: FAB AI Chat DISEMBUNYIKAN sampai user menyalakannya di /settings. */
const DEFAULT_SHOW_AI_FAB = false;

interface UIPreferencesContextType {
  /** Tampilkan FAB AI Chat (tombol robot mengambang). */
  showAIFab: boolean;
  setShowAIFab: (value: boolean) => void;
  /** false sampai preferensi selesai dibaca dari localStorage (hindari flicker). */
  isHydrated: boolean;
}

const UIPreferencesContext = createContext<UIPreferencesContextType | null>(null);

export function UIPreferencesProvider({ children }: { children: ReactNode }) {
  const [showAIFab, setShowAIFabState] = useState(DEFAULT_SHOW_AI_FAB);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(AI_FAB_KEY);
      if (saved !== null) {
        setShowAIFabState(saved === 'true');
      }
    } catch {
      /* ignore */
    }
    setIsHydrated(true);
  }, []);

  const setShowAIFab = useCallback((value: boolean) => {
    setShowAIFabState(value);
    try {
      localStorage.setItem(AI_FAB_KEY, String(value));
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <UIPreferencesContext.Provider value={{ showAIFab, setShowAIFab, isHydrated }}>
      {children}
    </UIPreferencesContext.Provider>
  );
}

export function useUIPreferences() {
  const ctx = useContext(UIPreferencesContext);
  if (!ctx) {
    throw new Error('useUIPreferences must be used within a UIPreferencesProvider');
  }
  return ctx;
}
