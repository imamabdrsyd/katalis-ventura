/**
 * Parser deterministik untuk CSV ekspor pesanan TikTok Shop / Tokopedia.
 *
 * Sejak TikTok mengakuisisi Tokopedia, kedua marketplace berbagi satu Seller
 * Center ("Dikelola oleh PT Tokopedia"). Satu file ekspor pesanan memuat order
 * dari KEDUA channel, dibedakan oleh kolom `Purchase Channel` ("TikTok" /
 * "Tokopedia"). Maka satu parser ini menangani kedua channel.
 *
 * Karakteristik file (quirk yang ditangani):
 * - UTF-8 BOM di awal file (﻿) → di-strip.
 * - Banyak sel punya trailing TAB (Order ID, kolom tanggal) → di-trim.
 * - 1 order = banyak baris (1 baris per SKU). Kolom level-order (Order Amount,
 *   ongkir, fee) BERULANG identik di tiap baris → harus dedupe per Order ID
 *   supaya tidak double-count.
 * - `SKU ID` stabil sebagai identitas produk; `Seller SKU` berubah antar periode
 *   ("SHAMPO 250" → "SHMP-KMR250" → "250ML") untuk produk yang sama.
 * - Tanggal format "DD/MM/YYYY HH:MM:SS".
 *
 * Mapping ke double-entry journal (2 baris per ORDER):
 *   Dr Kas/Bank        = Σ SKU Subtotal After Discount (semua SKU di order)
 *     Cr Pendapatan    = Σ SKU Subtotal After Discount
 *
 * Catatan akuntansi: ini ekspor ORDER (kotor), BUKAN settlement. Komisi
 * TikTok/Tokopedia, biaya affiliate, dan ongkir-subsidi-platform TIDAK
 * dicatat sebagai pendapatan — ongkir di file ini mayoritas disubsidi platform
 * (seller tidak menerima uangnya). Nilai pendapatan = SKU Subtotal After
 * Discount saja. Ongkir/diskon/fee disimpan di meta untuk audit.
 */

export interface TikTokOrderLine {
  /** SKU ID numerik — identitas produk yang stabil */
  skuId: string;
  /** Seller SKU label (bisa berubah antar periode) */
  sellerSku: string;
  productName: string;
  variation: string;
  quantity: number;
  /** Net jual per SKU setelah diskon platform + seller (kolom revenue) */
  subtotalAfterDiscount: number;
  subtotalBeforeDiscount: number;
  platformDiscount: number;
  sellerDiscount: number;
}

export interface TikTokOrder {
  orderId: string;
  /** "TikTok" | "Tokopedia" dari kolom Purchase Channel */
  purchaseChannel: string;
  /** Tanggal (Paid Time) format YYYY-MM-DD */
  date: string;
  status: string;
  recipient: string;
  buyerUsername: string;
  /** Σ subtotalAfterDiscount semua SKU — nilai pendapatan order ini */
  revenue: number;
  /** Total dibayar pembeli (Order Amount) — disimpan untuk audit, bukan revenue */
  orderAmount: number;
  /** Σ ongkir efektif yang dibayar/ditanggung — audit only */
  shippingFee: number;
  orderRefundAmount: number;
  lines: TikTokOrderLine[];
}

export interface TikTokParseResult {
  orders: TikTokOrder[];
  /** Order dilewati (status non-Selesai, refund, atau revenue ≤ 0) */
  skipped: number;
  /** Hitungan order per channel untuk ringkasan */
  channelCounts: Record<string, number>;
  errors: string[];
}

function cleanCell(val: string | undefined): string {
  if (val === undefined) return '';
  // Strip kutip pembungkus, tab/whitespace di tepi (termasuk trailing TAB quirk).
  return val.replace(/^"|"$/g, '').replace(/[\t\r\n]/g, '').trim();
}

function parseAmount(val: string | undefined): number {
  const cleaned = cleanCell(val).replace(/[^0-9.-]/g, '');
  if (!cleaned) return 0;
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/** "DD/MM/YYYY HH:MM:SS" → "YYYY-MM-DD". Kosong → string kosong (caller fallback). */
function parseOrderDate(val: string | undefined): string {
  const trimmed = cleanCell(val);
  if (!trimmed) return '';
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Sudah ISO?
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  return '';
}

/** Parse satu baris CSV menghormati field ber-kutip yang memuat koma. */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Kutip ganda di dalam kutip = escaped quote.
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function parseTikTokTokopediaCSV(csvText: string): TikTokParseResult {
  // Strip BOM bila ada.
  const text = csvText.replace(/^﻿/, '');
  // Field ber-kutip bisa memuat newline (alamat). Pakai parser sadar-kutip
  // untuk memecah baris logis, bukan split('\n') naif.
  const lines = splitCsvRows(text).filter(l => l.trim());
  if (lines.length < 2) {
    return { orders: [], skipped: 0, channelCounts: {}, errors: ['File CSV kosong atau tidak valid'] };
  }

  const headers = parseCsvLine(lines[0]).map(h => cleanCell(h).toLowerCase());
  const col = (name: string) => headers.indexOf(name.toLowerCase());

  const idx = {
    orderId: col('Order ID'),
    status: col('Order Status'),
    skuId: col('SKU ID'),
    sellerSku: col('Seller SKU'),
    productName: col('Product Name'),
    variation: col('Variation'),
    quantity: col('Quantity'),
    subtotalAfter: col('SKU Subtotal After Discount'),
    subtotalBefore: col('SKU Subtotal Before Discount'),
    platformDiscount: col('SKU Platform Discount'),
    sellerDiscount: col('SKU Seller Discount'),
    shippingAfter: col('Shipping Fee After Discount'),
    orderRefund: col('Order Refund Amount'),
    orderAmount: col('Order Amount'),
    paidTime: col('Paid Time'),
    createdTime: col('Created Time'),
    recipient: col('Recipient'),
    buyerUsername: col('Buyer Username'),
    purchaseChannel: col('Purchase Channel'),
  };

  // Kolom minimum yang wajib ada untuk format ini.
  if (idx.orderId === -1 || idx.subtotalAfter === -1) {
    return {
      orders: [],
      skipped: 0,
      channelCounts: {},
      errors: ['Format CSV tidak dikenali: kolom "Order ID" / "SKU Subtotal After Discount" tidak ditemukan'],
    };
  }

  // Kelompokkan baris per Order ID. Kolom level-order diambil dari baris pertama
  // order tsb (nilainya identik di semua baris order yang sama).
  const orderMap = new Map<string, TikTokOrder>();
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const get = (c: number) => (c >= 0 ? cleanCell(cols[c]) : '');

    const orderId = get(idx.orderId);
    if (!orderId) continue;

    const status = get(idx.status);
    // Hanya pesanan selesai yang jadi pendapatan. Non-Selesai (Dibatalkan,
    // Dikembalikan, dst) dilewati.
    const isCompleted = status.toLowerCase().includes('selesai') || status.toLowerCase() === 'completed';

    const line: TikTokOrderLine = {
      skuId: get(idx.skuId),
      sellerSku: get(idx.sellerSku),
      productName: get(idx.productName),
      variation: get(idx.variation),
      quantity: parseInt(get(idx.quantity) || '1', 10) || 1,
      subtotalAfterDiscount: parseAmount(get(idx.subtotalAfter)),
      subtotalBeforeDiscount: parseAmount(get(idx.subtotalBefore)),
      platformDiscount: parseAmount(get(idx.platformDiscount)),
      sellerDiscount: parseAmount(get(idx.sellerDiscount)),
    };

    let order = orderMap.get(orderId);
    if (!order) {
      // Tanggal: Paid Time (cash basis). Fallback ke Created Time lalu hari ini.
      const date =
        parseOrderDate(get(idx.paidTime)) ||
        parseOrderDate(get(idx.createdTime)) ||
        new Date().toISOString().split('T')[0];

      order = {
        orderId,
        purchaseChannel: get(idx.purchaseChannel) || 'TikTok',
        date,
        status,
        recipient: get(idx.recipient),
        buyerUsername: get(idx.buyerUsername),
        revenue: 0,
        // Kolom level-order — diambil sekali dari baris pertama (identik di semua baris).
        orderAmount: parseAmount(get(idx.orderAmount)),
        shippingFee: parseAmount(get(idx.shippingAfter)),
        orderRefundAmount: parseAmount(get(idx.orderRefund)),
        lines: [],
        // Penanda completeness; baris non-selesai tidak menambah revenue.
        ...(isCompleted ? {} : { status }),
      };
      orderMap.set(orderId, order);
    }

    // Akumulasi revenue HANYA dari baris pesanan selesai.
    if (isCompleted) {
      order.revenue += line.subtotalAfterDiscount;
    }
    order.lines.push(line);
  }

  // Saring: hanya order selesai dengan revenue > 0 setelah refund.
  const orders: TikTokOrder[] = [];
  const channelCounts: Record<string, number> = {};

  for (const order of orderMap.values()) {
    const completed = order.status.toLowerCase().includes('selesai') || order.status.toLowerCase() === 'completed';
    const netRevenue = order.revenue - order.orderRefundAmount;

    if (!completed || netRevenue <= 0) {
      skipped++;
      continue;
    }

    order.revenue = Math.round(netRevenue);
    orders.push(order);
    channelCounts[order.purchaseChannel] = (channelCounts[order.purchaseChannel] ?? 0) + 1;
  }

  const errors: string[] = [];
  if (orders.length === 0 && orderMap.size > 0) {
    errors.push(`Tidak ada pesanan selesai yang bisa diproses dari ${orderMap.size} order CSV`);
  }

  return { orders, skipped, channelCounts, errors };
}

/**
 * Pecah teks CSV menjadi baris logis, menghormati field ber-kutip yang memuat
 * newline (mis. kolom alamat). split('\n') naif akan memotong di tengah field.
 */
function splitCsvRows(text: string): string[] {
  const rows: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += ch;
      }
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      rows.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) rows.push(current);
  return rows;
}
