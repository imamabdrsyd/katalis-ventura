'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBusinessContext } from '@/context/BusinessContext';
import { BusinessForm, type BusinessFormData } from './BusinessForm';
import * as businessesApi from '@/lib/api/businesses';

export function BusinessSwitcher() {
  const { user, businesses, activeBusiness, setActiveBusiness, userRole } = useBusinessContext();
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
      await businessesApi.createBusiness(
        {
          business_name: formData.business_name,
          business_type: formData.business_type,
          capital_investment: formData.capital_investment,
          property_address: formData.property_address,
        },
        user?.id!
      );
      setShowAddForm(false);
      setIsOpen(false);
      // Refresh page to load new business
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
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors w-full"
      >
        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center text-white text-sm">
          {activeBusiness.business_name.charAt(0).toUpperCase()}
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
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="max-h-64 overflow-y-auto py-1">
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
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium ${
                    business.id === activeBusiness.id
                      ? 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {business.business_name.charAt(0).toUpperCase()}
                </div>
                <span
                  className={`text-sm flex-1 truncate ${
                    business.id === activeBusiness.id
                      ? 'font-semibold text-indigo-700'
                      : 'text-gray-700'
                  }`}
                >
                  {business.business_name}
                </span>
                {business.id === activeBusiness.id && (
                  <svg
                    className="w-4 h-4 text-indigo-600 flex-shrink-0"
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
          <div className="border-t border-gray-100">
            <button
              onClick={() => {
                if (isInvestor) {
                  setIsOpen(false);
                  router.push('/join-business');
                } else {
                  setShowAddForm(true);
                }
              }}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-left text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={isInvestor ? "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" : "M12 6v6m0 0v6m0-6h6m-6 0H6"}
                />
              </svg>
              <span className="text-sm font-medium">{isInvestor ? 'Gabung Bisnis' : 'Kelola Bisnis'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Add Business Modal */}
      {showAddForm && !isInvestor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lg max-w-md w-full">
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
