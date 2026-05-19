import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase-server';
import { googleVisionOcr } from './googleVision';
import { ocrSpaceOcr } from './ocrSpace';
import { parseReceipt } from './parser';
import { getMonthlyUsage, incrementUsage } from './usage';
import {
  OCR_LIMITS,
  OcrProviderError,
  OcrQuotaExceededError,
  type OcrParsed,
  type OcrProvider,
  type OcrResult,
} from './types';

export { OCR_LIMITS, OcrProviderError, OcrQuotaExceededError } from './types';
export type { OcrParsed, OcrProvider, OcrResult } from './types';
export { getMonthlyUsage } from './usage';

/**
 * Hitung SHA-256 hash dari file buffer (hex string).
 */
export function hashFile(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Lookup hasil cached berdasarkan file hash.
 * Cache hanya menyimpan raw_text dari OCR provider — parser di-re-run tiap call
 * supaya improvement di parser langsung kepakai tanpa perlu invalidate cache.
 */
async function lookupCache(fileHash: string): Promise<{ provider: OcrProvider; raw_text: string } | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('ocr_scan_cache')
    .select('provider, raw_text')
    .eq('file_hash', fileHash)
    .maybeSingle();

  if (error || !data || !data.raw_text) return null;

  return {
    provider: data.provider as OcrProvider,
    raw_text: data.raw_text,
  };
}

/**
 * Simpan hasil OCR ke cache. Idempotent (on conflict do nothing).
 */
async function saveCache(
  fileHash: string,
  provider: OcrProvider,
  rawText: string,
  parsed: OcrParsed
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from('ocr_scan_cache')
    .upsert(
      {
        file_hash: fileHash,
        provider,
        raw_text: rawText,
        parsed_data: parsed,
      },
      { onConflict: 'file_hash', ignoreDuplicates: true }
    );
}

/**
 * Orchestrator utama: cache → Google Vision → fallback OCR.space.
 *
 * Flow:
 * 1. Cek cache by file hash → return kalau hit
 * 2. Kalau Google Vision usage < 950 → pakai Vision
 *    - Kalau Vision error (selain quota), fallback ke OCR.space
 * 3. Kalau Vision penuh → pakai OCR.space
 * 4. Kalau OCR.space juga penuh → throw OcrQuotaExceededError
 * 5. Parse hasil + simpan cache + increment usage
 */
export async function scanReceipt(
  fileBuffer: Buffer,
  fileHash?: string,
  mimeType = 'image/jpeg'
): Promise<OcrResult> {
  const hash = fileHash ?? hashFile(fileBuffer);

  // 1. Cache lookup — kalau hit, re-parse pakai parser terbaru (jangan pakai parsed_data lama)
  const cached = await lookupCache(hash);
  if (cached) {
    return {
      provider: cached.provider,
      raw_text: cached.raw_text,
      parsed: parseReceipt(cached.raw_text),
      cached: true,
    };
  }

  // 2. Decide provider berdasarkan usage
  const visionUsage = await getMonthlyUsage('google_vision');
  const useVision = visionUsage < OCR_LIMITS.google_vision;

  let rawText: string | null = null;
  let usedProvider: OcrProvider | null = null;
  let lastError: unknown = null;

  if (useVision) {
    try {
      rawText = await googleVisionOcr(fileBuffer);
      usedProvider = 'google_vision';
    } catch (err) {
      lastError = err;
      console.warn('[ocr] Vision failed, falling back to ocr.space:', err);
    }
  }

  if (rawText === null) {
    const ocrSpaceUsage = await getMonthlyUsage('ocr_space');
    if (ocrSpaceUsage >= OCR_LIMITS.ocr_space) {
      throw new OcrQuotaExceededError();
    }

    try {
      rawText = await ocrSpaceOcr(fileBuffer, mimeType);
      usedProvider = 'ocr_space';
    } catch (err) {
      console.error('[ocr] OCR.space failed:', err);
      // Kedua provider gagal — laporkan sebagai dual failure agar user tahu apa adanya
      if (lastError) {
        throw new OcrProviderError(
          'ocr_space',
          `Kedua provider gagal. Vision: ${(lastError as Error)?.message ?? 'error'} | OCR.space: ${(err as Error)?.message ?? 'error'}`
        );
      }
      throw err;
    }
  }

  if (!usedProvider || rawText === null) {
    throw new OcrProviderError(
      'google_vision',
      'OCR failed: no provider returned text'
    );
  }

  const parsed = parseReceipt(rawText);

  // Save cache + increment usage in parallel (best-effort, no rollback on failure)
  await Promise.all([
    saveCache(hash, usedProvider, rawText, parsed),
    incrementUsage(usedProvider),
  ]);

  return {
    provider: usedProvider,
    raw_text: rawText,
    parsed,
    cached: false,
  };
}
