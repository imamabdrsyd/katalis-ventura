'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MessageCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { AIChatPanel } from '@/components/ai/AIChatPanel';
import { QuickTransactionForm } from './QuickTransactionForm';
import { MultiLineJournalForm } from './MultiLineJournalForm';
import type { MultiLineFormData } from './MultiLineJournalForm';
import { OcrResultPreviewModal } from './OcrResultPreviewModal';
import { useBusinessContext } from '@/context/BusinessContext';
import * as transactionsApi from '@/lib/api/transactions';
import { getAccounts } from '@/lib/api/accounts';
import { findCogsAccount } from '@/lib/utils/inventoryHelper';
import { showTransactionSavedToast } from '@/lib/transactionToast';
import { isManagerRole } from '@/lib/roles';
import type { Transaction, Account } from '@/types';
import type { TransactionFormData } from './TransactionForm';
import type { OcrResult } from '@/lib/ocr/types';

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
  const router = useRouter();
  const { user, activeBusinessId: businessId, activeBusiness, userRole } = useBusinessContext();
  const canManage = isManagerRole(userRole);

  const [aiChatOpen, setAiChatOpen] = useState(false);

  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // OCR preview & multi-line state
  const [ocrPreviewResult, setOcrPreviewResult] = useState<OcrResult | null>(null);
  const [pendingOcrApply, setPendingOcrApply] = useState<OcrResult | null>(null);
  const [multiLineOcrPrefill, setMultiLineOcrPrefill] = useState<MultiLineFormData | null>(null);

  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = onOpenChange || setInternalIsOpen;

  // Fetch transactions and accounts when modal opens
  useEffect(() => {
    if (isOpen && businessId) {
      transactionsApi.getTransactions(businessId).then(setTransactions).catch(() => {});
      getAccounts(businessId).then(setAccounts).catch(() => {});
    }
  }, [isOpen, businessId]);

  const handleSubmit = useCallback(
    async (data: TransactionFormData) => {
      if (!businessId || !user) return;
      setSaving(true);
      try {
        const createdTransaction = await transactionsApi.createTransaction({
          ...data,
          business_id: businessId,
          created_by: user.id,
        });
        setIsOpen(false);
        window.dispatchEvent(new CustomEvent('transaction-saved'));
        showTransactionSavedToast({
          message: 'Transaksi berhasil disimpan',
          createdAt: createdTransaction.created_at,
          onOpenDetail: () => router.push(`/transactions?detail=${createdTransaction.id}`),
        });
      } catch (err: any) {
        toast.error(err.message || 'Gagal menambahkan transaksi');
      } finally {
        setSaving(false);
      }
    },
    [businessId, router, setIsOpen, user]
  );

  const handleSubmitMultiLine = useCallback(
    async (data: MultiLineFormData) => {
      if (!businessId || !user) return;
      setSaving(true);
      try {
        const created = await transactionsApi.createMultiLineTransaction({
          business_id: businessId,
          created_by: user.id,
          date: data.date,
          category: data.category,
          name: data.name,
          description: data.description,
          notes: data.notes,
          journal_lines: data.journal_lines,
          attachments: data.attachments,
        });
        setIsOpen(false);
        setMultiLineOcrPrefill(null);
        window.dispatchEvent(new CustomEvent('transaction-saved'));
        showTransactionSavedToast({
          message: 'Jurnal multi-baris berhasil disimpan',
          createdAt: created.created_at,
          onOpenDetail: () => router.push(`/transactions?detail=${created.id}`),
        });
      } catch (err: any) {
        toast.error(err.message || 'Gagal menyimpan jurnal');
      } finally {
        setSaving(false);
      }
    },
    [businessId, router, setIsOpen, user]
  );

  const handleCloseModal = useCallback(() => {
    setIsOpen(false);
    setMultiLineOcrPrefill(null);
    setOcrPreviewResult(null);
    setPendingOcrApply(null);
  }, [setIsOpen]);

  const handleConvertStockToCOGS = useCallback(
    async (transactionIds: string[]) => {
      if (transactionIds.length === 0) return;
      const cogsAccount = findCogsAccount(accounts);
      if (!cogsAccount) {
        throw new Error('Tidak ada akun HPP/Beban yang aktif.');
      }
      for (const txId of transactionIds) {
        await transactionsApi.updateTransaction(txId, {
          debit_account_id: cogsAccount.id,
        });
      }
    },
    [accounts]
  );

  if (!canManage || !businessId) return null;

  const ocrSidePanel = ocrPreviewResult ? (
    <OcrResultPreviewModal
      result={ocrPreviewResult}
      accounts={accounts}
      onChooseSingle={(result) => {
        setPendingOcrApply(result);
        setOcrPreviewResult(null);
      }}
      onChooseMultiLine={(data) => {
        setMultiLineOcrPrefill(data);
        setOcrPreviewResult(null);
      }}
      onClose={() => setOcrPreviewResult(null)}
    />
  ) : null;

  return (
    <>
      {/* AI Chat Panel */}
      {businessId && (
        <AIChatPanel
          isOpen={aiChatOpen}
          onClose={() => setAiChatOpen(false)}
          businessId={businessId}
          businessName={activeBusiness?.business_name ?? ''}
        />
      )}

      {/* FAB Button — AI Chat */}
      <button
        onClick={() => setAiChatOpen(prev => !prev)}
        className="fixed bottom-6 right-6 z-30 w-14 h-14 bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
        title="AXION AI"
        aria-label="Buka AI Chat"
      >
        <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
      </button>

      {/* Quick Add Modal */}
      <Modal
        isOpen={isOpen}
        onClose={handleCloseModal}
        title={multiLineOcrPrefill ? 'Jurnal Multi-Item (dari Struk)' : 'Add Transaction'}
        size={multiLineOcrPrefill ? '3xl' : 'md'}
        sidePanel={ocrSidePanel}
      >
        {multiLineOcrPrefill ? (
          <MultiLineJournalForm
            initialData={multiLineOcrPrefill}
            onSubmit={handleSubmitMultiLine}
            onCancel={handleCloseModal}
            loading={saving}
            businessId={businessId}
            submitLabel="Simpan Jurnal"
          />
        ) : (
          <QuickTransactionForm
            onSubmit={handleSubmit}
            onCancel={() => setIsOpen(false)}
            loading={saving}
            businessId={businessId}
            transactions={transactions}
            onConvertStockToCOGS={handleConvertStockToCOGS}
            onOcrResult={setOcrPreviewResult}
            pendingOcrApply={pendingOcrApply}
          />
        )}
      </Modal>
    </>
  );
}
