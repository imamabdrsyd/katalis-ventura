import { describe, it, expect } from 'vitest';
import {
  collectBackupData,
  chunk,
  PAGE_SIZE,
  IN_CHUNK_SIZE,
  type BackupQuery,
  type BackupQueryClient,
  type QueryResult,
} from '@/lib/backup/collect';
import type { BackupRow } from '@/lib/backup/types';

const BUSINESS_ID = 'biz-1';

type Filter =
  | { op: 'eq'; column: string; value: string }
  | { op: 'in'; column: string; values: string[] }
  | null;

interface Recorded {
  table: string;
  filter: Filter;
  from: number;
  to: number;
}

/**
 * Client PostgREST palsu di atas store in-memory.
 *
 * Meniru tiga perilaku yang penting di sini: `range` inklusif di kedua ujung,
 * hasil terurut `id`, dan response yang terpotong sesuai permintaan halaman.
 */
function makeClient(store: Record<string, BackupRow[]>, failOn?: string) {
  const requests: Recorded[] = [];

  const client: BackupQueryClient = {
    from(table: string) {
      return {
        select(): BackupQuery {
          let filter: Filter = null;

          const q: BackupQuery = {
            eq(column, value) {
              filter = { op: 'eq', column, value };
              return q;
            },
            in(column, values) {
              filter = { op: 'in', column, values };
              return q;
            },
            order() {
              return q;
            },
            range(from, to): PromiseLike<QueryResult> {
              requests.push({ table, filter, from, to });

              if (table === failOn) {
                return Promise.resolve({ data: null, error: { message: 'boom' } });
              }

              const rows = (store[table] ?? []).filter((r) => {
                if (!filter) return true;
                if (filter.op === 'eq') return r[filter.column] === filter.value;
                return filter.values.includes(r[filter.column] as string);
              });

              const sorted = [...rows].sort((a, b) =>
                String(a.id).localeCompare(String(b.id))
              );

              return Promise.resolve({ data: sorted.slice(from, to + 1), error: null });
            },
          };

          return q;
        },
      };
    },
  };

  return { client, requests };
}

const pad = (n: number) => String(n).padStart(6, '0');

function makeTransactions(count: number): BackupRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `tx-${pad(i)}`,
    business_id: BUSINESS_ID,
  }));
}

const business: BackupRow[] = [{ id: BUSINESS_ID, business_name: 'Uji Backup' }];

describe('chunk', () => {
  it('memecah daftar tanpa kehilangan atau menduplikasi elemen', () => {
    const items = Array.from({ length: 3123 }, (_, i) => i);
    const chunks = chunk(items, IN_CHUNK_SIZE);

    expect(chunks).toHaveLength(Math.ceil(3123 / IN_CHUNK_SIZE));
    expect(chunks.flat()).toEqual(items);
  });

  it('mengembalikan daftar kosong untuk input kosong', () => {
    expect(chunk([], 10)).toEqual([]);
  });
});

describe('paginasi collectBackupData', () => {
  it('mengambil seluruh baris saat jumlahnya persis sebesar satu halaman', async () => {
    // Kasus batas: 1000 baris tepat memenuhi satu halaman, jadi loop WAJIB
    // meminta halaman kedua untuk tahu datanya sudah habis.
    const { client, requests } = makeClient({
      businesses: business,
      transactions: makeTransactions(PAGE_SIZE),
    });

    const { counts } = await collectBackupData(client, BUSINESS_ID);

    expect(counts.transactions).toBe(PAGE_SIZE);
    expect(requests.filter((r) => r.table === 'transactions')).toHaveLength(2);
  });

  it('menggabungkan banyak halaman tanpa baris terlewat atau ganda', async () => {
    const { client, requests } = makeClient({
      businesses: business,
      transactions: makeTransactions(2500),
    });

    const { data, counts } = await collectBackupData(client, BUSINESS_ID);

    expect(counts.transactions).toBe(2500);

    const ids = data.transactions.map((r) => r.id);
    expect(new Set(ids).size).toBe(2500);

    // 0–999, 1000–1999, 2000–2999 (halaman terakhir kurang dari PAGE_SIZE → berhenti)
    expect(requests.filter((r) => r.table === 'transactions')).toHaveLength(3);
  });

  it('berhenti pada halaman pertama saat tabel kosong', async () => {
    const { client, requests } = makeClient({ businesses: business });

    const { counts } = await collectBackupData(client, BUSINESS_ID);

    expect(counts.transactions).toBe(0);
    expect(requests.filter((r) => r.table === 'transactions')).toHaveLength(1);
  });

  it('tidak membawa data bisnis lain', async () => {
    const { client } = makeClient({
      businesses: [...business, { id: 'biz-2', business_name: 'Lain' }],
      transactions: [
        { id: 'tx-a', business_id: BUSINESS_ID },
        { id: 'tx-b', business_id: 'biz-2' },
      ],
    });

    const { data, counts } = await collectBackupData(client, BUSINESS_ID);

    expect(counts.transactions).toBe(1);
    expect(data.transactions[0].id).toBe('tx-a');
    expect(counts.businesses).toBe(1);
  });
});

describe('anak-tabel lewat induk', () => {
  it('memecah filter .in() dan tetap mengambil seluruh anak', async () => {
    // 3123 transaksi meniru bisnis terbesar di produksi. Daftar UUID sebanyak
    // itu tidak muat di satu URL, jadi harus dipecah — tanpa kehilangan baris.
    const transactions = makeTransactions(3123);
    const journalLines: BackupRow[] = transactions.flatMap((tx, i) => [
      { id: `jl-${pad(i)}-a`, transaction_id: tx.id },
      { id: `jl-${pad(i)}-b`, transaction_id: tx.id },
    ]);

    const { client, requests } = makeClient({
      businesses: business,
      transactions,
      journal_lines: journalLines,
    });

    const { data, counts } = await collectBackupData(client, BUSINESS_ID);

    expect(counts.journal_lines).toBe(6246);
    expect(new Set(data.journal_lines.map((r) => r.id)).size).toBe(6246);

    const batches = requests.filter((r) => r.table === 'journal_lines');
    expect(batches).toHaveLength(Math.ceil(3123 / IN_CHUNK_SIZE));
    for (const batch of batches) {
      expect(batch.filter?.op).toBe('in');
      if (batch.filter?.op === 'in') {
        expect(batch.filter.values.length).toBeLessThanOrEqual(IN_CHUNK_SIZE);
      }
    }
  });

  it('tidak query sama sekali saat induknya kosong', async () => {
    const { client, requests } = makeClient({ businesses: business });

    const { counts } = await collectBackupData(client, BUSINESS_ID);

    expect(counts.journal_lines).toBe(0);
    expect(requests.filter((r) => r.table === 'journal_lines')).toHaveLength(0);
  });

  it('menghormati parentKey khusus pada profiles', async () => {
    // profiles disaring lewat user_business_roles.user_id, bukan .id
    const { client, requests } = makeClient({
      businesses: business,
      user_business_roles: [
        { id: 'role-1', business_id: BUSINESS_ID, user_id: 'user-1' },
        { id: 'role-2', business_id: BUSINESS_ID, user_id: 'user-2' },
      ],
      profiles: [
        { id: 'user-1', full_name: 'A' },
        { id: 'user-2', full_name: 'B' },
        { id: 'user-3', full_name: 'Bukan anggota' },
      ],
    });

    const { data, counts } = await collectBackupData(client, BUSINESS_ID);

    expect(counts.profiles).toBe(2);
    expect(data.profiles.map((r) => r.id)).toEqual(['user-1', 'user-2']);

    const req = requests.find((r) => r.table === 'profiles');
    expect(req?.filter).toEqual({ op: 'in', column: 'id', values: ['user-1', 'user-2'] });
  });

  it('membuang ID induk yang duplikat sebelum query', async () => {
    // Dua baris invoice_transactions bisa menunjuk invoice yang sama.
    const { client, requests } = makeClient({
      businesses: business,
      invoices: [
        { id: 'inv-1', business_id: BUSINESS_ID },
        { id: 'inv-1', business_id: BUSINESS_ID },
        { id: 'inv-2', business_id: BUSINESS_ID },
      ],
    });

    await collectBackupData(client, BUSINESS_ID);

    const req = requests.find((r) => r.table === 'invoice_line_items');
    expect(req?.filter).toEqual({ op: 'in', column: 'invoice_id', values: ['inv-1', 'inv-2'] });
  });
});

describe('penanganan error', () => {
  it('melempar dengan menyebut tabel yang gagal', async () => {
    const { client } = makeClient({ businesses: business }, 'accounts');

    await expect(collectBackupData(client, BUSINESS_ID)).rejects.toThrow(/accounts/);
  });
});
