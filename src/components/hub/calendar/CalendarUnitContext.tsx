'use client';

/**
 * Konteks unit aktif untuk hub kalender (sektor akomodasi). Unit = level teratas:
 * tab Kalender DAN tab Services (Katalog) sama-sama scoped ke unit yang dipilih.
 * Switch/tambah unit di "Kelola unit" mengubah keduanya sekaligus.
 *
 * Provider dipasang di HubPage (variant 'calendar'). Menyimpan daftar unit +
 * unit terpilih (persist per bisnis di localStorage), plus reload setelah unit
 * berubah. Hanya relevan bila manager + sektor akomodasi; di luar itu
 * `useCalendarUnit` mengembalikan state kosong yang aman.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useBusinessContext } from '@/context/BusinessContext';
import { isManagerRole } from '@/lib/roles';
import { isAccommodationSector } from '@/lib/businessSectors';
import { getUnits } from '@/lib/api/units';
import type { BusinessUnit } from '@/types';

interface CalendarUnitValue {
  units: BusinessUnit[];
  activeUnits: BusinessUnit[];
  selectedUnit: BusinessUnit | null;
  selectedUnitId: string | null;
  setSelectedUnitId: (id: string) => void;
  loading: boolean;
  /** Muat ulang daftar unit (mis. setelah tambah/rename/hapus di UnitManagerModal). */
  reloadUnits: () => Promise<void>;
  /** Apakah hub ini memakai model unit (manager + akomodasi). */
  enabled: boolean;
}

const CalendarUnitContext = createContext<CalendarUnitValue | null>(null);

const storageKey = (businessId: string) => `axion_calendar_unit_${businessId}`;

export function CalendarUnitProvider({ children }: { children: ReactNode }) {
  const { activeBusinessId, activeBusiness, userRole } = useBusinessContext();
  const enabled = isManagerRole(userRole) && isAccommodationSector(activeBusiness?.business_sector);

  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnitId, setSelectedUnitIdState] = useState<string | null>(null);

  const reloadUnits = useCallback(async () => {
    if (!activeBusinessId || !enabled) {
      setUnits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await getUnits(activeBusinessId);
      setUnits(list);
      setSelectedUnitIdState((prev) => {
        if (prev && list.some((u) => u.id === prev && !u.deleted_at)) return prev;
        const stored = typeof window !== 'undefined' ? localStorage.getItem(storageKey(activeBusinessId)) : null;
        if (stored && list.some((u) => u.id === stored)) return stored;
        return list.find((u) => u.is_active)?.id ?? list[0]?.id ?? null;
      });
    } catch {
      setUnits([]);
    } finally {
      setLoading(false);
    }
  }, [activeBusinessId, enabled]);

  useEffect(() => {
    reloadUnits();
  }, [reloadUnits]);

  const setSelectedUnitId = useCallback(
    (id: string) => {
      setSelectedUnitIdState(id);
      if (activeBusinessId && typeof window !== 'undefined') {
        localStorage.setItem(storageKey(activeBusinessId), id);
      }
    },
    [activeBusinessId]
  );

  const activeUnits = useMemo(() => units.filter((u) => u.is_active), [units]);
  const selectedUnit = useMemo(
    () => units.find((u) => u.id === selectedUnitId) ?? activeUnits[0] ?? null,
    [units, selectedUnitId, activeUnits]
  );

  const value: CalendarUnitValue = {
    units,
    activeUnits,
    selectedUnit,
    selectedUnitId,
    setSelectedUnitId,
    loading,
    reloadUnits,
    enabled,
  };

  return <CalendarUnitContext.Provider value={value}>{children}</CalendarUnitContext.Provider>;
}

/** Hook konteks unit kalender. Aman dipanggil di luar provider → state kosong. */
export function useCalendarUnit(): CalendarUnitValue {
  const ctx = useContext(CalendarUnitContext);
  if (ctx) return ctx;
  return {
    units: [],
    activeUnits: [],
    selectedUnit: null,
    selectedUnitId: null,
    setSelectedUnitId: () => {},
    loading: false,
    reloadUnits: async () => {},
    enabled: false,
  };
}
