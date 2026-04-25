'use client';

import Image from 'next/image';
import { BusinessInitialsAvatar } from './BusinessInitialsAvatar';
import { PublicBusiness, formatCategory, formatSector } from './types';

interface Props {
  business: PublicBusiness;
  index: number;
  isSelected: boolean;
  onClick: () => void;
}

const CATEGORY_BADGE: Record<string, string> = {
  jasa: 'bg-violet-100 text-violet-800',
  produk: 'bg-teal-100 text-teal-800',
  dagang: 'bg-amber-100 text-amber-800',
};

export function OmnichannelBusinessCard({ business, index, isSelected, onClick }: Props) {
  const category = business.business_category ?? 'jasa';
  const badgeClass = CATEGORY_BADGE[category] ?? CATEGORY_BADGE.jasa;
  const sectorLabel = formatSector(business.business_type);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3.5 rounded-xl border transition-all ${
        isSelected
          ? 'border-violet-500 border-[1.5px] bg-white dark:bg-gray-900'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 bg-white dark:bg-gray-900'
      }`}
    >
      {business.logo_url ? (
        <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
          <Image
            src={business.logo_url}
            alt={business.business_name}
            width={36}
            height={36}
            className="w-full h-full object-cover"
            unoptimized
          />
        </div>
      ) : (
        <BusinessInitialsAvatar name={business.business_name} index={index} size="sm" />
      )}
      <p className="mt-2.5 text-sm font-medium text-gray-900 dark:text-white truncate">
        {business.business_name}
      </p>
      <div className="flex gap-1.5 mt-1.5 flex-wrap">
        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badgeClass}`}
        >
          {formatCategory(business.business_category)}
        </span>
        {sectorLabel && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {sectorLabel}
          </span>
        )}
      </div>
    </button>
  );
}
