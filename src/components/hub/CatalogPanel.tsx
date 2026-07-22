'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useBusinessContext } from '@/context/BusinessContext';
import { useLanguage } from '@/context/LanguageContext';
import type { CatalogItem, Account } from '@/types';
import * as catalogApi from '@/lib/api/catalog';
import { getAccounts } from '@/lib/api/accounts';
import { isManagerRole } from '@/lib/roles';
import { isAccommodationSector } from '@/lib/businessSectors';
import { useCalendarUnit } from './calendar/CalendarUnitContext';
import { formatCurrency } from '@/lib/utils';
import { CatalogItemForm, type CatalogItemFormData } from '@/components/catalog/CatalogItemForm';
import { AnimatedDialog } from '@/components/ui/AnimatedDialog';
import {
  Plus, Search, Package, PackagePlus, Trash2, X, Eye, EyeOff,
  LayoutGrid, List,
} from 'lucide-react';
import { getSectorIcon } from '@/lib/sectorIcons';

type ViewMode = 'grid' | 'list';
const VIEW_MODE_KEY = 'katalis_catalog_view_mode';

/**
 * Panel manajemen Katalog produk/jasa di dalam HubPage.
 * Isi dipindahkan dari halaman /catalog lama (CRUD item katalog) — tanpa chrome
 * halaman (judul besar di-handle HubPage).
 *
 * Layout: toolbar (search/filter/add) full-width di atas; di bawah grid (kiri)
 * + `aside` (kanan, mis. panel Info AI). `aside` opsional.
 */
export function CatalogPanel({
  aside,
  onStockChanged,
  scopeToUnit = false,
}: {
  aside?: ReactNode;
  /** Dipanggil setelah stok berubah (tambah stok / edit item) agar panel
   *  riwayat stok di `aside` ikut ter-refresh tanpa reload halaman. */
  onStockChanged?: () => void;
  /** Hub kalender: item di-scope ke unit aktif (business_units), form tampilkan
   *  kategori tarif akomodasi. POS/produk: false (per-bisnis, perilaku lama). */
  scopeToUnit?: boolean;
}) {
  const { activeBusiness, userRole, user } = useBusinessContext();
  const { t } = useLanguage();
  const tc = t.catalog;
  const businessId = activeBusiness?.id;
  const canManage = isManagerRole(userRole);
  const isAccommodation = isAccommodationSector(activeBusiness?.business_sector);
  // Unit aktif (dibagi dgn tab Kalender). Hanya dipakai bila scopeToUnit.
  const { selectedUnit } = useCalendarUnit();
  const scopedUnitId = scopeToUnit ? selectedUnit?.id ?? null : undefined;
  // Ikon item katalog mengikuti sektor bisnis aktif (mis. F&B → garpu-sendok).
  const SectorIcon = getSectorIcon(activeBusiness?.business_sector);

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<CatalogItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<CatalogItem | null>(null);
  // Modal "Tambah Stok" — aksi cepat barang masuk tanpa buka form edit
  const [stockItem, setStockItem] = useState<CatalogItem | null>(null);
  const [stockQtyInput, setStockQtyInput] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Pulihkan preferensi view (grid/list) dari localStorage setelah mount.
  useEffect(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    if (saved === 'grid' || saved === 'list') setViewMode(saved);
  }, []);

  function changeView(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  }

  useEffect(() => {
    async function fetchData() {
      if (!businessId) return;
      setLoading(true);
      try {
        const [itemsData, accountsData] = await Promise.all([
          // scopeToUnit: hanya item unit aktif; selain itu semua item bisnis (POS).
          scopeToUnit
            ? catalogApi.getCatalogItems(businessId, { unitId: scopedUnitId })
            : catalogApi.getCatalogItems(businessId),
          getAccounts(businessId, false),
        ]);
        setItems(itemsData);
        setAccounts(accountsData);
      } catch (err) {
        console.error('Failed to fetch catalog:', err);
        toast.error(tc.toastLoadFailed);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, scopeToUnit, scopedUnitId]);

  const revenueAccounts = useMemo(
    () => accounts.filter(a => a.account_type === 'REVENUE' && a.is_active),
    [accounts]
  );

  const existingSkus = useMemo(
    () => items.filter(i => i.sku).map(i => i.sku!.toLowerCase()),
    [items]
  );

  const filteredItems = useMemo(() => {
    let list = items;
    if (!showInactive) list = list.filter(i => i.is_active);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.description?.toLowerCase().includes(q) ?? false)
      );
    }
    return list;
  }, [items, showInactive, searchQuery]);

  function openAdd() {
    setEditItem(null);
    setShowForm(true);
  }

  function openEdit(item: CatalogItem) {
    setEditItem(item);
    setShowForm(true);
  }

  async function handleSubmit(data: CatalogItemFormData) {
    if (!businessId || !user) return;
    setSaving(true);
    try {
      if (editItem) {
        const updated = await catalogApi.updateCatalogItem(editItem.id, data);
        setItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
        // Koreksi stok lewat form juga tercatat di riwayat
        if (Number(editItem.stock_qty ?? 0) !== Number(updated.stock_qty ?? 0)) {
          onStockChanged?.();
        }
        toast.success(tc.toastUpdated);
      } else {
        const created = await catalogApi.createCatalogItem({
          business_id: businessId,
          created_by: user.id,
          // Scope item baru ke unit aktif (hub kalender). POS → NULL (per-bisnis).
          ...(scopeToUnit ? { unit_id: scopedUnitId } : {}),
          ...data,
        });
        setItems(prev => [...prev, created]);
        toast.success(tc.toastCreated);
      }
      setShowForm(false);
      setEditItem(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : tc.toastSaveFailed;
      // Satu-satunya unique constraint katalog kini SKU (migr 121)
      toast.error(msg.includes('unique') || msg.includes('duplicate') ? tc.errorSkuTaken : msg);
    } finally {
      setSaving(false);
    }
  }

  function openAddStock(item: CatalogItem) {
    setStockItem(item);
    setStockQtyInput('');
  }

  async function handleAddStock() {
    if (!stockItem) return;
    const qty = Number(stockQtyInput);
    if (!qty || qty <= 0) return;
    setSaving(true);
    try {
      const newQty = await catalogApi.incrementStock(stockItem.id, qty);
      if (newQty == null) throw new Error(tc.addStockFailed);
      setItems(prev => prev.map(i => (i.id === stockItem.id ? { ...i, stock_qty: newQty } : i)));
      onStockChanged?.();
      toast.success(tc.addStockSuccess);
      setStockItem(null);
      setStockQtyInput('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc.addStockFailed);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteItem) return;
    setSaving(true);
    try {
      await catalogApi.deleteCatalogItem(deleteItem.id);
      setItems(prev => prev.filter(i => i.id !== deleteItem.id));
      toast.success(tc.toastDeleted);
      setDeleteItem(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc.toastDeleteFailed);
    } finally {
      setSaving(false);
    }
  }

  // Chip kategori tarif akomodasi (migr 124) — Weekday/Weekend/Bulanan / Add-on.
  const renderRateChip = (item: CatalogItem) => {
    if (!scopeToUnit || item.item_type !== 'service' || !item.service_role) return null;
    const label =
      item.service_role === 'addon'
        ? tc.serviceRoleAddon
        : item.rate_kind === 'weekend'
          ? tc.rateKindWeekend
          : item.rate_kind === 'monthly'
            ? tc.rateKindMonthly
            : tc.rateKindWeekday;
    const isMain = item.service_role === 'main';
    return (
      <span
        className={`shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-tight ${
          isMain
            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
        }`}
      >
        {label}
      </span>
    );
  };

  // Chip SKU — identitas unik item (migr 121), dirender di KIRI nama
  const renderSku = (item: CatalogItem) => {
    if (item.item_type !== 'product' || !item.sku) return null;
    return (
      <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 font-mono text-[11px] uppercase tracking-tight text-gray-500 dark:text-gray-400">
        {item.sku}
      </span>
    );
  };

  // Baris sisa stok (hanya item produk yang melacak stok)
  const renderStock = (item: CatalogItem) => {
    if (item.item_type !== 'product' || !item.track_stock) return null;
    const qty = Number(item.stock_qty ?? 0);
    return (
      <p className="text-xs mt-0.5">
        {qty > 0 ? (
          <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {tc.stockLabel}:{' '}
            <span className="font-semibold tabular-nums text-gray-700 dark:text-gray-300">
              {qty.toLocaleString('id-ID')}
            </span>
            {item.unit ? ` ${item.unit}` : ''}
          </span>
        ) : (
          <span className="text-red-600 dark:text-red-400 font-medium whitespace-nowrap">
            {tc.stockOut}
          </span>
        )}
      </p>
    );
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card border border-transparent dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tc.searchPlaceholder}
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowInactive(v => !v)}
            className={`flex items-center gap-1.5 text-sm whitespace-nowrap transition-colors ${showInactive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            {showInactive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            Inactive
          </button>
          {/* View toggle (grid / list) — segmented */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-gray-100 dark:bg-gray-700">
            <button
              type="button"
              onClick={() => changeView('grid')}
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
              title="Grid"
              className={`p-1.5 rounded-full transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-gray-600 text-indigo-500 dark:text-indigo-400 shadow-sm'
                  : 'bg-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => changeView('list')}
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
              title="List"
              className={`p-1.5 rounded-full transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-600 text-indigo-500 dark:text-indigo-400 shadow-sm'
                  : 'bg-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          {canManage && (
            <button
              onClick={openAdd}
              className="btn-primary-glow flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              {tc.addItem}
            </button>
          )}
        </div>
      </div>

      {/* Bawah: grid katalog (kiri) + aside Info AI (kanan) */}
      <div className="flex flex-col xl:flex-row gap-6 items-start">
        <div className="flex-1 min-w-0 w-full">
      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">{tc.loading}</div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            {items.length === 0 ? tc.emptyAll : tc.emptyFiltered}
          </p>
          {canManage && items.length === 0 && (
            <button onClick={openAdd} className="mt-3 text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
              {tc.addFirstItem}
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredItems.map(item => {
            return (
              <div
                key={item.id}
                // Klik kartu = buka editor (sama seperti list view)
                onClick={canManage ? () => openEdit(item) : undefined}
                role={canManage ? 'button' : undefined}
                tabIndex={canManage ? 0 : undefined}
                onKeyDown={canManage ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEdit(item); }
                } : undefined}
                className={`group relative rounded-xl border p-4 transition-colors ${
                  canManage ? 'cursor-pointer hover:border-indigo-200 dark:hover:border-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500' : ''
                } ${
                  item.is_active
                    ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                    : 'border-gray-200/60 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-800/40 opacity-70'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <SectorIcon className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {renderSku(item)}
                      {renderRateChip(item)}
                      <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{item.name}</p>
                    </div>
                    <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium tabular-nums">
                      {formatCurrency(item.default_price)}
                      {item.unit && <span className="text-gray-400 dark:text-gray-500 font-normal"> / {item.unit}</span>}
                    </p>
                    {renderStock(item)}
                    {item.description && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
                {!item.is_active && (
                  <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {tc.inactiveBadge}
                  </span>
                )}
                {canManage && (
                  <div className="absolute bottom-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.item_type === 'product' && item.track_stock && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openAddStock(item); }}
                        className="p-1.5 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                        title={tc.addStockTitle}
                      >
                        <PackagePlus className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteItem(item); }}
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      title={tc.delete}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredItems.map(item => {
            return (
              <div
                key={item.id}
                // Klik baris = buka editor (menggantikan ikon pensil).
                // Tombol aksi di kanan pakai stopPropagation agar tak ikut memicu.
                onClick={canManage ? () => openEdit(item) : undefined}
                role={canManage ? 'button' : undefined}
                tabIndex={canManage ? 0 : undefined}
                onKeyDown={canManage ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEdit(item); }
                } : undefined}
                className={`group flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  canManage ? 'cursor-pointer hover:border-indigo-200 dark:hover:border-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500' : ''
                } ${
                  item.is_active
                    ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                    : 'border-gray-200/60 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-800/40 opacity-70'
                }`}
              >
                <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <SectorIcon className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    {renderSku(item)}
                    {renderRateChip(item)}
                    <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{item.name}</p>
                    {!item.is_active && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex-shrink-0">
                        {tc.inactiveBadge}
                      </span>
                    )}
                  </div>
                  {renderStock(item)}
                  {item.description && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                      {item.description}
                    </p>
                  )}
                </div>
                {/* Harga + slot aksi dibungkus satu wrapper agar jaraknya lepas
                    dari gap-3 baris. Slot aksi menciut ke 0 saat idle (harga mepet
                    pojok) lalu melebar saat hover; wrapper gap-1 menjaga harga
                    hanya sedikit di kiri ikon. */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium tabular-nums whitespace-nowrap">
                    {formatCurrency(item.default_price)}
                    {item.unit && <span className="text-gray-400 dark:text-gray-500 font-normal"> / {item.unit}</span>}
                  </p>
                  {canManage && (
                    <div className="flex justify-end items-center gap-0.5 overflow-hidden w-0 group-hover:w-[4.25rem] opacity-0 group-hover:opacity-100 transition-all duration-200">
                      {item.item_type === 'product' && item.track_stock && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openAddStock(item); }}
                          className="p-1.5 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                          title={tc.addStockTitle}
                        >
                          <PackagePlus className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteItem(item); }}
                        className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                        title={tc.delete}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
        </div>

        {aside && (
          <div className="w-full xl:w-96 xl:flex-shrink-0 xl:sticky xl:top-6">
            {aside}
          </div>
        )}
      </div>

      {/* Form modal */}
      <AnimatedDialog isOpen={showForm} onClose={() => { setShowForm(false); setEditItem(null); }}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {editItem ? tc.formEditTitle : tc.formAddTitle}
            </h2>
            <button
              onClick={() => { setShowForm(false); setEditItem(null); }}
              className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <CatalogItemForm
            businessId={businessId!}
            item={editItem}
            revenueAccounts={revenueAccounts}
            existingSkus={existingSkus}
            businessType={activeBusiness?.business_type}
            isAccommodation={scopeToUnit && isAccommodation}
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setEditItem(null); }}
            loading={saving}
          />
        </div>
      </AnimatedDialog>

      {/* Tambah stok */}
      <AnimatedDialog isOpen={!!stockItem} onClose={() => setStockItem(null)}>
        <div className="p-6">
          <div className="w-11 h-11 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center mb-4">
            <PackagePlus className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">{tc.addStockTitle}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            <span className="font-medium text-gray-700 dark:text-gray-300">{stockItem?.name}</span>
            {' — '}{tc.addStockCurrent}{' '}
            <span className="font-semibold tabular-nums">
              {Number(stockItem?.stock_qty ?? 0).toLocaleString('id-ID')}
            </span>
            {stockItem?.unit ? ` ${stockItem.unit}` : ''}
          </p>
          <label className="label">{tc.addStockQtyLabel}</label>
          <input
            type="number"
            min={1}
            step="any"
            autoFocus
            value={stockQtyInput}
            onChange={(e) => setStockQtyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleAddStock(); }
            }}
            placeholder="0"
            className="input tabular-nums mb-5"
          />
          <div className="flex gap-3">
            <button
              onClick={() => setStockItem(null)}
              disabled={saving}
              className="btn-secondary flex-1"
            >
              {tc.cancel}
            </button>
            <button
              onClick={handleAddStock}
              disabled={saving || !(Number(stockQtyInput) > 0)}
              className="btn-primary-glow flex-1"
            >
              {saving ? tc.saving : tc.addStockSubmit}
            </button>
          </div>
        </div>
      </AnimatedDialog>

      {/* Delete confirmation */}
      <AnimatedDialog isOpen={!!deleteItem} onClose={() => setDeleteItem(null)}>
        <div className="p-6">
          <div className="w-11 h-11 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center mb-4">
            <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">{tc.deleteTitle}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
            {(() => {
              const parts = tc.deleteBody.split('{name}');
              return (
                <>
                  {parts[0]}
                  <span className="font-medium text-gray-700 dark:text-gray-300">{deleteItem?.name}</span>
                  {parts[1]}
                </>
              );
            })()}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteItem(null)}
              disabled={saving}
              className="btn-secondary flex-1"
            >
              {tc.cancel}
            </button>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="btn-danger-glow flex-1"
            >
              {saving ? tc.deleting : tc.delete}
            </button>
          </div>
        </div>
      </AnimatedDialog>
    </div>
  );
}
