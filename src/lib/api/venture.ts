/**
 * Data access kelas aset "venture" — kepemilikan pemilik di bisnis LAIN.
 *
 * Kelas ini satu-satunya di Asset Console yang angkanya tidak berasal dari
 * transaksi bisnis pemantau. Alih-alih menyalin nominal ke mana pun, tautan
 * disimpan sebagai dua pointer di `catalog_items` (linked_business_id +
 * linked_stock_account_id) dan angka dihitung ulang tiap load dari buku besar
 * bisnis target:
 *
 *   Modal        = kontribusi akun EQUITY is_stock milik user  (calculateCapTable)
 *   Kepemilikan% = kontribusi itu / total semua akun stock     (calculateCapTable)
 *   Nilai Pasar  = kepemilikan% × Total Ekuitas                (calculateBalanceSheet)
 *
 * Konsekuensinya angka di sini tidak mungkin basi terhadap laporan bisnis
 * target — keduanya membaca buku besar yang sama dengan fungsi yang sama.
 *
 * Akses lintas-bisnis aman by construction: query tetap lewat client biasa
 * (bukan admin), jadi RLS hanya melepas data bisnis yang user memang anggotanya.
 */

import { createClient } from '@/lib/supabase';
import { calculateBalanceSheet, calculateCapTable } from '@/lib/calculations';
import type { Account, Business, CatalogItem, Transaction } from '@/types';
import type { VentureSnapshot } from '@/lib/assetConsole';

/** Akun ekuitas pemilik yang bisa ditautkan sebagai posisi venture. */
export interface VentureStockAccountOption {
  id: string;
  account_code: string;
  account_name: string;
  /** Sudah ditautkan dari bisnis ini — dropdown menonaktifkannya. */
  alreadyLinked: boolean;
}

/**
 * Akun EQUITY yang ditandai `is_stock` di bisnis target — inilah "kolom pemilik"
 * di cap table. Dicari lewat flag, bukan nama akun (aturan klasifikasi AXION:
 * jangan pernah mencocokkan substring nama).
 */
export async function getVentureStockAccounts(
  targetBusinessId: string,
  linkedAccountIds: string[] = []
): Promise<VentureStockAccountOption[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('id, account_code, account_name')
    .eq('business_id', targetBusinessId)
    .eq('account_type', 'EQUITY')
    .eq('is_stock', true)
    .eq('is_active', true)
    .order('account_code', { ascending: true });

  if (error) throw new Error(error.message);

  const linked = new Set(linkedAccountIds);
  return (data ?? []).map((a) => ({
    id: a.id as string,
    account_code: a.account_code as string,
    account_name: a.account_name as string,
    alreadyLinked: linked.has(a.id as string),
  }));
}

export interface ConnectVentureInput {
  /** Bisnis yang MEMANTAU (tempat baris katalog venture disimpan). */
  businessId: string;
  targetBusinessId: string;
  targetBusinessName: string;
  stockAccountId: string;
}

/**
 * Tautkan satu posisi venture.
 *
 * Barisnya tetap `catalog_items` supaya semua kelas aset punya satu registry
 * — tapi ditandai non-aktif agar tidak pernah muncul di picker POS/transaksi,
 * dan halaman Katalog sudah memfilter asset_class='venture' keluar. Item ini
 * bukan barang yang bisa dijual: tidak ada SKU, stok, atau harga jual.
 */
export async function connectVenture(input: ConnectVentureInput): Promise<CatalogItem> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('catalog_items')
    .insert({
      business_id: input.businessId,
      name: input.targetBusinessName,
      item_type: 'service',
      default_price: 0,
      unit: '%',
      asset_class: 'venture',
      asset_lot_size: 1,
      linked_business_id: input.targetBusinessId,
      linked_stock_account_id: input.stockAccountId,
      is_active: false,
      created_by: user?.id ?? null,
    })
    .select('*')
    .single();

  if (error) {
    // Unique index uq_catalog_items_venture_link — tautan ganda ke akun yang
    // sama akan menggandakan KPI, jadi ditolak di DB dan diterjemahkan di sini.
    if (error.code === '23505') {
      throw new Error('Posisi ini sudah ditautkan ke Asset Console.');
    }
    throw new Error(error.message);
  }
  return data as CatalogItem;
}

/**
 * Putuskan tautan venture — soft delete, konsisten dengan item katalog lain.
 * Index uniknya mengecualikan baris terhapus, jadi posisi yang sama bisa
 * ditautkan ulang nanti.
 */
export async function disconnectVenture(itemId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('catalog_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('asset_class', 'venture');

  if (error) throw new Error(error.message);
}

/**
 * Nama pemilik yang ditampilkan sebagai "kustodian" venture di Asset Console.
 *
 * Venture tidak punya kustodian pihak ketiga (bukan broker/exchange) —
 * proxy paling jujur adalah nama PROFIL pemilik bisnis target
 * (`profiles.full_name`, bukan `accounts.account_name`: nama akun ekuitas
 * bisa generik seperti "Owner's Capital" dan tidak selalu sama dengan nama
 * pemiliknya). Sumbernya adalah **pembuat bisnis** (`businesses.created_by`)
 * — creator bukan selalu punya row `user_business_roles` bertipe
 * business_manager (bisa berperan Super Admin/Creator murni, seperti pada
 * data real: Imam Abdurasyid = creator Hillside Studio, sementara role
 * business_manager di tabel roles dipegang Monica Sandra). Fallback ke role
 * business_manager/both kalau bisnisnya tidak punya created_by (data lama).
 */
async function loadTargetManagerNames(businessId: string, createdBy: string | null): Promise<string> {
  const supabase = createClient();

  let ids = createdBy ? [createdBy] : [];

  if (ids.length === 0) {
    const { data: roles } = await supabase
      .from('user_business_roles')
      .select('user_id')
      .eq('business_id', businessId)
      .in('role', ['business_manager', 'both']);
    ids = [...new Set((roles ?? []).map((r) => r.user_id as string))];
  }

  if (ids.length === 0) return '';

  const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids);

  return (profiles ?? [])
    .map((p) => p.full_name as string)
    .filter(Boolean)
    .join(' · ');
}

/** Buku besar satu bisnis target, seperlunya untuk cap table + neraca. */
async function loadTargetLedger(
  businessId: string
): Promise<{ business: Business | null; transactions: Transaction[]; accounts: Account[]; managerName: string }> {
  const supabase = createClient();

  const [businessRes, txRes, accRes] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', businessId).maybeSingle(),
    supabase
      .from('transactions')
      .select(
        `
        *,
        debit_account:accounts!transactions_debit_account_id_fkey(*),
        credit_account:accounts!transactions_credit_account_id_fkey(*),
        journal_lines(*, account:accounts(*))
      `
      )
      .eq('business_id', businessId)
      .is('deleted_at', null),
    supabase.from('accounts').select('*').eq('business_id', businessId),
  ]);

  if (businessRes.error) throw new Error(businessRes.error.message);
  if (txRes.error) throw new Error(txRes.error.message);
  if (accRes.error) throw new Error(accRes.error.message);

  const business = (businessRes.data as Business | null) ?? null;
  const managerName = business ? await loadTargetManagerNames(businessId, business.created_by ?? null) : '';

  return {
    business,
    transactions: (txRes.data ?? []) as Transaction[],
    accounts: (accRes.data ?? []) as Account[],
    managerName,
  };
}

/**
 * Hitung potret posisi untuk setiap item katalog berkelas 'venture'.
 *
 * Satu bisnis target di-load sekali walau ditautkan lewat beberapa akun
 * ekuitas (mis. memantau dua kolom pemilik di bisnis yang sama).
 */
export async function getVentureSnapshots(items: CatalogItem[]): Promise<VentureSnapshot[]> {
  const ventureItems = items.filter(
    (i) => i.asset_class === 'venture' && i.linked_business_id && i.linked_stock_account_id
  );
  if (ventureItems.length === 0) return [];

  const targetIds = [...new Set(ventureItems.map((i) => i.linked_business_id as string))];

  const ledgers = new Map<string, Awaited<ReturnType<typeof loadTargetLedger>> | null>();
  await Promise.all(
    targetIds.map(async (id) => {
      try {
        ledgers.set(id, await loadTargetLedger(id));
      } catch {
        // RLS menolak / bisnis hilang → tandai unresolved, jangan jatuhkan
        // seluruh halaman hanya karena satu tautan basi.
        ledgers.set(id, null);
      }
    })
  );

  return ventureItems.map((item) => {
    const targetId = item.linked_business_id as string;
    const accountId = item.linked_stock_account_id as string;
    const ledger = ledgers.get(targetId) ?? null;

    const base = {
      itemId: item.id,
      businessId: targetId,
      stockAccountId: accountId,
    };

    if (!ledger || !ledger.business) {
      return {
        ...base,
        businessName: item.name,
        ownerAccountName: '',
        contributed: 0,
        ownershipPct: 0,
        totalEquity: 0,
        unresolved: true,
      };
    }

    // Konvensi laporan AXION: hanya transaksi posted yang masuk laporan
    // keuangan (transaksi tanpa status = data legacy, diperlakukan posted).
    const posted = ledger.transactions.filter((t) => !t.status || t.status === 'posted');

    const capTable = calculateCapTable(posted);
    const entry = capTable.entries.find((e) => e.accountId === accountId);

    const balanceSheet = calculateBalanceSheet(
      posted,
      Number(ledger.business.capital_investment) || 0,
      ledger.accounts
    );

    return {
      ...base,
      businessName: ledger.business.business_name,
      // Nama pemilik yang ditampilkan = profil manager bisnis target, BUKAN
      // account_name akun ekuitas (bisa generik, mis. "Owner's Capital").
      // Fallback ke nama akun kalau tidak ada satu manager pun ditemukan,
      // supaya baris tidak tampil kosong.
      ownerAccountName: ledger.managerName || entry?.accountName || '',
      contributed: entry?.contributed ?? 0,
      ownershipPct: entry?.percentage ?? 0,
      totalEquity: balanceSheet.equity.totalEquity,
      // Akun ada di DB tapi belum punya mutasi apa pun → cap table tidak
      // memuatnya. Itu bukan kegagalan baca: posisinya memang 0%.
      unresolved: false,
    };
  });
}
