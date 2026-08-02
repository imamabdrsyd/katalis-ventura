'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Wallet, TrendingUp, Coins, PiggyBank, AlertTriangle, ChevronRight, Info, CandlestickChart, Gamepad2 } from 'lucide-react';
import { useAssetConsole } from '@/hooks/useAssetConsole';
import { useLanguage } from '@/context/LanguageContext';
import { formatCurrency } from '@/lib/utils';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/PageSkeleton';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { ASSET_CLASSES } from '@/lib/assetClasses';
import { UpdatePriceModal } from '@/components/assetConsole/UpdatePriceModal';
import {
  AssetClassBadge,
  KpiCard,
  PlValue,
  SensitiveAmountToggle,
  formatQuantity,
  formatUnitPrice,
  maskAmount,
  plColorClass,
  quantityUnitLabel,
  useAssetClassLabel,
} from '@/components/assetConsole/AssetConsoleBits';
import type { AssetClass } from '@/types';
import type { AssetHolding } from '@/lib/assetConsole';

type ClassFilter = AssetClass | 'all';

export default function AssetConsolePage() {
  const { t } = useLanguage();
  const ta = t.assetConsole;
  const router = useRouter();
  const classLabel = useAssetClassLabel();

  const { holdings, summary, instruments, loading, error, updatePrice } = useAssetConsole();
  const [filter, setFilter] = useState<ClassFilter>('all');
  const [priceTarget, setPriceTarget] = useState<AssetHolding | null>(null);
  // Sensor nominal Total Invested — state di memori saja (bukan localStorage),
  // reset tiap reload sesuai keputusan produk saat ini ("untuk sementara ini").
  const [investedVisible, setInvestedVisible] = useState(true);

  // Hanya tawarkan filter untuk kelas yang benar-benar dimiliki bisnis ini.
  const availableClasses = useMemo(
    () => ASSET_CLASSES.filter((cls) => holdings.some((h) => h.assetClass === cls)),
    [holdings]
  );

  const visible = useMemo(
    () => (filter === 'all' ? holdings : holdings.filter((h) => h.assetClass === filter)),
    [holdings, filter]
  );

  if (loading) return <TableSkeleton />;

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <EmptyState icon={AlertTriangle} title={error} />
      </div>
    );
  }

  // Belum ada item katalog yang ditandai sebagai aset — arahkan ke Katalog,
  // karena di sanalah instrumen didefinisikan (bukan di halaman ini).
  if (instruments.length === 0) {
    return (
      <div className="p-4 md:p-8 space-y-6">
        <PageHeader title={ta.title} subtitle={ta.subtitle} />
        <EmptyState
          variant="accent"
          icon={Wallet}
          title={ta.emptyTitle}
          description={ta.emptyDesc}
          action={
            <Link href="/point-of-sales" className="btn-primary">
              {ta.emptyAction}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader title={ta.title} subtitle={ta.subtitle} />

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon={PiggyBank} label={ta.kpiInvested} hint={ta.kpiInvestedHint}>
          <span className="inline-flex items-center gap-2 text-gray-800 dark:text-gray-100">
            {investedVisible ? (
              <AnimatedNumber value={summary.totalInvested} formatter={(v) => formatCurrency(v)} />
            ) : (
              <span aria-hidden>{maskAmount(formatCurrency(summary.totalInvested))}</span>
            )}
            <SensitiveAmountToggle
              visible={investedVisible}
              onToggle={() => setInvestedVisible((v) => !v)}
              labelShow={ta.showAmount}
              labelHide={ta.hideAmount}
            />
          </span>
          {/* Screen reader tetap dapat angka aslinya walau visual disensor. */}
          {!investedVisible && <span className="sr-only">{formatCurrency(summary.totalInvested)}</span>}
        </KpiCard>
        <KpiCard icon={CandlestickChart} label={ta.kpiMarketValue} hint={ta.kpiMarketValueHint}>
          <span className="text-gray-800 dark:text-gray-100">
            <AnimatedNumber value={summary.totalMarketValue} formatter={(v) => formatCurrency(v)} />
          </span>
        </KpiCard>
        <KpiCard icon={TrendingUp} label={ta.kpiUnrealized} hint={ta.kpiUnrealizedHint}>
          {/* flex-wrap: angka rupiah besar + persentase turun ke baris sendiri
              di card sempit (xl:grid-cols-4), bukan meluber keluar card. */}
          <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${plColorClass(summary.totalUnrealizedPl)}`}>
            <span className="break-all">
              <AnimatedNumber
                value={summary.totalUnrealizedPl}
                formatter={(v) => `${v > 0 ? '+' : ''}${formatCurrency(v)}`}
              />
            </span>
            {summary.totalInvested > 0 && (
              <span className="text-sm font-medium whitespace-nowrap">
                ({summary.totalUnrealizedPl > 0 ? '+' : ''}
                {summary.totalUnrealizedPlPct.toFixed(2)}%)
              </span>
            )}
          </span>
        </KpiCard>
        <KpiCard icon={Coins} label={ta.kpiRealized} hint={ta.kpiRealizedHint}>
          <span className={plColorClass(summary.totalRealizedPl)}>
            <AnimatedNumber
              value={summary.totalRealizedPl}
              formatter={(v) => `${v > 0 ? '+' : ''}${formatCurrency(v)}`}
            />
          </span>
        </KpiCard>
      </div>

      {summary.missingPriceCount > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm text-amber-700 dark:text-amber-300">{ta.noPriceWarning}</p>
        </div>
      )}

      {/* Filter kelas aset — hanya bila lebih dari satu kelas dimiliki */}
      {availableClasses.length > 1 && (
        <SegmentedToggle
          value={filter}
          onChange={(v) => setFilter(v as ClassFilter)}
          ariaLabel={ta.colClass}
          options={[
            { value: 'all', label: ta.filterAll },
            ...availableClasses.map((cls) => ({ value: cls, label: classLabel(cls) })),
          ]}
        />
      )}

      {/* Tabel konsolidasi */}
      <div className="card-static overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                <Th>{ta.colSymbol}</Th>
                <Th align="right">{ta.colBalance}</Th>
                <Th align="right">{ta.colAvgPrice}</Th>
                <Th align="right">{ta.colLastPrice}</Th>
                <Th align="right">{ta.colInvested}</Th>
                <Th align="right">{ta.colMarketValue}</Th>
                <Th align="right">{ta.colPl}</Th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {visible.map((h) => {
                const closed = h.totalQuantity <= 0;
                return (
                  <tr
                    key={h.itemId}
                    onClick={() => router.push(`/asset-console/${h.itemId}`)}
                    className="border-b border-gray-100 dark:border-gray-700/60 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800 dark:text-gray-100">{h.symbol}</span>
                        <AssetClassBadge assetClass={h.assetClass} />
                        {h.hasUnknownQuantity && (
                          <span title={ta.unknownQtyWarning}>
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" aria-label={ta.unknownQtyWarning} />
                          </span>
                        )}
                      </div>
                      {(() => {
                        // positions bisa memuat posisi yang sudah tertutup
                        // (quantity=0) tapi masih dicatat karena realized P/L-nya
                        // — baris kustodian di sini hanya untuk yang MASIH pegang.
                        const openCustodians = h.positions.filter((p) => p.quantity > 0);
                        return openCustodians.length > 0 ? (
                          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                            {openCustodians.map((p) => p.custodian).join(' · ')}
                          </p>
                        ) : null;
                      })()}
                    </td>
                    <Td align="right">
                      {closed ? (
                        <span className="text-xs text-gray-400 dark:text-gray-500">{ta.closedPosition}</span>
                      ) : (
                        <>
                          <span className="text-gray-800 dark:text-gray-100">
                            {formatQuantity(h.totalQuantity)}
                            {/* Nama satuan kuantitas: "Lot" utk saham (kuantitas
                                transaksi, beda dari priceUnit "Lembar"), atau
                                unit Katalog apa adanya utk kelas lain (Coin,
                                gram, dst — di sana kuantitas = satuan harga). */}
                            <span className="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">
                              {quantityUnitLabel(h)}
                            </span>
                          </span>
                          {h.lotSize > 1 && (
                            <span className="block text-xs text-gray-400 dark:text-gray-500">
                              {formatQuantity(h.totalQuantity * h.lotSize)} {h.priceUnit}
                            </span>
                          )}
                        </>
                      )}
                    </Td>
                    <Td align="right">
                      {closed ? '—' : formatUnitPrice(h.avgCostPerPriceUnit)}
                    </Td>
                    <td className="px-4 py-3.5 text-right tabular-nums whitespace-nowrap">
                      {/* Update harga inline: klik sel ini tidak boleh ikut
                          membuka halaman detail (row-nya clickable). */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPriceTarget(h);
                        }}
                        title={ta.updatePrice}
                        className="min-h-[44px] sm:min-h-0 px-2 py-1 -mr-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                      >
                        {h.lastPrice > 0 ? (
                          formatUnitPrice(h.lastPrice)
                        ) : (
                          <span className="text-xs text-amber-600 dark:text-amber-400">
                            {ta.priceNeverUpdated}
                          </span>
                        )}
                      </button>
                    </td>
                    <Td align="right">{formatCurrency(h.totalCostBasis)}</Td>
                    <Td align="right">{h.lastPrice > 0 ? formatCurrency(h.marketValue) : '—'}</Td>
                    <td className="px-4 py-3.5 text-right">
                      {h.lastPrice > 0 && !closed ? (
                        <PlValue value={h.unrealizedPl} pct={h.unrealizedPlPct} />
                      ) : h.realizedPl !== 0 ? (
                        <PlValue value={h.realizedPl} />
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="pr-3 text-right">
                      <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 inline-block" aria-hidden />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {visible.length === 0 && (
          <EmptyState size="sm" icon={Wallet} title={ta.noPositionTitle} description={ta.noPositionDesc} />
        )}
      </div>

      <p className="flex items-start gap-2 text-xs text-gray-400 dark:text-gray-500">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden />
        {ta.sourceNote}
      </p>

      <UpdatePriceModal holding={priceTarget} onClose={() => setPriceTarget(null)} onSave={updatePrice} />
    </div>
  );
}

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
        <Gamepad2 className="w-7 h-7 text-indigo-500 dark:text-indigo-400" aria-hidden />
        {title}
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 whitespace-nowrap ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td
      className={`px-4 py-3.5 tabular-nums text-gray-700 dark:text-gray-300 whitespace-nowrap ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </td>
  );
}
