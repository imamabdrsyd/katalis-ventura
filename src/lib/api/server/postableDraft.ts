/**
 * Guard: hanya draft yang LENGKAP boleh transisi ke `posted`.
 *
 * Fitur "Save Draft" mengizinkan user menyimpan transaksi yang baru sebagian
 * terisi (mis. jumlah sudah diisi tapi akun belum dipilih) supaya bisa
 * dilanjutkan nanti. Draft seperti itu belum boleh masuk ke laporan keuangan,
 * jadi posting-nya diblokir sampai field wajib (akun debit & kredit, jumlah > 0)
 * terpenuhi.
 */
export interface PostableDraftFields {
  amount: number | null;
  debit_account_id: string | null;
  credit_account_id: string | null;
}

export function isPostableDraft(tx: PostableDraftFields): boolean {
  if (!tx.amount || tx.amount <= 0) return false;
  if (!tx.debit_account_id || !tx.credit_account_id) return false;
  if (tx.debit_account_id === tx.credit_account_id) return false;
  return true;
}
