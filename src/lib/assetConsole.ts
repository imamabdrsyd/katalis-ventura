/**
 * Asset Console — agregasi portofolio investasi DARI `transactions`.
 *
 * PRINSIP: tidak ada ledger paralel. Posisi, cost basis, dan realized P/L
 * seluruhnya diturunkan dari transaksi yang sudah tercatat di buku besar dan
 * tertaut ke item katalog lewat `meta.catalog_item` (pola migrasi 119).
 * Konsekuensinya angka di Asset Console tidak mungkin drift dari Neraca /
 * Laba Rugi — karena sumbernya persis sama.
 *
 * Metode: AVERAGE COST per (instrumen × kustodian). Kustodian diambil dari
 * `transactions.name` (nama broker/exchange, mis. "Sinarmas Sekuritas") —
 * inilah yang memungkinkan konsolidasi lintas broker: BMRI di Sinarmas dan
 * BMRI di Stockbit adalah dua posisi terpisah yang dijumlahkan jadi satu baris.
 *
 * Satuan: kuantitas transaksi dicatat dalam LOT (meta.unit_breakdown.quantity),
 * sedangkan harga dikutip per LEMBAR (catalog_items.default_price). Jembatannya
 * `catalog_items.asset_lot_size` (saham IDX = 100).
 */

import type { Account, AssetClass, CatalogItem, JournalLine, Transaction } from '@/types';

/** Toleransi pembulatan rupiah — sama dengan yang dipakai calculations.ts. */
const EPSILON = 0.01;

export type AssetEventType = 'buy' | 'sell' | 'dividend' | 'adjustment';

export interface AssetEvent {
  transactionId: string;
  transactionNumber?: string | null;
  date: string;
  custodian: string;
  eventType: AssetEventType;
  description: string;
  /** Kuantitas dalam satuan transaksi (lot). Selalu positif. */
  quantity: number;
  /** True bila kuantitas diturunkan dari cost basis, bukan dari input user. */
  quantityDerived: boolean;
  /** Perubahan cost basis di akun posisi. Positif = beli, negatif = jual. */
  costBasisDelta: number;
  /** Kas/nilai yang berpindah (transactions.amount). */
  amount: number;
  /** Hanya terisi untuk 'sell' dan 'dividend'. */
  realizedPl: number;
  /** Rata-rata cost per satuan transaksi sesaat SEBELUM event ini. */
  avgCostBefore: number;
  status: Transaction['status'];
}

export interface AssetPosition {
  custodian: string;
  quantity: number;
  costBasis: number;
  /** costBasis / quantity, dalam satuan transaksi (per lot). */
  avgCost: number;
  realizedPl: number;
}

export interface AssetHolding {
  itemId: string;
  symbol: string;
  assetClass: AssetClass;
  /** Satuan harga (lembar/coin/gram). */
  priceUnit: string;
  /** Satuan harga per 1 kuantitas transaksi. Saham IDX = 100. */
  lotSize: number;
  lastPrice: number;
  lastPriceUpdatedAt: string | null;

  positions: AssetPosition[];
  events: AssetEvent[];

  /** Total kuantitas dalam satuan transaksi (lot). */
  totalQuantity: number;
  totalCostBasis: number;
  /** Cost basis per satuan transaksi (per lot). */
  avgCost: number;
  /** Cost basis per satuan harga (per lembar) — angka yang dibandingkan dgn lastPrice. */
  avgCostPerPriceUnit: number;
  marketValue: number;
  unrealizedPl: number;
  unrealizedPlPct: number;
  realizedPl: number;

  /**
   * Ada transaksi beli tanpa kuantitas di meta.unit_breakdown, sehingga total
   * kuantitas (dan karenanya avg cost) tidak bisa dipercaya. UI wajib
   * memperingatkan alih-alih diam-diam menampilkan angka yang salah.
   */
  hasUnknownQuantity: boolean;
}

export interface AssetConsoleSummary {
  totalInvested: number;
  totalMarketValue: number;
  totalUnrealizedPl: number;
  totalUnrealizedPlPct: number;
  totalRealizedPl: number;
  /** Instrumen dengan posisi terbuka (quantity > 0). */
  openInstrumentCount: number;
  /** Instrumen yang harganya belum pernah di-update manual. */
  missingPriceCount: number;
}

/**
 * Akun "posisi" = akun ASSET tempat cost basis investasi diparkir (mis. 1300
 * Inventory / Investasi). Klasifikasi lewat account_type + flag, BUKAN
 * pencocokan nama akun.
 */
function isPositionAccount(account: Account | undefined): boolean {
  if (!account) return false;
  if (account.account_type !== 'ASSET') return false;
  if (account.is_cash_equivalent) return false;
  if (account.is_trade_receivable) return false;
  return true;
}

/**
 * Normalisasi transaksi ke daftar baris jurnal. Transaksi multi-line sudah
 * punya journal_lines; transaksi lama (1 debit / 1 kredit) disintesis agar
 * kalkulasi di bawah cukup menangani satu bentuk.
 */
function linesOf(tx: Transaction): Array<Pick<JournalLine, 'debit_amount' | 'credit_amount'> & { account?: Account }> {
  if (tx.journal_lines && tx.journal_lines.length > 0) {
    return tx.journal_lines;
  }
  const synthesized: Array<Pick<JournalLine, 'debit_amount' | 'credit_amount'> & { account?: Account }> = [];
  if (tx.debit_account) {
    synthesized.push({ debit_amount: tx.amount, credit_amount: 0, account: tx.debit_account });
  }
  if (tx.credit_account) {
    synthesized.push({ debit_amount: 0, credit_amount: tx.amount, account: tx.credit_account });
  }
  return synthesized;
}

/** Perubahan cost basis di akun posisi: + saat beli, − saat jual. */
function positionDeltaOf(tx: Transaction): number {
  return linesOf(tx).reduce((sum, line) => {
    if (!isPositionAccount(line.account)) return sum;
    return sum + (Number(line.debit_amount) || 0) - (Number(line.credit_amount) || 0);
  }, 0);
}

/**
 * Laba/rugi terealisasi yang diakui transaksi ini: kredit ke REVENUE dianggap
 * laba, debit ke EXPENSE dianggap rugi. Menangani dua-duanya sekaligus, jadi
 * bisnis yang memakai satu akun REVENUE gabungan maupun yang memisah akun
 * gain & loss sama-sama terhitung benar.
 */
function realizedPlOf(tx: Transaction): number {
  return linesOf(tx).reduce((sum, line) => {
    const acc = line.account;
    if (!acc) return sum;
    const debit = Number(line.debit_amount) || 0;
    const credit = Number(line.credit_amount) || 0;
    if (acc.account_type === 'REVENUE') return sum + credit - debit;
    if (acc.account_type === 'EXPENSE') return sum - debit + credit;
    return sum;
  }, 0);
}

function classifyEvent(positionDelta: number, realizedPl: number): AssetEventType {
  if (positionDelta > EPSILON) return 'buy';
  if (positionDelta < -EPSILON) return 'sell';
  if (Math.abs(realizedPl) > EPSILON) return 'dividend';
  return 'adjustment';
}

function custodianOf(tx: Transaction): string {
  return tx.name?.trim() || tx.contact?.name?.trim() || '—';
}

function quantityOf(tx: Transaction): number | null {
  const raw = tx.meta?.unit_breakdown?.quantity;
  const qty = Number(raw);
  return Number.isFinite(qty) && qty > 0 ? qty : null;
}

/**
 * Bangun satu holding terkonsolidasi untuk satu item katalog.
 *
 * Transaksi diproses kronologis karena average cost bersifat path-dependent:
 * cost basis yang dilepas saat jual bergantung pada rata-rata SAAT ITU.
 */
function buildHolding(item: CatalogItem, txs: Transaction[]): AssetHolding {
  const lotSize = Number(item.asset_lot_size) || 1;
  const lastPrice = Number(item.default_price) || 0;

  const ordered = [...txs].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (a.created_at ?? '') < (b.created_at ?? '') ? -1 : 1;
  });

  // Running state per kustodian — jual mengurangi cost basis broker yang sama.
  const running = new Map<string, { quantity: number; costBasis: number; realizedPl: number }>();
  const events: AssetEvent[] = [];
  let hasUnknownQuantity = false;

  for (const tx of ordered) {
    const custodian = custodianOf(tx);
    const state = running.get(custodian) ?? { quantity: 0, costBasis: 0, realizedPl: 0 };

    const costBasisDelta = positionDeltaOf(tx);
    const realizedPl = realizedPlOf(tx);
    const eventType = classifyEvent(costBasisDelta, realizedPl);
    const avgCostBefore = state.quantity > 0 ? state.costBasis / state.quantity : 0;

    let quantity = quantityOf(tx) ?? 0;
    let quantityDerived = false;

    if (eventType === 'buy') {
      if (quantityOf(tx) === null) {
        // Cost basis tetap benar, tapi kuantitas tidak diketahui → avg cost
        // tidak bisa dipertanggungjawabkan. Ditandai, bukan ditebak.
        hasUnknownQuantity = true;
      }
      state.quantity += quantity;
      state.costBasis += costBasisDelta;
    } else if (eventType === 'sell') {
      const costRemoved = -costBasisDelta;
      if (quantityOf(tx) === null) {
        // Turunkan dari metode average cost itu sendiri: qty = cost yang
        // dilepas / rata-rata saat itu. Eksak, tidak menebak dari teks.
        quantity = avgCostBefore > 0 ? costRemoved / avgCostBefore : 0;
        quantityDerived = true;
      }
      // Jual yang melepas seluruh cost basis = menutup posisi; hindari sisa
      // kuantitas hantu akibat pembulatan.
      if (Math.abs(costRemoved - state.costBasis) < EPSILON) {
        quantity = state.quantity;
      }
      state.quantity = Math.max(0, state.quantity - quantity);
      state.costBasis = Math.max(0, state.costBasis - costRemoved);
      state.realizedPl += realizedPl;
    } else if (eventType === 'dividend') {
      state.realizedPl += realizedPl;
    } else {
      state.costBasis += costBasisDelta;
    }

    running.set(custodian, state);
    events.push({
      transactionId: tx.id,
      transactionNumber: tx.transaction_number,
      date: tx.date,
      custodian,
      eventType,
      description: tx.description ?? '',
      quantity,
      quantityDerived,
      costBasisDelta,
      amount: Number(tx.amount) || 0,
      realizedPl: eventType === 'sell' || eventType === 'dividend' ? realizedPl : 0,
      avgCostBefore,
      status: tx.status,
    });
  }

  const positions: AssetPosition[] = [...running.entries()]
    .map(([custodian, s]) => ({
      custodian,
      quantity: s.quantity,
      costBasis: s.costBasis,
      avgCost: s.quantity > 0 ? s.costBasis / s.quantity : 0,
      realizedPl: s.realizedPl,
    }))
    .filter((p) => p.quantity > EPSILON || Math.abs(p.costBasis) > EPSILON || Math.abs(p.realizedPl) > EPSILON)
    .sort((a, b) => b.costBasis - a.costBasis);

  const totalQuantity = positions.reduce((s, p) => s + p.quantity, 0);
  const totalCostBasis = positions.reduce((s, p) => s + p.costBasis, 0);
  const realizedPl = positions.reduce((s, p) => s + p.realizedPl, 0);

  const avgCost = totalQuantity > 0 ? totalCostBasis / totalQuantity : 0;
  const avgCostPerPriceUnit = lotSize > 0 ? avgCost / lotSize : 0;
  const marketValue = totalQuantity * lotSize * lastPrice;
  // Tanpa harga pasar, unrealized P/L tidak bermakna — jangan laporkan −100%.
  const unrealizedPl = lastPrice > 0 ? marketValue - totalCostBasis : 0;

  return {
    itemId: item.id,
    symbol: item.name,
    assetClass: item.asset_class as AssetClass,
    priceUnit: item.unit?.trim() || '',
    lotSize,
    lastPrice,
    lastPriceUpdatedAt: item.asset_price_updated_at ?? null,
    positions,
    events: events.reverse(), // terbaru dulu untuk tampilan riwayat
    totalQuantity,
    totalCostBasis,
    avgCost,
    avgCostPerPriceUnit,
    marketValue: lastPrice > 0 ? marketValue : 0,
    unrealizedPl,
    unrealizedPlPct: totalCostBasis > 0 && lastPrice > 0 ? (unrealizedPl / totalCostBasis) * 100 : 0,
    realizedPl,
    hasUnknownQuantity,
  };
}

/**
 * Bangun seluruh holding untuk satu bisnis.
 *
 * `transactions` boleh berisi seluruh transaksi bisnis — yang tidak tertaut ke
 * item ber-asset_class akan diabaikan. Hanya transaksi `posted` yang dihitung,
 * konsisten dengan aturan laporan keuangan (draft tidak masuk laporan).
 */
export function buildAssetHoldings(
  catalogItems: CatalogItem[],
  transactions: Transaction[]
): AssetHolding[] {
  const assetItems = catalogItems.filter((i) => i.asset_class && !i.deleted_at);
  if (assetItems.length === 0) return [];

  const byItem = new Map<string, Transaction[]>();
  for (const item of assetItems) byItem.set(item.id, []);

  for (const tx of transactions) {
    if (tx.deleted_at) continue;
    if (tx.status !== 'posted') continue;
    const itemId = tx.meta?.catalog_item?.id;
    if (!itemId) continue;
    const bucket = byItem.get(itemId);
    if (bucket) bucket.push(tx);
  }

  return assetItems
    .map((item) => buildHolding(item, byItem.get(item.id) ?? []))
    .sort((a, b) => b.marketValue - a.marketValue || b.totalCostBasis - a.totalCostBasis);
}

export function summarizeHoldings(holdings: AssetHolding[]): AssetConsoleSummary {
  const totalInvested = holdings.reduce((s, h) => s + h.totalCostBasis, 0);
  const totalMarketValue = holdings.reduce((s, h) => s + h.marketValue, 0);
  const totalUnrealizedPl = holdings.reduce((s, h) => s + h.unrealizedPl, 0);
  const totalRealizedPl = holdings.reduce((s, h) => s + h.realizedPl, 0);

  return {
    totalInvested,
    totalMarketValue,
    totalUnrealizedPl,
    totalUnrealizedPlPct: totalInvested > 0 ? (totalUnrealizedPl / totalInvested) * 100 : 0,
    totalRealizedPl,
    openInstrumentCount: holdings.filter((h) => h.totalQuantity > EPSILON).length,
    missingPriceCount: holdings.filter((h) => h.totalQuantity > EPSILON && h.lastPrice <= 0).length,
  };
}
