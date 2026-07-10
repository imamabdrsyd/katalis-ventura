'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings2 } from 'lucide-react';
import { useBusinessContext } from '@/context/BusinessContext';
import { useLanguage } from '@/context/LanguageContext';
import { isManagerRole } from '@/lib/roles';
import { isAccommodationSector } from '@/lib/businessSectors';
import { getUnits } from '@/lib/api/units';
import { getCatalogItems } from '@/lib/api/catalog';
import type { BusinessUnit, CatalogItem } from '@/types';
import { UnitManagerModal } from './UnitManagerModal';

/**
 * Tombol "Kelola unit" mandiri untuk tab Layanan/Services di hub kalender —
 * tiap unit punya item sumber harga (rate plan) sendiri, jadi kelola unit
 * relevan juga saat mengelola layanan. Memuat unit + catalog items sendiri
 * (terpisah dari CalendarLauncher yang hanya hidup di tab Kalender; data
 * di-refetch tiap tab Kalender di-mount ulang, jadi tak ada state basi).
 * Hanya tampil utk manager + sektor akomodasi.
 */
export function UnitManagerButton() {
  const { activeBusinessId, activeBusiness, user, userRole } = useBusinessContext();
  const { t } = useLanguage();
  const c = t.calendar;
  const canManage = isManagerRole(userRole);
  const isAccommodation = isAccommodationSector(activeBusiness?.business_sector);

  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [rateItems, setRateItems] = useState<CatalogItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const [unitList, catalog] = await Promise.all([
        getUnits(activeBusinessId),
        getCatalogItems(activeBusinessId, { activeOnly: true }),
      ]);
      setUnits(unitList);
      setRateItems(catalog);
      setLoaded(true);
    } catch {
      /* non-kritis — tombol tidak tampil bila data gagal dimuat */
    }
  }, [activeBusinessId]);

  useEffect(() => {
    if (canManage && isAccommodation) load();
  }, [canManage, isAccommodation, load]);

  if (!canManage || !isAccommodation || !loaded) return null;

  const activeUnits = units.filter((u) => u.is_active);
  // Single unit: tampilkan namanya (konsisten dgn toolbar tab Kalender).
  const label = activeUnits.length === 1 ? activeUnits[0].name : c.manageUnit;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-ghost inline-flex items-center gap-1.5"
        title={c.manageUnit}
      >
        <Settings2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{label}</span>
      </button>
      <UnitManagerModal
        isOpen={open}
        onClose={() => setOpen(false)}
        businessId={activeBusinessId ?? ''}
        userId={user?.id ?? ''}
        units={units}
        rateItems={rateItems}
        onChanged={load}
      />
    </>
  );
}
