'use client';

import { useRef, useState } from 'react';
import { Camera, ImageIcon, Loader2, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { OmniChannelLink, OmniChannelType } from '@/types';
import { addOmniChannelLink, updateOmniChannelLink } from '@/lib/api/omniChannel';
import { CHANNEL_META, CHANNEL_CATEGORIES, getChannelsByCategory } from '@/lib/omniChannelMeta';

interface Props {
  businessId: string;
  nextSortOrder: number;
  editingLink?: OmniChannelLink;
  onClose: () => void;
  onSaved: () => void;
}

export function AddOmniChannelLinkModal({ businessId, nextSortOrder, editingLink, onClose, onSaved }: Props) {
  const [channelType, setChannelType] = useState<OmniChannelType>(editingLink?.channel_type ?? 'instagram');
  const [label, setLabel] = useState(editingLink?.label ?? CHANNEL_META.instagram.defaultLabel);
  const [url, setUrl] = useState(editingLink?.url ?? '');
  const [isActive, setIsActive] = useState(editingLink?.is_active ?? true);
  const [customIconUrl, setCustomIconUrl] = useState(editingLink?.custom_icon_url ?? '');
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [iconError, setIconError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const iconInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!editingLink;

  const handleTypeChange = (type: OmniChannelType) => {
    setChannelType(type);
    // custom: biarkan label kosong supaya user isi sendiri
    // non-custom dan belum edit: isi default label sebagai hint
    if (!isEditing) {
      setLabel(type === 'custom' ? '' : CHANNEL_META[type].defaultLabel);
    }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setIconError('Hanya file gambar yang diperbolehkan');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setIconError('Ukuran file maksimal 2MB');
      return;
    }
    if (!isEditing) {
      setIconError('Simpan link dulu sebelum upload icon kustom');
      return;
    }
    setUploadingIcon(true);
    setIconError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/omni-channel/links/${editingLink.id}/icon`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal upload icon');
      setCustomIconUrl(json.url);
    } catch (err: any) {
      setIconError(err.message || 'Gagal upload icon');
    } finally {
      setUploadingIcon(false);
      if (iconInputRef.current) iconInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!url.trim()) {
      setError('URL wajib diisi');
      return;
    }
    if (!label.trim()) {
      setError('Label wajib diisi');
      return;
    }

    // Ensure URL has protocol prefix
    const normalizedUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;

    setSaving(true);
    setError('');

    try {
      if (isEditing) {
        await updateOmniChannelLink(editingLink.id, {
          channel_type: channelType,
          label: label.trim(),
          url: normalizedUrl,
          is_active: isActive,
          custom_icon_url: customIconUrl || null,
        });
      } else {
        await addOmniChannelLink('', {
          channel_type: channelType,
          label: label.trim(),
          url: normalizedUrl,
          is_active: isActive,
          is_primary: false,
          sort_order: nextSortOrder,
          businessId,
        });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan link');
    } finally {
      setSaving(false);
    }
  };

  const meta = CHANNEL_META[channelType];

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={isEditing ? 'Edit Link' : 'Tambah Link'}
    >
      <div className="space-y-4">
        {/* Channel Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Jenis Saluran
          </label>
          <div className="space-y-3">
            {CHANNEL_CATEGORIES.map((cat) => {
              const channels = getChannelsByCategory(cat.key);
              return (
                <div key={cat.key}>
                  <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
                    {cat.label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {channels.map(({ type, meta: m }) => (
                      <button
                        key={type}
                        onClick={() => handleTypeChange(type)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          channelType === type
                            ? 'bg-indigo-50 dark:bg-indigo-900/25 text-indigo-500 dark:text-indigo-300 ring-1 ring-indigo-300 dark:ring-indigo-500'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Label */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Label{channelType === 'custom' && <span className="text-red-400 ml-1">*</span>}
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={channelType === 'custom' ? 'misal: Website kami, Katalog, Blog...' : meta.defaultLabel}
            maxLength={200}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {channelType === 'custom' && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Tulis nama link sesuka kamu — ini yang akan tampil di halaman publik.
            </p>
          )}
        </div>

        {/* URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={meta.placeholder}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Custom icon */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Icon Kustom <span className="text-gray-400 font-normal">(opsional)</span>
          </label>
          <div className="flex items-center gap-3">
            <div className="relative group shrink-0">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 flex items-center justify-center">
                {customIconUrl ? (
                  <img src={customIconUrl} alt="Icon" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <label className={`absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl cursor-pointer transition-opacity ${uploadingIcon ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                {uploadingIcon ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Camera className="w-4 h-4 text-white" />}
                <input ref={iconInputRef} type="file" accept="image/*" onChange={handleIconUpload} disabled={uploadingIcon || !isEditing} className="hidden" />
              </label>
              {customIconUrl && !uploadingIcon && (
                <button
                  type="button"
                  onClick={() => { setCustomIconUrl(''); setIconError(''); }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isEditing ? 'Klik untuk upload icon kustom (override icon platform).' : 'Simpan link dulu untuk upload icon kustom.'}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">JPG, PNG, WebP, GIF · Maks. 2MB</p>
              {iconError && <p className="text-xs text-red-500 mt-1">{iconError}</p>}
            </div>
          </div>
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">Aktif</span>
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => setIsActive(!isActive)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isActive ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Error */}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="btn-ghost flex-1"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !url.trim() || !label.trim()}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Menyimpan...
              </>
            ) : isEditing ? (
              'Simpan'
            ) : (
              'Tambah'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
