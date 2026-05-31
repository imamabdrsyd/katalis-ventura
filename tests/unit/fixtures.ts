import type { Account, Transaction, JournalLine, AccountType, NormalBalance, TransactionCategory } from '@/types';

let txnSeq = 0;
let lineSeq = 0;

export function resetSeq() {
  txnSeq = 0;
  lineSeq = 0;
}

interface AccountInput {
  code: string;
  name: string;
  type: AccountType;
  default_category?: TransactionCategory;
  is_cash_equivalent?: boolean;
  is_trade_receivable?: boolean;
  is_operating_payable?: boolean;
  is_stock?: boolean;
  is_dividend?: boolean;
  profit_share_pct?: number | null;
  owner_stock_account_id?: string | null;
  contact_id?: string | null;
  income_statement_section?: 'cost_of_revenue' | 'operating_expense' | null;
  useful_life_months?: number;
  residual_value?: number;
  acquisition_date?: string;
}

export function makeAccount(input: AccountInput): Account {
  const normal_balance: NormalBalance =
    input.type === 'ASSET' || input.type === 'EXPENSE' ? 'DEBIT' : 'CREDIT';
  return {
    id: `acc-${input.code}`,
    business_id: 'biz-1',
    account_code: input.code,
    account_name: input.name,
    account_type: input.type,
    normal_balance,
    is_active: true,
    is_system: false,
    is_retained_earnings: false,
    is_stock: input.is_stock ?? false,
    is_dividend: input.is_dividend ?? false,
    is_dividend_payable: false,
    profit_share_pct: input.profit_share_pct ?? null,
    owner_stock_account_id: input.owner_stock_account_id ?? null,
    contact_id: input.contact_id ?? null,
    is_cash_equivalent: input.is_cash_equivalent ?? false,
    is_trade_receivable: input.is_trade_receivable ?? false,
    is_operating_payable: input.is_operating_payable ?? false,
    sort_order: 0,
    default_category: input.default_category,
    income_statement_section: input.income_statement_section ?? null,
    useful_life_months: input.useful_life_months,
    residual_value: input.residual_value,
    acquisition_date: input.acquisition_date,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

// Standard chart of accounts used across fixtures.
export const ACC = {
  kas: makeAccount({ code: '1100', name: 'Kas', type: 'ASSET', is_cash_equivalent: true, default_category: 'OPEX' }),
  bank: makeAccount({ code: '1200', name: 'Bank', type: 'ASSET', is_cash_equivalent: true, default_category: 'OPEX' }),
  piutang: makeAccount({ code: '1300', name: 'Piutang Usaha', type: 'ASSET', default_category: 'EARN' }),
  inventory: makeAccount({ code: '1400', name: 'Persediaan', type: 'ASSET', default_category: 'VAR' }),
  fixedAsset: makeAccount({ code: '1500', name: 'Peralatan', type: 'ASSET', default_category: 'CAPEX' }),
  loan: makeAccount({ code: '2100', name: 'Hutang Bank', type: 'LIABILITY', default_category: 'FIN' }),
  payable: makeAccount({ code: '2200', name: 'Hutang Usaha', type: 'LIABILITY', default_category: 'OPEX' }),
  equity: makeAccount({ code: '3100', name: 'Modal Pemilik', type: 'EQUITY', is_stock: true }),
  prive: makeAccount({ code: '3200', name: 'Prive Pemilik', type: 'EQUITY', is_dividend: true }),
  revenue: makeAccount({ code: '4100', name: 'Pendapatan Penjualan', type: 'REVENUE', default_category: 'EARN' }),
  opexExpense: makeAccount({ code: '5100', name: 'Beban Operasional', type: 'EXPENSE', default_category: 'OPEX' }),
  cogs: makeAccount({ code: '5200', name: 'HPP', type: 'EXPENSE', default_category: 'VAR' }),
  tax: makeAccount({ code: '5300', name: 'Beban Pajak', type: 'EXPENSE', default_category: 'TAX' }),
  interest: makeAccount({ code: '5400', name: 'Beban Bunga', type: 'EXPENSE', default_category: 'OPEX' }),
};

interface TxnInput {
  date?: string;
  name?: string;
  description?: string;
  notes?: string;
  amount: number;
  category: TransactionCategory;
  debit?: Account;
  credit?: Account;
}

export function legacyTxn(input: TxnInput): Transaction {
  txnSeq++;
  return {
    id: `txn-${txnSeq}`,
    business_id: 'biz-1',
    date: input.date ?? '2026-03-15',
    category: input.category,
    name: input.name ?? '',
    description: input.description ?? '',
    amount: input.amount,
    account: '',
    status: 'posted',
    created_by: 'user-1',
    created_at: '2026-03-15T00:00:00Z',
    updated_at: '2026-03-15T00:00:00Z',
    is_double_entry: false,
    is_multi_line: false,
    notes: input.notes,
  };
}

export function doubleEntryTxn(input: TxnInput): Transaction {
  if (!input.debit || !input.credit) {
    throw new Error('double-entry txn requires both debit & credit accounts');
  }
  txnSeq++;
  return {
    id: `txn-${txnSeq}`,
    business_id: 'biz-1',
    date: input.date ?? '2026-03-15',
    category: input.category,
    name: input.name ?? '',
    description: input.description ?? '',
    amount: input.amount,
    account: '',
    status: 'posted',
    created_by: 'user-1',
    created_at: '2026-03-15T00:00:00Z',
    updated_at: '2026-03-15T00:00:00Z',
    is_double_entry: true,
    is_multi_line: false,
    debit_account_id: input.debit.id,
    credit_account_id: input.credit.id,
    debit_account: input.debit,
    credit_account: input.credit,
    notes: input.notes,
  };
}

interface MultiLineInput {
  date?: string;
  name?: string;
  description?: string;
  amount: number;
  category: TransactionCategory;
  lines: Array<{ account: Account; debit?: number; credit?: number }>;
}

export function multiLineTxn(input: MultiLineInput): Transaction {
  txnSeq++;
  const txnId = `txn-${txnSeq}`;
  const journal_lines: JournalLine[] = input.lines.map((l, idx) => {
    lineSeq++;
    return {
      id: `line-${lineSeq}`,
      transaction_id: txnId,
      account_id: l.account.id,
      debit_amount: l.debit ?? 0,
      credit_amount: l.credit ?? 0,
      sort_order: idx,
      created_at: '2026-03-15T00:00:00Z',
      account: l.account,
    };
  });
  return {
    id: txnId,
    business_id: 'biz-1',
    date: input.date ?? '2026-03-15',
    category: input.category,
    name: input.name ?? '',
    description: input.description ?? '',
    amount: input.amount,
    account: '',
    status: 'posted',
    created_by: 'user-1',
    created_at: '2026-03-15T00:00:00Z',
    updated_at: '2026-03-15T00:00:00Z',
    is_double_entry: true,
    is_multi_line: true,
    journal_lines,
  };
}
