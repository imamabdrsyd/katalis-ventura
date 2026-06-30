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
 * Akun di-resolve otomatis (pola Quick Entry) — kasir tak perlu memilih akun.
 */

import { useState, useMemo, useCallback } from 'react';
import type { Account, CatalogItem } from '@/types';
import { createMultiLineTransaction } from '@/lib/api/transactions';
import { decrementStock } from '@/lib/api/catalog';
import { saveContactFromTransaction } from '@/lib/api/contacts';

export type PaymentMethod = 'cash' | 'qris';

export interface CartLine {
  item: CatalogItem;
  qty: number;
}

interface CheckoutContext {
  businessId: string;
  userId: string;
  accounts: Account[];
}

/** Akun kas/bank counter sesuai metode: Tunai→kode 1100, QRIS→kode 1200. */
function resolveCashAccount(accounts: Account[], method: PaymentMethod): Account | null {
  const preferredCode = method === 'cash' ? '1100' : '1200';
  const fallbackCode = method === 'cash' ? '1200' : '1100';
  const isCashEq = (a: Account) =>
    a.is_active &&
    a.account_type === 'ASSET' &&
    (a.is_cash_equivalent === true || a.account_code === '1100' || a.account_code === '1200');

  const pool = accounts.filter(isCashEq);
  return (
    pool.find((a) => a.account_code === preferredCode) ??
    pool.find((a) => a.account_code === fallbackCode) ??
    pool[0] ??
    null
  );
}

/** Akun pendapatan default bila item tak punya revenue_account_id (prefer 4100). */
function resolveDefaultRevenueAccount(accounts: Account[]): Account | null {
  const revenue = accounts.filter(
    (a) => a.is_active && a.account_type === 'REVENUE' && a.parent_account_id != null
  );
  return revenue.find((a) => a.account_code === '4100') ?? revenue[0] ?? null;
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
  const checkout = useCallback(async (): Promise<void> => {
    if (cart.length === 0) throw new Error('Keranjang kosong');

    const cashAccount = resolveCashAccount(accounts, paymentMethod);
    if (!cashAccount) {
      throw new Error('Akun Kas/Bank tidak ditemukan. Periksa Chart of Accounts.');
    }
    const defaultRevenue = resolveDefaultRevenueAccount(accounts);

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
    try {
      await createMultiLineTransaction({
        business_id: businessId,
        created_by: userId,
        date: new Date().toISOString().slice(0, 10),
        category: 'EARN',
        name,
        description: `Penjualan POS — ${itemsLabel}`,
        status: 'posted',
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
