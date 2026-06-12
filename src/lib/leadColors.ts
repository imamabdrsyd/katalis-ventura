// Source of truth warna & label Leads Hub — pola sama dengan categoryColors.ts.
// Badge format: bg-{color}-50 dark:bg-{color}-900/30 text-{color}-700 dark:text-{color}-400

import type { LeadChannel, LeadStatus, SalesChannel } from '@/types';

// Badge channel pakai <SalesChannelBadge> standar (logo + warna brand dari salesChannels.ts).
// Map ini menjembatani LeadChannel → SalesChannel (beda hanya di tiktok_shop → tiktok).
export const LEAD_CHANNEL_TO_SALES_CHANNEL: Record<LeadChannel, SalesChannel> = {
  whatsapp: 'whatsapp',
  airbnb: 'airbnb',
  booking_com: 'booking_com',
  instagram: 'instagram',
  shopee: 'shopee',
  tokopedia: 'tokopedia',
  tiktok_shop: 'tiktok',
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
