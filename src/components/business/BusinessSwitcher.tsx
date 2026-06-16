'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Building2,
  ChevronDown,
  Heart,
  Home,
  Palette,
  Plus,
  UserPlus,
  UtensilsCrossed,
  Wheat,
} from 'lucide-react';
import { useBusinessContext } from '@/context/BusinessContext';
import { useLanguage } from '@/context/LanguageContext';
import { isManagerRole } from '@/lib/roles';
import * as businessesApi from '@/lib/api/businesses';
import { AnimatedDialog } from '@/components/ui/AnimatedDialog';
import { BusinessForm, type BusinessFormData } from './BusinessForm';

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

export function BusinessSwitcher() {
  const {
    user,
    businesses,
    activeBusiness,
    setActiveBusiness,
    userRole,
    refetch,
  } = useBusinessContext();
  const { t } = useLanguage();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showAddBusiness, setShowAddBusiness] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canManage = isManagerRole(userRole);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddBusiness = async (formData: BusinessFormData) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const { _logoFile, ...businessData } = formData;
      const newBusiness = await businessesApi.createBusiness(businessData, user.id);

      if (_logoFile) {
        const uploadData = new FormData();
        uploadData.append('file', _logoFile);
        await fetch(`/api/businesses/${newBusiness.id}/logo`, {
          method: 'POST',
          body: uploadData,
        });
      }

      setShowAddBusiness(false);
      setIsOpen(false);
      await refetch();
      router.refresh();
    } catch (error) {
      console.error('Failed to create business:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const businessTypeLabel = activeBusiness?.business_type === 'jasa'
    ? t.businessForm.categoryJasa
    : activeBusiness?.business_type === 'produk'
      ? t.businessForm.categoryProduk
      : activeBusiness?.business_type === 'dagang'
        ? t.businessForm.categoryDagang
        : null;

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen((open) => !open)}
          className="flex items-center gap-2 text-gray-800 dark:text-gray-200 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
        >
          <span className="font-semibold">
            {activeBusiness?.business_name || t.nav.selectBusiness}
          </span>
          {businessTypeLabel && (
            <span className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {businessTypeLabel}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-visible">
              <div className="max-h-64 overflow-y-auto py-1">
                {businesses.map((business) => (
                  <button
                    key={business.id}
                    onClick={() => {
                      setActiveBusiness(business.id);
                      setIsOpen(false);
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
                        <Image
                          src={business.logo_url}
                          alt={business.business_name}
                          width={32}
                          height={32}
                          className={`w-full h-full ${business.logo_fit === 'contain' ? 'object-contain p-0.5' : 'object-cover'}`}
                          unoptimized
                        />
                      ) : (
                        BUSINESS_TYPE_ICONS[business.business_sector ?? ''] || <Building2 className="w-4 h-4" />
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
                      <svg
                        className="w-4 h-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
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
                      setIsOpen(false);
                    }}
                    className="relative group flex justify-center p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors mx-1"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="absolute z-[60] bottom-full left-0 mb-2 px-2.5 py-1 text-xs font-medium text-white bg-gray-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                      {t.nav.createNewBusiness}
                    </span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    router.push('/join-business');
                  }}
                  className="relative group flex justify-center p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors mx-1"
                >
                  <UserPlus className="w-5 h-5" />
                  <span className="absolute z-[60] bottom-full right-0 mb-2 px-2.5 py-1 text-xs font-medium text-white bg-gray-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                    {t.nav.joinBusiness}
                  </span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <AnimatedDialog
        isOpen={showAddBusiness && canManage}
        onClose={() => setShowAddBusiness(false)}
      >
        <BusinessForm
          onSubmit={handleAddBusiness}
          onCancel={() => setShowAddBusiness(false)}
          loading={isSubmitting}
        />
      </AnimatedDialog>
    </>
  );
}
