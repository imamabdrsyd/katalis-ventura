import * as XLSX from 'xlsx';
import type { Transaction, JournalLine } from '@/types';

/**
 * Ekspor transaksi ke Excel/CSV.
 *
 * Kolomnya mengikuti DATA NYATA yang dipegang aplikasi — termasuk kontak,
 * nomor transaksi, status, mata uang asing, dan baris jurnal multi-line.
 *
 * Sengaja TIDAK meniru template "Import Lengkap": template itu bentuk yang
 * disederhanakan untuk memudahkan orang mengisi data baru (tanpa kontak, tanpa
 * multi-line). Ekspor punya tugas sebaliknya — mengeluarkan apa adanya. Menyempitkan
 * keluaran agar muat ke bentuk template justru membuang data yang benar-benar ada.
 */

/** Kolom sheet utama, mengikuti bentuk data transaksi di aplikasi. */
export const TRANSACTION_HEADERS = [
  'No Transaksi',
  'Tanggal',
  'Kategori',
  'Kontak',
  'Tipe Kontak',
  'Deskripsi',
  'Jumlah',
  'Mata Uang',
  'Jumlah Asli',
  'Kurs',
  'Akun Debit',
  'Nama Akun Debit',
  'Akun Kredit',
  'Nama Akun Kredit',
  'Multi-line',
  'Status',
  'Kanal Penjualan',
  'Rekonsiliasi',
  'Catatan',
  'Akun (legacy)',
  'Dibuat',
] as const;

/** Sheet kedua: baris jurnal transaksi multi-line, satu baris per jurnal. */
export const JOURNAL_HEADERS = [
  'No Transaksi',
  'Tanggal',
  'Deskripsi Transaksi',
  'Urutan',
  'Kode Akun',
  'Nama Akun',
  'Debit',
  'Kredit',
  'Deskripsi Baris',
] as const;

/**
 * Karakter yang membuat Excel/Sheets memperlakukan sel sebagai formula.
 * Deskripsi, nama kontak, dan catatan berasal dari input user — tidak boleh
 * tereksekusi saat file dibuka.
 */
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

function sanitize(value: string): string {
  return FORMULA_TRIGGERS.some((c) => value.startsWith(c)) ? `'${value}` : value;
}

function text(value: string | null | undefined): string {
  return value ? sanitize(String(value)) : '';
}

function num(value: number | null | undefined): number | '' {
  return typeof value === 'number' ? value : '';
}

/**
 * Nama pihak lawan transaksi.
 *
 * `contact` adalah relasi sungguhan (AR/AP), sedangkan `name` kolom teks bebas
 * warisan lama. Kontak diutamakan; `name` jadi cadangan agar transaksi lama
 * yang belum ditautkan ke kontak tidak keluar kosong.
 */
function contactName(tx: Transaction): string {
  return text(tx.contact?.name ?? tx.name);
}

/**
 * Tipe kontak — hanya ada kalau transaksi benar-benar tertaut ke kontak.
 *
 * Sebagian besar transaksi masih memakai `name` teks bebas tanpa `contact_id`,
 * jadi tipenya memang tidak ada. Sel kosong akan terbaca ambigu ("datanya hilang?"),
 * padahal jawabannya "transaksi ini belum ditautkan ke kontak" — dan itu yang
 * ditulis, supaya pembacanya tahu ini soal penautan, bukan data yang lenyap.
 */
function contactTypeLabel(tx: Transaction): string {
  if (tx.contact?.type) return text(tx.contact.type);
  return tx.name?.trim() ? '(belum ditautkan)' : '';
}

export function toTransactionRows(transactions: Transaction[]): Record<string, unknown>[] {
  return transactions.map((tx) => ({
    'No Transaksi': text(tx.transaction_number),
    Tanggal: tx.date,
    Kategori: tx.category,
    Kontak: contactName(tx),
    'Tipe Kontak': contactTypeLabel(tx),
    Deskripsi: text(tx.description),
    Jumlah: tx.amount,
    'Mata Uang': text(tx.currency_code) || 'IDR',
    'Jumlah Asli': num(tx.original_amount),
    Kurs: num(tx.fx_rate),
    // Multi-line tidak muat di dua kolom — detailnya ada di sheet Jurnal.
    'Akun Debit': tx.is_multi_line ? '' : text(tx.debit_account?.account_code),
    'Nama Akun Debit': tx.is_multi_line ? '' : text(tx.debit_account?.account_name),
    'Akun Kredit': tx.is_multi_line ? '' : text(tx.credit_account?.account_code),
    'Nama Akun Kredit': tx.is_multi_line ? '' : text(tx.credit_account?.account_name),
    'Multi-line': tx.is_multi_line ? 'Ya' : 'Tidak',
    Status: tx.status,
    'Kanal Penjualan': text(tx.sales_channel),
    Rekonsiliasi: tx.is_reconciled ? 'Ya' : 'Tidak',
    Catatan: text(tx.notes),
    'Akun (legacy)': text(tx.account),
    Dibuat: text(tx.created_at),
  }));
}

interface JournalRowSource {
  tx: Transaction;
  line: JournalLine;
}

/** Baris jurnal dari seluruh transaksi multi-line, diurut mengikuti transaksinya. */
function collectJournalRows(transactions: Transaction[]): JournalRowSource[] {
  const out: JournalRowSource[] = [];

  for (const tx of transactions) {
    if (!tx.journal_lines?.length) continue;

    const lines = [...tx.journal_lines].sort((a, b) => a.sort_order - b.sort_order);
    for (const line of lines) out.push({ tx, line });
  }

  return out;
}

export function toJournalRows(transactions: Transaction[]): Record<string, unknown>[] {
  return collectJournalRows(transactions).map(({ tx, line }) => ({
    'No Transaksi': text(tx.transaction_number),
    Tanggal: tx.date,
    'Deskripsi Transaksi': text(tx.description),
    Urutan: line.sort_order,
    'Kode Akun': text(line.account?.account_code),
    'Nama Akun': text(line.account?.account_name),
    Debit: line.debit_amount,
    Kredit: line.credit_amount,
    'Deskripsi Baris': text(line.description),
  }));
}

const TRANSACTION_COL_WIDTHS = [
  16, 12, 10, 24, 14, 38, 16, 10, 14, 12, 12, 24, 12, 24, 10, 10, 14, 12, 30, 14, 20,
];

const JOURNAL_COL_WIDTHS = [16, 12, 34, 8, 12, 26, 16, 16, 30];

function sheetFrom(
  rows: Record<string, unknown>[],
  headers: readonly string[],
  widths: number[]
): XLSX.WorkSheet {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: headers as string[] });
  sheet['!cols'] = widths.map((wch) => ({ wch }));
  return sheet;
}

export function buildTransactionWorkbook(transactions: Transaction[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    sheetFrom(toTransactionRows(transactions), TRANSACTION_HEADERS, TRANSACTION_COL_WIDTHS),
    'Transaksi'
  );

  // Sheet jurnal hanya dibuat kalau memang ada transaksi multi-line — sheet
  // kosong hanya menimbulkan pertanyaan tanpa memberi informasi.
  const journalRows = toJournalRows(transactions);
  if (journalRows.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      sheetFrom(journalRows, JOURNAL_HEADERS, JOURNAL_COL_WIDTHS),
      'Jurnal'
    );
  }

  return wb;
}

/** `transaksi-nama-bisnis-2026-08-28` — tanpa ekstensi. */
export function transactionExportFileName(businessName: string, date = new Date()): string {
  const slug =
    businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'bisnis';

  return `transaksi-${slug}-${date.toISOString().slice(0, 10)}`;
}

export function exportTransactionsToExcel(transactions: Transaction[], businessName: string): void {
  XLSX.writeFile(
    buildTransactionWorkbook(transactions),
    `${transactionExportFileName(businessName)}.xlsx`
  );
}

export function exportTransactionsToCsv(transactions: Transaction[], businessName: string): void {
  // CSV hanya memuat sheet transaksi — format satu-tabel tidak bisa membawa
  // sheet jurnal. Untuk multi-line yang utuh, pakai Excel.
  const sheet = sheetFrom(
    toTransactionRows(transactions),
    TRANSACTION_HEADERS,
    TRANSACTION_COL_WIDTHS
  );
  const csv = XLSX.utils.sheet_to_csv(sheet);

  // BOM supaya Excel di Windows membaca UTF-8 dengan benar.
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${transactionExportFileName(businessName)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
