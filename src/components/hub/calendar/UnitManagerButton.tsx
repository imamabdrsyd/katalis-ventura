'use client';

import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { useBusinessContext } from '@/context/BusinessContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCalendarUnit } from './CalendarUnitContext';
import { UnitManagerModal } from './UnitManagerModal';

/**
 * Tombol "Kelola unit" untuk header tab Layanan/Services (dan toolbar Kalender).
 * Unit = level teratas: switch unit di sini mengganti kalender DAN daftar layanan
 * yang tampil. Data unit dari CalendarUnitContext (dibagi dgn tab Kalender).
 * Hanya tampil utk manager + sektor akomodasi (context.enabled).
 */
export function UnitManagerButton() {
  const { activeBusinessId, user } = useBusinessContext();
  const { t } = useLanguage();
  const c = t.calendar;
  const { enabled, activeUnits, selectedUnit, reloadUnits } = useCalendarUnit();
  const [open, setOpen] = useState(false);

  if (!enabled) return null;

  // Single unit: tampilkan namanya; multi: label generik "Kelola unit".
  const label = activeUnits.length === 1 ? activeUnits[0].name : selectedUnit?.name ?? c.manageUnit;

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
        onChanged={reloadUnits}
      />
    </>
  );
}
