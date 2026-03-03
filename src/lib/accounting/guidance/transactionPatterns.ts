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
    suggestedDebitCodes: ['5200'], // HPP/COGS
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
    suggestedDebitCodes: ['5300'], // Beban Pajak
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
  // Accrual & Deferred Patterns
  // ============================================
  {
    id: 'accrued_expense',
    name: 'Beban Terutang (Accrued Expense)',
    description: 'Mencatat beban yang sudah terjadi tapi belum dibayar',
    debitAccountType: 'EXPENSE',
    creditAccountType: 'LIABILITY',
    suggestedDebitCodes: ['5100'], // Operating Expenses
    suggestedCreditCodes: [], // Will suggest any LIABILITY sub-account
    examples: [
      'Beban listrik bulan ini belum dibayar',
      'Gaji karyawan belum dibayar',
      'Beban bunga pinjaman terutang',
      'Beban sewa terutang',
    ],
  },
  {
    id: 'unearned_revenue_recognized',
    name: 'Realisasi Pendapatan Diterima Dimuka',
    description: 'Mengakui pendapatan dari uang muka yang sudah diterima sebelumnya',
    debitAccountType: 'LIABILITY',
    creditAccountType: 'REVENUE',
    suggestedDebitCodes: [], // Will suggest any LIABILITY sub-account
    suggestedCreditCodes: ['4100'], // Sales Revenue
    examples: [
      'Realisasi sewa diterima dimuka',
      'Pengakuan pendapatan jasa bertahap',
      'Pendapatan dari deposit pelanggan',
    ],
  },
  {
    id: 'unearned_revenue_received',
    name: 'Pendapatan Diterima Dimuka',
    description: 'Menerima uang di muka sebelum jasa/barang diserahkan',
    debitAccountType: 'ASSET',
    creditAccountType: 'LIABILITY',
    suggestedDebitCodes: ['1100', '1200'], // Cash, Bank
    suggestedCreditCodes: [], // Will suggest any LIABILITY sub-account
    examples: [
      'Terima deposit sewa di muka',
      'Uang muka dari pelanggan',
      'Pembayaran di muka untuk jasa',
    ],
  },
  {
    id: 'liability_reclassification',
    name: 'Reklasifikasi Hutang',
    description: 'Memindahkan saldo antar akun hutang',
    debitAccountType: 'LIABILITY',
    creditAccountType: 'LIABILITY',
    suggestedDebitCodes: [], // Will suggest any LIABILITY sub-account
    suggestedCreditCodes: [], // Will suggest any LIABILITY sub-account
    examples: [
      'Reklasifikasi hutang jangka panjang ke jangka pendek',
      'Transfer saldo antar akun hutang',
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

  // OPEX keywords (checked BEFORE revenue to catch compound "sewa" keywords like "sewa kantor")
  if (
    nameLower.includes('listrik') ||
    nameLower.includes('air pdam') ||
    nameLower.includes('internet') ||
    nameLower.includes('gaji') ||
    nameLower.includes('asuransi') ||
    nameLower.includes('maintenance') ||
    nameLower.includes('bayar biaya') ||
    nameLower.includes('telepon') ||
    nameLower.includes('wifi') ||
    nameLower.includes('keamanan') ||
    nameLower.includes('kebersihan') ||
    nameLower.includes('sewa kantor') ||
    nameLower.includes('sewa gedung') ||
    nameLower.includes('sewa ruang') ||
    nameLower.includes('bayar sewa')
  ) {
    return getPatternById('pay_opex') || null;
  }

  // Revenue keywords
  if (
    nameLower.includes('sewa') ||
    nameLower.includes('rental') ||
    nameLower.includes('pendapatan') ||
    nameLower.includes('pembayaran dari') ||
    nameLower.includes('penjualan') ||
    nameLower.includes('jual') ||
    nameLower.includes('pemasukan') ||
    nameLower.includes('fee') ||
    nameLower.includes('terima pembayaran')
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

  // Variable cost keywords
  if (
    nameLower.includes('cleaning') ||
    nameLower.includes('supplies') ||
    nameLower.includes('komisi') ||
    nameLower.includes('bahan baku') ||
    nameLower.includes('persediaan') ||
    nameLower.includes('stok') ||
    nameLower.includes('packaging')
  ) {
    return getPatternById('pay_variable_cost') || null;
  }

  // Asset purchase keywords
  if (
    (nameLower.includes('beli') &&
      (nameLower.includes('furniture') ||
        nameLower.includes('komputer') ||
        nameLower.includes('ac') ||
        nameLower.includes('peralatan') ||
        nameLower.includes('kendaraan') ||
        nameLower.includes('motor') ||
        nameLower.includes('mobil'))) ||
    nameLower.includes('renovasi') ||
    nameLower.includes('perbaikan besar')
  ) {
    return getPatternById('buy_asset') || null;
  }

  // Loan payment keywords
  if (
    nameLower.includes('cicilan') ||
    nameLower.includes('pelunasan') ||
    nameLower.includes('bayar hutang') ||
    nameLower.includes('angsuran') ||
    nameLower.includes('bunga bank')
  ) {
    return getPatternById('pay_loan') || null;
  }

  // Tax keywords
  if (
    nameLower.includes('pajak') ||
    nameLower.includes('pph') ||
    nameLower.includes('pbb') ||
    nameLower.includes('ppn') ||
    nameLower.includes('retribusi')
  ) {
    return getPatternById('pay_tax') || null;
  }

  // Owner withdrawal keywords
  if (
    nameLower.includes('prive') ||
    nameLower.includes('dividen') ||
    nameLower.includes('dividend') ||
    nameLower.includes('pribadi') ||
    nameLower.includes('penarikan')
  ) {
    return getPatternById('owner_withdrawal') || null;
  }

  // Accrued expense keywords
  if (
    nameLower.includes('terutang') ||
    nameLower.includes('accrued') ||
    nameLower.includes('belum dibayar')
  ) {
    return getPatternById('accrued_expense') || null;
  }

  // Unearned/deferred revenue keywords
  if (
    nameLower.includes('diterima dimuka') ||
    nameLower.includes('deposit') ||
    nameLower.includes('uang muka')
  ) {
    return getPatternById('unearned_revenue_received') || null;
  }

  // Reclassification keywords
  if (nameLower.includes('reklasifikasi') || nameLower.includes('reclassif')) {
    return getPatternById('liability_reclassification') || null;
  }

  return null;
}
