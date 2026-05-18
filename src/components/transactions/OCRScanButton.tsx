'use client';

import { useRef, useState } from 'react';
import { ScanText } from 'lucide-react';
import { uploadAttachment, validateFile } from '@/lib/storage/attachments';
import type { OcrResult } from '@/lib/ocr/types';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setLoading(true);

    try {
      // 1. Upload ke Cloudinary
      const attachment = await uploadAttachment(businessId, file);

      // 2. Panggil OCR API
      const res = await fetch('/api/ocr/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          image_url: attachment.url,
        }),
      });

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
      setLoading(false);
    }
  };

  const baseClass =
    variant === 'compact'
      ? 'inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition'
      : variant === 'secondary'
        ? 'btn-secondary inline-flex items-center gap-2'
        : 'btn-primary inline-flex items-center gap-2';

  return (
    <div className="inline-flex flex-col gap-1">
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
        className={`${baseClass} disabled:opacity-50 disabled:cursor-not-allowed`}
        title="Scan receipt to auto-fill"
      >
        {loading ? (
          <>
            <Spinner />
            {variant !== 'compact' && <span>Memindai...</span>}
          </>
        ) : (
          <>
            <ScanText className="w-4 h-4" aria-hidden />
            {variant !== 'compact' && <span>{label}</span>}
          </>
        )}
      </button>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
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
