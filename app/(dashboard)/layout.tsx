'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { BusinessProvider, useBusinessContext } from '@/context/BusinessContext';
import { BusinessForm, type BusinessFormData } from '@/components/business/BusinessForm';
import { createClient } from '@/lib/supabase';
import * as businessesApi from '@/lib/api/businesses';
import {
  LayoutDashboard,
  CreditCard,
  Building2,
  DollarSign,
  Scale,
  ArrowLeftRight,
  LogOut,
  Search,
  ChevronDown,
  LucideIcon,
  Wheat,
  Heart,
  Palette,
  UtensilsCrossed,
  Home,
  Menu,
  X,
  Settings,
  BookOpen,
  BookOpenCheck,
  ClipboardCheck,
  Zap,
  FlaskConical,
  Plus,
  UserPlus,
  FileText,
  BarChart3,
  Calculator,
  LineChart,
  Target,
  Calendar,
  HandCoins,
  ScanSearch,
  BookCheck,
} from 'lucide-react';

const BUSINESS_TYPE_ICONS: Record<string, React.ReactNode> = {
  agribusiness: <Wheat className="w-4 h-4" />,
  personal_care: <Heart className="w-4 h-4" />,
  accommodation: <Building2 className="w-4 h-4" />,
  creative_agency: <Palette className="w-4 h-4" />,
  food_and_beverage: <UtensilsCrossed className="w-4 h-4" />,
  short_term_rental: <Home className="w-4 h-4" />,
  property_management: <Building2 className="w-4 h-4" />,
  real_estate: <Building2 className="w-4 h-4" />,
};
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { FloatingQuickAdd } from '@/components/transactions/FloatingQuickAdd';

const ROLE_LABELS: Record<string, string> = {
  business_manager: 'Business Manager',
  investor: 'Investor',
  both: 'Manager & Investor',
  superadmin: 'Super Admin',
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavSection = {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    label: 'ACCOUNTING',
    icon: Calculator,
    items: [
      { href: '/accounts', label: 'Chart of Accounts', icon: BookOpen },
      { href: '/invoices', label: 'Invoice', icon: FileText },
      { href: '/general-ledger', label: 'General Ledger', icon: BookOpenCheck },
      { href: '/trial-balance', label: 'Trial Balance', icon: ClipboardCheck },
      { href: '/ar-ap', label: 'Piutang & Hutang', icon: HandCoins },
      { href: '/reconciliation', label: 'Rekonsiliasi Bank', icon: ScanSearch },
      { href: '/closing-entry', label: 'Tutup Buku', icon: BookCheck },
    ],
  },
  {
    label: 'FINANCIAL REPORTS',
    icon: BarChart3,
    items: [
      { href: '/income-statement', label: 'Profit & Loss', icon: DollarSign },
      { href: '/balance-sheet', label: 'Balance Sheet', icon: Scale },
      { href: '/cash-flow', label: 'Cash Flow', icon: ArrowLeftRight },
    ],
  },
  {
    label: 'ANALYTICS',
    icon: LineChart,
    items: [
      { href: '/scenario-modeling', label: 'Scenario Modeling', icon: FlaskConical },
      { href: '/roi-forecast', label: 'Budget & Forecast', icon: Target },
    ],
  },
];

// Semua item navigasi yang bisa dicari
const allNavItems: NavItem[] = [
  ...navSections.flatMap((s) => s.items),
  { href: '/transactions', label: 'Transactions', icon: CreditCard },
  { href: '/transactions/journal-entry', label: 'Journal Entry', icon: Plus },
  { href: '/settings', label: 'Settings', icon: Settings },
];

type SearchResult = {
  type: 'page' | 'transaction';
  label: string;
  sublabel?: string;
  href: string;
  icon?: LucideIcon;
  category?: string;
};

function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { activeBusinessId } = useBusinessContext();
  const [query, setQuery] = useState('');
  const [transactionResults, setTransactionResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredPages = useMemo(
    () =>
      query.trim() === ''
        ? allNavItems.map((item) => ({ type: 'page' as const, label: item.label, href: item.href, icon: item.icon }))
        : allNavItems
            .filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
            .map((item) => ({ type: 'page' as const, label: item.label, href: item.href, icon: item.icon })),
    [query]
  );

  // Search transactions with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim() || !activeBusinessId) {
      setTransactionResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const supabase = createClient();
        const q = query.toLowerCase();
        const { data } = await supabase
          .from('active_transactions')
          .select('id, name, description, category, amount, date')
          .eq('business_id', activeBusinessId)
          .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
          .order('date', { ascending: false })
          .limit(8);

        if (data) {
          setTransactionResults(
            data.map((t) => ({
              type: 'transaction' as const,
              label: t.name || t.description || '',
              sublabel: t.description && t.name ? t.description : undefined,
              href: `/transactions?highlight=${t.id}`,
              category: t.category,
            }))
          );
        }
      } catch {
        setTransactionResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, activeBusinessId]);

  const allResults: SearchResult[] = useMemo(() => {
    if (!query.trim()) return filteredPages;
    return [...filteredPages, ...transactionResults];
  }, [query, filteredPages, transactionResults]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset state saat dialog dibuka
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTransactionResults([]);
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
        navigate(allResults[selectedIndex].href);
      }
    },
    [allResults, selectedIndex, navigate]
  );

  if (!open) return null;

  const hasPages = filteredPages.length > 0;
  const hasTransactions = transactionResults.length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
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
            placeholder="Cari halaman atau transaksi..."
            className="flex-1 bg-transparent text-base text-gray-800 dark:text-gray-200 placeholder-gray-400 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {allResults.length === 0 && !searching ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">Tidak ditemukan</p>
          ) : (
            <>
              {/* Pages section */}
              {hasPages && (
                <div>
                  {query.trim() && <p className="px-5 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Halaman</p>}
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
              {hasTransactions && (
                <div>
                  {hasPages && <div className="border-t border-gray-100 dark:border-gray-700 my-1" />}
                  <p className="px-5 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Transaksi</p>
                  {transactionResults.map((item, rawIdx) => {
                    const globalIdx = filteredPages.length + rawIdx;
                    const CATEGORY_COLORS: Record<string, string> = {
                      EARN: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400',
                      OPEX: 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400',
                      VAR: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
                      CAPEX: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
                      TAX: 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400',
                      FIN: 'bg-pink-100 dark:bg-pink-900/50 text-pink-600 dark:text-pink-400',
                    };
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
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${CATEGORY_COLORS[item.category || ''] || 'bg-gray-100 text-gray-500'}`}>
                          {item.category}
                        </span>
                        <div className="flex flex-col items-start min-w-0 flex-1">
                          <span className="truncate w-full text-left">{item.label}</span>
                          {item.sublabel && (
                            <span className="text-xs text-gray-400 truncate w-full text-left">{item.sublabel}</span>
                          )}
                        </div>
                        <CreditCard className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Loading indicator */}
              {searching && (
                <div className="px-5 py-3 flex items-center gap-2 text-xs text-gray-400">
                  <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  Mencari transaksi...
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
  const { user, businesses, activeBusiness, setActiveBusiness, userRole } = useBusinessContext();
  const supabase = createClient();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [showAddBusiness, setShowAddBusiness] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const isInvestor = userRole === 'investor';
  const canManage = userRole === 'business_manager' || userRole === 'both' || userRole === 'superadmin';

  const handleAddBusiness = async (formData: BusinessFormData) => {
    setIsSubmitting(true);
    try {
      await businessesApi.createBusiness(
        {
          business_name: formData.business_name,
          business_type: formData.business_type,
          property_address: formData.property_address,
        },
        user?.id!
      );
      setShowAddBusiness(false);
      setIsDropdownOpen(false);
      router.refresh();
    } catch (error) {
      console.error('Failed to create business:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
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
      <header className={`fixed top-0 left-0 right-0 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-30 flex items-center justify-between px-4 md:px-6 transition-[left] duration-300 ease-in-out ${isCollapsed ? 'md:left-16' : 'md:left-56'}`}>
      {/* Mobile Menu Button — favicon icon */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <Image
          src="/images/favicon.png"
          alt="Menu"
          width={28}
          height={28}
          className="object-contain dark:hidden"
        />
        <Image
          src="/images/favicon-dark.png"
          alt="Menu"
          width={28}
          height={28}
          className="object-contain hidden dark:block"
        />
      </button>

      {/* Business Switcher */}
      <div className="relative" ref={dropdownRef}>
        {/* <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
          Business
        </div> */}
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-2 text-gray-800 dark:text-gray-200 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
        >
          <span className="font-semibold">{activeBusiness?.business_name || 'Select Business'}</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isDropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
            <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="max-h-64 overflow-y-auto py-1">
                {businesses.map((business) => (
                  <button
                    key={business.id}
                    onClick={() => {
                      setActiveBusiness(business.id);
                      setIsDropdownOpen(false);
                    }}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      business.id === activeBusiness?.id ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden ${
                        business.logo_url
                          ? 'bg-white'
                          : business.id === activeBusiness?.id
                            ? 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {business.logo_url ? (
                        <Image src={business.logo_url} alt={business.business_name} width={32} height={32} className="w-full h-full object-cover" unoptimized />
                      ) : (
                        BUSINESS_TYPE_ICONS[business.business_type] || <Building2 className="w-4 h-4" />
                      )}
                    </div>
                    <span
                      className={`text-sm flex-1 truncate ${
                        business.id === activeBusiness?.id
                          ? 'font-semibold text-indigo-500 dark:text-indigo-400'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {business.business_name}
                    </span>
                    {business.id === activeBusiness?.id && (
                      <svg className="w-4 h-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
              <div className="border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 py-1.5">
                {canManage && (
                  <button
                    onClick={() => {
                      setShowAddBusiness(true);
                      setIsDropdownOpen(false);
                    }}
                    className="relative group flex justify-center p-2 rounded-lg text-gray-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors mx-1"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-xs font-medium text-white bg-gray-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                      Buat Bisnis Baru
                    </span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    router.push('/join-business');
                  }}
                  className="relative group flex justify-center p-2 rounded-lg text-gray-500 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors mx-1"
                >
                  <UserPlus className="w-5 h-5" />
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-xs font-medium text-white bg-gray-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                    Gabung Bisnis
                  </span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Search */}
        <button
          onClick={() => setIsSearchOpen(true)}
          className="hidden md:flex items-center gap-2 px-4 py-1.5 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors border border-gray-200 dark:border-gray-600 min-w-[220px]"
        >
          <Search className="w-4 h-4" />
          <span>Cari halaman atau transaksi...</span>
          <kbd className="ml-auto px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-500">
            ⌘K
          </kbd>
        </button>

        {/* Real-time Date Widget */}
        {currentTime && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-200">
            <Calendar className="w-4 h-4 text-primary-500 flex-shrink-0" />
            <span>
              {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        )}

        {/* Quick Entry Button */}
        {canManage && activeBusiness && (
          <button
            onClick={onQuickAddClick}
            className="hidden md:flex px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors items-center gap-2 font-medium shadow-sm"
          >
            <Zap className="h-4 w-4" />
            Quick Entry
          </button>
        )}

        {/* Theme Toggle */}
        <ThemeToggle />

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
              {userRole && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  userRole === 'superadmin'
                    ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20'
                    : userRole === 'investor'
                    ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 ring-1 ring-sky-500/20'
                    : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 ring-1 ring-indigo-500/20'
                }`}>
                  {ROLE_LABELS[userRole]}
                </span>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isProfileDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsProfileDropdownOpen(false)} />
              <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden py-1">
                <Link
                  href="/settings"
                  onClick={() => setIsProfileDropdownOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </Link>
                <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>

    {/* Search Dialog */}
    <SearchDialog open={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

    {/* Add Business Modal */}
    {showAddBusiness && !isInvestor && (
      <div
        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
        onClick={() => setShowAddBusiness(false)}
      >
        <div
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <BusinessForm
            onSubmit={handleAddBusiness}
            onCancel={() => setShowAddBusiness(false)}
            loading={isSubmitting}
          />
        </div>
      </div>
    )}
    </>
  );
}

function Sidebar({
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapse,
  userRole,
}: {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  userRole: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const canManage = userRole === 'business_manager' || userRole === 'both' || userRole === 'superadmin';

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar_sections_expanded');
      if (saved) setExpandedSections(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

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
        className={`fixed top-0 left-0 h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col z-50 transform transition-all duration-300 ease-in-out ${isCollapsed ? 'overflow-visible' : 'overflow-hidden'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
          ${isCollapsed ? 'w-16' : 'w-56'}`}
      >
        {/* Logo + Hamburger row */}
        <div className={`flex items-center border-b border-gray-200 dark:border-gray-700 h-16 flex-shrink-0 ${isCollapsed ? 'justify-center px-2' : 'gap-2 px-3'}`}>
          {isCollapsed ? (
            /* Favicon sebagai tombol expand */
            <button
              onClick={onToggleCollapse}
              className="hidden md:flex p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Expand sidebar"
            >
              <Image
                src="/images/favicon.png"
                alt="Expand sidebar"
                width={28}
                height={28}
                className="object-contain dark:hidden"
              />
              <Image
                src="/images/favicon-dark.png"
                alt="Expand sidebar"
                width={28}
                height={28}
                className="object-contain hidden dark:block"
              />
            </button>
          ) : (
            <>
              {/* Hamburger collapse — desktop only */}
              <button
                onClick={onToggleCollapse}
                className="hidden md:flex p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
                title="Collapse sidebar"
              >
                <Menu className="w-5 h-5" />
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
            className="ml-auto p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable nav area */}
        <div className={`flex-1 min-h-0 ${isCollapsed ? 'overflow-visible' : 'overflow-y-auto'}`}>
        {/* Independent nav items: Transactions + Dashboard + Manage Business */}
        <div className="px-2 pt-3 pb-1 space-y-0.5">
          {/* Transactions (manager only) */}
          {canManage && (() => {
            const isTransactionsActive = pathname === '/transactions' || pathname.startsWith('/transactions/');
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
                    title="Journal Entry"
                  >
                    <Plus className="w-5 h-5" />
                  </Link>
                  <Link
                    href="/transactions"
                    onClick={onClose}
                    className={`whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out hover:text-indigo-500 dark:hover:text-indigo-400 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}
                  >
                    Transactions
                  </Link>
                </div>
                {isCollapsed && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-gray-800 dark:bg-gray-700 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-[60] overflow-hidden">
                    <Link href="/transactions/journal-entry" onClick={onClose} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                      Journal Entry
                    </Link>
                    <Link href="/transactions" onClick={onClose} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors">
                      <CreditCard className="w-3.5 h-3.5" />
                      View Transactions
                    </Link>
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-800 dark:border-r-gray-700" />
                  </div>
                )}
              </div>
            );
          })()}

          {/* Dashboard & Manage Business — independent */}
          {[
            { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/businesses', label: 'Manage Business', icon: Building2 },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <div key={item.href} className="relative group">
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                    ${isActive
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`} />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                    {item.label}
                  </span>
                </Link>
                {isCollapsed && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-gray-800 dark:bg-gray-700 text-white text-xs font-medium rounded-lg px-3 py-2 whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-[60]">
                    {item.label}
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
                          {section.items.map((item) => (
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
                  {section.items.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={`flex items-center pl-10 pr-3 py-2 rounded-xl text-sm font-medium transition-colors
                          ${isActive
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
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
        <div className="pt-4 pb-4 px-4 border-t border-gray-200 dark:border-gray-700">
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
  const { userRole } = useBusinessContext();
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Fixed Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        userRole={userRole}
      />

      {/* Fixed Header */}
      <Header
        onMenuClick={() => setSidebarOpen(true)}
        onQuickAddClick={() => setQuickAddOpen(true)}
        isCollapsed={sidebarCollapsed}
      />

      {/* Main Content - with margins for sidebar and header */}
      <main className={`ml-0 pt-16 min-h-screen overflow-auto transition-[margin] duration-300 ease-in-out ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-56'}`}>
        {children}
      </main>

      {/* Global Floating Quick Add Button with shared state */}
      <FloatingQuickAdd isOpen={quickAddOpen} onOpenChange={setQuickAddOpen} />
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
