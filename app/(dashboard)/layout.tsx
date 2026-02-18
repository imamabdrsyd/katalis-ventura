'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
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
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    label: 'OVERVIEW',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/businesses', label: 'Business', icon: Building2 },
    ],
  },
  {
    label: 'ACCOUNTING',
    items: [
      { href: '/transactions', label: 'Transactions', icon: CreditCard },
      { href: '/accounts', label: 'Chart of Accounts', icon: BookOpen },
      { href: '/general-ledger', label: 'General Ledger', icon: BookOpenCheck },
      { href: '/trial-balance', label: 'Trial Balance', icon: ClipboardCheck },
    ],
  },
  {
    label: 'FINANCIAL STATEMENTS',
    items: [
      { href: '/income-statement', label: 'Income Statement', icon: DollarSign },
      { href: '/balance-sheet', label: 'Balance Sheet', icon: Scale },
      { href: '/cash-flow', label: 'Cash Flow', icon: ArrowLeftRight },
    ],
  },
  {
    label: 'ANALYTICS',
    items: [
      { href: '/scenario-modeling', label: 'Scenario Modeling', icon: FlaskConical },
    ],
  },
];

function Header({ onMenuClick, onQuickAddClick }: { onMenuClick: () => void; onQuickAddClick: () => void }) {
  const router = useRouter();
  const { user, businesses, activeBusiness, setActiveBusiness, userRole } = useBusinessContext();
  const supabase = createClient();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [showAddBusiness, setShowAddBusiness] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const isInvestor = userRole === 'investor';
  const canManage = userRole === 'business_manager' || userRole === 'both';

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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <header className="fixed top-0 left-0 md:left-64 right-0 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-30 flex items-center justify-between px-4 md:px-6">
      {/* Mobile Menu Button */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Business Switcher */}
      <div className="relative" ref={dropdownRef}>
        {/* <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
          Business
        </div> */}
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-2 text-gray-800 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
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
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        business.id === activeBusiness?.id
                          ? 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {BUSINESS_TYPE_ICONS[business.business_type] || <Building2 className="w-4 h-4" />}
                    </div>
                    <span
                      className={`text-sm flex-1 truncate ${
                        business.id === activeBusiness?.id
                          ? 'font-semibold text-indigo-700 dark:text-indigo-400'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {business.business_name}
                    </span>
                    {business.id === activeBusiness?.id && (
                      <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
              <div className="border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => {
                    if (isInvestor) {
                      setIsDropdownOpen(false);
                      router.push('/join-business');
                    } else {
                      setShowAddBusiness(true);
                    }
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-left text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isInvestor ? "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" : "M12 6v6m0 0v6m0-6h6m-6 0H6"} />
                  </svg>
                  <span className="text-sm font-medium">{isInvestor ? 'Gabung Bisnis' : 'Kelola Bisnis'}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Search - hidden on mobile */}
        <button className="hidden md:block p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <Search className="w-5 h-5" />
        </button>

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
                  userRole === 'investor'
                    ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 ring-1 ring-sky-500/20'
                    : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/20'
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
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
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

function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside className={`fixed top-0 left-0 w-64 h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-5 flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 md:hidden"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
        <Image
          src="/images/KV.png"
          alt="Katalis Ventura Logo"
          width={40}
          height={40}
          className="rounded-xl"
        />
        <h1 className="text-base font-bold bg-gradient-to-r from-violet-600 via-blue-500 to-cyan-400 text-transparent bg-clip-text">KATALIS VENTURA</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto">
        {navSections.map((section, sectionIndex) => (
          <div key={section.label} className={sectionIndex > 0 ? 'mt-6' : ''}>
            <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-3 mb-2">
              {section.label}
            </div>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-400 dark:text-gray-500 text-left">Created by @imamabdrsyd</p>
      </div>
    </aside>
    </>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Fixed Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Fixed Header */}
      <Header
        onMenuClick={() => setSidebarOpen(true)}
        onQuickAddClick={() => setQuickAddOpen(true)}
      />

      {/* Main Content - with margins for sidebar and header */}
      <main className="ml-0 md:ml-64 pt-16 min-h-screen overflow-auto">
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
