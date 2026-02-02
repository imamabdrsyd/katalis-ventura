import { createClient } from '@/lib/supabase';
import type { AuditLog } from '@/types';

/**
 * Get audit history for a specific record
 * @param tableName - Name of the table (e.g., 'transactions', 'businesses')
 * @param recordId - UUID of the record
 * @returns Array of audit log entries, sorted by most recent first
 */
export async function getRecordAuditHistory(
  tableName: string,
  recordId: string
): Promise<AuditLog[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('audit_trail_with_users')
    .select('*')
    .eq('table_name', tableName)
    .eq('record_id', recordId)
    .order('changed_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data as AuditLog[];
}

/**
 * Get recent audit logs for a business (all tables)
 * @param businessId - UUID of the business
 * @param limit - Maximum number of entries to return (default: 50)
 * @returns Array of recent audit log entries
 */
export async function getBusinessAuditLogs(
  businessId: string,
  limit: number = 50
): Promise<AuditLog[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('audit_trail_with_users')
    .select('*')
    .eq('metadata->>business_id', businessId)
    .order('changed_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data as AuditLog[];
}

/**
 * Get field-level changes from an audit log entry
 * Compares old_values and new_values to extract what changed
 * @param auditLog - Audit log entry
 * @returns Array of field changes with before/after values
 */
export function getFieldChanges(auditLog: AuditLog): Array<{
  field: string;
  oldValue: any;
  newValue: any;
  changed: boolean;
}> {
  const changes: Array<{
    field: string;
    oldValue: any;
    newValue: any;
    changed: boolean;
  }> = [];

  // For INSERT operations, all new_values are changes (from NULL)
  if (auditLog.operation === 'INSERT' && auditLog.new_values) {
    for (const [field, newValue] of Object.entries(auditLog.new_values)) {
      // Skip internal fields
      if (field === 'id' || field === 'created_at' || field === 'updated_at') continue;

      changes.push({
        field,
        oldValue: null,
        newValue,
        changed: true,
      });
    }
    return changes;
  }

  // For DELETE operations, all old_values are changes (to NULL)
  if (auditLog.operation === 'DELETE' && auditLog.old_values) {
    for (const [field, oldValue] of Object.entries(auditLog.old_values)) {
      // Skip internal fields
      if (field === 'id' || field === 'created_at' || field === 'updated_at') continue;

      changes.push({
        field,
        oldValue,
        newValue: null,
        changed: true,
      });
    }
    return changes;
  }

  // For UPDATE operations, compare old and new values
  if (auditLog.operation === 'UPDATE' && auditLog.old_values && auditLog.new_values) {
    const allFields = new Set([
      ...Object.keys(auditLog.old_values),
      ...Object.keys(auditLog.new_values),
    ]);

    for (const field of allFields) {
      // Skip internal fields
      if (field === 'id' || field === 'created_at' || field === 'updated_at') continue;

      const oldValue = auditLog.old_values[field];
      const newValue = auditLog.new_values[field];

      // Deep comparison for objects/arrays, simple comparison for primitives
      const changed = JSON.stringify(oldValue) !== JSON.stringify(newValue);

      changes.push({
        field,
        oldValue,
        newValue,
        changed,
      });
    }

    // Filter to only show fields that actually changed
    return changes.filter((change) => change.changed);
  }

  return changes;
}

/**
 * Get deleted transactions for a business (for restore functionality)
 * @param businessId - UUID of the business
 * @returns Array of soft-deleted transactions
 */
export async function getDeletedTransactions(businessId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('deleted_transactions')
    .select('*')
    .eq('business_id', businessId)
    .order('deleted_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Format field name to human-readable label
 * @param field - Field name (e.g., 'debit_account_id')
 * @returns Human-readable label (e.g., 'Debit Account')
 */
export function formatFieldName(field: string): string {
  // Handle common field patterns
  const fieldMap: Record<string, string> = {
    business_id: 'Business',
    debit_account_id: 'Debit Account',
    credit_account_id: 'Credit Account',
    is_double_entry: 'Double Entry',
    created_by: 'Created By',
    updated_by: 'Updated By',
    deleted_by: 'Deleted By',
    deleted_at: 'Deleted At',
    is_archived: 'Archived',
    is_active: 'Active',
    is_system: 'System Account',
    account_code: 'Account Code',
    account_name: 'Account Name',
    account_type: 'Account Type',
    normal_balance: 'Normal Balance',
    parent_account_id: 'Parent Account',
    sort_order: 'Sort Order',
    full_name: 'Full Name',
    avatar_url: 'Avatar',
  };

  if (fieldMap[field]) {
    return fieldMap[field];
  }

  // Default: capitalize first letter and replace underscores with spaces
  return field
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format value for display in audit trail
 * @param value - Any value from audit log
 * @returns Formatted string for display
 */
export function formatAuditValue(value: any): string {
  if (value === null || value === undefined) {
    return '(empty)';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    return value.toLocaleString('id-ID');
  }

  if (typeof value === 'object') {
    // For objects/arrays, show JSON representation
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}
