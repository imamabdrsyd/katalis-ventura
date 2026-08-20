'use client';

/**
 * Badge channel untuk satu lead — versi yang tahu soal lead NATIVE AXION.
 *
 * `lead.channel` ('whatsapp' | 'instagram' | ...) hanya menandai CARA
 * FOLLOW-UP MANUAL yang dipakai `register_event_slot` (migr 136), bukan bahwa
 * lead ini benar-benar masuk lewat integrasi API Instagram/WhatsApp — event
 * registration sama sekali tidak menyentuh channel_integrations. Menampilkan
 * badge "Instagram" untuk lead semacam itu keliru: pendaftar Fun Padel tidak
 * pernah chat lewat Instagram, mereka mengisi form di Lobby publik.
 *
 * Deteksinya lewat `lead.meta.source === 'event_registration'` (satu-satunya
 * penanda yang ditulis RPC). Kalau sumbernya bukan native, delegasikan ke
 * <SalesChannelBadge> seperti biasa — WhatsApp/OTA/marketplace tetap channel
 * sungguhan dan badgenya tidak berubah.
 */

import { PartyPopper } from 'lucide-react';
import type { Lead } from '@/types';
import { LEAD_CHANNEL_TO_SALES_CHANNEL } from '@/lib/leadColors';
import { SalesChannelBadge } from '@/components/transactions/SalesChannelBadge';

interface Props {
  lead: Pick<Lead, 'channel' | 'meta'>;
  size?: 'sm' | 'md';
}

/** Sumber `meta.source` yang berarti "native AXION", bukan integrasi channel eksternal. */
const NATIVE_LEAD_SOURCES = new Set(['event_registration']);

export function isNativeLead(meta: Lead['meta']): boolean {
  const source = meta && typeof meta === 'object' ? (meta as Record<string, unknown>).source : null;
  return typeof source === 'string' && NATIVE_LEAD_SOURCES.has(source);
}

export function LeadChannelBadge({ lead, size = 'sm' }: Props) {
  if (isNativeLead(lead.meta)) {
    const padding = size === 'md' ? 'px-2 py-1 gap-1.5' : 'px-1.5 py-0.5 gap-1';
    const textSize = size === 'md' ? 'text-xs' : 'text-[10px]';
    const iconSize = size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3';

    return (
      <span
        className={`inline-flex items-center ${padding} rounded-full font-semibold ${textSize} bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400`}
      >
        <PartyPopper className={iconSize} />
        Event
      </span>
    );
  }

  return <SalesChannelBadge channel={LEAD_CHANNEL_TO_SALES_CHANNEL[lead.channel]} size={size} />;
}
