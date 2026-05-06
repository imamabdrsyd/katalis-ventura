'use client';

import { useRef, useState } from 'react';
import {
  Camera, ImageIcon, Loader2, X, Search,
  ShoppingBag, ShoppingCart, Store, Package, Tag, Gift, Truck, Boxes,
  Utensils, Coffee, UtensilsCrossed, Pizza, Salad,
  Scissors, Sparkles, Heart, Star, Smile,
  Home, Building2, Hotel, MapPin, Key,
  Briefcase, Users, UserCheck, Handshake, Award, Trophy,
  Phone, MessageCircle, Mail, Globe, Link2, Share2,
  Camera as CameraIcon, Image, Video, Mic, Music, Palette,
  Leaf, Flower2, Sun, Zap, Flame, Droplets,
  BookOpen, GraduationCap, Lightbulb, PenLine,
  Car, Bike, Plane, Anchor,
  Dumbbell, Activity, Stethoscope,
  CreditCard, DollarSign, PiggyBank, BarChart2,
} from 'lucide-react';
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

// Daftar icon Lucide bertema bisnis — name yang ditampilkan + komponen icon
const LUCIDE_ICONS: { name: string; label: string; Icon: React.ElementType }[] = [
  { name: 'ShoppingBag', label: 'Belanja', Icon: ShoppingBag },
  { name: 'ShoppingCart', label: 'Keranjang', Icon: ShoppingCart },
  { name: 'Store', label: 'Toko', Icon: Store },
  { name: 'Package', label: 'Paket', Icon: Package },
  { name: 'Tag', label: 'Label Harga', Icon: Tag },
  { name: 'Gift', label: 'Hadiah', Icon: Gift },
  { name: 'Truck', label: 'Pengiriman', Icon: Truck },
  { name: 'Boxes', label: 'Stok', Icon: Boxes },
  { name: 'Utensils', label: 'Restoran', Icon: Utensils },
  { name: 'Coffee', label: 'Kafe', Icon: Coffee },
  { name: 'UtensilsCrossed', label: 'Makan', Icon: UtensilsCrossed },
  { name: 'Pizza', label: 'Pizza', Icon: Pizza },
  { name: 'Salad', label: 'Salad', Icon: Salad },
  { name: 'Scissors', label: 'Salon', Icon: Scissors },
  { name: 'Sparkles', label: 'Kecantikan', Icon: Sparkles },
  { name: 'Heart', label: 'Favorit', Icon: Heart },
  { name: 'Star', label: 'Bintang', Icon: Star },
  { name: 'Smile', label: 'Ramah', Icon: Smile },
  { name: 'Home', label: 'Rumah', Icon: Home },
  { name: 'Building2', label: 'Gedung', Icon: Building2 },
  { name: 'Hotel', label: 'Hotel', Icon: Hotel },
  { name: 'MapPin', label: 'Lokasi', Icon: MapPin },
  { name: 'Key', label: 'Properti', Icon: Key },
  { name: 'Briefcase', label: 'Bisnis', Icon: Briefcase },
  { name: 'Users', label: 'Tim', Icon: Users },
  { name: 'UserCheck', label: 'Member', Icon: UserCheck },
  { name: 'Handshake', label: 'Kemitraan', Icon: Handshake },
  { name: 'Award', label: 'Penghargaan', Icon: Award },
  { name: 'Trophy', label: 'Prestasi', Icon: Trophy },
  { name: 'Phone', label: 'Telepon', Icon: Phone },
  { name: 'MessageCircle', label: 'Chat', Icon: MessageCircle },
  { name: 'Mail', label: 'Email', Icon: Mail },
  { name: 'Globe', label: 'Website', Icon: Globe },
  { name: 'Link2', label: 'Tautan', Icon: Link2 },
  { name: 'Share2', label: 'Bagikan', Icon: Share2 },
  { name: 'Camera', label: 'Foto', Icon: CameraIcon },
  { name: 'Image', label: 'Gambar', Icon: Image },
  { name: 'Video', label: 'Video', Icon: Video },
  { name: 'Mic', label: 'Podcast', Icon: Mic },
  { name: 'Music', label: 'Musik', Icon: Music },
  { name: 'Palette', label: 'Desain', Icon: Palette },
  { name: 'Leaf', label: 'Organik', Icon: Leaf },
  { name: 'Flower2', label: 'Bunga', Icon: Flower2 },
  { name: 'Sun', label: 'Segar', Icon: Sun },
  { name: 'Zap', label: 'Cepat', Icon: Zap },
  { name: 'Flame', label: 'Populer', Icon: Flame },
  { name: 'Droplets', label: 'Minuman', Icon: Droplets },
  { name: 'BookOpen', label: 'Buku', Icon: BookOpen },
  { name: 'GraduationCap', label: 'Edukasi', Icon: GraduationCap },
  { name: 'Lightbulb', label: 'Ide', Icon: Lightbulb },
  { name: 'PenLine', label: 'Tulis', Icon: PenLine },
  { name: 'Car', label: 'Kendaraan', Icon: Car },
  { name: 'Bike', label: 'Sepeda', Icon: Bike },
  { name: 'Plane', label: 'Travel', Icon: Plane },
  { name: 'Anchor', label: 'Nautik', Icon: Anchor },
  { name: 'Dumbbell', label: 'Olahraga', Icon: Dumbbell },
  { name: 'Activity', label: 'Kesehatan', Icon: Activity },
  { name: 'Stethoscope', label: 'Medis', Icon: Stethoscope },
  { name: 'CreditCard', label: 'Pembayaran', Icon: CreditCard },
  { name: 'DollarSign', label: 'Harga', Icon: DollarSign },
  { name: 'PiggyBank', label: 'Tabungan', Icon: PiggyBank },
  { name: 'BarChart2', label: 'Statistik', Icon: BarChart2 },
];

function IconPickerModal({
  selected,
  onSelect,
  onClose,
}: {
  selected: string | null;
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = query.trim()
    ? LUCIDE_ICONS.filter((i) =>
        i.label.toLowerCase().includes(query.toLowerCase()) ||
        i.name.toLowerCase().includes(query.toLowerCase())
      )
    : LUCIDE_ICONS;

  return (
    <Modal isOpen={true} onClose={onClose} title="Pilih Icon">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari icon..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-5 gap-2 max-h-72 overflow-y-auto pr-1">
          {filtered.map(({ name, label, Icon }) => (
            <button
              key={name}
              type="button"
              onClick={() => { onSelect(name); onClose(); }}
              title={label}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${
                selected === name
                  ? 'bg-primary-50 dark:bg-primary-900/25 ring-1 ring-primary-300 dark:ring-primary-600'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Icon className={`w-5 h-5 ${selected === name ? 'text-primary-500' : 'text-gray-600 dark:text-gray-300'}`} />
              <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-full text-center">{label}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-5 text-center text-sm text-gray-400 py-6">Tidak ada icon yang cocok.</p>
          )}
        </div>
        {selected && (
          <button
            type="button"
            onClick={() => { onSelect(''); onClose(); }}
            className="w-full text-xs text-gray-400 hover:text-red-500 transition-colors text-center py-1"
          >
            Hapus pilihan icon
          </button>
        )}
      </div>
    </Modal>
  );
}

export function AddOmniChannelLinkModal({ businessId, nextSortOrder, editingLink, onClose, onSaved }: Props) {
  const [channelType, setChannelType] = useState<OmniChannelType>(editingLink?.channel_type ?? 'instagram');
  const [label, setLabel] = useState(editingLink?.label ?? CHANNEL_META.instagram.defaultLabel);
  const [subtitle, setSubtitle] = useState(editingLink?.subtitle ?? '');
  const [url, setUrl] = useState(editingLink?.url ?? '');
  const [isActive, setIsActive] = useState(editingLink?.is_active ?? true);
  const [customIconUrl, setCustomIconUrl] = useState(editingLink?.custom_icon_url ?? '');
  const [lucideIcon, setLucideIcon] = useState<string>((editingLink as any)?.lucide_icon ?? '');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [iconError, setIconError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const iconInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!editingLink;

  const handleTypeChange = (type: OmniChannelType) => {
    setChannelType(type);
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
      setLucideIcon(''); // clear lucide if custom image uploaded
    } catch (err: any) {
      setIconError(err.message || 'Gagal upload icon');
    } finally {
      setUploadingIcon(false);
      if (iconInputRef.current) iconInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!url.trim()) { setError('URL wajib diisi'); return; }
    if (!label.trim()) { setError('Label wajib diisi'); return; }

    const normalizedUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;

    setSaving(true);
    setError('');

    try {
      if (isEditing) {
        await updateOmniChannelLink(editingLink.id, {
          channel_type: channelType,
          label: label.trim(),
          subtitle: subtitle.trim() || null,
          url: normalizedUrl,
          is_active: isActive,
          custom_icon_url: customIconUrl || null,
        });
      } else {
        await addOmniChannelLink('', {
          channel_type: channelType,
          label: label.trim(),
          subtitle: subtitle.trim() || null,
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

  // Lucide icon component untuk preview
  const SelectedLucideIcon = lucideIcon
    ? LUCIDE_ICONS.find((i) => i.name === lucideIcon)?.Icon
    : null;

  return (
    <>
      {showIconPicker && (
        <IconPickerModal
          selected={lucideIcon}
          onSelect={(name) => {
            setLucideIcon(name);
            if (name) setCustomIconUrl(''); // clear uploaded image if lucide selected
          }}
          onClose={() => setShowIconPicker(false)}
        />
      )}

      <Modal isOpen={true} onClose={onClose} title={isEditing ? 'Edit Link' : 'Tambah Link'}>
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
                              ? 'bg-primary-50 dark:bg-primary-900/25 text-primary-500 dark:text-primary-300 ring-1 ring-primary-300 dark:ring-primary-500'
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
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {channelType === 'custom' && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Tulis nama link sesuka kamu — ini yang akan tampil di halaman publik.
              </p>
            )}
          </div>

          {/* Subtitle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Keterangan <span className="text-gray-400 font-normal">(opsional)</span>
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="misal: Pesan langsung, Cek koleksi, Hubungi kami..."
              maxLength={200}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Teks kecil di bawah label — tampil sebagai baris kedua di halaman publik.
            </p>
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
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Icon — Lucide picker + custom upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Icon <span className="text-gray-400 font-normal">(opsional)</span>
            </label>
            <div className="flex items-center gap-3">
              {/* Preview area */}
              <div className="relative group shrink-0">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 flex items-center justify-center">
                  {customIconUrl ? (
                    <img src={customIconUrl} alt="Icon" className="w-full h-full object-cover" />
                  ) : SelectedLucideIcon ? (
                    <SelectedLucideIcon className="w-7 h-7 text-gray-600 dark:text-gray-300" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                {/* Upload overlay */}
                <label className={`absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl cursor-pointer transition-opacity ${uploadingIcon ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  {uploadingIcon ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Camera className="w-4 h-4 text-white" />}
                  <input ref={iconInputRef} type="file" accept="image/*" onChange={handleIconUpload} disabled={uploadingIcon || !isEditing} className="hidden" />
                </label>
                {(customIconUrl || lucideIcon) && !uploadingIcon && (
                  <button
                    type="button"
                    onClick={() => { setCustomIconUrl(''); setLucideIcon(''); setIconError(''); }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Actions */}
              <div className="flex-1 min-w-0 space-y-2">
                <button
                  type="button"
                  onClick={() => setShowIconPicker(true)}
                  className="w-full text-left px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                >
                  <Search className="w-3.5 h-3.5 text-gray-400" />
                  {lucideIcon
                    ? LUCIDE_ICONS.find((i) => i.name === lucideIcon)?.label ?? lucideIcon
                    : 'Pilih icon dari galeri...'}
                </button>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {isEditing
                    ? 'Atau hover gambar untuk upload foto kustom (JPG, PNG, WebP · Maks. 2MB)'
                    : 'Simpan link dulu untuk upload foto kustom.'}
                </p>
                {iconError && <p className="text-xs text-red-500">{iconError}</p>}
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
                isActive ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Error */}
          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-ghost flex-1">Batal</button>
            <button
              onClick={handleSave}
              disabled={saving || !url.trim() || !label.trim()}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Menyimpan...</>
              ) : isEditing ? 'Simpan' : 'Tambah'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
