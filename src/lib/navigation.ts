import { useMemo } from 'react';
import {
  Calculator,
  Scale,
  ChartNoAxesCombined,
  BookOpen,
  BookOpenCheck,
  ClipboardCheck,
  HandCoins,
  FileText,
  Landmark,
  DollarSign,
  ArrowLeftRight,
  GitBranch,
  FlaskConical,
  Target,
  LineChart,
  CalendarDays,
  Store,
  Gamepad2,
  LucideIcon,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { isAssetConsoleSector } from '@/lib/businessSectors';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Deskripsi singkat untuk kartu di halaman hub (opsional). */
  description?: string;
};

export type NavSectionKey = 'accounting' | 'financialReports' | 'analytics';

export type NavSection = {
  /** Kunci stabil — dipakai halaman hub untuk mengambil section-nya. */
  key: NavSectionKey;
  /** Label sidebar (UPPERCASE). */
  label: string;
  /** Judul halaman hub (Title Case). */
  title: string;
  /** Sub-judul halaman hub. */
  subtitle: string;
  /** Route halaman hub dedicated. */
  href: string;
  icon: LucideIcon;
  items: NavItem[];
};

/**
 * Menu "Catalog" lama kini swap by tipe bisnis (hub Point of Sales / Calendar):
 * - jasa → "Calendar" (/calendar)
 * - sektor finance → "Catalog" (masih /point-of-sales, tapi hub-nya cuma render
 *   tab Katalog tanpa Kasir — bisnis finance tidak jualan lewat checkout,
 *   Katalog di sana dipakai untuk set kelas aset per instrumen Asset Console)
 * - produk/dagang/legacy (tipe kosong) → "Point of Sales" (/point-of-sales)
 * Dipakai DUA situs (Sidebar + SearchDialog) — keduanya wajib panggil helper ini
 * agar tidak drift.
 */
export function getPosNavItem(
  businessType: string | undefined,
  nav: { pointOfSales: string; calendar: string; catalog: string },
  businessSector?: string | null
): NavItem {
  if (businessType === 'jasa') {
    return { href: '/calendar', label: nav.calendar, icon: CalendarDays };
  }
  if (isAssetConsoleSector(businessSector)) {
    return { href: '/point-of-sales', label: nav.catalog, icon: Store };
  }
  return { href: '/point-of-sales', label: nav.pointOfSales, icon: Store };
}

/**
 * Sektor bisnis yang memakai Asset Console.
 *
 * CATATAN: sengaja TIDAK memakai `business_type === 'dagang'`. Badge "TRADING"
 * di header memang berasal dari sana (label EN untuk 'dagang'), tapi semantik
 * 'dagang' adalah perdagangan barang/merchandising — UMKM retail biasa juga
 * 'dagang' dan tidak butuh Asset Console. Penanda yang benar adalah sektornya.
 *
 * Daftar sektornya didefinisikan SATU tempat di `businessSectors.ts` (dipakai
 * juga oleh dropdown BusinessForm) — jangan hardcode literal 'finance' di sini
 * lagi, supaya rename/typo preset sektor tidak diam-diam memutus nav item ini.
 */
export const isAssetConsoleEnabled = isAssetConsoleSector;

export function getAssetConsoleNavItem(nav: { assetConsole: string }): NavItem {
  return { href: '/asset-console', label: nav.assetConsole, icon: Gamepad2 };
}

/**
 * Sumber tunggal data navigasi bagian AKUNTANSI / LAPORAN KEUANGAN / ANALITIK.
 * Dipakai oleh sidebar (routing ke hub), SearchDialog (daftar sub-menu), dan
 * halaman hub (kartu-kartu). Satu tempat agar tidak drift.
 */
export function useNavData() {
  const { t } = useLanguage();

  const roleLabels: Record<string, string> = useMemo(() => ({
    business_manager: t.roles.businessManager,
    investor: t.roles.investor,
    superadmin: t.roles.superAdmin,
  }), [t]);

  const navSections: NavSection[] = useMemo(() => [
    {
      key: 'accounting',
      label: t.nav.accounting,
      title: t.navHub.accountingTitle,
      subtitle: t.navHub.accountingSubtitle,
      href: '/accounting',
      icon: Calculator,
      items: [
        { href: '/accounts', label: t.nav.chartOfAccounts, icon: BookOpen, description: t.navHub.desc.chartOfAccounts },
        { href: '/general-ledger', label: t.nav.generalLedger, icon: BookOpenCheck, description: t.navHub.desc.generalLedger },
        { href: '/trial-balance', label: t.nav.trialBalance, icon: ClipboardCheck, description: t.navHub.desc.trialBalance },
        { href: '/ar-ap', label: t.nav.arAp, icon: HandCoins, description: t.navHub.desc.arAp },
        { href: '/invoices', label: t.nav.invoice, icon: FileText, description: t.navHub.desc.invoice },
        { href: '/reconciliation', label: t.nav.bankReconciliation, icon: Landmark, description: t.navHub.desc.bankReconciliation },
      ],
    },
    {
      key: 'financialReports',
      label: t.nav.financialReports,
      title: t.navHub.financialReportsTitle,
      subtitle: t.navHub.financialReportsSubtitle,
      href: '/financial-reports',
      icon: Scale,
      items: [
        { href: '/income-statement', label: t.nav.profitLoss, icon: DollarSign, description: t.navHub.desc.profitLoss },
        { href: '/balance-sheet', label: t.nav.balanceSheet, icon: Scale, description: t.navHub.desc.balanceSheet },
        { href: '/cash-flow', label: t.nav.cashFlow, icon: ArrowLeftRight, description: t.navHub.desc.cashFlow },
        { href: '/statement-of-changes-in-equity', label: t.nav.changesInEquity, icon: GitBranch, description: t.navHub.desc.changesInEquity },
      ],
    },
    {
      key: 'analytics',
      label: t.nav.analytics,
      title: t.navHub.analyticsTitle,
      subtitle: t.navHub.analyticsSubtitle,
      href: '/analytics',
      icon: ChartNoAxesCombined,
      items: [
        { href: '/scenario-modeling', label: t.nav.scenarioModeling, icon: FlaskConical, description: t.navHub.desc.scenarioModeling },
        { href: '/roi-forecast', label: t.nav.budgetForecast, icon: Target, description: t.navHub.desc.budgetForecast },
        { href: '/market', label: t.nav.marketTracker, icon: LineChart, description: t.navHub.desc.marketTracker },
      ],
    },
  ], [t]);

  return { roleLabels, navSections, t };
}
