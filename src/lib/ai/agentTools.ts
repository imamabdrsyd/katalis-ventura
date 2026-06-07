/**
 * Tool definitions + server-side handlers untuk AXION Agent (Vertex provider).
 *
 * Tools ini dipakai dalam agentic loop di /api/ai/agent-query:
 * 1. Gemini menerima definisi tools dalam request
 * 2. Gemini balas dengan function_call (tool apa, args apa)
 * 3. Server eksekusi handler → hasilnya dikirim kembali ke Gemini
 * 4. Gemini formulasi jawaban natural language berdasar data nyata
 *
 * Tools: query_transactions, get_financial_summary, get_contacts, navigate_to
 */

import { createServerClient } from '@/lib/supabase-server';
import { calculateFinancialSummary, filterTransactionsByDateRange } from '@/lib/calculations';
import { formatIDR } from '@/lib/ai/financialContext';
import type { Transaction } from '@/types';

// ─── Tool Definitions (JSON Schema untuk Gemini function calling) ─────────────

export const TOOL_DEFINITIONS = [
  {
    name: 'query_transactions',
    description:
      'Ambil daftar transaksi dari database bisnis. Gunakan untuk pertanyaan spesifik seperti ' +
      '"transaksi terbesar bulan X", "semua pengeluaran ke vendor Y", "transaksi CAPEX tahun ini". ' +
      'Hasil berupa array transaksi terfilter yang bisa dianalisis.',
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

async function handleQueryTransactions(
  businessId: string,
  args: ToolCallArgs
): Promise<unknown> {
  const supabase = await createServerClient();

  let query = supabase
    .from('transactions')
    .select('id, date, name, description, category, amount')
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

  const txs = (data ?? []) as { id: string; date: string; name: string; description: string; category: string; amount: number }[];

  return {
    count: txs.length,
    transactions: txs.map(t => ({
      date: t.date,
      name: t.name,
      description: t.description,
      category: t.category,
      amount: formatIDR(t.amount),
      amount_raw: t.amount,
    })),
    total_amount: formatIDR(txs.reduce((s, t) => s + t.amount, 0)),
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

  // Untuk tiap kontak, hitung total transaksi berdasar name match
  const { data: txSummary } = await supabase
    .from('transactions')
    .select('name, amount, category')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .or('status.is.null,status.eq.posted');

  const txsByName = new Map<string, { total: number; count: number; categories: Set<string> }>();
  for (const tx of (txSummary ?? []) as { name: string; amount: number; category: string }[]) {
    const key = tx.name.toLowerCase();
    const existing = txsByName.get(key) ?? { total: 0, count: 0, categories: new Set() };
    existing.total += tx.amount;
    existing.count++;
    existing.categories.add(tx.category);
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
        total_amount: stats ? formatIDR(stats.total) : 'Rp 0',
        categories: stats ? Array.from(stats.categories).join(', ') : '',
      };
    }),
  };
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export async function executeTool(
  toolName: string,
  args: ToolCallArgs,
  businessId: string
): Promise<ToolResult> {
  try {
    let data: unknown;

    if (toolName === 'query_transactions') {
      data = await handleQueryTransactions(businessId, args);
    } else if (toolName === 'get_financial_summary') {
      data = await handleGetFinancialSummary(businessId, args);
    } else if (toolName === 'get_contacts') {
      data = await handleGetContacts(businessId, args);
    } else if (toolName === 'navigate_to') {
      // navigate_to tidak butuh DB query — langsung return args sebagai NavigateAction
      data = {
        page: args.page,
        filters: args.filters ?? {},
        message: args.message,
      } as NavigateAction;
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
