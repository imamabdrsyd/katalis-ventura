import { describe, it, expect } from 'vitest';
import {
  TRANSACTION_HEADERS,
  JOURNAL_HEADERS,
  toTransactionRows,
  toJournalRows,
  transactionExportFileName,
} from '@/lib/transactionExport';
import type { Transaction, JournalLine, Contact } from '@/types';

function mkContact(over: Partial<Contact> = {}): Contact {
  return {
    id: 'c-1',
    business_id: 'b-1',
    name: 'PT Sinar Jaya',
    type: 'customer',
    phone: null,
    email: null,
    address: null,
    notes: null,
    id_card_attachments: [],
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  } as Contact;
}

function mkTx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: 't-1',
    business_id: 'b-1',
    date: '2026-08-01',
    category: 'EARN',
    name: 'Nama Legacy',
    description: 'Sewa bulanan',
    amount: 5_000_000,
    account: 'BCA',
    status: 'posted',
    created_by: 'u-1',
    created_at: '2026-08-01T09:00:00Z',
    updated_at: '2026-08-01T09:00:00Z',
    ...over,
  } as Transaction;
}

function mkLine(over: Partial<JournalLine> = {}): JournalLine {
  return {
    id: 'jl-1',
    transaction_id: 't-1',
    account_id: 'a-1',
    debit_amount: 1000,
    credit_amount: 0,
    sort_order: 0,
    created_at: '2026-08-01T09:00:00Z',
    ...over,
  } as JournalLine;
}

describe('kolom ekspor transaksi', () => {
  it('membawa kontak — data yang tidak ada di template import', () => {
    // Ini alasan ekspor TIDAK meniru bentuk template import: template
    // disederhanakan dan tidak punya kolom kontak, padahal datanya nyata.
    expect(TRANSACTION_HEADERS).toContain('Kontak');
    expect(TRANSACTION_HEADERS).toContain('Tipe Kontak');

    const [row] = toTransactionRows([
      mkTx({ contact: mkContact({ name: 'CV Mitra', type: 'vendor' }) }),
    ]);

    expect(row.Kontak).toBe('CV Mitra');
    expect(row['Tipe Kontak']).toBe('vendor');
  });

  it('memakai name legacy saat transaksi belum ditautkan ke kontak', () => {
    const [row] = toTransactionRows([mkTx({ contact: undefined, name: 'Warung Bu Tini' })]);
    expect(row.Kontak).toBe('Warung Bu Tini');
  });

  it('mengeluarkan nomor transaksi, status, dan rekonsiliasi apa adanya', () => {
    const [row] = toTransactionRows([
      mkTx({
        transaction_number: 'TRX-0007',
        status: 'draft',
        is_reconciled: true,
        notes: 'menunggu bukti',
      }),
    ]);

    expect(row['No Transaksi']).toBe('TRX-0007');
    expect(row.Status).toBe('draft');
    expect(row.Rekonsiliasi).toBe('Ya');
    expect(row.Catatan).toBe('menunggu bukti');
  });

  it('mengeluarkan detail mata uang asing', () => {
    const [row] = toTransactionRows([
      mkTx({ currency_code: 'USD', original_amount: 320, fx_rate: 15_500 }),
    ]);

    expect(row['Mata Uang']).toBe('USD');
    expect(row['Jumlah Asli']).toBe(320);
    expect(row.Kurs).toBe(15_500);
  });

  it('default mata uang IDR saat kosong', () => {
    const [row] = toTransactionRows([mkTx()]);
    expect(row['Mata Uang']).toBe('IDR');
    expect(row['Jumlah Asli']).toBe('');
  });

  it('mengisi kode dan nama akun untuk transaksi dua-sisi', () => {
    const [row] = toTransactionRows([
      mkTx({
        debit_account: { account_code: '1120', account_name: 'Bank BCA' } as never,
        credit_account: { account_code: '4100', account_name: 'Pendapatan Sewa' } as never,
      }),
    ]);

    expect(row['Akun Debit']).toBe('1120');
    expect(row['Nama Akun Debit']).toBe('Bank BCA');
    expect(row['Akun Kredit']).toBe('4100');
    expect(row['Nama Akun Kredit']).toBe('Pendapatan Sewa');
    expect(row['Multi-line']).toBe('Tidak');
  });
});

describe('transaksi multi-line', () => {
  it('mengosongkan kolom debit/kredit alih-alih memaksakan satu baris jurnal', () => {
    // Memaksakan salah satu baris ke dua kolom akan menyesatkan pembacanya —
    // lebih baik kosong dan jujur, detailnya ada di sheet Jurnal.
    const [row] = toTransactionRows([
      mkTx({
        is_multi_line: true,
        debit_account: { account_code: '1120', account_name: 'Bank BCA' } as never,
        credit_account: { account_code: '4100', account_name: 'Pendapatan' } as never,
      }),
    ]);

    expect(row['Akun Debit']).toBe('');
    expect(row['Akun Kredit']).toBe('');
    expect(row['Multi-line']).toBe('Ya');
  });

  it('mengeluarkan baris jurnal terurut sort_order', () => {
    const rows = toJournalRows([
      mkTx({
        transaction_number: 'TRX-9',
        is_multi_line: true,
        journal_lines: [
          mkLine({ id: 'b', sort_order: 2, credit_amount: 700, debit_amount: 0 }),
          mkLine({ id: 'a', sort_order: 1, debit_amount: 700, credit_amount: 0 }),
        ],
      }),
    ]);

    expect(rows.map((r) => r.Urutan)).toEqual([1, 2]);
    expect(rows[0].Debit).toBe(700);
    expect(rows[1].Kredit).toBe(700);
    expect(rows[0]['No Transaksi']).toBe('TRX-9');
  });

  it('tidak menghasilkan baris jurnal untuk transaksi biasa', () => {
    expect(toJournalRows([mkTx()])).toEqual([]);
  });

  it('header jurnal memuat kolom debit dan kredit terpisah', () => {
    expect(JOURNAL_HEADERS).toContain('Debit');
    expect(JOURNAL_HEADERS).toContain('Kredit');
  });
});

describe('keamanan sel', () => {
  it('menetralkan teks yang akan dibaca Excel sebagai formula', () => {
    // Deskripsi & nama kontak berasal dari input user.
    const [row] = toTransactionRows([
      mkTx({
        description: '=HYPERLINK("http://jahat","klik")',
        contact: mkContact({ name: '+62812' }),
        notes: '@SUM(A1)',
      }),
    ]);

    expect(String(row.Deskripsi).startsWith("'=")).toBe(true);
    expect(String(row.Kontak).startsWith("'+")).toBe(true);
    expect(String(row.Catatan).startsWith("'@")).toBe(true);
  });

  it('tidak mengutak-atik teks biasa', () => {
    const [row] = toTransactionRows([mkTx({ description: 'Sewa bulanan' })]);
    expect(row.Deskripsi).toBe('Sewa bulanan');
  });

  it('menjaga Jumlah tetap angka, bukan teks', () => {
    const [row] = toTransactionRows([mkTx({ amount: 1_250_000 })]);
    expect(typeof row.Jumlah).toBe('number');
  });
});

describe('nama berkas', () => {
  it('membuat slug dari nama bisnis dan tanggal', () => {
    expect(transactionExportFileName('Marriot Hotel', new Date('2026-08-28T10:00:00Z'))).toBe(
      'transaksi-marriot-hotel-2026-08-28'
    );
  });

  it('punya cadangan saat nama bisnis tidak menyisakan karakter slug', () => {
    expect(transactionExportFileName('!!!', new Date('2026-08-28T10:00:00Z'))).toBe(
      'transaksi-bisnis-2026-08-28'
    );
  });
});
