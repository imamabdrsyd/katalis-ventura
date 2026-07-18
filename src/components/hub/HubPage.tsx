'use client';

import { useState } from 'react';
import { Box, ShoppingCart, CalendarDays } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { Tabs } from '@/components/ui/Tabs';
import { CatalogPanel } from './CatalogPanel';
import { AiKnowledgePanel } from './AiKnowledgePanel';
import { StockLogPanel } from './StockLogPanel';
import { CashierLauncher } from './cashier/CashierLauncher';
import { CalendarLauncher } from './calendar/CalendarLauncher';
import { UnitManagerButton } from './calendar/UnitManagerButton';

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
  // Kalender tampil duluan (tab operasional) — Katalog tetap default utk POS.
  const [tab, setTab] = useState<HubTab>(variant === 'calendar' ? 'operational' : 'catalog');
  // Dinaikkan tiap stok berubah supaya StockLogPanel memuat ulang riwayatnya.
  const [stockLogKey, setStockLogKey] = useState(0);

  const isPos = variant === 'pos';
  const OperationalIcon = isPos ? ShoppingCart : CalendarDays;
  const operationalLabel = isPos ? th.tabKasir : th.tabKalender;
  // Hub jasa (kalender): tab katalog di-brand "Layanan"/"Services". POS tetap "Katalog".
  const catalogLabel = isPos ? th.tabCatalog : th.tabServices;
  const catalogSubtitle = isPos ? th.posSubtitle : th.servicesSubtitle;

  // Judul + ikon header mengikuti tab aktif (identitas menu tetap di sidebar)
  const isCatalog = tab === 'catalog';
  const HeaderIcon = isCatalog ? Box : OperationalIcon;
  const title = isCatalog ? catalogLabel : operationalLabel;
  const subtitle = isCatalog ? catalogSubtitle : (isPos ? th.posSubtitle : th.calendarSubtitle);

  // Slot header untuk kontrol kalender (pemilih unit + "Perlu tindak lanjut") —
  // di-portal dari CalendarLauncher supaya sejajar dgn judul & tab, bukan baris terpisah.
  const [calendarHeaderEl, setCalendarHeaderEl] = useState<HTMLDivElement | null>(null);
  const showCalendarHeaderSlot = variant === 'calendar' && tab === 'operational';

  return (
    <div className="p-4 md:p-6">
      {/* Header: judul kiri, kontrol kalender + tab kanan atas (pola AR/AP) */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <HeaderIcon className="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
            {title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Tab Layanan: tombol Kelola unit tetap tampil (unit ↔ rate plan dikelola dari sini) */}
          {variant === 'calendar' && tab === 'catalog' && <UnitManagerButton />}
          {showCalendarHeaderSlot && <div ref={setCalendarHeaderEl} className="flex flex-wrap items-center gap-2" />}
          <Tabs<HubTab>
            value={tab}
            onChange={setTab}
            tabs={(() => {
              const catalogTab = { value: 'catalog' as HubTab, label: catalogLabel, icon: <Box className="w-4 h-4" /> };
              const operationalTab = {
                value: 'operational' as HubTab,
                label: operationalLabel,
                icon: <OperationalIcon className="w-4 h-4" />,
              };
              // Kalender: tab Kalender di kiri. POS: Katalog di kiri.
              return isPos ? [catalogTab, operationalTab] : [operationalTab, catalogTab];
            })()}
          />
        </div>
      </div>

      {/* Tab Katalog: toolbar full-width di atas; grid (kiri) + Info AI (kanan) */}
      {tab === 'catalog' && (
        <CatalogPanel
          onStockChanged={() => setStockLogKey((k) => k + 1)}
          aside={
            <div className="space-y-6">
              <AiKnowledgePanel />
              {/* Riwayat stok hanya relevan untuk hub produk (POS) */}
              {isPos && <StockLogPanel refreshKey={stockLogKey} />}
            </div>
          }
        />
      )}

      {tab === 'operational' && (isPos ? <CashierLauncher /> : <CalendarLauncher headerSlot={calendarHeaderEl} />)}
    </div>
  );
}
