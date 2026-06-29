'use client';

import Image from 'next/image';
import { ExternalLink, MessageCircle, Tag } from 'lucide-react';
import type { PublicFeaturedProduct } from './types';

interface Props {
  products: PublicFeaturedProduct[];
  /** Nomor WA bisnis (sudah dalam format internasional, mis. 628...). */
  whatsappNumber?: string | null;
  businessName?: string;
}

function formatRupiah(value: number): string {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}

/** Tujuan klik produk: link CTA custom kalau ada, kalau tidak fallback ke WhatsApp. */
function resolveHref(p: PublicFeaturedProduct, whatsappNumber?: string | null): string | null {
  if (p.link_url && p.link_url.trim()) return p.link_url;
  if (whatsappNumber && whatsappNumber.trim()) {
    const msg = `Halo, saya tertarik dengan *${p.name}*. Apakah masih tersedia?`;
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`;
  }
  return null;
}

function ProductCard({ product, whatsappNumber }: { product: PublicFeaturedProduct; whatsappNumber?: string | null }) {
  const fit = product.image_fit ?? 'cover';
  const posX = product.image_position_x ?? 50;
  const posY = product.image_position_y ?? 50;
  const href = resolveHref(product, whatsappNumber);
  const isWhatsApp = !product.link_url?.trim() && !!href;
  const ctaLabel = product.link_label?.trim() || (isWhatsApp ? 'Chat untuk Pesan' : 'Lihat Produk');
  const CtaIcon = isWhatsApp ? MessageCircle : ExternalLink;

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden flex flex-col">
      {product.image_url && (
        <div className="relative w-full aspect-[4/3] bg-gray-100 dark:bg-gray-800">
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className={fit === 'contain' ? 'object-contain' : 'object-cover'}
            style={fit === 'cover' ? { objectPosition: `${posX}% ${posY}%` } : undefined}
            unoptimized
          />
        </div>
      )}

      <div className="p-4 space-y-2 flex-1 flex flex-col">
        <h3 className="font-semibold text-gray-900 dark:text-white text-base leading-snug">
          {product.name}
        </h3>

        {product.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-3">
            {product.description}
          </p>
        )}

        <div className="flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {formatRupiah(product.price)}
            {product.unit && <span className="text-gray-400 dark:text-gray-500 font-normal"> / {product.unit}</span>}
          </span>
        </div>

        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto pt-1 flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-sm transition-colors"
          >
            <CtaIcon className="w-4 h-4" />
            {ctaLabel}
          </a>
        )}
      </div>
    </div>
  );
}

export function OmnichannelFeaturedProduct({ products, whatsappNumber }: Props) {
  if (!products || products.length === 0) return null;

  return (
    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} whatsappNumber={whatsappNumber} />
      ))}
    </div>
  );
}
