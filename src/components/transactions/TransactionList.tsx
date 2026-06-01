'use client';

import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardList, Pencil, Trash2, ListChecks, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Lock, Contact as ContactIcon, TextSearch, Search, X } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import type { Transaction, TransactionCategory, Contact } from '@/types';
import { formatCurrency, formatDateShort } from '@/lib/utils';
import { CategoryBadge } from '@/components/ui/CategoryBadge';

interface TransactionListProps {
  transactions: Transaction[];
  loading: boolean;
  onRowClick?: (transaction: Transaction) => void;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: () => void;
  /** IDs of transactions already linked to an invoice — for the INV badge. */
  invoicedTransactionIds?: Set<string>;
  highlightAfter?: string | null;
  highlightIds?: Set<string>;
  categoryFilter?: '' | TransactionCategory | 'SETTLE';
  onCategoryFilterChange?: (category: '' | TransactionCategory | 'SETTLE') => void;
  contactFilter?: string;
  onContactFilterChange?: (contact: string) => void;
  descriptionSearch?: string;
  onDescriptionSearchChange?: (keyword: string) => void;
  dateRange?: { start: string; end: string };
  onDateRangeChange?: (range: { start: string; end: string }) => void;
  onEnterSelectMode?: () => void;
  closedUntilDate?: string | null;
  rowOffset?: number;
  contacts?: Contact[];
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
}

const CATEGORIES: TransactionCategory[] = ['EARN', 'OPEX', 'VAR', 'CAPEX', 'TAX', 'FIN'];

const BADGE_CLASSES: Record<TransactionCategory, string> = {
  EARN: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  OPEX: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  VAR: 'bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400',
  CAPEX: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  TAX: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
  FIN: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
};


const SETTLE_BADGE_CLASS = 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400';

const STOCK_BADGE_CLASS = 'bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400';

function getMonthKey(date: string) {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}`;
}


function isInventoryTransaction(transaction: Transaction): boolean {
  const debitCode = transaction.debit_account?.account_code || '';
  const debitName = transaction.debit_account?.account_name?.toLowerCase() || '';
  return transaction.category === 'VAR' && (
    debitCode.startsWith('13') ||
    debitName.includes('inventory') ||
    debitName.includes('persediaan')
  );
}

// Kolom Kontak selalu tampilkan inputan kontak (transaction.name) untuk semua kategori
function getRowSubject(transaction: Transaction): string {
  return transaction.name;
}

function DescriptionCell({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el) setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  return (
    <div className="relative group">
      <span ref={ref} className="line-clamp-2 cursor-default">
        {text}
      </span>
      {isOverflowing && (
        <div className="absolute left-0 bottom-full mb-2 z-50 hidden group-hover:block w-64 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg p-3 shadow-xl pointer-events-none">
          {text}
        </div>
      )}
    </div>
  );
}

// Helper function to format account display based on transaction type
function getAccountDisplay(transaction: Transaction): { accountName: string; isInflow: boolean; tooltip: string } {
  const isInflow = transaction.category === 'EARN';

  // For double-entry transactions
  if (transaction.is_double_entry && (transaction.debit_account || transaction.credit_account)) {
    if (isInflow) {
      const accountName = transaction.debit_account?.account_name || 'Unknown';
      return { accountName, isInflow, tooltip: `Masuk ke akun ${accountName}` };
    } else {
      const accountName = transaction.credit_account?.account_name || 'Unknown';
      return { accountName, isInflow, tooltip: `Keluar dari akun ${accountName}` };
    }
  }

  // For legacy transactions
  const accountName = transaction.account || 'Unknown';
  if (isInflow) {
    return { accountName, isInflow, tooltip: `Masuk ke akun ${accountName}` };
  } else {
    return { accountName, isInflow, tooltip: `Keluar dari akun ${accountName}` };
  }
}

// Helper function to check if subject is a contact
function isSubjectContact(subject: string, contacts: Contact[]): boolean {
  return contacts.some(c => c.name.toLowerCase() === subject.toLowerCase());
}

// Helper function to get transaction contact name for contact matching
function getTransactionContactName(transaction: Transaction): string {
  // Always check transaction.name for contact matching (this is where customer/vendor name is stored)
  return transaction.name;
}

export function TransactionList({
  transactions,
  loading,
  onRowClick,
  onEdit,
  onDelete,
  selectMode,
  selectedIds,
  invoicedTransactionIds,
  onToggleSelect,
  onSelectAll,
  highlightAfter,
  highlightIds,
  categoryFilter,
  onCategoryFilterChange,
  contactFilter,
  onContactFilterChange,
  descriptionSearch = '',
  onDescriptionSearchChange,
  dateRange,
  onDateRangeChange,
  onEnterSelectMode,
  closedUntilDate,
  rowOffset = 0,
  contacts = [],
  hasActiveFilters = false,
  onResetFilters,
}: TransactionListProps) {
  const { t } = useLanguage();
  const showActions = (onEdit || onDelete || onEnterSelectMode) && !selectMode;
  const allSelected = selectMode && transactions.length > 0 && transactions.every((t) => selectedIds?.has(t.id));
  const tableColumnCount = 7 + (selectMode ? 1 : 0) + (showActions ? 1 : 0);
  const activeDescriptionSearch = descriptionSearch.trim();

  // Category filter dropdown state
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categoryDropdownStyle, setCategoryDropdownStyle] = useState<CSSProperties>({});
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const categoryMenuRef = useRef<HTMLDivElement>(null);

  // Contact filter dropdown state
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [contactDropdownStyle, setContactDropdownStyle] = useState<CSSProperties>({});
  const [mounted, setMounted] = useState(false);
  const contactDropdownRef = useRef<HTMLDivElement>(null);
  const contactMenuRef = useRef<HTMLDivElement>(null);

  // Description keyword search dropdown state
  const [showDescriptionSearch, setShowDescriptionSearch] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(descriptionSearch);
  const [descriptionDropdownStyle, setDescriptionDropdownStyle] = useState<CSSProperties>({});
  const descriptionSearchRef = useRef<HTMLDivElement>(null);
  const descriptionMenuRef = useRef<HTMLFormElement>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  // Date filter dropdown state
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const dateDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateCategoryDropdownPosition = useCallback(() => {
    if (!categoryDropdownRef.current) return;
    const rect = categoryDropdownRef.current.getBoundingClientRect();
    const availableWidth = Math.max(160, window.innerWidth - 16);
    const width = Math.min(Math.max(rect.width, 160), availableWidth);
    const left = Math.min(Math.max(rect.left, 8), window.innerWidth - width - 8);
    const spaceBelow = window.innerHeight - rect.bottom - 16;
    const spaceAbove = rect.top - 16;
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, Math.min(320, openUp ? spaceAbove : spaceBelow));

    setCategoryDropdownStyle({
      position: 'fixed',
      top: openUp ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4,
      left,
      width,
      maxHeight,
      zIndex: 9999,
    });
  }, []);

  const updateContactDropdownPosition = useCallback(() => {
    if (!contactDropdownRef.current) return;
    const rect = contactDropdownRef.current.getBoundingClientRect();
    const availableWidth = Math.max(160, window.innerWidth - 16);
    const width = Math.min(Math.max(rect.width, 220), availableWidth);
    const left = Math.min(Math.max(rect.left, 8), window.innerWidth - width - 8);
    const spaceBelow = window.innerHeight - rect.bottom - 16;
    const spaceAbove = rect.top - 16;
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, Math.min(320, openUp ? spaceAbove : spaceBelow));

    setContactDropdownStyle({
      position: 'fixed',
      top: openUp ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4,
      left,
      width,
      maxHeight,
      zIndex: 9999,
    });
  }, []);

  const updateDescriptionDropdownPosition = useCallback(() => {
    if (!descriptionSearchRef.current) return;
    const rect = descriptionSearchRef.current.getBoundingClientRect();
    const availableWidth = Math.max(220, window.innerWidth - 16);
    const width = Math.min(280, availableWidth);
    const left = Math.min(Math.max(rect.left, 8), window.innerWidth - width - 8);
    const spaceBelow = window.innerHeight - rect.bottom - 16;
    const spaceAbove = rect.top - 16;
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(150, Math.min(240, openUp ? spaceAbove : spaceBelow));

    setDescriptionDropdownStyle({
      position: 'fixed',
      top: openUp ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4,
      left,
      width,
      maxHeight,
      zIndex: 9999,
    });
  }, []);

  const toggleCategoryDropdown = () => {
    setShowCategoryDropdown((open) => {
      const next = !open;
      if (next) requestAnimationFrame(updateCategoryDropdownPosition);
      return next;
    });
  };

  const toggleContactDropdown = () => {
    setShowContactDropdown((open) => {
      const next = !open;
      if (next) requestAnimationFrame(updateContactDropdownPosition);
      return next;
    });
  };

  const toggleDescriptionSearch = () => {
    setShowDescriptionSearch((open) => {
      const next = !open;
      if (next) {
        setDescriptionDraft(descriptionSearch);
        requestAnimationFrame(updateDescriptionDropdownPosition);
      }
      return next;
    });
  };

  const resetDescriptionSearch = () => {
    setDescriptionDraft('');
    onDescriptionSearchChange?.('');
    setShowDescriptionSearch(false);
  };

  useEffect(() => {
    if (!showCategoryDropdown) return;
    updateCategoryDropdownPosition();
    window.addEventListener('scroll', updateCategoryDropdownPosition, true);
    window.addEventListener('resize', updateCategoryDropdownPosition);
    return () => {
      window.removeEventListener('scroll', updateCategoryDropdownPosition, true);
      window.removeEventListener('resize', updateCategoryDropdownPosition);
    };
  }, [showCategoryDropdown, updateCategoryDropdownPosition]);

  useEffect(() => {
    if (!showContactDropdown) return;
    updateContactDropdownPosition();
    window.addEventListener('scroll', updateContactDropdownPosition, true);
    window.addEventListener('resize', updateContactDropdownPosition);
    return () => {
      window.removeEventListener('scroll', updateContactDropdownPosition, true);
      window.removeEventListener('resize', updateContactDropdownPosition);
    };
  }, [showContactDropdown, updateContactDropdownPosition]);

  useEffect(() => {
    if (!showDescriptionSearch) {
      setDescriptionDraft(descriptionSearch);
      return;
    }

    updateDescriptionDropdownPosition();
    requestAnimationFrame(() => descriptionInputRef.current?.focus());
    window.addEventListener('scroll', updateDescriptionDropdownPosition, true);
    window.addEventListener('resize', updateDescriptionDropdownPosition);
    return () => {
      window.removeEventListener('scroll', updateDescriptionDropdownPosition, true);
      window.removeEventListener('resize', updateDescriptionDropdownPosition);
    };
  }, [showDescriptionSearch, descriptionSearch, updateDescriptionDropdownPosition]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node) &&
        categoryMenuRef.current && !categoryMenuRef.current.contains(e.target as Node)
      ) {
        setShowCategoryDropdown(false);
      }
      if (
        contactDropdownRef.current && !contactDropdownRef.current.contains(e.target as Node) &&
        contactMenuRef.current && !contactMenuRef.current.contains(e.target as Node)
      ) {
        setShowContactDropdown(false);
      }
      if (
        descriptionSearchRef.current && !descriptionSearchRef.current.contains(e.target as Node) &&
        descriptionMenuRef.current && !descriptionMenuRef.current.contains(e.target as Node)
      ) {
        setShowDescriptionSearch(false);
      }
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setShowDateDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500 dark:text-gray-400">{t.transactions.loadingTransactions}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <table className="w-full table-fixed min-w-[800px]">
        <colgroup>
          {selectMode && <col className="w-8" />}
          <col className="w-10" />
          <col className="w-28" />
          <col className="w-36" />
          <col className="w-48" />
          <col className="w-24" />
          <col className="w-32" />
          <col className="w-32" />
          {showActions && <col className="w-28" />}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
          <tr className="border-b-2 border-gray-300 dark:border-gray-500">
            {selectMode && (
              <th className="py-3 px-2 md:py-4">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onSelectAll?.()}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 accent-indigo-500 focus:ring-indigo-500"
                />
              </th>
            )}
            <th className="text-left py-3 px-2 md:py-4 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{t.transactions.tableNo}</th>

            {/* Kategori header with filter dropdown */}
            <th className="text-left py-3 pl-1 pr-2 md:py-4 md:pl-2 md:pr-4 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <div className="relative" ref={categoryDropdownRef}>
                <button
                  onClick={toggleCategoryDropdown}
                  className={`flex items-center gap-1 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200 transition-colors ${categoryFilter ? 'text-indigo-500 dark:text-indigo-400 font-medium' : ''}`}
                >
                  {categoryFilter || t.transactions.tableCategory}
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {mounted && showCategoryDropdown && createPortal(
                  <div
                    ref={categoryMenuRef}
                    style={categoryDropdownStyle}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 overflow-y-auto"
                  >
                    <button
                      onClick={() => { onCategoryFilterChange?.(''); setShowCategoryDropdown(false); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${!categoryFilter ? 'text-indigo-500 dark:text-indigo-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                    >
                      {t.common.all}
                    </button>
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => { onCategoryFilterChange?.(cat); setShowCategoryDropdown(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <CategoryBadge category={cat} showLabel size="sm" />
                      </button>
                    ))}
                    <button
                      onClick={() => { onCategoryFilterChange?.('SETTLE'); setShowCategoryDropdown(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <CategoryBadge category="SETTLE" showLabel size="sm" />
                    </button>
                  </div>,
                  document.body
                )}
              </div>
            </th>

            {/* Contact header with filter dropdown */}
            <th className="text-left py-3 px-2 md:py-4 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <div className="relative" ref={contactDropdownRef}>
                <button
                  onClick={toggleContactDropdown}
                  className={`flex items-center gap-1 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200 transition-colors ${contactFilter ? 'text-indigo-500 dark:text-indigo-400 font-medium' : ''}`}
                >
                  <span className={contactFilter ? 'truncate max-w-[140px]' : ''}>{contactFilter || t.transactions.tableSubject}</span>
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {mounted && showContactDropdown && createPortal(
                  <div
                    ref={contactMenuRef}
                    style={contactDropdownStyle}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 overflow-hidden flex flex-col"
                  >
                    <div className="px-2 pb-1 border-b border-gray-100 dark:border-gray-700">
                      <input
                        type="text"
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                        placeholder={t.common.search}
                        className="w-full px-2 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded normal-case text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    </div>
                    <div className="overflow-y-auto">
                      <button
                        onClick={() => { onContactFilterChange?.(''); setShowContactDropdown(false); setContactSearch(''); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${!contactFilter ? 'text-indigo-500 dark:text-indigo-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                      >
                        {t.common.all}
                      </button>
                      {contacts
                        .filter((c) => c.name.toLowerCase().includes(contactSearch.toLowerCase()))
                        .map((c) => (
                          <button
                            key={c.id}
                            onClick={() => { onContactFilterChange?.(c.name); setShowContactDropdown(false); setContactSearch(''); }}
                            className={`w-full text-left px-3 py-2 text-sm normal-case hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${contactFilter === c.name ? 'text-indigo-500 dark:text-indigo-400 font-semibold' : 'text-gray-700 dark:text-gray-300'}`}
                          >
                            <ContactIcon className="w-3.5 h-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                            <span className="truncate">{c.name}</span>
                          </button>
                        ))}
                      {contacts.filter((c) => c.name.toLowerCase().includes(contactSearch.toLowerCase())).length === 0 && (
                        <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 normal-case">
                          {t.nav.notFound}
                        </div>
                      )}
                    </div>
                  </div>,
                  document.body
                )}
              </div>
            </th>
            <th className="text-left py-3 px-2 md:py-4 md:px-4 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <div className="relative" ref={descriptionSearchRef}>
                <button
                  type="button"
                  onClick={toggleDescriptionSearch}
                  className={`flex min-w-0 items-center gap-1 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200 transition-colors ${activeDescriptionSearch ? 'text-indigo-500 dark:text-indigo-400 font-medium' : ''}`}
                  title={activeDescriptionSearch ? `${t.transactions.tableDescription}: ${activeDescriptionSearch}` : `${t.common.search} ${t.transactions.tableDescription}`}
                >
                  <span className="truncate max-w-[128px]">
                    {activeDescriptionSearch || t.transactions.tableDescription}
                  </span>
                  <TextSearch className="w-3.5 h-3.5 flex-shrink-0" />
                </button>
                {mounted && showDescriptionSearch && createPortal(
                  <form
                    ref={descriptionMenuRef}
                    style={descriptionDropdownStyle}
                    onSubmit={(e) => {
                      e.preventDefault();
                      setShowDescriptionSearch(false);
                    }}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 overflow-hidden"
                  >
                    <label className="block text-xs font-medium normal-case text-gray-500 dark:text-gray-400 mb-2">
                      {t.common.search} {t.transactions.tableDescription.toLowerCase()}
                    </label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                      <input
                        ref={descriptionInputRef}
                        type="text"
                        value={descriptionDraft}
                        onChange={(e) => {
                        setDescriptionDraft(e.target.value);
                        onDescriptionSearchChange?.(e.target.value.trim());
                      }}
                        placeholder={`${t.common.search} ${t.transactions.tableDescription.toLowerCase()}...`}
                        className="w-full rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 py-2 pl-8 pr-8 text-sm normal-case text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                      {descriptionDraft && (
                        <button
                          type="button"
                          onClick={() => setDescriptionDraft('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-600 dark:hover:text-gray-200"
                          title={t.common.reset}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {(activeDescriptionSearch || descriptionDraft.trim()) && (
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={resetDescriptionSearch}
                          className="px-2.5 py-1.5 text-xs font-medium normal-case text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                        >
                          {t.common.reset}
                        </button>
                      </div>
                    )}
                  </form>,
                  document.body
                )}
              </div>
            </th>

            {/* Tanggal header with date filter dropdown */}
            <th className="text-left py-3 px-2 md:py-4 md:px-4 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <div className="relative" ref={dateDropdownRef}>
                <button
                  onClick={() => setShowDateDropdown(!showDateDropdown)}
                  className={`flex items-center gap-1 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200 transition-colors ${dateRange?.start || dateRange?.end ? 'text-indigo-500 dark:text-indigo-400 font-medium' : ''}`}
                >
                  {t.transactions.tableDate}
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showDateDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 min-w-[220px] z-20">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t.common.from}</label>
                    <input
                      type="date"
                      value={dateRange?.start || ''}
                      onChange={(e) => onDateRangeChange?.({ start: e.target.value, end: dateRange?.end || '' })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 mb-2"
                    />
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t.common.to}</label>
                    <input
                      type="date"
                      value={dateRange?.end || ''}
                      onChange={(e) => onDateRangeChange?.({ start: dateRange?.start || '', end: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 mb-2"
                    />
                    {(dateRange?.start || dateRange?.end) && (
                      <button
                        onClick={() => { onDateRangeChange?.({ start: '', end: '' }); setShowDateDropdown(false); }}
                        className="w-full text-center text-xs text-red-500 hover:text-red-600 py-1"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                )}
              </div>
            </th>

            <th className="text-left py-3 px-2 md:py-4 md:px-4 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{t.transactions.tableAmount}</th>
            <th className="text-left py-3 px-2 md:py-4 md:px-4 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{t.transactions.tableCashFlow}</th>
            {showActions && (
              <th className="text-left py-3 px-2 md:py-4 md:px-4 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{t.transactions.tableAction}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 ? (
            <tr>
              <td colSpan={tableColumnCount} className="py-16">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ClipboardList className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                    {hasActiveFilters ? t.transactions.noTransactionsFiltered : t.transactions.noTransactions}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    {hasActiveFilters ? t.transactions.noTransactionsFilteredHint : t.transactions.noTransactionsHint}
                  </p>
                  {hasActiveFilters && onResetFilters && (
                    <button
                      type="button"
                      onClick={onResetFilters}
                      className="mt-5 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors"
                    >
                      {t.common.reset} {t.common.filter}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ) : transactions.map((transaction, index) => {
            const isNewMonth = index > 0 && getMonthKey(transaction.date) !== getMonthKey(transactions[index - 1].date);
            const isHighlighted = highlightAfter && transaction.created_at && transaction.created_at >= highlightAfter;
            const isIdHighlighted = highlightIds?.has(transaction.id);
            return (
              <tr
                key={transaction.id}
                onClick={() => selectMode ? onToggleSelect?.(transaction.id) : onRowClick?.(transaction)}
                className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  isNewMonth ? 'border-t-2 border-t-gray-300 dark:border-t-gray-500' : ''
                } ${
                  selectMode
                    ? `cursor-pointer ${selectedIds?.has(transaction.id) ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`
                    : onRowClick ? 'cursor-pointer' : ''
                } ${
                  isHighlighted ? 'animate-import-highlight' : ''
                } ${
                  isIdHighlighted ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-400 dark:border-l-blue-500' : ''
                }`}
              >
              {selectMode && (
                <td className="py-3 px-2 md:py-4">
                  <input
                    type="checkbox"
                    checked={selectedIds?.has(transaction.id) ?? false}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleSelect?.(transaction.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 accent-indigo-500 focus:ring-indigo-500"
                  />
                </td>
              )}
              <td className="py-3 px-2 md:py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {rowOffset + index + 1}
              </td>
              <td className="py-3 pl-1 pr-2 md:py-4 md:pl-2 md:pr-4">
                <div className="flex items-center gap-1">
                  {isInventoryTransaction(transaction) ? (
                    <span className={`inline-flex items-center px-2 md:px-3 py-1 rounded-full text-xs font-semibold ${STOCK_BADGE_CLASS}`}>
                      STOCK
                    </span>
                  ) : transaction.meta?.settlement_of_transaction_id ? (
                    <span className={`inline-flex items-center px-2 md:px-3 py-1 rounded-full text-xs font-semibold ${SETTLE_BADGE_CLASS}`}>
                      SETTLE
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center px-2 md:px-3 py-1 rounded-full text-xs font-semibold ${BADGE_CLASSES[transaction.category]}`}
                    >
                      {transaction.category}
                    </span>
                  )}
                  {transaction.status === 'draft' && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                      DRAFT
                    </span>
                  )}
                  {invoicedTransactionIds?.has(transaction.id) && (
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                      title="Sudah dibuatkan invoice"
                    >
                      INV
                    </span>
                  )}
                </div>
              </td>
              <td className="py-3 px-2 md:py-4 text-sm font-medium text-gray-800 dark:text-gray-200 break-words">
                <div className="flex items-center gap-2">
                  {isSubjectContact(getTransactionContactName(transaction), contacts) && (
                    <div className="relative group">
                      <ContactIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                      <div className="absolute left-0 bottom-full mb-1 z-50 hidden group-hover:block whitespace-nowrap">
                        <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 shadow-lg">
                          Kontak tersimpan
                        </div>
                      </div>
                    </div>
                  )}
                  <span>{getRowSubject(transaction)}</span>
                </div>
              </td>
              <td className="py-3 px-2 md:py-4 md:px-4 text-sm text-gray-700 dark:text-gray-300 max-w-[200px]">
                <DescriptionCell text={transaction.description || ''} />
              </td>
              <td className="py-3 px-2 md:py-4 md:px-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {formatDateShort(transaction.date)}
              </td>
              <td className={`py-3 px-2 md:py-4 md:px-4 text-sm font-medium whitespace-nowrap ${
                transaction.meta?.settlement_of_transaction_id
                  ? 'text-gray-900 dark:text-gray-300'
                  : transaction.category === 'EARN'
                  ? 'text-emerald-500 dark:text-emerald-400'
                  : transaction.category === 'OPEX' || transaction.category === 'VAR' || transaction.category === 'TAX'
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-gray-900 dark:text-gray-300'
              }`}>
                <div className="text-right">
                  <div>{formatCurrency(transaction.amount)}</div>
                  {transaction.currency_code && transaction.currency_code !== 'IDR' && transaction.original_amount && (
                    <div className="text-[11px] font-normal text-gray-400 dark:text-gray-500">
                      {formatCurrency(transaction.original_amount, transaction.currency_code)}
                    </div>
                  )}
                </div>
              </td>
              <td className="py-3 px-2 md:py-4 md:px-4 text-sm text-gray-800 dark:text-gray-200 break-words">
                {(() => {
                  // Multi-line journal: distinct icon
                  if (transaction.is_multi_line) {
                    return (
                      <div className="group/transfer relative flex items-center gap-1.5">
                        <ArrowLeftRight className="w-3.5 h-3.5 flex-shrink-0 text-indigo-500 dark:text-indigo-400" />
                        <span className="truncate font-medium">Multi-line journal</span>
                        <div className="pointer-events-none absolute top-full left-0 mt-1.5 hidden group-hover/transfer:block z-30">
                          <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                            <div className="absolute bottom-full left-3 border-4 border-transparent border-b-gray-900 dark:border-b-gray-700" />
                            Jurnal multi-line (beberapa akun)
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const { accountName, isInflow, tooltip } = getAccountDisplay(transaction);
                  return (
                    <div className="group/transfer relative flex items-center gap-1.5">
                      {isInflow ? (
                        <ArrowDownLeft className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500 dark:text-emerald-400" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5 flex-shrink-0 text-red-500 dark:text-red-400" />
                      )}
                      <span className="truncate font-medium">{accountName}</span>
                      {/* Custom tooltip */}
                      <div className="pointer-events-none absolute top-full left-0 mt-1.5 hidden group-hover/transfer:block z-30">
                        <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                          <div className="absolute bottom-full left-3 border-4 border-transparent border-b-gray-900 dark:border-b-gray-700" />
                          {tooltip}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </td>
              {showActions && (
                <td className="py-3 px-2 md:py-4 md:px-4">
                  <div className="flex items-center gap-1">
                    {(() => {
                      const isLocked = !!closedUntilDate && transaction.date <= closedUntilDate;
                      if (isLocked) {
                        return (
                          <span
                            title={`Periode terkunci hingga ${closedUntilDate}`}
                            className="p-1.5 text-amber-400 dark:text-amber-500"
                          >
                            <Lock className="w-4 h-4" />
                          </span>
                        );
                      }
                      return (
                        <>
                          {onEdit && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(transaction);
                              }}
                              className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(transaction);
                              }}
                              className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      );
                    })()}
                    {onEnterSelectMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEnterSelectMode();
                        }}
                        className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Pilih"
                      >
                        <ListChecks className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
