/**
 * Tipe envelope backup data per-bisnis.
 *
 * `schema_version` sengaja ada sejak v1 meski fitur restore belum dibangun:
 * file backup yang diunduh hari ini harus tetap bisa dikenali oleh importer
 * yang ditulis berbulan-bulan kemudian.
 */

export const BACKUP_SCHEMA_VERSION = 1;

/** Alasan sebuah tabel sengaja tidak ikut ke dalam backup. */
export type ExclusionReason = 'credentials' | 'cache' | 'per-user' | 'deferred';

export type BackupRow = Record<string, unknown>;

export interface BackupExclusion {
  table: string;
  reason: ExclusionReason;
}

export interface BackupEnvelope {
  schema_version: number;
  exported_at: string;
  exported_by: { id: string; name: string | null };
  business: { id: string; business_name: string };
  /** Jumlah baris per tabel — dipakai untuk memverifikasi backup tanpa membedah `data`. */
  counts: Record<string, number>;
  /** Ikut disertakan supaya user tahu apa yang sengaja TIDAK ada di file ini. */
  excluded: BackupExclusion[];
  data: Record<string, BackupRow[]>;
}
