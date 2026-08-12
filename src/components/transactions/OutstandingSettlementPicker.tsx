'use client';

/**
 * OutstandingSettlementPicker
 *
 * Dipakai di halaman Journal Entry untuk jenis transaksi yang sebenarnya bukan
 * "entry baru" melainkan PELUNASAN atas transaksi yang sudah ada:
 *
 *   - bayar_hutang / cicil_hutang        → daftar hutang yang belum lunas
 *   - terima_kembali_talangan            → daftar talangan yang belum kembali
 *
 * Alih-alih menyuruh user mengetik ulang akun + nominal (yang membuat pelunasan
 * tidak pernah tertaut ke transaksi asalnya), komponen ini menampilkan daftar
 * kewajiban/piutang outstanding lebih dulu. Pelunasan dijalankan lewat RPC
 * `settle_transaction` yang sama dengan tombol Lunasi di modal detail, sehingga
 * meta `settled_by_transaction_id` / `partial_settlements` tetap konsisten.
 *
 * Bila tidak ada satu pun transaksi outstanding, parent yang memutuskan untuk
 * langsung menampilkan form manual (lihat journal-entry/page.tsx).
 */

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Account, Transaction } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { settleTransaction } from '@/lib/api/transactions';
import {
  isPayableTransaction,
  isPayableSettled,
  isPayableSettlementEntry,
  getPayableOutstandingAmount,
  getPayablePartialSettlementIds,
  buildPayableSettlementPrefill,
  buildPayablePartialSettlementPrefill,
  isReceivableTransaction,
  isSettled,
  isSettlementEntry,
  getOutstandingAmount,
  getPartialSettlementIds,
  buildSettlementPrefill,
  buildPartialSettlementPrefill,
} from '@/lib/accounting/guidance';
import { isAdvanceReceivableAccount } from '@/lib/accounting/classification';
import { findDefaultCashAccount } from '@/lib/utils/quickTransactionHelper';
import { CurrencyInputWithCalculator } from '@/components/ui/CurrencyInputWithCalculator';
import { Search, PenLine, ChevronRight } from 'lucide-react';

export type OutstandingKind = 'payable' | 'advance_receivable';

interface OutstandingSettlementPickerProps {
  kind: OutstandingKind;
  /** 'full' = lunasi sepenuhnya, 'partial' = cicil sebagian */
  mode: 'full' | 'partial';
  transactions: Transaction[];
  accounts: Account[];
  /** Dipanggil setelah pelunasan berhasil — parent refetch transaksi */
  onSettled: () => void | Promise<void>;
  /** Escape hatch: user ingin catat manual lewat form biasa */
  onManualEntry: () => void;
}

/** Transaksi talangan = piutang yang akunnya advance/talangan, bukan piutang usaha. */
function isAdvanceReceivableTransaction(t: Transaction): boolean {
  if (t.is_multi_line && t.journal_lines) {
    return t.journal_lines.some(
      (l) => l.debit_amount > 0 && isAdvanceReceivableAccount(l.account)
    );
  }
  return isAdvanceReceivableAccount(t.debit_account);
}

export function getOutstandingTransactions(
  kind: OutstandingKind,
  transactions: Transaction[]
): Transaction[] {
  const rows = transactions.filter((t) => {
    if (t.status === 'draft') return false;
    if (kind === 'payable') {
      return isPayableTransaction(t) && !isPayableSettled(t) && !isPayableSettlementEntry(t);
    }
    return (
      isReceivableTransaction(t) &&
      isAdvanceReceivableTransaction(t) &&
      !isSettled(t) &&
      !isSettlementEntry(t)
    );
  });
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export function OutstandingSettlementPicker({
  kind,
  mode,
  transactions,
  accounts,
  onSettled,
  onManualEntry,
}: OutstandingSettlementPickerProps) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [partialAmount, setPartialAmount] = useState(0);
  const [partialDisplay, setPartialDisplay] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isPayable = kind === 'payable';
  const cashAccount = useMemo(() => findDefaultCashAccount(accounts), [accounts]);

  const rows = useMemo(
    () => getOutstandingTransactions(kind, transactions),
    [kind, transactions]
  );

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter(
      (t) =>
        (t.name ?? '').toLowerCase().includes(kw) ||
        (t.description ?? '').toLowerCase().includes(kw)
    );
  }, [rows, search]);

  /** Sisa outstanding sebuah transaksi, lengkap dengan pembayaran parsial sebelumnya. */
  const outstandingOf = (t: Transaction): number => {
    const partialIds = isPayable
      ? getPayablePartialSettlementIds(t)
      : getPartialSettlementIds(t);
    const payments = transactions.filter((p) => partialIds.includes(p.id));
    return isPayable
      ? getPayableOutstandingAmount(t, payments)
      : getOutstandingAmount(t, payments);
  };

  const selected = filtered.find((t) => t.id === selectedId) ?? null;
  const selectedOutstanding = selected ? outstandingOf(selected) : 0;

  const handleSelect = (t: Transaction) => {
    setSelectedId((prev) => (prev === t.id ? null : t.id));
    setPartialAmount(0);
    setPartialDisplay('');
    setError('');
  };

  const handleSubmit = async () => {
    if (!selected) return;
    const outstanding = selectedOutstanding;

    if (mode === 'partial') {
      if (partialAmount <= 0) {
        setError('Masukkan jumlah pembayaran');
        return;
      }
      if (partialAmount >= outstanding) {
        setError(
          `Jumlah harus kurang dari ${formatCurrency(outstanding)}. Gunakan "${
            isPayable ? 'Bayar Hutang' : 'Terima Kembali Talangan'
          }" untuk pelunasan penuh.`
        );
        return;
      }
    }

    const partialIds = isPayable
      ? getPayablePartialSettlementIds(selected)
      : getPartialSettlementIds(selected);
    const payments = transactions.filter((p) => partialIds.includes(p.id));

    const settlementData =
      mode === 'partial'
        ? isPayable
          ? buildPayablePartialSettlementPrefill(selected, partialAmount, accounts, payments)
          : buildPartialSettlementPrefill(selected, partialAmount, accounts, payments)
        : isPayable
          ? buildPayableSettlementPrefill(selected, accounts, payments)
          : buildSettlementPrefill(selected, accounts, payments);

    setSubmitting(true);
    setError('');
    try {
      await settleTransaction({
        originalTransactionId: selected.id,
        settlementData,
        partialAmount: mode === 'partial' ? partialAmount : undefined,
        outstandingAmount: outstanding,
      });
      toast.success(
        mode === 'partial'
          ? isPayable
            ? 'Cicilan hutang berhasil dicatat'
            : 'Pembayaran sebagian talangan berhasil dicatat'
          : isPayable
            ? 'Hutang berhasil dilunasi'
            : 'Talangan berhasil diterima kembali'
      );
      setSelectedId(null);
      setPartialAmount(0);
      setPartialDisplay('');
      await onSettled();
    } catch (err: any) {
      const msg = err?.message || 'Gagal mencatat pembayaran';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /** Akun lawan yang akan dicatat — hutang didebit, talangan dikredit. */
  const counterAccountOf = (t: Transaction): { code?: string; name?: string } => {
    if (isPayable) {
      const acc =
        t.is_multi_line && t.journal_lines
          ? t.journal_lines.find(
              (l) => l.credit_amount > 0 && l.account?.account_type === 'LIABILITY'
            )?.account
          : t.credit_account;
      return { code: acc?.account_code, name: acc?.account_name };
    }
    const acc =
      t.is_multi_line && t.journal_lines
        ? t.journal_lines.find((l) => l.debit_amount > 0 && isAdvanceReceivableAccount(l.account))
            ?.account
        : t.debit_account;
    return { code: acc?.account_code, name: acc?.account_name };
  };

  const title = isPayable
    ? mode === 'partial'
      ? 'Pilih hutang yang mau dicicil'
      : 'Pilih hutang yang mau dilunasi'
    : 'Pilih talangan yang dibayar kembali';

  const subtitle = isPayable
    ? 'Pelunasan otomatis tertaut ke transaksi asalnya, jadi sisa hutang ikut berkurang.'
    : 'Pembayaran otomatis tertaut ke talangan asalnya, jadi sisa piutang ikut berkurang.';

  return (
    <div className="card-static space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onManualEntry}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
        >
          <PenLine className="w-4 h-4" />
          Catat manual
        </button>
      </div>

      {rows.length > 5 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau keterangan..."
            className="input-search pl-9"
          />
        </div>
      )}

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-sm text-center text-gray-500 dark:text-gray-400">
            Tidak ada hasil untuk &ldquo;{search}&rdquo;
          </p>
        )}
        {filtered.map((t) => {
          const outstanding = outstandingOf(t);
          const counter = counterAccountOf(t);
          const isSelected = selectedId === t.id;
          const partialCount = (isPayable
            ? getPayablePartialSettlementIds(t)
            : getPartialSettlementIds(t)
          ).length;

          return (
            <div key={t.id}>
              <button
                type="button"
                onClick={() => handleSelect(t)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? 'bg-primary-50 dark:bg-primary-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                    {t.name || t.description || 'Tanpa nama'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {formatDate(t.date)}
                    {counter.code ? ` · ${counter.code} ${counter.name}` : ''}
                    {partialCount > 0 ? ` · ${partialCount}× cicilan` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                      {formatCurrency(outstanding)}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">sisa</p>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${
                      isSelected ? 'rotate-90' : ''
                    }`}
                  />
                </div>
              </button>

              {isSelected && (
                <div className="px-4 pb-4 pt-1 space-y-3 bg-primary-50/50 dark:bg-primary-900/10">
                  {mode === 'partial' && (
                    <CurrencyInputWithCalculator
                      label="Jumlah pembayaran (Rp)"
                      displayValue={partialDisplay}
                      onChange={(num, fmt) => {
                        setPartialAmount(num);
                        setPartialDisplay(fmt);
                        setError('');
                      }}
                      colorVariant="default"
                    />
                  )}

                  <div className="px-3 py-2 bg-white dark:bg-gray-800 rounded-md font-mono text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                    {isPayable ? (
                      <>
                        Dr {counter.code} – {counter.name} &nbsp;|&nbsp; Cr{' '}
                        {cashAccount?.account_code ?? '1200'} – {cashAccount?.account_name ?? 'Bank'}{' '}
                        &nbsp;|&nbsp;{' '}
                        {formatCurrency(mode === 'partial' ? partialAmount : outstanding)}
                      </>
                    ) : (
                      <>
                        Dr {cashAccount?.account_code ?? '1200'} –{' '}
                        {cashAccount?.account_name ?? 'Bank'} &nbsp;|&nbsp; Cr {counter.code} –{' '}
                        {counter.name} &nbsp;|&nbsp;{' '}
                        {formatCurrency(mode === 'partial' ? partialAmount : outstanding)}
                      </>
                    )}
                  </div>

                  {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="btn-emerald-glow flex-1"
                    >
                      {submitting
                        ? 'Memproses...'
                        : mode === 'partial'
                          ? 'Catat Pembayaran'
                          : isPayable
                            ? 'Ya, Bayar Lunas'
                            : 'Ya, Terima Pelunasan'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      disabled={submitting}
                      className="btn-ghost flex-1"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
