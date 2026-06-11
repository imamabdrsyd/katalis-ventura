'use client';

import type { InvoicePaymentStatus } from '@/types';

interface InvoiceStatusBadgeProps {
  status: InvoicePaymentStatus;
}

const STATUS_CONFIG: Record<InvoicePaymentStatus, { label: string; className: string }> = {
  draft: {
    label: 'Draft',
    className: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  },
  unpaid: {
    label: 'Belum Bayar',
    className: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  },
  paid: {
    label: 'Lunas',
    className: 'bg-emerald-50 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400',
  },
  overdue: {
    label: 'Jatuh Tempo',
    className: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  },
};

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}
