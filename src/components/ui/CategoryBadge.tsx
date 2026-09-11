'use client';

import { CATEGORY_BADGE_CLASSES } from '@/lib/categoryColors';
import { useLanguage } from '@/context/LanguageContext';

/**
 * Kode kategori — sengaja TIDAK diterjemahkan. Ini singkatan teknis yang sama
 * di kedua bahasa, dipakai saat badge terlalu sempit untuk label penuh.
 */
const CATEGORY_SHORT_LABELS: Record<string, string> = {
  EARN: 'EARN',
  OPEX: 'OPEX',
  VAR: 'VAR',
  CAPEX: 'CAPEX',
  TAX: 'TAX',
  FIN: 'FIN',
  SETTLE: 'SETTLE',
};

interface CategoryBadgeProps {
  category: string;
  size?: 'xs' | 'sm' | 'md';
  /** Tampilkan label penuh dari kamus (`t.categories`) alih-alih kode singkat. */
  showLabel?: boolean;
  className?: string;
}

export function CategoryBadge({ category, size = 'sm', showLabel = false, className }: CategoryBadgeProps) {
  const { t } = useLanguage();
  const colorClass = CATEGORY_BADGE_CLASSES[category] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400';
  // Label penuh ikut bahasa aplikasi; kode singkat tidak.
  const label = showLabel
    ? (t.categories[category as keyof typeof t.categories] ?? category)
    : (CATEGORY_SHORT_LABELS[category] ?? category);

  const sizeClass = {
    xs: 'px-1.5 py-0.5 text-[10px]',
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  }[size];

  return (
    <span className={`inline-flex items-center font-semibold rounded-full ${sizeClass} ${colorClass} ${className ?? ''}`}>
      {label}
    </span>
  );
}
