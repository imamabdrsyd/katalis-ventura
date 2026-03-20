import { useCallback, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useBusiness } from '@/context/BusinessContext';
import { SyncManager } from '@/sync/syncManager';
import { useConnectivity } from './useConnectivity';

export interface SyncState {
  isSyncing: boolean;
  isOffline: boolean;
  pendingCount: number;
  lastSyncAt: Date | null;
  syncError: string | null;
  triggerSync: () => Promise<void>;
}

export function useSyncImpl(): SyncState {
  const { user, isSignedIn } = useAuth();
  const { activeBusinessId } = useBusiness();
  const { isConnected } = useConnectivity();

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  // Get auth token from Supabase session
  const getAuthToken = useCallback(async (): Promise<string | null> => {
    try {
      const { data: { session } } = await (
        await import('@/lib/supabase')
      ).supabase.auth.getSession();
      return session?.access_token ?? null;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }, []);

  // Pending count not applicable — using direct Supabase queries
  const calculatePendingCount = useCallback(async () => {
    setPendingCount(0);
  }, []);

  // Perform sync
  const performSync = useCallback(async () => {
    if (!isSignedIn || !activeBusinessId || !isConnected) {
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const result = await SyncManager.sync(activeBusinessId);
      setLastSyncAt(result.syncedAt);
      await calculatePendingCount();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown sync error';
      setSyncError(errorMsg);
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSignedIn, activeBusinessId, isConnected, getAuthToken, calculatePendingCount]);

  // Auto-sync on app foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      performSync();
    }
  };

  // Auto-sync when coming online
  useEffect(() => {
    if (isConnected && !isSyncing && lastSyncAt) {
      const timeSinceLastSync = Date.now() - lastSyncAt.getTime();
      // Only auto-sync if it's been more than 30 seconds since last sync
      if (timeSinceLastSync > 30000) {
        performSync();
      }
    }
  }, [isConnected, isSyncing, lastSyncAt, performSync]);

  // Initial pending count on mount
  useEffect(() => {
    calculatePendingCount();
  }, [calculatePendingCount]);

  const triggerSync = useCallback(async () => {
    await performSync();
  }, [performSync]);

  return {
    isSyncing,
    isOffline: !isConnected,
    pendingCount,
    lastSyncAt,
    syncError,
    triggerSync,
  };
}
