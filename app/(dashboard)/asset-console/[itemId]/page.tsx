'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Wallet,
  TrendingUp,
  Coins,
  PiggyBank,
  AlertTriangle,
  Pencil,
  Info,
} from 'lucide-react';
import { useAssetConsole } from '@/hooks/useAssetConsole';
import { useLanguage } from '@/context/LanguageContext';
import { formatCurrency, formatDateShort } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/PageSkeleton';
import { UpdatePriceModal } from '@/components/assetConsole/UpdatePriceModal';
import {
  AssetClassBadge,
  KpiCard,
  PlValue,
  formatQuantity,
  formatUnitPrice,
  plColorClass,
  quantityUnitLabel,
} from '@/components/assetConsole/AssetConsoleBits';
import type { AssetEventType } from '@/lib/assetConsole';

export default function AssetInstrumentPage() {
  const { t } = useLanguage();
  const ta = t.assetConsole;
  const params = useParams<{ itemId: string }>();
  const itemId = params?.itemId;

  const { findHolding, loading, error, updatePrice } = useAssetConsole();
  const [editingPrice, setEditingPrice] = useState(false);

  const holding = itemId ? findHolding(itemId) : undefined;

  if (loading) return <TableSkeleton />;

  if (error || !holding) {
    return (
      <div className="p-4 md:p-8 space-y-6">
        <BackLink label={ta.backToConsole} />
        <EmptyState icon={AlertTriangle} title={error ?? ta.noPositionTitle} description={error ? undefined : ta.noPositionDesc} />
      </div>
    );
  }

  const eventLabel: Record<AssetEventType, string> = {
    buy: ta.eventBuy,
    sell: ta.eventSell,
    dividend: ta.eventDividend,
    adjustment: ta.eventAdjustment,
  };

  const closed = holding.totalQuantity <= 0;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <BackLink label={ta.backToConsole} />

      {/* Header instrumen */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{holding.symbol}</h1>
            <AssetClassBadge assetClass={holding.assetClass} />
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {holding.lastPrice > 0 ? (
              <>
                {formatUnitPrice(holding.lastPrice)}
                {holding.priceUnit ? ` / ${holding.priceUnit}` : ''}
                {' · '}
                {holding.lastPriceUpdatedAt
                  ? `${ta.priceUpdatedAt} ${formatDateShort(holding.lastPriceUpdatedAt)}`
                  : ta.priceNeverUpdated}
              </>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">{ta.priceNeverUpdated}</span>
            )}
          </p>
        </div>
        <button type="button" onClick={() => setEditingPrice(true)} className="btn-ghost flex items-center gap-2">
          <Pencil className="w-4 h-4" aria-hidden />
          {ta.updatePrice}
        </button>
      </div>

      {holding.hasUnknownQuantity && (
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm text-amber-700 dark:text-amber-300">{ta.unknownQtyWarning}</p>
        </div>
      )}

      {/* KPI instrumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon={Wallet} label={ta.colBalance}>
          <span className="text-gray-800 dark:text-gray-100">
            {closed ? (
              <span className="text-base font-medium text-gray-400 dark:text-gray-500">{ta.closedPosition}</span>
            ) : (
              <>
                {formatQuantity(holding.totalQuantity)}
                <span className="ml-1 text-sm font-normal text-gray-400 dark:text-gray-500">
                  {quantityUnitLabel(holding)}
                </span>
                {holding.lotSize > 1 && (
                  <span className="ml-2 text-sm font-medium text-gray-400 dark:text-gray-500">
                    ({formatQuantity(holding.totalQuantity * holding.lotSize)} {holding.priceUnit})
                  </span>
                )}
              </>
            )}
          </span>
        </KpiCard>
        <KpiCard icon={PiggyBank} label={ta.kpiInvested} hint={`${ta.colAvgPrice}: ${formatUnitPrice(holding.avgCostPerPriceUnit)}`}>
          <span className="text-gray-800 dark:text-gray-100">{formatCurrency(holding.totalCostBasis)}</span>
        </KpiCard>
        <KpiCard icon={TrendingUp} label={ta.kpiUnrealized}>
          {holding.lastPrice > 0 && !closed ? (
            <PlValue value={holding.unrealizedPl} pct={holding.unrealizedPlPct} className="!text-2xl !font-bold" />
          ) : (
            <span className="text-gray-400 dark:text-gray-500">—</span>
          )}
        </KpiCard>
        <KpiCard icon={Coins} label={ta.kpiRealized}>
          <span className={plColorClass(holding.realizedPl)}>
            {holding.realizedPl > 0 ? '+' : ''}
            {formatCurrency(holding.realizedPl)}
          </span>
        </KpiCard>
      </div>

      {/* Rincian per kustodian — inti fitur: satu instrumen, banyak broker */}
      <section className="card-static !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">{ta.breakdownTitle}</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{ta.breakdownSubtitle}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <Th>{ta.colCustodian}</Th>
                <Th align="right">{ta.colBalance}</Th>
                <Th align="right">{ta.colAvgPrice}</Th>
                <Th align="right">{ta.colCostBasis}</Th>
                <Th align="right">{ta.kpiRealized}</Th>
              </tr>
            </thead>
            <tbody>
              {holding.positions.map((p) => {
                // Crypto: Unit total di KPI card di atas di-canon dari
                // catalog_items.asset_lot_size (bukan SUM transaksi), karena
                // qty per transaksi rawan salah/data eksperimen tidak
                // merepresentasikan kuantitas riil (pecahan mikro seperti
                // 0,00302599 BTC). Breakdown per-custodian belum punya
                // sumber unit yang sama-sama valid, jadi kolom Unit &
                // Avg Price per baris disembunyikan untuk crypto — hanya
                // cost basis & realized P/L (murni dari transaksi, tidak
                // butuh kuantitas) yang tetap ditampilkan per broker.
                const isCrypto = holding.assetClass === 'crypto';
                return (
                  <tr key={p.custodian} className="border-b border-gray-100 dark:border-gray-700/60 last:border-0">
                    <td className="px-4 py-3.5 font-medium text-gray-800 dark:text-gray-100">{p.custodian}</td>
                    <Td align="right">
                      {!isCrypto && p.quantity > 0 ? (
                        formatQuantity(p.quantity)
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </Td>
                    <Td align="right">
                      {!isCrypto && p.quantity > 0 ? formatUnitPrice(p.avgCost / holding.lotSize) : '—'}
                    </Td>
                    <Td align="right">{formatCurrency(p.costBasis)}</Td>
                    <td className="px-4 py-3.5 text-right">
                      {p.realizedPl !== 0 ? <PlValue value={p.realizedPl} /> : <span className="text-gray-400 dark:text-gray-500">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Riwayat transaksi — tiap baris menaut balik ke jurnalnya di buku besar */}
      <section className="card-static !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">{ta.historyTitle}</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{ta.historySubtitle}</p>
        </div>

        {holding.events.length === 0 ? (
          <EmptyState size="sm" icon={Wallet} title={ta.historyEmpty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <Th>{ta.colDate}</Th>
                  <Th>{ta.colEvent}</Th>
                  <Th>{ta.colCustodian}</Th>
                  <Th align="right">{ta.colQty}</Th>
                  <Th align="right">{ta.colAmount}</Th>
                  <Th align="right">{ta.kpiRealized}</Th>
                </tr>
              </thead>
              <tbody>
                {holding.events.map((e) => (
                  <tr key={e.transactionId} className="border-b border-gray-100 dark:border-gray-700/60 last:border-0">
                    <Td>{formatDateShort(e.date)}</Td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          e.eventType === 'buy'
                            ? 'border-blue-200 dark:border-blue-800/60 text-blue-600 dark:text-blue-300'
                            : e.eventType === 'sell'
                              ? 'border-emerald-200 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400'
                              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {eventLabel[e.eventType]}
                      </span>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-md truncate" title={e.description}>
                        {e.description}
                      </p>
                    </td>
                    <Td>{e.custodian}</Td>
                    <Td align="right">
                      {e.quantity > 0 ? (
                        <span title={e.quantityDerived ? ta.derivedQty : undefined}>
                          {formatQuantity(e.quantity)}
                          {e.quantityDerived && <span className="ml-1 text-gray-400 dark:text-gray-500">*</span>}
                        </span>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td align="right">{formatCurrency(e.amount)}</Td>
                    <td className="px-4 py-3.5 text-right">
                      {e.realizedPl !== 0 ? <PlValue value={e.realizedPl} /> : <span className="text-gray-400 dark:text-gray-500">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {holding.events.some((e) => e.quantityDerived) && (
          <p className="px-5 py-3 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700">
            * {ta.derivedQty}
          </p>
        )}
      </section>

      <p className="flex items-start gap-2 text-xs text-gray-400 dark:text-gray-500">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden />
        {ta.sourceNote}
      </p>

      <UpdatePriceModal
        holding={editingPrice ? holding : null}
        onClose={() => setEditingPrice(false)}
        onSave={updatePrice}
      />
    </div>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <Link
      href="/asset-console"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" aria-hidden />
      {label}
    </Link>
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
