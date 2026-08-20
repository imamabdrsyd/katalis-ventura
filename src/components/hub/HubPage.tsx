'use client';

import { useState, type ReactNode } from 'react';
import { Box, ShoppingCart, CalendarDays, PartyPopper } from 'lucide-react';
import { useBusinessContext } from '@/context/BusinessContext';
import { useLanguage } from '@/context/LanguageContext';
import { supportsEventRegistration } from '@/lib/businessSectors';
import { Tabs } from '@/components/ui/Tabs';
import { CatalogPanel } from './CatalogPanel';
import { AiKnowledgePanel } from './AiKnowledgePanel';
import { StockLogPanel } from './StockLogPanel';
import { CashierLauncher } from './cashier/CashierLauncher';
import { CalendarLauncher } from './calendar/CalendarLauncher';
import { EventManagerLauncher } from './events/EventManagerLauncher';
import { UnitManagerButton } from './calendar/UnitManagerButton';
import { CalendarUnitProvider } from './calendar/CalendarUnitContext';

type HubTab = 'catalog' | 'operational';
type HubVariant = 'pos' | 'calendar' | 'finance';

/**
 * Halaman hub yang dipakai route /point-of-sales (variant 'pos' untuk
 * produk/dagang, atau 'finance' untuk sektor investasi) dan /calendar
 * (variant 'calendar', jasa).
 *
 * 2 tab di pojok kanan atas (pola halaman AR/AP): Katalog + panel operasional
 * (Kasir/Kalender, masih stub di MVP). Variant 'finance' PENGECUALIAN: hanya
 * render Katalog tanpa tab switcher — bisnis sektor investasi tidak jualan
 * lewat checkout kasir, Katalog di sana dipakai untuk set kelas aset per
 * instrumen (lihat Asset Console, migr 125) bukan untuk transaksi POS.
 *
 * Tab Katalog = 2 panel: kiri (lebar) grid produk/jasa + kanan (lebih sempit)
 * Info AI — fakta bisnis yang dibaca AI saat membalas lead di semua channel.
 *
 * Variant 'calendar' punya DUA isi tab operasional yang berbeda, dipilih dari
 * sektor bisnis: akomodasi dapat kalender booking per malam, creative agency
 * dapat Event Manager ("Book Your Spot", migr 136). Keduanya menempati slot yang
 * sama karena sama-sama menjawab "kapan orang datang" — cuma modelnya beda
 * (tanggal pasti vs tanggal yang masih diperebutkan).
 */
export function HubPage({ variant }: { variant: HubVariant }) {
  // Hub kalender: bungkus dgn provider unit supaya tab Kalender & Services berbagi
  // unit aktif yang sama (unit = level teratas). POS/finance tak perlu.
  const inner = <HubPageInner variant={variant} />;
  return variant === 'calendar' ? <CalendarUnitProvider>{inner}</CalendarUnitProvider> : inner;
}

function HubPageInner({ variant }: { variant: HubVariant }): ReactNode {
  const { t } = useLanguage();
  const { activeBusiness } = useBusinessContext();
  const th = t.hub;
  // Kalender tampil duluan (tab operasional) — Katalog tetap default utk POS/finance.
  const [tab, setTab] = useState<HubTab>(variant === 'calendar' ? 'operational' : 'catalog');
  // Dinaikkan tiap stok berubah supaya StockLogPanel memuat ulang riwayatnya.
  const [stockLogKey, setStockLogKey] = useState(0);

  const isPos = variant === 'pos';
  const isFinance = variant === 'finance';
  // Hub jasa sektor creative agency: tab operasionalnya Event, bukan kalender.
  const isEventHub =
    variant === 'calendar' &&
    supportsEventRegistration(activeBusiness?.business_type, activeBusiness?.business_sector);
  const OperationalIcon = isPos ? ShoppingCart : isEventHub ? PartyPopper : CalendarDays;
  const operationalLabel = isPos ? th.tabKasir : isEventHub ? t.events.hubTitle : th.tabKalender;
  // Hub jasa (kalender): tab katalog di-brand "Layanan"/"Services". POS/finance tetap "Katalog".
  const catalogLabel = isPos || isFinance ? th.tabCatalog : th.tabServices;
  const catalogSubtitle = isPos || isFinance ? th.posSubtitle : th.servicesSubtitle;

  // Judul + ikon header mengikuti tab aktif (identitas menu tetap di sidebar).
  // Finance selalu di tab catalog (tak ada tab lain), jadi header-nya statis.
  const isCatalog = isFinance || tab === 'catalog';
  const HeaderIcon = isCatalog ? Box : OperationalIcon;
  const title = isCatalog ? catalogLabel : operationalLabel;
  const subtitle = isCatalog
    ? catalogSubtitle
    : isPos
      ? th.posSubtitle
      : isEventHub
        ? t.events.hubSubtitle
        : th.calendarSubtitle;

  // Slot header untuk kontrol kalender (pemilih unit + "Perlu tindak lanjut") —
  // di-portal dari CalendarLauncher supaya sejajar dgn judul & tab, bukan baris terpisah.
  const [calendarHeaderEl, setCalendarHeaderEl] = useState<HTMLDivElement | null>(null);
  const showCalendarHeaderSlot = variant === 'calendar' && tab === 'operational';

  return (
    <div className="p-4 md:p-6">
      {/* Header: judul kiri, kontrol kalender + tab kanan atas (pola AR/AP).
          Finance tidak punya tab lain — switcher-nya di-skip sepenuhnya
          (bukan disembunyikan CSS) supaya tidak menawarkan pilihan kosong. */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <HeaderIcon className="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
            {title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
        </div>

        {!isFinance && (
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
        )}
      </div>

      {/* Tab Katalog / Layanan: toolbar full-width di atas; grid (kiri) + Info AI (kanan).
          Di hub kalender, item di-scope ke unit aktif (variant='calendar'). */}
      {(isFinance || tab === 'catalog') && (
        <CatalogPanel
          scopeToUnit={variant === 'calendar'}
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

      {!isFinance &&
        tab === 'operational' &&
        (isPos ? (
          <CashierLauncher />
        ) : isEventHub ? (
          <EventManagerLauncher headerSlot={calendarHeaderEl} />
        ) : (
          <CalendarLauncher headerSlot={calendarHeaderEl} />
        ))}
    </div>
  );
}
