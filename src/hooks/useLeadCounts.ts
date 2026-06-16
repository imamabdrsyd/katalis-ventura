'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase';

export interface LeadCounts {
  /** Map business_id → jumlah lead dgn pesan masuk belum dilihat (unread). */
  byBusiness: Record<string, number>;
  /** Total lead unread di semua bisnis user. */
  total: number;
}

const EMPTY: LeadCounts = { byBusiness: {}, total: 0 };

/**
 * Hitung notifikasi pesan masuk yang belum dilihat (unread) per bisnis untuk
 * badge bell + business switcher. Bukan "menghitung leads"/status='new',
 * melainkan lead yang punya pesan inbound lebih baru dari last_read_at
 * (last_read_at di-set saat thread dibuka — lihat useLeads.selectLead).
 *
 * Satu query untuk semua bisnis user, lalu di-grup di client.
 * Realtime: re-fetch saat tabel `leads` berubah (RLS sudah filter ke bisnis user).
 * Polling fallback 60 detik untuk environment tanpa Realtime.
 */
export function useLeadCounts(businessIds: string[], enabled: boolean) {
  const [counts, setCounts] = useState<LeadCounts>(EMPTY);
  const supabaseRef = useRef(createClient());

  // Stabilkan dependency: gabung jadi string agar tidak re-subscribe tiap render.
  const idsKey = businessIds.join(',');

  const refresh = useCallback(async () => {
    if (!enabled || businessIds.length === 0) {
      setCounts(EMPTY);
      return;
    }

    try {
      // Ambil lead yg pernah punya pesan masuk; bandingkan last_read_at vs
      // last_inbound_at di client (PostgREST tidak bisa banding antar-kolom).
      const { data, error } = await supabaseRef.current
        .from('leads')
        .select('business_id, last_read_at, last_inbound_at')
        .in('business_id', businessIds)
        .is('deleted_at', null)
        .not('last_inbound_at', 'is', null);

      if (error) {
        console.warn('[useLeadCounts] query error:', error.message);
        setCounts(EMPTY);
        return;
      }

      const byBusiness: Record<string, number> = {};
      let total = 0;
      for (const row of data ?? []) {
        const unread =
          !row.last_read_at ||
          new Date(row.last_read_at) < new Date(row.last_inbound_at as string);
        if (!unread) continue;
        byBusiness[row.business_id] = (byBusiness[row.business_id] ?? 0) + 1;
        total += 1;
      }
      setCounts({ byBusiness, total });
    } catch (err) {
      console.error('[useLeadCounts] failed:', err);
      setCounts(EMPTY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, idsKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled || businessIds.length === 0) return;

    const supabase = supabaseRef.current;
    const channel = supabase
      .channel('lead-counts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => refresh()
      )
      .subscribe();

    const interval = setInterval(refresh, 60_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, idsKey, refresh]);

  return { leadCounts: counts, refreshLeadCounts: refresh };
}
