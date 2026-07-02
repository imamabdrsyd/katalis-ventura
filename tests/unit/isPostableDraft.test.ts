import { describe, it, expect } from 'vitest';
import { isPostableDraft, type PostableDraftFields } from '@/lib/api/server/postableDraft';

function mkTx(overrides: Partial<PostableDraftFields> = {}): PostableDraftFields {
  return {
    amount: 100_000,
    is_multi_line: false,
    debit_account_id: 'acc-debit',
    credit_account_id: 'acc-credit',
    ...overrides,
  };
}

describe('isPostableDraft', () => {
  it('draft double-entry lengkap → postable', () => {
    expect(isPostableDraft(mkTx())).toBe(true);
  });

  it('amount 0, null, atau negatif → tidak postable', () => {
    expect(isPostableDraft(mkTx({ amount: 0 }))).toBe(false);
    expect(isPostableDraft(mkTx({ amount: null }))).toBe(false);
    expect(isPostableDraft(mkTx({ amount: -5000 }))).toBe(false);
  });

  it('draft single-sided (Save Draft tanpa akun) → tidak postable', () => {
    expect(isPostableDraft(mkTx({ debit_account_id: null }))).toBe(false);
    expect(isPostableDraft(mkTx({ credit_account_id: null }))).toBe(false);
    expect(isPostableDraft(mkTx({ debit_account_id: null, credit_account_id: null }))).toBe(false);
  });

  it('akun debit = kredit → tidak postable', () => {
    expect(isPostableDraft(mkTx({ debit_account_id: 'a', credit_account_id: 'a' }))).toBe(false);
  });

  // Regresi: constraint transactions_account_rules memaksa akun header NULL
  // untuk multi-line; guard tidak boleh menganggapnya "belum lengkap".
  it('draft multi-line (akun header NULL sesuai constraint DB) → postable', () => {
    expect(
      isPostableDraft(
        mkTx({ is_multi_line: true, debit_account_id: null, credit_account_id: null })
      )
    ).toBe(true);
  });

  it('draft multi-line dengan amount 0 → tetap tidak postable', () => {
    expect(
      isPostableDraft(
        mkTx({ is_multi_line: true, amount: 0, debit_account_id: null, credit_account_id: null })
      )
    ).toBe(false);
  });

  it('is_multi_line null (row lama) diperlakukan sebagai double-entry biasa', () => {
    expect(isPostableDraft(mkTx({ is_multi_line: null }))).toBe(true);
    expect(isPostableDraft(mkTx({ is_multi_line: null, debit_account_id: null }))).toBe(false);
  });
});
