'use client';

import { useState, useMemo, useCallback, Fragment } from 'react';
import { Save, Copy, Divide, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { Account, BudgetLine, BudgetLineInput } from '@/types';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];

interface BudgetInputGridProps {
  accounts: Account[];
  budgetLines: BudgetLine[];
  months: string[];
  readOnly: boolean;
  saving: boolean;
  onSave: (lines: BudgetLineInput[]) => void;
  onCopyFromActual?: () => void;
}

export function BudgetInputGrid({
  accounts,
  budgetLines,
  months,
  readOnly,
  saving,
  onSave,
  onCopyFromActual,
}: BudgetInputGridProps) {
  // Build initial grid values from existing budget lines
  const initialValues = useMemo(() => {
    const map = new Map<string, number>();
    budgetLines.forEach((line) => {
      const monthKey = line.month.substring(0, 7);
      const fullMonth = months.find((m) => m.substring(0, 7) === monthKey);
      if (fullMonth) {
        map.set(`${line.account_id}:${fullMonth}`, line.amount);
      }
    });
    return map;
  }, [budgetLines, months]);

  const [values, setValues] = useState<Map<string, number>>(initialValues);
  const [hasChanges, setHasChanges] = useState(false);

  // Reset values when budgetLines change
  useMemo(() => {
    setValues(initialValues);
    setHasChanges(false);
  }, [initialValues]);

  // Group accounts by type
  const revenueAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === 'REVENUE'),
    [accounts]
  );
  const expenseAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === 'EXPENSE'),
    [accounts]
  );

  const updateValue = useCallback((accountId: string, month: string, amount: number) => {
    setValues((prev) => {
      const next = new Map(prev);
      next.set(`${accountId}:${month}`, amount);
      return next;
    });
    setHasChanges(true);
  }, []);

  // Distribute annual amount evenly
  const distributeEvenly = useCallback((accountId: string) => {
    const total = months.reduce((sum, m) => sum + (values.get(`${accountId}:${m}`) || 0), 0);
    if (total === 0) return;
    const perMonth = Math.round((total / months.length) * 100) / 100;
    setValues((prev) => {
      const next = new Map(prev);
      months.forEach((m) => next.set(`${accountId}:${m}`, perMonth));
      return next;
    });
    setHasChanges(true);
  }, [months, values]);

  // Row total
  const getRowTotal = useCallback(
    (accountId: string) =>
      months.reduce((sum, m) => sum + (values.get(`${accountId}:${m}`) || 0), 0),
    [months, values]
  );

  // Column total
  const getColumnTotal = useCallback(
    (month: string, accs: Account[]) =>
      accs.reduce((sum, a) => sum + (values.get(`${a.id}:${month}`) || 0), 0),
    [values]
  );

  const handleSave = () => {
    const lines: BudgetLineInput[] = [];
    values.forEach((amount, key) => {
      if (amount > 0) {
        const [accountId, month] = key.split(':');
        lines.push({ account_id: accountId, month, amount });
      }
    });
    onSave(lines);
    setHasChanges(false);
  };

  const renderAccountSection = (label: string, accs: Account[]) => {
    if (accs.length === 0) return null;

    return (
      <Fragment>
        {/* Section header */}
        <tr className="bg-gray-50 dark:bg-gray-800/50">
          <td className="px-3 py-2 font-semibold text-sm text-gray-700 dark:text-gray-200 sticky left-0 bg-gray-50 dark:bg-gray-800/50 z-10" colSpan={1}>
            {label}
          </td>
          {months.map((m) => {
            const [, mon] = m.split('-');
            return (
              <td key={`header-${label}-${m}`} className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                {MONTH_LABELS[parseInt(mon, 10) - 1]}
              </td>
            );
          })}
          <td className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
            Total
          </td>
          {!readOnly && <td className="px-2 py-2 w-10"></td>}
        </tr>

        {/* Account rows */}
        {accs.map((account) => (
          <tr key={account.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
            <td className="px-3 py-1.5 text-sm sticky left-0 bg-white dark:bg-gray-900 z-10 min-w-[180px]">
              <span className="text-xs text-gray-400 dark:text-gray-500 mr-1.5">{account.account_code}</span>
              <span className="text-gray-700 dark:text-gray-300">{account.account_name}</span>
            </td>
            {months.map((m) => {
              const key = `${account.id}:${m}`;
              const val = values.get(key) || 0;
              return (
                <td key={key} className="px-1 py-1">
                  {readOnly ? (
                    <span className="block text-right text-sm text-gray-700 dark:text-gray-300 px-2">
                      {val > 0 ? formatCurrency(val) : '-'}
                    </span>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      value={val || ''}
                      onChange={(e) => updateValue(account.id, m, parseFloat(e.target.value) || 0)}
                      className="w-full min-w-[100px] px-2 py-1.5 text-right text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
                      placeholder="0"
                    />
                  )}
                </td>
              );
            })}
            <td className="px-3 py-1.5 text-right text-sm font-medium text-gray-800 dark:text-gray-200">
              {formatCurrency(getRowTotal(account.id))}
            </td>
            {!readOnly && (
              <td className="px-1 py-1">
                <button
                  onClick={() => distributeEvenly(account.id)}
                  title="Bagi rata"
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <Divide className="w-3.5 h-3.5" />
                </button>
              </td>
            )}
          </tr>
        ))}

        {/* Subtotal row */}
        <tr className="border-b-2 border-gray-200 dark:border-gray-600">
          <td className="px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 sticky left-0 bg-white dark:bg-gray-900 z-10">
            Subtotal {label}
          </td>
          {months.map((m) => (
            <td key={`subtotal-${label}-${m}`} className="px-2 py-2 text-right text-sm font-semibold text-gray-700 dark:text-gray-200">
              {formatCurrency(getColumnTotal(m, accs))}
            </td>
          ))}
          <td className="px-3 py-2 text-right text-sm font-bold text-gray-800 dark:text-gray-100">
            {formatCurrency(accs.reduce((sum, a) => sum + getRowTotal(a.id), 0))}
          </td>
          {!readOnly && <td></td>}
        </tr>
      </Fragment>
    );
  };

  return (
    <div>
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="btn-primary inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
          {onCopyFromActual && (
            <button
              onClick={onCopyFromActual}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy dari Aktual
            </button>
          )}
          {hasChanges && (
            <span className="text-xs text-amber-600 dark:text-amber-400">Ada perubahan belum disimpan</span>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl">
        <table className="w-full text-sm">
          <tbody>
            {renderAccountSection('Pendapatan', revenueAccounts)}
            {renderAccountSection('Beban', expenseAccounts)}
          </tbody>
        </table>
      </div>

      {accounts.length === 0 && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          Tidak ada akun pendapatan atau beban yang aktif. Tambahkan akun di Chart of Accounts terlebih dahulu.
        </div>
      )}
    </div>
  );
}
