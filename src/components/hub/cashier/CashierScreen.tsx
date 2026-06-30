'use client';

/**
 * Mode Kasir POS — overlay full-screen (fixed inset-0) tanpa sidebar.
 *
 * Kiri  : pencarian + tab kategori + grid kartu produk dari catalog_items.
 * Kanan : panel keranjang (cart) + customer + metode bayar + tombol Checkout.
 *
 * Catatan: ini sengaja overlay manual (bukan <Modal>) karena butuh kanvas penuh
 * imersif untuk transaksi cepat — pola serupa TransactionDetailModal full-screen.
 * Dialog kecil (pembayaran) tetap memakai <Modal> via PaymentModal.
 */

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Loader2,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Account, CatalogItem } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { ContactAutocomplete } from '@/components/transactions/ContactAutocomplete';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { useCashier } from '@/hooks/useCashier';
import { PaymentModal } from './PaymentModal';

interface CashierScreenProps {
  businessId: string;
  userId: string;
  items: CatalogItem[];
  accounts: Account[];
  qrisImageUrl: string | null;
  onClose: () => void;
  /** Dipanggil setelah checkout sukses (mis. refresh stok). */
  onCheckoutDone?: () => void;
}

const ALL_CATEGORY = '__all__';

export function CashierScreen({
  businessId,
  userId,
  items,
  accounts,
  qrisImageUrl,
  onClose,
  onCheckoutDone,
}: CashierScreenProps) {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [activeUnit, setActiveUnit] = useState<string>(ALL_CATEGORY);
  const [showPayment, setShowPayment] = useState(false);

  const cashier = useCashier({ businessId, userId, accounts });

  useEffect(() => setMounted(true), []);

  // Esc menutup (hanya bila modal pembayaran tidak terbuka)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showPayment) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, showPayment]);

  // Kategori sederhana = kelompok berdasarkan `unit` (cth: pcs, gelas) bila ada,
  // fallback ke item_type. Tab pertama = Semua.
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      const key = it.unit?.trim() || (it.item_type === 'service' ? 'Jasa' : 'Produk');
      set.add(key);
    }
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (!it.is_active) return false;
      const key = it.unit?.trim() || (it.item_type === 'service' ? 'Jasa' : 'Produk');
      if (activeUnit !== ALL_CATEGORY && key !== activeUnit) return false;
      if (q && !it.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, activeUnit]);

  const qtyInCart = (itemId: string) =>
    cashier.cart.find((l) => l.item.id === itemId)?.qty ?? 0;

  async function handleCheckoutConfirmed() {
    try {
      await cashier.checkout();
      toast.success('Penjualan tercatat');
      setShowPayment(false);
      onCheckoutDone?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan penjualan');
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 md:px-6 h-14 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
            <ShoppingCart className="w-4.5 h-4.5 text-primary-500 dark:text-primary-400" />
          </span>
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Mode Kasir</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn-icon"
          aria-label="Tutup mode kasir"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body: grid produk (kiri) + cart (kanan) */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* KIRI — katalog */}
        <div className="flex-1 flex flex-col min-h-0 p-4 md:p-6">
          {/* Search + kategori */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari produk…"
                className="input-search pl-9 w-full"
              />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
            <CategoryChip
              label="Semua"
              active={activeUnit === ALL_CATEGORY}
              onClick={() => setActiveUnit(ALL_CATEGORY)}
            />
            {categories.map((c) => (
              <CategoryChip
                key={c}
                label={c}
                active={activeUnit === c}
                onClick={() => setActiveUnit(c)}
              />
            ))}
          </div>

          {/* Grid produk */}
          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Tidak ada produk yang cocok.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {filtered.map((item) => (
                  <ProductCard
                    key={item.id}
                    item={item}
                    inCart={qtyInCart(item.id)}
                    onAdd={() => cashier.addItem(item)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* KANAN — cart panel */}
        <div className="w-full lg:w-[380px] shrink-0 flex flex-col min-h-0 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          {/* Customer */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <label className="label">Customer (opsional)</label>
            <ContactAutocomplete
              businessId={businessId}
              value={cashier.customerName}
              onChange={cashier.setCustomerName}
              onSelectContact={(c) => cashier.setCustomerName(c.name)}
              placeholder="Nama pelanggan"
            />
          </div>

          {/* Daftar item */}
          <div className="flex-1 overflow-y-auto min-h-[120px]">
            {cashier.cart.length === 0 ? (
              <div className="text-center py-12 px-4 text-gray-400 dark:text-gray-500">
                <ShoppingCart className="w-9 h-9 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Keranjang kosong. Pilih produk di kiri.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {cashier.cart.map((line) => (
                  <li key={line.item.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {line.item.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatCurrency(line.item.default_price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => cashier.setQty(line.item.id, line.qty - 1)}
                        className="w-7 h-7 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                        aria-label="Kurangi"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {line.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => cashier.addItem(line.item)}
                        className="w-7 h-7 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                        aria-label="Tambah"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="w-20 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {formatCurrency(line.item.default_price * line.qty)}
                    </div>
                    <button
                      type="button"
                      onClick={() => cashier.removeItem(line.item.id)}
                      className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400"
                      aria-label="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer: total + metode + checkout */}
          <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                Subtotal · {cashier.itemCount} item
              </span>
              <span className="font-medium text-gray-700 dark:text-gray-200">
                {formatCurrency(cashier.subtotal)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-gray-900 dark:text-gray-100">Total</span>
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(cashier.total)}
              </span>
            </div>

            <SegmentedToggle
              fullWidth
              ariaLabel="Metode pembayaran"
              value={cashier.paymentMethod}
              onChange={cashier.setPaymentMethod}
              options={[
                { value: 'cash', label: 'Tunai' },
                { value: 'qris', label: 'QRIS' },
              ]}
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={cashier.clearCart}
                disabled={cashier.cart.length === 0}
                className="btn-secondary px-4 disabled:opacity-40"
              >
                Bersihkan
              </button>
              <button
                type="button"
                onClick={() => setShowPayment(true)}
                disabled={cashier.cart.length === 0 || cashier.submitting}
                className="btn-primary-glow flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {cashier.submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Bayar · {formatCurrency(cashier.total)}
              </button>
            </div>
          </div>
        </div>
      </div>

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        method={cashier.paymentMethod}
        total={cashier.total}
        qrisImageUrl={qrisImageUrl}
        businessId={businessId}
        submitting={cashier.submitting}
        onConfirm={handleCheckoutConfirmed}
      />
    </div>,
    document.body
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors',
        active
          ? 'bg-primary-500 text-white'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function ProductCard({
  item,
  inCart,
  onAdd,
}: {
  item: CatalogItem;
  inCart: number;
  onAdd: () => void;
}) {
  const soldOut =
    item.track_stock && typeof item.stock_qty === 'number' && inCart >= item.stock_qty;

  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={soldOut}
      className="group relative text-left rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 overflow-hidden hover:border-primary-200 dark:hover:border-primary-800 hover:shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="aspect-square bg-gray-50 dark:bg-gray-900 relative">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full"
            style={{ objectFit: item.image_fit ?? 'cover' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-8 h-8 text-gray-300 dark:text-gray-600" />
          </div>
        )}
        {inCart > 0 && (
          <span className="absolute top-2 left-2 min-w-5 h-5 px-1.5 rounded-full bg-primary-500 text-white text-xs font-bold flex items-center justify-center">
            {inCart}
          </span>
        )}
        <span className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-white dark:bg-gray-700 shadow flex items-center justify-center text-primary-500 dark:text-primary-400 group-hover:bg-primary-500 group-hover:text-white transition">
          <Plus className="w-4 h-4" />
        </span>
      </div>
      <div className="p-2.5">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug">
          {item.name}
        </p>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-0.5">
          {formatCurrency(item.default_price)}
        </p>
        {item.track_stock && typeof item.stock_qty === 'number' && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Stok: {item.stock_qty}
          </p>
        )}
      </div>
    </button>
  );
}
