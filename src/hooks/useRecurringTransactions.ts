'use client';

import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBusinessContext } from '@/context/BusinessContext';
import * as recurringApi from '@/lib/api/recurring';
import type { RecurringTransactionInsert, RecurringTransactionUpdate } from '@/lib/api/recurring';

/**
 * Hook for managing recurring transactions.
 *
 * On mount, triggers auto-generation of due recurring drafts (once per day per business,
 * deduplicated via sessionStorage).
 */
export function useRecurringTransactions() {
  const { user, activeBusinessId: businessId } = useBusinessContext();
  const queryClient = useQueryClient();

  // Fetch recurring templates
  const {
    data: recurringList = [],
    isLoading: loading,
  } = useQuery({
    queryKey: ['recurring-transactions', businessId],
    queryFn: () => recurringApi.getRecurringTransactions(businessId!),
    enabled: !!businessId,
  });

  // Auto-generate due recurring drafts on mount (deduplicated per day)
  useEffect(() => {
    if (!businessId || !user) return;

    const today = new Date().toISOString().split('T')[0];
    const key = `recurring_checked_${businessId}_${today}`;

    // Skip if already checked today
    if (sessionStorage.getItem(key)) return;

    recurringApi
      .generateDueRecurringTransactions(businessId, user.id)
      .then((count) => {
        sessionStorage.setItem(key, '1');
        if (count > 0) {
          // Refresh transaction caches so new drafts appear
          queryClient.invalidateQueries({ queryKey: ['transactions', businessId] });
          queryClient.invalidateQueries({ queryKey: ['transactions-paginated', businessId] });
          queryClient.invalidateQueries({ queryKey: ['recurring-transactions', businessId] });
        }
      })
      .catch((err) => {
        console.error('[useRecurringTransactions] Auto-generation failed:', err);
      });
  }, [businessId, user, queryClient]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['recurring-transactions', businessId] });
  }, [queryClient, businessId]);

  // Create
  const handleCreate = useCallback(
    async (data: Omit<RecurringTransactionInsert, 'created_by' | 'business_id'>) => {
      if (!businessId || !user) return;
      await recurringApi.createRecurringTransaction({
        ...data,
        business_id: businessId,
        created_by: user.id,
      });
      invalidate();
    },
    [businessId, user, invalidate]
  );

  // Update
  const handleUpdate = useCallback(
    async (id: string, updates: RecurringTransactionUpdate) => {
      await recurringApi.updateRecurringTransaction(id, updates);
      invalidate();
    },
    [invalidate]
  );

  // Pause
  const handlePause = useCallback(
    async (id: string) => {
      await recurringApi.updateRecurringTransaction(id, { status: 'paused' });
      invalidate();
    },
    [invalidate]
  );

  // Resume
  const handleResume = useCallback(
    async (id: string) => {
      await recurringApi.updateRecurringTransaction(id, { status: 'active' });
      invalidate();
    },
    [invalidate]
  );

  // Stop
  const handleStop = useCallback(
    async (id: string) => {
      await recurringApi.updateRecurringTransaction(id, { status: 'stopped' });
      invalidate();
    },
    [invalidate]
  );

  // Delete
  const handleDelete = useCallback(
    async (id: string) => {
      await recurringApi.deleteRecurringTransaction(id);
      invalidate();
    },
    [invalidate]
  );

  // Derived: active count & upcoming (next 7 days)
  const activeCount = recurringList.filter((r) => r.status === 'active').length;
  const upcoming = recurringList.filter((r) => {
    if (r.status !== 'active') return false;
    const due = new Date(r.next_due_date);
    const now = new Date();
    const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  });

  return {
    recurringList,
    loading,
    activeCount,
    upcoming,
    handleCreate,
    handleUpdate,
    handlePause,
    handleResume,
    handleStop,
    handleDelete,
  };
}
