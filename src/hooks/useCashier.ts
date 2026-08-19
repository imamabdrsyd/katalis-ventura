'use client';

/**
 * Hook state & logika kasir POS (Point of Sales).
 *
 * Mengelola keranjang (cart) di atas data `catalog_items`, lalu saat checkout
 * merakit satu transaksi EARN multi-line yang langsung lunas:
 *   - N baris KREDIT pendapatan (di-grup per revenue_account_id item)
 *   - 1 baris DEBIT Kas/Bank sesuai metode bayar (Tunai → Kas 1100, QRIS → Bank 1200)
 * Lalu mengurangi stok item yang track_stock=true (best-effort, tak membatalkan
 * transaksi bila gagal) dan menyimpan customer sebagai kontak tipe 'customer'.
 *
 * Jembatan stok → ledger (migr 134): bila bisnis mengkapitalisasi pembelian ke
 * akun Persediaan DAN item punya `cost_price`, checkout juga menjurnal HPP-nya
 * sebagai transaksi VAR terpisah (Dr HPP / Cr Persediaan) bertanggal sama.
 * Terpisah, bukan baris tambahan di transaksi penjualan, karena `amount`
 * transaksi multi-line = total debit — menumpuk HPP di sana akan membuat
 * nominal penjualan terbaca sebesar harga jual + harga pokok.
 *
 * Akun di-resolve otomatis (pola Quick Entry) — kasir tak perlu memilih akun.
 */

import { useState, useMemo, useCallback } from 'react';
import type { Account, CatalogItem } from '@/types';
import { createMultiLineTransaction, createTransaction } from '@/lib/api/transactions';
import { decrementStock } from '@/lib/api/catalog';
import { saveContactFromTransaction } from '@/lib/api/contacts';
import {
  resolveCashAccount,
  resolveDefaultRevenueAccount,
  planCogsPosting,
  type PaymentMethod,
} from '@/lib/accounting/salesCheckout';

// Re-export agar konsumen lama (PaymentModal) tetap import dari '@/hooks/useCashier'.
export type { PaymentMethod };

export interface CartLine {
  item: CatalogItem;
  qty: number;
}

/**
 * Hasil checkout. `cogsWarning` terisi bila penjualan SUDAH tercatat tapi jurnal
 * HPP-nya gagal — kasir perlu tahu supaya bisa mencatat manual. Sengaja tidak
 * dilempar sebagai error: melempar setelah penjualan tersimpan membuat kasir
 * mengira checkout gagal lalu mengulang, dan itu menghasilkan penjualan dobel.
 */
export interface CheckoutResult {
  cogsWarning?: string;
}

interface CheckoutContext {
  businessId: string;
  userId: string;
  accounts: Account[];
}

export function useCashier({ businessId, userId, accounts }: CheckoutContext) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [submitting, setSubmitting] = useState(false);

  const addItem = useCallback((item: CatalogItem) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.item.id === item.id);
      // Hormati stok bila dilacak
      if (item.track_stock && typeof item.stock_qty === 'number') {
        const currentQty = existing?.qty ?? 0;
        if (currentQty >= item.stock_qty) return prev; // stok habis
      }
      if (existing) {
        return prev.map((l) => (l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { item, qty: 1 }];
    });
  }, []);

  const setQty = useCallback((itemId: string, qty: number) => {
    setCart((prev) => {
      if (qty <= 0) return prev.filter((l) => l.item.id !== itemId);
      return prev.map((l) => {
        if (l.item.id !== itemId) return l;
        const max =
          l.item.track_stock && typeof l.item.stock_qty === 'number' ? l.item.stock_qty : Infinity;
        return { ...l, qty: Math.min(qty, max) };
      });
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setCart((prev) => prev.filter((l) => l.item.id !== itemId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setCustomerName('');
  }, []);

  const subtotal = useMemo(
    () => cart.reduce((sum, l) => sum + l.item.default_price * l.qty, 0),
    [cart]
  );
  const total = subtotal; // MVP: tanpa PPN
  const itemCount = useMemo(() => cart.reduce((sum, l) => sum + l.qty, 0), [cart]);

  /**
   * Rakit & simpan transaksi penjualan. Mengembalikan transaksi yang dibuat.
   * Melempar error bila keranjang kosong atau akun kas/pendapatan tak ditemukan.
   */
  const checkout = useCallback(async (): Promise<CheckoutResult> => {
    if (cart.length === 0) throw new Error('Keranjang kosong');

    const cashAccount = resolveCashAccount(accounts, paymentMethod);
    if (!cashAccount) {
      throw new Error('Akun Kas/Bank tidak ditemukan. Periksa Chart of Accounts.');
    }
    const defaultRevenue = resolveDefaultRevenueAccount(accounts);

    // Rencana HPP dihitung SEBELUM apa pun disimpan. null = memang tak ada yang
    // perlu dijurnal (bisnis tanpa akun Persediaan / item tanpa cost_price) —
    // jalur normal, bukan kegagalan. Lihat `planCogsPosting`.
    const cogsPlan = planCogsPosting(cart, accounts);

    // Grup kredit pendapatan per akun (beberapa item bisa berbagi akun yang sama)
    const revenueByAccount = new Map<string, number>();
    for (const line of cart) {
      const revAccId = line.item.revenue_account_id ?? defaultRevenue?.id ?? null;
      if (!revAccId) {
        throw new Error(
          `Item "${line.item.name}" tidak punya akun pendapatan & tidak ada akun pendapatan default.`
        );
      }
      const amount = line.item.default_price * line.qty;
      revenueByAccount.set(revAccId, (revenueByAccount.get(revAccId) ?? 0) + amount);
    }

    const creditLines = Array.from(revenueByAccount.entries()).map(([accountId, amount], i) => ({
      account_id: accountId,
      debit_amount: 0,
      credit_amount: amount,
      description: 'Penjualan POS',
      sort_order: i + 1,
    }));

    const debitLine = {
      account_id: cashAccount.id,
      debit_amount: total,
      credit_amount: 0,
      description: paymentMethod === 'cash' ? 'Penerimaan tunai' : 'Penerimaan QRIS',
      sort_order: 0,
    };

    const name = customerName.trim() || 'Pelanggan';
    const itemsLabel = cart.map((l) => `${l.item.name} x${l.qty}`).join(', ');

    setSubmitting(true);
    let cogsWarning: string | undefined;
    try {
      const sale = await createMultiLineTransaction({
        business_id: businessId,
        created_by: userId,
        date: new Date().toISOString().slice(0, 10),
        category: 'EARN',
        name,
        description: `Penjualan POS — ${itemsLabel}`,
        status: 'posted',
        sales_channel: 'offline',
        meta: {
          source: 'pos_cashier',
          payment_method: paymentMethod,
          pos_items: cart.map((l) => ({
            catalog_item_id: l.item.id,
            name: l.item.name,
            qty: l.qty,
            unit_price: l.item.default_price,
          })),
        },
        journal_lines: [debitLine, ...creditLines],
      });

      // Jurnal HPP: Dr HPP / Cr Persediaan, tanggal sama dengan penjualan.
      // Dibuat SESUDAH penjualan supaya `cogs_of_transaction_id` bisa menunjuk
      // transaksi yang sudah pasti ada — urutan sebaliknya berisiko meninggalkan
      // beban HPP yatim bila penyimpanan penjualan gagal.
      if (cogsPlan) {
        try {
          await createTransaction({
            business_id: businessId,
            created_by: userId,
            date: new Date().toISOString().slice(0, 10),
            category: 'VAR',
            name: 'Penjualan POS',
            description: `HPP — ${itemsLabel}`,
            amount: cogsPlan.total,
            account: '',
            status: 'posted',
            is_double_entry: true,
            debit_account_id: cogsPlan.cogsAccountId,
            credit_account_id: cogsPlan.inventoryAccountId,
            meta: {
              cogs_of_transaction_id: sale.id,
              cogs_items: cogsPlan.items,
            },
          });
        } catch (err) {
          console.error('Gagal mencatat jurnal HPP penjualan POS:', err);
          cogsWarning =
            'Penjualan tercatat, tapi jurnal HPP gagal disimpan. Catat manual: Debit HPP / Kredit Persediaan.';
        }
      }

      // Wire customer ke kelola kontak (tipe customer). Diam-diam abaikan bila
      // sudah ada / gagal — tak boleh membatalkan penjualan yang sudah tercatat.
      if (customerName.trim()) {
        try {
          await saveContactFromTransaction(businessId, customerName.trim(), 'customer', userId);
        } catch (err) {
          console.error('Gagal simpan kontak customer:', err);
        }
      }

      // Kurangi stok item yang dilacak (best-effort).
      await Promise.all(
        cart
          .filter((l) => l.item.track_stock)
          .map((l) =>
            decrementStock(l.item.id, l.qty).catch((err) =>
              console.error(`Gagal kurangi stok ${l.item.name}:`, err)
            )
          )
      );

      clearCart();
      return { cogsWarning };
    } finally {
      setSubmitting(false);
    }
  }, [cart, accounts, paymentMethod, total, customerName, businessId, userId, clearCart]);

  return {
    cart,
    addItem,
    setQty,
    removeItem,
    clearCart,
    customerName,
    setCustomerName,
    paymentMethod,
    setPaymentMethod,
    subtotal,
    total,
    itemCount,
    submitting,
    checkout,
  };
}
