'use client';

import { toast } from 'sonner';
import { formatDateTime } from '@/lib/utils';

type TransactionSavedToastOptions = {
  message: string;
  createdAt?: string | Date | null;
  onOpenDetail?: () => void | Promise<void>;
};

function normalizeToastDate(value?: string | Date | null): Date {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function showTransactionSavedToast({
  message,
  createdAt,
  onOpenDetail,
}: TransactionSavedToastOptions) {
  const createdTime = formatDateTime(normalizeToastDate(createdAt));

  return toast.custom((id) => {
    const handleClick = () => {
      toast.dismiss(id);
      void onOpenDetail?.();
    };

    return (
      <button
        type="button"
        onClick={handleClick}
        className="w-full max-w-[min(92vw,520px)] cursor-pointer rounded-xl border border-gray-200 bg-white px-5 py-4 text-left shadow-[0_18px_45px_rgba(15,23,42,0.14),0_6px_18px_rgba(15,23,42,0.08)] transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
        aria-label={message}
      >
        <p className="text-sm font-semibold leading-5 text-gray-950">{message}</p>
        <p className="mt-1 text-sm leading-5 text-gray-600">Dibuat: {createdTime}</p>
      </button>
    );
  });
}
