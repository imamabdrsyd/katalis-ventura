'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!editingLink;

  const handleTypeChange = (type: OmniChannelType) => {
    setChannelType(type);
    if (!isEditing) {
      setLabel(CHANNEL_META[type].defaultLabel);
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

    setSaving(true);
    setError('');

    try {
      if (isEditing) {
        await updateOmniChannelLink(editingLink.id, {
          channel_type: channelType,
          label: label.trim(),
          url: url.trim(),
          is_active: isActive,
        });
      } else {
        await addOmniChannelLink('', {
          channel_type: channelType,
          label: label.trim(),
          url: url.trim(),
          is_active: isActive,
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
                            ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-300 dark:ring-indigo-600'
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
            Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={meta.defaultLabel}
            maxLength={200}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
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
            className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !url.trim() || !label.trim()}
            className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-xl transition-colors text-sm font-medium flex items-center justify-center gap-2"
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
