'use client';

import { useState, useEffect } from 'react';
import { MapPin, Building2, Palette, Heart, Wheat, UtensilsCrossed, PackageOpen, Home, UserPlus, Coins } from 'lucide-react';
import type { Business } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface BusinessCardProps {
  business: Business;
  isActive?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onInvite?: () => void;
  showActions?: boolean;
}

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  agribusiness: 'Agribusiness',
  personal_care: 'Personal Care',
  accommodation: 'Accommodation',
  creative_agency: 'Creative Agency',
  food_and_beverage: 'F&B',
  finance: 'Finance',
  // Legacy types for backward compatibility
  short_term_rental: 'Short-term Rental',
  property_management: 'Property Management',
  real_estate: 'Real Estate',
};

const BUSINESS_TYPE_ICONS: Record<string, React.ReactNode> = {
  agribusiness: <Wheat className="w-6 h-6" />,
  personal_care: <Heart className="w-6 h-6" />,
  accommodation: <Building2 className="w-6 h-6" />,
  creative_agency: <Palette className="w-6 h-6" />,
  food_and_beverage: <UtensilsCrossed className="w-6 h-6" />,
  finance: <Coins className="w-6 h-6" />,
  short_term_rental: <Home className="w-6 h-6" />,
  property_management: <Building2 className="w-6 h-6" />,
  real_estate: <Building2 className="w-6 h-6" />,
};

export function BusinessCard({
  business,
  isActive = false,
  onSelect,
  onEdit,
  onArchive,
  onRestore,
  onInvite,
  showActions = true,
}: BusinessCardProps) {
  const [creatorName, setCreatorName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCreatorInfo = async () => {
      if (!business.created_by) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/users/profile?userId=${business.created_by}`
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch');
        }

        const data = await response.json();
        setCreatorName(data.full_name || 'Unknown');
      } catch (err) {
        console.error('Failed to fetch creator info:', err);
        setCreatorName('Unknown');
      } finally {
        setLoading(false);
      }
    };

    fetchCreatorInfo();
  }, [business.created_by]);
  return (
    <div
      className={`card cursor-pointer transition-all ${
        isActive
          ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
          : 'hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600'
      } ${business.is_archived ? 'opacity-60' : ''}`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              business.is_archived
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                : 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white'
            }`}
          >
            {business.is_archived ? <PackageOpen className="w-6 h-6" /> : BUSINESS_TYPE_ICONS[business.business_type] || <Building2 className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-gray-100">{business.business_name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {BUSINESS_TYPE_LABELS[business.business_type] || business.business_type}
            </p>
          </div>
        </div>
        {/* Invite Button Icon */}
        {onInvite && !business.is_archived && showActions && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onInvite();
            }}
            className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
            title="Kelola Undangan"
          >
            <UserPlus className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Modal Investasi</span>
          <span className="font-semibold text-gray-800 dark:text-gray-100">
            {formatCurrency(business.capital_investment)}
          </span>
        </div>
        {business.property_address && (
          <div className="text-sm text-gray-500 dark:text-gray-400 flex items-start gap-2">
            <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
            <span>{business.property_address}</span>
          </div>
        )}
      </div>

      {showActions && (
        <div className="flex gap-2 mt-4">
          {onEdit && !business.is_archived && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Edit
            </button>
          )}
          {onArchive && !business.is_archived && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onArchive();
              }}
              className="flex-1 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
            >
              Archive
            </button>
          )}
          {onRestore && business.is_archived && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRestore();
              }}
              className="flex-1 px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
            >
              Restore
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-sm mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <div className="text-gray-500 dark:text-gray-400">
          <span className="text-xs">Created by: </span>
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {loading ? 'Loading...' : creatorName}
          </span>
        </div>
        {isActive && !business.is_archived && (
          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Active</span>
        )}
        {business.is_archived && (
          <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-semibold rounded-lg">
            Archived
          </span>
        )}
      </div>
    </div>
  );
}
