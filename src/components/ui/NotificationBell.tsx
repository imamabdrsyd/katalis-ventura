'use client';

import { Bell, X } from 'lucide-react';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';

interface NotificationBellProps {
  count: number;
  href: string;
}

export function NotificationBell({ count, href }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title={count > 0 ? `${count} permintaan bergabung menunggu` : 'Notifikasi'}
      >
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 leading-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Notifikasi</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {count > 0 ? (
              <Link
                href={href}
                className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {count} permintaan bergabung menunggu
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Klik untuk melihat detail
                </p>
              </Link>
            ) : (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">Tidak ada notifikasi</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
