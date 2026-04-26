'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBusinessContext } from '@/context/BusinessContext';
import { BusinessForm, type BusinessFormData } from './BusinessForm';
import * as businessesApi from '@/lib/api/businesses';
import Image from 'next/image';
import { Building2, Palette, Heart, Wheat, UtensilsCrossed, Home, Plus, UserPlus } from 'lucide-react';

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
  const { user, businesses, activeBusiness, setActiveBusiness, userRole, refetch } = useBusinessContext();
  const isInvestor = userRole === 'investor';
  const [isOpen, setIsOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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
    setIsSubmitting(true);
    try {
      const { _logoFile, ...businessData } = formData;
      const newBusiness = await businessesApi.createBusiness(
        {
          business_name: businessData.business_name,
          business_sector: businessData.business_sector,
          property_address: businessData.property_address,
        },
        user?.id!
      );

      // Upload logo if a file was selected
      if (_logoFile) {
        const uploadData = new FormData();
        uploadData.append('file', _logoFile);
        await fetch(`/api/businesses/${newBusiness.id}/logo`, {
          method: 'POST',
          body: uploadData,
        });
      }

      setShowAddForm(false);
      setIsOpen(false);
      await refetch();
      router.refresh();
    } catch (error) {
      console.error('Failed to create business:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeBusiness) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full"
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden ${activeBusiness.logo_url ? 'bg-white' : 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white'}`}>
          {activeBusiness.logo_url ? (
            <Image src={activeBusiness.logo_url} alt={activeBusiness.business_name} width={32} height={32} className="w-full h-full object-cover" unoptimized />
          ) : (
            BUSINESS_TYPE_ICONS[activeBusiness.business_sector ?? ''] || <Building2 className="w-4 h-4" />
          )}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-semibold text-gray-800 truncate">
            {activeBusiness.business_name}
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="max-h-[60vh] overflow-y-auto py-1">
            {businesses.map((business) => (
              <button
                key={business.id}
                onClick={() => {
                  setActiveBusiness(business.id);
                  setIsOpen(false);
                }}
                className={`flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                  business.id === activeBusiness.id ? 'bg-indigo-50' : ''
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden ${
                    business.logo_url
                      ? 'bg-white'
                      : business.id === activeBusiness.id
                        ? 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {business.logo_url ? (
                    <Image src={business.logo_url} alt={business.business_name} width={32} height={32} className="w-full h-full object-cover" unoptimized />
                  ) : (
                    BUSINESS_TYPE_ICONS[business.business_sector ?? ''] || <Building2 className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={`text-sm flex-1 truncate ${
                    business.id === activeBusiness.id
                      ? 'font-semibold text-indigo-500'
                      : 'text-gray-700'
                  }`}
                >
                  {business.business_name}
                </span>
                {business.id === activeBusiness.id && (
                  <svg
                    className="w-4 h-4 text-indigo-500 flex-shrink-0"
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
          <div className="border-t border-gray-100 grid grid-cols-2 py-1.5">
            {!isInvestor && (
              <button
                onClick={() => {
                  setShowAddForm(true);
                  setIsOpen(false);
                }}
                className="relative group flex justify-center p-2 rounded-lg text-gray-500 hover:text-indigo-500 hover:bg-indigo-50 transition-colors mx-1"
              >
                <Plus className="w-5 h-5" />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-xs font-medium text-white bg-gray-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                  Buat Bisnis Baru
                </span>
              </button>
            )}
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/join-business');
              }}
              className="relative group flex justify-center p-2 rounded-lg text-gray-500 hover:text-purple-500 hover:bg-purple-50 transition-colors mx-1"
            >
              <UserPlus className="w-5 h-5" />
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-xs font-medium text-white bg-gray-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                Gabung Bisnis
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Add Business Modal */}
      {showAddForm && !isInvestor && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setShowAddForm(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <BusinessForm
              onSubmit={handleAddBusiness}
              onCancel={() => setShowAddForm(false)}
              loading={isSubmitting}
            />
          </div>
        </div>
      )}
    </div>
  );
}
