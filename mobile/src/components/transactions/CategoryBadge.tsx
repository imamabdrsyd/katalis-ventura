import React from 'react';
import { Badge } from '@/components/ui/Badge';
import type { TransactionCategory } from '@shared/types';

const CATEGORY_CONFIG: Record<TransactionCategory, { label: string; color: 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'pink' }> = {
  EARN: { label: 'Revenue', color: 'green' },
  OPEX: { label: 'OPEX', color: 'red' },
  VAR: { label: 'HPP', color: 'amber' },
  CAPEX: { label: 'CAPEX', color: 'blue' },
  TAX: { label: 'Pajak', color: 'purple' },
  FIN: { label: 'Financing', color: 'pink' },
};

interface CategoryBadgeProps {
  category: TransactionCategory;
}

export function CategoryBadge({ category }: CategoryBadgeProps) {
  const config = CATEGORY_CONFIG[category] || { label: category, color: 'gray' as const };
  return <Badge label={config.label} color={config.color} />;
}

export { CATEGORY_CONFIG };
