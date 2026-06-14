'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useBusinessContext } from '@/context/BusinessContext';
import { useLanguage } from '@/context/LanguageContext';
import type { CatalogItem, Account } from '@/types';
import * as catalogApi from '@/lib/api/catalog';
import { getAccounts } from '@/lib/api/accounts';
import { isManagerRole } from '@/lib/roles';
import { formatCurrency } from '@/lib/utils';
import { CatalogItemForm, type CatalogItemFormData } from '@/components/catalog/CatalogItemForm';
import { AnimatedDialog } from '@/components/ui/AnimatedDialog';
import {
  Plus, Search, Package, Wrench, Pencil, Trash2, X, Eye, EyeOff,
} from 'lucide-react';

/**
 * Panel manajemen Katalog produk/jasa di dalam HubPage.
 * Isi dipindahkan dari halaman /catalog lama (CRUD item katalog) — tanpa chrome
 * halaman (judul besar di-handle HubPage).
 *
 * Layout: toolbar (search/filter/add) full-width di atas; di bawah grid (kiri)
 * + `aside` (kanan, mis. panel Info AI). `aside` opsional.
 */
export function CatalogPanel({ aside }: { aside?: ReactNode }) {
  const { activeBusiness, userRole, user } = useBusinessContext();
  const { t } = useLanguage();
  const tc = t.catalog;
  const businessId = activeBusiness?.id;
  const canManage = isManagerRole(userRole);

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<CatalogItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<CatalogItem | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!businessId) return;
      setLoading(true);
      try {
        const [itemsData, accountsData] = await Promise.all([
          catalogApi.getCatalogItems(businessId),
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
  }, [businessId]);

  const revenueAccounts = useMemo(
    () => accounts.filter(a => a.account_type === 'REVENUE' && a.is_active),
    [accounts]
  );

  const existingNames = useMemo(
    () => items.map(i => i.name.toLowerCase()),
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
        toast.success(tc.toastUpdated);
      } else {
        const created = await catalogApi.createCatalogItem({
          business_id: businessId,
          created_by: user.id,
          ...data,
        });
        setItems(prev => [...prev, created]);
        toast.success(tc.toastCreated);
      }
      setShowForm(false);
      setEditItem(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : tc.toastSaveFailed;
      toast.error(msg.includes('unique') || msg.includes('duplicate') ? tc.errorNameTaken : msg);
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

  return (
    <div>
      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredItems.map(item => {
            const Icon = item.item_type === 'service' ? Wrench : Package;
            return (
              <div
                key={item.id}
                className={`group relative rounded-xl border p-4 transition-colors ${
                  item.is_active
                    ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                    : 'border-gray-200/60 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-800/40 opacity-70'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{item.name}</p>
                    <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium tabular-nums">
                      {formatCurrency(item.default_price)}
                      {item.unit && <span className="text-gray-400 dark:text-gray-500 font-normal"> / {item.unit}</span>}
                    </p>
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
                    <button
                      onClick={() => openEdit(item)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                      title={tc.edit}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteItem(item)}
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
            item={editItem}
            revenueAccounts={revenueAccounts}
            existingNames={existingNames}
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setEditItem(null); }}
            loading={saving}
          />
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
