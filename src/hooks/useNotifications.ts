'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase';

export function useNotifications(_businessIds: string[], isManager: boolean, userId?: string) {
  const [pendingCount, setPendingCount] = useState(0);
  const supabaseRef = useRef(createClient());

  const refresh = useCallback(async () => {
    if (!isManager || !userId) {
      setPendingCount(0);
      return;
    }

    try {
      const response = await fetch('/api/notifications/pending-requests', {
        credentials: 'include',
      });
      if (!response.ok) {
        setPendingCount(0);
        return;
      }
      const data = await response.json();
      setPendingCount(data.requests?.length || 0);
    } catch (error) {
      console.error('Failed to fetch pending count:', error);
      setPendingCount(0);
    }
  }, [userId, isManager]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: re-fetch saat ada perubahan di business_join_requests
  // milik bisnis user. RLS sudah memfilter ke creator, jadi hook ini
  // hanya menerima event yang relevan.
  useEffect(() => {
    if (!isManager || !userId) return;

    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`join-requests-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'business_join_requests' },
        () => {
          refresh();
        }
      )
      .subscribe();

    // Polling fallback (lebih jarang) untuk environment yang Realtime-nya disabled
    const interval = setInterval(refresh, 60_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [isManager, userId, refresh]);

  return { pendingCount, refresh };
}
