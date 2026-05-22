'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ScanText, FileText, Layers, X, Tag, Receipt, Calendar, Store, AlertCircle, Copy, Check } from 'lucide-react';
import type { Account } from '@/types';
import type { OcrResult } from '@/lib/ocr/types';
import {
  buildMultiLineFromOcr,
  shouldUseMultiLine,
} from '@/lib/ocr/multiLineBuilder';
import type { MultiLineFormData } from '@/components/transactions/MultiLineJournalForm';
import { formatCurrency } from '@/lib/utils';
import { formatDate } from '@/lib/utils';

interface OcrResultPreviewModalProps {
  /**
   * Hasil OCR yang akan ditampilkan. Kalau null, panel tidak dirender.
   */
  result: OcrResult | null;
  accounts: Account[];
  /**
   * User memilih "Buat sebagai 1 transaksi" — parent harus apply result ke form yang sedang aktif.
   */
  onChooseSingle: (result: OcrResult) => void;
  /**
   * User memilih "Buat sebagai jurnal multi-baris" — parent harus switch ke MultiLineJournalForm.
   */
  onChooseMultiLine: (data: MultiLineFormData) => void;
  onClose: () => void;
}

/**
 * Panel hasil OCR. Tampil sebagai floating card di kiri layar (di samping modal transaksi
 * di tengah/kanan) supaya user bisa banding-bandingkan hasil scan ↔ form input.
 *
 * User punya 2 pilihan:
 *  1. "Buat sebagai 1 transaksi"        → onChooseSingle (prefill form quick/full)
 *  2. "Buat sebagai jurnal multi-baris" → onChooseMultiLine (switch ke MultiLineJournalForm)
 *
 * Tombol multi-line di-disable kalau hasil scan tidak punya cukup data (line_items < 2 &&
 * tidak ada item+charge).
 */
export function OcrResultPreviewModal({
  result,
  accounts,
  onChooseSingle,
  onChooseMultiLine,
  onClose,
}: OcrResultPreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (result) {
      const raf = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setIsVisible(false);
  }, [result]);

  const multiLineEnabled = useMemo(
    () => (result ? shouldUseMultiLine(result) : false),
    [result]
  );

  const handleChooseMultiLine = () => {
    if (!result || accounts.length === 0) return;
    const { data } = buildMultiLineFromOcr(result, accounts);
    onChooseMultiLine(data);
  };

  if (!mounted || !result) return null;


  const { parsed } = result;
  const items = parsed.line_items ?? [];
  const charges = parsed.charges ?? [];

  const itemsSubtotal = items.reduce((sum, it) => sum + it.amount, 0);

  const panel = (
    <div
      className={`fixed top-1/2 -translate-y-1/2 left-6 z-[60] w-[360px] max-h-[85vh] hidden lg:flex flex-col transition-all duration-200 ease-out ${
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
      }`}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-indigo-50/60 dark:bg-indigo-900/20">
          <div className="flex items-center gap-2">
            <ScanText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              Hasil Scan Struk
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-white/60 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            title="Tutup preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 overflow-y-auto flex-1 min-h-0 space-y-3 text-sm">
          {/* Vendor & Date */}
          <div className="space-y-1.5">
            {parsed.vendor && (
              <div className="group flex items-start gap-2">
                <Store className="w-3.5 h-3.5 mt-0.5 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    Vendor
                  </div>
                  <CopyableText
                    value={parsed.vendor}
                    className="font-medium text-gray-800 dark:text-gray-100"
                  />
                </div>
              </div>
            )}
            {parsed.date && (
              <div className="group flex items-start gap-2">
                <Calendar className="w-3.5 h-3.5 mt-0.5 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    Tanggal
                  </div>
                  <CopyableText
                    value={parsed.date}
                    display={formatDate(parsed.date)}
                    className="font-medium text-gray-800 dark:text-gray-100"
                  />
                </div>
              </div>
            )}
            {typeof parsed.total === 'number' && (
              <div className="group flex items-start gap-2">
                <Receipt className="w-3.5 h-3.5 mt-0.5 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    Total
                  </div>
                  <CopyableText
                    value={String(parsed.total)}
                    display={formatCurrency(parsed.total, parsed.currency_code ?? 'IDR')}
                    className="font-semibold text-gray-800 dark:text-gray-100"
                  />
                </div>
              </div>
            )}
            {parsed.category && (
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Kategori
                </span>
                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-300">
                  {parsed.category}
                </span>
              </div>
            )}
          </div>

          {/* Items */}
          {items.length > 0 && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-medium">
                  Item Terdeteksi ({items.length})
                </div>
                <div className="text-[11px] text-gray-400 dark:text-gray-500">
                  Subtotal {formatCurrency(itemsSubtotal, parsed.currency_code ?? 'IDR')}
                </div>
              </div>
              <ul className="space-y-1">
                {items.map((item, idx) => (
                  <li
                    key={idx}
                    className="group flex items-start justify-between gap-2 px-2 py-1.5 rounded-md bg-gray-50 dark:bg-gray-700/40"
                  >
                    <div className="flex-1 min-w-0">
                      <CopyableText
                        value={item.description}
                        className="text-xs font-medium text-gray-800 dark:text-gray-100"
                      />
                      {(item.quantity || item.unit_price) && (
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 select-text">
                          {item.quantity ?? '?'} × {' '}
                          {item.unit_price
                            ? formatCurrency(item.unit_price, parsed.currency_code ?? 'IDR')
                            : '?'}
                        </div>
                      )}
                    </div>
                    <CopyableText
                      value={String(item.amount)}
                      display={formatCurrency(item.amount, parsed.currency_code ?? 'IDR')}
                      className="text-xs font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap"
                      alignEnd
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Charges */}
          {charges.length > 0 && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-medium mb-1.5">
                Biaya Tambahan
              </div>
              <ul className="space-y-1">
                {charges.map((charge, idx) => (
                  <li
                    key={idx}
                    className="group flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-amber-50/60 dark:bg-amber-900/10"
                  >
                    <div className="flex-1 min-w-0">
                      <CopyableText
                        value={charge.label}
                        className="text-xs font-medium text-gray-800 dark:text-gray-100"
                      />
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 capitalize">
                        {charge.type}
                      </div>
                    </div>
                    <CopyableText
                      value={String(Math.abs(charge.amount))}
                      display={`${charge.type === 'discount' ? '−' : ''}${formatCurrency(Math.abs(charge.amount), parsed.currency_code ?? 'IDR')}`}
                      className={`text-xs font-semibold whitespace-nowrap ${
                        charge.type === 'discount'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-gray-700 dark:text-gray-200'
                      }`}
                      alignEnd
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* No items detected */}
          {items.length === 0 && charges.length === 0 && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-amber-500 shrink-0" />
              <span>
                Tidak ada item terdeteksi. Hanya total {parsed.total ? 'dan info dasar' : ''}
                {' '}yang akan dipakai untuk prefill form.
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 space-y-2">
          <button
            type="button"
            onClick={handleChooseMultiLine}
            disabled={!multiLineEnabled || accounts.length === 0}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={
              !multiLineEnabled
                ? 'Hasil scan tidak punya cukup item untuk jurnal multi-baris'
                : accounts.length === 0
                  ? 'Daftar akun belum siap'
                  : undefined
            }
          >
            <Layers className="w-3.5 h-3.5" />
            Buat sebagai Jurnal Multi-Baris
          </button>
          <button
            type="button"
            onClick={() => onChooseSingle(result)}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-medium transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Isi Form Transaksi Tunggal
          </button>
          {!multiLineEnabled && items.length > 0 && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center leading-tight">
              Hanya {items.length} item terdeteksi — multi-baris butuh minimal 2 item atau
              1 item + 1 biaya tambahan.
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}

/**
 * Teks yang selalu bisa diseleksi user, dengan tombol copy kecil di kanan
 * yang muncul saat parent <li>/<div className="group"> di-hover. Tombol
 * berubah jadi check icon 1.5s setelah klik.
 */
function CopyableText({
  value,
  display,
  className,
  alignEnd,
}: {
  value: string;
  display?: string;
  className?: string;
  alignEnd?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* swallow — clipboard API may be unavailable in older contexts */
    }
  };

  return (
    <div className={`inline-flex items-center gap-1.5 ${alignEnd ? 'justify-end' : ''}`}>
      <span className={`select-text cursor-text ${className ?? ''}`}>
        {display ?? value}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 shrink-0"
        title={copied ? 'Tersalin!' : 'Salin'}
        aria-label="Salin teks"
      >
        {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
}
