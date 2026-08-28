import { describe, it, expect } from 'vitest';
import { BACKUP_MANIFEST, BACKUP_EXCLUSIONS, orderedManifest } from '@/lib/backup/manifest';

/**
 * Snapshot seluruh tabel `public` per 28 Agustus 2026.
 *
 * Ini fixture yang disengaja: begitu ada tabel baru di database, tes ini gagal
 * sampai tabel tersebut diputuskan nasibnya — ikut dibackup, atau dikecualikan
 * dengan alasan. Tanpa penjaga ini, backup akan membusuk diam-diam tiap kali
 * skema bertambah, dan baru ketahuan justru saat backup-nya dibutuhkan.
 *
 * Cara memperbarui: jalankan
 *   SELECT table_name FROM information_schema.tables
 *   WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1;
 */
const ALL_PUBLIC_TABLES = [
  'accounts',
  'agent_memories',
  'audit_log',
  'bank_statement_imports',
  'bank_transactions',
  'bookings',
  'budget_lines',
  'budgets',
  'business_ai_knowledge',
  'business_contacts',
  'business_ecommerce_connections',
  'business_join_requests',
  'business_omni_channel_links',
  'business_omni_channels',
  'business_pricing_rules',
  'business_transaction_versions',
  'business_units',
  'businesses',
  'catalog_items',
  'channel_integrations',
  'ecommerce_sync_logs',
  'event_registrations',
  'event_session_dates',
  'event_sessions',
  'financial_summary_cache',
  'google_sheets_connections',
  'google_sheets_recent_files',
  'import_batches',
  'investor_metrics',
  'invite_codes',
  'invoice_line_items',
  'invoice_transactions',
  'invoices',
  'journal_lines',
  'lead_messages',
  'leads',
  'market_data_cache',
  'ocr_scan_cache',
  'ocr_usage',
  'profiles',
  'reconciliation_session_matches',
  'reconciliation_sessions',
  'recurring_transactions',
  'telegram_connections',
  'telegram_link_tokens',
  'transaction_templates',
  'transactions',
  'unit_daily_rates',
  'user_business_roles',
];

/**
 * Tabel yang menyimpan token/rahasia integrasi. Kalau salah satunya sampai
 * masuk manifest, file backup yang diunduh user jadi kebocoran kredensial.
 */
const CREDENTIAL_TABLES = [
  'channel_integrations',
  'business_ecommerce_connections',
  'telegram_connections',
  'google_sheets_connections',
];

const includedTables = BACKUP_MANIFEST.map((e) => e.table);
const excludedTables = BACKUP_EXCLUSIONS.map((e) => e.table);

describe('manifest backup', () => {
  it('mengklasifikasikan setiap tabel public secara eksplisit', () => {
    const classified = new Set([...includedTables, ...excludedTables]);
    const unclassified = ALL_PUBLIC_TABLES.filter((t) => !classified.has(t));

    expect(
      unclassified,
      `Tabel berikut belum diputuskan ikut backup atau tidak: ${unclassified.join(', ')}`
    ).toEqual([]);
  });

  it('tidak mengklasifikasikan tabel yang sudah tidak ada di database', () => {
    const known = new Set(ALL_PUBLIC_TABLES);
    const stale = [...includedTables, ...excludedTables].filter((t) => !known.has(t));

    expect(stale, `Tabel sudah tidak ada di schema: ${stale.join(', ')}`).toEqual([]);
  });

  it('tidak menaruh satu tabel di dua daftar sekaligus', () => {
    const overlap = includedTables.filter((t) => excludedTables.includes(t));
    expect(overlap).toEqual([]);
  });

  it('tidak pernah menyertakan tabel berisi kredensial', () => {
    for (const table of CREDENTIAL_TABLES) {
      expect(includedTables, `${table} berisi token — tidak boleh masuk backup`).not.toContain(
        table
      );
      expect(excludedTables).toContain(table);
    }

    // Alasannya harus tetap 'credentials' — bukan sekadar kebetulan tidak ikut.
    for (const table of CREDENTIAL_TABLES) {
      expect(BACKUP_EXCLUSIONS.find((e) => e.table === table)?.reason).toBe('credentials');
    }
  });

  it('tidak mendaftarkan tabel dua kali', () => {
    expect(new Set(includedTables).size).toBe(includedTables.length);
    expect(new Set(excludedTables).size).toBe(excludedTables.length);
  });

  it('mengambil induk sebelum anaknya', () => {
    const ordered = orderedManifest();
    const positionOf = new Map(ordered.map((e, i) => [e.table, i]));

    for (const entry of ordered) {
      if (entry.scope.kind !== 'via') continue;

      const parentPos = positionOf.get(entry.scope.parent);
      expect(parentPos, `induk ${entry.scope.parent} tidak ada di manifest`).toBeDefined();
      expect(
        parentPos!,
        `${entry.table} diambil sebelum induknya (${entry.scope.parent})`
      ).toBeLessThan(positionOf.get(entry.table)!);
    }
  });

  it('menyertakan tabel ledger inti', () => {
    for (const table of ['businesses', 'accounts', 'transactions', 'journal_lines']) {
      expect(includedTables).toContain(table);
    }
  });

  it('membatasi kolom profiles agar tidak memuat PII berlebih', () => {
    const profiles = BACKUP_MANIFEST.find((e) => e.table === 'profiles');
    expect(profiles?.columns).toEqual(['id', 'full_name', 'avatar_url']);
  });
});
