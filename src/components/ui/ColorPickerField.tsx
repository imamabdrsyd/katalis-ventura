'use client';

/**
 * Pemilih warna brand: kotak swatch (membuka color picker OS, lengkap dengan
 * eyedropper di browser yang mendukungnya) + isian hex + deretan preset.
 *
 * Dipakai untuk warna yang DITENTUKAN PEMILIK BISNIS — warna tombol halaman
 * publik & warna tim event. BUKAN untuk warna UI aplikasi: itu tetap token
 * `primary-*` / `gray-*` di Tailwind.
 *
 * Ketikan hex sengaja tidak langsung "dibersihkan" saat mengetik — nilai
 * setengah jadi seperti `#9b6` valid sebagai langkah menuju `#9b6a8f`, jadi
 * normalisasi (`#abc` → `#aabbcc`) baru terjadi saat blur. Kalau isinya tetap
 * bukan hex saat blur, field kembali ke nilai terakhir yang sah.
 *
 * Dua ukuran: `md` (default, di form pengaturan) dan `sm` (baris padat, mis.
 * warna per tim di sebelah nama tim).
 */

import { useEffect, useId, useState } from 'react';
import { Check } from 'lucide-react';
import { BRAND_COLOR_PRESETS, normalizeHexColor } from '@/lib/colorUtils';

interface Props {
  /** Warna aktif dalam bentuk `#rrggbb`. */
  value: string;
  onChange: (hex: string) => void;
  label?: string;
  description?: string;
  /** Tampilkan deretan preset. Default true. */
  showPresets?: boolean;
  presets?: readonly string[];
  size?: 'sm' | 'md';
  /** Tombol opsional di kanan, mis. "Pakai warna brand" untuk mengosongkan. */
  trailing?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export function ColorPickerField({
  value,
  onChange,
  label,
  description,
  showPresets = true,
  presets = BRAND_COLOR_PRESETS,
  size = 'md',
  trailing,
  disabled = false,
  className = '',
}: Props) {
  const inputId = useId();
  const [draft, setDraft] = useState(value);

  // Nilai bisa berubah dari luar (preset diklik, form di-reset) — ikutkan.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commitDraft() {
    const normalized = normalizeHexColor(draft);
    if (normalized) {
      setDraft(normalized);
      onChange(normalized);
    } else {
      setDraft(value);
    }
  }

  const isSm = size === 'sm';
  const swatchSize = isSm ? 'w-8 h-8' : 'w-10 h-10';
  const hexWidth = isSm ? 'w-24' : 'w-28';
  const dotSize = isSm ? 'w-5 h-5' : 'w-6 h-6';

  return (
    <div className={className}>
      {label && (
        <label className="label" htmlFor={inputId}>
          {label}
        </label>
      )}
      {description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-3">{description}</p>
      )}

      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Swatch: input color asli ditumpuk transparan di atas kotak warna,
            supaya kliknya membuka picker OS tanpa memakai tampilan bawaannya
            (yang bentuknya beda-beda tiap browser). */}
        <div
          className={`relative ${swatchSize} rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600 shrink-0 ${
            disabled ? 'opacity-50' : ''
          }`}
        >
          <input
            id={inputId}
            type="color"
            value={normalizeHexColor(value) ?? '#000000'}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value.toLowerCase())}
            className="absolute inset-0 w-full h-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            aria-label={label}
          />
          <div className="w-full h-full" style={{ backgroundColor: value }} />
        </div>

        <input
          type="text"
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitDraft();
            }
          }}
          maxLength={7}
          spellCheck={false}
          placeholder="#6366f1"
          aria-label={label ? `${label} (hex)` : 'Kode warna hex'}
          className={`${hexWidth} px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 font-mono outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all disabled:opacity-50`}
        />

        {showPresets && (
          <div className="flex gap-1.5 flex-wrap">
            {presets.map((preset) => {
              const isActive = normalizeHexColor(value) === normalizeHexColor(preset);
              return (
                <button
                  key={preset}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(preset)}
                  title={preset}
                  aria-label={preset}
                  aria-pressed={isActive}
                  className={`${dotSize} rounded-full border-2 grid place-items-center transition-transform hover:scale-110 disabled:hover:scale-100 disabled:opacity-50 ${
                    isActive ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: preset }}
                >
                  {isActive && <Check className="w-3 h-3 text-white mix-blend-difference" />}
                </button>
              );
            })}
          </div>
        )}

        {trailing}
      </div>
    </div>
  );
}
