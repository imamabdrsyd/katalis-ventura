'use client';

import { useState, useEffect, useCallback } from 'react';
import { getPendingRequestsCount } from '@/lib/api/joinRequests';

export function useNotifications(businessIds: string[], isManager: boolean) {
  const [pendingCount, setPendingCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!isManager || !businessIds.length) {
      setPendingCount(0);
      return;
    }
    const count = await getPendingRequestsCount(businessIds);
    setPendingCount(count);
  }, [businessIds, isManager]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { pendingCount, refresh };
}
