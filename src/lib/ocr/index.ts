import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase-server';
import { geminiOcr, geminiVertexOcr, parseGeminiJson } from './geminiOcr';
import { googleVisionOcr } from './googleVision';
import { ocrSpaceOcr } from './ocrSpace';
import { parseReceipt } from './parser';
import { getMonthlyUsage, incrementUsage } from './usage';
import {
  OCR_LIMITS,
  OcrProviderError,
  OcrQuotaExceededError,
  type OcrProvider,
  type OcrResult,
} from './types';

export { OCR_LIMITS, OcrProviderError, OcrQuotaExceededError } from './types';
export type { OcrParsed, OcrProvider, OcrResult } from './types';
export { getMonthlyUsage } from './usage';

/**
 * Hasil OCR mentah (sebelum parser domain-spesifik).
 * Dipakai oleh use case selain receipt (mis. bank statement) yang punya parser sendiri.
 */
export type RawOcrResult = {
  provider: OcrProvider;
  raw_text: string;
  cached: boolean;
};

/**
 * Opsi untuk runOcr — pilih provider preference.
 * - 'auto' (default): Vision dulu, fallback OCR.space (cocok untuk image struk)
 * - 'ocr_space_only': skip Vision, langsung OCR.space (cocok untuk PDF multi-page)
 */
export type OcrProviderPreference = 'auto' | 'ocr_space_only';

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
 * Simpan raw OCR ke cache. Caller (scanBankStatement / scanReceipt) re-parse
 * dari raw_text saat hit cache supaya improvement parser langsung kepakai.
 */
async function saveCacheRaw(
  fileHash: string,
  provider: OcrProvider,
  rawText: string
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from('ocr_scan_cache')
    .upsert(
      {
        file_hash: fileHash,
        provider,
        raw_text: rawText,
      },
      { onConflict: 'file_hash', ignoreDuplicates: true }
    );
}

/**
 * Helper provider-agnostic: cache → Vision (kalau auto) → OCR.space.
 * Return raw text mentah TANPA parser domain-spesifik.
 *
 * Dipakai oleh:
 * - scanReceipt() — wrap dengan parseReceipt()
 * - scanBankStatement() — wrap dengan parseBankStatement()
 *
 * Flow:
 * 1. Cek cache by file hash → return kalau hit (re-parse di caller pakai parser terbaru)
 * 2. Kalau preference 'auto' & Vision quota tersedia → coba Vision
 *    - Kalau Vision error, fallback ke OCR.space
 * 3. Kalau 'ocr_space_only' atau Vision penuh → langsung OCR.space
 * 4. Kalau OCR.space juga penuh → throw OcrQuotaExceededError
 * 5. Simpan raw_text ke cache + increment usage
 *
 * Catatan: untuk PDF multi-page wajib pakai 'ocr_space_only' karena Vision
 * sync endpoint hanya support image.
 */
export async function runOcr(
  fileBuffer: Buffer,
  options: {
    fileHash?: string;
    mimeType?: string;
    preference?: OcrProviderPreference;
  } = {}
): Promise<RawOcrResult> {
  const mimeType = options.mimeType ?? 'image/jpeg';
  const preference = options.preference ?? 'auto';
  const hash = options.fileHash ?? hashFile(fileBuffer);

  const cached = await lookupCache(hash);
  if (cached) {
    return {
      provider: cached.provider,
      raw_text: cached.raw_text,
      cached: true,
    };
  }

  let rawText: string | null = null;
  let usedProvider: OcrProvider | null = null;
  let lastError: unknown = null;

  if (preference === 'auto') {
    const visionUsage = await getMonthlyUsage('google_vision');
    if (visionUsage < OCR_LIMITS.google_vision) {
      try {
        rawText = await googleVisionOcr(fileBuffer);
        usedProvider = 'google_vision';
      } catch (err) {
        lastError = err;
        console.warn('[ocr] Vision failed, falling back to ocr.space:', err);
      }
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

  await Promise.all([
    saveCacheRaw(hash, usedProvider, rawText),
    incrementUsage(usedProvider),
  ]);

  return {
    provider: usedProvider,
    raw_text: rawText,
    cached: false,
  };
}

/**
 * Orchestrator untuk SCAN STRUK BELANJA.
 *
 * Strategi provider:
 * 1. Gemini (multimodal): kirim gambar → JSON terstruktur langsung. Paling akurat
 *    untuk struk Indonesia, gratis. Hasilnya di-cache (raw_text = JSON Gemini).
 * 2. Fallback ke Vision/OCR.space (raw text) + parseReceipt (regex) kalau:
 *    - Gemini quota bulan ini habis, ATAU
 *    - Gemini error / API key tidak di-set.
 *
 * Cache: raw_text untuk provider Gemini berisi JSON, untuk provider lain berisi
 * teks mentah OCR. parser dipilih berdasarkan provider saat cache hit.
 */
export async function scanReceipt(
  fileBuffer: Buffer,
  fileHash?: string,
  mimeType = 'image/jpeg'
): Promise<OcrResult> {
  const hash = fileHash ?? hashFile(fileBuffer);

  // Cache hit: re-parse dari raw_text pakai parser sesuai provider.
  const cached = await lookupCache(hash);
  if (cached) {
    return {
      provider: cached.provider,
      raw_text: cached.raw_text,
      parsed:
        cached.provider === 'gemini'
          ? parseGeminiJson(cached.raw_text)
          : parseReceipt(cached.raw_text),
      cached: true,
    };
  }

  // Primary: Gemini Vertex (gemini-2.5-flash via Vertex AI) — lebih cerdas & tidak
  // kena kuota gratisan. Pakai billing GCP. Kalau credentials Vertex tidak ada,
  // geminiVertexOcr return null → lanjut ke AI Studio gratisan di bawah.
  try {
    const vertexResult = await geminiVertexOcr(fileBuffer, mimeType);
    if (vertexResult) {
      await Promise.all([
        saveCacheRaw(hash, 'gemini', vertexResult.raw_text),
        incrementUsage('gemini'),
      ]);
      return { provider: 'gemini', raw_text: vertexResult.raw_text, parsed: vertexResult.parsed, cached: false };
    }
  } catch (err) {
    console.warn('[ocr] Gemini Vertex failed, falling back to AI Studio:', err);
  }

  // Fallback 1: Gemini AI Studio gratisan (image → JSON), kalau quota & API key tersedia.
  if (process.env.GEMINI_API_KEY) {
    const geminiUsage = await getMonthlyUsage('gemini');
    if (geminiUsage < OCR_LIMITS.gemini) {
      try {
        const { raw_text, parsed } = await geminiOcr(fileBuffer, mimeType);
        await Promise.all([
          saveCacheRaw(hash, 'gemini', raw_text),
          incrementUsage('gemini'),
        ]);
        return { provider: 'gemini', raw_text, parsed, cached: false };
      } catch (err) {
        console.warn('[ocr] Gemini failed, falling back to Vision/OCR.space:', err);
      }
    }
  }

  // Fallback: Vision/OCR.space (raw text) + regex parser.
  const result = await runOcr(fileBuffer, { fileHash: hash, mimeType, preference: 'auto' });
  return {
    provider: result.provider,
    raw_text: result.raw_text,
    parsed: parseReceipt(result.raw_text),
    cached: result.cached,
  };
}
