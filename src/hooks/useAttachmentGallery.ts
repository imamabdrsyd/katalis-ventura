'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBusinessContext } from '@/context/BusinessContext';
import {
  getTransactionsWithAttachments,
  type TransactionAttachmentRow,
} from '@/lib/api/transactions';
import { isImageType } from '@/lib/storage/attachments';
import type { TransactionAttachment } from '@/types';

export type AttachmentKind = 'image' | 'file';

export interface GalleryAttachment {
  /** Kunci render unik — path bisa kosong pada lampiran legacy, jadi indeks ikut. */
  key: string;
  attachment: TransactionAttachment;
  transaction: TransactionAttachmentRow;
  kind: AttachmentKind;
}

const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i;

/**
 * Tentukan sebuah lampiran masuk tab "Gambar" atau tab "File".
 *
 * `mime_type` diutamakan, tapi tidak bisa dipercaya sendirian: lampiran lama
 * (dan sebagian hasil OCR) tersimpan dengan mime kosong atau generik. Ekstensi
 * nama file jadi cadangan pertama, `resource_type` Cloudinary cadangan terakhir
 * — PDF di sana selalu `raw`, gambar selalu `image`.
 */
export function getAttachmentKind(att: TransactionAttachment): AttachmentKind {
  const mime = att.mime_type?.toLowerCase() ?? '';
  if (mime.includes('pdf')) return 'file';
  if (mime && isImageType(mime)) return 'image';
  if (IMAGE_EXTENSION.test(att.filename ?? '')) return 'image';
  if (!mime && att.resource_type === 'image') return 'image';
  return 'file';
}

/** Lampiran satu transaksi: format multi-file baru, dengan fallback single legacy. */
function readAttachments(tx: TransactionAttachmentRow): TransactionAttachment[] {
  const list = tx.meta?.attachments;
  if (Array.isArray(list) && list.length > 0) return list;
  return tx.meta?.attachment ? [tx.meta.attachment] : [];
}

/**
 * State halaman Galeri Lampiran: menarik semua transaksi yang punya lampiran
 * pada bisnis aktif, lalu meratakannya jadi daftar per-file.
 *
 * Urutannya mengikuti TANGGAL TRANSAKSI (terbaru dulu), bukan waktu unggah —
 * galeri ini dibaca sebagai arsip bukti transaksi, jadi nota bulan lalu yang
 * baru diunggah hari ini tetap duduk di bulan lalu.
 */
export function useAttachmentGallery() {
  const { activeBusinessId, loading: businessLoading } = useBusinessContext();
  const [rows, setRows] = useState<TransactionAttachmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<AttachmentKind>('image');
  const [search, setSearch] = useState('');

  const fetchAttachments = useCallback(async () => {
    if (!activeBusinessId) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await getTransactionsWithAttachments(activeBusinessId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat lampiran');
    } finally {
      setLoading(false);
    }
  }, [activeBusinessId]);

  useEffect(() => {
    if (businessLoading) return;
    if (!activeBusinessId) {
      setRows([]);
      setLoading(false);
      return;
    }
    fetchAttachments();
  }, [activeBusinessId, businessLoading, fetchAttachments]);

  const allItems = useMemo<GalleryAttachment[]>(
    () =>
      rows.flatMap((tx) =>
        readAttachments(tx).map((attachment, index) => ({
          key: `${tx.id}:${index}:${attachment.path || attachment.filename}`,
          attachment,
          transaction: tx,
          kind: getAttachmentKind(attachment),
        }))
      ),
    [rows]
  );

  const counts = useMemo(
    () => ({
      image: allItems.filter((item) => item.kind === 'image').length,
      file: allItems.filter((item) => item.kind === 'file').length,
      total: allItems.length,
    }),
    [allItems]
  );

  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allItems.filter((item) => {
      if (item.kind !== kind) return false;
      if (!query) return true;
      const haystack = [
        item.attachment.filename,
        item.transaction.name,
        item.transaction.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [allItems, kind, search]);

  return {
    items,
    counts,
    kind,
    setKind,
    search,
    setSearch,
    loading: loading || businessLoading,
    error,
    businessId: activeBusinessId,
    refresh: fetchAttachments,
  };
}
