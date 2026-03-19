import React, { createContext, useContext, ReactNode } from 'react';
import { useSyncImpl, type SyncState } from '@/hooks/useSync';

const SyncContext = createContext<SyncState | undefined>(undefined);

export function SyncProvider({ children }: { children: ReactNode }) {
  const syncState = useSyncImpl();

  return (
    <SyncContext.Provider value={syncState}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncContext() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSyncContext must be used within a SyncProvider');
  }
  return context;
}

// Export as useSync for convenience
export const useSync = useSyncContext;
