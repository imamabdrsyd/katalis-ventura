'use client';

import { useState, useRef } from 'react';
import { Camera, ImageIcon, Loader2, Package, X } from 'lucide-react';
import type { BusinessOmniChannel, FeaturedProduct } from '@/types';
import { upsertOmniChannel } from '@/lib/api/omniChannel';

interface Props {
  businessId: string;
  userId: string;
  channel: BusinessOmniChannel | null;
  onChanged: () => void;
}

const EMPTY: FeaturedProduct = {
  show: false,
  name: '',
  description: '',
  image_url: '',
  price_label: '',
  link_url: '',
  link_label: '',
};

export function OmniChannelFeaturedProductConfig({ businessId, userId, channel, onChanged }: Props) {
  const existing = channel?.featured_product ?? null;
  const [show, setShow] = useState(existing?.show ?? false);
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [imageUrl, setImageUrl] = useState(existing?.image_url ?? '');
  const [priceLabel, setPriceLabel] = useState(existing?.price_label ?? '');
  const [linkUrl, setLinkUrl] = useState(existing?.link_url ?? '');
  const [linkLabel, setLinkLabel] = useState(existing?.link_label ?? '');

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const savedRef = useRef({
    show: existing?.show ?? false,
    name: existing?.name ?? '',
    description: existing?.description ?? '',
    imageUrl: existing?.image_url ?? '',
    priceLabel: existing?.price_label ?? '',
    linkUrl: existing?.link_url ?? '',
    linkLabel: existing?.link_label ?? '',
  });

  const hasChanges =
    show !== savedRef.current.show ||
    name !== savedRef.current.name ||
    description !== savedRef.current.description ||
    imageUrl !== savedRef.current.imageUrl ||
    priceLabel !== savedRef.current.priceLabel ||
    linkUrl !== savedRef.current.linkUrl ||
    linkLabel !== savedRef.current.linkLabel;

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
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/omni-channel/${businessId}/banner`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal upload gambar');
      setImageUrl(json.url);
    } catch (err: any) {
      setUploadError(err.message || 'Gagal upload gambar');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!channel) return;
    setSaving(true);
    setSaveError('');
    try {
      const fp: FeaturedProduct = {
        show,
        name,
        description: description || undefined,
        image_url: imageUrl || undefined,
        price_label: priceLabel || undefined,
        link_url: linkUrl || undefined,
        link_label: linkLabel || undefined,
      };
      await upsertOmniChannel(businessId, {
        slug: channel.slug,
        title: channel.title,
        tagline: channel.tagline ?? null,
        bio: channel.bio ?? null,
        logo_url: channel.logo_url ?? null,
        is_published: channel.is_published,
        featured_product: fp,
      }, userId);
      savedRef.current = { show, name, description, imageUrl, priceLabel, linkUrl, linkLabel };
      onChanged();
    } catch (err: any) {
      setSaveError(err.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
      {/* Header + toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">Produk Unggulan</h3>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={show}
          onClick={() => setShow(!show)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${show ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${show ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {show && (
        <>
          {/* Product image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Foto Produk <span className="text-gray-400 font-normal">(opsional)</span>
            </label>
            <div className="flex items-center gap-4">
              <div className="relative group shrink-0">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 flex items-center justify-center">
                  {imageUrl ? (
                    <img src={imageUrl} alt="Produk" className="w-full h-full object-cover" />
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
                    onClick={() => { setImageUrl(''); setUploadError(''); }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400">Klik foto untuk upload gambar produk.</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Format: JPG, PNG, WebP · Maks. 5MB</p>
                {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nama Produk
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Minyak Kemiri Bakar 60ml"
              maxLength={200}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Deskripsi <span className="text-gray-400 font-normal">(opsional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Menebalkan & menghitamkan rambut secara alami..."
              maxLength={500}
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Price label */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Harga <span className="text-gray-400 font-normal">(opsional)</span>
              </label>
              <input
                type="text"
                value={priceLabel}
                onChange={(e) => setPriceLabel(e.target.value)}
                placeholder="Rp 85.000"
                maxLength={100}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* CTA label */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Label Tombol <span className="text-gray-400 font-normal">(opsional)</span>
              </label>
              <input
                type="text"
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                placeholder="Beli Sekarang"
                maxLength={100}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Link URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Link Produk <span className="text-gray-400 font-normal">(opsional)</span>
            </label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://shopee.co.id/..."
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </>
      )}

      {saveError && <p className="text-sm text-red-500">{saveError}</p>}

      <button
        onClick={handleSave}
        disabled={saving || !hasChanges || !channel || (show && !name.trim())}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Menyimpan...</> : 'Simpan'}
      </button>
    </div>
  );
}
