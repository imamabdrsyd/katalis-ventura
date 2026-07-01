'use client';

import { useState } from 'react';
import { Box, ShoppingCart, CalendarDays } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { Tabs } from '@/components/ui/Tabs';
import { CatalogPanel } from './CatalogPanel';
import { AiKnowledgePanel } from './AiKnowledgePanel';
import { CashierLauncher } from './cashier/CashierLauncher';
import { CalendarLauncher } from './calendar/CalendarLauncher';

type HubTab = 'catalog' | 'operational';
type HubVariant = 'pos' | 'calendar';

/**
 * Halaman hub yang dipakai route /point-of-sales (variant 'pos', produk/dagang)
 * dan /calendar (variant 'calendar', jasa).
 *
 * 2 tab di pojok kanan atas (pola halaman AR/AP): Katalog + panel operasional
 * (Kasir/Kalender, masih stub di MVP).
 *
 * Tab Katalog = 2 panel: kiri (lebar) grid produk/jasa + kanan (lebih sempit)
 * Info AI — fakta bisnis yang dibaca AI saat membalas lead di semua channel.
 */
export function HubPage({ variant }: { variant: HubVariant }) {
  const { t } = useLanguage();
  const th = t.hub;
  const [tab, setTab] = useState<HubTab>('catalog');

  const isPos = variant === 'pos';
  const subtitle = isPos ? th.posSubtitle : th.calendarSubtitle;
  const OperationalIcon = isPos ? ShoppingCart : CalendarDays;
  const operationalLabel = isPos ? th.tabKasir : th.tabKalender;

  // Judul + ikon header mengikuti tab aktif (identitas menu tetap di sidebar)
  const isCatalog = tab === 'catalog';
  const HeaderIcon = isCatalog ? Box : OperationalIcon;
  const title = isCatalog ? th.tabCatalog : operationalLabel;

  return (
    <div className="p-4 md:p-6">
      {/* Header: judul kiri, tab kanan atas (pola AR/AP) */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <HeaderIcon className="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
            {title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
        </div>

        <Tabs<HubTab>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'catalog', label: th.tabCatalog, icon: <Box className="w-4 h-4" /> },
            { value: 'operational', label: operationalLabel, icon: <OperationalIcon className="w-4 h-4" /> },
          ]}
        />
      </div>

      {/* Tab Katalog: toolbar full-width di atas; grid (kiri) + Info AI (kanan) */}
      {tab === 'catalog' && <CatalogPanel aside={<AiKnowledgePanel />} />}

      {tab === 'operational' && (isPos ? <CashierLauncher /> : <CalendarLauncher />)}
    </div>
  );
}
