/**
 * Tool definitions + server-side handlers untuk AXION Agent (Vertex provider).
 *
 * Tools ini dipakai dalam agentic loop di /api/ai/agent-query:
 * 1. Gemini menerima definisi tools dalam request
 * 2. Gemini balas dengan function_call (tool apa, args apa)
 * 3. Server eksekusi handler → hasilnya dikirim kembali ke Gemini
 * 4. Gemini formulasi jawaban natural language berdasar data nyata
 *
 * Tools: query_transactions, get_financial_summary, get_contacts,
 * get_business_info, navigate_to, search_knowledge_base, run_olap_analytics,
 * recall_memory
 */

import { createServerClient } from '@/lib/supabase-server';
import gcpSql from '@/lib/gcp';
import {
  calculateCapTable,
  calculateFinancialSummary,
  calculateInvestedCapital,
  filterTransactionsByDateRange,
} from '@/lib/calculations';
import { formatIDR } from '@/lib/ai/financialContext';
import { getVertexTokenAndProject } from '@/lib/ai/vertexAuth';
import { searchKnowledgeBase } from '@/lib/ai/knowledge';
import { embedText, searchMemories } from '@/lib/ai/semanticMemory';
import type { Transaction } from '@/types';

// ─── Tool Definitions (JSON Schema untuk Gemini function calling) ─────────────

export const TOOL_DEFINITIONS = [
  {
    name: 'query_transactions',
    description:
      'Ambil daftar transaksi dari database bisnis. Gunakan untuk pertanyaan spesifik seperti ' +
      '"transaksi terbesar bulan X", "semua pengeluaran ke vendor Y", "transaksi CAPEX tahun ini". ' +
      'Hasil berupa array transaksi terfilter yang bisa dianalisis. PENTING: tiap transaksi punya ' +
      'flag is_settlement — jika true berarti PELUNASAN PIUTANG (Dr Kas/Bank / Cr Piutang), BUKAN ' +
      'pendapatan baru. Untuk menjumlahkan pendapatan/revenue gunakan field total_excluding_settlements, ' +
      'JANGAN total_amount, agar tidak double-count piutang dengan pelunasannya. ' +
      'SANGAT PENTING: JANGAN memanggil tool ini berulang kali secara berurutan untuk tiap baris/transaksi individual. ' +
      'Jika Anda perlu mencocokkan banyak transaksi sekaligus, panggil tool ini SATU KALI dengan rentang tanggal (start_date dan end_date) yang luas (limit 100), lalu verifikasi semuanya sekaligus dalam pikiran Anda.',
    parameters: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Filter tanggal mulai format YYYY-MM-DD. Opsional.',
        },
        end_date: {
          type: 'string',
          description: 'Filter tanggal akhir format YYYY-MM-DD. Opsional.',
        },
        category: {
          type: 'string',
          enum: ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'],
          description: 'Filter kategori transaksi. Opsional.',
        },
        contact_name: {
          type: 'string',
          description: 'Filter nama customer/vendor (partial match, case-insensitive). Opsional.',
        },
        min_amount: {
          type: 'number',
          description: 'Filter nominal minimum (Rupiah). Opsional.',
        },
        max_amount: {
          type: 'number',
          description: 'Filter nominal maksimum (Rupiah). Opsional.',
        },
        limit: {
          type: 'number',
          description: 'Jumlah transaksi yang dikembalikan. Default 20, maksimum 100.',
        },
        sort_by: {
          type: 'string',
          enum: ['date_desc', 'date_asc', 'amount_desc', 'amount_asc'],
          description: 'Urutan hasil. Default date_desc (terbaru dulu).',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_financial_summary',
    description:
      'Hitung ringkasan keuangan (P&L) untuk periode tertentu: revenue, HPP, laba kotor, ' +
      'beban operasional, pajak, laba bersih, gross margin, net margin. ' +
      'Gunakan untuk pertanyaan seperti "berapa laba bulan Mei", "revenue Q1 berapa", ' +
      '"perbandingan margin bulan ini vs bulan lalu".',
    parameters: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Tanggal mulai periode YYYY-MM-DD.',
        },
        end_date: {
          type: 'string',
          description: 'Tanggal akhir periode YYYY-MM-DD.',
        },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_contacts',
    description:
      'Ambil daftar kontak bisnis (customer, vendor, dll) beserta total transaksi per kontak. ' +
      'Gunakan untuk pertanyaan seperti "siapa customer terbesar", "total pembayaran ke vendor X", ' +
      '"daftar semua pelanggan", "piutang dari Dila berapa".',
    parameters: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Filter nama kontak (partial match). Opsional untuk ambil semua.',
        },
        type: {
          type: 'string',
          enum: ['customer', 'vendor', 'partner', 'staff', 'investor', 'other'],
          description: 'Filter tipe kontak. Opsional.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_business_info',
    description:
      'Ambil bukti yang tersedia tentang orang dan struktur modal bisnis: creator yang ' +
      'membuat/mendaftarkan bisnis, anggota beserta perannya, akun modal pemilik (is_stock), ' +
      'dan cap table pembukuan dari saldo akun tersebut. Gunakan untuk pertanyaan seperti ' +
      '"bisnis ini punya siapa", "siapa yang buat bisnis ini", "siapa saja anggotanya", ' +
      '"berapa modal disetor", "struktur kepemilikan". ' +
      'Jangan menyimpulkan creator atau anggota sebagai pemilik legal. Cap table ini juga hanya ' +
      'merepresentasikan pencatatan modal di AXION, bukan kepemilikan saham/legal formal. ' +
      'Sebutkan sumber informasinya secara jujur.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'navigate_to',
    description:
      'Arahkan user ke halaman tertentu di aplikasi AXION, dengan pre-apply filter opsional. ' +
      'Gunakan saat user minta "lihat", "tampilkan", "buka", "cek" sesuatu yang ada halamannya. ' +
      'Contoh: "lihat transaksi dari Dila" → navigate ke /transactions dengan filter contact=Dila. ' +
      'Gunakan HANYA untuk navigasi — jangan gunakan untuk menjawab pertanyaan analitik.',
    parameters: {
      type: 'object',
      properties: {
        page: {
          type: 'string',
          enum: [
            'transactions',
            'income-statement',
            'balance-sheet',
            'cash-flow',
            'general-ledger',
            'trial-balance',
            'accounts',
            'reports',
            'dashboard',
          ],
          description: 'Halaman tujuan.',
        },
        filters: {
          type: 'object',
          description: 'Filter opsional yang di-apply saat membuka halaman.',
          properties: {
            contact: { type: 'string', description: 'Filter nama kontak/customer/vendor.' },
            category: {
              type: 'string',
              enum: ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'],
              description: 'Filter kategori transaksi.',
            },
            start: { type: 'string', description: 'Filter tanggal mulai YYYY-MM-DD.' },
            end: { type: 'string', description: 'Filter tanggal akhir YYYY-MM-DD.' },
          },
        },
        message: {
          type: 'string',
          description:
            'Pesan singkat yang ditampilkan ke user sebelum navigasi, mis. ' +
            '"Membuka transaksi dari Dila..."',
        },
      },
      required: ['page', 'message'],
    },
  },
  {
    name: 'search_knowledge_base',
    description:
      'Cari informasi pada dokumen, file CSV, TXT, atau PDF yang pernah diunggah oleh pengguna ke sistem (RAG). ' +
      'Gunakan tool ini ketika pengguna bertanya tentang konteks dokumen atau kebijakan, misalnya ' +
      '"Apa syarat retur dari dokumen PDF yang tadi saya upload?", atau "Coba cari di file pengetahuan tentang kebijakan cuti".',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Kata kunci pencarian semantik (contoh: "kebijakan cuti karyawan" atau "syarat retur").',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'run_olap_analytics',
    description:
      'Jalankan query AGREGASI (GROUP BY) pada gudang data analitik (OLAP) untuk tren waktu, ranking, ' +
      'dan pivot atas SELURUH histori transaksi — jauh lebih efisien daripada menarik ribuan baris mentah ' +
      'dengan query_transactions. Gunakan untuk pertanyaan seperti "tren revenue per bulan tahun ini", ' +
      '"total pengeluaran per kategori", "penjualan per channel", "10 customer dengan transaksi terbesar", ' +
      '"perbandingan beban tiap kuartal". Bisa kelompokkan per 1 atau 2 dimensi sekaligus (mis. bulan × kategori). ' +
      'PENTING: data OLAP adalah replika yang disinkronkan secara MANUAL, jadi bisa sedikit tertinggal dari data ' +
      'live; untuk angka yang harus presisi real-time (mis. saldo hari ini) pakai get_financial_summary. ' +
      'Untuk analisis revenue, set exclude_settlements=true agar pelunasan piutang tidak terhitung sebagai pendapatan baru.',
    parameters: {
      type: 'object',
      properties: {
        group_by: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['month', 'quarter', 'year', 'category', 'sales_channel', 'name'],
          },
          description:
            'Dimensi pengelompokan, 1–2 item. "month"/"quarter"/"year" = bucket waktu, "category" = 6 kategori, ' +
            '"sales_channel" = channel penjualan, "name" = nama customer/vendor. Contoh: ["month"] untuk tren bulanan, ' +
            '["month","category"] untuk pivot bulan × kategori, ["name"] untuk ranking kontak.',
        },
        measure: {
          type: 'string',
          enum: ['sum', 'count', 'avg', 'min', 'max'],
          description: 'Agregasi atas nominal (amount). Default "sum". "count" = jumlah transaksi.',
        },
        start_date: { type: 'string', description: 'Filter tanggal mulai YYYY-MM-DD. Opsional.' },
        end_date: { type: 'string', description: 'Filter tanggal akhir YYYY-MM-DD. Opsional.' },
        category: {
          type: 'string',
          enum: ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'],
          description: 'Filter satu kategori transaksi. Opsional.',
        },
        sales_channel: { type: 'string', description: 'Filter satu sales channel. Opsional.' },
        exclude_settlements: {
          type: 'boolean',
          description: 'Jika true, kecualikan pelunasan piutang dari agregasi (wajib true untuk analisis revenue). Default false.',
        },
        sort: {
          type: 'string',
          enum: ['value_desc', 'value_asc', 'group_asc', 'group_desc'],
          description: 'Urutan hasil. Default: kronologis (group_asc) untuk dimensi waktu, selain itu value_desc.',
        },
        limit: {
          type: 'number',
          description: 'Maksimum baris hasil. Default 50, maksimum 200.',
        },
      },
      required: ['group_by'],
    },
  },
  {
    name: 'recall_memory',
    description:
      'Ingat kembali percakapan atau catatan LAMPAU dari sesi/chat sebelumnya (memori jangka panjang). ' +
      'Berbeda dari search_knowledge_base (yang mencari di dokumen/file yang diunggah), tool ini mencari ' +
      'di memori percakapan: ringkasan sesi chat sebelumnya dan catatan yang sengaja disimpan user (Memory Vault). ' +
      'Gunakan ketika user merujuk ke sesuatu dari masa lalu, misalnya "kemarin kita bahas apa soal pricing?", ' +
      '"lanjutkan analisis yang waktu itu", "apa yang sudah kita putuskan tentang ekspansi?", atau ketika ' +
      'konteks percakapan sekarang terasa merujuk hal yang belum ada di histori turn ini.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Kata kunci/topik yang ingin diingat kembali (pencarian semantik). Contoh: "strategi pricing" atau "rencana ekspansi cabang".',
        },
      },
      required: ['query'],
    },
  },
];

// ─── Tool Handlers ────────────────────────────────────────────────────────────

export type ToolCallArgs = Record<string, unknown>;

export interface ToolResult {
  tool: string;
  data: unknown;
  error?: string;
}

export interface NavigateAction {
  page: string;
  filters?: {
    contact?: string;
    category?: string;
    start?: string;
    end?: string;
  };
  message: string;
}

/**
 * Sebuah transaksi adalah PELUNASAN PIUTANG (settlement), bukan pendapatan baru,
 * bila meta.settlement_of_transaction_id terisi. Jurnalnya Dr Kas/Bank / Cr Piutang —
 * uang masuk tapi BUKAN revenue baru (revenue sudah diakui saat piutang dibuat).
 * Tanpa flag ini, AI menghitung piutang (Dr Piutang/Cr Pendapatan) + pelunasannya
 * (Dr Bank/Cr Piutang) sebagai dua pendapatan terpisah → double-count.
 */
function isSettlementTx(meta: unknown): boolean {
  if (!meta || typeof meta !== 'object') return false;
  const m = meta as Record<string, unknown>;
  return Boolean(m.settlement_of_transaction_id);
}

async function handleQueryTransactions(
  businessId: string,
  args: ToolCallArgs
): Promise<unknown> {
  const supabase = await createServerClient();

  // Ambil meta + akun debit/kredit agar bisa membedakan SETTLE dari EARN dan
  // menjelaskan arah double-entry ke AI.
  let query = supabase
    .from('transactions')
    .select(`
      id, date, name, description, category, amount, meta,
      debit_account:accounts!transactions_debit_account_id_fkey(account_code, account_name, account_type),
      credit_account:accounts!transactions_credit_account_id_fkey(account_code, account_name, account_type)
    `)
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .or('status.is.null,status.eq.posted');

  if (args.start_date) query = query.gte('date', args.start_date as string);
  if (args.end_date) query = query.lte('date', args.end_date as string);
  if (args.category) query = query.eq('category', args.category as string);
  if (args.contact_name) query = query.ilike('name', `%${args.contact_name}%`);
  if (args.min_amount) query = query.gte('amount', args.min_amount as number);
  if (args.max_amount) query = query.lte('amount', args.max_amount as number);

  const sortBy = (args.sort_by as string) ?? 'date_desc';
  if (sortBy === 'amount_desc') query = query.order('amount', { ascending: false });
  else if (sortBy === 'amount_asc') query = query.order('amount', { ascending: true });
  else if (sortBy === 'date_asc') query = query.order('date', { ascending: true });
  else query = query.order('date', { ascending: false });

  const limit = Math.min(Number(args.limit ?? 20), 100);
  query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  type AccountRef = { account_code: string; account_name: string; account_type: string } | null;
  type Row = {
    id: string;
    date: string;
    name: string;
    description: string;
    category: string;
    amount: number;
    meta: unknown;
    debit_account: AccountRef | AccountRef[];
    credit_account: AccountRef | AccountRef[];
  };
  const txs = (data ?? []) as unknown as Row[];
  const acc = (a: AccountRef | AccountRef[]): AccountRef => (Array.isArray(a) ? a[0] ?? null : a);

  let realTotal = 0;
  let settlementTotal = 0;

  const transactions = txs.map(t => {
    const isSettlement = isSettlementTx(t.meta);
    if (isSettlement) settlementTotal += t.amount;
    else realTotal += t.amount;

    const debit = acc(t.debit_account);
    const credit = acc(t.credit_account);

    return {
      date: t.date,
      name: t.name,
      description: t.description,
      // Tampilkan SETTLE sebagai kategori efektif (sama seperti UI), tapi simpan kategori asli.
      category: isSettlement ? 'SETTLE' : t.category,
      original_category: t.category,
      is_settlement: isSettlement,
      amount: formatIDR(t.amount),
      amount_raw: t.amount,
      debit_account: debit ? `${debit.account_code} ${debit.account_name}` : null,
      credit_account: credit ? `${credit.account_code} ${credit.account_name}` : null,
    };
  });

  return {
    count: transactions.length,
    transactions,
    // Total dipisah supaya AI tidak menjumlahkan pendapatan + pelunasan piutang.
    total_amount: formatIDR(realTotal + settlementTotal),
    total_excluding_settlements: formatIDR(realTotal),
    total_settlements_only: formatIDR(settlementTotal),
    settlement_count: transactions.filter(t => t.is_settlement).length,
    _note:
      'is_settlement=true berarti transaksi ini PELUNASAN PIUTANG (Dr Kas/Bank / Cr Piutang), ' +
      'BUKAN pendapatan baru. Untuk pertanyaan "total pendapatan/revenue", pakai ' +
      'total_excluding_settlements, JANGAN total_amount. Pendapatan dari penjualan kredit ' +
      'sudah diakui saat piutang dibuat (entry EARN dengan debit Piutang Usaha), jadi ' +
      'menambahkan pelunasannya lagi akan double-count.',
  };
}

async function handleGetFinancialSummary(
  businessId: string,
  args: ToolCallArgs
): Promise<unknown> {
  const supabase = await createServerClient();
  const startDate = args.start_date as string;
  const endDate = args.end_date as string;

  const { data: transactions } = await supabase
    .from('transactions')
    .select(`
      *,
      debit_account:accounts!transactions_debit_account_id_fkey(*),
      credit_account:accounts!transactions_credit_account_id_fkey(*),
      journal_lines(*, account:accounts(*))
    `)
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .or('status.is.null,status.eq.posted')
    .gte('date', startDate)
    .lte('date', endDate);

  const txs = (transactions ?? []) as unknown as Transaction[];
  const filtered = filterTransactionsByDateRange(txs, startDate, endDate);
  const s = calculateFinancialSummary(filtered);

  const grossProfit = s.totalEarn - s.totalVar;
  const operatingIncome = grossProfit - s.totalOpex;
  const grossMargin = s.totalEarn > 0 ? (grossProfit / s.totalEarn) * 100 : 0;
  const netMargin = s.totalEarn > 0 ? (s.netProfit / s.totalEarn) * 100 : 0;

  return {
    period: { start: startDate, end: endDate },
    revenue: formatIDR(s.totalEarn),
    hpp: formatIDR(s.totalVar),
    gross_profit: formatIDR(grossProfit),
    gross_margin: `${grossMargin.toFixed(1)}%`,
    opex: formatIDR(s.totalOpex),
    operating_income: formatIDR(operatingIncome),
    tax: formatIDR(s.totalTax),
    interest: formatIDR(s.totalInterest),
    net_profit: formatIDR(s.netProfit),
    net_margin: `${netMargin.toFixed(1)}%`,
    transaction_count: filtered.length,
  };
}

async function handleGetContacts(
  businessId: string,
  args: ToolCallArgs
): Promise<unknown> {
  const supabase = await createServerClient();

  let contactQuery = supabase
    .from('business_contacts')
    .select('id, name, type, phone, email')
    .eq('business_id', businessId)
    .order('name', { ascending: true });

  if (args.search) contactQuery = contactQuery.ilike('name', `%${args.search}%`);
  if (args.type) contactQuery = contactQuery.eq('type', args.type as string);

  const { data: contacts, error } = await contactQuery.limit(50);
  if (error) throw new Error(error.message);

  const contactList = (contacts ?? []) as { id: string; name: string; type: string; phone?: string; email?: string }[];

  // Untuk tiap kontak, hitung total transaksi berdasar name match.
  // meta dibutuhkan untuk memisahkan pelunasan piutang (SETTLE) dari nominal lain
  // supaya total per kontak tidak double-count piutang + pelunasannya.
  const { data: txSummary } = await supabase
    .from('transactions')
    .select('name, amount, category, meta')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .or('status.is.null,status.eq.posted');

  const txsByName = new Map<
    string,
    { total: number; settlementTotal: number; count: number; categories: Set<string> }
  >();
  for (const tx of (txSummary ?? []) as { name: string; amount: number; category: string; meta: unknown }[]) {
    const key = tx.name.toLowerCase();
    const existing =
      txsByName.get(key) ?? { total: 0, settlementTotal: 0, count: 0, categories: new Set() };
    const isSettlement = isSettlementTx(tx.meta);
    if (isSettlement) {
      existing.settlementTotal += tx.amount;
      existing.categories.add('SETTLE');
    } else {
      existing.total += tx.amount;
      existing.categories.add(tx.category);
    }
    existing.count++;
    txsByName.set(key, existing);
  }

  return {
    count: contactList.length,
    contacts: contactList.map(c => {
      const stats = txsByName.get(c.name.toLowerCase());
      return {
        name: c.name,
        type: c.type,
        phone: c.phone ?? null,
        email: c.email ?? null,
        transaction_count: stats?.count ?? 0,
        // total_amount = nominal di luar pelunasan piutang; settlements dipisah.
        total_amount: stats ? formatIDR(stats.total) : 'Rp 0',
        settlement_amount: stats ? formatIDR(stats.settlementTotal) : 'Rp 0',
        categories: stats ? Array.from(stats.categories).join(', ') : '',
      };
    }),
    _note:
      'total_amount per kontak SUDAH mengecualikan pelunasan piutang (SETTLE), yang dipisah ke ' +
      'settlement_amount. Ini mencegah double-count piutang (Dr Piutang/Cr Pendapatan) dengan ' +
      'pelunasannya (Dr Kas/Cr Piutang).',
  };
}

const ROLE_LABELS: Record<string, string> = {
  business_manager: 'Manajer Bisnis',
  investor: 'Investor',
  superadmin: 'Super Admin',
  both: 'Super Admin (role lama)',
};

async function handleGetBusinessInfo(businessId: string): Promise<unknown> {
  const supabase = await createServerClient();

  const [
    { data: business, error: businessError },
    { data: roles, error: rolesError },
    { data: equityAccounts, error: accountsError },
    { data: equityTxs, error: transactionsError },
  ] = await Promise.all([
    supabase
      .from('businesses')
      .select('business_name, business_sector, business_type, capital_investment, created_by, created_at')
      .eq('id', businessId)
      .single(),
    supabase
      .from('user_business_roles')
      .select('user_id, role, joined_at')
      .eq('business_id', businessId)
      .order('joined_at', { ascending: true }),
    supabase
      .from('accounts')
      .select(`
        id, account_code, account_name, is_active, is_stock, is_dividend,
        is_retained_earnings, profit_share_pct, contact_id
      `)
      .eq('business_id', businessId)
      .eq('account_type', 'EQUITY')
      .order('account_code', { ascending: true }),
    supabase
      .from('transactions')
      .select(`
        id, date, name, description, notes, amount, category,
        is_double_entry, is_multi_line, deleted_at,
        debit_account:accounts!transactions_debit_account_id_fkey(
          id, account_code, account_name, account_type, is_stock, is_dividend
        ),
        credit_account:accounts!transactions_credit_account_id_fkey(
          id, account_code, account_name, account_type, is_stock, is_dividend
        ),
        journal_lines(
          debit_amount, credit_amount,
          account:accounts(id, account_code, account_name, account_type, is_stock, is_dividend)
        )
      `)
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .or('status.is.null,status.eq.posted'),
  ]);

  if (businessError) throw new Error(businessError.message);
  if (rolesError) throw new Error(rolesError.message);
  if (accountsError) throw new Error(accountsError.message);
  if (transactionsError) throw new Error(transactionsError.message);

  type BusinessRoleRow = { user_id: string; role: string; joined_at: string | null };
  type EquityAccountRow = {
    id: string;
    account_code: string;
    account_name: string;
    is_active: boolean;
    is_stock: boolean;
    is_dividend: boolean;
    is_retained_earnings: boolean;
    profit_share_pct: number | null;
    contact_id: string | null;
  };

  const roleRows = (roles ?? []) as BusinessRoleRow[];
  const accountRows = (equityAccounts ?? []) as EquityAccountRow[];

  // Ambil nama profil anggota dan nama kontak yang ditautkan ke akun modal.
  const userIds = new Set<string>();
  if (business?.created_by) userIds.add(business.created_by);
  for (const role of roleRows) userIds.add(role.user_id);

  const contactIds = accountRows
    .map(account => account.contact_id)
    .filter((id): id is string => Boolean(id));

  const [{ data: profiles, error: profilesError }, { data: contacts, error: contactsError }] =
    await Promise.all([
      userIds.size
        ? supabase.from('profiles').select('id, full_name').in('id', Array.from(userIds))
        : Promise.resolve({ data: [], error: null }),
      contactIds.length
        ? supabase.from('business_contacts').select('id, name').in('id', contactIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (profilesError) throw new Error(profilesError.message);
  if (contactsError) throw new Error(contactsError.message);

  const profileNameById = new Map(
    ((profiles ?? []) as { id: string; full_name: string | null }[]).map(profile => [
      profile.id,
      profile.full_name ?? 'Nama profil tidak tersedia',
    ])
  );
  const contactNameById = new Map(
    ((contacts ?? []) as { id: string; name: string }[]).map(contact => [contact.id, contact.name])
  );

  const creatorName = business?.created_by
    ? profileNameById.get(business.created_by) ?? 'Nama profil tidak tersedia'
    : null;

  const members = roleRows.map(role => ({
    name: profileNameById.get(role.user_id) ?? 'Nama profil tidak tersedia',
    role: ROLE_LABELS[role.role] ?? role.role,
    is_creator: role.user_id === business?.created_by,
    joined_at: role.joined_at,
  }));
  if (business?.created_by && !roleRows.some(role => role.user_id === business.created_by)) {
    members.unshift({
      name: creatorName ?? 'Nama profil tidak tersedia',
      role: ROLE_LABELS.business_manager,
      is_creator: true,
      joined_at: business.created_at,
    });
  }

  const transactions = (equityTxs ?? []) as unknown as Transaction[];
  const capTable = calculateCapTable(transactions);
  const investedCapital = calculateInvestedCapital(
    transactions,
    Number(business?.capital_investment ?? 0)
  );
  const capEntryByAccountId = new Map(capTable.entries.map(entry => [entry.accountId, entry]));
  const stockAccounts = accountRows.filter(account => account.is_stock);

  const capTableEntries = stockAccounts.map(account => {
    const entry = capEntryByAccountId.get(account.id);
    const contactName = account.contact_id ? contactNameById.get(account.contact_id) ?? null : null;
    const contributed = entry?.contributed ?? 0;
    const capitalSharePct =
      capTable.totalContributed > 0 ? (contributed / capTable.totalContributed) * 100 : 0;

    return {
      owner_label: contactName ?? account.account_name,
      owner_label_source: contactName ? 'kontak yang ditautkan ke akun modal' : 'nama akun modal',
      account_code: account.account_code,
      account_name: account.account_name,
      contributed_capital: formatIDR(contributed),
      contributed_capital_raw: contributed,
      capital_share_pct: Number(capitalSharePct.toFixed(2)),
      profit_share_pct: account.profit_share_pct == null ? null : Number(account.profit_share_pct),
      profit_share_source: account.profit_share_pct == null ? 'tidak ditetapkan' : 'ditetapkan di CoA',
      is_active: account.is_active,
    };
  });

  return {
    business_name: business?.business_name ?? '',
    sector: business?.business_sector ?? '',
    type: business?.business_type ?? '',
    creator: {
      name: creatorName,
      registered_business_at: business?.created_at ?? null,
      evidence:
        'Nama ini berasal dari user yang tercatat membuat/mendaftarkan bisnis di AXION. ' +
        'Status creator tidak otomatis berarti pemilik legal.',
    },
    members,
    member_count: members.length,
    ownership_evidence_note:
      'AXION tidak menyimpan kepemilikan saham/legal formal. Cap table berikut adalah interpretasi ' +
      'pembukuan dari saldo akun EQUITY yang ditandai is_stock; nama pemilik berasal dari kontak ' +
      'yang ditautkan atau nama akun modal.',
    cap_table: {
      entries: capTableEntries,
      total_contributed_capital: formatIDR(capTable.totalContributed),
      total_contributed_capital_raw: capTable.totalContributed,
    },
    invested_capital: {
      gross: formatIDR(investedCapital.grossInvestedCapital),
      remaining_after_withdrawals: formatIDR(investedCapital.remainingInvestedCapital),
      injections_from_transactions: formatIDR(investedCapital.capitalInjections),
      owner_withdrawals: formatIDR(investedCapital.ownerWithdrawals),
      legacy_configured_capital:
        Number(business?.capital_investment ?? 0) > 0
          ? formatIDR(Number(business?.capital_investment))
          : null,
    },
    equity_accounts: accountRows.map(account => ({
      account_code: account.account_code,
      account_name: account.account_name,
      is_active: account.is_active,
      classification: account.is_stock
        ? 'modal disetor / cap table'
        : account.is_dividend
          ? 'dividen / prive'
          : account.is_retained_earnings
            ? 'saldo laba'
            : 'ekuitas lainnya',
    })),
  };
}

async function handleSearchKnowledgeBase(businessId: string, args: ToolCallArgs): Promise<unknown> {
  const query = args.query as string;
  if (!query) throw new Error("Query pencarian tidak valid");

  const auth = await getVertexTokenAndProject();
  if (!auth) throw new Error("Vertex AI tidak dikonfigurasi untuk embedding");

  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${auth.projectId}/locations/global/publishers/google/models/text-embedding-004:predict`;
  
  const payload = {
    instances: [{ content: query }],
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.token}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error('Gagal memproses query embedding');
  }

  const data = await res.json();
  const queryEmbedding = data.predictions[0].embeddings.values;

  // Threshold rendah (0.4): konten yang diunggah sering berupa data tabular/CSV
  // (mis. "Date,Type,Booking date,...") yang cosine-similarity-nya rendah terhadap
  // query natural language, sehingga floor tinggi (0.7) membuang chunk yang valid.
  // Handler mengembalikan skor similarity ke model agar model menilai relevansi sendiri.
  const results = await searchKnowledgeBase(businessId, queryEmbedding, 6, 0.4);

  if (!results || results.length === 0) {
    return {
      query,
      results: [],
      _note: "Tidak ditemukan informasi relevan pada dokumen/file yang diunggah untuk query ini."
    };
  }

  return {
    query,
    results: results.map((r: any) => ({
      source: r.source_type,
      content: r.chunk_content,
      similarity: r.similarity
    }))
  };
}

async function handleRecallMemory(
  businessId: string,
  userId: string,
  args: ToolCallArgs,
): Promise<unknown> {
  const query = args.query as string;
  if (!query) throw new Error('Query recall tidak valid');

  const auth = await getVertexTokenAndProject();
  if (!auth) throw new Error('Vertex AI tidak dikonfigurasi untuk embedding');

  const queryEmbedding = await embedText(auth.token, auth.projectId, query);
  const results = await searchMemories(businessId, userId, queryEmbedding, 5, 0.6);

  if (!results || results.length === 0) {
    return {
      query,
      results: [],
      _note: 'Tidak ada memori percakapan lampau yang relevan dengan query ini.',
    };
  }

  return {
    query,
    results: (results as Array<Record<string, unknown>>).map((r) => ({
      source: (r.metadata as { source?: string } | null)?.source ?? 'memory',
      content: r.content,
      remembered_at: r.created_at,
      similarity: r.similarity,
    })),
  };
}

// ─── OLAP Analytics (GCP Cloud SQL) ───────────────────────────────────────────

// Whitelist ekspresi SQL untuk dimensi & measure. Hanya konstanta yang kita kontrol
// yang masuk ke string query; SEMUA nilai user dilewatkan sebagai parameter ($n) →
// tidak ada celah SQL injection meski memakai gcpSql.unsafe().
const OLAP_DIMENSIONS: Record<string, string> = {
  month: `to_char(date_trunc('month', t.date), 'YYYY-MM')`,
  quarter: `to_char(t.date, 'YYYY') || '-Q' || to_char(t.date, 'Q')`,
  year: `to_char(date_trunc('year', t.date), 'YYYY')`,
  category: `t.category`,
  sales_channel: `COALESCE(NULLIF(t.sales_channel, ''), '(tanpa channel)')`,
  name: `COALESCE(NULLIF(t.name, ''), '(tanpa nama)')`,
};

const OLAP_MEASURES: Record<string, string> = {
  sum: `SUM(t.amount)`,
  count: `COUNT(*)`,
  avg: `AVG(t.amount)`,
  min: `MIN(t.amount)`,
  max: `MAX(t.amount)`,
};

async function handleRunOlapAnalytics(businessId: string, args: ToolCallArgs): Promise<unknown> {
  const rawDims = Array.isArray(args.group_by)
    ? args.group_by
    : args.group_by != null
    ? [args.group_by]
    : [];
  const dims = (rawDims as unknown[])
    .map((d) => String(d))
    .filter((d) => d in OLAP_DIMENSIONS)
    .slice(0, 2);

  if (dims.length === 0) {
    throw new Error('group_by wajib berisi minimal satu dimensi valid (month/quarter/year/category/sales_channel/name).');
  }

  const measureKey =
    typeof args.measure === 'string' && args.measure in OLAP_MEASURES ? args.measure : 'sum';
  const measureExpr = OLAP_MEASURES[measureKey];

  const params: unknown[] = [businessId];
  const where: string[] = [
    `t.business_id = $1`,
    `t.deleted_at IS NULL`,
    `(t.status IS NULL OR t.status = 'posted')`,
  ];

  if (typeof args.start_date === 'string' && args.start_date) {
    params.push(args.start_date);
    where.push(`t.date >= $${params.length}`);
  }
  if (typeof args.end_date === 'string' && args.end_date) {
    params.push(args.end_date);
    where.push(`t.date <= $${params.length}`);
  }
  if (typeof args.category === 'string' && args.category) {
    params.push(args.category);
    where.push(`t.category = $${params.length}`);
  }
  if (typeof args.sales_channel === 'string' && args.sales_channel) {
    params.push(args.sales_channel);
    where.push(`t.sales_channel = $${params.length}`);
  }
  if (args.exclude_settlements === true) {
    where.push(`(t.meta->>'settlement_of_transaction_id') IS NULL`);
  }

  const selectDims = dims.map((d, i) => `${OLAP_DIMENSIONS[d]} AS g${i}`);
  const selectCols = [...selectDims, `${measureExpr} AS value`, `COUNT(*) AS tx_count`];
  const groupByClause = `GROUP BY ${dims.map((_, i) => i + 1).join(', ')}`;

  const hasTimeDim = dims.some((d) => d === 'month' || d === 'quarter' || d === 'year');
  const sort = typeof args.sort === 'string' ? args.sort : hasTimeDim ? 'group_asc' : 'value_desc';
  let orderBy: string;
  if (sort === 'group_asc') orderBy = `ORDER BY g0 ASC`;
  else if (sort === 'group_desc') orderBy = `ORDER BY g0 DESC`;
  else if (sort === 'value_asc') orderBy = `ORDER BY value ASC`;
  else orderBy = `ORDER BY value DESC`;

  let limit = typeof args.limit === 'number' ? Math.floor(args.limit) : 50;
  if (limit < 1) limit = 1;
  if (limit > 200) limit = 200;
  params.push(limit);
  const limitClause = `LIMIT $${params.length}`;

  const query = `
    SELECT ${selectCols.join(', ')}
    FROM olap_transactions t
    WHERE ${where.join(' AND ')}
    ${groupByClause}
    ${orderBy}
    ${limitClause}
  `;

  let rows: Array<Record<string, unknown>>;
  try {
    rows = (await gcpSql.unsafe(query, params as never[])) as unknown as Array<Record<string, unknown>>;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OLAP query error';
    throw new Error(`Gagal menjalankan query OLAP: ${msg}`);
  }

  if (!rows || rows.length === 0) {
    // Bedakan "belum disync" dari "filter tidak match" agar agent bisa memandu user.
    const countRows = (await gcpSql.unsafe(
      `SELECT COUNT(*)::int AS total FROM olap_transactions WHERE business_id = $1`,
      [businessId] as never[],
    )) as unknown as Array<{ total: number }>;
    const total = countRows?.[0]?.total ?? 0;
    if (total === 0) {
      return {
        results: [],
        _note:
          'Data OLAP untuk bisnis ini masih kosong / belum disinkronkan. Sarankan user membuka Settings → ' +
          'Analytics dan klik "Sinkronisasi", atau gunakan get_financial_summary / query_transactions yang membaca data live.',
      };
    }
    return { results: [], _note: 'Tidak ada baris yang cocok dengan filter pada data OLAP.' };
  }

  const results = rows.map((r) => {
    const out: Record<string, unknown> = {};
    dims.forEach((d, i) => {
      out[d] = r[`g${i}`];
    });
    out.value = r.value != null ? Number(r.value) : 0;
    out.tx_count = r.tx_count != null ? Number(r.tx_count) : 0;
    return out;
  });

  return {
    source: 'OLAP (replika GCP Cloud SQL, sinkronisasi manual — bisa sedikit tertinggal dari data live)',
    measure: measureKey,
    group_by: dims,
    row_count: results.length,
    results,
  };
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export async function executeTool(
  toolName: string,
  args: ToolCallArgs,
  businessId: string,
  userId: string
): Promise<ToolResult> {
  try {
    let data: unknown;

    if (toolName === 'query_transactions') {
      data = await handleQueryTransactions(businessId, args);
    } else if (toolName === 'get_financial_summary') {
      data = await handleGetFinancialSummary(businessId, args);
    } else if (toolName === 'get_contacts') {
      data = await handleGetContacts(businessId, args);
    } else if (toolName === 'get_business_info') {
      data = await handleGetBusinessInfo(businessId);
    } else if (toolName === 'navigate_to') {
      // navigate_to tidak butuh DB query — langsung return args sebagai NavigateAction
      data = {
        page: args.page,
        filters: args.filters ?? {},
        message: args.message,
      } as NavigateAction;
    } else if (toolName === 'search_knowledge_base') {
      data = await handleSearchKnowledgeBase(businessId, args);
    } else if (toolName === 'run_olap_analytics') {
      data = await handleRunOlapAnalytics(businessId, args);
    } else if (toolName === 'recall_memory') {
      data = await handleRecallMemory(businessId, userId, args);
    } else {
      return { tool: toolName, data: null, error: `Tool tidak dikenal: ${toolName}` };
    }

    return { tool: toolName, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Tool error';
    console.warn(`[agentTools] ${toolName} error:`, msg);
    return { tool: toolName, data: null, error: msg };
  }
}
