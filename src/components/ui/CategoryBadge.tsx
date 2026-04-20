'use client';

import { CATEGORY_BADGE_CLASSES, CATEGORY_LABELS } from '@/lib/categoryColors';

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
  showLabel?: boolean;
  className?: string;
}

export function CategoryBadge({ category, size = 'sm', showLabel = false, className }: CategoryBadgeProps) {
  const colorClass = CATEGORY_BADGE_CLASSES[category] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400';
  const label = showLabel ? (CATEGORY_LABELS[category] ?? category) : (CATEGORY_SHORT_LABELS[category] ?? category);

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
