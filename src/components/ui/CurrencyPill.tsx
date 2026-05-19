'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface CurrencyPillProps {
  currencyCode: string;
  onCurrencyChange: (currency: string) => void;
  supportedCurrencies: readonly string[];
}

export function CurrencyPill({ currencyCode, onCurrencyChange, supportedCurrencies }: CurrencyPillProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border transition-colors cursor-pointer bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
        title="Ganti mata uang"
      >
        {currencyCode}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden min-w-[90px] max-w-[calc(100vw-2rem)]">
          {supportedCurrencies.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { onCurrencyChange(c); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                c === currencyCode
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
