'use client';

/**
 * Isi tab "Cashier" di hub POS (menggantikan KasirStub lama).
 *
 * Menampilkan kartu intro + tombol "Buka Mode Kasir". Saat diklik, data katalog
 * & Chart of Accounts dimuat lalu CashierScreen dibuka sebagai overlay full-screen.
 * Hanya manager/both/superadmin yang bisa membuka (kasir menulis transaksi).
 */

import { useState, useCallback } from 'react';
import { ShoppingCart, ArrowRight, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useBusinessContext } from '@/context/BusinessContext';
import { isManagerRole } from '@/lib/roles';
import { getCatalogItems } from '@/lib/api/catalog';
import { getAccounts } from '@/lib/api/accounts';
import type { Account, CatalogItem } from '@/types';
import { CashierScreen } from './CashierScreen';

export function CashierLauncher() {
  const { activeBusiness, activeBusinessId, user, userRole } = useBusinessContext();
  const canManage = isManagerRole(userRole);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const loadAndOpen = useCallback(async () => {
    if (!activeBusinessId) return;
    setLoading(true);
    try {
      const [catalog, accs] = await Promise.all([
        getCatalogItems(activeBusinessId, { activeOnly: true }),
        getAccounts(activeBusinessId),
      ]);
      if (catalog.length === 0) {
        toast.error('Belum ada produk di katalog. Tambahkan dulu di tab Catalog.');
        return;
      }
      setItems(catalog);
      setAccounts(accs);
      setOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat data kasir');
    } finally {
      setLoading(false);
    }
  }, [activeBusinessId]);

  // Refresh stok katalog setelah checkout sukses
  const refreshItems = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const catalog = await getCatalogItems(activeBusinessId, { activeOnly: true });
      setItems(catalog);
    } catch {
      /* abaikan — bukan kegagalan kritis */
    }
  }, [activeBusinessId]);

  if (!canManage) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-gray-400 dark:text-gray-500" />
        </div>
        <p className="font-semibold text-gray-700 dark:text-gray-200">Akses terbatas</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
          Hanya manager bisnis yang dapat menggunakan kasir.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-md mx-auto text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-5">
          <ShoppingCart className="w-8 h-8 text-primary-500 dark:text-primary-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Kasir cepat</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 mb-6">
          Pilih produk dari katalog, terima pembayaran tunai atau QRIS, dan transaksi
          penjualan tercatat otomatis di pembukuan.
        </p>
        <button
          type="button"
          onClick={loadAndOpen}
          disabled={loading || !activeBusiness}
          className="btn-primary-glow inline-flex items-center gap-2 px-6 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowRight className="w-4 h-4" />
          )}
          Buka Mode Kasir
        </button>
      </div>

      {open && activeBusinessId && user && (
        <CashierScreen
          businessId={activeBusinessId}
          userId={user.id}
          items={items}
          accounts={accounts}
          qrisImageUrl={activeBusiness?.qris_image_url ?? null}
          onClose={() => setOpen(false)}
          onCheckoutDone={refreshItems}
        />
      )}
    </>
  );
}
