import type { Account, JournalLineInput, TransactionCategory } from '@/types';
import type { OcrResult } from './types';
import {
  suggestAccountsForLineItems,
  suggestAccountsForCharges,
} from './matcher';
import { findDefaultCashAccount } from '@/lib/utils/quickTransactionHelper';
import type { MultiLineFormData } from '@/components/transactions/MultiLineJournalForm';

export type MultiLineBuildResult = {
  data: MultiLineFormData;
  // Diagnostic — diisi kalau ada line/charge yang TIDAK ketemu akun saran.
  // Frontend bisa pakai untuk highlight baris yang perlu user pilih akun manual.
  unmatchedLineIndices: number[];
  // Cash/bank account yang dipakai sebagai counter-side. Null kalau tidak ditemukan
  // di CoA — caller harus tangani case ini (mis. error message ke user).
  cashAccount: Account | null;
};

/**
 * Apakah OCR result punya cukup data untuk multi-line journal entry?
 * True kalau:
 *  - Ada >= 2 line items, ATAU
 *  - Ada >= 1 line item + >= 1 charge (mis. struk dengan 1 item + PPN)
 */
export function shouldUseMultiLine(result: OcrResult): boolean {
  const items = result.parsed.line_items ?? [];
  const charges = result.parsed.charges ?? [];
  return items.length >= 2 || (items.length >= 1 && charges.length >= 1);
}

/**
 * Bangun MultiLineFormData dari OcrResult + daftar akun.
 *
 * Layout journal yang dihasilkan (untuk struk pengeluaran):
 *   Dr  Akun beban per line item   (suggested via keyword match)
 *   Dr  Akun pajak / service       (per charge, kecuali diskon)
 *   Cr  Akun diskon                (kalau ada — diskon mengurangi beban)
 *   Cr  Kas / Bank                 (total = sum item + sum tax/service - diskon)
 *
 * Catatan: untuk struk EARN (pendapatan) layout-nya kebalik (Dr Kas / Cr Revenue),
 * tapi sekarang kita asumsikan struk = pengeluaran (paling umum). User bisa
 * override kategori dan flip debit/credit manual kalau ternyata pendapatan.
 */
export function buildMultiLineFromOcr(
  result: OcrResult,
  accounts: Account[]
): MultiLineBuildResult {
  const { parsed } = result;
  const lineItems = parsed.line_items ?? [];
  const charges = parsed.charges ?? [];

  const cashAccount = findDefaultCashAccount(accounts);
  const category: TransactionCategory = parsed.category ?? 'OPEX';

  // Saran akun per line item (pakai keyword item + keyword global)
  const itemSuggestions = suggestAccountsForLineItems(
    accounts,
    lineItems,
    parsed.keywords ?? [],
    parsed.fallback_keywords ?? []
  );
  const chargeSuggestions = suggestAccountsForCharges(accounts, charges);

  const journal_lines: JournalLineInput[] = [];
  const unmatchedLineIndices: number[] = [];
  let sortOrder = 0;
  let totalDebit = 0;
  let totalDiscount = 0;

  // Debit lines: line items
  lineItems.forEach((item, i) => {
    const suggested = itemSuggestions[i]?.account;
    if (!suggested) unmatchedLineIndices.push(sortOrder);
    journal_lines.push({
      account_id: suggested?.id ?? '',
      debit_amount: item.amount,
      credit_amount: 0,
      description: item.description,
      sort_order: sortOrder++,
    });
    totalDebit += item.amount;
  });

  // Debit/credit lines: charges (tax/service = debit, discount = credit)
  charges.forEach((charge, i) => {
    const suggested = chargeSuggestions[i]?.account;
    if (!suggested) unmatchedLineIndices.push(sortOrder);

    if (charge.type === 'discount') {
      const amt = Math.abs(charge.amount);
      journal_lines.push({
        account_id: suggested?.id ?? '',
        debit_amount: 0,
        credit_amount: amt,
        description: charge.label,
        sort_order: sortOrder++,
      });
      totalDiscount += amt;
    } else {
      journal_lines.push({
        account_id: suggested?.id ?? '',
        debit_amount: charge.amount,
        credit_amount: 0,
        description: charge.label,
        sort_order: sortOrder++,
      });
      totalDebit += charge.amount;
    }
  });

  // Credit line: kas/bank (counter side)
  const cashCredit = totalDebit - totalDiscount;
  if (cashCredit > 0) {
    journal_lines.push({
      account_id: cashAccount?.id ?? '',
      debit_amount: 0,
      credit_amount: cashCredit,
      description: 'Pembayaran',
      sort_order: sortOrder++,
    });
    if (!cashAccount) unmatchedLineIndices.push(sortOrder - 1);
  }

  // Minimum 2 lines (form requirement)
  while (journal_lines.length < 2) {
    journal_lines.push({
      account_id: '',
      debit_amount: 0,
      credit_amount: 0,
      description: '',
      sort_order: sortOrder++,
    });
  }

  const data: MultiLineFormData = {
    date: parsed.date ?? new Date().toISOString().split('T')[0],
    category,
    name: parsed.vendor ?? '',
    description: parsed.vendor ? `Belanja di ${parsed.vendor}` : 'Belanja multi-item',
    journal_lines,
  };

  return { data, unmatchedLineIndices, cashAccount };
}
