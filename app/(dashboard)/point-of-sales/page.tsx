'use client';

import { HubPage } from '@/components/hub/HubPage';
import { useBusinessContext } from '@/context/BusinessContext';
import { isAssetConsoleSector } from '@/lib/businessSectors';

export default function PointOfSalesPage() {
  const { activeBusiness } = useBusinessContext();
  const variant = isAssetConsoleSector(activeBusiness?.business_sector) ? 'finance' : 'pos';
  return <HubPage variant={variant} />;
}
