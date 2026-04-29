'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';

interface NotificationBellProps {
  count: number;
  href: string;
}

export function NotificationBell({ count, href }: NotificationBellProps) {
  return (
    <Link
      href={href}
      className="relative p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      title={count > 0 ? `${count} permintaan bergabung menunggu` : 'Notifikasi'}
    >
      <Bell className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 leading-none">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
