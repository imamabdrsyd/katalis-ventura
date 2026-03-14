import { createClient } from '@/lib/supabase';
import type { Budget, BudgetLine, BudgetFormData, BudgetLineInput, BudgetStatus } from '@/types';

// Fetch all budgets for a business
export async function getBudgets(businessId: string): Promise<Budget[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('business_id', businessId)
    .order('start_date', { ascending: false });

  if (error) throw new Error(error.message);
  return data as Budget[];
}

// Fetch a single budget with its lines (joined with account data)
export async function getBudget(budgetId: string): Promise<Budget | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('budgets')
    .select(`
      *,
      lines:budget_lines(*, account:accounts(*))
    `)
    .eq('id', budgetId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  return data as Budget;
}

// Fetch budget lines for a specific budget (with account join)
export async function getBudgetLines(budgetId: string): Promise<BudgetLine[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('budget_lines')
    .select('*, account:accounts(*)')
    .eq('budget_id', budgetId)
    .order('month', { ascending: true });

  if (error) throw new Error(error.message);
  return data as BudgetLine[];
}

// Create a new budget
export async function createBudget(
  businessId: string,
  userId: string,
  data: BudgetFormData
): Promise<Budget> {
  const supabase = createClient();
  const { data: budget, error } = await supabase
    .from('budgets')
    .insert({
      business_id: businessId,
      name: data.name,
      start_date: data.start_date,
      end_date: data.end_date,
      notes: data.notes || null,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return budget as Budget;
}

// Update budget header
export async function updateBudget(
  budgetId: string,
  updates: Partial<BudgetFormData>
): Promise<Budget> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('budgets')
    .update({
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.start_date !== undefined && { start_date: updates.start_date }),
      ...(updates.end_date !== undefined && { end_date: updates.end_date }),
      ...(updates.notes !== undefined && { notes: updates.notes || null }),
    })
    .eq('id', budgetId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Budget;
}

// Update budget status
export async function updateBudgetStatus(
  budgetId: string,
  status: BudgetStatus
): Promise<Budget> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('budgets')
    .update({ status })
    .eq('id', budgetId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Budget;
}

// Delete a draft budget
export async function deleteBudget(budgetId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', budgetId);

  if (error) throw new Error(error.message);
}

// Upsert budget lines (bulk)
export async function upsertBudgetLines(
  budgetId: string,
  lines: BudgetLineInput[]
): Promise<BudgetLine[]> {
  const supabase = createClient();

  const rows = lines.map((line) => ({
    budget_id: budgetId,
    account_id: line.account_id,
    month: line.month,
    amount: line.amount,
    notes: line.notes || null,
  }));

  const { data, error } = await supabase
    .from('budget_lines')
    .upsert(rows, { onConflict: 'budget_id,account_id,month' })
    .select('*, account:accounts(*)');

  if (error) throw new Error(error.message);
  return data as BudgetLine[];
}

// Delete budget lines by IDs
export async function deleteBudgetLines(lineIds: string[]): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('budget_lines')
    .delete()
    .in('id', lineIds);

  if (error) throw new Error(error.message);
}

// Copy lines from one budget to a new one
export async function copyBudgetLines(
  sourceBudgetId: string,
  targetBudgetId: string
): Promise<BudgetLine[]> {
  // 1. Fetch source lines
  const sourceLines = await getBudgetLines(sourceBudgetId);
  if (sourceLines.length === 0) return [];

  // 2. Insert as new lines for the target budget
  const newLines: BudgetLineInput[] = sourceLines.map((line) => ({
    account_id: line.account_id,
    month: line.month,
    amount: line.amount,
    notes: line.notes || undefined,
  }));

  return upsertBudgetLines(targetBudgetId, newLines);
}
