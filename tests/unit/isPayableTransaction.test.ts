import { describe, it, expect } from 'vitest';
import { isPayableTransaction } from '@/lib/accounting/guidance/payableSettlement';
import type { Account, Transaction } from '@/types';

function account(partial: Partial<Account>): Account {
  return {
    id: 'acc-1',
    business_id: 'biz-1',
    account_code: '2100',
    account_name: 'Flexi Cash',
    account_type: 'LIABILITY',
    normal_balance: 'CREDIT',
    is_active: true,
    ...partial,
  } as Account;
}

function txn(partial: Partial<Transaction>): Transaction {
  return {
    id: 'txn-1',
    business_id: 'biz-1',
    date: '2023-03-02',
    name: 'Jenius',
    description: 'Flexi Cash - aa pinjem',
    amount: 2_000_000,
    category: 'FIN',
    is_double_entry: false,
    is_multi_line: false,
    ...partial,
  } as Transaction;
}

describe('isPayableTransaction', () => {
  it('detects a plain double-entry loan whose liability account is not named "hutang"', () => {
    // Regression: jalur double-entry dulu mensyaratkan nama akun cocok
    // /hutang|utang|payable/, sehingga pinjaman "Flexi Cash" hilang dari picker
    // pelunasan padahal account_type-nya sudah LIABILITY.
    const t = txn({
      is_double_entry: true,
      credit_account_id: 'acc-1',
      credit_account: account({ account_name: 'Flexi Cash ' }),
    });
    expect(isPayableTransaction(t)).toBe(true);
  });

  it.each(['Credit Card', 'Loans Payable', 'Hutang Usaha'])(
    'detects liability account "%s" regardless of naming',
    (account_name) => {
      const t = txn({
        is_double_entry: true,
        credit_account_id: 'acc-1',
        credit_account: account({ account_name }),
      });
      expect(isPayableTransaction(t)).toBe(true);
    }
  );

  it('agrees with the multi-line path for the same liability account', () => {
    const shared = account({ account_name: 'Flexi Cash ' });
    const simple = txn({
      is_double_entry: true,
      credit_account_id: 'acc-1',
      credit_account: shared,
    });
    const multiLine = txn({
      is_multi_line: true,
      journal_lines: [
        { account_id: 'bank', debit_amount: 2_000_000, credit_amount: 0, account: account({ account_code: '1200', account_name: 'Bank', account_type: 'ASSET', normal_balance: 'DEBIT' }) },
        { account_id: 'acc-1', debit_amount: 0, credit_amount: 2_000_000, account: shared },
      ],
    } as Partial<Transaction>);

    expect(isPayableTransaction(simple)).toBe(isPayableTransaction(multiLine));
    expect(isPayableTransaction(multiLine)).toBe(true);
  });

  it('does not treat a non-liability credit account as payable', () => {
    const t = txn({
      is_double_entry: true,
      credit_account_id: 'acc-rev',
      credit_account: account({
        account_code: '4100',
        account_name: 'Pendapatan Penjualan',
        account_type: 'REVENUE',
      }),
    });
    expect(isPayableTransaction(t)).toBe(false);
  });

  it('returns false for legacy single-entry transactions', () => {
    expect(isPayableTransaction(txn({ is_double_entry: false }))).toBe(false);
  });
});
