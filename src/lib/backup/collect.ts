import { orderedManifest, type BackupEntry } from './manifest';
import type { BackupRow } from './types';

/**
 * Pengumpul data backup — dipisah dari route handler supaya paginasi dan
 * chunking bisa diuji tanpa database.
 *
 * Dua hal di sini yang paling rawan gagal secara senyap: batas 1000 baris
 * PostgREST, dan panjang URL saat menyaring anak-tabel dengan `.in()`. Keduanya
 * menghasilkan backup yang "sukses" tapi tidak lengkap, jadi keduanya diuji di
 * `tests/unit/backupCollect.test.ts`.
 */

/** PostgREST memotong response di 1000 baris. */
export const PAGE_SIZE = 1000;

/**
 * Jumlah ID per batch saat menyaring anak-tabel dengan `.in()`.
 * Filter dikirim lewat query string, jadi daftar UUID yang panjang bisa
 * menembus batas panjang URL — satu bisnis bisa punya ribuan transaksi.
 */
export const IN_CHUNK_SIZE = 150;

export interface QueryResult {
  data: BackupRow[] | null;
  error: { message: string } | null;
}

/**
 * Permukaan minimal PostgREST yang dipakai modul ini. Sengaja sempit supaya
 * mudah dipalsukan di test; client Supabase asli memenuhinya secara struktural.
 */
export interface BackupQuery {
  eq(column: string, value: string): BackupQuery;
  in(column: string, values: string[]): BackupQuery;
  order(column: string, opts: { ascending: boolean }): BackupQuery;
  range(from: number, to: number): PromiseLike<QueryResult>;
}

export interface BackupQueryClient {
  from(table: string): { select(columns: string): BackupQuery };
}

type RowFilter =
  | { op: 'eq'; column: string; value: string }
  | { op: 'in'; column: string; values: string[] };

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Ambil seluruh baris sebuah tabel, halaman demi halaman.
 *
 * `.order('id')` bukan kosmetik: tanpa ORDER BY yang stabil, LIMIT/OFFSET di
 * Postgres boleh mengembalikan baris dalam urutan berbeda tiap halaman, yang
 * membuat baris terlewat atau terhitung dua kali. Semua tabel yang dibackup
 * ber-primary-key `id`.
 */
async function fetchAllRows(
  client: BackupQueryClient,
  table: string,
  columns: string,
  filter: RowFilter
): Promise<BackupRow[]> {
  const rows: BackupRow[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const base = client.from(table).select(columns);
    const filtered =
      filter.op === 'eq'
        ? base.eq(filter.column, filter.value)
        : base.in(filter.column, filter.values);

    const { data, error } = await filtered
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`Gagal membaca tabel ${table}: ${error.message}`);
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  return rows;
}

async function fetchEntry(
  client: BackupQueryClient,
  entry: BackupEntry,
  businessId: string,
  collected: Record<string, BackupRow[]>
): Promise<BackupRow[]> {
  const columns = entry.columns?.join(',') ?? '*';

  if (entry.scope.kind === 'root') {
    return fetchAllRows(client, entry.table, columns, {
      op: 'eq',
      column: 'id',
      value: businessId,
    });
  }

  if (entry.scope.kind === 'direct') {
    return fetchAllRows(client, entry.table, columns, {
      op: 'eq',
      column: 'business_id',
      value: businessId,
    });
  }

  // scope.kind === 'via' — disaring lewat ID milik induk yang sudah diambil.
  const { parent, fk, parentKey = 'id' } = entry.scope;
  const parentRows = collected[parent] ?? [];

  const parentIds = Array.from(
    new Set(
      parentRows
        .map((row) => row[parentKey])
        .filter((v): v is string => typeof v === 'string' && v.length > 0)
    )
  );
  if (parentIds.length === 0) return [];

  const rows: BackupRow[] = [];
  for (const ids of chunk(parentIds, IN_CHUNK_SIZE)) {
    rows.push(...(await fetchAllRows(client, entry.table, columns, { op: 'in', column: fk, values: ids })));
  }
  return rows;
}

export interface CollectedBackup {
  data: Record<string, BackupRow[]>;
  counts: Record<string, number>;
}

/** Jalankan seluruh manifest urut dependensi dan kumpulkan hasilnya. */
export async function collectBackupData(
  client: BackupQueryClient,
  businessId: string
): Promise<CollectedBackup> {
  const data: Record<string, BackupRow[]> = {};
  const counts: Record<string, number> = {};

  for (const entry of orderedManifest()) {
    const rows = await fetchEntry(client, entry, businessId, data);
    data[entry.table] = rows;
    counts[entry.table] = rows.length;
  }

  return { data, counts };
}
