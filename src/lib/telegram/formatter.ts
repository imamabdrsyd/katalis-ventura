import { ParsedTransaction, TransactionCategory } from './types';
import type { OcrProvider } from '@/lib/ocr/types';

export function formatRupiah(amount: number): string {
  return 'Rp ' + amount.toLocaleString('id-ID');
}

const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  EARN: 'Pendapatan',
  OPEX: 'Beban Operasional',
  VAR: 'HPP / Variabel',
  CAPEX: 'Belanja Modal',
  TAX: 'Pajak',
  FIN: 'Pembiayaan',
};

const CATEGORY_EMOJI: Record<TransactionCategory, string> = {
  EARN: '💰',
  OPEX: '📤',
  VAR: '📦',
  CAPEX: '🏗️',
  TAX: '🏛️',
  FIN: '🏦',
};

type OcrDraft = {
  date?: string;     // ISO YYYY-MM-DD
  total?: number;
  vendor?: string;
  provider: OcrProvider;
};

/**
 * Format pesan konfirmasi draft transaksi hasil OCR struk.
 * Dipasangkan dengan inline keyboard Simpan/Batal di sisi caller.
 */
export function formatOcrDraft(draft: OcrDraft): string {
  const dateDisplay = draft.date
    ? formatDateIndonesia(draft.date)
    : '_tidak terbaca_';
  const totalDisplay = draft.total
    ? formatRupiah(draft.total)
    : '_tidak terbaca_';
  const vendorDisplay = draft.vendor ?? '_tidak terbaca_';
  const providerLabel =
    draft.provider === 'gemini'
      ? 'Gemini'
      : draft.provider === 'google_vision'
        ? 'Google Vision'
        : 'OCR.space';

  return `📸 *Draft Transaksi dari Struk*

📅 Tanggal: ${dateDisplay}
💰 Total: ${totalDisplay}
🏪 Vendor: ${vendorDisplay}

_OCR via ${providerLabel}_

Pilih aksi di bawah ini.`;
}

export function formatOcrSaved(amount: number, vendor: string | undefined, status: 'draft' | 'posted'): string {
  const statusLabel = status === 'posted' ? 'di-posting' : 'disimpan sebagai draft';
  const vendorPart = vendor ? ` dari *${vendor}*` : '';
  return `✅ Transaksi ${formatRupiah(amount)}${vendorPart} ${statusLabel}.`;
}

function formatDateIndonesia(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const monthIdx = parseInt(m, 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return isoDate;
  return `${parseInt(d, 10)} ${months[monthIdx]} ${y}`;
}

export function formatTransactionConfirmation(parsed: ParsedTransaction, date: string): string {
  const emoji = CATEGORY_EMOJI[parsed.category];
  const label = CATEGORY_LABELS[parsed.category];
  const confidenceNote = parsed.confidence === 'low'
    ? '\n⚠️ _Kategori ditebak otomatis, mungkin tidak tepat_'
    : '';

  return `*Konfirmasi Transaksi*

📝 ${parsed.name}
${emoji} ${formatRupiah(parsed.amount)}
📂 ${label} (${parsed.category})
📅 ${date}${confidenceNote}

Ketik *YA* untuk simpan, *TIDAK* untuk batal.`;
}

export function formatTransactionSaved(
  name: string,
  amount: number,
  category: TransactionCategory,
  businessName: string,
  status: 'draft' | 'posted' = 'draft'
): string {
  const emoji = CATEGORY_EMOJI[category];
  const label = CATEGORY_LABELS[category];
  const statusBadge = status === 'posted' ? '✅ *Posted*' : '📝 *Draft*';
  return `${statusBadge} — Transaksi tersimpan!

📝 ${name}
${emoji} ${formatRupiah(amount)} — ${label}
🏢 ${businessName}`;
}

export interface BalanceSummary {
  businessName: string;
  totalEarn: number;
  totalOpex: number;
  totalVar: number;
  totalCapex: number;
  totalTax: number;
  totalFin: number;
}

export function formatBalanceSummary(summary: BalanceSummary): string {
  const totalOut = summary.totalOpex + summary.totalVar + summary.totalTax;
  const netProfit = summary.totalEarn - totalOut;
  const profitSign = netProfit >= 0 ? '+' : '';

  return `📊 *Ringkasan Keuangan*
🏢 ${summary.businessName}

💰 Pendapatan:        ${formatRupiah(summary.totalEarn)}
📤 Beban Operasional: ${formatRupiah(summary.totalOpex)}
📦 HPP/Variabel:      ${formatRupiah(summary.totalVar)}
🏛️ Pajak:             ${formatRupiah(summary.totalTax)}

*Laba Bersih: ${profitSign}${formatRupiah(netProfit)}*`;
}

export function formatBusinessList(businesses: { id: string; business_name: string }[], defaultId: string | null): string {
  const lines = businesses.map((b, i) => {
    const active = b.id === defaultId ? ' ✅' : '';
    return `${i + 1}. ${b.business_name}${active}`;
  });
  return `🏢 *Daftar Bisnis Kamu*\n\n${lines.join('\n')}\n\nBalas dengan nomor untuk ganti bisnis aktif.`;
}

export interface TransactionListItem {
  name: string;
  description: string | null;
  amount: number;
  category: TransactionCategory;
  status: string;
}

export function formatTransactionList(
  items: TransactionListItem[],
  dateLabel: string,
  dateStr: string,
  businessName: string
): string {
  if (items.length === 0) {
    return `📋 *Transaksi ${dateLabel}* (${dateStr})\n🏢 ${businessName}\n\n_Tidak ada transaksi pada tanggal ini._`;
  }

  const lines = items.map((tx, i) => {
    const emoji = CATEGORY_EMOJI[tx.category];
    const desc = tx.description && tx.description !== 'Via Telegram Bot' && tx.description !== tx.name
      ? tx.description
      : tx.name;
    const statusIcon = tx.status === 'draft' ? ' 📝' : '';
    return `${i + 1}. ${emoji} ${desc}\n   ${formatRupiah(tx.amount)} — ${tx.category}${statusIcon}`;
  });

  let totalIn = 0;
  let totalOut = 0;
  for (const tx of items) {
    if (tx.category === 'EARN') totalIn += tx.amount;
    else if (['OPEX', 'VAR', 'TAX'].includes(tx.category)) totalOut += tx.amount;
  }

  const net = totalIn - totalOut;
  const netSign = net >= 0 ? '+' : '';

  return `📋 *Transaksi ${dateLabel}* (${dateStr})
🏢 ${businessName}

${lines.join('\n')}

━━━━━━━━━━━━━━━
💰 Masuk:   ${formatRupiah(totalIn)}
📤 Keluar:  ${formatRupiah(totalOut)}
*Net:       ${netSign}${formatRupiah(net)}*

_📝 = draft_`;
}

export function formatHelp(): string {
  return `🤖 *AXION Bot — Cara Pakai*

*Input Transaksi:*
Cukup ketik deskripsi + jumlah, contoh:
  \`jual kopi 150000\`
  \`bayar gaji 2jt\`
  \`beli bahan 500rb\`
  \`bayar pajak 1.5jt\`

*📸 Scan Struk:*
Kirim foto struk/nota, bot otomatis baca tanggal, total, dan vendor.
Kamu tinggal klik tombol *Simpan* atau *Batal*.

*🤖 Tanya AXION Agent:*
Tanya soal keuangan bisnismu, contoh:
  \`/tanya kenapa bulan ini rugi?\`
  \`/tanya kategori beban terbesar apa?\`
  \`/tanya tren revenue 3 bulan terakhir\`

*Lihat Transaksi:*
  \`lihat transaksi hari ini\`
  \`lihat transaksi kemarin\`
  \`lihat transaksi 10 april\`
  \`lihat transaksi 10/04/2026\`

*Laporan PDF:*
  \`laba rugi bulan ini\`
  \`laba rugi bulan lalu\`
  \`neraca bulan ini\`
  \`arus kas tahun ini\`
  \`laba rugi Q1 2026\`
  \`neraca januari 2026\`

*Koreksi Kategori:*
Saat konfirmasi, balas \`OPEX\` atau \`VAR\` untuk mengubah kategori.

*Perintah:*
/tanya — Tanya AXION Agent soal keuangan
/saldo — Lihat ringkasan keuangan
/bisnis — Lihat & ganti bisnis aktif
/setting — Lihat pengaturan bot saat ini
/help — Tampilkan panduan ini

*Format angka yang didukung:*
150000 · 150.000 · 150rb · 150k · 1.5jt · 2jt`;
}
