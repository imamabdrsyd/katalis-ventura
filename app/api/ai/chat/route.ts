import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, getAuthenticatedUser, getBusinessRoleForUser } from '@/lib/supabase-server';
import {
  calculateFinancialSummary,
  calculateIncomeStatementMetrics,
  calculateBalanceSheet,
  filterTransactionsByDateRange,
} from '@/lib/calculations';
import type { Transaction } from '@/types';

const bodySchema = z.object({
  business_id: z.string().uuid(),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1).max(4000),
    })
  ).min(1).max(20),
});

const SYSTEM_PROMPT = `Kamu adalah AXION AI — asisten keuangan cerdas untuk platform akuntansi AXION.
Kamu membantu pemilik bisnis UKM Indonesia menganalisis data keuangan bisnis mereka.

KEPRIBADIAN:
- Ramah, profesional, dan langsung ke poin
- Gunakan bahasa yang sama dengan user (Indonesia atau Inggris)
- Sertakan angka dan insight spesifik, bukan jawaban generik
- Bila ada data negatif (rugi, ROI rendah), tetap positif dan berikan saran konstruktif

KEMAMPUAN:
- Analisis tren revenue, profit, beban
- Bandingkan periode (bulan ini vs bulan lalu, Q1 vs Q2, dll)
- Identifikasi kategori beban terbesar
- Hitung dan jelaskan rasio keuangan (margin, ROI, burn rate)
- Beri rekomendasi berdasarkan data

BATASAN:
- Kamu TIDAK bisa membuat/mengubah/menghapus transaksi (itu Opsi B nanti)
- Jika ditanya di luar keuangan bisnis ini, tolak dengan sopan
- Jangan buat angka fiktif — hanya gunakan data yang tersedia

FORMAT JAWABAN:
- Gunakan angka dari data yang diberikan, format IDR: "Rp X.XXX.XXX"
- Boleh pakai markdown ringan (bold untuk angka penting, bullet untuk list)
- Jawab ringkas kecuali user minta detail
- Selalu akhiri dengan insight atau pertanyaan lanjutan jika relevan`;

function formatIDR(amount: number): string {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(amount));
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/**
 * Income statement proper untuk satu rentang tanggal — pakai engine yang SAMA
 * dengan halaman laporan (calculateFinancialSummary baca debit/credit account_type
 * + journal_lines), bukan jumlah `amount` mentah per kategori.
 */
function monthlyIncomeStatement(transactions: Transaction[], month: string): string {
  const start = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const end = new Date(y, m, 0).toISOString().split('T')[0]; // last day of month
  const inMonth = filterTransactionsByDateRange(transactions, start, end);
  if (inMonth.length === 0) return '';

  const summary = calculateFinancialSummary(inMonth);
  const metrics = calculateIncomeStatementMetrics(summary);
  const label = `${MONTH_NAMES_ID[m - 1]} ${y}`;

  return `  ${label}: Revenue ${formatIDR(summary.totalEarn)} | HPP ${formatIDR(summary.totalVar)} | Laba Kotor ${formatIDR(summary.grossProfit)} | OpEx ${formatIDR(summary.totalOpex)} | Depresiasi ${formatIDR(summary.totalDepreciation)} | Pajak ${formatIDR(summary.totalTax)} | Bunga ${formatIDR(summary.totalInterest)} | Laba Bersih ${formatIDR(summary.netProfit)} (margin ${metrics.netMargin.toFixed(1)}%)`;
}

function buildFinancialContext(
  businessName: string,
  businessSector: string,
  transactions: Transaction[],
  today: Date
): string {
  if (transactions.length === 0) {
    return `BISNIS: ${businessName} (${businessSector})\nBelum ada data transaksi.`;
  }

  const endDate = today.toISOString().split('T')[0];
  const allSummary = calculateFinancialSummary(transactions);
  const allMetrics = calculateIncomeStatementMetrics(allSummary);
  const balanceSheet = calculateBalanceSheet(transactions, allSummary.totalFin);

  // P&L proper per-bulan untuk 6 bulan terakhir (termasuk bulan berjalan).
  // Tiap bulan dihitung pakai calculateFinancialSummary — konsisten dgn Income Statement.
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const monthRows = monthKeys
    .map((mk) => monthlyIncomeStatement(transactions, mk))
    .filter(Boolean)
    .join('\n');

  // Top 5 transaksi terbesar 3 bulan terakhir (untuk konteks "apa yang besar")
  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1)
    .toISOString().split('T')[0];
  const recent = filterTransactionsByDateRange(transactions, threeMonthsAgo, endDate);
  const topTx = [...recent]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((tx) => `  - ${tx.date} | ${tx.name} | ${tx.category} | ${formatIDR(tx.amount)}`)
    .join('\n');

  return `=== KONTEKS KEUANGAN BISNIS ===
Bisnis: ${businessName}
Sektor: ${businessSector}
Tanggal hari ini: ${endDate}
Total transaksi posted (all-time): ${transactions.length}

--- LABA RUGI PER BULAN (6 bulan terakhir, akurat sesuai halaman Income Statement) ---
${monthRows || '  (belum ada data di rentang ini)'}

--- RINGKASAN ALL-TIME ---
Revenue: ${formatIDR(allSummary.totalEarn)}
HPP/Variabel: ${formatIDR(allSummary.totalVar)}
Laba Kotor: ${formatIDR(allSummary.grossProfit)}
Beban Operasional: ${formatIDR(allSummary.totalOpex)}
Depresiasi: ${formatIDR(allSummary.totalDepreciation)}
Pajak: ${formatIDR(allSummary.totalTax)}
Bunga: ${formatIDR(allSummary.totalInterest)}
Laba Bersih: ${formatIDR(allSummary.netProfit)}
Gross Margin: ${allMetrics.grossMargin.toFixed(1)}% | Net Margin: ${allMetrics.netMargin.toFixed(1)}%

--- NERACA (all-time) ---
Total Aset: ${formatIDR(balanceSheet.assets.totalAssets)}
Total Liabilitas: ${formatIDR(balanceSheet.liabilities.totalLiabilities)}
Total Ekuitas: ${formatIDR(balanceSheet.equity.totalEquity)}
Kas & Bank: ${formatIDR(balanceSheet.assets.cash)}

--- 5 TRANSAKSI TERBESAR (3 bulan terakhir) ---
${topTx || '  (belum ada data)'}

CATATAN: Semua angka laba rugi per bulan SUDAH dihitung dengan engine double-entry
yang sama persis dengan halaman Income Statement. Gunakan angka per-bulan di atas
untuk pertanyaan spesifik bulan tertentu — JANGAN mengira-ngira atau membagi rata.
=== END KONTEKS ===`;
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
  }

  const { business_id, messages } = parsed.data;

  const supabase = await createServerClient();
  const role = await getBusinessRoleForUser(supabase, user.id, business_id);
  if (!role) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch business info
  const { data: business } = await supabase
    .from('businesses')
    .select('business_name, business_sector')
    .eq('id', business_id)
    .single();

  // Fetch transaksi dengan relasi account + journal_lines — WAJIB karena
  // calculateFinancialSummary mengklasifikasi via account_type (debit/credit/journal line),
  // bukan dari field `category` mentah. Tanpa join ini angka P&L salah total.
  // Filter posted (null status = transaksi lama dianggap posted, konsisten useReportData).
  const { data: transactions } = await supabase
    .from('transactions')
    .select(`
      *,
      debit_account:accounts!transactions_debit_account_id_fkey(*),
      credit_account:accounts!transactions_credit_account_id_fkey(*),
      journal_lines(*, account:accounts(*))
    `)
    .eq('business_id', business_id)
    .is('deleted_at', null)
    .or('status.is.null,status.eq.posted')
    .order('date', { ascending: false })
    .limit(3000);

  const financialContext = buildFinancialContext(
    business?.business_name ?? 'Bisnis',
    business?.business_sector ?? '',
    (transactions ?? []) as unknown as Transaction[],
    new Date()
  );

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI tidak tersedia saat ini' }, { status: 503 });
  }

  // Build Gemini contents (multi-turn)
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  // Inject konteks keuangan ke pesan user pertama
  if (contents[0]?.role === 'user') {
    contents[0].parts[0].text = `${financialContext}\n\n${contents[0].parts[0].text}`;
  }

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    }
  );

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    console.error('[ai/chat] Gemini error:', geminiRes.status, errText.slice(0, 200));
    return NextResponse.json({ error: 'AI gagal merespons. Coba lagi.' }, { status: 502 });
  }

  // Stream SSE dari Gemini → stream ke client
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = geminiRes.body?.getReader();
      if (!reader) { controller.close(); return; }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const json = JSON.parse(data);
              const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
              }
            } catch {
              // skip malformed chunk
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
