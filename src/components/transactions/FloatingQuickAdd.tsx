'use client';

import { useState, useCallback } from 'react';
import { Zap } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { QuickTransactionForm } from './QuickTransactionForm';
import { useBusinessContext } from '@/context/BusinessContext';
import * as transactionsApi from '@/lib/api/transactions';
import type { TransactionFormData } from './TransactionForm';

/**
 * Floating Action Button for Quick Add Transaction.
 * Renders at the bottom-right corner on all dashboard pages.
 * Only visible to users who can manage transactions.
 */
export function FloatingQuickAdd({
  isOpen: controlledIsOpen,
  onOpenChange,
}: {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
} = {}) {
  const { user, activeBusinessId: businessId, userRole } = useBusinessContext();
  const canManage = userRole === 'business_manager' || userRole === 'both';

  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = onOpenChange || setInternalIsOpen;

  const handleSubmit = useCallback(
    async (data: TransactionFormData) => {
      if (!businessId || !user) return;
      setSaving(true);
      try {
        await transactionsApi.createTransaction({
          ...data,
          business_id: businessId,
          created_by: user.id,
        });
        setIsOpen(false);
      } catch (err: any) {
        alert(err.message || 'Gagal menambahkan transaksi');
      } finally {
        setSaving(false);
      }
    },
    [businessId, user]
  );

  if (!canManage || !businessId) return null;

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-30 w-14 h-14 bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
        title="Tambah Transaksi"
        aria-label="Tambah Transaksi"
      >
        <Zap className="w-6 h-6 group-hover:scale-110 transition-transform" />
      </button>

      {/* Quick Add Modal */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Tambah Transaksi"
      >
        <QuickTransactionForm
          onSubmit={handleSubmit}
          onCancel={() => setIsOpen(false)}
          loading={saving}
          businessId={businessId}
        />
      </Modal>
    </>
  );
}
