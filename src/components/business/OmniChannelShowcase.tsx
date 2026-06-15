'use client';

import { useRef, useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, ImageIcon } from 'lucide-react';
import type { BusinessOmniChannel, OmniChannelShowcaseImage } from '@/types';
import {
  uploadShowcaseImage,
  deleteShowcaseImage,
  reorderShowcaseImages,
  upsertOmniChannel,
} from '@/lib/api/omniChannel';

interface Props {
  businessId: string;
  userId: string;
  channel: BusinessOmniChannel | null;
  initialShowcase: OmniChannelShowcaseImage[];
  hasOmniChannel: boolean;
  onChanged?: () => void;
}

const MAX_IMAGES = 12;

export function OmniChannelShowcase({ businessId, userId, channel, initialShowcase, hasOmniChannel, onChanged }: Props) {
  const [showcase, setShowcase] = useState<OmniChannelShowcaseImage[]>(
    [...initialShowcase].sort((a, b) => a.sort_order - b.sort_order)
  );
  const [showShowcase, setShowShowcase] = useState(channel?.show_showcase ?? true);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  useEffect(() => {
    setShowcase([...initialShowcase].sort((a, b) => a.sort_order - b.sort_order));
  }, [initialShowcase]);
  useEffect(() => {
    setShowShowcase(channel?.show_showcase ?? true);
  }, [channel?.show_showcase]);

  const [uploading, setUploading] = useState(false);

  async function handleToggleVisibility() {
    if (!channel) return;
    const next = !showShowcase;
    setShowShowcase(next);
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
        show_gallery: channel.show_gallery,
        show_showcase: next,
        show_widget: channel.show_widget,
        show_links: channel.show_links,
      }, userId);
      onChanged?.();
    } catch {
      setShowShowcase(!next);
    } finally {
      setTogglingVisibility(false);
    }
  }
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

      let next = showcase;
      for (const file of files) {
        if (next.length >= MAX_IMAGES) {
          setError(`Maksimal ${MAX_IMAGES} gambar — sebagian file tidak ter-upload`);
          break;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);
        formData.append('folder', `axion/showcase/${businessId}`);

        const cloudRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          { method: 'POST', body: formData }
        );
        if (!cloudRes.ok) {
          const err = await cloudRes.json();
          throw new Error(err.error?.message || 'Gagal upload ke Cloudinary');
        }
        const { secure_url, public_id } = await cloudRes.json();

        // Force jpg agar HEIC/TIFF tetap bisa ditampilkan, ratio asli dipertahankan
        const displayUrl = secure_url.replace(/\/upload\//, '/upload/f_jpg/');

        const { showcase: updated } = await uploadShowcaseImage(businessId, displayUrl, public_id);
        next = updated;
      }
      setShowcase(next);
      onChanged?.();
    } catch (err: any) {
      setError(err.message || 'Gagal upload gambar');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(path: string) {
    if (!confirm('Hapus gambar ini dari showcase?')) return;
    setError('');
    setDeletingPath(path);
    try {
      const next = await deleteShowcaseImage(businessId, path);
      setShowcase(next);
      onChanged?.();
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus gambar');
    } finally {
      setDeletingPath(null);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= showcase.length) return;
    const reordered = [...showcase];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const withOrder = reordered.map((img, i) => ({ ...img, sort_order: i }));
    setShowcase(withOrder);
    setReordering(true);
    try {
      await reorderShowcaseImages(
        businessId,
        withOrder.map((img) => img.path)
      );
    } catch (err: any) {
      setError(err.message || 'Gagal mengurutkan ulang');
      setShowcase(showcase);
    } finally {
      setReordering(false);
    }
  }

  if (!hasOmniChannel) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
          Showcase Image
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Simpan halaman publik terlebih dahulu, lalu kembali ke sini untuk upload showcase image.
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
              Showcase Image
            </h3>
            <button
              type="button"
              role="switch"
              aria-checked={showShowcase}
              onClick={handleToggleVisibility}
              disabled={togglingVisibility || !channel}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${showShowcase ? 'bg-gray-900 dark:bg-gray-100' : 'bg-gray-300 dark:bg-gray-600'}`}
              title={showShowcase ? 'Tampil di halaman publik' : 'Disembunyikan dari halaman publik'}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${showShowcase ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {showShowcase ? 'Tampil' : 'Disembunyikan'}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Gambar yang tampil di halaman publik <span className="font-medium">apa adanya sesuai rasio aslinya</span> — tidak di-crop agar muat frame.
            Format: JPG, PNG, WebP, GIF · Maks 4MB · Hingga {MAX_IMAGES} gambar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || showcase.length >= MAX_IMAGES}
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

      {showcase.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 px-4 py-8 text-center">
          <ImageIcon className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Belum ada showcase image. Klik tombol Upload untuk menambahkan.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {showcase.map((img, i) => (
            <div
              key={img.path}
              className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-[linear-gradient(45deg,#f3f4f6_25%,transparent_25%),linear-gradient(-45deg,#f3f4f6_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f3f4f6_75%),linear-gradient(-45deg,transparent_75%,#f3f4f6_75%)] dark:bg-[linear-gradient(45deg,#374151_25%,transparent_25%),linear-gradient(-45deg,#374151_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#374151_75%),linear-gradient(-45deg,transparent_75%,#374151_75%)] [background-size:16px_16px] [background-position:0_0,0_8px,8px_-8px,-8px_0]"
            >
              <div className="flex items-start gap-3 p-3">
                {/* Preview — tampil dengan ratio asli, max-h supaya list tidak melar */}
                <div className="flex-1 min-w-0 flex items-center justify-center bg-white/40 dark:bg-gray-900/40 rounded-lg overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={`Showcase ${i + 1}`}
                    className="max-h-48 w-auto object-contain"
                  />
                </div>

                {/* Controls */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 text-center">
                    #{i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || reordering}
                    className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Geser ke atas"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === showcase.length - 1 || reordering}
                    className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Geser ke bawah"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(img.path)}
                    disabled={deletingPath === img.path}
                    className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400"
                    title="Hapus"
                  >
                    {deletingPath === img.path ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
