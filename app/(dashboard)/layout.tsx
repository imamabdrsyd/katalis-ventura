'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { BusinessProvider, useBusinessContext } from '@/context/BusinessContext';
import { useLanguage } from '@/context/LanguageContext';
import { createClient } from '@/lib/supabase';
import { BusinessSwitcher } from '@/components/business/BusinessSwitcher';
import {
  PieChart,
  CreditCard,
  Building2,
  DollarSign,
  Scale,
  ArrowLeftRight,
  LogOut,
  Search,
  ChevronDown,
  LucideIcon,
  Menu,
  PanelLeft,
  X,
  Settings,
  BookOpen,
  BookOpenCheck,
  ClipboardCheck,
  Zap,
  FlaskConical,
  Plus,
  UserPlus,
  Calculator,
  ChartNoAxesCombined,
  LineChart,
  Target,
  Calendar,
  CalendarDays,
  HandCoins,
  Languages,
  FileText,
  RefreshCw,
  Upload,
  GitBranch,
  Landmark,
  Bot,
  Store,
  MessagesSquare,
} from 'lucide-react';

import { motion, useReducedMotion } from 'framer-motion';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { FloatingQuickAdd } from '@/components/transactions/FloatingQuickAdd';
import { AIChatFAB } from '@/components/ai/AIChatFAB';
import { CATEGORY_BADGE_CLASSES } from '@/lib/categoryColors';
import { useNotifications } from '@/hooks/useNotifications';
import { isManagerRole } from '@/lib/roles';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/**
 * Menu "Catalog" lama kini swap by tipe bisnis (hub Point of Sales / Calendar):
 * - jasa → "Calendar" (/calendar)
 * - produk/dagang/legacy (tipe kosong) → "Point of Sales" (/point-of-sales)
 * Dipakai DUA situs (Sidebar + SearchDialog) — keduanya wajib panggil helper ini
 * agar tidak drift.
 */
function getPosNavItem(
  businessType: string | undefined,
  nav: { pointOfSales: string; calendar: string }
): NavItem {
  if (businessType === 'jasa') {
    return { href: '/calendar', label: nav.calendar, icon: CalendarDays };
  }
  return { href: '/point-of-sales', label: nav.pointOfSales, icon: Store };
}

type NavSection = {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

const SIDEBAR_DEFAULT_HIDDEN = ['/trial-balance', '/ar-ap', '/invoices', '/reconciliation', '/market', '/statement-of-changes-in-equity', '/agent'];

function useNavData() {
  const { t } = useLanguage();

  const roleLabels: Record<string, string> = useMemo(() => ({
    business_manager: t.roles.businessManager,
    investor: t.roles.investor,
    superadmin: t.roles.superAdmin,
  }), [t]);

  const navSections: NavSection[] = useMemo(() => [
    {
      label: t.nav.accounting,
      icon: Calculator,
      items: [
        { href: '/accounts', label: t.nav.chartOfAccounts, icon: BookOpen },
        { href: '/general-ledger', label: t.nav.generalLedger, icon: BookOpenCheck },
        { href: '/trial-balance', label: t.nav.trialBalance, icon: ClipboardCheck },
        { href: '/ar-ap', label: t.nav.arAp, icon: HandCoins },
        { href: '/invoices', label: t.nav.invoice, icon: FileText },
        { href: '/reconciliation', label: t.nav.bankReconciliation, icon: Landmark },
      ],
    },
    {
      label: t.nav.financialReports,
      icon: Scale,
      items: [
        { href: '/income-statement', label: t.nav.profitLoss, icon: DollarSign },
        { href: '/balance-sheet', label: t.nav.balanceSheet, icon: Scale },
        { href: '/cash-flow', label: t.nav.cashFlow, icon: ArrowLeftRight },
        { href: '/statement-of-changes-in-equity', label: t.nav.changesInEquity, icon: GitBranch },
      ],
    },
    {
      label: t.nav.analytics,
      icon: ChartNoAxesCombined,
      items: [
        { href: '/scenario-modeling', label: t.nav.scenarioModeling, icon: FlaskConical },
        { href: '/roi-forecast', label: t.nav.budgetForecast, icon: Target },
        { href: '/market', label: t.nav.marketTracker, icon: LineChart },
      ],
    },
  ], [t]);

  return { roleLabels, navSections, t };
}

type SearchResult = {
  type: 'page' | 'data';
  label: string;
  sublabel?: string;
  href: string;
  icon?: LucideIcon;
  source?: DataSearchSource;
  badge?: string;
  amount?: number;
  date?: string;
};

type DataSearchSource =
  | 'business'
  | 'transaction'
  | 'account'
  | 'contact'
  | 'invoice'
  | 'budget'
  | 'recurring'
  | 'template'
  | 'import_batch'
  | 'knowledge';

type ApiSearchResult = {
  id: string;
  source: DataSearchSource;
  title: string;
  subtitle?: string;
  href: string;
  badge?: string;
  amount?: number;
  date?: string;
};

const DATA_SOURCE_LABELS: Record<DataSearchSource, string> = {
  business: 'Business',
  transaction: 'Transaction',
  account: 'Account',
  contact: 'Contact',
  invoice: 'Invoice',
  budget: 'Budget',
  recurring: 'Recurring',
  template: 'Template',
  import_batch: 'Import',
  knowledge: 'Knowledge',
};

const DATA_SOURCE_ICONS: Record<DataSearchSource, LucideIcon> = {
  business: Building2,
  transaction: CreditCard,
  account: BookOpen,
  contact: UserPlus,
  invoice: FileText,
  budget: Target,
  recurring: RefreshCw,
  template: ClipboardCheck,
  import_batch: Upload,
  knowledge: BookOpen,
};

function getSearchTokens(query: string): string[] {
  return query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function matchesSearchTokens(text: string, query: string): boolean {
  const tokens = getSearchTokens(query);
  if (tokens.length === 0) return true;
  const normalized = text.toLowerCase();
  return tokens.every((token) => normalized.includes(token));
}

function formatSearchAmount(amount?: number): string | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  return amount.toLocaleString('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  });
}

function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { activeBusinessId, activeBusiness, userRole } = useBusinessContext();
  const { navSections, t } = useNavData();
  const [query, setQuery] = useState('');
  const [dataResults, setDataResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canManage = isManagerRole(userRole);

  const searchablePages = useMemo(() => {
    const pages: NavItem[] = [
      { href: '/dashboard', label: t.nav.dashboard, icon: PieChart},
      { href: '/leads', label: 'Leads', icon: MessagesSquare },
      { href: '/businesses', label: t.nav.manageBusiness, icon: Building2 },
      ...navSections.flatMap((s) => s.items),
      { href: '/settings', label: t.nav.settings, icon: Settings },
    ];

    if (canManage) {
      // /invoices & /reconciliation sudah ada via navSections — jangan di-splice lagi
      // (mencegah duplikat key di SearchDialog).
      pages.splice(2, 0,
        getPosNavItem(activeBusiness?.business_type, t.nav),
        { href: '/agent', label: 'Agentic Workspace', icon: Bot },
        { href: '/transactions', label: t.nav.transactions, icon: CreditCard },
        { href: '/transactions/journal-entry', label: t.nav.journalEntry, icon: Plus }
      );
    }

    return pages;
  }, [canManage, navSections, t, activeBusiness?.business_type]);

  const filteredPages = useMemo(
    () =>
      query.trim() === ''
        ? searchablePages.map((item) => ({ type: 'page' as const, label: item.label, href: item.href, icon: item.icon }))
        : searchablePages
            .filter((item) => matchesSearchTokens(`${item.label} ${item.href}`, query))
            .map((item) => ({ type: 'page' as const, label: item.label, href: item.href, icon: item.icon })),
    [query, searchablePages]
  );

  // Search business data with debounce. API uses the current user session and Supabase RLS.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2 || !activeBusinessId) {
      setDataResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: trimmedQuery,
          businessId: activeBusinessId,
          limit: '24',
        });
        const response = await fetch(`/api/search?${params.toString()}`);
        if (!response.ok) throw new Error('Search request failed');

        const payload = (await response.json()) as { data?: ApiSearchResult[] };
        if (cancelled) return;

        setDataResults(
          (payload.data ?? []).map((item) => ({
            type: 'data' as const,
            label: item.title,
            sublabel: item.subtitle,
            href: item.href,
            source: item.source,
            badge: item.badge,
            amount: item.amount,
            date: item.date,
            icon: DATA_SOURCE_ICONS[item.source],
          }))
        );
      } catch {
        if (!cancelled) setDataResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, activeBusinessId]);

  const allResults: SearchResult[] = useMemo(() => {
    if (!query.trim()) return filteredPages;
    return [...filteredPages, ...dataResults];
  }, [query, filteredPages, dataResults]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      const raf = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setIsVisible(false);
    const timeout = setTimeout(() => setShouldRender(false), 200);
    return () => clearTimeout(timeout);
  }, [open]);

  // Reset state saat dialog dibuka
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setDataResults([]);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Reset selected index saat results berubah
  useEffect(() => {
    setSelectedIndex(0);
  }, [allResults.length]);

  const navigate = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % (allResults.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + (allResults.length || 1)) % (allResults.length || 1));
      } else if (e.key === 'Enter' && allResults.length > 0) {
        e.preventDefault();
        const selected = allResults[Math.min(selectedIndex, allResults.length - 1)];
        navigate(selected.href);
      }
    },
    [allResults, selectedIndex, navigate]
  );

  if (!shouldRender) return null;

  const hasPages = filteredPages.length > 0;
  const hasData = dataResults.length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className={`fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`} />
      <div
        className={`relative w-full max-w-xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-200 ease-out ${isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-200 dark:border-gray-700">
          <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.nav.searchPlaceholder}
            className="flex-1 bg-transparent text-base text-gray-800 dark:text-gray-200 placeholder-gray-400 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {allResults.length === 0 && !searching ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">{t.nav.notFound}</p>
          ) : (
            <>
              {/* Pages section */}
              {hasPages && (
                <div>
                  {query.trim() && <p className="px-5 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.nav.pages}</p>}
                  {filteredPages.map((item, i) => {
                    const Icon = item.icon!;
                    return (
                      <button
                        key={item.href}
                        onClick={() => navigate(item.href)}
                        onMouseEnter={() => setSelectedIndex(i)}
                        className={`flex items-center gap-3 w-full px-5 py-2.5 text-sm transition-colors ${
                          i === selectedIndex
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span>{item.label}</span>
                        <span className="ml-auto text-xs text-gray-400">{item.href}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Transactions section */}
              {hasData && (
                <div>
                  {hasPages && <div className="border-t border-gray-100 dark:border-gray-700 my-1" />}
                  <p className="px-5 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.nav.data}</p>
                  {dataResults.map((item, rawIdx) => {
                    const globalIdx = filteredPages.length + rawIdx;
                    const Icon = item.icon ?? Search;
                    const amount = formatSearchAmount(item.amount);
                    return (
                      <button
                        key={item.href + rawIdx}
                        onClick={() => navigate(item.href)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={`flex items-center gap-3 w-full px-5 py-2.5 text-sm transition-colors ${
                          globalIdx === selectedIndex
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="flex flex-col items-start min-w-0 flex-1">
                          <span className="truncate w-full text-left">
                            {item.label}
                          </span>
                          {item.sublabel && (
                            <span className="text-xs text-gray-400 truncate w-full text-left">{item.sublabel}</span>
                          )}
                        </div>
                        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                          {amount && <span className="hidden sm:inline text-xs text-gray-400">{amount}</span>}
                          {item.badge && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${CATEGORY_BADGE_CLASSES[item.badge] || 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                              {item.badge}
                            </span>
                          )}
                          {item.source && (
                            <span className="hidden sm:inline text-xs text-gray-400">
                              {DATA_SOURCE_LABELS[item.source]}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Loading indicator */}
              {searching && (
                <div className="px-5 py-3 flex items-center gap-2 text-xs text-gray-400">
                  <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  {t.nav.searchingData}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ onMenuClick, onQuickAddClick, isCollapsed }: { onMenuClick: () => void; onQuickAddClick: () => void; isCollapsed: boolean }) {
  const router = useRouter();
  const { user, businesses, activeBusiness, activeBusinessId, setActiveBusiness, userRole, displayRole, leadCounts } = useBusinessContext();
  const { roleLabels, t } = useNavData();
  const { locale, setLocale } = useLanguage();
  const supabase = createClient();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const labelRole = displayRole || userRole;
  const canManage = isManagerRole(userRole);

  const businessIds = businesses.map((b) => b.id);
  const { pendingCount, refresh: refreshNotifications } = useNotifications(businessIds, canManage, user?.id);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 h-[calc(4rem+var(--safe-area-top))] pt-[var(--safe-area-top)] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-30 flex items-center justify-between px-4 md:px-6 transition-[left] duration-300 ease-in-out ${isCollapsed ? 'md:left-16' : 'md:left-56'}`}>
      {/* Mobile Menu Button */}
      <button
        onClick={onMenuClick}
        aria-label="Buka menu"
        className="md:hidden min-w-[44px] min-h-[44px] -ml-2 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-400"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Business Switcher */}
      <BusinessSwitcher />

      {/* Right Side Actions */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Search */}
        <button
          onClick={() => setIsSearchOpen(true)}
          className="hidden md:flex items-center gap-2 px-4 py-1.5 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/60 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors border border-gray-300 dark:border-gray-600 min-w-[220px]"
        >
          <Search className="w-4 h-4" />
          <span>{t.nav.searchPlaceholder}</span>
          <kbd className="ml-auto px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-500">
            ⌘K
          </kbd>
        </button>

        {/* Real-time Date Widget */}
        {currentTime && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-200">
            <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
            <span>
              {currentTime.toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        )}

        {/* Quick Entry Button */}
        {canManage && activeBusiness && (
          <button
            onClick={onQuickAddClick}
            className="hidden md:flex btn-outline items-center gap-2 text-gray-500 dark:text-gray-400 border-[1.5px] border-primary-300 dark:border-primary-800 hover:border-primary-500 dark:hover:border-primary-400 hover:text-primary-500 dark:hover:text-primary-400 hover:shadow-md hover:shadow-primary-500/20 dark:hover:shadow-primary-500/15"
          >
            <Zap className="h-4 w-4 text-primary-500 dark:text-primary-400" />
            {t.nav.quickEntry}
          </button>
        )}

        {/* Notification Bell — hanya untuk manager/superadmin */}
        {canManage && (
          <NotificationBell
            count={pendingCount}
            leadCountsByBusiness={leadCounts.byBusiness}
            businesses={businesses}
            activeBusinessId={activeBusinessId}
            onSwitchBusiness={setActiveBusiness}
            href="/businesses"
            userId={user?.id || ''}
            onChange={refreshNotifications}
          />
        )}

        {/* Profile Dropdown */}
        <div className="relative" ref={profileDropdownRef}>
          <button
            onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
            className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          >
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm overflow-hidden">
              {user?.user_metadata?.avatar_url ? (
                <Image
                  src={user.user_metadata.avatar_url}
                  alt={userName}
                  width={36}
                  height={36}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{userName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{userName}</p>
              {labelRole && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  labelRole === 'superadmin'
                    ? 'bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 ring-1 ring-inset ring-gray-500/20'
                    : labelRole === 'investor'
                    ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 ring-1 ring-sky-500/20'
                    : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 ring-1 ring-indigo-500/20'
                }`}>
                  {roleLabels[labelRole]}
                </span>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isProfileDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsProfileDropdownOpen(false)} />
              <div className="absolute top-full right-0 mt-2 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden py-1">
                <Link
                  href="/settings"
                  onClick={() => setIsProfileDropdownOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  {t.nav.settings}
                </Link>
                <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                {/* Theme Toggle */}
                <div className="px-4 py-2 flex items-center justify-between">
                  <ThemeToggle inDropdown />
                </div>
                {/* Language Toggle */}
                <div className="px-4 py-2 flex items-center justify-between">
                  <Languages className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <SegmentedToggle
                    value={locale}
                    onChange={(v) => setLocale(v as 'id' | 'en')}
                    options={[
                      { value: 'id', label: 'ID' },
                      { value: 'en', label: 'EN' },
                    ]}
                    ariaLabel="Language"
                  />
                </div>
                <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  {t.nav.logout}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>

    {/* Search Dialog */}
    <SearchDialog open={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}

function Sidebar({
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapse,
  userRole,
  userId,
}: {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  userRole: string | null;
  userId: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { navSections, t } = useNavData();
  const { activeBusiness, activeBusinessId, leadCounts } = useBusinessContext();
  const canManage = isManagerRole(userRole);

  // Badge unread lead untuk bisnis yang sedang aktif (sidebar scoped ke 1 bisnis).
  const activeLeadCount = activeBusinessId ? leadCounts.byBusiness[activeBusinessId] ?? 0 : 0;

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [hiddenNavItems, setHiddenNavItems] = useState<string[]>(SIDEBAR_DEFAULT_HIDDEN);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar_sections_expanded');
      if (saved) setExpandedSections(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    supabase
      .from('profiles')
      .select('hidden_nav_items')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data) setHiddenNavItems(data.hidden_nav_items ?? SIDEBAR_DEFAULT_HIDDEN);
      });
  }, [userId]);

  // Saat ganti bisnis sambil berada di hub (Calendar/Point of Sales), route bisa
  // jadi tak cocok dengan tipe bisnis baru (mis. tetap di /calendar padahal bisnis
  // produk → harusnya /point-of-sales). Sidebar sudah swap href-nya, tapi halaman
  // tak ikut pindah. Redirect ke route hub yang benar agar tab/variant ikut ganti.
  useEffect(() => {
    if (!activeBusiness) return;
    const correctHubHref = getPosNavItem(activeBusiness.business_type, t.nav).href;
    const wrongHubHref = correctHubHref === '/calendar' ? '/point-of-sales' : '/calendar';
    if (pathname === wrongHubHref || pathname.startsWith(wrongHubHref + '/')) {
      router.replace(correctHubHref);
    }
  }, [activeBusiness, pathname, router, t.nav]);

  const isSectionExpanded = (label: string) => expandedSections[label] ?? true;

  const toggleSection = (label: string) => {
    const next = { ...expandedSections, [label]: !isSectionExpanded(label) };
    setExpandedSections(next);
    localStorage.setItem('sidebar_sections_expanded', JSON.stringify(next));
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-screen-dvh pt-[var(--safe-area-top)] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-[inset_-4px_0_12px_rgba(0,0,0,0.04)] dark:shadow-[inset_-4px_0_12px_rgba(0,0,0,0.2)] flex flex-col z-50 transform transition-all duration-300 ease-in-out ${isCollapsed ? 'overflow-visible' : 'overflow-hidden'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
          ${isCollapsed ? 'w-16' : 'w-56'}`}
      >
        {/* Logo + Hamburger row */}
        <div className={`flex items-center border-b border-transparent h-16 flex-shrink-0 ${isCollapsed ? 'justify-center px-2' : 'gap-2 px-3'}`}>
          {isCollapsed ? (
            /* Favicon sebagai tombol expand */
            <button
              onClick={onToggleCollapse}
              className="hidden md:flex p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Expand sidebar"
            >
              <Image src="/images/favicon.png" alt="Expand sidebar" width={28} height={28} className="object-contain dark:hidden" />
              <Image src="/images/favicon-dark.png" alt="Expand sidebar" width={28} height={28} className="object-contain hidden dark:block" />
            </button>
          ) : (
            <>
              {/* Panel toggle — desktop only */}
              <button
                onClick={onToggleCollapse}
                className="hidden md:flex p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
                title="Collapse sidebar"
              >
                <PanelLeft className="w-5 h-5" />
              </button>

              {/* Logo — fade out saat collapsed */}
              <div className="flex items-center overflow-hidden">
                <Image
                  src="/images/axion.png"
                  alt="Axion Logo"
                  width={100}
                  height={32}
                  className="object-contain dark:hidden"
                />
                <Image
                  src="/images/axion-dark.png"
                  alt="Axion Logo"
                  width={100}
                  height={32}
                  className="object-contain hidden dark:block"
                />
              </div>
            </>
          )}

          {/* Mobile close button */}
          <button
            onClick={onClose}
            aria-label="Tutup menu"
            className="ml-auto min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable nav area */}
        <div className={`flex-1 min-h-0 ${isCollapsed ? 'overflow-visible' : 'overflow-y-auto'}`}>
        {/* Independent nav items: Transactions + Dashboard + Manage Business */}
        <div className="px-2 pt-3 pb-3 space-y-0.5">
          {/* Transactions (manager only) */}
          {canManage && (() => {
            const isTransactionsActive = pathname === '/transactions' || pathname.startsWith('/transactions/') || pathname === '/invoices' || pathname === '/reconciliation';
            return (
              <div className="relative group">
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                    ${isTransactionsActive
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                >
                  <Link
                    href="/transactions/journal-entry"
                    onClick={onClose}
                    className="flex-shrink-0 p-0.5 rounded-md border border-indigo-400 dark:border-indigo-500 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-800/40 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                    title={t.nav.journalEntry}
                  >
                    <Plus className="w-5 h-5" />
                  </Link>
                  <Link
                    href="/transactions"
                    onClick={onClose}
                    className={`whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out hover:text-indigo-500 dark:hover:text-indigo-400 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}
                  >
                    {t.nav.transactions}
                  </Link>
                </div>
                {isCollapsed && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-gray-800 dark:bg-gray-700 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-[60] overflow-hidden">
                    <Link href="/transactions/journal-entry" onClick={onClose} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                      {t.nav.journalEntry}
                    </Link>
                    <Link href="/transactions" onClick={onClose} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors">
                      <CreditCard className="w-3.5 h-3.5" />
                      {t.nav.viewTransactions}
                    </Link>
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-800 dark:border-r-gray-700" />
                  </div>
                )}
              </div>
            );
          })()}

          {/* Dashboard & Manage Business & Agent — independent */}
          {[
            { href: '/dashboard', label: t.nav.dashboard, icon: PieChart },
            { href: '/leads', label: 'Leads', icon: MessagesSquare },
            { href: '/businesses', label: t.nav.manageBusiness, icon: Building2 },
            ...(canManage ? [getPosNavItem(activeBusiness?.business_type, t.nav)] : []),
            ...(canManage ? [{ href: '/agent', label: 'Agentic Workspace', icon: Bot }] : []),
          ].filter(item => !hiddenNavItems.includes(item.href)).map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const badge = item.href === '/leads' ? activeLeadCount : 0;
            // Klik badge Leads (ada unread) → buka lead unread terlama otomatis.
            const href =
              item.href === '/leads' && badge > 0 ? '/leads?openUnread=1' : item.href;
            return (
              <div key={item.href} className="relative group">
                <Link
                  href={href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                    ${isActive
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-indigo-500 dark:hover:text-indigo-400'
                    }`}
                >
                  <span className="relative flex-shrink-0">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`} />
                    {/* Saat collapsed label tersembunyi — pakai dot kecil di ikon sbg indikator unread. */}
                    {badge > 0 && isCollapsed && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full ring-2 ring-white dark:ring-gray-800" />
                    )}
                  </span>
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                    {item.label}
                  </span>
                  {badge > 0 && !isCollapsed && (
                    <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold rounded-full px-1.5 leading-none">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </Link>
                {isCollapsed && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-gray-800 dark:bg-gray-700 text-white text-xs font-medium rounded-lg px-3 py-2 whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-[60]">
                    {item.label}
                    {badge > 0 && ` (${badge > 99 ? '99+' : badge})`}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-800 dark:border-r-gray-700" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mx-4 border-t border-gray-200 dark:border-gray-700" />

        {/* Navigation */}
        <nav className="py-4 px-2">
          {navSections.map((section, sectionIndex) => {
            const expanded = isSectionExpanded(section.label);
            return (
              <div key={section.label} className={sectionIndex > 0 ? 'mt-5' : ''}>
                {/* Divider antar section — collapsed dan expanded */}
                {sectionIndex > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 mb-4 mx-1" />
                )}
                {/* Section header with icon — fade to icon-only saat collapsed */}
                {(() => {
                  const SectionIcon = section.icon;
                  const hasActiveChild = section.items.some(item => pathname === item.href || pathname.startsWith(item.href + '/'));
                  return (
                    <div className="relative group/section">
                      <button
                        onClick={() => isCollapsed ? router.push(section.items[0].href) : toggleSection(section.label)}
                        className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl transition-colors ${
                          isCollapsed
                            ? hasActiveChild
                              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400'
                              : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300'
                            : ''
                        }`}
                      >
                        <SectionIcon className={`w-5 h-5 flex-shrink-0 transition-colors ${
                          hasActiveChild
                            ? 'text-indigo-500 dark:text-indigo-400'
                            : 'text-gray-400 dark:text-gray-500'
                        }`} />
                        {/* Label + chevron — hidden saat collapsed */}
                        <span className={`flex items-center justify-between flex-1 overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                          <span className={`text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${hasActiveChild ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`}>
                            {section.label}
                          </span>
                          <ChevronDown className={`w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
                        </span>
                      </button>
                      {/* Flyout menu saat collapsed — clickable */}
                      {isCollapsed && (
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-gray-800 dark:bg-gray-700 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 invisible group-hover/section:opacity-100 group-hover/section:visible transition-all duration-150 z-[60] overflow-hidden">
                          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 border-b border-gray-700 dark:border-gray-600">
                            {section.label}
                          </div>
                          {section.items.filter(item => !hiddenNavItems.includes(item.href)).map((item) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={onClose}
                              className={`flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors ${
                                pathname === item.href || pathname.startsWith(item.href + '/')
                                  ? 'text-indigo-400 font-semibold'
                                  : 'text-gray-100'
                              }`}
                            >
                              {item.label}
                            </Link>
                          ))}
                          <div className="absolute right-full top-5 border-4 border-transparent border-r-gray-800 dark:border-r-gray-700" />
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div className={`space-y-0.5 transition-all duration-200 ease-in-out ${!isCollapsed && !expanded ? 'max-h-0 overflow-hidden' : isCollapsed ? 'hidden' : 'max-h-96'}`}>
                  {section.items.filter(item => !hiddenNavItems.includes(item.href)).map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={`flex items-center pl-10 pr-3 py-2 rounded-xl text-sm font-medium transition-colors
                          ${isActive
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-indigo-500 dark:hover:text-indigo-400'
                          }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        </div>

        {/* Footer */}
        <div className="pt-4 pb-[calc(1rem+var(--safe-area-bottom))] px-4 border-t border-gray-200 dark:border-gray-700">
          <p className={`text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
            Engine by Imam Abdurasyid
          </p>
        </div>
      </aside>
    </>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { userRole, user, activeBusinessId, activeBusiness } = useBusinessContext();
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Swipe to open/close sidebar on mobile
  useEffect(() => {
    const SWIPE_THRESHOLD = 50;
    const EDGE_ZONE = 30; // px from left edge to start swipe-open

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const deltaY = e.changedTouches[0].clientY - touchStartY.current;

      // Only trigger if horizontal swipe is dominant
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
        if (deltaX > 0 && touchStartX.current < EDGE_ZONE && !sidebarOpen) {
          // Swipe right from left edge → open
          setSidebarOpen(true);
        } else if (deltaX < 0 && sidebarOpen) {
          // Swipe left while open → close
          setSidebarOpen(false);
        }
      }

      touchStartX.current = null;
      touchStartY.current = null;
    };

    // Only add on mobile
    const mql = window.matchMedia('(max-width: 767px)');
    if (mql.matches) {
      document.addEventListener('touchstart', handleTouchStart, { passive: true });
      document.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });
      } else {
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchend', handleTouchEnd);
      }
    };

    mql.addEventListener('change', handleChange);
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      mql.removeEventListener('change', handleChange);
    };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-gray-900">
      {/* Fixed Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        userRole={userRole}
        userId={user?.id ?? null}
      />

      {/* Fixed Header */}
      <Header
        onMenuClick={() => setSidebarOpen(true)}
        onQuickAddClick={() => setQuickAddOpen(true)}
        isCollapsed={sidebarCollapsed}
      />

      {/* Main Content - with margins for sidebar and header */}
      <main className={`ml-0 pt-[calc(4rem+var(--safe-area-top))] min-h-screen overflow-auto transition-[margin] duration-300 ease-in-out ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-56'}`}>
        {/*
          Page transition: enter-only animation, NO AnimatePresence, NO exit prop.
          Key={pathname} memaksa re-mount tiap navigasi — animasi enter selalu fresh dari opacity:0 → 1.
          Tanpa AnimatePresence/exit, mustahil stuck di opacity 0 saat back-navigation cepat (bug commit b3db480).
        */}
        <motion.div
          key={pathname}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </main>

      {/* Global Floating Quick Add Button with shared state */}
      <FloatingQuickAdd isOpen={quickAddOpen} onOpenChange={setQuickAddOpen} />

      {/* Global AI Chat FAB */}
      {activeBusinessId && (
        <AIChatFAB
          businessId={activeBusinessId}
          businessName={activeBusiness?.business_name ?? ''}
          onQuickAdd={() => setQuickAddOpen(true)}
        />
      )}
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BusinessProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </BusinessProvider>
  );
}
