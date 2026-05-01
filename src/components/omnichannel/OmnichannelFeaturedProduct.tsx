'use client';

import Image from 'next/image';
import { ExternalLink, Tag } from 'lucide-react';
import type { PublicFeaturedProduct } from './types';

interface Props {
  product: PublicFeaturedProduct;
}

export function OmnichannelFeaturedProduct({ product }: Props) {
  if (!product.show) return null;

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      {product.image_url && (
        <div className="relative w-full aspect-[4/3] bg-gray-100 dark:bg-gray-800">
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      )}

      <div className="p-4 space-y-2">
        <h3 className="font-semibold text-gray-900 dark:text-white text-base leading-snug">
          {product.name}
        </h3>

        {product.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            {product.description}
          </p>
        )}

        {product.price_label && (
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
              {product.price_label}
            </span>
          </div>
        )}

        {product.link_url && (
          <a
            href={product.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-sm transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            {product.link_label || 'Lihat Produk'}
          </a>
        )}
      </div>
    </div>
  );
}
