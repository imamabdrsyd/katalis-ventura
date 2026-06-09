import { z } from 'zod';
import { SUPPORTED_CURRENCIES } from '@/lib/currency';

// ============================================
// Shared validation constants
// ============================================

const VALID_CATEGORIES = ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'] as const;
const VALID_STATUSES = ['draft', 'posted'] as const;
const VALID_SALES_CHANNELS = [
  'tiktok', 'tokopedia', 'shopee', 'lazada', 'blibli',
  'airbnb', 'booking_com', 'traveloka',
  'instagram', 'whatsapp', 'website',
  'offline', 'other',
] as const;
const MAX_TRANSACTION_AMOUNT = 100_000_000_000; // 100 billion IDR
const MAX_FX_RATE = 1_000_000;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const currencyFields = {
  currency_code: z.enum(SUPPORTED_CURRENCIES).optional().default('IDR'),
  original_amount: z
    .number()
    .positive('Original amount must be greater than 0')
    .max(MAX_TRANSACTION_AMOUNT, `Original amount cannot exceed ${MAX_TRANSACTION_AMOUNT.toLocaleString()}`)
    .optional()
    .nullable(),
  fx_rate: z
    .number()
    .positive('FX rate must be greater than 0')
    .max(MAX_FX_RATE, `FX rate cannot exceed ${MAX_FX_RATE.toLocaleString()}`)
    .optional()
    .nullable(),
  fx_rate_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'FX rate date must be YYYY-MM-DD format').optional().nullable(),
  fx_gain_loss_amount: z.number().max(MAX_TRANSACTION_AMOUNT).min(-MAX_TRANSACTION_AMOUNT).optional().nullable(),
};

const optionalCurrencyFields = {
  currency_code: z.enum(SUPPORTED_CURRENCIES).optional(),
  original_amount: z
    .number()
    .positive('Original amount must be greater than 0')
    .max(MAX_TRANSACTION_AMOUNT, `Original amount cannot exceed ${MAX_TRANSACTION_AMOUNT.toLocaleString()}`)
    .optional()
    .nullable(),
  fx_rate: z
    .number()
    .positive('FX rate must be greater than 0')
    .max(MAX_FX_RATE, `FX rate cannot exceed ${MAX_FX_RATE.toLocaleString()}`)
    .optional()
    .nullable(),
  fx_rate_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'FX rate date must be YYYY-MM-DD format').optional().nullable(),
  fx_gain_loss_amount: z.number().max(MAX_TRANSACTION_AMOUNT).min(-MAX_TRANSACTION_AMOUNT).optional().nullable(),
};

// ============================================
// Transaction Schemas
// ============================================

export const createTransactionSchema = z.object({
  business_id: z.string().regex(UUID_REGEX, 'Invalid business ID format'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  category: z.enum(VALID_CATEGORIES, {
    error: `Category must be one of: ${VALID_CATEGORIES.join(', ')}`,
  }),
  name: z.string().min(1, 'Name is required').max(500, 'Name too long'),
  description: z.string().max(2000, 'Description too long').default(''),
  amount: z
    .number()
    .positive('Amount must be greater than 0')
    .max(MAX_TRANSACTION_AMOUNT, `Amount cannot exceed ${MAX_TRANSACTION_AMOUNT.toLocaleString()}`),
  ...currencyFields,
  account: z.string().max(500).default(''),

  // Optional double-entry fields
  debit_account_id: z.string().regex(UUID_REGEX, 'Invalid debit account ID').optional().nullable(),
  credit_account_id: z.string().regex(UUID_REGEX, 'Invalid credit account ID').optional().nullable(),
  is_double_entry: z.boolean().optional().default(false),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(VALID_STATUSES).optional().default('draft'),
  meta: z.record(z.string(), z.unknown()).optional().nullable(),
  sales_channel: z.enum(VALID_SALES_CHANNELS).optional().nullable(),
}).refine(
  (data) => {
    // If double-entry, both accounts must be present and different
    if (data.is_double_entry) {
      if (!data.debit_account_id || !data.credit_account_id) return false;
      if (data.debit_account_id === data.credit_account_id) return false;
    }
    return true;
  },
  {
    message: 'Double-entry transactions require different debit and credit accounts',
  }
);

export const updateTransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format').optional(),
  category: z.enum(VALID_CATEGORIES).optional(),
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  amount: z
    .number()
    .positive('Amount must be greater than 0')
    .max(MAX_TRANSACTION_AMOUNT, `Amount cannot exceed ${MAX_TRANSACTION_AMOUNT.toLocaleString()}`)
    .optional(),
  ...optionalCurrencyFields,
  account: z.string().max(500).optional(),

  debit_account_id: z.string().regex(UUID_REGEX).optional().nullable(),
  credit_account_id: z.string().regex(UUID_REGEX).optional().nullable(),
  is_double_entry: z.boolean().optional(),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(VALID_STATUSES).optional(),
  meta: z.record(z.string(), z.unknown()).optional().nullable(),
  sales_channel: z.enum(VALID_SALES_CHANNELS).optional().nullable(),
});

export const transactionIdSchema = z.string().regex(UUID_REGEX, 'Invalid transaction ID format');
export const businessIdSchema = z.string().regex(UUID_REGEX, 'Invalid business ID format');

// ============================================
// Multi-line Journal Entry Schemas
// ============================================

export const journalLineSchema = z.object({
  account_id: z.string().regex(UUID_REGEX, 'Invalid account ID format'),
  debit_amount: z.number().min(0, 'Debit amount must be >= 0'),
  credit_amount: z.number().min(0, 'Credit amount must be >= 0'),
  currency_code: z.enum(SUPPORTED_CURRENCIES).optional().default('IDR'),
  original_debit_amount: z.number().min(0).optional().nullable(),
  original_credit_amount: z.number().min(0).optional().nullable(),
  fx_rate: z.number().positive().max(MAX_FX_RATE).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  sort_order: z.number().int().min(0).default(0),
}).refine(
  (line) => {
    const hasDebit = line.debit_amount > 0;
    const hasCredit = line.credit_amount > 0;
    // Exactly one side must be non-zero
    return (hasDebit && !hasCredit) || (!hasDebit && hasCredit);
  },
  { message: 'Each line must have either a debit or credit amount, not both' }
);

export const createMultiLineTransactionSchema = z.object({
  business_id: z.string().regex(UUID_REGEX, 'Invalid business ID format'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  category: z.enum(VALID_CATEGORIES, {
    error: `Category must be one of: ${VALID_CATEGORIES.join(', ')}`,
  }),
  name: z.string().min(1, 'Name is required').max(500, 'Name too long'),
  description: z.string().max(2000, 'Description too long').default(''),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(VALID_STATUSES).optional().default('draft'),
  meta: z.record(z.string(), z.unknown()).optional().nullable(),
  ...currencyFields,
  journal_lines: z.array(journalLineSchema).min(2, 'Multi-line transaction requires at least 2 lines'),
}).refine(
  (data) => {
    const totalDebit = data.journal_lines.reduce((s, l) => s + l.debit_amount, 0);
    const totalCredit = data.journal_lines.reduce((s, l) => s + l.credit_amount, 0);
    return Math.abs(totalDebit - totalCredit) < 0.01;
  },
  { message: 'Total debit must equal total credit (balanced journal entry)' }
).refine(
  (data) => {
    const totalDebit = data.journal_lines.reduce((s, l) => s + l.debit_amount, 0);
    return totalDebit > 0;
  },
  { message: 'Transaction amount must be greater than 0' }
).refine(
  (data) => {
    const accountIds = data.journal_lines.map((l) => l.account_id);
    return accountIds.length === new Set(accountIds).size || true; // Allow same account on both sides
  },
  { message: 'Journal lines validation failed' }
);

// Bulk post (draft → posted)
export const bulkPostTransactionsSchema = z.object({
  ids: z.array(z.string().regex(UUID_REGEX)).min(1).max(500),
});

// Bulk create (import excel/csv)
export const bulkCreateTransactionsSchema = z.object({
  business_id: z.string().regex(UUID_REGEX, 'Invalid business ID format'),
  transactions: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        category: z.enum(VALID_CATEGORIES),
        name: z.string().min(1).max(500),
        description: z.string().max(2000).default(''),
        amount: z.number().positive().max(MAX_TRANSACTION_AMOUNT),
        ...currencyFields,
        account: z.string().max(500).default(''),
        debit_account_id: z.string().regex(UUID_REGEX).optional().nullable(),
        credit_account_id: z.string().regex(UUID_REGEX).optional().nullable(),
        is_double_entry: z.boolean().optional().default(false),
        notes: z.string().max(2000).optional().nullable(),
        status: z.enum(VALID_STATUSES).optional().default('draft'),
        import_batch_id: z.string().regex(UUID_REGEX).optional().nullable(),
        meta: z.record(z.string(), z.unknown()).optional().nullable(),
      })
    )
    .min(1)
    .max(2000),
});

// Update multi-line transaction
export const updateMultiLineTransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  category: z.enum(VALID_CATEGORIES).optional(),
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(VALID_STATUSES).optional(),
  meta: z.record(z.string(), z.unknown()).optional().nullable(),
  ...optionalCurrencyFields,
  journal_lines: z.array(journalLineSchema).min(2).optional(),
}).refine(
  (data) => {
    if (!data.journal_lines) return true;
    const totalDebit = data.journal_lines.reduce((s, l) => s + l.debit_amount, 0);
    const totalCredit = data.journal_lines.reduce((s, l) => s + l.credit_amount, 0);
    return Math.abs(totalDebit - totalCredit) < 0.01;
  },
  { message: 'Total debit must equal total credit (balanced journal entry)' }
);

// Settle transaction (full or partial)
export const settleTransactionSchema = z.object({
  settlement_data: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    category: z.enum(VALID_CATEGORIES),
    name: z.string().min(1).max(500),
    description: z.string().max(2000),
    ...optionalCurrencyFields,
    debit_account_id: z.string().regex(UUID_REGEX).optional().nullable(),
    credit_account_id: z.string().regex(UUID_REGEX).optional().nullable(),
    is_double_entry: z.boolean().optional(),
    account: z.string().max(500).optional(),
    notes: z.string().max(2000).optional().nullable(),
    status: z.enum(VALID_STATUSES).optional(),
    meta: z.record(z.string(), z.unknown()).optional().nullable(),
  }),
  partial_amount: z.number().positive().max(MAX_TRANSACTION_AMOUNT).optional().nullable(),
  outstanding_amount: z.number().min(0).max(MAX_TRANSACTION_AMOUNT).optional().nullable(),
});

// ============================================
// Account Schemas
// ============================================

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;
const NORMAL_BALANCES = ['DEBIT', 'CREDIT'] as const;
const INCOME_STATEMENT_SECTIONS = ['cost_of_revenue', 'operating_expense'] as const;

export const createAccountSchema = z.object({
  business_id: z.string().regex(UUID_REGEX, 'Invalid business ID format'),
  account_code: z.string().min(1).max(20),
  account_name: z.string().min(1).max(200),
  account_type: z.enum(ACCOUNT_TYPES),
  parent_account_id: z.string().regex(UUID_REGEX).optional().nullable(),
  normal_balance: z.enum(NORMAL_BALANCES),
  is_active: z.boolean().optional().default(true),
  is_system: z.boolean().optional().default(false),
  is_stock: z.boolean().optional(),
  is_retained_earnings: z.boolean().optional(),
  is_dividend: z.boolean().optional(),
  is_dividend_payable: z.boolean().optional(),
  is_cash_equivalent: z.boolean().optional(),
  is_trade_receivable: z.boolean().optional(),
  is_operating_payable: z.boolean().optional(),
  profit_share_pct: z.number().min(0).max(100).optional().nullable(),
  owner_stock_account_id: z.string().regex(UUID_REGEX).optional().nullable(),
  contact_id: z.string().regex(UUID_REGEX).optional().nullable(),
  currency_code: z.enum(SUPPORTED_CURRENCIES).optional().default('IDR'),
  sort_order: z.number().int().optional().default(0),
  description: z.string().max(1000).optional().nullable(),
  default_category: z.string().max(20).optional().nullable(),
  income_statement_section: z.enum(INCOME_STATEMENT_SECTIONS).optional().nullable(),
});

export const updateAccountSchema = z.object({
  account_code: z.string().min(1).max(20).optional(),
  account_name: z.string().min(1).max(200).optional(),
  account_type: z.enum(ACCOUNT_TYPES).optional(),
  parent_account_id: z.string().regex(UUID_REGEX).optional().nullable(),
  normal_balance: z.enum(NORMAL_BALANCES).optional(),
  is_active: z.boolean().optional(),
  is_stock: z.boolean().optional(),
  is_retained_earnings: z.boolean().optional(),
  is_dividend: z.boolean().optional(),
  is_dividend_payable: z.boolean().optional(),
  is_cash_equivalent: z.boolean().optional(),
  is_trade_receivable: z.boolean().optional(),
  is_operating_payable: z.boolean().optional(),
  profit_share_pct: z.number().min(0).max(100).optional().nullable(),
  owner_stock_account_id: z.string().regex(UUID_REGEX).optional().nullable(),
  contact_id: z.string().regex(UUID_REGEX).optional().nullable(),
  currency_code: z.enum(SUPPORTED_CURRENCIES).optional(),
  sort_order: z.number().int().optional(),
  description: z.string().max(1000).optional().nullable(),
  default_category: z.string().max(20).optional().nullable(),
  income_statement_section: z.enum(INCOME_STATEMENT_SECTIONS).optional().nullable(),
});

export const accountIdSchema = z.string().regex(UUID_REGEX, 'Invalid account ID format');

export const bulkUpdateIncomeStatementSectionSchema = z.object({
  business_id: z.string().regex(UUID_REGEX, 'Invalid business ID format'),
  updates: z.array(
    z.object({
      id: z.string().regex(UUID_REGEX, 'Invalid account ID format'),
      section: z.enum(INCOME_STATEMENT_SECTIONS).nullable(),
    })
  ).min(1),
});

// ============================================
// Business Schemas
// ============================================

export const createBusinessSchema = z.object({
  business_name: z.string().min(1, 'Nama bisnis wajib diisi').max(200),
  business_sector: z.string().min(1).max(100),
  business_type: z.string().max(100).optional(),
  capital_investment: z.number().min(0).max(MAX_TRANSACTION_AMOUNT).optional().default(0),
  base_currency_code: z.enum(SUPPORTED_CURRENCIES).optional().default('IDR'),
  property_address: z.string().max(500).optional(),
  logo_url: z.string().url().optional().or(z.literal('')),
  logo_fit: z.enum(['cover', 'contain']).optional(),
  city: z.string().max(100).optional(),
  whatsapp_number: z.string().max(30).optional(),
  widget_action_label: z.string().max(100).optional(),
  is_public: z.boolean().optional(),
});

export const updateBusinessSchema = z.object({
  business_name: z.string().min(1).max(200).optional(),
  business_sector: z.string().min(1).max(100).optional(),
  business_type: z.string().max(100).optional(),
  capital_investment: z.number().min(0).max(MAX_TRANSACTION_AMOUNT).optional(),
  base_currency_code: z.enum(SUPPORTED_CURRENCIES).optional(),
  property_address: z.string().max(500).optional().nullable(),
  logo_url: z.string().optional().nullable(),
  logo_fit: z.enum(['cover', 'contain']).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  whatsapp_number: z.string().max(30).optional().nullable(),
  widget_action_label: z.string().max(100).optional().nullable(),
  is_public: z.boolean().optional(),
  show_in_logo_slide: z.boolean().optional(),
  is_archived: z.boolean().optional(),
  operations_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  legal_name: z.string().max(200).nullable().optional(),
  legal_entity_type: z.string().max(50).nullable().optional(),
  registered_address: z.string().max(500).nullable().optional(),
});

// ============================================
// Invite Code Schemas
// ============================================

// HIGH-01 fix: role 'superadmin' & legacy 'both' tidak boleh di-issue lewat
// invite code. Superadmin di-grant manual lewat member management agar
// jalur promosi auditable dan tidak bisa di-share via link.
export const createInviteCodeSchema = z.object({
  business_id: z.string().regex(UUID_REGEX, 'Invalid business ID format'),
  role: z.enum(['business_manager', 'investor']),
  expires_at: z.string().datetime().optional().nullable(),
  max_uses: z.number().int().positive().optional().nullable(),
});

export const inviteCodeIdSchema = z.string().regex(UUID_REGEX, 'Invalid invite code ID format');

// ============================================
// Type exports
// ============================================

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type JournalLineInput = z.infer<typeof journalLineSchema>;
export type CreateMultiLineTransactionInput = z.infer<typeof createMultiLineTransactionSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
export type CreateInviteCodeInput = z.infer<typeof createInviteCodeSchema>;
