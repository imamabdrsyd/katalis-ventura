'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { TransactionAttachment } from '@/types';
import { useDeliverableAttachmentUrl, triggerAttachmentDownload } from '@/lib/storage/signedUrl';
import { useLanguage } from '@/context/LanguageContext';

/**
 * Primitif render lampiran yang butuh signed URL.
 *
 * Diekstrak dari TransactionDetailModal supaya dipakai bersama oleh modal detail
 * transaksi DAN halaman Galeri Lampiran (/transactions/attachments) — keduanya
 * menampilkan file yang sama (Cloudinary `authenticated` / legacy bucket privat),
 * jadi logika resolve URL-nya harus satu tempat saja.
 */

export function isPdfAttachment(attachment: Pick<TransactionAttachment, 'mime_type' | 'filename'>): boolean {
  const mimeType = attachment.mime_type?.toLowerCase() ?? '';
  const filename = attachment.filename?.toLowerCase() ?? '';
  return mimeType.includes('pdf') || filename.endsWith('.pdf');
}

function withPdfViewerParams(url: string): string {
  if (url.includes('#')) return url;
  return `${url}#toolbar=1&navpanes=0&view=FitH`;
}

export function PdfViewerFrame({
  url,
  title,
  ...rest
}: { url: string; title: string } & React.IframeHTMLAttributes<HTMLIFrameElement>) {
  return (
    <iframe
      {...rest}
      src={withPdfViewerParams(url)}
      title={title}
      loading="lazy"
    />
  );
}

/** Indikator loading lampiran (saat menunggu signed URL + file termuat). */
export function AttachmentLoading({ dark, label }: { dark?: boolean; label?: string }) {
  const { t } = useLanguage();
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2">
      <Loader2 className={`h-7 w-7 animate-spin ${dark ? 'text-white/80' : 'text-indigo-500'}`} />
      <span className={`text-[11px] font-medium ${dark ? 'text-white/60' : 'text-gray-400 dark:text-gray-500'}`}>
        {label ?? t.transactionDetail.loadingGeneric}
      </span>
    </div>
  );
}

/**
 * PDF iframe pembungkus yang pakai signed URL untuk src.
 */
export function SignedAttachmentPdf({
  attachment,
  title,
  className,
  ...rest
}: { attachment: TransactionAttachment; title: string } & React.IframeHTMLAttributes<HTMLIFrameElement>) {
  const { t } = useLanguage();
  const url = useDeliverableAttachmentUrl(attachment);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => setLoaded(false), [url]);
  return (
    <div className="relative h-full w-full">
      {url && (
        <PdfViewerFrame
          {...rest}
          url={url}
          title={title}
          onLoad={() => setLoaded(true)}
          className={`${className ?? ''} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {(!url || !loaded) && (
        <div className="absolute inset-0">
          <AttachmentLoading dark label={t.transactionDetail.loadingPdf} />
        </div>
      )}
    </div>
  );
}

/**
 * Tombol unduh lampiran — resolve signed URL lalu trigger download (bukan buka
 * di tab browser), supaya tidak perlu mengandalkan URL publik.
 */
export function SignedAttachmentDownloadButton({
  attachment,
  children,
  className,
  title,
}: {
  attachment: TransactionAttachment;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const url = useDeliverableAttachmentUrl(attachment);
  const [downloading, setDownloading] = useState(false);
  const ready = !!url;
  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ready || downloading) return;
    setDownloading(true);
    try {
      await triggerAttachmentDownload(attachment);
    } catch {
      // gagal unduh — diabaikan
    } finally {
      setDownloading(false);
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!ready || downloading}
      className={className}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

/**
 * Image pembungkus yang pakai signed URL untuk src.
 */
export function SignedAttachmentImage({
  attachment,
  alt,
  className,
  ...rest
}: { attachment: TransactionAttachment; alt: string } & React.ImgHTMLAttributes<HTMLImageElement>) {
  const { t } = useLanguage();
  const url = useDeliverableAttachmentUrl(attachment);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [url]);
  return (
    <div className={`relative flex items-center justify-center ${loaded ? '' : 'min-h-[40vh] min-w-[260px]'}`}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          {...rest}
          ref={imgRef}
          src={url}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          className={`${className ?? ''} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {(!url || !loaded) && (
        <div className="absolute inset-0">
          <AttachmentLoading dark label={t.transactionDetail.loadingImage} />
        </div>
      )}
    </div>
  );
}
