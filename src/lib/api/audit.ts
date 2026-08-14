import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDateShort, formatDateTime } from '@/lib/utils';
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
    const newValues = auditLog.new_values;
    // Hanya field ringkasan — seluruh kolom baris baru terlalu panjang dan
    // keadaan terkini transaksi sudah tampil di bagian atas modal.
    for (const field of INSERT_SUMMARY_FIELDS) {
      if (!(field in newValues)) continue;
      const newValue = newValues[field];
      if (newValue === null || newValue === undefined || newValue === '') continue;

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
      if (HIDDEN_AUDIT_FIELDS.has(field)) continue;

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
      if (HIDDEN_AUDIT_FIELDS.has(field)) continue;

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
 * Field yang selalu disembunyikan dari daftar perubahan.
 *
 * `updated_by` / `updated_at` cuma jejak mekanis yang ikut berubah di SETIAP
 * update — pelakunya sudah ditampilkan di kepala entri ("oleh Nama") dan
 * waktunya sudah jadi timestamp entri, jadi menampilkannya lagi hanya
 * memanjangkan daftar dengan UUID dan ISO string yang tak terbaca manusia.
 */
export const HIDDEN_AUDIT_FIELDS = new Set(['updated_by', 'updated_at', 'created_at', 'id']);

/**
 * Field yang ditampilkan untuk operasi INSERT. Tanpa daftar ini, `getFieldChanges`
 * mengembalikan SELURUH kolom baris baru — belasan baris termasuk business_id dan
 * flag internal, padahal keadaan terkini transaksi sudah tampil di atas modal.
 */
export const INSERT_SUMMARY_FIELDS = [
  'date',
  'name',
  'description',
  'amount',
  'category',
  'status',
] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * Format field name to human-readable label
 * @param field - Field name (e.g., 'debit_account_id')
 * @param labels - Peta label terlokalisasi (opsional); dipakai lebih dulu bila ada
 * @returns Human-readable label (e.g., 'Debit Account')
 */
export function formatFieldName(field: string, labels?: Record<string, string>): string {
  if (labels?.[field]) {
    return labels[field];
  }

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

export interface AuditValueOptions {
  /** Nama field asal — dipakai memilih format (tanggal, mata uang, akun). */
  field?: string;
  /** Resolusi UUID akun jadi nama akun. */
  resolveAccount?: (id: string) => string | undefined;
  /** Label terlokalisasi untuk nilai non-teks. */
  labels?: {
    empty?: string;
    yes?: string;
    no?: string;
    /** Peta nilai enum, mis. { draft: 'Draft', posted: 'Posted' }. */
    values?: Record<string, string>;
    /** Pengganti dump JSON untuk kolom terstruktur seperti `meta`. */
    structured?: string;
  };
}

/**
 * Format value for display in audit trail.
 *
 * Tanpa konteks field, nilai mentah dari database bocor apa adanya ke UI —
 * UUID 36 karakter, ISO timestamp, enum huruf kecil. Semua itu benar secara
 * data tapi tak terbaca pengguna, jadi `options.field` dipakai untuk memilih
 * format yang tepat.
 *
 * @param value - Any value from audit log
 * @param options - Konteks opsional; tanpa ini perilakunya sama seperti dulu
 * @returns Formatted string for display
 */
export function formatAuditValue(value: unknown, options: AuditValueOptions = {}): string {
  const { field, resolveAccount, labels } = options;

  if (value === null || value === undefined || value === '') {
    return labels?.empty ?? '(empty)';
  }

  if (typeof value === 'boolean') {
    return value ? (labels?.yes ?? 'Yes') : (labels?.no ?? 'No');
  }

  if (typeof value === 'number') {
    return field === 'amount'
      ? formatCurrency(value)
      : value.toLocaleString('id-ID');
  }

  if (typeof value === 'object') {
    // Dump JSON penuh (mis. kolom `meta`) tidak terbaca dan merusak tata letak.
    return labels?.structured ?? '(data terstruktur)';
  }

  const text = String(value);

  if (labels?.values?.[text]) {
    return labels.values[text];
  }

  if (field?.endsWith('_account_id') && UUID_RE.test(text)) {
    return resolveAccount?.(text) ?? `${text.slice(0, 8)}…`;
  }

  if (ISO_DATETIME_RE.test(text)) {
    return formatDateTime(text);
  }

  if (ISO_DATE_RE.test(text)) {
    return formatDateShort(text);
  }

  // UUID sisa (business_id, created_by, dll) — potong supaya tidak memakan baris.
  if (UUID_RE.test(text)) {
    return `${text.slice(0, 8)}…`;
  }

  return text;
}
