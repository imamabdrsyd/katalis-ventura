import { describe, it, expect } from 'vitest';
import {
  planCogsPosting,
  resolveCogsAccount,
  resolveInventoryAccount,
  type CogsCartLine,
} from '@/lib/accounting/salesCheckout';
import { makeAccount } from './fixtures';
import type { Account } from '@/types';

/** CoA nyata selalu punya induk; resolver HPP sengaja melewati akun header. */
function child(acc: Account, parentCode: string): Account {
  return { ...acc, parent_account_id: `acc-${parentCode}` };
}

const inventory = makeAccount({
  code: '1500',
  name: 'Persediaan Barang',
  type: 'ASSET',
  default_category: 'VAR',
});
const cogs = child(
  makeAccount({ code: '5200', name: 'Variable Cost (COGS)', type: 'EXPENSE', default_category: 'VAR' }),
  '5000'
);
const opex = child(
  makeAccount({ code: '5100', name: 'Operating Expenses', type: 'EXPENSE', default_category: 'OPEX' }),
  '5000'
);
const cash = makeAccount({ code: '1100', name: 'Kas', type: 'ASSET', is_cash_equivalent: true });

const fullCoa = [cash, inventory, opex, cogs];

function line(
  id: string,
  qty: number,
  opts: { track_stock?: boolean; cost_price?: number } = {}
): CogsCartLine {
  return {
    item: {
      id,
      name: `Item ${id}`,
      track_stock: opts.track_stock ?? true,
      cost_price: opts.cost_price ?? 10000,
    },
    qty,
  };
}

describe('resolveInventoryAccount', () => {
  it('memilih akun ASSET ber-default_category VAR', () => {
    expect(resolveInventoryAccount(fullCoa)?.id).toBe(inventory.id);
  });

  it('jatuh ke pencocokan nama bila tak ada penanda struktural', () => {
    const byName = makeAccount({ code: '1450', name: 'Stok Bahan Baku', type: 'ASSET' });
    expect(resolveInventoryAccount([cash, byName])?.id).toBe(byName.id);
  });

  it('null bila bisnis tak punya akun persediaan sama sekali', () => {
    expect(resolveInventoryAccount([cash, opex, cogs])).toBeNull();
  });
});

describe('resolveCogsAccount', () => {
  it('memilih akun beban ber-default_category VAR', () => {
    expect(resolveCogsAccount(fullCoa)?.id).toBe(cogs.id);
  });

  it('menghormati override income_statement_section di atas default_category', () => {
    const overridden = child(
      makeAccount({
        code: '5700',
        name: 'Biaya Produksi',
        type: 'EXPENSE',
        default_category: 'OPEX',
        income_statement_section: 'cost_of_revenue',
      }),
      '5000'
    );
    expect(resolveCogsAccount([opex, overridden])?.id).toBe(overridden.id);
  });

  it('tidak memilih akun VAR yang di-override jadi operating_expense', () => {
    const demoted = child(
      makeAccount({
        code: '5250',
        name: 'Beban Lain',
        type: 'EXPENSE',
        default_category: 'VAR',
        income_statement_section: 'operating_expense',
      }),
      '5000'
    );
    expect(resolveCogsAccount([demoted])).toBeNull();
  });

  it('TIDAK jatuh ke sembarang akun beban — lebih baik null daripada HPP masuk OPEX', () => {
    expect(resolveCogsAccount([opex])).toBeNull();
  });

  it('mengabaikan akun header tanpa induk', () => {
    const header = makeAccount({ code: '5000', name: 'Expenses', type: 'EXPENSE', default_category: 'VAR' });
    expect(resolveCogsAccount([header])).toBeNull();
  });
});

describe('planCogsPosting', () => {
  it('merakit rencana Dr HPP / Cr Persediaan sebesar cost x qty', () => {
    const plan = planCogsPosting([line('a', 3, { cost_price: 12500 })], fullCoa);
    expect(plan).not.toBeNull();
    expect(plan!.total).toBe(37500);
    expect(plan!.cogsAccountId).toBe(cogs.id);
    expect(plan!.inventoryAccountId).toBe(inventory.id);
    expect(plan!.items).toEqual([
      { catalog_item_id: 'a', name: 'Item a', qty: 3, unit_cost: 12500 },
    ]);
  });

  it('menjumlahkan beberapa item di satu keranjang', () => {
    const plan = planCogsPosting(
      [line('a', 2, { cost_price: 10000 }), line('b', 1, { cost_price: 5500 })],
      fullCoa
    );
    expect(plan!.total).toBe(25500);
    expect(plan!.items).toHaveLength(2);
  });

  it('null bila bisnis tak punya akun Persediaan — cegah HPP dobel', () => {
    // Pola nyata elvéa: pembelian stok langsung didebit ke 5200, tak pernah
    // dikapitalisasi. Menjurnal HPP lagi saat jual = beban dihitung dua kali.
    const noInventory = [cash, opex, cogs];
    expect(planCogsPosting([line('a', 5)], noInventory)).toBeNull();
  });

  it('null bila tak ada akun beban yang sah menampung HPP', () => {
    expect(planCogsPosting([line('a', 5)], [cash, inventory, opex])).toBeNull();
  });

  it('melewati item yang stoknya tidak dilacak', () => {
    expect(planCogsPosting([line('a', 2, { track_stock: false })], fullCoa)).toBeNull();
  });

  it('melewati item tanpa harga pokok', () => {
    expect(planCogsPosting([line('a', 2, { cost_price: 0 })], fullCoa)).toBeNull();
  });

  it('hanya menghitung item yang dilacak & berharga pokok dalam keranjang campuran', () => {
    const plan = planCogsPosting(
      [
        line('jasa', 1, { track_stock: false, cost_price: 99000 }),
        line('tanpa-cost', 4, { cost_price: 0 }),
        line('barang', 2, { cost_price: 7000 }),
      ],
      fullCoa
    );
    expect(plan!.total).toBe(14000);
    expect(plan!.items.map((i) => i.catalog_item_id)).toEqual(['barang']);
  });

  it('membulatkan total ke 2 desimal mengikuti NUMERIC(15,2)', () => {
    const plan = planCogsPosting([line('a', 3, { cost_price: 333.333 })], fullCoa);
    expect(plan!.total).toBe(1000);
  });
});
