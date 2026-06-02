import { describe, it, expect, beforeEach } from 'vitest';
import {
  isReceivableTransaction,
  isTradeReceivableTransaction,
  getReceivableLineAmount,
  getOutstandingAmount,
} from '@/lib/accounting/guidance/receivableSettlement';
import { isPayableTransaction } from '@/lib/accounting/guidance/payableSettlement';
import { ACC, doubleEntryTxn, multiLineTxn, resetSeq } from './fixtures';

beforeEach(resetSeq);

/**
 * Regression coverage for the "settlement button disappears after edit" bug.
 *
 * Root cause: transaksi multi-line punya is_double_entry = TRUE setelah diedit
 * (update_multi_line_transaction RPC mem-promote-nya), tapi debit_account /
 * credit_account-nya NULL karena akun ada di journal_lines. Detector lama
 * mengecek cabang is_double_entry lebih dulu → membaca akun NULL → mengembalikan
 * false → tombol pelunasan hilang. Detector kini mengecek struktur multi-line
 * lebih dulu sehingga tahan terhadap nilai flag is_double_entry.
 */
describe('settlement detection — multi-line transactions', () => {
  describe('isReceivableTransaction', () => {
    it('detects a single double-entry receivable (Dr Piutang / Cr Pendapatan)', () => {
      const txn = doubleEntryTxn({
        category: 'EARN',
        amount: 1_200_000,
        debit: ACC.piutang,
        credit: ACC.revenue,
      });
      expect(isReceivableTransaction(txn)).toBe(true);
    });

    it('detects a multi-line receivable even though is_double_entry is TRUE', () => {
      // Mirip transaksi OTA di screenshot: Dr Piutang + beban-beban / Cr Pendapatan.
      const txn = multiLineTxn({
        category: 'EARN',
        amount: 1_200_000,
        lines: [
          { account: ACC.piutang, debit: 969_563 },
          { account: ACC.opexExpense, debit: 207_601 },
          { account: ACC.tax, debit: 22_836 },
          { account: ACC.revenue, credit: 1_200_000 },
        ],
      });
      expect(txn.is_multi_line).toBe(true);
      expect(txn.is_double_entry).toBe(true); // post-edit state
      expect(txn.debit_account).toBeUndefined(); // akun ada di journal_lines, bukan kolom single-line
      expect(isReceivableTransaction(txn)).toBe(true);
    });

    it('returns false for a multi-line journal with no receivable line', () => {
      const txn = multiLineTxn({
        category: 'OPEX',
        amount: 500_000,
        lines: [
          { account: ACC.opexExpense, debit: 500_000 },
          { account: ACC.kas, credit: 500_000 },
        ],
      });
      expect(isReceivableTransaction(txn)).toBe(false);
    });
  });

  describe('isTradeReceivableTransaction', () => {
    it('detects a multi-line trade receivable despite is_double_entry TRUE', () => {
      const txn = multiLineTxn({
        category: 'EARN',
        amount: 1_200_000,
        lines: [
          { account: ACC.piutang, debit: 1_200_000 },
          { account: ACC.revenue, credit: 1_200_000 },
        ],
      });
      expect(isTradeReceivableTransaction(txn)).toBe(true);
    });
  });

  describe('getReceivableLineAmount / getOutstandingAmount — net vs gross', () => {
    it('multi-line OTA: outstanding = baris piutang (net), bukan header amount (gross)', () => {
      // Penjualan via OTA: gross 1.200.000, net diterima 969.563 setelah komisi+biaya+pajak.
      const txn = multiLineTxn({
        category: 'EARN',
        amount: 1_200_000, // header = total debit (gross)
        lines: [
          { account: ACC.piutang, debit: 969_563 }, // net diterima
          { account: ACC.cogs, debit: 180_000 }, // komisi OTA (EXPENSE/VAR)
          { account: ACC.tax, debit: 50_437 }, // biaya layanan + pajak
          { account: ACC.revenue, credit: 1_200_000 }, // gross revenue
        ],
      });
      expect(txn.amount).toBe(1_200_000);
      expect(getReceivableLineAmount(txn)).toBe(969_563);
      expect(getOutstandingAmount(txn)).toBe(969_563); // BUKAN 1.200.000
    });

    it('single double-entry: outstanding = full amount (sama dengan header)', () => {
      const txn = doubleEntryTxn({
        category: 'EARN',
        amount: 500_000,
        debit: ACC.piutang,
        credit: ACC.revenue,
      });
      expect(getReceivableLineAmount(txn)).toBe(500_000);
      expect(getOutstandingAmount(txn)).toBe(500_000);
    });

    it('partially settled: outstanding pakai remaining_amount dari meta', () => {
      const txn = multiLineTxn({
        category: 'EARN',
        amount: 1_200_000,
        lines: [
          { account: ACC.piutang, debit: 969_563 },
          { account: ACC.tax, debit: 230_437 },
          { account: ACC.revenue, credit: 1_200_000 },
        ],
      });
      txn.meta = { remaining_amount: 469_563, partial_settlements: ['txn-x'] };
      expect(getOutstandingAmount(txn)).toBe(469_563);
    });

    it('fully settled: outstanding = 0', () => {
      const txn = multiLineTxn({
        category: 'EARN',
        amount: 1_200_000,
        lines: [
          { account: ACC.piutang, debit: 969_563 },
          { account: ACC.tax, debit: 230_437 },
          { account: ACC.revenue, credit: 1_200_000 },
        ],
      });
      txn.meta = { settled_by_transaction_id: 'txn-settle' };
      expect(getOutstandingAmount(txn)).toBe(0);
    });
  });

  describe('isPayableTransaction', () => {
    it('detects a single double-entry payable (Dr Beban / Cr Hutang Usaha)', () => {
      const txn = doubleEntryTxn({
        category: 'OPEX',
        amount: 800_000,
        debit: ACC.opexExpense,
        credit: ACC.payable,
      });
      expect(isPayableTransaction(txn)).toBe(true);
    });

    it('detects a multi-line payable even though is_double_entry is TRUE', () => {
      const txn = multiLineTxn({
        category: 'OPEX',
        amount: 800_000,
        lines: [
          { account: ACC.opexExpense, debit: 800_000 },
          { account: ACC.payable, credit: 800_000 },
        ],
      });
      expect(txn.credit_account).toBeUndefined();
      expect(isPayableTransaction(txn)).toBe(true);
    });
  });
});
