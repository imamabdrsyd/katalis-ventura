'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  inDropdown?: boolean;
}

export function ThemeToggle({ inDropdown = false }: ThemeToggleProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return inDropdown ? (
      <div className="flex items-center justify-between w-full px-0 py-0">
        <div className="flex items-center gap-2 text-sm text-gray-400"><div className="w-4 h-4" />Tampilan</div>
        <div className="w-8 h-4" />
      </div>
    ) : (
      <button className="p-2 rounded-xl bg-indigo-100 dark:bg-gray-800 transition-colors" aria-label="Toggle theme">
        <div className="w-5 h-5" />
      </button>
    );
  }

  const isDark = resolvedTheme === 'dark';

  if (inDropdown) {
    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {isDark ? <Moon className="w-4 h-4 text-gray-400 dark:text-gray-500" /> : <Sun className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
          {isDark ? 'Mode Gelap' : 'Mode Terang'}
        </div>
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            isDark ? 'bg-indigo-500' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isDark ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="p-2 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-amber-500">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-700">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
