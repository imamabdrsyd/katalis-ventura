'use client';

/**
 * OutstandingSettlementPicker
 *
 * Dipakai di halaman Journal Entry untuk jenis transaksi yang sebenarnya bukan
 * "entry baru" melainkan PELUNASAN atas transaksi yang sudah ada:
 *
 *   - bayar_hutang      → daftar hutang yang belum lunas
 *   - terima_pelunasan  → daftar piutang belum lunas (usaha & talangan, 2 tab)
 *
 * Alih-alih menyuruh user mengetik ulang akun + nominal (yang membuat pelunasan
 * tidak pernah tertaut ke transaksi asalnya), komponen ini menampilkan daftar
 * kewajiban/piutang outstanding lebih dulu. Pelunasan dijalankan lewat RPC
 * `settle_transaction` yang sama dengan tombol Lunasi di modal detail, sehingga
 * meta `settled_by_transaction_id` / `partial_settlements` tetap konsisten.
 *
 * Penuh vs sebagian dipilih DI DALAM baris (dua tombol setelah baris dibuka),
 * bukan lewat dua jenis transaksi terpisah — dari sisi user kejadiannya sama,
 * yang beda hanya nominalnya.
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
  isDividendDeclaration,
  isDividendSettled,
  getDividendOutstandingAmount,
  getDividendPartialSettlementIds,
  buildDividendSettlementPrefill,
  buildDividendPartialSettlementPrefill,
} from '@/lib/accounting/guidance';
import {
  isAdvanceReceivableAccount,
  isAnyReceivableAccount,
} from '@/lib/accounting/classification';
import { findDefaultCashAccount } from '@/lib/utils/quickTransactionHelper';
import { CurrencyInputWithCalculator } from '@/components/ui/CurrencyInputWithCalculator';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { useLanguage } from '@/context/LanguageContext';
import { Search, PenLine, ChevronRight } from 'lucide-react';

/**
 * Sisi yang dilunasi. `dividend` = dividen yang sudah di-declare tapi belum
 * dibayar — arah jurnalnya sama dengan hutang (Dr kewajiban / Cr kas), tapi
 * deteksi & meta-nya lewat helper dividendSettlement.
 */
export type SettlementSide = 'payable' | 'receivable' | 'dividend';

/** Sub-jenis piutang — dipakai sebagai tab di sisi AR. */
export type ReceivableKind = 'trade' | 'advance';

interface OutstandingSettlementPickerProps {
  side: SettlementSide;
  transactions: Transaction[];
  accounts: Account[];
  /** Dipanggil setelah pelunasan berhasil — parent refetch transaksi */
  onSettled: () => void | Promise<void>;
  /** Escape hatch: user ingin catat manual lewat form biasa */
  onManualEntry: () => void;
}

/** Talangan = piutang yang akunnya advance/talangan, bukan piutang usaha. */
function isAdvanceReceivableTransaction(t: Transaction): boolean {
  if (t.is_multi_line && t.journal_lines) {
    return t.journal_lines.some(
      (l) => l.debit_amount > 0 && isAdvanceReceivableAccount(l.account)
    );
  }
  return isAdvanceReceivableAccount(t.debit_account);
}

/**
 * Daftar transaksi outstanding untuk sisi tertentu.
 * `receivableKind` hanya berlaku saat side='receivable'; undefined = semua piutang.
 */
export function getOutstandingTransactions(
  side: SettlementSide,
  transactions: Transaction[],
  receivableKind?: ReceivableKind
): Transaction[] {
  const rows = transactions.filter((t) => {
    if (t.status === 'draft') return false;
    if (side === 'dividend') {
      return isDividendDeclaration(t) && !isDividendSettled(t) && !isSettlementEntry(t);
    }
    if (side === 'payable') {
      return isPayableTransaction(t) && !isPayableSettled(t) && !isPayableSettlementEntry(t);
    }
    if (!isReceivableTransaction(t) || isSettled(t) || isSettlementEntry(t)) return false;
    if (!receivableKind) return true;
    const isAdvance = isAdvanceReceivableTransaction(t);
    return receivableKind === 'advance' ? isAdvance : !isAdvance;
  });
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export function OutstandingSettlementPicker({
  side,
  transactions,
  accounts,
  onSettled,
  onManualEntry,
}: OutstandingSettlementPickerProps) {
  const { t: i18n } = useLanguage();
  const tp = i18n.journalEntry.picker;

  const isReceivable = side === 'receivable';
  const isDividend = side === 'dividend';
  // Arah jurnal: hutang & dividen sama-sama Dr kewajiban / Cr kas.
  const isPayable = !isReceivable;

  // Tab piutang: default ke tab yang ada isinya supaya user tidak mendarat di
  // daftar kosong padahal tab sebelah penuh.
  const tradeRows = useMemo(
    () => (isReceivable ? getOutstandingTransactions('receivable', transactions, 'trade') : []),
    [isReceivable, transactions]
  );
  const advanceRows = useMemo(
    () => (isReceivable ? getOutstandingTransactions('receivable', transactions, 'advance') : []),
    [isReceivable, transactions]
  );
  const [receivableTab, setReceivableTab] = useState<ReceivableKind>(() =>
    tradeRows.length > 0 ? 'trade' : advanceRows.length > 0 ? 'advance' : 'trade'
  );

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [partialMode, setPartialMode] = useState(false);
  const [partialAmount, setPartialAmount] = useState(0);
  const [partialDisplay, setPartialDisplay] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const cashAccount = useMemo(() => findDefaultCashAccount(accounts), [accounts]);

  const rows = useMemo(() => {
    if (!isReceivable) return getOutstandingTransactions(side, transactions);
    return receivableTab === 'advance' ? advanceRows : tradeRows;
  }, [isReceivable, side, transactions, receivableTab, advanceRows, tradeRows]);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter(
      (t) =>
        (t.name ?? '').toLowerCase().includes(kw) ||
        (t.description ?? '').toLowerCase().includes(kw)
    );
  }, [rows, search]);

  const partialIdsOf = (t: Transaction): string[] => {
    if (isDividend) return getDividendPartialSettlementIds(t);
    if (isReceivable) return getPartialSettlementIds(t);
    return getPayablePartialSettlementIds(t);
  };

  /** Sisa outstanding sebuah transaksi, memperhitungkan cicilan sebelumnya. */
  const outstandingOf = (t: Transaction): number => {
    const payments = transactions.filter((p) => partialIdsOf(t).includes(p.id));
    if (isDividend) return getDividendOutstandingAmount(t, payments);
    if (isReceivable) return getOutstandingAmount(t, payments);
    return getPayableOutstandingAmount(t, payments);
  };

  const resetRowState = () => {
    setPartialMode(false);
    setPartialAmount(0);
    setPartialDisplay('');
    setError('');
  };

  /** Buka baris pada mode tertentu; klik tombol yang sama lagi = tutup. */
  const openRow = (t: Transaction, mode: 'full' | 'partial') => {
    const alreadyOpen = selectedId === t.id && partialMode === (mode === 'partial');
    resetRowState();
    if (alreadyOpen) {
      setSelectedId(null);
      return;
    }
    setSelectedId(t.id);
    setPartialMode(mode === 'partial');
  };

  const closeRow = () => {
    setSelectedId(null);
    resetRowState();
  };

  const handleSubmit = async (original: Transaction, mode: 'full' | 'partial') => {
    const outstanding = outstandingOf(original);

    if (mode === 'partial') {
      if (partialAmount <= 0) {
        setError(tp.enterAmount);
        return;
      }
      if (partialAmount >= outstanding) {
        setError(tp.mustBeLessThan.replace('{amount}', formatCurrency(outstanding)));
        return;
      }
    }

    const payments = transactions.filter((p) => partialIdsOf(original).includes(p.id));

    const settlementData =
      mode === 'partial'
        ? isDividend
          ? buildDividendPartialSettlementPrefill(original, partialAmount, accounts)
          : isReceivable
            ? buildPartialSettlementPrefill(original, partialAmount, accounts, payments)
            : buildPayablePartialSettlementPrefill(original, partialAmount, accounts, payments)
        : isDividend
          ? buildDividendSettlementPrefill(original, accounts, payments)
          : isReceivable
            ? buildSettlementPrefill(original, accounts, payments)
            : buildPayableSettlementPrefill(original, accounts, payments);

    setSubmitting(true);
    setError('');
    try {
      await settleTransaction({
        originalTransactionId: original.id,
        settlementData,
        partialAmount: mode === 'partial' ? partialAmount : undefined,
        outstandingAmount: outstanding,
      });
      toast.success(
        mode === 'partial'
          ? isDividend
            ? tp.dividendPartialSuccess
            : isReceivable
              ? tp.receivedPartialSuccess
              : tp.paidPartialSuccess
          : isDividend
            ? tp.dividendFullSuccess
            : isReceivable
              ? tp.receivedFullSuccess
              : tp.paidFullSuccess
      );
      setSelectedId(null);
      resetRowState();
      await onSettled();
    } catch (err: any) {
      const msg = err?.message || tp.failed;
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /** Akun lawan yang akan dicatat — hutang didebit, piutang dikredit. */
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
    // Penjualan campuran (Dr Bank + Dr Piutang) tidak boleh memilih baris Bank
    // hanya karena ASSET pertama — samakan dengan getReceivableAccountId().
    const acc =
      t.is_multi_line && t.journal_lines
        ? t.journal_lines.find(
            (l) => l.debit_amount > 0 && isAnyReceivableAccount(l.account)
          )?.account
        : t.debit_account;
    return { code: acc?.account_code, name: acc?.account_name };
  };

  return (
    <div className="card-static space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
            {isDividend ? tp.dividendTitle : isPayable ? tp.payableTitle : tp.receivableTitle}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {isDividend
              ? tp.dividendSubtitle
              : isPayable
                ? tp.payableSubtitle
                : tp.receivableSubtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={onManualEntry}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
        >
          <PenLine className="w-4 h-4" />
          {tp.manualEntry}
        </button>
      </div>

      {/* Tab piutang usaha vs talangan — jurnalnya beda kategori (EARN vs FIN),
          jadi memisahkannya membantu user memastikan tagihan yang benar. */}
      {isReceivable && (
        <SegmentedToggle
          options={[
            { value: 'trade', label: `${tp.tabTrade} (${tradeRows.length})` },
            { value: 'advance', label: `${tp.tabAdvance} (${advanceRows.length})` },
          ]}
          value={receivableTab}
          onChange={(v) => {
            setReceivableTab(v);
            setSelectedId(null);
            resetRowState();
          }}
        />
      )}

      {rows.length > 5 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tp.searchPlaceholder}
            className="input-search pl-9"
          />
        </div>
      )}

      {/* max-h + overflow-y-auto: daftar tagihan yang mengurus scroll-nya
          sendiri, bukan panel form-nya. Halaman Journal Entry scroll normal
          mengikuti dokumen, jadi tanpa batas tinggi di sini daftar panjang
          akan mendorong tombol simpan jauh ke bawah layar. */}
      <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-sm text-center text-gray-500 dark:text-gray-400">
            {tp.noResults.replace('{keyword}', search)}
          </p>
        )}
        {filtered.map((t) => {
          const outstanding = outstandingOf(t);
          const counter = counterAccountOf(t);
          const isSelected = selectedId === t.id;
          const partialCount = partialIdsOf(t).length;

          return (
            <div key={t.id}>
              {/* Dua aksi langsung di baris supaya jalur lunas maupun cicil
                  sama-sama 2 klik: pilih aksi → konfirmasi. */}
              <div
                className={`flex items-center justify-between gap-3 px-4 py-3 transition-colors ${
                  isSelected
                    ? 'bg-primary-50 dark:bg-primary-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="min-w-0">
                  {/* Judul = keterangan transaksi. Nama kontak turun ke sub —
                      satu kontak bisa punya banyak tagihan, jadi namanya saja
                      tidak membedakan baris mana yang mau dilunasi. */}
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                    {t.description || t.name || tp.untitled}
                  </p>
                  <div className="flex items-center gap-1.5 min-w-0 text-xs text-gray-500 dark:text-gray-400">
                    <span className="shrink-0">{formatDate(t.date)}</span>

                    {t.description && t.name && (
                      <>
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        {/* Chip netral — nama kontak dibaca sebagai entitas, bukan
                            bagian dari kalimat metadata di sebelahnya. */}
                        <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">
                          {t.name}
                        </span>
                      </>
                    )}

                    {counter.code && (
                      <>
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        <span className="truncate">
                          {/* Kode akun mono seperti di keterangan jurnal & buku besar */}
                          <span className="font-mono text-gray-400 dark:text-gray-500">
                            {counter.code}
                          </span>{' '}
                          {counter.name}
                        </span>
                      </>
                    )}

                    {partialCount > 0 && (
                      <>
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        <span className="shrink-0">
                          {tp.installmentCount.replace('{count}', String(partialCount))}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                      {formatCurrency(outstanding)}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">{tp.remaining}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openRow(t, 'full')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                        isSelected && !partialMode
                          ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                          : 'border-gray-300 dark:border-gray-600 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                      }`}
                    >
                      {isPayable ? tp.payFull : tp.receiveFull}
                    </button>
                    <button
                      type="button"
                      onClick={() => openRow(t, 'partial')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                        isSelected && partialMode
                          ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {isPayable ? tp.payPartial : tp.receivePartial}
                    </button>
                  </div>
                </div>
              </div>

              {isSelected && (
                <div className="px-4 pb-4 pt-1 space-y-3 bg-primary-50/50 dark:bg-primary-900/10">
                  {partialMode && (
                    <CurrencyInputWithCalculator
                      label={tp.amountLabel}
                      displayValue={partialDisplay}
                      onChange={(num, fmt) => {
                        setPartialAmount(num);
                        setPartialDisplay(fmt);
                        setError('');
                      }}
                      colorVariant="default"
                      autoFocus
                    />
                  )}

                  <div className="px-3 py-2 bg-white dark:bg-gray-800 rounded-md font-mono text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                    {isPayable ? (
                      <>
                        Dr {counter.code} – {counter.name} &nbsp;|&nbsp; Cr{' '}
                        {cashAccount?.account_code ?? '1200'} – {cashAccount?.account_name ?? 'Bank'}{' '}
                        &nbsp;|&nbsp; {formatCurrency(partialMode ? partialAmount : outstanding)}
                      </>
                    ) : (
                      <>
                        Dr {cashAccount?.account_code ?? '1200'} –{' '}
                        {cashAccount?.account_name ?? 'Bank'} &nbsp;|&nbsp; Cr {counter.code} –{' '}
                        {counter.name} &nbsp;|&nbsp;{' '}
                        {formatCurrency(partialMode ? partialAmount : outstanding)}
                      </>
                    )}
                  </div>

                  {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSubmit(t, partialMode ? 'partial' : 'full')}
                      disabled={submitting}
                      className={partialMode ? 'btn-primary-glow flex-1' : 'btn-emerald-glow flex-1'}
                    >
                      {submitting
                        ? tp.processing
                        : partialMode
                          ? tp.recordPayment
                          : isPayable
                            ? tp.payFull
                            : tp.receiveFull}
                    </button>
                    <button
                      type="button"
                      onClick={closeRow}
                      disabled={submitting}
                      className="btn-ghost flex-1"
                    >
                      {tp.cancel}
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
