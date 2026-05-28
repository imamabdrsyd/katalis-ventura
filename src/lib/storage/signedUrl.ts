'use client';

import { useEffect, useState } from 'react';

// Helper untuk mengakses file legacy di bucket Supabase Storage
// transaction-attachments yang kini bersifat private (lihat CRIT-04 fix di
// migration 091). File modern menggunakan Cloudinary sehingga URL-nya tidak
// terpengaruh; helper ini menargetkan URL warisan format
//   https://<project>.supabase.co/storage/v1/object/public/transaction-attachments/<path>

const STORAGE_URL_PATTERN =
  /\/storage\/v1\/object\/(?:public|sign)\/transaction-attachments\/([^?]+)/;

export function isLegacyAttachmentUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return STORAGE_URL_PATTERN.test(url);
}

export function extractLegacyAttachmentPath(url: string): string | null {
  const m = url.match(STORAGE_URL_PATTERN);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function fetchSignedAttachmentUrl(
  path: string,
  ttlSeconds?: number
): Promise<string> {
  const params = new URLSearchParams({ path });
  if (ttlSeconds) params.set('ttl', String(ttlSeconds));

  const res = await fetch(`/api/transactions/attachments/sign?${params.toString()}`, {
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error(`Failed to sign attachment URL (status ${res.status})`);
  }
  const json = await res.json();
  return json.data.url as string;
}

/**
 * Normalisasi URL attachment. Jika URL adalah format public Supabase Storage,
 * tukar dengan signed URL ber-TTL pendek. Selain itu, return apa adanya
 * (Cloudinary URL, http external, dll).
 */
export async function resolveAttachmentUrl(
  rawUrl: string,
  ttlSeconds?: number
): Promise<string> {
  if (!isLegacyAttachmentUrl(rawUrl)) return rawUrl;
  const path = extractLegacyAttachmentPath(rawUrl);
  if (!path) return rawUrl;
  return fetchSignedAttachmentUrl(path, ttlSeconds);
}

/**
 * React hook: kembalikan URL siap-pakai untuk render `<img src>` / `<a href>`.
 *
 * - URL non-Supabase-Storage dikembalikan apa adanya.
 * - URL legacy Supabase Storage di-resolve jadi signed URL via API
 *   /api/transactions/attachments/sign (TTL pendek). Sebelum signed URL
 *   tersedia, hook mengembalikan string kosong supaya browser tidak
 *   memuat URL public yang sudah 403.
 *
 * Hook ini di-cache cukup ringan via state — jika rawUrl tidak berubah,
 * resolve hanya terjadi sekali. Komponen pemanggil tetap perlu memikirkan
 * refresh saat TTL habis (umumnya 30 menit cukup untuk satu sesi).
 */
export function useSignedAttachmentUrl(rawUrl: string | null | undefined): string {
  const [resolved, setResolved] = useState<string>(() =>
    rawUrl && !isLegacyAttachmentUrl(rawUrl) ? rawUrl : ''
  );

  useEffect(() => {
    if (!rawUrl) {
      setResolved('');
      return;
    }
    if (!isLegacyAttachmentUrl(rawUrl)) {
      setResolved(rawUrl);
      return;
    }
    let cancelled = false;
    setResolved('');
    resolveAttachmentUrl(rawUrl)
      .then((u) => {
        if (!cancelled) setResolved(u);
      })
      .catch(() => {
        if (!cancelled) setResolved('');
      });
    return () => {
      cancelled = true;
    };
  }, [rawUrl]);

  return resolved;
}
