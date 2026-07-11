import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * EmptyState — state kosong yang seragam untuk semua halaman daftar.
 *
 * Menggantikan pola ad-hoc (Inbox + <p> abu-abu, kartu indigo, dll) dengan satu
 * komponen. Dua varian:
 * - `neutral` (default): ikon abu-abu, untuk daftar yang kebetulan kosong
 *   (mis. "belum ada lead pada filter ini").
 * - `accent`: kartu indigo bernada ajakan, untuk momen first-use / "aha"
 *   (mis. dashboard tanpa transaksi sama sekali — dorong aksi pertama).
 *
 * `action` menerima node bebas (tombol/link) agar call-site tetap fleksibel;
 * untuk tombol standar cukup pakai kelas `.btn-primary` / `.btn-ghost`.
 */
export type EmptyStateVariant = 'neutral' | 'accent';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  variant?: EmptyStateVariant;
  /** Padding vertikal. `sm` untuk panel sempit (sidebar/kolom), `md` default. */
  size?: 'sm' | 'md';
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'neutral',
  size = 'md',
  className = '',
}: EmptyStateProps) {
  const isAccent = variant === 'accent';
  const pad = size === 'sm' ? 'py-10 px-4' : 'py-16 px-6';

  return (
    <div
      className={[
        'flex flex-col items-center justify-center text-center',
        pad,
        isAccent
          ? 'bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Icon
        aria-hidden="true"
        className={
          isAccent
            ? 'w-10 h-10 mb-4 text-indigo-400'
            : 'w-12 h-12 mb-3 text-gray-300 dark:text-gray-600'
        }
      />
      <h3
        className={
          isAccent
            ? 'font-semibold text-indigo-900 dark:text-indigo-300 mb-2'
            : 'text-sm font-semibold text-gray-600 dark:text-gray-300'
        }
      >
        {title}
      </h3>
      {description && (
        <p
          className={
            isAccent
              ? 'text-sm text-indigo-500 dark:text-indigo-400 max-w-sm'
              : 'text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm'
          }
        >
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
