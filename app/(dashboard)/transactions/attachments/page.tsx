'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  FileText,
  Images,
  Maximize2,
  Paperclip,
  ScanText,
  Search,
  X,
} from 'lucide-react';
import { useAttachmentGallery, type AttachmentKind, type GalleryAttachment } from '@/hooks/useAttachmentGallery';
import { useLanguage } from '@/context/LanguageContext';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { EmptyState } from '@/components/ui/EmptyState';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { AttachmentLightbox } from '@/components/transactions/AttachmentLightbox';
import { SignedAttachmentDownloadButton } from '@/components/transactions/SignedAttachmentViewers';
import { useDeliverableAttachmentUrl } from '@/lib/storage/signedUrl';
import { formatFileSize } from '@/lib/storage/attachments';
import { formatDateShort } from '@/lib/utils';

/** Berapa kartu yang dirender sekaligus sebelum tombol "Muat lebih banyak". */
const PAGE_SIZE = 48;

export default function AttachmentGalleryPage() {
  const { t } = useLanguage();
  const { items, counts, kind, setKind, search, setSearch, loading, error } = useAttachmentGallery();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  // Ganti tab / ubah pencarian = daftar baru: balikkan jendela render ke awal,
  // kalau tidak user bisa mendarat di "halaman 5" dari daftar yang isinya 3.
  // Indeks pratinjau ikut dilepas — nomornya menunjuk daftar yang sudah tidak ada.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setPreviewIndex(null);
  }, [kind, search]);

  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);
  const previewAttachments = useMemo(() => items.map((item) => item.attachment), [items]);

  const tabOptions = [
    {
      value: 'image' as AttachmentKind,
      label: (
        <>
          {t.attachmentGallery.tabImages}
          <CountChip value={counts.image} />
        </>
      ),
      icon: <Images className="w-4 h-4" />,
    },
    {
      value: 'file' as AttachmentKind,
      label: (
        <>
          {t.attachmentGallery.tabFiles}
          <CountChip value={counts.file} />
        </>
      ),
      icon: <FileText className="w-4 h-4" />,
    },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/transactions"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.attachmentGallery.backToTransactions}
        </Link>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
          <Paperclip className="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
          {t.attachmentGallery.title}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
          {t.attachmentGallery.subtitle}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 dark:border-gray-700/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_24px_rgba(0,0,0,0.04)] p-5">
        {/* Tab gambar/file + pencarian */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <SegmentedToggle
            options={tabOptions}
            value={kind}
            onChange={setKind}
            ariaLabel={t.attachmentGallery.title}
          />
          <div className="relative sm:ml-auto sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.attachmentGallery.searchPlaceholder}
              aria-label={t.attachmentGallery.searchPlaceholder}
              className="input-search pl-10 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                title={t.attachmentGallery.clearSearch}
                aria-label={t.attachmentGallery.clearSearch}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <GallerySkeleton kind={kind} />
        ) : items.length === 0 ? (
          <GalleryEmptyState kind={kind} hasSearch={search.trim().length > 0} hasAny={counts.total > 0} />
        ) : (
          <>
            <div
              className={
                kind === 'image'
                  ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
                  : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3'
              }
            >
              {visibleItems.map((item, index) =>
                kind === 'image' ? (
                  <ImageCard key={item.key} item={item} onOpen={() => setPreviewIndex(index)} />
                ) : (
                  <FileCard key={item.key} item={item} onOpen={() => setPreviewIndex(index)} />
                )
              )}
            </div>

            <div className="flex flex-col items-center gap-3 mt-6">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {t.attachmentGallery.showingCount(visibleItems.length, items.length)}
              </p>
              {visibleItems.length < items.length && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="btn-ghost"
                >
                  {t.attachmentGallery.loadMore}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {previewIndex !== null && items[previewIndex] && (
        <AttachmentLightbox
          attachments={previewAttachments}
          index={previewIndex}
          onIndexChange={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
          caption={`${formatDateShort(items[previewIndex].transaction.date)} · ${items[previewIndex].transaction.name}`}
        />
      )}
    </div>
  );
}

function CountChip({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold bg-gray-200/80 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300">
      {value}
    </span>
  );
}

/**
 * Kartu satu lampiran gambar: thumbnail + keterangan transaksi asalnya.
 *
 * Thumbnail baru di-mount saat kartunya mendekati viewport (lihat useInView) —
 * setiap thumbnail perlu satu permintaan tanda tangan ke server, jadi galeri
 * ratusan file tidak boleh menembakkan semuanya sekaligus saat halaman dibuka.
 */
function ImageCard({ item, onOpen }: { item: GalleryAttachment; onOpen: () => void }) {
  const { t } = useLanguage();
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div ref={ref} className="group flex flex-col gap-2">
      <button
        type="button"
        onClick={onOpen}
        className="relative aspect-square w-full overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
        title={item.attachment.filename}
        aria-label={t.transactionDetail.viewOf.replace('{filename}', item.attachment.filename)}
      >
        {inView ? <Thumbnail item={item} /> : <div className="h-full w-full animate-pulse bg-gray-100 dark:bg-gray-800" />}
        <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity">
          <Maximize2 className="w-6 h-6 text-white drop-shadow-lg" />
        </span>
        {item.attachment.source === 'ocr' && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-white/90 text-indigo-600 dark:bg-gray-900/85 dark:text-indigo-300">
            <ScanText className="w-3 h-3" />
            {t.attachmentGallery.scanned}
          </span>
        )}
      </button>
      <CardCaption item={item} />
    </div>
  );
}

function Thumbnail({ item }: { item: GalleryAttachment }) {
  const url = useDeliverableAttachmentUrl(item.attachment);
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={item.attachment.filename}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {(!url || !loaded) && <div className="absolute inset-0 animate-pulse bg-gray-100 dark:bg-gray-800" />}
    </>
  );
}

/** Kartu satu lampiran non-gambar (PDF dll): ikon + nama file + aksi. */
function FileCard({ item, onOpen }: { item: GalleryAttachment; onOpen: () => void }) {
  const { t } = useLanguage();

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
        <FileText className="w-5 h-5 text-red-500 dark:text-red-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate" title={item.attachment.filename}>
          {item.attachment.filename}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(item.attachment.size)}</p>
        <CardCaption item={item} className="mt-1" />
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-indigo-500 dark:hover:bg-gray-700 dark:hover:text-indigo-400 transition-colors"
          title={t.attachmentGallery.openPreview}
          aria-label={t.transactionDetail.previewOf.replace('{filename}', item.attachment.filename)}
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <SignedAttachmentDownloadButton
          attachment={item.attachment}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-gray-700 dark:hover:text-indigo-400 transition-colors"
          title={t.attachmentGallery.download}
        >
          <Download className="w-4 h-4" />
        </SignedAttachmentDownloadButton>
      </div>
    </div>
  );
}

/** Keterangan asal lampiran — tanggal, kategori, dan tautan ke transaksinya. */
function CardCaption({ item, className = '' }: { item: GalleryAttachment; className?: string }) {
  const { t } = useLanguage();
  const { transaction } = item;

  return (
    <div className={`min-w-0 ${className}`}>
      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex-shrink-0">{formatDateShort(transaction.date)}</span>
        <CategoryBadge category={transaction.category} size="xs" className="flex-shrink-0" />
      </div>
      <Link
        href={`/transactions?detail=${transaction.id}`}
        className="block mt-0.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-500 dark:hover:text-indigo-400 truncate transition-colors"
        title={`${t.attachmentGallery.viewTransaction}: ${transaction.name}`}
      >
        {transaction.name || transaction.description}
      </Link>
    </div>
  );
}

function GalleryEmptyState({
  kind,
  hasSearch,
  hasAny,
}: {
  kind: AttachmentKind;
  hasSearch: boolean;
  hasAny: boolean;
}) {
  const { t } = useLanguage();

  if (hasSearch) {
    return (
      <EmptyState
        icon={Search}
        title={t.attachmentGallery.noResultsTitle}
        description={t.attachmentGallery.noResultsDescription}
      />
    );
  }
  if (!hasAny) {
    return (
      <EmptyState
        icon={Paperclip}
        title={t.attachmentGallery.emptyTitle}
        description={t.attachmentGallery.emptyDescription}
      />
    );
  }
  return (
    <EmptyState
      icon={kind === 'image' ? Images : FileText}
      title={kind === 'image' ? t.attachmentGallery.emptyImagesTitle : t.attachmentGallery.emptyFilesTitle}
      description={
        kind === 'image'
          ? t.attachmentGallery.emptyImagesDescription
          : t.attachmentGallery.emptyFilesDescription
      }
    />
  );
}

function GallerySkeleton({ kind }: { kind: AttachmentKind }) {
  if (kind === 'image') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="aspect-square rounded-xl bg-gray-100 dark:bg-gray-700 animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-20 rounded-xl bg-gray-100 dark:bg-gray-700 animate-pulse" />
      ))}
    </div>
  );
}

/**
 * Sekali-jalan: true begitu elemennya pernah mendekati viewport, lalu berhenti
 * mengamati. Dipakai untuk menunda resolve signed URL thumbnail sampai benar-
 * benar mau dilihat — dan sengaja tidak pernah kembali false supaya gambar yang
 * sudah tampil tidak dilepas saat di-scroll lewat.
 */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView]);

  return { ref, inView };
}
