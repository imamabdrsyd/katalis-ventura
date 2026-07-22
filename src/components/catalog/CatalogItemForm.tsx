'use client';

import { useState, useEffect, useMemo, useRef, useId } from 'react';
import type { CatalogItem, CatalogItemType, Account, ServiceRole, RateKind } from '@/types';
import { AlertCircle, Package, Wrench, Camera, Crop, ImageIcon, Loader2, Maximize2, X } from 'lucide-react';
import { CurrencyInputWithCalculator } from '@/components/ui/CurrencyInputWithCalculator';
import FloatingField, { FloatingSelect } from '@/components/ui/FloatingField';
import { useLanguage } from '@/context/LanguageContext';

export interface CatalogItemFormData {
  name: string;
  description?: string | null;
  item_type: CatalogItemType;
  default_price: number;
  unit?: string | null;
  service_role?: ServiceRole | null;
  rate_kind?: RateKind | null;
  revenue_account_id?: string | null;
  sku?: string | null;
  track_stock?: boolean;
  stock_qty?: number;
  is_active: boolean;
  image_url?: string | null;
  image_fit?: 'cover' | 'contain' | null;
  image_position_x?: number | null;
  image_position_y?: number | null;
  link_url?: string | null;
  link_label?: string | null;
}

interface CatalogItemFormProps {
  businessId: string;
  item?: CatalogItem | null;
  revenueAccounts: Account[];
  existingSkus?: string[]; // lowercase SKUs already used (for uniqueness check)
  /** businesses.business_type — menentukan tipe item yang tersedia:
   *  'jasa' → service saja; 'produk'/'dagang' → product saja; null → keduanya. */
  businessType?: string | null;
  /** Bisnis sektor akomodasi → tampilkan pilihan main/addon + kategori tarif
   *  (weekday/weekend/monthly) yang menyetir base price kalender (migr 124). */
  isAccommodation?: boolean;
  onSubmit: (data: CatalogItemFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const TYPE_OPTIONS: { value: CatalogItemType; icon: typeof Package }[] = [
  { value: 'product', icon: Package },
  { value: 'service', icon: Wrench },
];

export function CatalogItemForm({
  businessId,
  item,
  revenueAccounts,
  existingSkus = [],
  businessType,
  isAccommodation = false,
  onSubmit,
  onCancel,
  loading = false,
}: CatalogItemFormProps) {
  const { t } = useLanguage();
  const tc = t.catalog;
  const isEditMode = !!item;
  const descriptionId = useId();

  // Tipe item mengikuti tipe bisnis: jasa → service saja, produk/dagang →
  // product saja. Selector tipe hanya dirender bila ada >1 pilihan.
  // Item lama yang tipenya di luar aturan tetap diakomodasi (jaga data).
  const defaultItemType: CatalogItemType = businessType === 'jasa' ? 'service' : 'product';
  const allowedTypes = useMemo<CatalogItemType[]>(() => {
    const base: CatalogItemType[] =
      businessType === 'jasa'
        ? ['service']
        : businessType === 'produk' || businessType === 'dagang'
          ? ['product']
          : ['product', 'service'];
    if (item && !base.includes(item.item_type)) return [item.item_type, ...base];
    return base;
  }, [businessType, item]);

  const [formData, setFormData] = useState<CatalogItemFormData>({
    name: item?.name ?? '',
    description: item?.description ?? '',
    item_type: item?.item_type ?? defaultItemType,
    default_price: item?.default_price ?? 0,
    unit: item?.unit ?? '',
    service_role: item?.service_role ?? (isAccommodation ? 'main' : null),
    rate_kind: item?.rate_kind ?? (isAccommodation ? 'weekday' : null),
    revenue_account_id: item?.revenue_account_id ?? null,
    sku: item?.sku ?? '',
    track_stock: item?.track_stock ?? false,
    stock_qty: item?.stock_qty ?? 0,
    is_active: item?.is_active ?? true,
    image_url: item?.image_url ?? '',
    image_fit: item?.image_fit ?? 'cover',
    image_position_x: item?.image_position_x ?? 50,
    image_position_y: item?.image_position_y ?? 50,
    link_url: item?.link_url ?? '',
    link_label: item?.link_label ?? '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [priceDisplay, setPriceDisplay] = useState<string>(
    item?.default_price ? item.default_price.toLocaleString('id-ID') : ''
  );

  // ── Image upload + focal point state ──────────────────────────────────────
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [draggingFocal, setDraggingFocal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const focalAreaRef = useRef<HTMLDivElement>(null);

  const imageUrl = formData.image_url ?? '';
  const imageFit = formData.image_fit ?? 'cover';
  const posX = formData.image_position_x ?? 50;
  const posY = formData.image_position_y ?? 50;

  // Reset when switching target item
  useEffect(() => {
    setFormData({
      name: item?.name ?? '',
      description: item?.description ?? '',
      item_type: item?.item_type ?? defaultItemType,
      default_price: item?.default_price ?? 0,
      unit: item?.unit ?? '',
      service_role: item?.service_role ?? (isAccommodation ? 'main' : null),
      rate_kind: item?.rate_kind ?? (isAccommodation ? 'weekday' : null),
      revenue_account_id: item?.revenue_account_id ?? null,
      sku: item?.sku ?? '',
      track_stock: item?.track_stock ?? false,
      stock_qty: item?.stock_qty ?? 0,
      is_active: item?.is_active ?? true,
      image_url: item?.image_url ?? '',
      image_fit: item?.image_fit ?? 'cover',
      image_position_x: item?.image_position_x ?? 50,
      image_position_y: item?.image_position_y ?? 50,
      link_url: item?.link_url ?? '',
      link_label: item?.link_label ?? '',
    });
    setPriceDisplay(item?.default_price ? item.default_price.toLocaleString('id-ID') : '');
    setErrors({});
    setUploadError('');
  }, [item, defaultItemType, isAccommodation]);

  const updateFocalFromEvent = (clientX: number, clientY: number) => {
    const el = focalAreaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    setFormData(prev => ({ ...prev, image_position_x: Math.round(x), image_position_y: Math.round(y) }));
  };

  useEffect(() => {
    if (!draggingFocal) return;
    const onMove = (e: MouseEvent) => updateFocalFromEvent(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) updateFocalFromEvent(t.clientX, t.clientY);
    };
    const onUp = () => setDraggingFocal(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouch);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('touchend', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingFocal]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Hanya file gambar yang diperbolehkan');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Ukuran file maksimal 5MB');
      return;
    }

    setUploading(true);
    setUploadError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/catalog/${businessId}/photo`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal upload gambar');
      setFormData(prev => ({ ...prev, image_url: json.url }));
    } catch (err: any) {
      setUploadError(err.message || 'Gagal upload gambar');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Nama item sengaja TIDAK dicek unik (migr 121) — varian sah bernama sama
  // (mis. "Castor Oil" L & S). Identitas unik item = SKU.

  // SKUs taken by *other* items (exclude self when editing)
  const takenSkus = useMemo(() => {
    const self = item?.sku?.toLowerCase();
    return new Set(existingSkus.filter(s => s !== self));
  }, [existingSkus, item]);

  const isProduct = formData.item_type === 'product';

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!formData.name.trim()) {
      next.name = tc.errorNameRequired;
    }
    if (formData.default_price < 0) {
      next.default_price = tc.errorPriceNegative;
    }
    const sku = formData.sku?.trim();
    if (isProduct && sku && takenSkus.has(sku.toLowerCase())) {
      next.sku = tc.errorSkuTaken;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const hasImage = !!(formData.image_url && formData.image_url.trim());
    // Kategori tarif hanya berlaku untuk layanan akomodasi. Produk / non-akomodasi
    // → null. Add-on → rate_kind null (tak menyetir harga kalender).
    const isService = formData.item_type === 'service';
    const serviceRole = isAccommodation && isService ? (formData.service_role ?? 'main') : null;
    const rateKind = serviceRole === 'main' ? (formData.rate_kind ?? 'weekday') : null;
    await onSubmit({
      ...formData,
      name: formData.name.trim(),
      description: formData.description?.trim() || null,
      unit: formData.unit?.trim() || null,
      service_role: serviceRole,
      rate_kind: rateKind,
      // SKU & stok hanya berlaku untuk item produk; jasa selalu bersih
      sku: isProduct ? formData.sku?.trim() || null : null,
      track_stock: isProduct ? (formData.track_stock ?? false) : false,
      stock_qty: isProduct && formData.track_stock ? Math.max(0, formData.stock_qty ?? 0) : 0,
      image_url: hasImage ? formData.image_url : null,
      image_fit: hasImage ? (formData.image_fit ?? 'cover') : null,
      image_position_x: hasImage && formData.image_fit === 'cover' ? (formData.image_position_x ?? 50) : null,
      image_position_y: hasImage && formData.image_fit === 'cover' ? (formData.image_position_y ?? 50) : null,
      link_url: formData.link_url?.trim() || null,
      link_label: formData.link_label?.trim() || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Tipe item — disembunyikan bila tipe bisnis hanya mengizinkan satu
          (produk→product, jasa→service); tipe di-set otomatis. */}
      {allowedTypes.length > 1 && (
        <div>
          <label className="label">{tc.typeLabel}</label>
          <div className="grid grid-cols-2 gap-2">
            {TYPE_OPTIONS.filter(({ value }) => allowedTypes.includes(value)).map(({ value, icon: Icon }) => {
              const active = formData.item_type === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, item_type: value }))}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                    active
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 ring-2 ring-primary-500/20'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {value === 'product' ? tc.typeProduct : tc.typeService}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Foto item — dipakai saat difitur di "Produk Unggulan" omni-channel */}
      <div>
        <label className="label">
          Foto <span className="text-gray-400 font-normal">(opsional)</span>
        </label>
        <div className="flex items-center gap-4">
          <div className="relative group shrink-0">
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 flex items-center justify-center">
              {imageUrl ? (
                <img src={imageUrl} alt={formData.name || 'Item'} className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-7 h-7 text-gray-400" />
              )}
            </div>
            <label className={`absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl cursor-pointer transition-opacity ${uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              {uploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="hidden" />
            </label>
            {imageUrl && !uploading && (
              <button
                type="button"
                onClick={() => { setFormData(prev => ({ ...prev, image_url: '' })); setUploadError(''); }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">Klik foto untuk upload. Tampil saat item difitur di halaman publik.</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">JPG, PNG, WebP · Maks. 5MB</p>
            {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
          </div>
        </div>

        {imageUrl && (
          <div className="mt-4 space-y-3">
            {/* Fit mode toggle */}
            <div className="inline-flex rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-1">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, image_fit: 'cover' }))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${imageFit === 'cover' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
              >
                <Crop className="w-3.5 h-3.5" />
                Potong (Crop)
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, image_fit: 'contain' }))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${imageFit === 'contain' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Tampilkan Penuh
              </button>
            </div>

            {imageFit === 'cover' && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Klik atau geser titik pada gambar untuk memilih bagian yang akan ditampilkan.
                </p>
                <div
                  ref={focalAreaRef}
                  onMouseDown={(e) => { setDraggingFocal(true); updateFocalFromEvent(e.clientX, e.clientY); }}
                  onTouchStart={(e) => {
                    const tt = e.touches[0];
                    if (tt) { setDraggingFocal(true); updateFocalFromEvent(tt.clientX, tt.clientY); }
                  }}
                  className="relative w-full max-w-sm aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 cursor-crosshair select-none"
                >
                  <img
                    src={imageUrl}
                    alt="Preview crop"
                    draggable={false}
                    className="w-full h-full object-cover pointer-events-none"
                    style={{ objectPosition: `${posX}% ${posY}%` }}
                  />
                  <div
                    className="absolute w-6 h-6 rounded-full border-2 border-white shadow-lg bg-indigo-500/80 -translate-x-1/2 -translate-y-1/2 pointer-events-none ring-2 ring-indigo-500/30"
                    style={{ left: `${posX}%`, top: `${posY}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5 font-mono">
                  Fokus: {posX}% · {posY}%
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nama */}
      <div>
        <FloatingField
          label={
            <>
              {formData.item_type === 'product' ? tc.nameLabelProduct : tc.nameLabelService}{' '}
              <span className="text-red-500">*</span>
            </>
          }
          type="text"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder={formData.item_type === 'product' ? tc.namePlaceholderProduct : tc.namePlaceholderService}
          autoFocus
        />
        {errors.name && (
          <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {errors.name}
          </p>
        )}
      </div>

      {/* Kategori layanan akomodasi (migr 124) — main (sewa, menyetir base price)
          vs add-on; bila main, pilih tarif weekday/weekend/monthly. */}
      {isAccommodation && formData.item_type === 'service' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <div>
            <label className="label">{tc.serviceRoleLabel}</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'main' as ServiceRole, label: tc.serviceRoleMain, hint: tc.serviceRoleMainHint },
                { value: 'addon' as ServiceRole, label: tc.serviceRoleAddon, hint: tc.serviceRoleAddonHint },
              ]).map(({ value, label, hint }) => {
                const active = (formData.service_role ?? 'main') === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, service_role: value }))}
                    className={`text-left px-3 py-2.5 rounded-xl border text-sm transition-all ${
                      active
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 ring-2 ring-primary-500/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <span className={`block font-medium ${active ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}`}>
                      {label}
                    </span>
                    <span className="block text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {(formData.service_role ?? 'main') === 'main' && (
            <div>
              <label className="label">{tc.rateKindLabel}</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'weekday' as RateKind, label: tc.rateKindWeekday },
                  { value: 'weekend' as RateKind, label: tc.rateKindWeekend },
                  { value: 'monthly' as RateKind, label: tc.rateKindMonthly },
                ]).map(({ value, label }) => {
                  const active = (formData.rate_kind ?? 'weekday') === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, rate_kind: value }))}
                      className={`px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                        active
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 ring-2 ring-primary-500/20'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Harga + satuan — items-end supaya underline keduanya sejajar */}
      <div className="grid grid-cols-2 gap-4 items-end">
        <div>
          <CurrencyInputWithCalculator
            label={
              isAccommodation && formData.item_type === 'service' && (formData.service_role ?? 'main') === 'main'
                ? ((formData.rate_kind ?? 'weekday') === 'monthly' ? tc.priceLabelPerMonth : tc.priceLabelPerNight)
                : tc.priceLabel
            }
            displayValue={priceDisplay}
            onChange={(val, display) => {
              setFormData(prev => ({ ...prev, default_price: val }));
              setPriceDisplay(display);
            }}
          />
          {errors.default_price && (
            <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.default_price}
            </p>
          )}
        </div>
        <FloatingField
          label={tc.unitLabel}
          type="text"
          value={formData.unit ?? ''}
          onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
          placeholder={tc.unitPlaceholder}
        />
      </div>

      {/* SKU + stok — hanya untuk item produk */}
      {isProduct && (
        <>
          <div>
            <FloatingField
              label={
                <>
                  {tc.skuLabel} <span className="text-gray-400 font-normal">({tc.optional})</span>
                </>
              }
              type="text"
              value={formData.sku ?? ''}
              onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
              placeholder={tc.skuPlaceholder}
              maxLength={64}
              className="font-mono"
            />
            {errors.sku && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.sku}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.track_stock ?? false}
                onChange={(e) => setFormData(prev => ({ ...prev, track_stock: e.target.checked }))}
                className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {tc.trackStockLabel}
              </span>
            </label>
            <p className="text-xs text-gray-400 dark:text-gray-500 -mt-1">
              {tc.trackStockHint}
            </p>
            {formData.track_stock && (
              <div>
                <FloatingField
                  label={tc.stockQtyLabel}
                  type="number"
                  min={0}
                  step="any"
                  value={formData.stock_qty ?? 0}
                  onChange={(e) => setFormData(prev => ({ ...prev, stock_qty: Math.max(0, Number(e.target.value) || 0) }))}
                  className="tabular-nums"
                  trailing={
                    formData.unit?.trim() ? (
                      <span className="text-sm text-gray-400 dark:text-gray-500">
                        {formData.unit.trim()}
                      </span>
                    ) : undefined
                  }
                />
                {isEditMode && (
                  <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                    {tc.stockQtyHintEdit}
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Akun pendapatan — opsi placeholder sengaja kosong: label FloatingSelect
          yang berperan sebagai placeholder */}
      <div>
        <FloatingSelect
          label={tc.revenueAccountLabel}
          value={formData.revenue_account_id ?? ''}
          onChange={(e) => setFormData(prev => ({ ...prev, revenue_account_id: e.target.value || null }))}
        >
          <option value="" />
          {revenueAccounts.map(acc => (
            <option key={acc.id} value={acc.id}>
              {acc.account_code} - {acc.account_name}
            </option>
          ))}
        </FloatingSelect>
        <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
          {tc.revenueAccountHint}
        </p>
      </div>

      {/* Deskripsi — textarea gaya underline mengikuti pola FloatingField
          (peer + :placeholder-shown untuk float label) */}
      <div className="relative">
        <textarea
          id={descriptionId}
          value={formData.description ?? ''}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          rows={2}
          placeholder={tc.descriptionPlaceholder || ' '}
          className="peer block w-full appearance-none border-0 border-b-2 border-gray-300 dark:border-gray-600 bg-transparent px-0 pt-5 pb-1.5 text-gray-900 dark:text-gray-100 outline-none transition-colors resize-none
            placeholder:text-transparent focus:placeholder:text-gray-400 dark:focus:placeholder:text-gray-500
            focus:border-primary-500 focus:ring-0"
        />
        <label
          htmlFor={descriptionId}
          className="pointer-events-none absolute left-0 origin-[0] transition-all duration-200 text-gray-500 dark:text-gray-400
            top-5 -translate-y-5 scale-75
            peer-placeholder-shown:top-5 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-placeholder-shown:text-gray-400 dark:peer-placeholder-shown:text-gray-500
            peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-primary-500"
        >
          {tc.descriptionLabel}
        </label>
      </div>

      {/* Link CTA — opsional. Kosong → klik produk di halaman publik buka WhatsApp. */}
      <div className="grid grid-cols-2 gap-4">
        <FloatingField
          label={
            <>
              Link Beli <span className="text-gray-400 font-normal">(opsional)</span>
            </>
          }
          type="url"
          value={formData.link_url ?? ''}
          onChange={(e) => setFormData(prev => ({ ...prev, link_url: e.target.value }))}
          placeholder="https://shopee.co.id/..."
        />
        <FloatingField
          label={
            <>
              Label Tombol <span className="text-gray-400 font-normal">(opsional)</span>
            </>
          }
          type="text"
          value={formData.link_label ?? ''}
          onChange={(e) => setFormData(prev => ({ ...prev, link_label: e.target.value }))}
          placeholder="Beli Sekarang"
          maxLength={100}
        />
      </div>
      <p className="-mt-3 text-xs text-gray-400 dark:text-gray-500">
        Kosongkan link untuk arahkan pembeli ke WhatsApp bisnis dengan pesan otomatis.
      </p>

      {/* Status aktif (edit only) */}
      {isEditMode && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.is_active}
            onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
            className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {tc.activeLabel}
          </span>
        </label>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="btn-secondary flex-1"
        >
          {tc.cancel}
        </button>
        <button
          type="submit"
          disabled={loading || uploading}
          className="btn-primary-glow flex-1"
        >
          {loading ? tc.saving : isEditMode ? tc.save : tc.create}
        </button>
      </div>
    </form>
  );
}
