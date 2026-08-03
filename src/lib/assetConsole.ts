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

/**
 * Bersihkan noise pada kuantitas yang DITURUNKAN dari pembagian
 * (costRemoved / avgCostBefore). avgCostBefore sendiri sudah dibulatkan ke sen
 * (mis. 578.310,25), sehingga hasil bagi bisa meleset ke digit ke-6/7 —
 * 3.0000004322939113 alih-alih 3 — jauh lebih besar dari presisi biner biasa
 * (~1e-15).
 *
 * "Snap to nearest integer" dengan toleransi RELATIF (bukan absolut): saham
 * hampir selalu bertransaksi dalam lot bulat, jadi selisih kecil ke bilangan
 * bulat adalah noise pembulatan rupiah. Tapi kripto sah bertransaksi dalam
 * pecahan kecil (0,0001 BTC bisa senilai jutaan rupiah) — toleransi absolut
 * akan salah membulatkan itu ke 0. Toleransi 1e-6 relatif terhadap kuantitas
 * itu sendiri aman untuk kedua kasus: cukup longgar untuk noise pembagian
 * rupiah, cukup ketat untuk tidak mengganggu pecahan kripto yang wajar.
 */
function roundQty(qty: number): number {
  const nearestInt = Math.round(qty);
  const tolerance = Math.max(Math.abs(nearestInt), 1) * 1e-6;
  if (nearestInt !== 0 && Math.abs(qty - nearestInt) < tolerance) return nearestInt;
  return Math.round(qty * 1e8) / 1e8;
}

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

  /**
   * Nilai pasar/valuasi tersedia, sehingga marketValue & unrealizedPl bermakna.
   *
   * Bukan sekadar `lastPrice > 0`: untuk kelas 'venture' valuasi datang dari
   * total ekuitas bisnis target, yang SAH bernilai nol atau negatif (bisnis
   * rugi melebihi modal disetor). Memakai `lastPrice > 0` akan menyembunyikan
   * justru kasus yang paling perlu dilihat pemilik.
   */
  hasLivePrice: boolean;

  /** Hanya untuk kelas 'venture' — konteks bisnis & akun ekuitas yang ditaut. */
  venture?: VentureLink;
}

/** Identitas tautan venture, untuk ditampilkan & untuk aksi putus-tautan. */
export interface VentureLink {
  businessId: string;
  businessName: string;
  stockAccountId: string;
  ownerAccountName: string;
  /** Total ekuitas bisnis target (valuasi 100%). */
  totalEquity: number;
  /**
   * Hak laba (`accounts.profit_share_pct`), 0–100 — SENGAJA dipisah dari
   * `totalQuantity` (% modal). Keduanya hak ekonomi yang berbeda: % modal
   * adalah klaim atas aset bersih (kalau bisnis dilikuidasi hari ini), hak
   * laba adalah klaim atas profit periode. Data nyata memang bisa jauh
   * berbeda — Imam pegang 2,65% modal Hillside tapi hak dividennya 50%.
   * Nilai pasar tetap memakai % modal; angka ini murni informasi.
   */
  dividendSharePct: number;
  /** True bila profit_share_pct di-set eksplisit, bukan fallback ke % modal. */
  dividendShareIsExplicit: boolean;
  /** Akumulasi dividen yang benar-benar sudah diterima (sepanjang waktu). */
  dividendsReceived: number;
  /** Buku besar target tidak terbaca (mis. user keluar dari bisnis itu). */
  unresolved: boolean;
}

/**
 * Potret posisi ekuitas pemilik di bisnis lain — dihitung di layer API dari
 * buku besar bisnis TARGET (calculateCapTable + calculateBalanceSheet), lalu
 * disuntikkan ke sini. Engine ini sengaja tidak melakukan I/O sendiri supaya
 * tetap murni & mudah diuji.
 */
export interface VentureSnapshot {
  /** catalog_items.id baris venture-nya. */
  itemId: string;
  businessId: string;
  businessName: string;
  stockAccountId: string;
  ownerAccountName: string;
  /** Net credit akun EQUITY is_stock milik user = modal yang disetor. */
  contributed: number;
  /** Persentase kepemilikan dari cap table, 0–100. */
  ownershipPct: number;
  /** Total ekuitas bisnis target = valuasi 100% (proxy book value, Fase 1). */
  totalEquity: number;
  /** Hak laba dari `accounts.profit_share_pct`, 0–100. Lihat VentureLink. */
  dividendSharePct: number;
  /** True bila profit_share_pct eksplisit, bukan fallback ke % modal. */
  dividendShareIsExplicit: boolean;
  /** Akumulasi dividen yang sudah benar-benar diterima (sepanjang waktu). */
  dividendsReceived: number;
  /**
   * Transaksi di buku besar bisnis target yang MEMBENTUK angka di atas —
   * setoran/penarikan modal (yang menyusun `contributed`) dan dividen (yang
   * menyusun `dividendsReceived`). Terurut kronologis (lama → baru).
   */
  events: VentureLedgerEvent[];
  /** Data bisnis target gagal dibaca — jangan tampilkan angka nol yang menyesatkan. */
  unresolved: boolean;
}

/**
 * Satu mutasi di buku besar bisnis target yang menyentuh posisi pemilik ini.
 *
 * `kind` sengaja dipisah dari AssetEventType karena artinya berbeda: 'capital'
 * menambah/mengurangi modal disetor (cost basis), 'dividend' adalah distribusi
 * laba yang TIDAK menyentuh cost basis.
 */
export interface VentureLedgerEvent {
  transactionId: string;
  transactionNumber?: string | null;
  date: string;
  description: string;
  kind: 'capital' | 'dividend';
  /**
   * Perubahan modal disetor: positif = setoran, negatif = penarikan/prive.
   * Untuk 'dividend' selalu 0 — dividen tidak mengurangi modal disetor.
   */
  capitalDelta: number;
  /** Dividen yang diterima pemilik pada transaksi ini. 0 untuk 'capital'. */
  dividendAmount: number;
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
        // Fallback 1, BUKAN 0: aset seperti properti/emas lazim dibeli sekali
        // tanpa user pernah mengisi field "kuantitas" (orang tidak menulis
        // "1 unit" saat beli 1 apartemen). Tanpa fallback ini, cost basis
        // tetap terhitung tapi quantity=0 membuat posisi terlihat "tertutup"
        // dan custodian-nya hilang dari tampilan (positions.filter qty>0) —
        // padahal secara akuntansi posisinya jelas terbuka. Saham tetap wajib
        // isi kuantitas eksplisit (hasUnknownQuantity di atas tetap
        // memperingatkan avg cost tidak presisi bila fallback ini terpakai).
        quantity = 1;
      }
      // Dibulatkan di titik akumulasi (bukan hanya saat derive di 'sell') —
      // noise floating-point menumpuk lewat rantai +=/-= antar-transaksi
      // berurutan, tidak cukup dibersihkan sekali di satu titik pembagian.
      state.quantity = roundQty(state.quantity + quantity);
      state.costBasis += costBasisDelta;
    } else if (eventType === 'sell') {
      const costRemoved = -costBasisDelta;
      if (quantityOf(tx) === null) {
        // Turunkan dari metode average cost itu sendiri: qty = cost yang
        // dilepas / rata-rata saat itu. Eksak, tidak menebak dari teks.
        quantity = avgCostBefore > 0 ? roundQty(costRemoved / avgCostBefore) : 0;
        quantityDerived = true;
      }
      // Jual yang melepas seluruh cost basis = menutup posisi; hindari sisa
      // kuantitas hantu akibat pembulatan.
      if (Math.abs(costRemoved - state.costBasis) < EPSILON) {
        quantity = state.quantity;
      }
      state.quantity = roundQty(Math.max(0, state.quantity - quantity));
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

  const totalCostBasis = positions.reduce((s, p) => s + p.costBasis, 0);
  const realizedPl = positions.reduce((s, p) => s + p.realizedPl, 0);

  // Crypto SEMENTARA canon dari catalog, bukan SUM(transaksi): transaksi
  // crypto riil selalu pecahan mikro (mis. 0,00302599 BTC — 1 coin ~Rp1,1M),
  // dan mengagregasi unit_breakdown antar-transaksi rawan salah/data
  // eksperimen ("beli 3 Coin @1jt" — jelas bukan harga BTC riil) bocor jadi
  // Balance yang tidak masuk akal. asset_lot_size dipakai sebagai OVERRIDE
  // total unit yang dipegang (bukan rasio konversi seperti pada stock — 1
  // lot saham = 100 lembar), diisi manual di form Katalog. Cost basis & avg
  // cost TETAP dari transaksi seperti biasa, hanya Unit-nya yang diganti.
  const isCryptoUnitOverride = item.asset_class === 'crypto';
  const positionQuantity = positions.reduce((s, p) => s + p.quantity, 0);
  const totalQuantity = isCryptoUnitOverride ? lotSize : positionQuantity;
  // Saat override aktif, lotSize sudah MENJADI unit itu sendiri — tidak boleh
  // dikalikan lagi ke market value / avg-per-harga (beda dari stock, di mana
  // lotSize tetap rasio lembar-per-lot yang harus dikalikan).
  const effectiveLotSize = isCryptoUnitOverride ? 1 : lotSize;

  const avgCost = totalQuantity > 0 ? totalCostBasis / totalQuantity : 0;
  const avgCostPerPriceUnit = effectiveLotSize > 0 ? avgCost / effectiveLotSize : 0;
  const marketValue = totalQuantity * effectiveLotSize * lastPrice;
  // Tanpa harga pasar, unrealized P/L tidak bermakna — jangan laporkan −100%.
  const unrealizedPl = lastPrice > 0 ? marketValue - totalCostBasis : 0;

  return {
    itemId: item.id,
    symbol: item.name,
    assetClass: item.asset_class as AssetClass,
    priceUnit: item.unit?.trim() || '',
    lotSize: effectiveLotSize,
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
    hasLivePrice: lastPrice > 0,
  };
}

/**
 * Label kustodian untuk venture: "Self Custody · {nama pemilik}".
 *
 * Berbeda dari kelas lain, tidak ada pihak ketiga yang menyimpan posisi ini —
 * stake dipegang langsung atas nama pemilik di buku besar bisnis target.
 * Menyebutnya "Self Custody" membuat kolom Kustodian tetap bermakna sama di
 * semua kelas (siapa yang memegang aset), sementara nama pemilik menjawab
 * "atas nama siapa".
 */
function custodianOfVenture(snapshot: VentureSnapshot | undefined): string {
  const owner = snapshot?.ownerAccountName?.trim();
  return owner ? `Self Custody · ${owner}` : 'Self Custody';
}

/**
 * Petakan mutasi buku besar bisnis target ke bentuk AssetEvent yang dipakai
 * tabel riwayat.
 *
 * Pemetaan tipe peristiwa:
 *   setoran modal (capitalDelta > 0) → 'buy'   (menambah cost basis)
 *   penarikan/prive (capitalDelta<0) → 'sell'  (mengurangi cost basis)
 *   dividen                          → 'dividend'
 *
 * Kuantitas dibiarkan 0: satuan venture adalah PERSEN kepemilikan, dan persen
 * pada saat sebuah setoran terjadi tidak bisa diturunkan dari transaksi itu
 * sendiri (bergantung pada total modal seluruh pemilik pada saat itu, yang
 * berubah tiap ada setoran pemilik lain). Menampilkan '—' jujur; menghitung
 * angka yang tidak bisa dipertanggungjawabkan tidak.
 *
 * `realizedPl` juga 0 — lihat catatan di buildVentureHolding: dividen adalah
 * income, bukan capital gain, dan sudah dilaporkan lewat kolom Jumlah + KPI
 * "Dividen Diterima".
 */
function mapVentureEvents(events: VentureLedgerEvent[], custodian: string): AssetEvent[] {
  return events
    .map<AssetEvent>((e) => ({
      transactionId: e.transactionId,
      transactionNumber: e.transactionNumber,
      date: e.date,
      custodian,
      eventType: e.kind === 'dividend' ? 'dividend' : e.capitalDelta >= 0 ? 'buy' : 'sell',
      description: e.description,
      quantity: 0,
      quantityDerived: false,
      costBasisDelta: e.capitalDelta,
      amount: e.kind === 'dividend' ? e.dividendAmount : Math.abs(e.capitalDelta),
      realizedPl: 0,
      avgCostBefore: 0,
      status: 'posted',
    }))
    .reverse(); // terbaru dulu, konsisten dengan kelas aset lain
}

/**
 * Bangun holding kelas 'venture' — kepemilikan pemilik di bisnis LAIN.
 *
 * Berbeda dari kelas lain, tidak ada satu pun transaksi di bisnis pemantau yang
 * dibaca: seluruh angka berasal dari buku besar bisnis target lewat
 * `VentureSnapshot`. Pemetaannya ke bentuk holding yang sama:
 *
 *   kuantitas       → persen kepemilikan (2,65)
 *   satuan harga    → '%'
 *   harga terakhir  → valuasi per 1% = totalEquity / 100
 *   cost basis      → modal disetor pemilik di akun ekuitasnya
 *
 * Pemetaan itu bukan kosmetik: dengan lastPrice = totalEquity/100, identitas
 * `kuantitas × harga = nilai pasar` yang dipakai seluruh tabel tetap berlaku
 * apa adanya (2,65 × equity/100 = 2,65% × equity), jadi tidak ada cabang
 * kalkulasi khusus yang bisa melenceng dari kelas lain.
 *
 * Realized P/L sengaja 0 dan dividen TIDAK dimasukkan ke sana. Realized P/L
 * bermakna capital gain saat posisi dilepas (proceeds − cost basis), sedangkan
 * dividen adalah income — dua hal berbeda yang kalau digabung membuat angkanya
 * ambigu. Untuk venture bedanya bahkan struktural: stake tidak bisa "dijual"
 * lewat Asset Console (ini tautan, bukan posisi yang ditransaksikan), jadi
 * capital gain memang selalu 0 sampai kepemilikan benar-benar dilepas.
 * Dividen yang sudah diterima dilaporkan terpisah lewat `venture.dividendsReceived`.
 *
 * Riwayat transaksi TETAP ditampilkan meski tidak ada transaksi di bisnis
 * pemantau: `snapshot.events` memuat mutasi di buku besar bisnis TARGET yang
 * membentuk KPI di halaman ini — setoran/penarikan modal (sumber Total
 * Invested) dan dividen (sumber Dividen Diterima). Tanpa ini, angka KPI tidak
 * bisa ditelusuri ke satu pun peristiwa.
 */
function buildVentureHolding(item: CatalogItem, snapshot: VentureSnapshot | undefined): AssetHolding {
  const resolved = snapshot !== undefined && !snapshot.unresolved;
  const ownershipPct = resolved ? snapshot.ownershipPct : 0;
  const contributed = resolved ? snapshot.contributed : 0;
  const totalEquity = resolved ? snapshot.totalEquity : 0;

  const valuationPerPct = totalEquity / 100;
  const marketValue = (ownershipPct / 100) * totalEquity;
  const unrealizedPl = resolved ? marketValue - contributed : 0;

  // Venture tidak dititipkan ke broker/exchange mana pun — stake-nya dipegang
  // langsung atas nama pemilik di bisnis target. "Self Custody" menyatakan itu
  // eksplisit alih-alih memakai nama bisnis, yang sudah jadi judul halaman.
  const custodian = custodianOfVenture(snapshot);

  return {
    itemId: item.id,
    symbol: snapshot?.businessName || item.name,
    assetClass: 'venture',
    priceUnit: '%',
    lotSize: 1,
    lastPrice: valuationPerPct,
    lastPriceUpdatedAt: null, // valuasi selalu live dari neraca, bukan input manual
    positions: resolved
      ? [
          {
            custodian,
            quantity: ownershipPct,
            costBasis: contributed,
            avgCost: ownershipPct > 0 ? contributed / ownershipPct : 0,
            realizedPl: 0,
          },
        ]
      : [],
    events: mapVentureEvents(snapshot?.events ?? [], custodian),
    totalQuantity: ownershipPct,
    totalCostBasis: contributed,
    avgCost: ownershipPct > 0 ? contributed / ownershipPct : 0,
    avgCostPerPriceUnit: ownershipPct > 0 ? contributed / ownershipPct : 0,
    marketValue: resolved ? marketValue : 0,
    unrealizedPl,
    unrealizedPlPct: resolved && contributed > 0 ? (unrealizedPl / contributed) * 100 : 0,
    realizedPl: 0,
    hasUnknownQuantity: false,
    hasLivePrice: resolved,
    venture: {
      businessId: snapshot?.businessId ?? item.linked_business_id ?? '',
      businessName: snapshot?.businessName ?? item.name,
      stockAccountId: snapshot?.stockAccountId ?? item.linked_stock_account_id ?? '',
      ownerAccountName: snapshot?.ownerAccountName ?? '',
      totalEquity,
      dividendSharePct: resolved ? snapshot.dividendSharePct : 0,
      dividendShareIsExplicit: resolved ? snapshot.dividendShareIsExplicit : false,
      dividendsReceived: resolved ? snapshot.dividendsReceived : 0,
      unresolved: !resolved,
    },
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
  transactions: Transaction[],
  ventureSnapshots: VentureSnapshot[] = []
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

  const snapshotByItem = new Map(ventureSnapshots.map((s) => [s.itemId, s]));

  return assetItems
    .map((item) =>
      item.asset_class === 'venture'
        ? buildVentureHolding(item, snapshotByItem.get(item.id))
        : buildHolding(item, byItem.get(item.id) ?? [])
    )
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
    missingPriceCount: holdings.filter((h) => h.totalQuantity > EPSILON && !h.hasLivePrice).length,
  };
}
