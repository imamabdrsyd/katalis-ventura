'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { AnimatedDialog } from '@/components/ui/AnimatedDialog';
import { useLanguage } from '@/context/LanguageContext';

export interface ConfirmOptions {
  title: string;
  /** Penjelasan tambahan di bawah judul — mis. konsekuensi yang tidak bisa dibatalkan. */
  message?: React.ReactNode;
  /** Label tombol yang meneruskan aksi. Default `t.common.confirm`. */
  confirmLabel?: string;
  /** Label tombol batal. Default `t.common.cancel`. */
  cancelLabel?: string;
  /** `danger` untuk aksi merusak (hapus, putus koneksi). Default `danger`, karena
   *  hampir semua konfirmasi di app ini memang aksi merusak. */
  tone?: 'danger' | 'default';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Pengganti `window.confirm()` — memblokir thread, tak bisa di-styling, tak bisa
 * di-i18n, dan tampil beda-beda di tiap browser. Bentuk API-nya sengaja dibuat
 * memetakan 1:1 ke pemakaian lama supaya call site tidak perlu dipecah:
 *
 * ```ts
 * const confirm = useConfirm();
 * if (!(await confirm({ title: '...', message: '...' }))) return;
 * ```
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm harus dipakai di dalam <ConfirmProvider>');
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  // Resolver disimpan di ref: promise-nya hidup lebih lama dari satu render, dan
  // menyimpannya di state akan memicu render tambahan tanpa guna.
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setOptions(null);
  }, []);

  const tone = options?.tone ?? 'danger';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatedDialog
        isOpen={!!options}
        // Escape & klik backdrop = batal, sama seperti window.confirm.
        onClose={() => settle(false)}
        ariaLabel={options?.title}
        panelClassName="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full"
      >
        {options && (
          <div className="p-6">
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center mb-4 ${
                tone === 'danger'
                  ? 'bg-red-100 dark:bg-red-900/40'
                  : 'bg-primary-100 dark:bg-primary-900/40'
              }`}
            >
              <AlertTriangle
                className={`w-5 h-5 ${
                  tone === 'danger'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-primary-600 dark:text-primary-400'
                }`}
              />
            </div>

            {/* Banyak konfirmasi lama memakai SATU kalimat panjang (pertanyaan +
                konsekuensi) sebagai seluruh teksnya. Tanpa `message`, judul
                diturunkan bobotnya supaya kalimat panjang tetap enak dibaca. */}
            <h2
              className={`text-gray-900 dark:text-gray-100 mb-1 ${
                options.message ? 'text-lg font-bold' : 'text-base font-semibold leading-snug'
              }`}
            >
              {options.title}
            </h2>
            {options.message && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{options.message}</p>
            )}

            <div className={`flex gap-2 ${options.message ? '' : 'mt-5'}`}>
              <button type="button" onClick={() => settle(false)} className="btn-secondary flex-1">
                {options.cancelLabel ?? t.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => settle(true)}
                className={`${tone === 'danger' ? 'btn-danger' : 'btn-primary'} flex-1`}
              >
                {options.confirmLabel ?? t.common.confirm}
              </button>
            </div>
          </div>
        )}
      </AnimatedDialog>
    </ConfirmContext.Provider>
  );
}
