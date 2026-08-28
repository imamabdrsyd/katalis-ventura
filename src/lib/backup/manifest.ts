import type { BackupExclusion } from './types';

/**
 * Registry tabel untuk backup data per-bisnis.
 *
 * Ini sumber kebenaran tunggal: SETIAP tabel di schema `public` wajib muncul di
 * salah satu dari dua daftar di bawah — `BACKUP_MANIFEST` (ikut dibackup) atau
 * `BACKUP_EXCLUSIONS` (sengaja tidak, dengan alasan). Tanpa aturan itu, tabel
 * baru akan diam-diam membuat backup jadi bolong tanpa ada yang sadar.
 *
 * `tests/unit/backupManifest.test.ts` menegakkan aturan tersebut.
 */

export type TableScope =
  /** Tabel `businesses` itu sendiri: disaring lewat kolom `id`. */
  | { kind: 'root' }
  /** Punya kolom `business_id` sendiri. */
  | { kind: 'direct' }
  /**
   * Tidak punya `business_id`; disaring lewat ID milik tabel induk.
   * `fk` = kolom di tabel ini, `parentKey` = kolom di tabel induk (default `id`).
   */
  | { kind: 'via'; parent: string; fk: string; parentKey?: string };

export interface BackupEntry {
  table: string;
  scope: TableScope;
  /** Induk harus punya `order` lebih kecil daripada anaknya. */
  order: number;
  /** Allowlist kolom. Kosong = semua kolom. */
  columns?: string[];
}

/** Semua tabel ber-`business_id` langsung, diurut biar enak dibaca. */
const DIRECT_TABLES = [
  // Ledger inti
  'accounts',
  'transactions',
  // Akses & keanggotaan
  'user_business_roles',
  'invite_codes',
  'business_join_requests',
  'investor_metrics',
  // Operasional
  'business_contacts',
  'catalog_items',
  'business_units',
  'unit_daily_rates',
  'bookings',
  'invoices',
  'budgets',
  'recurring_transactions',
  'transaction_templates',
  // Bank & rekonsiliasi
  'bank_statement_imports',
  'bank_transactions',
  'reconciliation_sessions',
  'import_batches',
  // CRM & AI
  'leads',
  'lead_messages',
  'business_ai_knowledge',
  'agent_memories',
  // Halaman publik
  'business_omni_channels',
  // Event
  'event_sessions',
  'event_session_dates',
  'event_registrations',
] as const;

export const BACKUP_MANIFEST: BackupEntry[] = [
  { table: 'businesses', scope: { kind: 'root' }, order: 10 },

  ...DIRECT_TABLES.map((table) => ({ table, scope: { kind: 'direct' as const }, order: 20 })),

  // Anak-tabel: tak punya business_id, ikut lewat induknya.
  { table: 'journal_lines', scope: { kind: 'via', parent: 'transactions', fk: 'transaction_id' }, order: 30 },
  { table: 'budget_lines', scope: { kind: 'via', parent: 'budgets', fk: 'budget_id' }, order: 30 },
  { table: 'invoice_line_items', scope: { kind: 'via', parent: 'invoices', fk: 'invoice_id' }, order: 30 },
  { table: 'invoice_transactions', scope: { kind: 'via', parent: 'invoices', fk: 'invoice_id' }, order: 30 },
  {
    table: 'business_omni_channel_links',
    scope: { kind: 'via', parent: 'business_omni_channels', fk: 'omni_channel_id' },
    order: 30,
  },
  {
    table: 'business_pricing_rules',
    scope: { kind: 'via', parent: 'business_omni_channels', fk: 'omni_channel_id' },
    order: 30,
  },
  {
    table: 'reconciliation_session_matches',
    scope: { kind: 'via', parent: 'reconciliation_sessions', fk: 'session_id' },
    order: 30,
  },

  // Profil anggota bisnis ini saja, kolomnya dibatasi: cukup untuk menerjemahkan
  // created_by/user_id jadi nama yang terbaca, tanpa memuat PII lain.
  {
    table: 'profiles',
    scope: { kind: 'via', parent: 'user_business_roles', fk: 'id', parentKey: 'user_id' },
    order: 30,
    columns: ['id', 'full_name', 'avatar_url'],
  },
];

/**
 * Tabel yang sengaja TIDAK ikut.
 *
 * `credentials` yang paling penting: isinya token integrasi terenkripsi. Kalau
 * ikut ke file yang diunduh user, itu kebocoran kredensial — bukan backup.
 */
export const BACKUP_EXCLUSIONS: BackupExclusion[] = [
  // Token & rahasia integrasi — JANGAN PERNAH masuk file backup.
  { table: 'channel_integrations', reason: 'credentials' },
  { table: 'business_ecommerce_connections', reason: 'credentials' },
  { table: 'telegram_connections', reason: 'credentials' },
  { table: 'google_sheets_connections', reason: 'credentials' },

  // Turunan/cache — bisa dibangun ulang dari data di atas.
  { table: 'financial_summary_cache', reason: 'cache' },
  { table: 'business_transaction_versions', reason: 'cache' },
  { table: 'market_data_cache', reason: 'cache' },
  { table: 'ocr_scan_cache', reason: 'cache' },
  { table: 'ocr_usage', reason: 'cache' },
  { table: 'telegram_link_tokens', reason: 'cache' },
  { table: 'ecommerce_sync_logs', reason: 'cache' },

  // Milik user, bukan milik bisnis.
  { table: 'google_sheets_recent_files', reason: 'per-user' },

  // audit_log tak punya business_id — hanya (table_name, record_id). Menyaringnya
  // per-bisnis berarti mencocokkan record_id ke himpunan ID dari ~30 tabel lain:
  // mahal, rawan meleset, dan ukurannya mendominasi file. Ditunda ke iterasi
  // tersendiri sebagai toggle opt-in.
  { table: 'audit_log', reason: 'deferred' },
];

/** Manifest urut dependensi — induk selalu diambil sebelum anaknya. */
export function orderedManifest(): BackupEntry[] {
  return [...BACKUP_MANIFEST].sort((a, b) => a.order - b.order || a.table.localeCompare(b.table));
}
