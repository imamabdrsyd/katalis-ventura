'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Camera, X, Loader2 } from 'lucide-react';
import type { Business } from '@/types';

export interface BusinessFormData {
  business_name: string;
  business_type: string;
  business_category: string;
  property_address: string;
  capital_investment?: number;
  logo_url?: string;
  _logoFile?: File;
}

interface BusinessFormProps {
  business?: Business | null;
  onSubmit: (data: BusinessFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const BUSINESS_SECTORS = [
  { value: 'agribusiness', label: 'Agribusiness' },
  { value: 'personal_care', label: 'Personal Care' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'creative_agency', label: 'Creative Agency' },
  { value: 'food_and_beverage', label: 'F&B' },
  { value: 'finance', label: 'Finance' },
  { value: 'other', label: 'Lainnya (Custom)' },
];

const BUSINESS_CATEGORIES = [
  { value: 'jasa', label: 'Jasa' },
  { value: 'produk', label: 'Produk' },
  { value: 'dagang', label: 'Dagang' },
];

export function BusinessForm({
  business,
  onSubmit,
  onCancel,
  loading = false,
}: BusinessFormProps) {
  // Check if existing business_type (sector) is custom (not in predefined list)
  const isCustomSector = business?.business_type &&
    !BUSINESS_SECTORS.some(s => s.value === business.business_type);

  const [formData, setFormData] = useState<BusinessFormData>({
    business_name: business?.business_name || '',
    business_type: isCustomSector ? 'other' : (business?.business_type || 'agribusiness'),
    business_category: business?.business_category || 'jasa',
    property_address: business?.property_address || '',
    capital_investment: business?.capital_investment || 0,
    logo_url: business?.logo_url || '',
  });
  const [customSector, setCustomSector] = useState(isCustomSector ? business?.business_type || '' : '');
  const [errors, setErrors] = useState<Partial<Record<keyof BusinessFormData, string>>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Hanya file gambar yang diperbolehkan');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Ukuran file maksimal 2MB');
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
        if (!res.ok) throw new Error(json.error || 'Gagal upload logo');
        setFormData((prev) => ({ ...prev, logo_url: json.url }));
      } catch (err: any) {
        setUploadError(err.message || 'Gagal upload logo');
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
      newErrors.business_name = 'Nama bisnis harus diisi';
    }
    if (formData.business_type === 'other' && !customSector.trim()) {
      newErrors.business_type = 'Sektor bisnis harus diisi';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      const submitData = {
        ...formData,
        business_type: formData.business_type === 'other' ? customSector.trim() : formData.business_type,
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
                  className="w-full h-full object-cover"
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
          <div className="text-sm text-gray-500 dark:text-gray-400">
            <p>Klik untuk upload logo</p>
            <p className="text-xs mt-1">JPG, PNG, WebP, GIF. Maks 2MB</p>
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
        <label className="label">Nama Bisnis *</label>
        <input
          type="text"
          name="business_name"
          value={formData.business_name}
          onChange={handleChange}
          className="input"
          placeholder="cth: Katalis Studio"
          required
        />
        {errors.business_name && (
          <p className="text-sm text-red-500 mt-1">{errors.business_name}</p>
        )}
      </div>

      {/* Tipe Bisnis */}
      <div>
        <label className="label">Tipe Bisnis</label>
        <select
          name="business_category"
          value={formData.business_category}
          onChange={handleChange}
          className="input"
        >
          {BUSINESS_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Sektor */}
      <div>
        <label className="label">Sektor</label>
        <select
          name="business_type"
          value={formData.business_type}
          onChange={handleChange}
          className="input"
        >
          {BUSINESS_SECTORS.map((sector) => (
            <option key={sector.value} value={sector.value}>
              {sector.label}
            </option>
          ))}
        </select>
        {formData.business_type === 'other' && (
          <input
            type="text"
            value={customSector}
            onChange={(e) => {
              setCustomSector(e.target.value);
              if (errors.business_type) {
                setErrors((prev) => ({ ...prev, business_type: undefined }));
              }
            }}
            className="input mt-3"
            placeholder="Masukkan sektor bisnis"
          />
        )}
        {errors.business_type && (
          <p className="text-sm text-red-500 mt-1">{errors.business_type}</p>
        )}
      </div>

      {/* Alamat */}
      <div>
        <label className="label">Alamat Usaha</label>
        <textarea
          name="property_address"
          value={formData.property_address}
          onChange={handleChange}
          className="input"
          rows={3}
          placeholder="cth: Galeri Ciumbuleuit Apartment 2, Bandung"
        />
      </div>

      {/* Modal Investasi / Capital Investment */}
      <div>
        <label className="label">Modal Investasi (Rp)</label>
        <input
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
          className="input"
          placeholder="cth: 350000000"
          min="0"
        />
        <p className="text-xs text-gray-500 mt-1">Jumlah modal yang Anda investasikan ke bisnis ini</p>
      </div>

      {/* Buttons */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary flex-1"
          disabled={loading}
        >
          Batal
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={loading}>
          {loading ? 'Menyimpan...' : business ? 'Update Bisnis' : 'Tambah Bisnis'}
        </button>
      </div>
    </form>
  );
}