'use client';

/**
 * Kartu "Rate Card" di halaman publik `/[slug]` — daftar harga layanan/produk.
 *
 * Sumber barisnya item katalog (migr 152), bukan teks yang diketik ulang di
 * konfigurasi halaman. Yang digantikan fitur ini: rate card berupa GAMBAR yang
 * ditempel di showcase — tidak terbaca screen reader, tidak bisa disalin calon
 * klien, dan tiap ganti harga harus diedit di luar aplikasi.
 *
 * Karena itu markup-nya `<dl>`: tiap baris adalah pasangan nama→harga yang
 * betulan, bukan dua kolom yang kebetulan sejajar.
 *
 * Bahasa visualnya sengaja menyalin `OmnichannelEventCard` (kartu putih
 * rounded-xl, eyebrow warna brand, tombol gradient brand) supaya saat keduanya
 * tampil berdampingan terbaca sebagai satu halaman, bukan dua tempelan.
 */

import { MessageCircle } from 'lucide-react';
import { DEFAULT_BRAND_COLOR, brandGradient, readableTextColorOnGradient } from '@/lib/colorUtils';
import type { PublicRateCardItem } from './types';

interface Props {
  items: PublicRateCardItem[];
  title?: string | null;
  note?: string | null;
  /** Nomor WA bisnis (format internasional, mis. 628…). Kosong → CTA disembunyikan. */
  whatsappNumber?: string | null;
  businessName?: string;
  buttonColor?: string | null;
}

function formatRupiah(value: number): string {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}

export function OmnichannelRateCard({
  items,
  title,
  note,
  whatsappNumber,
  businessName,
  buttonColor,
}: Props) {
  if (items.length === 0) return null;

  const accent = buttonColor ?? DEFAULT_BRAND_COLOR;
  const heading = title?.trim() || 'Rate Card';

  const waHref = whatsappNumber?.trim()
    ? `https://wa.me/${whatsappNumber.trim()}?text=${encodeURIComponent(
        `Halo${businessName ? ` ${businessName}` : ''}, saya mau tanya soal rate card-nya.`
      )}`
    : null;

  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-lg shadow-gray-200/60 dark:shadow-gray-900/60">
      <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: accent }}>
        {heading}
      </p>

      <dl className="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
        {items.map((item) => (
          <div key={item.id} className="flex items-baseline justify-between gap-4 py-3 first:pt-1">
            <div className="min-w-0">
              <dt className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.name}</dt>
              {item.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed whitespace-pre-line">
                  {item.description}
                </p>
              )}
            </div>
            <dd className="shrink-0 text-right">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                {formatRupiah(item.price)}
              </span>
              {item.unit && (
                <span className="block text-[11px] text-gray-400 dark:text-gray-500">/ {item.unit}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {note?.trim() && (
        <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed whitespace-pre-line">
          {note}
        </p>
      )}

      {waHref && (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 w-full flex items-center justify-center gap-2 text-sm font-semibold py-3 px-4 rounded-xl shadow-sm hover:shadow-md hover:brightness-110 active:scale-[0.98] motion-reduce:transform-none transition-all duration-150"
          style={{ background: brandGradient(accent), color: readableTextColorOnGradient(accent) }}
        >
          <MessageCircle className="w-4 h-4" />
          Tanya / pesan paket
        </a>
      )}
    </div>
  );
}
