import { ParsedTransaction, TransactionCategory } from './types';

// Keyword mapping untuk inferensi kategori transaksi
// Kata-kata dicek terhadap seluruh teks (case-insensitive)
const CATEGORY_KEYWORDS: { keywords: string[]; category: TransactionCategory }[] = [
  {
    keywords: ['jual', 'terima', 'masuk', 'income', 'revenue', 'penjualan', 'dapat', 'omset', 'omzet', 'terbayar', 'pembayaran masuk', 'bayar dari'],
    category: 'EARN',
  },
  {
    keywords: ['pajak', 'pph', 'ppn', 'pbb', 'tax', 'bpjs', 'retribusi'],
    category: 'TAX',
  },
  {
    keywords: ['modal', 'investasi', 'injeksi', 'prive', 'withdraw', 'tarik', 'pinjam', 'cicil', 'kredit', 'hutang', 'piutang'],
    category: 'FIN',
  },
  {
    keywords: ['beli aset', 'renovasi', 'beli motor', 'beli mobil', 'beli laptop', 'beli mesin', 'peralatan', 'kendaraan', 'gedung', 'tanah', 'capex'],
    category: 'CAPEX',
  },
  {
    keywords: ['bahan', 'packaging', 'kemasan', 'komisi', 'ongkir', 'pengiriman', 'bensin', 'bbm', 'solar', 'beli bahan', 'hpp', 'stok', 'persediaan', 'inventory'],
    category: 'VAR',
  },
  {
    keywords: ['gaji', 'upah', 'listrik', 'air', 'pln', 'pdam', 'sewa', 'rental', 'iuran', 'langganan', 'internet', 'wifi', 'telepon', 'operasional', 'opex', 'bayar', 'biaya', 'beban', 'keluar', 'pengeluaran', 'bayar', 'beli'],
    category: 'OPEX',
  },
];

// Parse format angka Indonesia:
// 150000, 150.000, 150rb, 150k, 1.5jt, 2jt, 2,5jt
function parseAmount(token: string): number | null {
  const t = token.toLowerCase().trim().replace(',', '.');

  if (t.endsWith('jt') || t.endsWith('m')) {
    const n = parseFloat(t.replace(/[jt|m]$/, '').replace(/[jm]$/, ''));
    return isNaN(n) || n <= 0 ? null : Math.round(n * 1_000_000);
  }
  if (t.endsWith('rb') || t.endsWith('k')) {
    const n = parseFloat(t.replace(/rb$/, '').replace(/k$/, ''));
    return isNaN(n) || n <= 0 ? null : Math.round(n * 1_000);
  }

  // Hapus titik sebagai pemisah ribuan (150.000 → 150000)
  const plain = t.replace(/\./g, '');
  const n = Number(plain);
  return isNaN(n) || n <= 0 ? null : n;
}

function inferCategory(text: string): { category: TransactionCategory; confidence: 'high' | 'medium' | 'low' } {
  const lower = text.toLowerCase();

  for (const { keywords, category } of CATEGORY_KEYWORDS) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        // Keyword spesifik (lebih dari 1 kata atau kata unik) = high confidence
        const confidence = kw.includes(' ') || ['pajak', 'pph', 'ppn', 'gaji', 'modal', 'jual', 'bahan', 'capex', 'opex', 'hpp'].includes(kw)
          ? 'high'
          : 'medium';
        return { category, confidence };
      }
    }
  }

  // Default ke OPEX jika tidak dikenali
  return { category: 'OPEX', confidence: 'low' };
}

export function parseTransactionMessage(text: string): ParsedTransaction | null {
  const tokens = text.trim().split(/\s+/);
  if (tokens.length < 2) return null;

  // Coba ambil amount dari token terakhir, mundur sampai ketemu
  let amount: number | null = null;
  let amountIndex = -1;

  for (let i = tokens.length - 1; i >= 1; i--) {
    amount = parseAmount(tokens[i]);
    if (amount !== null) {
      amountIndex = i;
      break;
    }
  }

  if (amount === null || amountIndex < 1) return null;

  const name = tokens.slice(0, amountIndex).join(' ').trim();
  if (!name) return null;

  const { category, confidence } = inferCategory(name);

  return {
    name,
    amount,
    category,
    confidence,
    raw: text,
  };
}
