'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import type { PublicGalleryImage } from './types';

interface Props {
  images: PublicGalleryImage[];
  alt: string;
}

export function OmnichannelGalleryCarousel({ images, alt }: Props) {
  const [active, setActive] = useState(0);

  // Reset ke gambar pertama setiap kali daftar gambar berubah (mis. ganti bisnis)
  useEffect(() => {
    setActive(0);
  }, [images]);

  if (images.length === 0) {
    return (
      <div className="aspect-[4/3] w-full rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50">
        <ImageOff className="w-10 h-10 mb-2 opacity-50" />
        <p className="text-sm">Belum ada gambar gallery</p>
      </div>
    );
  }

  const safeActive = Math.min(active, images.length - 1);
  const main = images[safeActive];

  function go(delta: number) {
    setActive((i) => (i + delta + images.length) % images.length);
  }

  return (
    <div className="space-y-3">
      {/* Gambar utama */}
      <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={main.url}
          alt={`${alt} — gambar ${safeActive + 1}`}
          className="w-full h-full object-cover"
        />
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center transition opacity-0 group-hover:opacity-100"
              aria-label="Gambar sebelumnya"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center transition opacity-0 group-hover:opacity-100"
              aria-label="Gambar berikutnya"
            >
              <ChevronRight className="w-5 h-5 text-gray-700" />
            </button>
            <span className="absolute bottom-3 right-3 text-[11px] font-medium text-white bg-black/60 px-2 py-0.5 rounded-full">
              {safeActive + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
          {images.slice(0, 6).map((img, i) => (
            <button
              key={img.url + i}
              type="button"
              onClick={() => setActive(i)}
              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition ${
                i === safeActive
                  ? 'border-indigo-500'
                  : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="w-full h-full object-cover" />
              {i === 5 && images.length > 6 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-medium">
                  +{images.length - 6}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
