'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronDown, ExternalLink, Link2 } from 'lucide-react';
import { CHANNEL_META } from '@/lib/omniChannelMeta';
import type { OmniChannelType } from '@/types';
import { BusinessInitialsAvatar } from './BusinessInitialsAvatar';
import { PublicBusiness, PublicLink, formatCategory, formatSector } from './types';

interface Props {
  business: PublicBusiness;
  index: number;
  businesses?: PublicBusiness[];
  onSelectBusiness?: (index: number) => void;
}

function ChannelIcon({ type }: { type: string }) {
  const meta = CHANNEL_META[type as OmniChannelType] ?? CHANNEL_META.custom;
  return (
    <div
      className={`w-9 h-9 rounded-lg flex items-center justify-center ${meta.bgColor} ${meta.textColor} flex-shrink-0`}
      // SVG dari CHANNEL_META adalah string statis dari source code, aman untuk innerHTML
      dangerouslySetInnerHTML={{
        __html: meta.iconSvg.replace('<svg ', '<svg class="w-5 h-5" '),
      }}
    />
  );
}

function LinkRow({ link }: { link: PublicLink }) {
  const meta = CHANNEL_META[link.channel_type as OmniChannelType] ?? CHANNEL_META.custom;
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
    >
      <ChannelIcon type={link.channel_type} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {link.label || meta.label}
        </p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
          {meta.label}
        </p>
      </div>
      <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition" />
    </a>
  );
}

export function OmnichannelLinkCards({ business, index, businesses = [], onSelectBusiness }: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const metaLine = [
    formatCategory(business.business_category),
    formatSector(business.business_type),
    business.city,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        {business.logo_url ? (
          <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0">
            <Image
              src={business.logo_url}
              alt={business.business_name}
              width={44}
              height={44}
              className="w-full h-full object-cover"
              unoptimized
            />
          </div>
        ) : (
          <BusinessInitialsAvatar name={business.business_name} index={index} />
        )}
        <div className="min-w-0 flex-1 relative" ref={dropdownRef}>
          {businesses.length > 1 && onSelectBusiness ? (
            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-1 text-sm font-medium text-gray-900 dark:text-white border-b-2 border-primary-500 pb-0.5 hover:text-primary-600 dark:hover:text-primary-400 transition-colors max-w-full"
            >
              <span className="truncate">{business.business_name}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>
          ) : (
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {business.business_name}
            </p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 truncate">
            {metaLine}
          </p>

          {/* Business switcher dropdown */}
          {dropdownOpen && businesses.length > 1 && (
            <div className="absolute left-0 top-full mt-2 z-50 w-56 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-md overflow-hidden">
              {businesses.map((biz, i) => (
                <button
                  key={biz.id}
                  type="button"
                  onClick={() => {
                    onSelectBusiness?.(i);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    i === index
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  {biz.business_name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <hr className="border-gray-100 dark:border-gray-800 mb-4" />

      <div className="flex items-center gap-2 mb-3">
        <Link2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Toko & Sosial Media
        </h3>
      </div>

      {business.links.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
          Belum ada link yang dipublikasikan.
        </p>
      ) : (
        <div className="space-y-2">
          {business.links.map((link) => (
            <LinkRow key={link.id} link={link} />
          ))}
        </div>
      )}
    </div>
  );
}
