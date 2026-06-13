'use client';

import { ShoppingCart } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

/** Placeholder panel Kasir (checkout) — fitur menyusul (di luar scope MVP). */
export function KasirStub() {
  const { t } = useLanguage();
  return (
    <div className="text-center py-16">
      <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-4">
        <ShoppingCart className="w-7 h-7 text-indigo-400 dark:text-indigo-300" />
      </div>
      <p className="font-semibold text-gray-700 dark:text-gray-200">{t.hub.kasirComingSoon}</p>
      <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 max-w-sm mx-auto">
        {t.hub.kasirComingSoonDesc}
      </p>
    </div>
  );
}
