// Source of truth warna & label Leads Hub — pola sama dengan categoryColors.ts.
// Badge format: bg-{color}-50 dark:bg-{color}-900/30 text-{color}-700 dark:text-{color}-400

import type { LeadChannel, LeadStatus } from '@/types';

export const CHANNEL_BADGE_CLASSES: Record<LeadChannel, string> = {
  whatsapp: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  airbnb: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
  booking_com: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  instagram: 'bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400',
  shopee: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  tokopedia: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  tiktok_shop: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
};

export const CHANNEL_LABELS: Record<LeadChannel, string> = {
  whatsapp: 'WhatsApp',
  airbnb: 'Airbnb',
  booking_com: 'Booking.com',
  instagram: 'Instagram',
  shopee: 'Shopee',
  tokopedia: 'Tokopedia',
  tiktok_shop: 'TikTok Shop',
};

export const LEAD_STATUS_BADGE_CLASSES: Record<LeadStatus, string> = {
  new: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
  contacted: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  qualified: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  converted: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  lost: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Baru',
  contacted: 'Dihubungi',
  qualified: 'Potensial',
  converted: 'Jadi Customer',
  lost: 'Batal',
};
