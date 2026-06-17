'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { MapPin, PackageOpen, UserPlus, Lock, MoreVertical, Pencil, Archive, RotateCcw, Trash2 } from 'lucide-react';
import type { Business } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { getSectorIcon } from '@/lib/sectorIcons';

interface BusinessCardProps {
  business: Business;
  totalCapex: number; // NEW: Calculated business capital from MODEL layer
  /**
   * Nama creator yang sudah di-fetch parent (batch) untuk menghindari
   * N+1 ke /api/users/profile dari tiap card. Kalau undefined, card akan
   * fallback ke fetch sendiri (kompatibel dengan caller lama).
   */
  creatorName?: string;
  isActive?: boolean;
  onSelect?: () => void;
  onDoubleClick?: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onHardDelete?: () => void;
  onInvite?: () => void;
  onPeriodLock?: () => void;
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

export function BusinessCard({
  business,
  totalCapex,
  creatorName: creatorNameProp,
  isActive = false,
  onSelect,
  onDoubleClick,
  onEdit,
  onArchive,
  onRestore,
  onHardDelete,
  onInvite,
  onPeriodLock,
  showActions = true,
}: BusinessCardProps) {
  // Kalau parent sudah pass creatorName (batch-fetched), pakai itu — skip fetch.
  // Kalau tidak, fallback ke fetch per-card (untuk caller lama yang belum di-update).
  const useFallbackFetch = creatorNameProp === undefined;
  const [fallbackName, setFallbackName] = useState<string>('');
  const [loading, setLoading] = useState(useFallbackFetch);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const creatorName = useFallbackFetch ? fallbackName : (creatorNameProp || 'Unknown');

  // Close kebab menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (!useFallbackFetch) return;
    const fetchCreatorInfo = async () => {
      if (!business.created_by) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/users/profile?userId=${business.created_by}`
        );

        const data = await response.json();
        setFallbackName(data.full_name || 'Unknown');
      } catch {
        setFallbackName('Unknown');
      } finally {
        setLoading(false);
      }
    };

    fetchCreatorInfo();
  }, [business.created_by, useFallbackFetch]);

  // Tunda single-click sebentar supaya double-click bisa membatalkannya.
  // Tanpa ini, double-click selalu men-trigger onSelect dulu (yang men-set
  // activeBusiness + memicu re-fetch berantai) baru kemudian navigate ke
  // halaman config — terasa lag.
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    // Klik tombol dalam (Undang, Kunci Periode, kebab) sudah stopPropagation,
    // tapi jaga-jaga: kalau target bukan div root, skip.
    if (e.defaultPrevented) return;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      onSelect?.();
      clickTimerRef.current = null;
    }, 220);
  };

  const handleDoubleClick = () => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    onDoubleClick?.();
  };

  return (
    <div
      className={`card cursor-pointer transition-all flex flex-col ${
        isActive
          ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
          : 'hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600'
      } ${business.is_archived ? 'opacity-60' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden ${
              business.is_archived
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                : business.logo_url
                  ? 'bg-white'
                  : 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white'
            }`}
          >
            {business.logo_url && !business.is_archived ? (
              <Image
                src={business.logo_url}
                alt={business.business_name}
                width={48}
                height={48}
                className={`w-full h-full ${business.logo_fit === 'contain' ? 'object-contain p-1' : 'object-cover'}`}
                unoptimized
              />
            ) : business.is_archived ? (
              <PackageOpen className="w-6 h-6" />
            ) : (
              (() => { const SectorIcon = getSectorIcon(business.business_sector); return <SectorIcon className="w-6 h-6" />; })()
            )}
          </div>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-gray-100">{business.business_name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {BUSINESS_TYPE_LABELS[business.business_sector ?? ''] || (business.business_sector ?? '')}
            </p>
          </div>
        </div>
        {/* Kebab Menu */}
        {showActions && !business.is_archived && (onEdit || onArchive) && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className="p-2 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Menu"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20 py-1">
                {onEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onEdit();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                )}
                {onArchive && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onArchive();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Archive className="w-4 h-4" />
                    Archive
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {showActions && business.is_archived && (onRestore || onHardDelete) && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className="p-2 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Menu"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20 py-1">
                {onRestore && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onRestore();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Restore
                  </button>
                )}
                {onHardDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onHardDelete();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Hapus Permanen
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Business Capital</span>
          <span className="font-semibold text-gray-800 dark:text-gray-100">
            {formatCurrency(totalCapex)}
          </span>
        </div>
        {business.property_address && (
          <div className="text-sm text-gray-500 dark:text-gray-400 flex items-start gap-2">
            <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
            <span>{business.property_address}</span>
          </div>
        )}
      </div>

      {showActions && !business.is_archived && (onInvite || onPeriodLock) && (
        <div className="flex gap-2 mt-4">
          {onInvite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onInvite();
              }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Undang
            </button>
          )}
          {onPeriodLock && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPeriodLock();
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                business.closed_until_date
                  ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                  : 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title={business.closed_until_date ? `Dikunci s/d ${business.closed_until_date}` : 'Kunci Periode'}
            >
              <Lock className="w-4 h-4" />
              {business.closed_until_date ? 'Terkunci' : 'Kunci Periode'}
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-sm mt-auto pt-4">
        <div className="text-gray-500 dark:text-gray-400">
          <span className="text-xs">Created by: </span>
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {loading ? 'Loading...' : creatorName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {business.closed_until_date && !business.is_archived && (
            <span className="flex items-center gap-1 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-xs font-medium rounded-lg">
              <Lock className="w-3 h-3" />
              s/d {business.closed_until_date}
            </span>
          )}
          {isActive && !business.is_archived && (
            <span className="text-sm font-semibold text-emerald-500 dark:text-emerald-400">Active</span>
          )}
          {business.is_archived && (
            <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-semibold rounded-lg">
              Archived
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
