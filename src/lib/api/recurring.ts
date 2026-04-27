import { createClient } from '@/lib/supabase';
import type {
  RecurringTransaction,
  RecurringFrequency,
  RecurringStatus,
  TransactionCategory,
  TransactionMeta,
} from '@/types';
import { createTransaction } from './transactions';

// ============================================
// Types
// ============================================

export interface RecurringTransactionInsert {
  business_id: string;
  name: string;
  description: string;
  amount: number;
  category: TransactionCategory;
  account: string;
  debit_account_id?: string;
  credit_account_id?: string;
  is_double_entry?: boolean;
  notes?: string;
  meta?: TransactionMeta | null;
  frequency: RecurringFrequency;
  interval_value: number;
  next_due_date: string;
  end_date?: string | null;
  created_by: string;
}

export interface RecurringTransactionUpdate {
  name?: string;
  description?: string;
  amount?: number;
  category?: TransactionCategory;
  debit_account_id?: string;
  credit_account_id?: string;
  notes?: string;
  frequency?: RecurringFrequency;
  interval_value?: number;
  next_due_date?: string;
  end_date?: string | null;
  status?: RecurringStatus;
}

// ============================================
// Date helpers
// ============================================

/**
 * Compute the next due date after `current` based on frequency and interval.
 */
export function computeNextDueDate(
  current: string,
  frequency: RecurringFrequency,
  intervalValue: number
): string {
  const date = new Date(current);

  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + 7 * intervalValue);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + intervalValue);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + intervalValue);
      break;
  }

  return date.toISOString().split('T')[0];
}

/**
 * Format frequency for display.
 */
export function formatFrequency(frequency: RecurringFrequency, intervalValue: number): string {
  const labels: Record<RecurringFrequency, string> = {
    weekly: 'minggu',
    monthly: 'bulan',
    yearly: 'tahun',
  };
  if (intervalValue === 1) return `Setiap ${labels[frequency]}`;
  return `Setiap ${intervalValue} ${labels[frequency]}`;
}

// ============================================
// CRUD Operations
// ============================================

const RECURRING_SELECT = `
  *,
  debit_account:accounts!recurring_transactions_debit_account_id_fkey(*),
  credit_account:accounts!recurring_transactions_credit_account_id_fkey(*)
`;

/**
 * Get all recurring transactions for a business.
 */
export async function getRecurringTransactions(
  businessId: string
): Promise<RecurringTransaction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('recurring_transactions')
    .select(RECURRING_SELECT)
    .eq('business_id', businessId)
    .order('next_due_date', { ascending: true });

  if (error) throw new Error(error.message);
  return data as RecurringTransaction[];
}

/**
 * Create a new recurring transaction template.
 */
export async function createRecurringTransaction(
  data: RecurringTransactionInsert
): Promise<RecurringTransaction> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from('recurring_transactions')
    .insert(data)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return result as RecurringTransaction;
}

/**
 * Update a recurring transaction template.
 */
/**
 * Returns true if the row was found and updated, false if not found.
 */
export async function updateRecurringTransaction(
  id: string,
  updates: RecurringTransactionUpdate
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('recurring_transactions')
    .update(updates)
    .eq('id', id)
    .select('id');

  if (error) throw new Error(error.message);
  return Array.isArray(data) && data.length > 0;
}

/**
 * Delete a recurring transaction template (hard delete).
 */
export async function deleteRecurringTransaction(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('recurring_transactions')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// ============================================
// Auto-generation logic
// ============================================

/**
 * Generate draft transactions for all active recurring templates that are due.
 *
 * Design decisions:
 * - Only generates ONE draft per template (the most recent due date), not backfill.
 *   This avoids flooding users who haven't logged in for a while.
 * - Uses `last_generated_date` guard to prevent duplicate generation.
 * - Advances `next_due_date` after generation; if past `end_date`, sets status to 'stopped'.
 *
 * @returns Number of drafts created.
 */
export async function generateDueRecurringTransactions(
  businessId: string,
  userId: string
): Promise<number> {
  const supabase = createClient();
  const today = new Date().toISOString().split('T')[0];

  // Fetch all active templates that are due
  const { data: dueTemplates, error } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('business_id', businessId)
    .eq('status', 'active')
    .lte('next_due_date', today);

  if (error) throw new Error(error.message);
  if (!dueTemplates || dueTemplates.length === 0) return 0;

  let generated = 0;

  for (const template of dueTemplates) {
    // Guard: skip if already generated for this due date
    if (template.last_generated_date && template.last_generated_date >= template.next_due_date) {
      continue;
    }

    try {
      // Create draft transaction from template
      await createTransaction({
        business_id: template.business_id,
        date: template.next_due_date,
        category: template.category,
        name: template.name,
        description: template.description,
        amount: template.amount,
        account: template.account || '',
        debit_account_id: template.debit_account_id,
        credit_account_id: template.credit_account_id,
        is_double_entry: template.is_double_entry ?? false,
        notes: template.notes,
        meta: {
          ...(template.meta as Record<string, unknown> || {}),
          recurring_template_id: template.id,
        },
        created_by: userId,
        status: 'draft',
      });

      // Compute next due date
      const nextDue = computeNextDueDate(
        template.next_due_date,
        template.frequency,
        template.interval_value
      );

      // Check if next due date exceeds end_date
      const shouldStop = template.end_date && nextDue > template.end_date;

      // Update template: advance next_due_date, update counters
      await supabase
        .from('recurring_transactions')
        .update({
          next_due_date: nextDue,
          last_generated_date: template.next_due_date,
          total_generated: (template.total_generated || 0) + 1,
          ...(shouldStop ? { status: 'stopped' } : {}),
        })
        .eq('id', template.id)
        .eq('next_due_date', template.next_due_date); // Optimistic concurrency

      generated++;
    } catch (err) {
      console.error(`[Recurring] Failed to generate for template ${template.id}:`, err);
    }
  }

  return generated;
}
