'use client';

import { useState, useEffect } from 'react';
import type { Business } from '@/types';

export interface BusinessFormData {
  business_name: string;
  business_type: string;
  property_address: string;
}

interface BusinessFormProps {
  business?: Business | null;
  onSubmit: (data: BusinessFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const BUSINESS_TYPES = [
  { value: 'agribusiness', label: 'Agribusiness' },
  { value: 'personal_care', label: 'Personal Care' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'creative_agency', label: 'Creative Agency' },
  { value: 'food_and_beverage', label: 'F&B' },
  { value: 'finance', label: 'Finance' },
  { value: 'other', label: 'Lainnya (Custom)' },
];

export function BusinessForm({
  business,
  onSubmit,
  onCancel,
  loading = false,
}: BusinessFormProps) {
  // Check if existing business type is custom (not in predefined list)
  const isCustomType = business?.business_type &&
    !BUSINESS_TYPES.some(t => t.value === business.business_type);

  const [formData, setFormData] = useState<BusinessFormData>({
    business_name: business?.business_name || '',
    business_type: isCustomType ? 'other' : (business?.business_type || 'agribusiness'),
    property_address: business?.property_address || '',
  });
  const [customType, setCustomType] = useState(isCustomType ? business?.business_type || '' : '');
  const [errors, setErrors] = useState<Partial<Record<keyof BusinessFormData, string>>>({});

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof BusinessFormData, string>> = {};

    if (!formData.business_name.trim()) {
      newErrors.business_name = 'Nama bisnis harus diisi';
    }
    if (formData.business_type === 'other' && !customType.trim()) {
      newErrors.business_type = 'Tipe bisnis harus diisi';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      const submitData = {
        ...formData,
        business_type: formData.business_type === 'other' ? customType.trim() : formData.business_type,
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
          name="business_type"
          value={formData.business_type}
          onChange={handleChange}
          className="input"
        >
          {BUSINESS_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        {formData.business_type === 'other' && (
          <input
            type="text"
            value={customType}
            onChange={(e) => {
              setCustomType(e.target.value);
              if (errors.business_type) {
                setErrors((prev) => ({ ...prev, business_type: undefined }));
              }
            }}
            className="input mt-3"
            placeholder="Masukkan tipe bisnis custom"
          />
        )}
        {errors.business_type && (
          <p className="text-sm text-red-500 mt-1">{errors.business_type}</p>
        )}
      </div>

      {/* Alamat Properti */}
      <div>
        <label className="label">Alamat Properti</label>
        <textarea
          name="property_address"
          value={formData.property_address}
          onChange={handleChange}
          className="input"
          rows={3}
          placeholder="cth: Galeri Ciumbuleuit Apartment 2, Bandung"
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
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
