'use client';

import { useState, useMemo, Fragment } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { BudgetVsActualRow, AccountType } from '@/types';

interface BudgetVarianceTableProps {
  rows: BudgetVsActualRow[];
}

type SortKey = 'accountCode' | 'budgeted' | 'actual' | 'variance' | 'variancePercent';

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  REVENUE: 'Pendapatan',
  EXPENSE: 'Beban',
  ASSET: 'Aset',
  LIABILITY: 'Liabilitas',
  EQUITY: 'Ekuitas',
};

export function BudgetVarianceTable({ rows }: BudgetVarianceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('accountCode');
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedTypes, setExpandedTypes] = useState<Set<AccountType>>(new Set(['REVENUE', 'EXPENSE']));

  // Aggregate rows by account (sum across months)
  const aggregated = useMemo(() => {
    const map = new Map<string, {
      accountId: string;
      accountCode: string;
      accountName: string;
      accountType: AccountType;
      budgeted: number;
      actual: number;
    }>();

    rows.forEach((row) => {
      const existing = map.get(row.accountId);
      if (existing) {
        existing.budgeted += row.budgeted;
        existing.actual += row.actual;
      } else {
        map.set(row.accountId, {
          accountId: row.accountId,
          accountCode: row.accountCode,
          accountName: row.accountName,
          accountType: row.accountType,
          budgeted: row.budgeted,
          actual: row.actual,
        });
      }
    });

    return Array.from(map.values()).map((r) => {
      const isRevenue = r.accountType === 'REVENUE';
      const variance = isRevenue ? r.actual - r.budgeted : r.budgeted - r.actual;
      const variancePercent = r.budgeted !== 0 ? (variance / r.budgeted) * 100 : 0;
      return { ...r, variance, variancePercent };
    });
  }, [rows]);

  // Group by account type
  const grouped = useMemo(() => {
    const groups = new Map<AccountType, typeof aggregated>();
    aggregated.forEach((row) => {
      const group = groups.get(row.accountType) || [];
      group.push(row);
      groups.set(row.accountType, group);
    });

    // Sort within groups
    groups.forEach((items) => {
      items.sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
      });
    });

    return groups;
  }, [aggregated, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const toggleType = (type: AccountType) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none"
      onClick={() => toggleSort(field)}
    >
      {label} {sortKey === field ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  );

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-gray-500">
        Belum ada data budget untuk ditampilkan.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 cursor-pointer" onClick={() => toggleSort('accountCode')}>
              Akun {sortKey === 'accountCode' ? (sortAsc ? '↑' : '↓') : ''}
            </th>
            <SortHeader label="Budget" field="budgeted" />
            <SortHeader label="Aktual" field="actual" />
            <SortHeader label="Variance" field="variance" />
            <SortHeader label="%" field="variancePercent" />
          </tr>
        </thead>
        <tbody>
          {Array.from(grouped.entries()).map(([type, items]) => {
            const isExpanded = expandedTypes.has(type);
            const subtotalBudgeted = items.reduce((s, r) => s + r.budgeted, 0);
            const subtotalActual = items.reduce((s, r) => s + r.actual, 0);
            const isRevenue = type === 'REVENUE';
            const subtotalVariance = isRevenue
              ? subtotalActual - subtotalBudgeted
              : subtotalBudgeted - subtotalActual;
            const subtotalPercent = subtotalBudgeted !== 0
              ? (subtotalVariance / subtotalBudgeted) * 100
              : 0;

            return (
              <Fragment key={type}>
                {/* Group header */}
                <tr
                  className="bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50"
                  onClick={() => toggleType(type)}
                >
                  <td className="px-4 py-2.5 font-semibold text-gray-700 dark:text-gray-200" colSpan={1}>
                    <span className="flex items-center gap-1.5">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      {ACCOUNT_TYPE_LABELS[type] || type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-700 dark:text-gray-200">
                    {formatCurrency(subtotalBudgeted)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-700 dark:text-gray-200">
                    {formatCurrency(subtotalActual)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${subtotalVariance === 0 ? 'text-gray-500 dark:text-gray-400' : subtotalVariance > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {subtotalVariance > 0 ? '+' : ''}{formatCurrency(subtotalVariance)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${subtotalPercent === 0 ? 'text-gray-500 dark:text-gray-400' : subtotalPercent > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {subtotalPercent > 0 ? '+' : ''}{subtotalPercent.toFixed(1)}%
                  </td>
                </tr>

                {/* Individual rows */}
                {isExpanded && items.map((row) => (
                  <tr
                    key={row.accountId}
                    className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                  >
                    <td className="px-4 py-2.5 pl-10">
                      <span className="text-xs text-gray-400 dark:text-gray-500 mr-2">{row.accountCode}</span>
                      <span className="text-gray-700 dark:text-gray-300">{row.accountName}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-400">
                      {formatCurrency(row.budgeted)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-800 dark:text-gray-200">
                      {formatCurrency(row.actual)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium ${row.variance === 0 ? 'text-gray-500 dark:text-gray-400' : row.variance > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {row.variance > 0 ? '+' : ''}{formatCurrency(row.variance)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium ${row.variancePercent === 0 ? 'text-gray-500 dark:text-gray-400' : row.variancePercent > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {row.variancePercent > 0 ? '+' : ''}{row.variancePercent.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

