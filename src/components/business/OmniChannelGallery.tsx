'use client';

import { useRef, useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, ArrowLeft, ArrowRight } from 'lucide-react';
import type { OmniChannelGalleryImage } from '@/types';
import {
  uploadGalleryImage,
  deleteGalleryImage,
  reorderGalleryImages,
} from '@/lib/api/omniChannel';

interface Props {
  businessId: string;
  initialGallery: OmniChannelGalleryImage[];
  /** True jika halaman publik (omni-channel record) sudah pernah disimpan */
  hasOmniChannel: boolean;
  onChanged?: () => void;
}

const MAX_IMAGES = 12;

export function OmniChannelGallery({ businessId, initialGallery, hasOmniChannel, onChanged }: Props) {
  const [gallery, setGallery] = useState<OmniChannelGalleryImage[]>(
    [...initialGallery].sort((a, b) => a.sort_order - b.sort_order)
  );

  // Sync state dari prop setiap kali parent re-fetch (misalnya setelah reload)
  useEffect(() => {
    setGallery([...initialGallery].sort((a, b) => a.sort_order - b.sort_order));
  }, [initialGallery]);
  const [uploading, setUploading] = useState(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Gallery Showcase
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
