'use client';

import { ChevronDown } from 'lucide-react';
import type { Budget } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  locked: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  approved: 'Disetujui',
  locked: 'Terkunci',
};

interface BudgetSelectorProps {
  budgets: Budget[];
  selectedBudgetId: string | null;
  onSelect: (budgetId: string) => void;
}

export function BudgetSelector({ budgets, selectedBudgetId, onSelect }: BudgetSelectorProps) {
  const selected = budgets.find((b) => b.id === selectedBudgetId);

  if (budgets.length === 0) return null;

  return (
    <div className="relative">
      <select
        value={selectedBudgetId || ''}
        onChange={(e) => onSelect(e.target.value)}
        className="appearance-none pl-4 pr-10 py-2.5 text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors cursor-pointer min-w-[200px]"
      >
        {budgets.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      {selected && (
        <span className={`ml-3 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[selected.status]}`}>
          {STATUS_LABELS[selected.status]}
        </span>
      )}
    </div>
  );
}
