import { ParsedTransaction, TransactionCategory } from './types';

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

export function formatTransactionSaved(name: string, amount: number, category: TransactionCategory, businessName: string): string {
  const emoji = CATEGORY_EMOJI[category];
  const label = CATEGORY_LABELS[category];
  return `✅ *Transaksi berhasil dicatat!*

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

export function formatHelp(): string {
  return `🤖 *AXION Bot — Cara Pakai*

*Input Transaksi:*
Cukup ketik deskripsi + jumlah, contoh:
  \`jual kopi 150000\`
  \`bayar gaji 2jt\`
  \`beli bahan 500rb\`
  \`bayar pajak 1.5jt\`

*Perintah:*
/saldo — Lihat ringkasan keuangan
/bisnis — Lihat & ganti bisnis aktif
/help — Tampilkan panduan ini

*Format angka yang didukung:*
150000 · 150.000 · 150rb · 150k · 1.5jt · 2jt`;
}
