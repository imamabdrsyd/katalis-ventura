'use client';

import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';

type TransactionSavedToastOptions = {
  message: string;
  createdAt?: string | Date | null;
  onOpenDetail?: () => void | Promise<void>;
};

function normalizeToastDate(value?: string | Date | null): Date {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function formatToastTimestamp(date: Date): string {
  const weekday = new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(date);
  const month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date);
  const day = date.getDate();
  const year = date.getFullYear();
  const time = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  return `${weekday}, ${month} ${day}, ${year} pada ${time}`;
}

export function showTransactionSavedToast({
  message,
  createdAt,
  onOpenDetail,
}: TransactionSavedToastOptions) {
  const createdTime = formatToastTimestamp(normalizeToastDate(createdAt));

  return toast.custom((id) => {
    const handleClick = () => {
      toast.dismiss(id);
      void onOpenDetail?.();
    };

    return (
      <button
        type="button"
        onClick={handleClick}
        className="flex w-[var(--width,356px)] max-w-[calc(100vw-32px)] cursor-pointer items-start gap-3 rounded-xl border border-gray-100 bg-white px-4 py-4 text-left shadow-[0_2px_8px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)] transition-colors hover:bg-gray-50/70 focus:outline-none focus:ring-2 focus:ring-gray-200"
        aria-label={message}
      >
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-sm font-medium leading-5 text-gray-800">{message}</span>
          <span className="mt-1 block text-sm leading-5 text-gray-400">{createdTime}</span>
        </span>
      </button>
    );
  });
}
