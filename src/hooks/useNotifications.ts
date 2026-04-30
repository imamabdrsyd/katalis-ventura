'use client';

import { useState, useEffect, useCallback } from 'react';

export function useNotifications(businessIds: string[], isManager: boolean, userId?: string) {
  const [pendingCount, setPendingCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!isManager || !userId) {
      setPendingCount(0);
      return;
    }

    try {
      // Fetch count from API which uses created_by to find businesses
      const response = await fetch(`/api/notifications/pending-requests?userId=${userId}`);
      const data = await response.json();
      setPendingCount(data.requests?.length || 0);
    } catch (error) {
      console.error('Failed to fetch pending count:', error);
      setPendingCount(0);
    }
  }, [userId, isManager]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { pendingCount, refresh };
}
