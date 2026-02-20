'use client';

import { useState, useEffect } from 'react';
import { Check, X, Loader2, Eye, EyeOff } from 'lucide-react';
import type { BusinessOmniChannel } from '@/types';
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
  const [isPublished, setIsPublished] = useState(channel?.is_published ?? false);

  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
  const [slugError, setSlugError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

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

  const handleSave = async () => {
    if (slugStatus === 'unavailable' || slugStatus === 'checking') return;

    setSaving(true);
    setSaveError('');
    try {
      await upsertOmniChannel(businessId, {
        slug,
        title,
        tagline: tagline || undefined,
        bio: bio || undefined,
        logo_url: logoUrl || null,
        is_published: isPublished,
      }, userId);
      onSaved();
    } catch (err: any) {
      setSaveError(err.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    slug !== (channel?.slug ?? '') ||
    title !== (channel?.title ?? '') ||
    tagline !== (channel?.tagline ?? '') ||
    bio !== (channel?.bio ?? '') ||
    logoUrl !== (channel?.logo_url ?? '') ||
    isPublished !== (channel?.is_published ?? false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
      {/* Publish Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isPublished ? (
            <Eye className="w-4 h-4 text-emerald-500" />
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
            isPublished ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
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
            className={`flex-1 px-3 py-2 rounded-xl border text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
              slugStatus === 'unavailable'
                ? 'border-red-300 dark:border-red-600'
                : slugStatus === 'available'
                ? 'border-emerald-300 dark:border-emerald-600'
                : 'border-gray-200 dark:border-gray-600'
            }`}
          />
          <div className="w-5 shrink-0">
            {slugStatus === 'checking' && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
            {slugStatus === 'available' && <Check className="w-4 h-4 text-emerald-500" />}
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
                    className="px-2.5 py-1 text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-200 dark:border-indigo-700"
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

      {/* Logo URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          URL Logo <span className="text-gray-400 font-normal">(opsional)</span>
        </label>
        <input
          type="url"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://example.com/logo.png"
          className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Save */}
      {saveError && (
        <p className="text-sm text-red-500">{saveError}</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving || !hasChanges || slugStatus === 'unavailable' || slugStatus === 'checking' || !title || !slug}
        className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-xl transition-colors font-medium text-sm flex items-center justify-center gap-2"
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
