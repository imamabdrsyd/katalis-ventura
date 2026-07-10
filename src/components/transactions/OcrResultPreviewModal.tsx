'use client';

import { useMemo, useState } from 'react';
import {
  ScanText,
  FileText,
  Layers,
  X,
  Receipt,
  Calendar,
  Store,
  AlertCircle,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Percent,
  Tag as TagIcon,
  ConciergeBell,
} from 'lucide-react';
import type { Account } from '@/types';
import type { OcrResult, OcrCharge } from '@/lib/ocr/types';
import {
  buildMultiLineFromOcr,
  shouldUseMultiLine,
} from '@/lib/ocr/multiLineBuilder';
import type { MultiLineFormData } from '@/components/transactions/MultiLineJournalForm';
import { formatCurrency, formatDate } from '@/lib/utils';

interface OcrResultPreviewPanelProps {
  result: OcrResult | null;
  accounts: Account[];
  onChooseSingle: (result: OcrResult) => void;
  onChooseMultiLine: (data: MultiLineFormData) => void;
  onClose: () => void;
}

const CATEGORY_LABEL_ID: Record<string, string> = {
  EARN: 'Pendapatan',
  OPEX: 'Beban Operasional',
  VAR: 'HPP / Variabel',
  CAPEX: 'Belanja Modal',
  TAX: 'Pajak',
  FIN: 'Pembiayaan',
};

const CHARGE_META: Record<
  OcrCharge['type'],
  { label: string; tint: string; icon: typeof Percent }
> = {
  tax: {
    label: 'Pajak',
    tint: 'text-amber-600 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-900/15 ring-amber-200/60 dark:ring-amber-700/40',
    icon: Percent,
  },
  service: {
    label: 'Servis',
    tint: 'text-violet-600 dark:text-violet-300 bg-violet-50/70 dark:bg-violet-900/15 ring-violet-200/60 dark:ring-violet-700/40',
    icon: ConciergeBell,
  },
  discount: {
    label: 'Diskon',
    tint: 'text-emerald-600 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-900/15 ring-emerald-200/60 dark:ring-emerald-700/40',
    icon: TagIcon,
  },
  other: {
    label: 'Lainnya',
    tint: 'text-slate-600 dark:text-slate-300 bg-slate-50/80 dark:bg-slate-800/40 ring-slate-200/60 dark:ring-slate-700/40',
    icon: TagIcon,
  },
};

/**
 * Sub-panel hasil OCR yang nempel di kiri modal transaksi via prop `sidePanel`
 * di komponen Modal. Bisa di-collapse jadi rail tipis vertikal untuk
 * memberi ruang lebih ke form di sebelahnya.
 */
export function OcrResultPreviewModal({
  result,
  accounts,
  onChooseSingle,
  onChooseMultiLine,
  onClose,
}: OcrResultPreviewPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const multiLineEnabled = useMemo(
    () => (result ? shouldUseMultiLine(result) : false),
    [result]
  );

  if (!result) return null;

  const handleChooseMultiLine = () => {
    if (accounts.length === 0) return;
    const { data } = buildMultiLineFromOcr(result, accounts);
    onChooseMultiLine(data);
  };

  // Collapsed rail
  if (collapsed) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl ring-1 ring-gray-200/70 dark:ring-gray-700/70 flex flex-col items-center py-3 px-2 gap-3 w-11 max-h-modal">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
          title="Buka preview hasil OCR"
          aria-label="Buka preview hasil OCR"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="rotate-180 [writing-mode:vertical-rl] text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 flex items-center gap-2 py-1">
          <ScanText className="w-3.5 h-3.5" />
          Hasil Scan
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-auto p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          title="Tutup preview"
          aria-label="Tutup preview"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const { parsed } = result;
  const items = parsed.line_items ?? [];
  const charges = parsed.charges ?? [];
  const itemsSubtotal = items.reduce((sum, it) => sum + it.amount, 0);
  const hasAnyDetail = items.length > 0 || charges.length > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl ring-1 ring-gray-200/70 dark:ring-gray-700/70 flex flex-col w-[320px] max-h-modal overflow-hidden">
      {/* Header */}
      <div className="relative flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700/60 shrink-0 bg-gradient-to-r from-indigo-50 via-white to-indigo-50/30 dark:from-indigo-950/40 dark:via-gray-800 dark:to-indigo-950/20">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
            <ScanText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold text-gray-900 dark:text-gray-50 leading-tight">
              Hasil Scan Struk
            </h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
              Pilih cara pencatatan di bawah
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="p-1.5 rounded-md hover:bg-white/80 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
            title="Sembunyikan panel"
            aria-label="Sembunyikan panel"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white/80 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
            title="Tutup preview"
            aria-label="Tutup preview"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1 min-h-0">
        {/* Hero total card */}
        {typeof parsed.total === 'number' && (
          <div className="px-4 pt-4 pb-3">
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 dark:from-indigo-600 dark:to-indigo-900 p-3.5 text-white shadow-md shadow-indigo-500/20">
              <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10 blur-xl" />
              <div className="relative flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-indigo-100/80 font-medium flex items-center gap-1">
                    <Receipt className="w-3 h-3" />
                    Total
                  </div>
                  <CopyableText
                    value={String(parsed.total)}
                    display={formatCurrency(parsed.total, parsed.currency_code ?? 'IDR')}
                    className="text-lg font-bold text-white tracking-tight mt-0.5"
                    copyButtonClass="text-indigo-200 hover:text-white"
                  />
                </div>
                {parsed.category && CATEGORY_LABEL_ID[parsed.category] && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-sm text-[10px] font-medium text-white ring-1 ring-white/20 shrink-0">
                    <Sparkles className="w-2.5 h-2.5" />
                    {CATEGORY_LABEL_ID[parsed.category]}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Vendor & Date — compact two-column */}
        {(parsed.vendor || parsed.date) && (
          <div className="px-4 grid grid-cols-2 gap-2">
            {parsed.vendor && (
              <MetaCell icon={Store} label="Vendor" value={parsed.vendor} />
            )}
            {parsed.date && (
              <MetaCell
                icon={Calendar}
                label="Tanggal"
                value={parsed.date}
                display={formatDate(parsed.date)}
              />
            )}
          </div>
        )}

        {/* Divider */}
        {hasAnyDetail && (
          <div className="mx-4 mt-3 mb-2 border-t border-dashed border-gray-200 dark:border-gray-700/60" />
        )}

        {/* Items */}
        {items.length > 0 && (
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 font-semibold">
                  Item
                </span>
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                  {items.length}
                </span>
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
                {formatCurrency(itemsSubtotal, parsed.currency_code ?? 'IDR')}
              </div>
            </div>
            <ul className="space-y-1">
              {items.map((item, idx) => {
                const hasMeta = !!item.quantity || !!item.unit_price;
                return (
                  <li
                    key={idx}
                    className="group flex items-start justify-between gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <CopyableText
                        value={item.description}
                        className="text-[12px] font-medium text-gray-800 dark:text-gray-100 leading-tight"
                      />
                      {hasMeta && (
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 select-text mt-0.5 tabular-nums">
                          {item.quantity ? (
                            <>
                              <span className="font-medium text-gray-600 dark:text-gray-300">
                                {item.quantity}
                              </span>
                              <span className="mx-1 text-gray-400">×</span>
                            </>
                          ) : null}
                          {item.unit_price
                            ? formatCurrency(item.unit_price, parsed.currency_code ?? 'IDR')
                            : null}
                        </div>
                      )}
                    </div>
                    <CopyableText
                      value={String(item.amount)}
                      display={formatCurrency(item.amount, parsed.currency_code ?? 'IDR')}
                      className="text-[12px] font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap tabular-nums"
                      alignEnd
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Charges */}
        {charges.length > 0 && (
          <div className="px-4 pb-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 font-semibold mb-2">
              Biaya Tambahan
            </div>
            <ul className="space-y-1">
              {charges.map((charge, idx) => {
                const meta = CHARGE_META[charge.type];
                const Icon = meta.icon;
                const isDiscount = charge.type === 'discount';
                return (
                  <li
                    key={idx}
                    className="group flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span
                        className={`inline-flex items-center justify-center w-5 h-5 rounded-md ring-1 ${meta.tint}`}
                      >
                        <Icon className="w-3 h-3" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <CopyableText
                          value={charge.label}
                          className="text-[12px] font-medium text-gray-800 dark:text-gray-100 leading-tight"
                        />
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                          {meta.label}
                        </div>
                      </div>
                    </div>
                    <CopyableText
                      value={String(Math.abs(charge.amount))}
                      display={`${isDiscount ? '−' : ''}${formatCurrency(Math.abs(charge.amount), parsed.currency_code ?? 'IDR')}`}
                      className={`text-[12px] font-semibold whitespace-nowrap tabular-nums ${
                        isDiscount
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-gray-800 dark:text-gray-100'
                      }`}
                      alignEnd
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Empty state */}
        {!hasAnyDetail && (
          <div className="px-4 pb-3">
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-900/15 ring-1 ring-amber-200/60 dark:ring-amber-700/30">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-[11px] leading-snug text-amber-700 dark:text-amber-200">
                Tidak ada item terdeteksi. Hanya total{parsed.total ? ' dan info dasar' : ''}{' '}
                yang dipakai untuk prefill form.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-900/30 space-y-2 shrink-0">
        <button
          type="button"
          onClick={handleChooseMultiLine}
          disabled={!multiLineEnabled || accounts.length === 0}
          className="group w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 active:from-indigo-700 active:to-indigo-800 text-white text-[12px] font-semibold shadow-sm shadow-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all"
          title={
            !multiLineEnabled
              ? 'Hasil scan tidak punya cukup item untuk jurnal multi-baris'
              : accounts.length === 0
                ? 'Daftar akun belum siap'
                : undefined
          }
        >
          <Layers className="w-3.5 h-3.5" />
          Jurnal Multi-Baris
          {multiLineEnabled && items.length > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-white/20 text-[10px] font-bold tabular-nums">
              {items.length + charges.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => onChooseSingle(result)}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-[12px] font-medium transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
          Isi Form Tunggal
        </button>
        {!multiLineEnabled && items.length > 0 && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center leading-snug pt-0.5">
            Cuma {items.length} item terdeteksi — multi-baris butuh ≥2 item atau 1 item + 1 biaya.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Compact meta cell untuk vendor/tanggal — 2-column grid layout.
 */
function MetaCell({
  icon: Icon,
  label,
  value,
  display,
}: {
  icon: typeof Store;
  label: string;
  value: string;
  display?: string;
}) {
  return (
    <div className="group min-w-0">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 font-medium">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="mt-0.5">
        <CopyableText
          value={value}
          display={display}
          className="text-[12px] font-medium text-gray-800 dark:text-gray-100 leading-tight truncate"
        />
      </div>
    </div>
  );
}

/**
 * Teks yang selalu bisa diseleksi user, dengan tombol copy kecil yang muncul
 * saat parent <li>/<div className="group"> di-hover.
 */
function CopyableText({
  value,
  display,
  className,
  alignEnd,
  copyButtonClass,
}: {
  value: string;
  display?: string;
  className?: string;
  alignEnd?: boolean;
  copyButtonClass?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard API unavailable */
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1 ${alignEnd ? 'justify-end' : ''} max-w-full`}
    >
      <span className={`select-text cursor-text truncate ${className ?? ''}`}>
        {display ?? value}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className={`opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity p-0.5 rounded shrink-0 ${
          copyButtonClass ?? 'text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400'
        }`}
        title={copied ? 'Tersalin!' : 'Salin'}
        aria-label="Salin teks"
      >
        {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
      </button>
    </span>
  );
}
