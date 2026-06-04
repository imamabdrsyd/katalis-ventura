import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, getAuthenticatedUser, getBusinessRoleForUser } from '@/lib/supabase-server';
import {
  calculateFinancialSummary,
  calculateIncomeStatementMetrics,
  calculateBalanceSheet,
  filterTransactionsByDateRange,
} from '@/lib/calculations';

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

function buildFinancialContext(
  businessName: string,
  businessSector: string,
  transactions: Array<{
    id: string;
    date: string;
    name: string;
    description: string;
    amount: number;
    category: string;
  }>,
  today: Date
): string {
  if (transactions.length === 0) {
    return `BISNIS: ${businessName} (${businessSector})\nBelum ada data transaksi.`;
  }

  // 3 bulan terakhir
  const threeMonthsAgo = new Date(today);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const startDate = threeMonthsAgo.toISOString().split('T')[0];
  const endDate = today.toISOString().split('T')[0];

  const recent = filterTransactionsByDateRange(transactions as never, startDate, endDate);
  const allSummary = calculateFinancialSummary(transactions as never);
  const recentSummary = calculateFinancialSummary(recent as never);
  const recentMetrics = calculateIncomeStatementMetrics(recentSummary);
  const balanceSheet = calculateBalanceSheet(transactions as never, allSummary.totalFin);
  const grossProfit = recentSummary.totalEarn - recentSummary.totalVar;
  const netProfit = recentSummary.netProfit;

  // Group recent transactions by month
  const byMonth: Record<string, { earn: number; opex: number; var: number; tax: number; fin: number; capex: number }> = {};
  for (const tx of recent) {
    const month = tx.date.slice(0, 7);
    if (!byMonth[month]) byMonth[month] = { earn: 0, opex: 0, var: 0, tax: 0, fin: 0, capex: 0 };
    const cat = tx.category.toLowerCase() as keyof typeof byMonth[string];
    if (cat in byMonth[month]) byMonth[month][cat] += tx.amount;
  }

  const monthRows = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => {
      const profit = d.earn - d.opex - d.var - d.tax;
      return `  ${month}: Revenue ${formatIDR(d.earn)}, Beban ${formatIDR(d.opex + d.var + d.tax)}, Profit ${formatIDR(profit)}`;
    })
    .join('\n');

  // Top 5 recent transactions
  const topTx = [...recent]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map(tx => `  - ${tx.date} | ${tx.name} | ${tx.category} | ${formatIDR(tx.amount)}`)
    .join('\n');

  return `=== KONTEKS KEUANGAN BISNIS ===
Bisnis: ${businessName}
Sektor: ${businessSector}
Tanggal hari ini: ${endDate}
Total transaksi (all-time): ${transactions.length}

--- RINGKASAN 3 BULAN TERAKHIR (${startDate} s/d ${endDate}) ---
Revenue: ${formatIDR(recentSummary.totalEarn)}
HPP/Variabel: ${formatIDR(recentSummary.totalVar)}
Beban Operasional: ${formatIDR(recentSummary.totalOpex)}
Pajak: ${formatIDR(recentSummary.totalTax)}
Laba Kotor: ${formatIDR(grossProfit)}
Laba Bersih: ${formatIDR(netProfit)}
Gross Margin: ${recentMetrics.grossMargin.toFixed(1)}%
Net Margin: ${recentMetrics.netMargin.toFixed(1)}%

--- TREN BULANAN ---
${monthRows || '  (belum ada data)'}

--- NERACA (all-time) ---
Total Aset: ${formatIDR(balanceSheet.assets.totalAssets)}
Total Liabilitas: ${formatIDR(balanceSheet.liabilities.totalLiabilities)}
Total Ekuitas: ${formatIDR(balanceSheet.equity.totalEquity)}
Kas & Bank: ${formatIDR(balanceSheet.assets.cash)}

--- 5 TRANSAKSI TERBESAR (3 bulan terakhir) ---
${topTx || '  (belum ada data)'}
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

  // Fetch semua transaksi posted (termasuk null status = transaksi lama dianggap posted)
  // Konsisten dengan filter di useReportData: !t.status || t.status === 'posted'
  const { data: transactions } = await supabase
    .from('active_transactions')
    .select('id, date, name, description, amount, category, debit_account_id, credit_account_id, is_double_entry, meta, account, notes, status')
    .eq('business_id', business_id)
    .or('status.is.null,status.eq.posted')
    .order('date', { ascending: false })
    .limit(2000);

  const financialContext = buildFinancialContext(
    business?.business_name ?? 'Bisnis',
    business?.business_sector ?? '',
    (transactions ?? []) as never,
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
