import { z } from 'zod';

// ============================================
// Shared validation constants
// ============================================

const VALID_CATEGORIES = ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'] as const;
const MAX_TRANSACTION_AMOUNT = 100_000_000_000; // 100 billion IDR
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  account: z.string().max(500).default(''),

  // Optional double-entry fields
  debit_account_id: z.string().regex(UUID_REGEX, 'Invalid debit account ID').optional().nullable(),
  credit_account_id: z.string().regex(UUID_REGEX, 'Invalid credit account ID').optional().nullable(),
  is_double_entry: z.boolean().optional().default(false),
  notes: z.string().max(2000).optional().nullable(),
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
  account: z.string().max(500).optional(),

  debit_account_id: z.string().regex(UUID_REGEX).optional().nullable(),
  credit_account_id: z.string().regex(UUID_REGEX).optional().nullable(),
  is_double_entry: z.boolean().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export const transactionIdSchema = z.string().regex(UUID_REGEX, 'Invalid transaction ID format');
export const businessIdSchema = z.string().regex(UUID_REGEX, 'Invalid business ID format');

// ============================================
// Type exports
// ============================================

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
