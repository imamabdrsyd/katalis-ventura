'use client';

import { useState, useRef } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import Image from 'next/image';
import { Camera, X, Loader2 } from 'lucide-react';
import type { Business } from '@/types';
import FloatingField, { FloatingSelect } from '@/components/ui/FloatingField';
import { BUSINESS_SECTOR_PRESETS, BUSINESS_TYPE_PRESETS } from '@/lib/businessSectors';

export interface BusinessFormData {
  business_name: string;
  business_sector: string;
  business_type: string;
  property_address: string;
  capital_investment?: number;
  logo_url?: string;
  logo_fit?: 'cover' | 'contain';
  // Omnichannel widget (landing page)
  city?: string;
  is_public?: boolean;
  _logoFile?: File;
}

interface BusinessFormProps {
  business?: Business | null;
  onSubmit: (data: BusinessFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

// Preset resmi berasal dari businessSectors.ts (satu sumber, dipakai juga oleh
// gating fitur spesifik-sektor seperti Asset Console) + opsi "Lainnya" khusus
// UI form ini untuk free-text di luar preset.
const BUSINESS_SECTORS = [
  ...BUSINESS_SECTOR_PRESETS,
  { value: 'other', label: 'Lainnya (Custom)' },
];

const BUSINESS_CATEGORIES = BUSINESS_TYPE_PRESETS;

export function BusinessForm({
  business,
  onSubmit,
  onCancel,
  loading = false,
}: BusinessFormProps) {
  const { t } = useLanguage();
  const bf = t.businessForm;
  // Label kategori usaha diambil dari i18n, bukan dari label di
  // BUSINESS_TYPE_PRESETS — konstanta itu dipakai bersama modul lain dan tak
  // bisa membaca hook bahasa. Nilainya tetap satu sumber (presets).
  const categoryLabel = (value: string): string =>
    ({ jasa: bf.categoryJasa, produk: bf.categoryProduk, dagang: bf.categoryDagang })[value] ?? value;

  // Check if existing business_sector is custom (not in predefined list)
  const isCustomSector = business?.business_sector &&
    !BUSINESS_SECTORS.some(s => s.value === business.business_sector);

  const [formData, setFormData] = useState<BusinessFormData>({
    business_name: business?.business_name || '',
    business_sector: isCustomSector ? 'other' : (business?.business_sector || 'agribusiness'),
    business_type: business?.business_type || 'jasa',
    property_address: business?.property_address || '',
    capital_investment: business?.capital_investment || 0,
    logo_url: business?.logo_url || '',
    logo_fit: (business?.logo_fit as 'cover' | 'contain') || 'cover',
    city: business?.city || '',
    is_public: business?.is_public ?? false,
  });
  const [customSector, setCustomSector] = useState(isCustomSector ? business?.business_sector || '' : '');
  const [errors, setErrors] = useState<Partial<Record<keyof BusinessFormData, string>>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError(bf.imageOnly);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError(bf.maxFileSize);
      return;
    }

    // If editing existing business, upload directly via API
    if (business?.id) {
      setUploading(true);
      setUploadError('');
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`/api/businesses/${business.id}/logo`, {
          method: 'POST',
          body: formData,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || bf.logoUploadFailed);
        setFormData((prev) => ({ ...prev, logo_url: json.url }));
      } catch (err: any) {
        setUploadError(err.message || bf.logoUploadFailed);
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } else {
      // For new business, show preview and store file for upload after creation
      const previewUrl = URL.createObjectURL(file);
      setFormData((prev) => ({ ...prev, logo_url: previewUrl, _logoFile: file }));
    }
  };

  const handleRemoveLogo = () => {
    setFormData((prev) => ({ ...prev, logo_url: '', _logoFile: undefined }));
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof BusinessFormData, string>> = {};

    if (!formData.business_name.trim()) {
      newErrors.business_name = bf.nameRequired;
    }
    if (formData.business_sector === 'other' && !customSector.trim()) {
      newErrors.business_sector = bf.sectorRequired;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      const submitData = {
        ...formData,
        business_sector: formData.business_sector === 'other' ? customSector.trim() : formData.business_sector,
      };
      await onSubmit(submitData);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name as keyof BusinessFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6">
      {/* Logo Upload */}
      <div>
        <label className="label">Logo Bisnis</label>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div
              className="w-20 h-20 rounded-xl overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors bg-gray-50 dark:bg-gray-800"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
              ) : formData.logo_url ? (
                <Image
                  src={formData.logo_url}
                  alt="Logo bisnis"
                  width={80}
                  height={80}
                  className={`w-full h-full ${formData.logo_fit === 'contain' ? 'object-contain p-1' : 'object-cover'}`}
                  unoptimized
                />
              ) : (
                <Camera className="w-6 h-6 text-gray-400" />
              )}
            </div>
            {formData.logo_url && !uploading && (
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <p>{bf.clickToUploadLogo}</p>
              <p className="text-xs mt-0.5">JPG, PNG, WebP, GIF. Maks 2MB</p>
            </div>
            {formData.logo_url && (
              <div className="flex items-center gap-1 p-0.5 bg-gray-100 dark:bg-gray-700 rounded-lg w-fit">
                {(['cover', 'contain'] as const).map((fit) => (
                  <button
                    key={fit}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, logo_fit: fit }))}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      formData.logo_fit === fit
                        ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-100 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {fit === 'cover' ? bf.logoFitFull : bf.logoFitContain}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleLogoUpload}
          className="hidden"
        />
        {uploadError && (
          <p className="text-sm text-red-500 mt-2">{uploadError}</p>
        )}
      </div>

      {/* Nama Bisnis */}
      <div>
        <FloatingField
          label={bf.businessName}
          type="text"
          name="business_name"
          value={formData.business_name}
          onChange={handleChange}
          placeholder={bf.namePlaceholder}
          required
        />
        {errors.business_name && (
          <p className="text-sm text-red-500 mt-1">{errors.business_name}</p>
        )}
      </div>

      {/* Tipe Bisnis */}
      <div>
        <FloatingSelect
          label={bf.businessType}
          name="business_type"
          value={formData.business_type}
          onChange={handleChange}
        >
          {BUSINESS_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {categoryLabel(cat.value)}
            </option>
          ))}
        </FloatingSelect>
      </div>

      {/* Sektor */}
      <div>
        <FloatingSelect
          label={bf.sector}
          name="business_sector"
          value={formData.business_sector}
          onChange={handleChange}
        >
          {BUSINESS_SECTORS.map((sector) => (
            <option key={sector.value} value={sector.value}>
              {sector.value === 'other' ? bf.sectorCustom : sector.label}
            </option>
          ))}
        </FloatingSelect>
        {formData.business_sector === 'other' && (
          <div className="mt-3">
            <FloatingField
              label={bf.sectorCustomLabel}
              type="text"
              value={customSector}
              onChange={(e) => {
                setCustomSector(e.target.value);
                if (errors.business_sector) {
                  setErrors((prev) => ({ ...prev, business_sector: undefined }));
                }
              }}
              placeholder={bf.sectorPlaceholder}
            />
          </div>
        )}
        {errors.business_sector && (
          <p className="text-sm text-red-500 mt-1">{errors.business_sector}</p>
        )}
      </div>

      {/* Alamat */}
      <div>
        <label className="label">{bf.address}</label>
        <textarea
          name="property_address"
          value={formData.property_address}
          onChange={handleChange}
          className="input"
          rows={3}
          placeholder={bf.addressPlaceholder}
        />
      </div>

      {/* Modal Investasi / Capital Investment */}
      <div>
        <FloatingField
          label={bf.capitalInvestment}
          type="number"
          name="capital_investment"
          value={formData.capital_investment || ''}
          onChange={(e) => {
            const value = e.target.value ? parseInt(e.target.value) : 0;
            setFormData((prev) => ({
              ...prev,
              capital_investment: value,
            }));
          }}
          placeholder={bf.capitalPlaceholder}
          min="0"
        />
        <p className="text-xs text-gray-500 mt-1">{bf.capitalHint}</p>
      </div>

      {/* Omnichannel Widget — Landing Page */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Omnichannel Widget
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Tampilkan bisnis ini di landing page Axion. Untuk bisnis Jasa, visitor dapat
            mengirim rencana kunjungan langsung via WhatsApp.
          </p>
        </div>

        {/* Tampilkan di Landing Page */}
        <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="pr-4">
            <label
              htmlFor="is_public"
              className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
            >
              {bf.showOnLanding}
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {bf.showOnLandingHint}
            </p>
          </div>
          <input
            id="is_public"
            type="checkbox"
            checked={formData.is_public ?? false}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, is_public: e.target.checked }))
            }
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
          />
        </div>

        {/* Kota */}
        <div>
          <FloatingField
            label={bf.city}
            type="text"
            name="city"
            value={formData.city || ''}
            onChange={handleChange}
            placeholder={bf.cityPlaceholder}
          />
        </div>

        {/* Nomor WhatsApp & Label Aksi sudah dipindahkan ke OmniChannel Manager → Widget Utama */}
      </div>

      {/* Buttons */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary flex-1"
          disabled={loading}
        >
          {t.common.cancel}
        </button>
        <button type="submit" className="btn-primary-glow flex-1" disabled={loading}>
          {loading ? t.common.saving : business ? bf.updateBusiness : bf.addBusiness}
        </button>
      </div>
    </form>
  );
}