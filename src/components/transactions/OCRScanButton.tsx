'use client';

import { useEffect, useRef, useState } from 'react';
import { ScanText } from 'lucide-react';
import { uploadAttachment, validateFile } from '@/lib/storage/attachments';
import type { OcrResult } from '@/lib/ocr/types';

type OcrStage = 'uploading' | 'scanning' | 'parsing';

const STAGE_PHRASES: Record<OcrStage, string[]> = {
  uploading: ['Mengunggah struk...', 'Menyiapkan gambar...', 'Mengirim ke cloud...'],
  scanning: ['Memindai struk...', 'Membaca teks...', 'Menganalisis layout...', 'Mengenali angka...'],
  parsing: ['Mengekstrak nominal...', 'Mendeteksi vendor...', 'Menyusun tanggal...', 'Mencocokkan akun...', 'Hampir selesai...'],
};

function useRotatingPhrase(stage: OcrStage | null, intervalMs = 1400) {
  const [phrase, setPhrase] = useState<string>('');

  useEffect(() => {
    if (!stage) {
      setPhrase('');
      return;
    }
    const phrases = STAGE_PHRASES[stage];
    let idx = 0;
    setPhrase(phrases[0]);
    const id = setInterval(() => {
      idx = (idx + 1) % phrases.length;
      setPhrase(phrases[idx]);
    }, intervalMs);
    return () => clearInterval(id);
  }, [stage, intervalMs]);

  return phrase;
}

type Props = {
  businessId: string;
  onParsed: (result: OcrResult) => void;
  variant?: 'primary' | 'secondary' | 'compact';
  disabled?: boolean;
  label?: string;
};

/**
 * Tombol "Scan Struk" reusable.
 * Flow: file picker → upload Cloudinary → POST /api/ocr/scan → emit onParsed(result).
 *
 * Variant:
 * - 'primary': tombol biru besar (default header form)
 * - 'secondary': tombol outline
 * - 'compact': icon-only tombol kecil (untuk QuickForm)
 */
export default function OCRScanButton({
  businessId,
  onParsed,
  variant = 'primary',
  disabled = false,
  label = 'Scan Struk',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<OcrStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loading = stage !== null;
  const phrase = useRotatingPhrase(stage);

  const handleClick = () => {
    if (loading || disabled) return;
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset agar bisa upload file yang sama lagi
    if (!file) return;

    const validationErr = validateFile(file);
    if (validationErr) {
      setError(validationErr);
      return;
    }

    setError(null);
    setStage('uploading');

    try {
      // 1. Upload ke Cloudinary
      const attachment = await uploadAttachment(businessId, file);

      // 2. Panggil OCR API (scanning + parsing happen server-side)
      setStage('scanning');
      const scanPromise = fetch('/api/ocr/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          image_url: attachment.url,
        }),
      });

      // Switch to "parsing" phrases mid-flight so user sees progression
      // even though it's a single API call
      const parsingTimer = setTimeout(() => setStage('parsing'), 2500);

      const res = await scanPromise;
      clearTimeout(parsingTimer);

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? 'OCR gagal');
      }

      const result = json.data as OcrResult;
      onParsed(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses gambar';
      setError(msg);
    } finally {
      setStage(null);
    }
  };

  const baseClass =
    variant === 'compact'
      ? 'inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition'
      : variant === 'secondary'
        ? 'btn-secondary inline-flex items-center gap-2'
        : 'btn-primary inline-flex items-center gap-2';

  // Glass effect for non-compact loading state — replaces solid btn-primary look
  const glassLoadingClass =
    variant !== 'compact' && loading
      ? 'relative overflow-hidden bg-gradient-to-r from-indigo-500/80 via-indigo-400/70 to-indigo-500/80 backdrop-blur-md border border-white/30 text-white shadow-lg shadow-indigo-500/30'
      : '';

  return (
    <div className="inline-flex flex-col gap-1 relative">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || loading}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        className={`${baseClass} ${glassLoadingClass} disabled:cursor-not-allowed`}
        title="Scan receipt to auto-fill"
        aria-live="polite"
      >
        {loading ? (
          <>
            {variant !== 'compact' && (
              <span className="absolute inset-0 ocr-shimmer pointer-events-none" aria-hidden />
            )}
            <span className="relative z-[1] inline-flex items-center gap-2">
              <Spinner />
              {variant !== 'compact' && <RotatingPhrase phrase={phrase} />}
            </span>
          </>
        ) : (
          <>
            <ScanText className="w-4 h-4" aria-hidden />
            {variant !== 'compact' && <span>{label}</span>}
          </>
        )}
      </button>
      {loading && variant === 'compact' && phrase && (
        <div
          className="absolute top-full right-0 mt-2 z-20 pointer-events-none"
          aria-hidden
        >
          <div className="relative overflow-hidden flex items-center gap-2 whitespace-nowrap rounded-xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-gray-900/60 backdrop-blur-xl px-3 py-1.5 shadow-lg shadow-indigo-500/10 dark:shadow-indigo-900/30 ring-1 ring-indigo-500/5">
            <span className="ocr-shimmer absolute inset-0 pointer-events-none" />
            <span className="relative z-[1] inline-flex items-center gap-1.5 text-indigo-700 dark:text-indigo-200">
              <PulseDot />
              <RotatingPhrase
                phrase={phrase}
                className="text-[11px] font-medium tracking-tight"
              />
            </span>
          </div>
        </div>
      )}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

function RotatingPhrase({ phrase, className }: { phrase: string; className?: string }) {
  return (
    <span key={phrase} className={`ocr-phrase-fade ${className ?? ''}`}>
      {phrase}
    </span>
  );
}

function PulseDot() {
  return (
    <span className="relative inline-flex w-1.5 h-1.5">
      <span className="absolute inset-0 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-ping opacity-60" />
      <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />
    </span>
  );
}


function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeOpacity="0.25"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
