'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useBusinessContext } from '@/context/BusinessContext';
import { isManagerRole } from '@/lib/roles';
import * as transactionsApi from '@/lib/api/transactions';
import * as recurringApi from '@/lib/api/recurring';
import * as contactsApi from '@/lib/api/contacts';
import { getAccounts } from '@/lib/api/accounts';
import { showTransactionSavedToast } from '@/lib/transactionToast';
import { findCogsAccount } from '@/lib/utils/inventoryHelper';
import { isPostableDraft } from '@/lib/api/server/postableDraft';
import { buildSettlementPrefill, buildPartialSettlementPrefill, getOutstandingAmount, getPartialSettlementIds } from '@/lib/accounting/guidance/receivableSettlement';
import {
  buildDividendSettlementPrefill,
  buildDividendPartialSettlementPrefill,
  getDividendOutstandingAmount,
  getDividendPartialSettlementIds,
} from '@/lib/accounting/guidance/dividendSettlement';
import {
  getPayableOutstandingAmount,
  getPayablePartialSettlementIds,
  buildPayableSettlementPrefill,
  buildPayablePartialSettlementPrefill,
} from '@/lib/accounting/guidance/payableSettlement';
import type { Transaction, TransactionCategory, TransactionStatus, Account, Contact } from '@/types';
import type { TransactionFormData } from '@/components/transactions/TransactionForm';
import type { MultiLineFormData } from '@/components/transactions/MultiLineJournalForm';
import type { TransactionFilters } from '@/lib/api/transactions';

export interface BulkDeleteProgressState {
  status: 'running' | 'completed' | 'error';
  current: number;
  total: number;
  deleted: number;
  failed: number;
  message: string;
}

export function useTransactions() {
  const { user, activeBusinessId: businessId, activeBusiness, loading: businessLoading, error: businessError, userRole } = useBusinessContext();
  const canManageTransactions = isManagerRole(userRole);
  const queryClient = useQueryClient();

  // Filter state
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<TransactionCategory | 'SETTLE' | ''>('');
  const [contactFilter, setContactFilter] = useState<string>('');
  const [descriptionSearch, setDescriptionSearch] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Pagination
  const [rowsPerPage, setRowsPerPage] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [transactionMode, setTransactionMode] = useState<'in' | 'out' | null>(null);
  const [detailTransaction, setDetailTransaction] = useState<Transaction | null>(null);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [deleteTransaction, setDeleteTransaction] = useState<Transaction | null>(null);

  // Accounts state (for smart guidance in detail modal)
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Contacts state (for contact icon in transaction list)
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Follow-up prefill state (for COGS entry guidance)
  const [followUpPrefill, setFollowUpPrefill] = useState<Partial<TransactionFormData> | null>(null);

  // Kebab menu & select mode state
  const [showKebabMenu, setShowKebabMenu] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<BulkDeleteProgressState | null>(null);

  // Build filters object for server-side query
  const filters: TransactionFilters = useMemo(() => ({
    status: statusFilter,
    category: categoryFilter,
    contact: contactFilter,
    description: descriptionSearch.trim(),
    startDate: dateRange.start,
    endDate: dateRange.end,
  }), [statusFilter, categoryFilter, contactFilter, descriptionSearch, dateRange]);

  // Server-side paginated query — filters & pagination handled by Supabase
  const {
    data: paginatedResult,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ['transactions-paginated', businessId, currentPage, rowsPerPage, filters],
    queryFn: () => transactionsApi.getTransactionsPaginated(businessId!, currentPage, rowsPerPage, filters),
    enabled: !!businessId,
    placeholderData: (prev) => prev, // Keep previous data while fetching (smooth pagination)
  });

  // Also fetch all transactions (lightweight — shared cache with dashboard/reports)
  // Used only for draftCount badge
  const { data: allTransactions = [] } = useQuery({
    queryKey: ['transactions', businessId],
    queryFn: () => transactionsApi.getTransactions(businessId!),
    enabled: !!businessId,
  });

  const transactions = paginatedResult?.data ?? [];
  const totalPages = paginatedResult?.totalPages ?? 0;
  const totalCount = paginatedResult?.totalCount ?? 0;
  const error = queryError?.message ?? null;

  // visibleTransactions = transactions from server (already paginated)
  const visibleTransactions = transactions;

  // filteredTransactions kept for backward compat (same as transactions since server already filtered)
  const filteredTransactions = transactions;

  // Count drafts from full dataset for badge display
  const draftCount = useMemo(() => allTransactions.filter((t) => t.status === 'draft').length, [allTransactions]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, categoryFilter, contactFilter, descriptionSearch, rowsPerPage, dateRange]);

  // Fetch accounts for smart guidance
  const fetchAccounts = useCallback(async () => {
    if (!businessId) return;
    try {
      const data = await getAccounts(businessId);
      setAccounts(data);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  }, [businessId]);

  // Fetch contacts for contact icon in transaction list
  const fetchContacts = useCallback(async () => {
    if (!businessId) return;
    try {
      const data = await contactsApi.getContacts(businessId);
      setContacts(data);
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    }
  }, [businessId]);

  useEffect(() => {
    if (businessId) {
      fetchAccounts();
      fetchContacts();
    }
  }, [businessId, fetchAccounts, fetchContacts]);

  // Helper to invalidate all transaction caches
  const invalidateTransactions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['transactions-paginated', businessId] });
    queryClient.invalidateQueries({ queryKey: ['transactions', businessId] });
  }, [queryClient, businessId]);

  // Kept for backward compat — now just triggers cache invalidation
  const fetchTransactions = useCallback(() => {
    invalidateTransactions();
  }, [invalidateTransactions]);

  const openCreatedTransactionDetail = useCallback(async (transaction: Transaction) => {
    if (!businessId) {
      setDetailTransaction(transaction);
      return;
    }

    try {
      const latestTransactions = await transactionsApi.getTransactions(businessId);
      setDetailTransaction(latestTransactions.find((item) => item.id === transaction.id) ?? transaction);
    } catch {
      setDetailTransaction(transaction);
    }
  }, [businessId]);

  // CRUD handlers
  const handleAddTransaction = useCallback(async (data: TransactionFormData) => {
    if (!businessId || !user) return;
    setSaving(true);
    try {
      const { recurring, ...transactionData } = data;
      const createdTransaction = await transactionsApi.createTransaction({
        ...transactionData,
        business_id: businessId,
        created_by: user.id,
      });

      // If recurring data is present, create recurring template
      if (data.recurring) {
        const nextDue = recurringApi.computeNextDueDate(
          data.recurring.start_date,
          data.recurring.frequency,
          data.recurring.interval_value
        );
        await recurringApi.createRecurringTransaction({
          business_id: businessId,
          name: data.name,
          description: data.description,
          amount: data.amount,
          category: data.category,
          account: data.account || '',
          debit_account_id: data.debit_account_id,
          credit_account_id: data.credit_account_id,
          is_double_entry: data.is_double_entry,
          notes: data.meta ? undefined : undefined,
          frequency: data.recurring.frequency,
          interval_value: data.recurring.interval_value,
          next_due_date: nextDue,
          end_date: data.recurring.end_date || null,
          created_by: user.id,
        });
      }

      setShowAddModal(false);
      setTransactionMode(null);
      invalidateTransactions();
      queryClient.invalidateQueries({ queryKey: ['recurring-transactions', businessId] });
      showTransactionSavedToast({
        message: 'Transaksi berhasil disimpan',
        createdAt: createdTransaction.created_at,
        onOpenDetail: () => openCreatedTransactionDetail(createdTransaction),
      });
    } catch (err: any) {
      toast.error(err.message || 'Gagal menambahkan transaksi');
    } finally {
      setSaving(false);
    }
  }, [businessId, user, invalidateTransactions, queryClient, openCreatedTransactionDetail]);

  const handleAddMultiLineTransaction = useCallback(async (data: MultiLineFormData) => {
    if (!businessId || !user) return;
    setSaving(true);
    try {
      const createdTransaction = await transactionsApi.createMultiLineTransaction({
        business_id: businessId,
        created_by: user.id,
        date: data.date,
        category: data.category,
        name: data.name,
        description: data.description,
        notes: data.notes,
        sales_channel: data.sales_channel ?? undefined,
        attachments: data.attachments,
        journal_lines: data.journal_lines,
      });
      setShowAddModal(false);
      setTransactionMode(null);
      invalidateTransactions();
      showTransactionSavedToast({
        message: 'Jurnal multi-line berhasil disimpan',
        createdAt: createdTransaction.created_at,
        onOpenDetail: () => openCreatedTransactionDetail(createdTransaction),
      });
    } catch (err: any) {
      toast.error(err.message || 'Gagal menambahkan transaksi multi-line');
    } finally {
      setSaving(false);
    }
  }, [businessId, user, invalidateTransactions, openCreatedTransactionDetail]);

  const handleEditMultiLineTransaction = useCallback(async (data: MultiLineFormData) => {
    if (!editTransaction || !businessId) return;
    setSaving(true);
    try {
      const existingMeta = (editTransaction.meta as Record<string, unknown>) ?? {};
      await transactionsApi.updateMultiLineTransaction(editTransaction.id, {
        date: data.date,
        category: data.category,
        name: data.name,
        description: data.description,
        notes: data.notes,
        sales_channel: data.sales_channel ?? null,
        meta: data.attachments !== undefined
          ? { ...existingMeta, attachments: data.attachments }
          : existingMeta,
        journal_lines: data.journal_lines,
      });
      setEditTransaction(null);
      invalidateTransactions();
      toast.success('Jurnal multi-line berhasil diperbarui');
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengupdate transaksi');
    } finally {
      setSaving(false);
    }
  }, [editTransaction, businessId, invalidateTransactions]);

  const handleEditTransaction = useCallback(async (data: TransactionFormData) => {
    if (!editTransaction || !businessId || !user) return;
    setSaving(true);
    try {
      const { recurring, ...transactionData } = data;
      await transactionsApi.updateTransaction(editTransaction.id, transactionData);

      const existingTemplateId = editTransaction.meta?.recurring_template_id;
      if (recurring) {
        const templateUpdated = existingTemplateId
          ? await recurringApi.updateRecurringTransaction(existingTemplateId, {
              name: data.name,
              description: data.description,
              amount: data.amount,
              category: data.category,
              debit_account_id: data.debit_account_id,
              credit_account_id: data.credit_account_id,
              frequency: recurring.frequency,
              interval_value: recurring.interval_value,
              end_date: recurring.end_date || null,
            })
          : false;
        if (!templateUpdated) {
          const nextDue = recurringApi.computeNextDueDate(
            recurring.start_date,
            recurring.frequency,
            recurring.interval_value
          );
          await recurringApi.createRecurringTransaction({
            business_id: businessId,
            name: data.name,
            description: data.description,
            amount: data.amount,
            category: data.category,
            account: data.account || '',
            debit_account_id: data.debit_account_id,
            credit_account_id: data.credit_account_id,
            is_double_entry: data.is_double_entry,
            frequency: recurring.frequency,
            interval_value: recurring.interval_value,
            next_due_date: nextDue,
            end_date: recurring.end_date || null,
            created_by: user.id,
          });
        }
      }

      setEditTransaction(null);
      invalidateTransactions();
      queryClient.invalidateQueries({ queryKey: ['recurring-transactions', businessId] });
      toast.success('Transaksi berhasil diperbarui');
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengupdate transaksi');
    } finally {
      setSaving(false);
    }
  }, [editTransaction, businessId, user, invalidateTransactions, queryClient]);

  const handleDeleteTransaction = useCallback(async () => {
    if (!deleteTransaction) return;
    setSaving(true);
    try {
      await transactionsApi.deleteTransaction(deleteTransaction.id);
      setDeleteTransaction(null);
      invalidateTransactions();
      toast.success('Transaksi berhasil dihapus');
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus transaksi');
    } finally {
      setSaving(false);
    }
  }, [deleteTransaction, invalidateTransactions]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleOpenInModal = useCallback(() => {
    setTransactionMode('in');
    setShowAddModal(true);
  }, []);

  const handleOpenOutModal = useCallback(() => {
    setTransactionMode('out');
    setShowAddModal(true);
  }, []);

  const handleOpenQuickAddModal = useCallback(() => {
    setShowQuickAddModal(true);
  }, []);

  const handleQuickAddTransaction = useCallback(async (data: TransactionFormData) => {
    if (!businessId || !user) return;
    setSaving(true);
    try {
      const { recurring, ...transactionData } = data;
      const createdTransaction = await transactionsApi.createTransaction({
        ...transactionData,
        business_id: businessId,
        created_by: user.id,
      });
      setShowQuickAddModal(false);
      invalidateTransactions();
      showTransactionSavedToast({
        message: 'Transaksi berhasil disimpan',
        createdAt: createdTransaction.created_at,
        onOpenDetail: () => openCreatedTransactionDetail(createdTransaction),
      });
    } catch (err: any) {
      toast.error(err.message || 'Gagal menambahkan transaksi');
    } finally {
      setSaving(false);
    }
  }, [businessId, user, invalidateTransactions, openCreatedTransactionDetail]);

  // Convert stock transactions to COGS: change debit from Inventory to COGS account
  const handleConvertStockToCOGS = useCallback(async (transactionIds: string[]) => {
    if (transactionIds.length === 0) return;

    const cogsAccount = findCogsAccount(accounts);
    if (!cogsAccount) {
      throw new Error('Tidak ada akun HPP/Beban yang aktif. Silakan buat akun beban terlebih dahulu.');
    }

    for (const txId of transactionIds) {
      await transactionsApi.updateTransaction(txId, {
        debit_account_id: cogsAccount.id,
      });
    }
  }, [accounts]);

  // "Save Draft" menunda konversi Persediaan→HPP (draft tidak boleh menyentuh
  // ledger), jadi konversinya dijalankan saat draft diposting. Hanya draft yang
  // lolos precheck posting yang diproses, dan hanya stok yang masih debit akun
  // ASSET (belum terkonversi) yang diupdate — jalur submit penuh sudah konversi
  // saat create, jadi ini idempoten.
  const convertPendingSoldStock = useCallback(async (draftIds: string[]) => {
    const drafts = allTransactions.filter(
      (t) => draftIds.includes(t.id) && t.status === 'draft' && isPostableDraft(t)
    );
    const soldStockIds = new Set<string>();
    for (const t of drafts) {
      const ids = (t.meta as Record<string, unknown> | null)?.sold_stock_ids;
      if (Array.isArray(ids)) {
        for (const v of ids) if (typeof v === 'string') soldStockIds.add(v);
      }
    }
    if (soldStockIds.size === 0) return;

    const accountById = new Map(accounts.map((a) => [a.id, a]));
    const pending = [...soldStockIds].filter((id) => {
      const stockTx = allTransactions.find((t) => t.id === id);
      if (!stockTx?.debit_account_id) return false;
      const debitType =
        stockTx.debit_account?.account_type ?? accountById.get(stockTx.debit_account_id)?.account_type;
      return debitType === 'ASSET';
    });
    if (pending.length > 0) await handleConvertStockToCOGS(pending);
  }, [allTransactions, accounts, handleConvertStockToCOGS]);

  // Toggle select for a single transaction
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Select all visible transactions
  const handleSelectAll = useCallback(() => {
    const allVisible = new Set(visibleTransactions.map((t) => t.id));
    setSelectedIds((prev) => {
      const allSelected = visibleTransactions.every((t) => prev.has(t.id));
      if (allSelected) return new Set(); // deselect all
      return allVisible;
    });
  }, [visibleTransactions]);

  // Exit select mode
  const handleExitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  // Bulk delete selected transactions
  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    setSaving(true);
    setBulkDeleteProgress({
      status: 'running',
      current: 0,
      total: ids.length,
      deleted: 0,
      failed: 0,
      message: `Menyiapkan penghapusan ${ids.length} transaksi...`,
    });

    try {
      const result = await transactionsApi.deleteTransactionsBulk(ids, (event) => {
        if (event.type !== 'progress') return;
        setBulkDeleteProgress({
          status: 'running',
          current: event.current ?? 0,
          total: event.total ?? ids.length,
          deleted: event.deleted ?? 0,
          failed: event.failed ?? 0,
          message: event.message ?? 'Menghapus transaksi...',
        });
      });

      setBulkDeleteProgress({
        status: 'completed',
        current: ids.length,
        total: ids.length,
        deleted: result.deleted,
        failed: result.failed,
        message: result.failed > 0
          ? `${result.deleted} transaksi dihapus, ${result.failed} gagal.`
          : `${result.deleted} transaksi berhasil dihapus.`,
      });
      setSelectedIds(new Set());
      setSelectMode(false);
      invalidateTransactions();

      if (result.failed > 0) {
        toast.warning(`${result.deleted} transaksi dihapus, ${result.failed} gagal`);
      } else {
        toast.success(`${result.deleted} transaksi berhasil dihapus`);
      }
    } catch (err: any) {
      const message = err.message || 'Gagal menghapus transaksi';
      setBulkDeleteProgress((current) => ({
        status: 'error',
        current: current?.current ?? 0,
        total: current?.total ?? ids.length,
        deleted: current?.deleted ?? 0,
        failed: current?.failed ?? 0,
        message,
      }));
      invalidateTransactions();
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [selectedIds, invalidateTransactions]);

  const dismissBulkDeleteProgress = useCallback(() => {
    setBulkDeleteProgress(null);
  }, []);

  // Post a single draft transaction
  const handlePostTransaction = useCallback(async (id: string) => {
    setSaving(true);
    try {
      // Konversi Persediaan→HPP yang tertunda dari Save Draft — dijalankan
      // SEBELUM status flip, meniru urutan jalur submit penuh (konversi gagal
      // = posting batal, bukan penjualan tercatat tanpa HPP).
      await convertPendingSoldStock([id]);
      await transactionsApi.postTransaction(id);
      setDetailTransaction(null);
      invalidateTransactions();
      toast.success('Transaksi berhasil diposting');
    } catch (err: any) {
      toast.error(err.message || 'Gagal memposting transaksi');
    } finally {
      setSaving(false);
    }
  }, [convertPendingSoldStock, invalidateTransactions]);

  // Bulk post selected draft transactions
  const handleBulkPost = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    try {
      const draftIds = [...selectedIds].filter((id) => {
        const tx = transactions.find((t) => t.id === id);
        return tx?.status === 'draft';
      });
      if (draftIds.length === 0) {
        toast.warning('Tidak ada transaksi draft yang dipilih');
        return;
      }
      // Konversi Persediaan→HPP tertunda dari Save Draft (hanya draft yang
      // lolos precheck posting) — sebelum status flip.
      await convertPendingSoldStock(draftIds);
      const { posted, skipped } = await transactionsApi.postTransactionsBulk(draftIds);
      setSelectedIds(new Set());
      setSelectMode(false);
      invalidateTransactions();
      toast.success(`${posted} transaksi berhasil diposting`);
      if (skipped > 0) {
        toast.warning(`${skipped} draft dilewati karena belum lengkap (akun/jumlah kosong)`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal memposting transaksi');
    } finally {
      setSaving(false);
    }
  }, [selectedIds, transactions, convertPendingSoldStock, invalidateTransactions]);

  // Handle COGS follow-up: close detail modal and open TransactionForm with prefill
  const handleCreateFollowUp = useCallback((prefillData: Partial<TransactionFormData>) => {
    setDetailTransaction(null);
    setFollowUpPrefill(prefillData);
    setTransactionMode(null);
    setShowAddModal(true);
  }, []);

  // Settlement via RPC settle_transaction — atomic insert + update meta dengan
  // FOR UPDATE lock di sisi DB (lihat migration 073). Sebelumnya pakai 2 HTTP
  // call yang non-atomic + read-modify-write tanpa lock untuk partial settlement.
  const handleSettleReceivable = useCallback(async (original: Transaction) => {
    if (!businessId || !user) return;
    setSaving(true);
    try {
      const partialIds = getPartialSettlementIds(original);
      const paymentTxns = allTransactions.filter(t => partialIds.includes(t.id));
      const outstanding = getOutstandingAmount(original, paymentTxns);
      const prefill = buildSettlementPrefill(original, accounts, paymentTxns);
      const { updated_meta } = await transactionsApi.settleTransaction({
        originalTransactionId: original.id,
        settlementData: prefill,
        outstandingAmount: outstanding,
      });

      setDetailTransaction({
        ...original,
        meta: updated_meta,
      });

      invalidateTransactions();
      toast.success('Piutang berhasil dilunasi');
    } catch (err: any) {
      toast.error(err.message || 'Gagal melunasi piutang');
    } finally {
      setSaving(false);
    }
  }, [businessId, user, accounts, invalidateTransactions, allTransactions]);

  const handlePartialSettleReceivable = useCallback(async (
    original: Transaction,
    partialAmount: number
  ) => {
    if (!businessId || !user) return;
    const partialIds = getPartialSettlementIds(original);
    const paymentTxns = allTransactions.filter(t => partialIds.includes(t.id));
    const outstanding = getOutstandingAmount(original, paymentTxns);
    if (partialAmount <= 0 || partialAmount >= outstanding) {
      throw new Error('Jumlah tidak valid untuk pelunasan sebagian');
    }
    
    setSaving(true);
    try {
      const prefill = buildPartialSettlementPrefill(original, partialAmount, accounts, paymentTxns);
      const { updated_meta } = await transactionsApi.settleTransaction({
        originalTransactionId: original.id,
        settlementData: prefill,
        partialAmount,
        outstandingAmount: outstanding,
      });

      setDetailTransaction({
        ...original,
        meta: updated_meta,
      });

      invalidateTransactions();
      toast.success('Pelunasan sebagian piutang berhasil dicatat');
    } catch (err: any) {
      throw err;
    } finally {
      setSaving(false);
    }
  }, [businessId, user, accounts, invalidateTransactions, allTransactions]);

  // === Payable settlement ===
  const handleSettlePayable = useCallback(async (original: Transaction) => {
    if (!businessId || !user) return;
    setSaving(true);
    try {
      const partialIds = getPayablePartialSettlementIds(original);
      const paymentTxns = allTransactions.filter(t => partialIds.includes(t.id));
      const outstanding = getPayableOutstandingAmount(original, paymentTxns);
      const prefill = buildPayableSettlementPrefill(original, accounts, paymentTxns);
      const { updated_meta } = await transactionsApi.settleTransaction({
        originalTransactionId: original.id,
        settlementData: prefill,
        outstandingAmount: outstanding,
      });

      setDetailTransaction({
        ...original,
        meta: updated_meta,
      });

      invalidateTransactions();
      toast.success('Hutang berhasil dilunasi');
    } catch (err: any) {
      toast.error(err.message || 'Gagal melunasi hutang');
    } finally {
      setSaving(false);
    }
  }, [businessId, user, accounts, invalidateTransactions, allTransactions]);

  const handlePartialSettlePayable = useCallback(async (
    original: Transaction,
    partialAmount: number
  ) => {
    if (!businessId || !user) return;
    const partialIds = getPayablePartialSettlementIds(original);
    const paymentTxns = allTransactions.filter(t => partialIds.includes(t.id));
    const outstanding = getPayableOutstandingAmount(original, paymentTxns);
    if (partialAmount <= 0 || partialAmount >= outstanding) {
      throw new Error('Jumlah tidak valid untuk pelunasan sebagian');
    }
    setSaving(true);
    try {
      const prefill = buildPayablePartialSettlementPrefill(original, partialAmount, accounts, paymentTxns);
      const { updated_meta } = await transactionsApi.settleTransaction({
        originalTransactionId: original.id,
        settlementData: prefill,
        partialAmount,
        outstandingAmount: outstanding,
      });

      setDetailTransaction({
        ...original,
        meta: updated_meta,
      });

      invalidateTransactions();
      toast.success('Pelunasan sebagian hutang berhasil dicatat');
    } catch (err: any) {
      throw err;
    } finally {
      setSaving(false);
    }
  }, [businessId, user, accounts, invalidateTransactions, allTransactions]);

  // === Dividend settlement (mirror of receivable settlement) ===
  // Lunasi dividen yang sudah di-declare: Dr Hutang Dividen / Cr Kas/Bank,
  // lalu tandai transaksi declaration sebagai LUNAS lewat meta.
  const handleSettleDividend = useCallback(async (original: Transaction) => {
    if (!businessId || !user) return;
    setSaving(true);
    try {
      const partialIds = getDividendPartialSettlementIds(original);
      const paymentTxns = allTransactions.filter(t => partialIds.includes(t.id));
      const outstanding = getDividendOutstandingAmount(original, paymentTxns);
      const prefill = buildDividendSettlementPrefill(original, accounts, paymentTxns);
      const { updated_meta } = await transactionsApi.settleTransaction({
        originalTransactionId: original.id,
        settlementData: prefill,
        outstandingAmount: outstanding,
      });

      setDetailTransaction({
        ...original,
        meta: updated_meta,
      });

      invalidateTransactions();
      toast.success('Dividen berhasil dilunasi');
    } catch (err: any) {
      toast.error(err.message || 'Gagal melunasi dividen');
    } finally {
      setSaving(false);
    }
  }, [businessId, user, accounts, invalidateTransactions, allTransactions]);

  const handlePartialSettleDividend = useCallback(async (
    original: Transaction,
    partialAmount: number
  ) => {
    if (!businessId || !user) return;
    const partialIds = getDividendPartialSettlementIds(original);
    const paymentTxns = allTransactions.filter(t => partialIds.includes(t.id));
    const outstanding = getDividendOutstandingAmount(original, paymentTxns);
    if (partialAmount <= 0 || partialAmount >= outstanding) {
      throw new Error('Jumlah tidak valid untuk pelunasan sebagian');
    }
    
    setSaving(true);
    try {
      const prefill = buildDividendPartialSettlementPrefill(original, partialAmount, accounts);
      const { updated_meta } = await transactionsApi.settleTransaction({
        originalTransactionId: original.id,
        settlementData: prefill,
        partialAmount,
        outstandingAmount: outstanding,
      });

      setDetailTransaction({
        ...original,
        meta: updated_meta,
      });

      invalidateTransactions();
      toast.success('Pelunasan sebagian dividen berhasil dicatat');
    } catch (err: any) {
      throw err;
    } finally {
      setSaving(false);
    }
  }, [businessId, user, accounts, invalidateTransactions, allTransactions]);

  return {
    // Data
    transactions,
    allTransactions,
    filteredTransactions,
    visibleTransactions,
    loading,
    error,
    saving,
    totalCount,
    // Business context
    user,
    businessId,
    activeBusiness,
    businessLoading,
    businessError,
    canManageTransactions,
    closedUntilDate: activeBusiness?.closed_until_date ?? null,
    // Filter state
    statusFilter,
    setStatusFilter,
    draftCount,
    categoryFilter,
    setCategoryFilter,
    contactFilter,
    setContactFilter,
    descriptionSearch,
    setDescriptionSearch,
    dateRange,
    setDateRange,
    showFilterDropdown,
    setShowFilterDropdown,
    // Pagination
    rowsPerPage,
    setRowsPerPage,
    currentPage,
    setCurrentPage,
    totalPages,
    // Modal state
    showAddModal,
    setShowAddModal,
    showQuickAddModal,
    setShowQuickAddModal,
    showImportModal,
    setShowImportModal,
    transactionMode,
    setTransactionMode,
    detailTransaction,
    setDetailTransaction,
    editTransaction,
    setEditTransaction,
    deleteTransaction,
    setDeleteTransaction,
    // Accounts (for smart guidance)
    accounts,
    // Contacts (for contact icon in transaction list)
    contacts,
    // Follow-up prefill (for COGS entry)
    followUpPrefill,
    setFollowUpPrefill,
    handleCreateFollowUp,
    handleSettleReceivable,
    handlePartialSettleReceivable,
    handleSettleDividend,
    handlePartialSettleDividend,
    handleConvertStockToCOGS,
    // Kebab menu & select mode
    showKebabMenu,
    setShowKebabMenu,
    selectMode,
    setSelectMode,
    selectedIds,
    handleToggleSelect,
    handleSelectAll,
    handleExitSelectMode,
    handleBulkDelete,
    bulkDeleteProgress,
    dismissBulkDeleteProgress,
    handleBulkPost,
    // Post actions
    handlePostTransaction,
    // Actions
    fetchTransactions,
    handleAddTransaction,
    handleAddMultiLineTransaction,
    handleQuickAddTransaction,
    handleEditTransaction,
    handleEditMultiLineTransaction,
    handleDeleteTransaction,
    handlePrint,
    handleOpenInModal,
    handleOpenOutModal,
    handleOpenQuickAddModal,
  };
}
