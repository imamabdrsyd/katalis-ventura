/**
 * Transaction Patterns
 * Defines common transaction patterns for smart guidance
 */

import type { TransactionPattern } from '../types';

export const TRANSACTION_PATTERNS: TransactionPattern[] = [
  // ============================================
  // Money IN Patterns
  // ============================================
  {
    id: 'capital_injection',
    name: 'Suntik Modal',
    description: 'Pemilik menambah modal ke bisnis',
    debitAccountType: 'ASSET',
    creditAccountType: 'EQUITY',
    suggestedDebitCodes: ['1100', '1200'], // Cash, Bank
    suggestedCreditCodes: [], // Will suggest any EQUITY sub-account
    examples: [
      'Setoran modal awal pemilik',
      'Tambahan modal untuk ekspansi',
      'Investasi pemilik ke bisnis',
      'Transfer dana dari rekening pribadi',
    ],
  },
  {
    id: 'receive_revenue',
    name: 'Terima Pendapatan',
    description: 'Menerima pembayaran dari customer',
    debitAccountType: 'ASSET',
    creditAccountType: 'REVENUE',
    suggestedDebitCodes: ['1100', '1200'], // Cash, Bank
    suggestedCreditCodes: ['4100'], // Sales Revenue (main revenue sub-account)
    examples: [
      'Pembayaran sewa bulanan',
      'Pendapatan jasa konsultasi',
      'Penjualan produk',
      'Fee management',
    ],
  },
  {
    id: 'receive_loan',
    name: 'Terima Pinjaman',
    description: 'Menerima dana pinjaman dari bank atau pihak lain',
    debitAccountType: 'ASSET',
    creditAccountType: 'LIABILITY',
    suggestedDebitCodes: ['1100', '1200'], // Cash, Bank
    suggestedCreditCodes: [], // Will suggest any LIABILITY sub-account
    examples: [
      'Pencairan KPR',
      'Pinjaman modal usaha',
      'Kredit investasi',
      'Pinjaman dari investor',
    ],
  },

  // ============================================
  // Money OUT Patterns
  // ============================================
  {
    id: 'pay_opex',
    name: 'Bayar Biaya Operasional',
    description: 'Membayar biaya operasional rutin',
    debitAccountType: 'EXPENSE',
    creditAccountType: 'ASSET',
    suggestedDebitCodes: ['5100'], // Operating Expenses (main expense sub-account)
    suggestedCreditCodes: ['1100', '1200'], // Cash, Bank
    examples: [
      'Bayar listrik bulanan',
      'Bayar gaji karyawan',
      'Bayar asuransi',
      'Bayar internet',
      'Bayar maintenance',
    ],
  },
  {
    id: 'pay_variable_cost',
    name: 'Bayar Biaya Variabel',
    description: 'Membayar biaya yang berubah sesuai aktivitas',
    debitAccountType: 'EXPENSE',
    creditAccountType: 'ASSET',
    suggestedDebitCodes: ['5100'], // Operating Expenses
    suggestedCreditCodes: ['1100', '1200'], // Cash, Bank
    examples: [
      'Biaya cleaning per unit',
      'Supplies habis pakai',
      'Komisi penjualan',
    ],
  },
  {
    id: 'buy_asset',
    name: 'Beli Aset Tetap',
    description: 'Pembelian properti, peralatan, atau aset lainnya dengan kas',
    debitAccountType: 'ASSET',
    creditAccountType: 'ASSET',
    suggestedDebitCodes: [], // Will suggest any non-cash ASSET sub-account
    suggestedCreditCodes: ['1100', '1200'], // Cash, Bank
    examples: [
      'Beli furniture untuk property',
      'Beli komputer untuk kantor',
      'Renovasi properti',
      'Beli kendaraan operasional',
      'Beli AC atau peralatan',
    ],
  },
  {
    id: 'pay_loan',
    name: 'Bayar Hutang/Pinjaman',
    description: 'Pembayaran cicilan atau pelunasan hutang',
    debitAccountType: 'LIABILITY',
    creditAccountType: 'ASSET',
    suggestedDebitCodes: [], // Will suggest any LIABILITY sub-account
    suggestedCreditCodes: ['1100', '1200'], // Cash, Bank
    examples: [
      'Bayar cicilan KPR',
      'Pelunasan hutang usaha',
      'Bayar kartu kredit',
      'Bayar hutang ke supplier',
    ],
  },
  {
    id: 'pay_tax',
    name: 'Bayar Pajak',
    description: 'Pembayaran pajak ke pemerintah',
    debitAccountType: 'EXPENSE',
    creditAccountType: 'ASSET',
    suggestedDebitCodes: ['5100'], // Operating Expenses
    suggestedCreditCodes: ['1100', '1200'], // Cash, Bank
    examples: [
      'Bayar PPh Final',
      'Bayar PBB',
      'Bayar pajak sewa',
    ],
  },
  {
    id: 'owner_withdrawal',
    name: 'Penarikan Prive',
    description: 'Pemilik menarik dana untuk keperluan pribadi',
    debitAccountType: 'EQUITY',
    creditAccountType: 'ASSET',
    suggestedDebitCodes: [], // Will suggest EQUITY sub-accounts with "prive" or "drawing" in name
    suggestedCreditCodes: ['1100', '1200'], // Cash, Bank
    examples: [
      'Ambil uang untuk kebutuhan pribadi',
      'Transfer ke rekening pribadi',
      'Penarikan profit pemilik',
    ],
  },

  // ============================================
  // Adjustment Patterns
  // ============================================
  {
    id: 'revenue_return',
    name: 'Retur/Koreksi Pendapatan',
    description: 'Mengurangi pendapatan karena retur atau koreksi',
    debitAccountType: 'REVENUE',
    creditAccountType: 'ASSET',
    suggestedDebitCodes: ['4100'], // Sales Revenue
    suggestedCreditCodes: ['1100', '1200'], // Cash, Bank
    examples: [
      'Pengembalian uang sewa',
      'Koreksi invoice lebih catat',
      'Diskon setelah pembayaran',
    ],
  },
  {
    id: 'expense_reimbursement',
    name: 'Penggantian Biaya',
    description: 'Menerima penggantian biaya yang sudah dikeluarkan',
    debitAccountType: 'ASSET',
    creditAccountType: 'EXPENSE',
    suggestedDebitCodes: ['1100', '1200'], // Cash, Bank
    suggestedCreditCodes: ['5100'], // Operating Expenses
    examples: [
      'Klaim asuransi diterima',
      'Penggantian dari penyewa',
      'Refund dari supplier',
    ],
  },
];

/**
 * Find pattern by ID
 */
export function getPatternById(id: string): TransactionPattern | undefined {
  return TRANSACTION_PATTERNS.find((p) => p.id === id);
}

/**
 * Find patterns that match the given account types
 */
export function findMatchingPatterns(
  debitAccountType: string,
  creditAccountType: string
): TransactionPattern[] {
  return TRANSACTION_PATTERNS.filter(
    (p) =>
      p.debitAccountType === debitAccountType &&
      p.creditAccountType === creditAccountType
  );
}

/**
 * Detect pattern from transaction name keywords
 */
export function detectPatternFromName(name: string): TransactionPattern | null {
  const nameLower = name.toLowerCase();

  // Capital injection keywords
  if (
    nameLower.includes('modal') ||
    nameLower.includes('setoran') ||
    nameLower.includes('investasi pemilik')
  ) {
    return getPatternById('capital_injection') || null;
  }

  // Revenue keywords
  if (
    nameLower.includes('sewa') ||
    nameLower.includes('rental') ||
    nameLower.includes('pendapatan') ||
    nameLower.includes('pembayaran dari')
  ) {
    return getPatternById('receive_revenue') || null;
  }

  // Loan keywords
  if (
    nameLower.includes('pinjaman') ||
    nameLower.includes('kredit') ||
    nameLower.includes('kpr')
  ) {
    return getPatternById('receive_loan') || null;
  }

  // OPEX keywords
  if (
    nameLower.includes('listrik') ||
    nameLower.includes('air') ||
    nameLower.includes('internet') ||
    nameLower.includes('gaji') ||
    nameLower.includes('asuransi') ||
    nameLower.includes('maintenance')
  ) {
    return getPatternById('pay_opex') || null;
  }

  // Variable cost keywords
  if (
    nameLower.includes('cleaning') ||
    nameLower.includes('supplies') ||
    nameLower.includes('komisi')
  ) {
    return getPatternById('pay_variable_cost') || null;
  }

  // Asset purchase keywords
  if (
    nameLower.includes('beli') &&
    (nameLower.includes('furniture') ||
      nameLower.includes('komputer') ||
      nameLower.includes('ac') ||
      nameLower.includes('peralatan') ||
      nameLower.includes('kendaraan') ||
      nameLower.includes('motor') ||
      nameLower.includes('mobil'))
  ) {
    return getPatternById('buy_asset') || null;
  }

  // Loan payment keywords
  if (
    nameLower.includes('cicilan') ||
    nameLower.includes('pelunasan') ||
    nameLower.includes('bayar hutang')
  ) {
    return getPatternById('pay_loan') || null;
  }

  // Tax keywords
  if (
    nameLower.includes('pajak') ||
    nameLower.includes('pph') ||
    nameLower.includes('pbb')
  ) {
    return getPatternById('pay_tax') || null;
  }

  // Owner withdrawal keywords
  if (
    nameLower.includes('prive') ||
    nameLower.includes('pribadi') ||
    nameLower.includes('penarikan')
  ) {
    return getPatternById('owner_withdrawal') || null;
  }

  return null;
}
