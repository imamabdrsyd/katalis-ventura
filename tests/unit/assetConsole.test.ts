import { describe, it, expect } from 'vitest';
import { buildAssetHoldings, summarizeHoldings, type VentureSnapshot } from '@/lib/assetConsole';
import type { Account, CatalogItem, Transaction } from '@/types';

/**
 * Fixture direplika dari data nyata bisnis "AXION Finance" (Supabase, Agt 2026)
 * supaya angka acceptance criteria bisa dicek langsung: BMRI 3 lot lintas dua
 * broker dengan avg cost Rp 4.186,13/lembar, dan BBCA yang tersisa 1 lot
 * setelah dua kali jual @3 lot.
 */

function account(over: Partial<Account> & Pick<Account, 'account_code' | 'account_name' | 'account_type'>): Account {
  return {
    id: `acc-${over.account_code}`,
    business_id: 'biz',
    parent_account_id: null,
    normal_balance: over.account_type === 'ASSET' || over.account_type === 'EXPENSE' ? 'DEBIT' : 'CREDIT',
    is_active: true,
    is_system: false,
    sort_order: 0,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...over,
  } as Account;
}

const BANK = account({ account_code: '1200', account_name: 'Bank', account_type: 'ASSET', is_cash_equivalent: true });
const INVENTORY = account({ account_code: '1300', account_name: 'Inventory', account_type: 'ASSET', default_category: 'VAR' });
const CAPITAL = account({ account_code: '3100', account_name: "Owner's Capital", account_type: 'EQUITY' });
const REVENUE = account({ account_code: '4100', account_name: 'Sales Revenue', account_type: 'REVENUE' });

let seq = 0;
const nextId = () => `tx-${++seq}`;

/** Transaksi BELI: legacy double-entry Dr Persediaan / Cr Kas-atau-Modal. */
function buy(item: CatalogItem, custodian: string, date: string, qtyLots: number, amount: number, credit = BANK): Transaction {
  return {
    id: nextId(),
    business_id: 'biz',
    date,
    created_at: `${date}T00:00:00Z`,
    updated_at: `${date}T00:00:00Z`,
    created_by: 'u',
    category: 'VAR',
    name: custodian,
    description: `Beli ${qtyLots} lot ${item.name}`,
    amount,
    account: '',
    status: 'posted',
    is_double_entry: true,
    debit_account_id: INVENTORY.id,
    credit_account_id: credit.id,
    debit_account: INVENTORY,
    credit_account: credit,
    meta: {
      catalog_item: { id: item.id, name: item.name },
      unit_breakdown: { unit: `Lot ${item.name}`, quantity: qtyLots, price_per_unit: amount / qtyLots },
    },
  } as Transaction;
}

/** Transaksi JUAL multi-line: Dr Bank / Cr Persediaan (cost) / Cr Pendapatan (gain). */
function sell(
  item: CatalogItem,
  custodian: string,
  date: string,
  proceeds: number,
  costRemoved: number,
  opts: { qtyLots?: number } = {}
): Transaction {
  const gain = proceeds - costRemoved;
  return {
    id: nextId(),
    business_id: 'biz',
    date,
    created_at: `${date}T00:00:00Z`,
    updated_at: `${date}T00:00:00Z`,
    created_by: 'u',
    category: 'EARN',
    name: custodian,
    description: `Jual ${item.name}`,
    amount: proceeds,
    account: '',
    status: 'posted',
    is_multi_line: true,
    meta: {
      catalog_item: { id: item.id, name: item.name },
      ...(opts.qtyLots ? { unit_breakdown: { unit: `Lot ${item.name}`, quantity: opts.qtyLots, price_per_unit: proceeds / opts.qtyLots } } : {}),
    },
    journal_lines: [
      { id: 'l1', transaction_id: 'x', account_id: BANK.id, debit_amount: proceeds, credit_amount: 0, sort_order: 0, created_at: date, account: BANK },
      { id: 'l2', transaction_id: 'x', account_id: INVENTORY.id, debit_amount: 0, credit_amount: costRemoved, sort_order: 1, created_at: date, account: INVENTORY },
      { id: 'l3', transaction_id: 'x', account_id: REVENUE.id, debit_amount: 0, credit_amount: gain, sort_order: 2, created_at: date, account: REVENUE },
    ],
  } as Transaction;
}

function instrument(name: string, over: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: `item-${name}`,
    business_id: 'biz',
    name,
    item_type: 'product',
    default_price: 0,
    unit: 'Lembar',
    asset_class: 'stock',
    asset_lot_size: 100,
    is_active: true,
    sort_order: 0,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...over,
  } as CatalogItem;
}

describe('buildAssetHoldings — konsolidasi lintas broker', () => {
  it('menggabungkan BMRI dari Sinarmas + Stockbit jadi 3 lot @ Rp4.186,13/lembar', () => {
    seq = 0;
    const bmri = instrument('BMRI', { default_price: 4270 });
    const holdings = buildAssetHoldings(
      [bmri],
      [
        buy(bmri, 'Sinarmas Sekuritas', '2026-07-16', 1, 427_599),
        buy(bmri, 'Stockbit Sekuritas', '2026-07-24', 1, 417_625, CAPITAL),
        buy(bmri, 'Stockbit Sekuritas', '2026-07-29', 1, 410_615, CAPITAL),
      ]
    );

    expect(holdings).toHaveLength(1);
    const h = holdings[0];

    // Inti fitur: tak satu pun aplikasi broker tahu angka gabungan ini.
    expect(h.totalQuantity).toBe(3);
    expect(h.totalCostBasis).toBe(1_255_839);
    expect(h.avgCostPerPriceUnit).toBeCloseTo(4186.13, 2);

    // Dua posisi terpisah per kustodian, seperti kenyataannya di broker.
    expect(h.positions).toHaveLength(2);
    const stockbit = h.positions.find((p) => p.custodian === 'Stockbit Sekuritas')!;
    expect(stockbit.quantity).toBe(2);
    // Cocok dengan yang ditampilkan aplikasi Stockbit: Avg Price 4.141,2
    expect(stockbit.avgCost / h.lotSize).toBeCloseTo(4141.2, 1);

    const sinarmas = h.positions.find((p) => p.custodian === 'Sinarmas Sekuritas')!;
    expect(sinarmas.quantity).toBe(1);

    // Market value & unrealized pakai harga per lembar × lot size.
    expect(h.marketValue).toBe(3 * 100 * 4270);
    expect(h.unrealizedPl).toBeCloseTo(1_281_000 - 1_255_839, 2);
    expect(h.hasUnknownQuantity).toBe(false);
  });
});

describe('buildAssetHoldings — average cost saat jual', () => {
  it('mengurangi posisi & mencatat realized gain (kuantitas jual dari meta)', () => {
    seq = 0;
    const bbca = instrument('BBCA');
    const holdings = buildAssetHoldings(
      [bbca],
      [
        buy(bbca, 'Sinarmas Sekuritas', '2026-05-29', 1, 573_303, CAPITAL),
        buy(bbca, 'Sinarmas Sekuritas', '2026-05-29', 1, 576_439, CAPITAL),
        buy(bbca, 'Sinarmas Sekuritas', '2026-06-04', 1, 548_268, CAPITAL),
        sell(bbca, 'Sinarmas Sekuritas', '2026-06-15', 1_870_494, 1_698_010, { qtyLots: 3 }),
      ]
    );

    const h = holdings[0];
    expect(h.totalQuantity).toBe(0);
    expect(h.totalCostBasis).toBe(0);
    expect(h.realizedPl).toBe(172_484);
  });

  it('menurunkan kuantitas jual dari cost basis saat meta tidak mencatatnya', () => {
    seq = 0;
    const bbca = instrument('BBCA');
    const holdings = buildAssetHoldings(
      [bbca],
      [
        // 4 lot @ 578.310,25/lot
        buy(bbca, 'Sinarmas Sekuritas', '2026-06-30', 4, 2_313_241),
        // Jual 3 lot tanpa unit_breakdown — harus terhitung 3, bukan 0.
        sell(bbca, 'Sinarmas Sekuritas', '2026-07-20', 1_954_686, 1_734_931),
      ]
    );

    const h = holdings[0];
    const sellEvent = h.events.find((e) => e.eventType === 'sell')!;
    expect(sellEvent.quantityDerived).toBe(true);
    expect(sellEvent.quantity).toBeCloseTo(3, 6);

    // Sisa persis 1 lot dengan cost basis pro-rata.
    expect(h.totalQuantity).toBeCloseTo(1, 6);
    expect(h.totalCostBasis).toBeCloseTo(578_310, 0);
    expect(h.realizedPl).toBe(219_755);
  });

  it('membulatkan noise floating-point pada kuantitas turunan (bug: 99,999957 Lembar)', () => {
    // Reproduksi bug nyata: BBCA sisa 1 lot setelah dua kali jual berturut-turut
    // tanpa unit_breakdown. Pembagian costRemoved/avgCostBefore berantai
    // menghasilkan noise biner (0.9999999999999999...) yang lolos ke UI
    // sebagai "99,999957 Lembar" alih-alih "1 Lembar" bersih.
    seq = 0;
    const bbca = instrument('BBCA');
    const holdings = buildAssetHoldings(
      [bbca],
      [
        buy(bbca, 'Sinarmas Sekuritas', '2026-05-29', 1, 573_303),
        buy(bbca, 'Sinarmas Sekuritas', '2026-05-29', 1, 576_439),
        buy(bbca, 'Sinarmas Sekuritas', '2026-06-04', 1, 548_268),
        sell(bbca, 'Sinarmas Sekuritas', '2026-06-15', 1_870_494, 1_698_010),
        buy(bbca, 'Sinarmas Sekuritas', '2026-06-30', 4, 2_313_241),
        sell(bbca, 'Sinarmas Sekuritas', '2026-07-20', 1_954_686, 1_734_931),
      ]
    );

    const h = holdings[0];
    // Harus persis 1, bukan 0.999999... — exact equality, bukan toBeCloseTo,
    // supaya regresi noise floating-point tertangkap.
    expect(h.totalQuantity).toBe(1);
    expect(h.totalQuantity * h.lotSize).toBe(100);
  });

  it('jual yang melepas seluruh cost basis menutup posisi tanpa sisa hantu', () => {
    seq = 0;
    const gold = instrument('Emas Antam', { asset_class: 'gold', asset_lot_size: 1, unit: 'gram', default_price: 1_500_000 });
    const holdings = buildAssetHoldings(
      [gold],
      [
        buy(gold, 'Pegadaian', '2026-01-10', 3, 3_999_999),
        sell(gold, 'Pegadaian', '2026-02-10', 4_500_000, 3_999_999),
      ]
    );
    expect(holdings[0].totalQuantity).toBe(0);
    expect(holdings[0].totalCostBasis).toBe(0);
  });
});

describe('buildAssetHoldings — klasifikasi & penjagaan', () => {
  it('mengabaikan item katalog tanpa asset_class dan transaksi draft', () => {
    seq = 0;
    const bmri = instrument('BMRI', { default_price: 4270 });
    const motor = instrument('Yamaha NMAX', { asset_class: null, asset_lot_size: 1 });

    const draft = buy(bmri, 'Sinarmas Sekuritas', '2026-07-16', 1, 427_599);
    (draft as Transaction).status = 'draft';

    const holdings = buildAssetHoldings(
      [bmri, motor],
      [draft, buy(motor, 'Dealer', '2026-03-01', 1, 20_000_000)]
    );

    // Motor tidak ikut; BMRI ada tapi kosong karena satu-satunya transaksi draft.
    expect(holdings.map((h) => h.symbol)).toEqual(['BMRI']);
    expect(holdings[0].totalQuantity).toBe(0);
  });

  it('mencatat dividen sebagai realized P/L tanpa mengubah posisi', () => {
    seq = 0;
    const bmri = instrument('BMRI', { default_price: 4270 });
    const dividend: Transaction = {
      ...buy(bmri, 'Sinarmas Sekuritas', '2026-08-01', 1, 0),
      id: 'tx-div',
      category: 'EARN',
      amount: 50_000,
      is_multi_line: true,
      debit_account: undefined,
      credit_account: undefined,
      meta: { catalog_item: { id: bmri.id, name: bmri.name } },
      journal_lines: [
        { id: 'd1', transaction_id: 'x', account_id: BANK.id, debit_amount: 50_000, credit_amount: 0, sort_order: 0, created_at: '2026-08-01', account: BANK },
        { id: 'd2', transaction_id: 'x', account_id: REVENUE.id, debit_amount: 0, credit_amount: 50_000, sort_order: 1, created_at: '2026-08-01', account: REVENUE },
      ],
    } as Transaction;

    const holdings = buildAssetHoldings(
      [bmri],
      [buy(bmri, 'Sinarmas Sekuritas', '2026-07-16', 1, 427_599), dividend]
    );

    const h = holdings[0];
    expect(h.totalQuantity).toBe(1);
    expect(h.totalCostBasis).toBe(427_599);
    expect(h.realizedPl).toBe(50_000);
    expect(h.events.some((e) => e.eventType === 'dividend')).toBe(true);
  });

  it('menandai hasUnknownQuantity saat transaksi beli tak mencatat kuantitas, tapi tetap dianggap 1 unit (bukan 0)', () => {
    // Reproduksi bug nyata: beli "Studio Apartment" (asset_class='property')
    // tanpa mengisi field kuantitas transaksi sama sekali. Sebelum fix,
    // quantity jatuh ke 0 — cost basis kehitung tapi posisi terlihat
    // "tertutup" dan baris kustodian hilang dari tabel konsolidasi (halaman
    // list memfilter positions ke quantity > 0). Properti/emas lazim dibeli
    // sekali tanpa pernah mengisi "1 unit", jadi fallback-nya harus 1.
    // Pakai asset_class='gold' (bukan 'crypto') di sini karena crypto sejak
    // fix berikutnya punya jalur totalQuantity yang sepenuhnya berbeda
    // (override dari catalog, lihat describe block di bawah).
    seq = 0;
    const gold = instrument('Emas Batangan', { asset_class: 'gold', asset_lot_size: 1, unit: 'gram' });
    const tx = buy(gold, 'Pegadaian', '2026-04-01', 1, 900_000_000);
    tx.meta = { catalog_item: { id: gold.id, name: gold.name } };

    const holdings = buildAssetHoldings([gold], [tx]);
    expect(holdings[0].hasUnknownQuantity).toBe(true);
    expect(holdings[0].totalCostBasis).toBe(900_000_000);
    expect(holdings[0].totalQuantity).toBe(1);
    // Posisi tetap tampil dengan nama kustodiannya, tidak hilang.
    expect(holdings[0].positions).toHaveLength(1);
    expect(holdings[0].positions[0].custodian).toBe('Pegadaian');
    expect(holdings[0].positions[0].quantity).toBe(1);
  });

  it('properti dibeli sekali tanpa unit_breakdown tetap muncul dengan custodian (kasus nyata Studio Apartment)', () => {
    seq = 0;
    const property = instrument('Studio Apartment', {
      asset_class: 'property',
      asset_lot_size: 1,
      unit: null,
      default_price: 450_000_000,
    });
    const tx = buy(property, 'Ellys Taslim', '2024-07-31', 1, 350_000_000);
    tx.meta = { catalog_item: { id: property.id, name: property.name } }; // tanpa unit_breakdown

    const holdings = buildAssetHoldings([property], [tx]);
    const h = holdings[0];

    expect(h.totalQuantity).toBe(1);
    expect(h.totalCostBasis).toBe(350_000_000);
    expect(h.marketValue).toBe(450_000_000);
    expect(h.positions.map((p) => p.custodian)).toEqual(['Ellys Taslim']);
    expect(h.hasUnknownQuantity).toBe(true);
  });

  it('tidak melaporkan unrealized loss palsu saat harga pasar belum di-isi', () => {
    seq = 0;
    const bbca = instrument('BBCA', { default_price: 0 });
    const holdings = buildAssetHoldings([bbca], [buy(bbca, 'Sinarmas Sekuritas', '2026-06-30', 4, 2_313_241)]);

    expect(holdings[0].marketValue).toBe(0);
    expect(holdings[0].unrealizedPl).toBe(0);
    expect(holdings[0].unrealizedPlPct).toBe(0);
    expect(summarizeHoldings(holdings).missingPriceCount).toBe(1);
  });
});

describe('summarizeHoldings', () => {
  it('menjumlahkan seluruh instrumen untuk KPI', () => {
    seq = 0;
    const bmri = instrument('BMRI', { default_price: 4270 });
    const bbca = instrument('BBCA', { default_price: 6000 });

    const holdings = buildAssetHoldings(
      [bmri, bbca],
      [
        buy(bmri, 'Sinarmas Sekuritas', '2026-07-16', 1, 427_599),
        buy(bmri, 'Stockbit Sekuritas', '2026-07-24', 2, 828_240, CAPITAL),
        buy(bbca, 'Sinarmas Sekuritas', '2026-06-30', 4, 2_313_241),
        sell(bbca, 'Sinarmas Sekuritas', '2026-07-20', 1_954_686, 1_734_931),
      ]
    );

    const s = summarizeHoldings(holdings);
    expect(s.totalInvested).toBeCloseTo(427_599 + 828_240 + 578_310, 0);
    expect(s.totalRealizedPl).toBe(219_755);
    expect(s.openInstrumentCount).toBe(2);
    expect(s.totalUnrealizedPlPct).toBeCloseTo((s.totalUnrealizedPl / s.totalInvested) * 100, 6);
  });
});

describe('buildAssetHoldings — crypto: Unit di-canon dari catalog, bukan SUM(transaksi)', () => {
  // Reproduksi bug nyata: 1 BTC ≈ Rp1,1 miliar, jadi pembelian riil selalu
  // pecahan mikro (mis. 0,00302599 BTC). Transaksi eksperimen sempat ditulis
  // "beli 3 Coin @ Rp1.000.000" (jelas bukan harga pasar BTC) — kalau
  // totalQuantity diagregasi dari unit_breakdown transaksi seperti kelas
  // lain, kartu Unit akan menampilkan "3" yang tidak masuk akal. Untuk
  // sementara, crypto memakai catalog_items.asset_lot_size sebagai ANGKA
  // TOTAL unit yang dipegang (diisi manual di form Katalog), bukan rasio
  // konversi seperti pada stock (1 lot saham = 100 lembar).
  it('mengabaikan unit_breakdown transaksi dan memakai asset_lot_size sebagai Unit', () => {
    seq = 0;
    const btc = instrument('BTC', {
      asset_class: 'crypto',
      asset_lot_size: 0.00302599, // "Jumlah yang Dipegang" — diisi manual di Katalog
      unit: 'Coin',
      default_price: 1_133_437_991,
    });
    // Transaksi eksperimen: qty=3 di unit_breakdown, harga jelas bukan BTC riil.
    const tx = buy(btc, 'Binance Centralized Exchange', '2025-04-01', 3, 3_000_000);
    tx.meta = { catalog_item: { id: btc.id, name: 'Bitcoin' } }; // nama snapshot lama, id tetap match

    const holdings = buildAssetHoldings([btc], [tx]);
    const h = holdings[0];

    // Unit HARUS dari catalog (0,00302599), BUKAN dari unit_breakdown (3).
    expect(h.totalQuantity).toBe(0.00302599);
    // Cost basis tetap dari transaksi seperti biasa — tidak disentuh override.
    expect(h.totalCostBasis).toBe(3_000_000);
    // Avg cost & market value ikut terhitung ulang dari Unit yang benar.
    expect(h.avgCost).toBeCloseTo(3_000_000 / 0.00302599, 2);
    expect(h.avgCostPerPriceUnit).toBeCloseTo(3_000_000 / 0.00302599, 2); // lotSize efektif = 1 utk crypto
    expect(h.marketValue).toBeCloseTo(0.00302599 * 1_133_437_991, 0);
    expect(h.lotSize).toBe(1); // TIDAK dikalikan lagi ke market value (beda dari stock)
  });

  it('stock TETAP pakai SUM(unit_breakdown) seperti biasa — override hanya berlaku utk crypto', () => {
    seq = 0;
    const bmri = instrument('BMRI', { asset_class: 'stock', asset_lot_size: 100, default_price: 4270 });
    const holdings = buildAssetHoldings(
      [bmri],
      [buy(bmri, 'Sinarmas Sekuritas', '2026-07-16', 3, 1_282_797)]
    );
    expect(holdings[0].totalQuantity).toBe(3); // dari transaksi, bukan asset_lot_size (100)
    expect(holdings[0].lotSize).toBe(100); // tetap rasio lembar-per-lot, bukan di-override ke 1
  });
});

describe('buildAssetHoldings — venture: posisi dibaca dari buku besar bisnis lain', () => {
  /** Item venture: penunjuk saja, tidak menyimpan satu pun nominal. */
  function venture(name: string): CatalogItem {
    return instrument(name, {
      asset_class: 'venture',
      asset_lot_size: 1,
      default_price: 0,
      unit: '%',
      linked_business_id: 'biz-hillside',
      linked_stock_account_id: 'acc-3200',
    });
  }

  /** Potret cap table + neraca bisnis target, dihitung di layer API. */
  function snapshot(over: Partial<VentureSnapshot> = {}): VentureSnapshot {
    return {
      itemId: 'item-Hillside Studio',
      businessId: 'biz-hillside',
      businessName: 'Hillside Studio',
      stockAccountId: 'acc-3200',
      ownerAccountName: 'Imam',
      contributed: 5_276_819,
      ownershipPct: 2.65,
      totalEquity: 199_123_456,
      // Hak dividen 50% walau modal cuma 2,65% — kasus nyata Hillside Studio.
      dividendSharePct: 50,
      dividendShareIsExplicit: true,
      dividendsReceived: 2_294_771,
      events: [],
      unresolved: false,
      ...over,
    };
  }

  it('memetakan kepemilikan ke kuantitas dan valuasi ke nilai pasar', () => {
    const item = venture('Hillside Studio');
    const [h] = buildAssetHoldings([item], [], [snapshot()]);

    expect(h.assetClass).toBe('venture');
    expect(h.totalQuantity).toBeCloseTo(2.65, 6); // kolom Unit menampilkan "2,65%"
    expect(h.totalCostBasis).toBe(5_276_819); // dari akun ekuitas Imam, bukan input manual
    expect(h.marketValue).toBeCloseTo(0.0265 * 199_123_456, 2);
    expect(h.unrealizedPl).toBeCloseTo(0.0265 * 199_123_456 - 5_276_819, 2);
    expect(h.hasLivePrice).toBe(true);
  });

  it('menjaga identitas kuantitas × harga = nilai pasar seperti kelas lain', () => {
    const item = venture('Hillside Studio');
    const [h] = buildAssetHoldings([item], [], [snapshot()]);
    // lastPrice = valuasi per 1% — bukan angka kosmetik: tabel memakai
    // identitas ini untuk semua kelas, jadi venture tidak butuh cabang khusus.
    expect(h.totalQuantity * h.lotSize * h.lastPrice).toBeCloseTo(h.marketValue, 2);
    expect(h.totalQuantity * h.avgCostPerPriceUnit).toBeCloseTo(h.totalCostBasis, 2);
  });

  it('dividen TIDAK dihitung sebagai realized P/L — itu income, bukan capital gain', () => {
    const item = venture('Hillside Studio');
    const [h] = buildAssetHoldings([item], [], [snapshot({ dividendsReceived: 2_294_771 })]);
    // Realized P/L = capital gain saat posisi dilepas. Stake venture tidak bisa
    // dijual lewat Asset Console, jadi strukturnya selalu 0 — dividen yang
    // sudah diterima dilaporkan terpisah supaya angkanya tidak ambigu.
    expect(h.realizedPl).toBe(0);
    expect(h.venture?.dividendsReceived).toBe(2_294_771);
    expect(h.events).toHaveLength(0);
  });

  it('hak dividen dipisah dari % modal dan TIDAK mempengaruhi valuasi', () => {
    const item = venture('Hillside Studio');
    const [h] = buildAssetHoldings([item], [], [snapshot()]);
    // Dua hak ekonomi berbeda: 2,65% = klaim atas aset bersih (dipakai nilai
    // pasar), 50% = klaim atas laba periode (informasi saja). Kalau hak laba
    // ikut dipakai menghitung nilai pasar, angkanya melonjak ~18x dan salah:
    // saat likuidasi pemilik ini tidak berhak 50% aset.
    expect(h.venture?.dividendSharePct).toBe(50);
    expect(h.venture?.dividendShareIsExplicit).toBe(true);
    expect(h.totalQuantity).toBeCloseTo(2.65, 6);
    expect(h.marketValue).toBeCloseTo(0.0265 * 199_123_456, 2);
  });

  it('hak dividen jatuh ke % modal bila profit_share_pct tidak di-set', () => {
    const item = venture('Hillside Studio');
    const [h] = buildAssetHoldings(
      [item],
      [],
      [snapshot({ dividendSharePct: 2.65, dividendShareIsExplicit: false, dividendsReceived: 0 })]
    );
    expect(h.venture?.dividendShareIsExplicit).toBe(false);
    expect(h.venture?.dividendSharePct).toBeCloseTo(h.totalQuantity, 6);
  });

  it('ekuitas negatif tetap dilaporkan, bukan disembunyikan sebagai "harga belum diisi"', () => {
    const item = venture('Hillside Studio');
    // Bisnis rugi melebihi modal disetor: nilai pasar posisi jadi negatif.
    // Gate `lastPrice > 0` yang dipakai kelas lain akan menyembunyikan justru
    // kasus yang paling perlu dilihat pemilik — karena itu ada hasLivePrice.
    const [h] = buildAssetHoldings([item], [], [snapshot({ totalEquity: -10_000_000 })]);
    expect(h.hasLivePrice).toBe(true);
    expect(h.marketValue).toBeCloseTo(-265_000, 2);
    expect(h.unrealizedPl).toBeLessThan(0);
    expect(summarizeHoldings([h]).missingPriceCount).toBe(0);
  });

  it('tautan yang tidak terbaca ditandai unresolved, bukan dilaporkan sebagai Rp0 nyata', () => {
    const item = venture('Hillside Studio');
    const [h] = buildAssetHoldings([item], [], [snapshot({ unresolved: true })]);
    expect(h.venture?.unresolved).toBe(true);
    expect(h.hasLivePrice).toBe(false);
    expect(h.totalCostBasis).toBe(0);
    expect(h.unrealizedPl).toBe(0); // jangan laporkan −100% dari data yang gagal dibaca
    expect(h.positions).toHaveLength(0);
  });

  it('venture tanpa snapshot (mis. fetch gagal total) tidak melempar', () => {
    const item = venture('Hillside Studio');
    const [h] = buildAssetHoldings([item], [], []);
    expect(h.venture?.unresolved).toBe(true);
    expect(h.totalQuantity).toBe(0);
  });

  it('ikut dijumlahkan ke KPI bersama kelas lain', () => {
    const bmri = instrument('BMRI', { default_price: 4270 });
    const item = venture('Hillside Studio');
    seq = 0;
    const holdings = buildAssetHoldings(
      [bmri, item],
      [buy(bmri, 'Sinarmas Sekuritas', '2026-07-16', 3, 1_282_797)],
      [snapshot()]
    );
    const s = summarizeHoldings(holdings);
    expect(s.totalInvested).toBeCloseTo(1_282_797 + 5_276_819, 2);
    expect(s.openInstrumentCount).toBe(2);
  });
});
