'use client';

import { useRef, useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, ArrowLeft, ArrowRight } from 'lucide-react';
import type { BusinessOmniChannel, OmniChannelGalleryImage } from '@/types';
import {
  uploadGalleryImage,
  deleteGalleryImage,
  reorderGalleryImages,
  upsertOmniChannel,
} from '@/lib/api/omniChannel';

interface Props {
  businessId: string;
  userId: string;
  channel: BusinessOmniChannel | null;
  initialGallery: OmniChannelGalleryImage[];
  hasOmniChannel: boolean;
  onChanged?: () => void;
}

const MAX_IMAGES = 12;

export function OmniChannelGallery({ businessId, userId, channel, initialGallery, hasOmniChannel, onChanged }: Props) {
  const [gallery, setGallery] = useState<OmniChannelGalleryImage[]>(
    [...initialGallery].sort((a, b) => a.sort_order - b.sort_order)
  );
  const [showGallery, setShowGallery] = useState(channel?.show_gallery ?? true);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  useEffect(() => {
    setGallery([...initialGallery].sort((a, b) => a.sort_order - b.sort_order));
  }, [initialGallery]);
  useEffect(() => {
    setShowGallery(channel?.show_gallery ?? true);
  }, [channel?.show_gallery]);

  const [uploading, setUploading] = useState(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleToggleVisibility() {
    if (!channel) return;
    const next = !showGallery;
    setShowGallery(next);
    setTogglingVisibility(true);
    try {
      await upsertOmniChannel(businessId, {
        slug: channel.slug,
        title: channel.title,
        tagline: channel.tagline,
        bio: channel.bio,
        logo_url: channel.logo_url ?? null,
        is_published: channel.is_published,
        widget_date_mode: channel.widget_date_mode,
        widget_labels: channel.widget_labels,
        show_pricing: channel.show_pricing,
        show_gallery: next,
        show_showcase: channel.show_showcase,
        show_widget: channel.show_widget,
        show_links: channel.show_links,
      }, userId);
      onChanged?.();
    } catch {
      setShowGallery(!next);
    } finally {
      setTogglingVisibility(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (files.length === 0) return;

    setError('');
    setUploading(true);
    try {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

      let next = gallery;
      for (const file of files) {
        if (next.length >= MAX_IMAGES) {
          setError(`Maksimal ${MAX_IMAGES} gambar — sebagian file tidak ter-upload`);
          break;
        }

        // Upload langsung ke Cloudinary dari browser
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);
        formData.append('folder', `axion/gallery/${businessId}`);

        const cloudRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          { method: 'POST', body: formData }
        );
        if (!cloudRes.ok) {
          const err = await cloudRes.json();
          throw new Error(err.error?.message || 'Gagal upload ke Cloudinary');
        }
        const { secure_url, public_id } = await cloudRes.json();

        // Force format jpg via URL transformation agar HEIC/TIFF bisa ditampilkan browser
        const displayUrl = secure_url.replace(/\/upload\//, '/upload/f_jpg/');

        // Simpan url + public_id ke DB via API kita
        const { gallery: updated } = await uploadGalleryImage(businessId, displayUrl, public_id);
        next = updated;
      }
      setGallery(next);
      onChanged?.();
    } catch (err: any) {
      setError(err.message || 'Gagal upload gambar');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(path: string) {
    if (!confirm('Hapus gambar ini dari gallery?')) return;
    setError('');
    setDeletingPath(path);
    try {
      const next = await deleteGalleryImage(businessId, path);
      setGallery(next);
      onChanged?.();
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus gambar');
    } finally {
      setDeletingPath(null);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= gallery.length) return;
    const reordered = [...gallery];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const withOrder = reordered.map((img, i) => ({ ...img, sort_order: i }));
    setGallery(withOrder);
    setReordering(true);
    try {
      await reorderGalleryImages(
        businessId,
        withOrder.map((img) => img.path)
      );
    } catch (err: any) {
      setError(err.message || 'Gagal mengurutkan ulang');
      // Revert ke state sebelumnya kalau backend gagal
      setGallery(gallery);
    } finally {
      setReordering(false);
    }
  }

  if (!hasOmniChannel) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
          Gallery Showcase
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Simpan halaman publik terlebih dahulu, lalu kembali ke sini untuk upload gambar gallery.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Gallery Showcase
            </h3>
            {/* Visibility toggle */}
            <button
              type="button"
              role="switch"
              aria-checked={showGallery}
              onClick={handleToggleVisibility}
              disabled={togglingVisibility || !channel}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${showGallery ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              title={showGallery ? 'Tampil di halaman publik' : 'Disembunyikan dari halaman publik'}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${showGallery ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {showGallery ? 'Tampil' : 'Disembunyikan'}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Gambar bisnis yang akan ditampilkan di landing page Axion.
            Format: JPG, PNG, WebP, GIF · Maks 4MB · Hingga {MAX_IMAGES} gambar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || gallery.length >= MAX_IMAGES}
          className="btn-primary inline-flex items-center gap-2 shrink-0 text-sm py-2 px-3"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
          multiple
          onChange={handleUpload}
          className="hidden"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {gallery.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 px-4 py-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Belum ada gambar. Klik tombol Upload untuk menambahkan.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {gallery.map((img, i) => (
            <div
              key={img.path}
              className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 aspect-square bg-gray-100 dark:bg-gray-700"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={`Gallery ${i + 1}`}
                className="w-full h-full object-cover"
              />
              {/* Index badge */}
              <span className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                {i + 1}
              </span>
              {/* Controls */}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 p-1.5 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || reordering}
                    className="p-1 rounded bg-white/90 hover:bg-white text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Geser kiri"
                  >
                    <ArrowLeft className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === gallery.length - 1 || reordering}
                    className="p-1 rounded bg-white/90 hover:bg-white text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Geser kanan"
                  >
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(img.path)}
                  disabled={deletingPath === img.path}
                  className="p-1 rounded bg-red-500/90 hover:bg-red-600 text-white"
                  title="Hapus"
                >
                  {deletingPath === img.path ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
