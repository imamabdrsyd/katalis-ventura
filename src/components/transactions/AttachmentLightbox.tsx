'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TransactionAttachment } from '@/types';
import { formatFileSize } from '@/lib/storage/attachments';
import { useLanguage } from '@/context/LanguageContext';
import { useDialogA11y } from '@/hooks/useDialogA11y';
import {
  SignedAttachmentDownloadButton,
  SignedAttachmentImage,
  SignedAttachmentPdf,
  isPdfAttachment,
} from '@/components/transactions/SignedAttachmentViewers';

interface AttachmentLightboxProps {
  /** Daftar yang bisa dijelajah panah kiri/kanan — biasanya hasil filter yang sedang tampil. */
  attachments: TransactionAttachment[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Baris keterangan di bawah nama file (mis. tanggal & nama transaksi). */
  caption?: ReactNode;
}

/**
 * Penampil lampiran layar penuh untuk Galeri Lampiran.
 *
 * Beda dari pratinjau di TransactionDetailModal: di sana navigasi berputar dalam
 * satu transaksi, di sini dalam seluruh daftar galeri yang sedang difilter —
 * jadi panah kiri/kanan (dan tombol panah keyboard) melangkah antar transaksi.
 */
export function AttachmentLightbox({
  attachments,
  index,
  onIndexChange,
  onClose,
  caption,
}: AttachmentLightboxProps) {
  const { t } = useLanguage();
  const [scale, setScale] = useState(1);
  const panelRef = useDialogA11y(true, { onEscape: onClose });

  const current = attachments[index];
  const hasMultiple = attachments.length > 1;

  const go = useCallback(
    (delta: number) => {
      if (attachments.length === 0) return;
      onIndexChange((index + delta + attachments.length) % attachments.length);
    },
    [attachments.length, index, onIndexChange]
  );

  // Zoom selalu kembali normal saat pindah file — mewarisi zoom file sebelumnya
  // membuat gambar berikutnya tampak "rusak" saat pertama muncul.
  useEffect(() => setScale(1), [index]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [go]);

  if (!current || typeof document === 'undefined') return null;

  const isPdf = isPdfAttachment(current);

  return createPortal(
    <div
      ref={panelRef}
      tabIndex={-1}
      className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex flex-col outline-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t.transactionDetail.previewOf.replace('{filename}', current.filename)}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{current.filename}</p>
          <p className="text-xs text-white/60 truncate">
            {formatFileSize(current.size)}
            {caption && <span className="ml-2 text-white/50">· {caption}</span>}
            {hasMultiple && (
              <span className="ml-2 text-white/50">
                · {index + 1}/{attachments.length}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {!isPdf && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setScale((s) => Math.max(0.5, Number((s - 0.25).toFixed(2))));
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                title={t.transactionDetail.zoomOut}
                aria-label={t.transactionDetail.zoomOut}
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setScale(1);
                }}
                className="hidden sm:inline-flex h-10 px-3 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                title={t.transactionDetail.resetZoom}
              >
                <RotateCcw className="w-4 h-4" />
                {Math.round(scale * 100)}%
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setScale((s) => Math.min(3, Number((s + 0.25).toFixed(2))));
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                title={t.transactionDetail.zoomIn}
                aria-label={t.transactionDetail.zoomIn}
              >
                <ZoomIn className="w-5 h-5" />
              </button>
            </>
          )}
          <SignedAttachmentDownloadButton
            attachment={current}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            title={t.transactionDetail.downloadFile}
          >
            <Download className="w-5 h-5" />
          </SignedAttachmentDownloadButton>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            title={t.transactionDetail.closeAria}
            aria-label={t.transactionDetail.closeAria}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div
        className={`relative flex-1 min-h-0 px-4 pb-4 ${isPdf ? '' : 'overflow-auto'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur-sm hover:bg-black/70 hover:text-white transition-colors"
              title={t.transactionDetail.prevAttachment}
              aria-label={t.transactionDetail.prevAttachmentAria}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur-sm hover:bg-black/70 hover:text-white transition-colors"
              title={t.transactionDetail.nextAttachment}
              aria-label={t.transactionDetail.nextAttachmentAria}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
        {isPdf ? (
          <div className="h-full min-h-[60vh] overflow-hidden rounded-lg bg-white shadow-2xl">
            <SignedAttachmentPdf
              attachment={current}
              title={t.transactionDetail.previewOf.replace('{filename}', current.filename)}
              className="h-full w-full"
            />
          </div>
        ) : (
          <div className="min-h-full flex items-center justify-center">
            <SignedAttachmentImage
              attachment={current}
              alt={current.filename}
              className="max-w-full max-h-full rounded-lg shadow-2xl select-none"
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'center',
                transition: 'transform 120ms ease-out',
              }}
              draggable={false}
            />
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
