'use client';

import { type ReactNode } from 'react';
import {
  sectionMatchesFilter,
  type SectionId,
  type SurfaceFilter,
} from './omniChannelSurfaceMap';

interface Props {
  sectionId: SectionId;
  activeFilter: SurfaceFilter;
  children: ReactNode;
}

/**
 * Wrapper untuk tiap section konfigurasi omnichannel.
 * Saat filter aktif (bukan 'all') dan section tidak relevan ke surface aktif,
 * card tidak di-render sama sekali — user bisa tahu surface mana yang aktif
 * dari tab di panel preview kanan.
 */
export function ConfigSection({ sectionId, activeFilter, children }: Props) {
  if (!sectionMatchesFilter(sectionId, activeFilter)) {
    return null;
  }
  return <>{children}</>;
}
