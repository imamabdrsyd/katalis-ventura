'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, X, Loader2, Eye, EyeOff, Camera, ImageIcon, CalendarDays, Calendar, LayoutTemplate } from 'lucide-react';
import type { BusinessOmniChannel, OmniChannelLayoutMode, OmniChannelWidgetLabels } from '@/types';
import { upsertOmniChannel, checkSlugAvailability, fetchAvailableSlugSuggestions } from '@/lib/api/omniChannel';
import { generateSlugFromName, isValidSlugFormat, isReservedSlug, generateSlugSuggestions } from '@/lib/utils/slugUtils';

interface Props {
  businessId: string;
  businessName: string;
  userId: string;
  channel: BusinessOmniChannel | null;
  onSaved: () => void;
}

export function OmniChannelPageConfig({ businessId, businessName, userId, channel, onSaved }: Props) {
  const [slug, setSlug] = useState(channel?.slug ?? generateSlugFromName(businessName));
  const [title, setTitle] = useState(channel?.title ?? businessName);
  const [tagline, setTagline] = useState(channel?.tagline ?? '');
  const [bio, setBio] = useState(channel?.bio ?? '');
  const [logoUrl, setLogoUrl] = useState(channel?.logo_url ?? '');
  const [bannerUrl, setBannerUrl] = useState(channel?.banner_url ?? '');
  const [isPublished, setIsPublished] = useState(channel?.is_published ?? false);
  const publicUrlMode: 'slug-only' | 'axion-only' | 'both' = 'slug-only';
  const [layoutMode, setLayoutMode] = useState<OmniChannelLayoutMode>(channel?.layout_mode ?? 'classic');
  const [widgetDateMode, setWidgetDateMode] = useState<'single' | 'double'>(channel?.widget_date_mode ?? 'double');
  const [widgetLabels, setWidgetLabels] = useState<OmniChannelWidgetLabels>(channel?.widget_labels ?? {});
  const [buttonColor, setButtonColor] = useState(channel?.button_color ?? '#6366f1');
  const [bannerPosition, setBannerPosition] = useState(channel?.banner_position ?? 'center');

  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
  const [slugError, setSlugError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerUploadError, setBannerUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Snapshot terakhir yang berhasil disimpan — dipakai sebagai baseline hasChanges
  const savedRef = useRef({
    slug: channel?.slug ?? generateSlugFromName(businessName),
    title: channel?.title ?? businessName,
    tagline: channel?.tagline ?? '',
    bio: channel?.bio ?? '',
    logoUrl: channel?.logo_url ?? '',
    bannerUrl: channel?.banner_url ?? '',
    isPublished: channel?.is_published ?? false,
    layoutMode: channel?.layout_mode ?? 'classic',
    widgetDateMode: channel?.widget_date_mode ?? 'double',
    widgetLabels: JSON.stringify(channel?.widget_labels ?? {}),
    buttonColor: channel?.button_color ?? '#6366f1',
    bannerPosition: channel?.banner_position ?? 'center',
  });

  // Banner drag-to-reposition
  const bannerDragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

  function parseBannerPosition(pos: string): { x: number; y: number } {
    if (pos === 'center') return { x: 50, y: 50 };
    const parts = pos.split(' ');
    const x = parseFloat(parts[0]) || 50;
    const y = parseFloat(parts[1]) || 50;
    return { x, y };
  }

  function handleBannerDragStart(e: React.MouseEvent<HTMLDivElement>) {
    const { x, y } = parseBannerPosition(bannerPosition);
    bannerDragRef.current = { startX: e.clientX, startY: e.clientY, posX: x, posY: y };
    e.preventDefault();
  }

  function handleBannerDragMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!bannerDragRef.current) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const dx = ((e.clientX - bannerDragRef.current.startX) / rect.width) * 100;
    const dy = ((e.clientY - bannerDragRef.current.startY) / rect.height) * 100;
    const newX = Math.max(0, Math.min(100, bannerDragRef.current.posX - dx));
    const newY = Math.max(0, Math.min(100, bannerDragRef.current.posY - dy));
    setBannerPosition(`${newX.toFixed(1)}% ${newY.toFixed(1)}%`);
  }

  function handleBannerDragEnd() {
    bannerDragRef.current = null;
  }

  // Debounced slug check
  useEffect(() => {
    setSuggestions([]);

    if (!slug) {
      setSlugStatus('idle');
      return;
    }

    if (!isValidSlugFormat(slug)) {
      setSlugStatus('unavailable');
      setSlugError('Hanya huruf kecil, angka, dan tanda hubung (min 3 karakter)');
      return;
    }

    if (isReservedSlug(slug)) {
      setSlugStatus('unavailable');
      setSlugError('Slug ini tidak tersedia (reserved)');
      return;
    }

    // If slug unchanged from saved value, no need to re-check
    if (channel?.slug === slug) {
      setSlugStatus('available');
      setSlugError('');
      return;
    }

    setSlugStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const result = await checkSlugAvailability(slug, businessId);
        if (result.available) {
          setSlugStatus('available');
          setSlugError('');
        } else {
          setSlugStatus('unavailable');
          const reason =
            result.reason === 'reserved' ? 'Slug ini tidak tersedia (reserved)' :
            result.reason === 'format' ? 'Format slug tidak valid' :
            'Slug sudah digunakan bisnis lain';
          setSlugError(reason);

          // Generate and check alternative suggestions
          const candidates = generateSlugSuggestions(slug);
          if (candidates.length > 0) {
            const available = await fetchAvailableSlugSuggestions(candidates, businessId);
            setSuggestions(available);
          }
        }
      } catch {
        setSlugStatus('idle');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [slug, channel?.slug, businessId]);

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

    setUploading(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/omni-channel/${businessId}/logo`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal upload foto');
      setLogoUrl(json.url);
    } catch (err: any) {
      setUploadError(err.message || 'Gagal upload foto');
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (slugStatus === 'unavailable' || slugStatus === 'checking') return;

    setSaving(true);
    setSaveError('');
    try {
      await upsertOmniChannel(businessId, {
        slug,
        title,
        tagline: tagline || null,
        bio: bio || null,
        logo_url: logoUrl || null,
        banner_url: bannerUrl || null,
        is_published: isPublished,
        public_url_mode: publicUrlMode,
        layout_mode: layoutMode,
        widget_date_mode: widgetDateMode,
        widget_labels: widgetLabels,
        button_color: buttonColor || null,
        banner_position: bannerPosition || 'center',
      }, userId);
      savedRef.current = { slug, title, tagline, bio, logoUrl, bannerUrl, isPublished, layoutMode, widgetDateMode, widgetLabels: JSON.stringify(widgetLabels), buttonColor, bannerPosition };
      onSaved();
    } catch (err: any) {
      setSaveError(err.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setBannerUploadError('Hanya file gambar yang diperbolehkan');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setBannerUploadError('Ukuran file maksimal 5MB');
      return;
    }
    setUploadingBanner(true);
    setBannerUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/omni-channel/${businessId}/banner`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal upload banner');
      setBannerUrl(json.url);
    } catch (err: any) {
      setBannerUploadError(err.message || 'Gagal upload banner');
    } finally {
      setUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  };

  const saved = savedRef.current;
  const hasChanges =
    slug !== saved.slug ||
    title !== saved.title ||
    tagline !== saved.tagline ||
    bio !== saved.bio ||
    logoUrl !== saved.logoUrl ||
    bannerUrl !== saved.bannerUrl ||
    isPublished !== saved.isPublished ||
    layoutMode !== saved.layoutMode ||
    widgetDateMode !== saved.widgetDateMode ||
    JSON.stringify(widgetLabels) !== saved.widgetLabels ||
    buttonColor !== saved.buttonColor ||
    bannerPosition !== saved.bannerPosition;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
      {/* Publish Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isPublished ? (
            <Eye className="w-4 h-4 text-primary-500" />
          ) : (
            <EyeOff className="w-4 h-4 text-gray-400" />
          )}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {isPublished ? 'Halaman Publik (Aktif)' : 'Halaman Publik (Nonaktif)'}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isPublished}
          onClick={() => setIsPublished(!isPublished)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isPublished ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isPublished ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Slug */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          URL Halaman
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400 dark:text-gray-500 shrink-0">/</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="nama-bisnis"
            className={`flex-1 px-3 py-2 rounded-xl border text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors ${
              slugStatus === 'unavailable'
                ? 'border-red-300 dark:border-red-500'
                : slugStatus === 'available'
                ? 'border-primary-300 dark:border-primary-500'
                : 'border-gray-200 dark:border-gray-600'
            }`}
          />
          <div className="w-5 shrink-0">
            {slugStatus === 'checking' && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
            {slugStatus === 'available' && <Check className="w-4 h-4 text-primary-500" />}
            {slugStatus === 'unavailable' && <X className="w-4 h-4 text-red-500" />}
          </div>
        </div>

        {/* Error + suggestions */}
        {slugStatus === 'unavailable' && (
          <div className="mt-1.5 space-y-2">
            <p className="text-xs text-red-500">{slugError}</p>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-gray-400 dark:text-gray-500">Coba:</span>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSlug(s)}
                    className="px-2.5 py-1 text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-200 dark:border-indigo-600"
                  >
                    /{s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {slugStatus === 'available' && slug && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {typeof window !== 'undefined' ? window.location.origin : ''}/{slug}
          </p>
        )}
      </div>


      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Nama / Judul
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nama bisnis kamu"
          maxLength={200}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Tagline */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Tagline <span className="text-gray-400 font-normal">(opsional)</span>
        </label>
        <input
          type="text"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="Deskripsi singkat satu baris"
          maxLength={300}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Bio */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Bio <span className="text-gray-400 font-normal">(opsional)</span>
        </label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Ceritakan tentang bisnis kamu..."
          maxLength={1000}
          rows={3}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      {/* Logo Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Logo / Foto Profil <span className="text-gray-400 font-normal">(opsional)</span>
        </label>
        <div className="flex items-center gap-4">
          {/* Preview + upload trigger */}
          <div className="relative group shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold border-2 border-gray-200 dark:border-gray-600">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-8 h-8 text-white/70" />
              )}
            </div>
            {/* Hover overlay */}
            <label className={`absolute inset-0 flex items-center justify-center bg-black/50 rounded-full cursor-pointer transition-opacity ${uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              {uploading ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-white" />
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
            {/* Clear button */}
            {logoUrl && !uploading && (
              <button
                type="button"
                onClick={() => { setLogoUrl(''); setUploadError(''); }}
                className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
                title="Hapus logo"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Info teks */}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Klik foto untuk upload gambar dari device kamu.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Format: JPG, PNG, WebP · Maks. 2MB
            </p>
            {uploadError && (
              <p className="text-xs text-red-500 mt-1">{uploadError}</p>
            )}
          </div>
        </div>
      </div>

      {/* Banner Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Banner <span className="text-gray-400 font-normal">(opsional)</span>
        </label>
        {/* Drag-to-reposition area */}
        <div
          className="relative rounded-xl overflow-hidden border-2 border-dashed border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 aspect-[3/1] flex items-center justify-center select-none"
          style={{ cursor: bannerUrl ? 'grab' : 'default' }}
          onMouseDown={bannerUrl ? handleBannerDragStart : undefined}
          onMouseMove={bannerUrl ? handleBannerDragMove : undefined}
          onMouseUp={handleBannerDragEnd}
          onMouseLeave={handleBannerDragEnd}
        >
          {bannerUrl ? (
            <img
              src={bannerUrl}
              alt="Banner"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{ objectPosition: bannerPosition }}
              draggable={false}
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-gray-400">
              <ImageIcon className="w-7 h-7" />
              <span className="text-xs">Klik untuk upload banner</span>
            </div>
          )}
          {/* Upload overlay — hanya saat hover DAN tidak sedang drag */}
          <label className={`absolute inset-0 flex items-center justify-center bg-black/50 cursor-pointer transition-opacity ${uploadingBanner ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}>
            {uploadingBanner ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
            <input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerUpload} disabled={uploadingBanner} className="hidden" />
          </label>
          {bannerUrl && !uploadingBanner && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setBannerUrl(''); setBannerPosition('center'); setBannerUploadError(''); }}
              className="absolute top-2 right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center z-10"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {bannerUrl && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full pointer-events-none">
              Geser untuk atur posisi
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Rasio 3:1 direkomendasikan · JPG, PNG, WebP · Maks. 5MB
        </p>
        {bannerUploadError && <p className="text-xs text-red-500 mt-1">{bannerUploadError}</p>}
      </div>

      {/* Layout Selector — tata letak header halaman publik */}
      <div className="border-t border-gray-100 dark:border-gray-700 pt-5 space-y-3">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Layout
          </h4>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Tata letak header halaman publik kamu.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {([
            {
              id: 'classic' as const,
              label: 'Classic',
              preview: (
                <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden>
                  <rect x="6" y="6" width="88" height="88" rx="6" className="fill-white dark:fill-gray-700 stroke-gray-200 dark:stroke-gray-600" strokeWidth="1.5" />
                  <rect x="14" y="22" width="72" height="44" rx="3" className="fill-gray-300 dark:fill-gray-500" />
                  <circle cx="50" cy="74" r="9" className="fill-gray-200 dark:fill-gray-600 stroke-white dark:stroke-gray-700" strokeWidth="2" />
                  <rect x="38" y="86" width="24" height="2.5" rx="1" className="fill-gray-300 dark:fill-gray-500" />
                </svg>
              ),
            },
            {
              id: 'modern' as const,
              label: 'Modern (tanpa bar)',
              preview: (
                <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden>
                  <rect x="6" y="6" width="88" height="88" rx="6" className="fill-white dark:fill-gray-700 stroke-gray-200 dark:stroke-gray-600" strokeWidth="1.5" />
                  <rect x="14" y="14" width="72" height="58" rx="3" className="fill-gray-300 dark:fill-gray-500" />
                  <circle cx="50" cy="72" r="9" className="fill-gray-200 dark:fill-gray-600 stroke-white dark:stroke-gray-700" strokeWidth="2" />
                  <rect x="38" y="86" width="24" height="2.5" rx="1" className="fill-gray-300 dark:fill-gray-500" />
                </svg>
              ),
            },
            {
              id: 'clean' as const,
              label: 'Clean (tanpa foto profil)',
              preview: (
                <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden>
                  <rect x="6" y="6" width="88" height="88" rx="6" className="fill-white dark:fill-gray-700 stroke-gray-200 dark:stroke-gray-600" strokeWidth="1.5" />
                  <rect x="14" y="14" width="72" height="58" rx="3" className="fill-gray-300 dark:fill-gray-500" />
                  <rect x="32" y="80" width="36" height="3" rx="1.5" className="fill-gray-300 dark:fill-gray-500" />
                  <rect x="38" y="86" width="24" height="2.5" rx="1" className="fill-gray-200 dark:fill-gray-600" />
                </svg>
              ),
            },
          ]).map(({ id, label, preview }) => {
            const active = layoutMode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setLayoutMode(id)}
                className={`group flex flex-col items-center gap-2 p-2 rounded-xl border-2 transition ${
                  active
                    ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20 shadow-sm'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                }`}
              >
                <div className="aspect-square w-full">{preview}</div>
                <span className={`text-xs font-medium text-center leading-tight ${
                  active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Button Color */}
      <div className="border-t border-gray-100 dark:border-gray-700 pt-5">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Warna Tombol Utama
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Warna tombol primary di halaman publik (link yang ditandai bintang).
        </p>
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600 shrink-0">
            <input
              type="color"
              value={buttonColor}
              onChange={(e) => setButtonColor(e.target.value)}
              className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
            />
            <div className="w-full h-full rounded-xl" style={{ backgroundColor: buttonColor }} />
          </div>
          <input
            type="text"
            value={buttonColor}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setButtonColor(v);
            }}
            maxLength={7}
            className="w-28 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          />
          {/* Preset swatches */}
          <div className="flex gap-1.5 flex-wrap">
            {['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#0ea5e9', '#64748b', '#1e293b'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setButtonColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${buttonColor === c ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Widget Config — hanya untuk bisnis Jasa */}
      <div className="border-t border-gray-100 dark:border-gray-700 pt-5 space-y-4">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Konfigurasi Widget Reservasi
        </h4>

        {/* Date mode toggle */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            Mode Tanggal
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setWidgetDateMode('double')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
                widgetDateMode === 'double'
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              Check-in & Check-out
            </button>
            <button
              type="button"
              onClick={() => setWidgetDateMode('single')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
                widgetDateMode === 'single'
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Satu Tanggal
            </button>
          </div>
        </div>

        {/* Label fields */}
        <div className="grid grid-cols-1 gap-3">
          {widgetDateMode === 'single' ? (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Label Tanggal
              </label>
              <input
                type="text"
                value={widgetLabels.date_label ?? ''}
                onChange={(e) => setWidgetLabels((l) => ({ ...l, date_label: e.target.value }))}
                placeholder="Tanggal Kunjungan"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Label Check-in
                </label>
                <input
                  type="text"
                  value={widgetLabels.checkin_label ?? ''}
                  onChange={(e) => setWidgetLabels((l) => ({ ...l, checkin_label: e.target.value }))}
                  placeholder="Check-in"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Label Check-out
                </label>
                <input
                  type="text"
                  value={widgetLabels.checkout_label ?? ''}
                  onChange={(e) => setWidgetLabels((l) => ({ ...l, checkout_label: e.target.value }))}
                  placeholder="Check-out"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Label Catatan
              </label>
              <input
                type="text"
                value={widgetLabels.note_label ?? ''}
                onChange={(e) => setWidgetLabels((l) => ({ ...l, note_label: e.target.value }))}
                placeholder="Catatan (opsional)"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Placeholder Catatan
              </label>
              <input
                type="text"
                value={widgetLabels.note_placeholder ?? ''}
                onChange={(e) => setWidgetLabels((l) => ({ ...l, note_placeholder: e.target.value }))}
                placeholder="misal: 2 tamu, butuh parkir"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Label Tombol WA
              </label>
              <input
                type="text"
                value={widgetLabels.cta_label ?? ''}
                onChange={(e) => setWidgetLabels((l) => ({ ...l, cta_label: e.target.value }))}
                placeholder="Kirim rencana via WhatsApp"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Kata Aksi (di pesan WA)
              </label>
              <input
                type="text"
                value={widgetLabels.action_label ?? ''}
                onChange={(e) => setWidgetLabels((l) => ({ ...l, action_label: e.target.value }))}
                placeholder="kunjungan"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Label Dibawah Tombol Reservasi
            </label>
            <input
              type="text"
              value={widgetLabels.reservation_subtitle ?? ''}
              onChange={(e) => setWidgetLabels((l) => ({ ...l, reservation_subtitle: e.target.value }))}
              placeholder="Tidak ada komitmen — pemilik akan konfirmasi ketersediaan"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Save */}
      {saveError && (
        <p className="text-sm text-red-500">{saveError}</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving || !hasChanges || slugStatus === 'unavailable' || slugStatus === 'checking' || !title || !slug}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Menyimpan...
          </>
        ) : channel ? (
          'Simpan Perubahan'
        ) : (
          'Buat Halaman Publik'
        )}
      </button>
    </div>
  );
}
