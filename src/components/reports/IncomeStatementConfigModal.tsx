'use client';

import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, RotateCcw, X, Loader2 } from 'lucide-react';
import type { Account } from '@/types';
import { bulkUpdateIncomeStatementSection } from '@/lib/api/accounts';

type Section = 'cost_of_revenue' | 'operating_expense';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  businessId: string;
  onSaved: () => void;
}

function defaultSection(acc: Account): Section {
  return acc.default_category === 'VAR' ? 'cost_of_revenue' : 'operating_expense';
}

function currentSection(acc: Account): Section {
  if (acc.income_statement_section === 'cost_of_revenue') return 'cost_of_revenue';
  if (acc.income_statement_section === 'operating_expense') return 'operating_expense';
  return defaultSection(acc);
}

export function IncomeStatementConfigModal({ isOpen, onClose, accounts, businessId, onSaved }: Props) {
  const [mounted, setMounted] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  // Map of accountId → Section (working state)
  const [assignments, setAssignments] = useState<Record<string, Section>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const raf = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setIsVisible(false);
    const timeout = setTimeout(() => setShouldRender(false), 200);
    return () => clearTimeout(timeout);
  }, [isOpen]);

  // Filter ke EXPENSE account yang non-TAX (TAX punya section terpisah di income statement)
  const expenseAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          a.account_type === 'EXPENSE' &&
          a.default_category !== 'TAX' &&
          a.is_active
      ),
    [accounts]
  );

  // Initialize assignments dari data account saat modal open
  useEffect(() => {
    if (!isOpen) return;
    const init: Record<string, Section> = {};
    for (const acc of expenseAccounts) {
      init[acc.id] = currentSection(acc);
    }
    setAssignments(init);
    setSelectedId(null);
  }, [isOpen, expenseAccounts]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, saving]);

  const cogsAccounts = expenseAccounts.filter((a) => assignments[a.id] === 'cost_of_revenue');
  const opexAccounts = expenseAccounts.filter((a) => assignments[a.id] === 'operating_expense');

  const isOverridden = (acc: Account): boolean => {
    const current = assignments[acc.id];
    const def = defaultSection(acc);
    return current !== def;
  };

  const moveTo = (accountId: string, section: Section) => {
    setAssignments((prev) => ({ ...prev, [accountId]: section }));
  };

  const resetToDefault = (accountId: string) => {
    const acc = expenseAccounts.find((a) => a.id === accountId);
    if (!acc) return;
    setAssignments((prev) => ({ ...prev, [accountId]: defaultSection(acc) }));
  };

  const hasChanges = useMemo(() => {
    return expenseAccounts.some((acc) => {
      const original = currentSection(acc);
      return assignments[acc.id] !== original;
    });
  }, [assignments, expenseAccounts]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = expenseAccounts
        .filter((acc) => {
          const original = currentSection(acc);
          return assignments[acc.id] !== original;
        })
        .map((acc) => {
          const newSection = assignments[acc.id];
          const def = defaultSection(acc);
          return {
            id: acc.id,
            // Kalau kembali ke default, set NULL biar future-proof terhadap default_category change
            section: newSection === def ? null : newSection,
          };
        });

      if (updates.length > 0) {
        await bulkUpdateIncomeStatementSection(businessId, updates);
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error('[IncomeStatementConfigModal] Save failed:', err);
      toast.error('Gagal menyimpan konfigurasi. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  if (!shouldRender || !mounted) return null;

  const selected = selectedId ? expenseAccounts.find((a) => a.id === selectedId) : null;

  const renderAccountRow = (acc: Account) => {
    const isSelected = selectedId === acc.id;
    const overridden = isOverridden(acc);
    return (
      <button
        key={acc.id}
        onClick={() => setSelectedId(acc.id)}
        className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
          isSelected
            ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-600'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                {acc.account_code}
              </span>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                {acc.account_name}
              </span>
            </div>
          </div>
          {overridden && (
            <span
              title="Override aktif (berbeda dari default)"
              className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
            >
              Override
            </span>
          )}
        </div>
      </button>
    );
  };

  const modalContent = (
    <div
      className={`fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-opacity duration-200 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      onClick={() => !saving && onClose()}
    >
      <div
        className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col transition-all duration-200 ease-out ${isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
              Konfigurasi Income Statement
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Klasifikasikan akun expense ke Cost of Revenue atau Operating Expenses. Klik akun lalu gunakan tombol panah untuk memindahkan.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Body: 3 panels (COGS | Detail+Controls | OpEx) */}
        <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-[1fr_1fr_1fr] gap-3 p-5">
          {/* Left: Cost of Revenue */}
          <div className="flex flex-col min-h-0 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-900/30">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase">
                Cost of Revenue
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {cogsAccounts.length} akun
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cogsAccounts.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">
                  Belum ada akun
                </p>
              ) : (
                cogsAccounts.map(renderAccountRow)
              )}
            </div>
          </div>

          {/* Middle: Detail akun yang dipilih + Controls */}
          <div className="flex flex-col min-h-0 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase">
                Detail Akun
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Pilih akun untuk memindahkan
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {selected ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Kode Akun</p>
                    <p className="text-sm font-mono text-gray-800 dark:text-gray-100">
                      {selected.account_code}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Nama Akun</p>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                      {selected.account_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Klasifikasi Default</p>
                    <p className="text-sm text-gray-700 dark:text-gray-200">
                      {defaultSection(selected) === 'cost_of_revenue' ? 'Cost of Revenue' : 'Operating Expenses'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Klasifikasi Saat Ini</p>
                    <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                      {assignments[selected.id] === 'cost_of_revenue' ? 'Cost of Revenue' : 'Operating Expenses'}
                    </p>
                  </div>
                  {selected.description && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Deskripsi</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        {selected.description}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">
                  Klik akun di kiri/kanan untuk melihat detail
                </p>
              )}
            </div>
            {/* Controls di bawah detail */}
            {selected && (
              <div className="border-t border-gray-200 dark:border-gray-700 p-3 flex items-center justify-center gap-2">
                <button
                  onClick={() => selectedId && moveTo(selectedId, 'cost_of_revenue')}
                  disabled={assignments[selected.id] === 'cost_of_revenue'}
                  title="Pindah ke Cost of Revenue"
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-300 dark:hover:border-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  COGS
                </button>
                <button
                  onClick={() => selectedId && moveTo(selectedId, 'operating_expense')}
                  disabled={assignments[selected.id] === 'operating_expense'}
                  title="Pindah ke Operating Expenses"
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-300 dark:hover:border-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  OpEx
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                {isOverridden(selected) && (
                  <button
                    onClick={() => selectedId && resetToDefault(selectedId)}
                    title="Reset ke default"
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right: Operating Expenses */}
          <div className="flex flex-col min-h-0 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-900/30">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase">
                Operating Expenses
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {opexAccounts.length} akun
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {opexAccounts.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">
                  Belum ada akun
                </p>
              ) : (
                opexAccounts.map(renderAccountRow)
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-700 shrink-0">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {hasChanges ? 'Ada perubahan yang belum disimpan' : 'Belum ada perubahan'}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
