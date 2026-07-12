'use client';

import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface FloatingFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Label yang mengambang (Google/Material style). Boleh string atau JSX kecil. */
  label: ReactNode;
  /** Ikon di kiri field (opsional), mis. <Mail className="w-4 h-4" /> */
  icon?: ReactNode;
  /** Elemen di kanan field (opsional), mis. tombol show/hide password */
  trailing?: ReactNode;
  /** Class tambahan untuk wrapper */
  wrapperClassName?: string;
}

/**
 * Field isian gaya Google — varian Material "standard / underline".
 * TANPA kotak: hanya garis bawah. Label ada sejajar teks saat kosong,
 * lalu naik ke atas + mengecil saat difokus atau terisi. Garis bawah &
 * label jadi indigo saat aktif.
 *
 * HINT / PLACEHOLDER: hint hanya muncul saat field DIFOKUS (setelah label
 * naik), bukan saat resting — jadi tidak pernah tabrakan dengan label.
 * Dicapai lewat placeholder:text-transparent + focus:placeholder:text-gray-400.
 * Kalau `placeholder` tidak diberikan, dipakai spasi kosong agar deteksi
 * :placeholder-shown (untuk float label) tetap jalan.
 *
 * Karena tanpa border atas, label TIDAK perlu background patch — cocok di atas
 * latar warna apa pun (tak seperti varian outlined).
 */
const FloatingField = forwardRef<HTMLInputElement, FloatingFieldProps>(
  ({ label, icon, trailing, id, className = '', wrapperClassName = '', placeholder, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className={`relative ${wrapperClassName}`}>
        <input
          ref={ref}
          id={inputId}
          placeholder={placeholder || ' '}
          className={`peer block w-full appearance-none border-0 border-b-2 border-gray-300 dark:border-gray-600 bg-transparent pt-5 pb-1.5 text-gray-900 dark:text-gray-100 outline-none transition-colors
            placeholder:text-transparent focus:placeholder:text-gray-400 dark:focus:placeholder:text-gray-500
            focus:border-primary-500 focus:ring-0
            disabled:opacity-50 disabled:cursor-not-allowed
            ${icon ? 'pl-7' : 'px-0'} ${trailing ? 'pr-7' : ''} ${className}`}
          {...props}
        />

        {icon && (
          <span className="pointer-events-none absolute left-0 top-8 -translate-y-1/2 text-gray-400 dark:text-gray-500 peer-focus:text-primary-500 transition-colors">
            {icon}
          </span>
        )}

        <label
          htmlFor={inputId}
          className={`pointer-events-none absolute origin-[0] transition-all duration-200 text-gray-500 dark:text-gray-400
            top-5 -translate-y-5 scale-75
            peer-placeholder-shown:top-5 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-placeholder-shown:text-gray-400 peer-placeholder-shown:dark:text-gray-500
            peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-primary-500
            ${icon ? 'left-7 peer-focus:left-0' : 'left-0'}`}
        >
          {label}
        </label>

        {trailing && (
          <span className="absolute right-0 top-8 -translate-y-1/2">{trailing}</span>
        )}
      </div>
    );
  }
);

FloatingField.displayName = 'FloatingField';

export default FloatingField;

interface FloatingSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Label yang mengambang — juga berperan sebagai placeholder saat kosong */
  label: ReactNode;
  /** Class tambahan untuk wrapper */
  wrapperClassName?: string;
}

/**
 * Dropdown gaya Google — varian Material "standard / underline" dengan chevron.
 * Label sejajar teks (jadi placeholder) saat belum ada pilihan, lalu naik +
 * mengecil saat terisi atau difokus. Garis bawah & label jadi indigo saat aktif.
 *
 * PENTING: karena label berperan sebagai placeholder, opsi placeholder di
 * children cukup ditulis kosong, mis. <option value="" /> — JANGAN diisi teks
 * "Pilih ..." supaya tidak tabrakan dengan label.
 *
 * Float state: value != '' (terisi) diatur lewat React (bukan :placeholder-shown,
 * yang tidak berlaku untuk <select>); state fokus lewat peer-focus.
 */
const FloatingSelect = forwardRef<HTMLSelectElement, FloatingSelectProps>(
  ({ label, id, className = '', wrapperClassName = '', children, value, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const hasValue = value !== undefined && value !== null && value !== '';

    return (
      <div className={`relative ${wrapperClassName}`}>
        <select
          ref={ref}
          id={selectId}
          value={value}
          className={`peer block w-full appearance-none border-0 border-b-2 border-gray-300 dark:border-gray-600 bg-transparent pt-5 pb-1.5 pr-7 text-gray-900 dark:text-gray-100 outline-none transition-colors
            focus:border-primary-500 focus:ring-0
            disabled:opacity-50 disabled:cursor-not-allowed
            ${className}`}
          {...props}
        >
          {children}
        </select>

        <label
          htmlFor={selectId}
          className={`pointer-events-none absolute left-0 top-5 origin-[0] transition-all duration-200
            ${hasValue ? '-translate-y-5 scale-75 text-gray-500 dark:text-gray-400' : 'translate-y-0 scale-100 text-gray-400 dark:text-gray-500'}
            peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-primary-500`}
        >
          {label}
        </label>

        <ChevronDown className="pointer-events-none absolute right-0 top-8 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 peer-focus:text-primary-500 transition-colors" />
      </div>
    );
  }
);

FloatingSelect.displayName = 'FloatingSelect';

export { FloatingSelect };
