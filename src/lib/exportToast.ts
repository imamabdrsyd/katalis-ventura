'use client';

import { toast } from 'sonner';

type ExportKind = 'pdf' | 'excel';

const LABELS: Record<ExportKind, { loading: string; success: string; error: string }> = {
  pdf: {
    loading: 'Menyiapkan PDF…',
    success: 'PDF berhasil diunduh',
    error: 'Gagal membuat PDF',
  },
  excel: {
    loading: 'Menyiapkan Excel…',
    success: 'Excel berhasil diunduh',
    error: 'Gagal membuat Excel',
  },
};

/**
 * Bungkus proses export (dynamic import modul + generate file) dengan satu toast
 * yang bertransisi loading → sukses/gagal. `task` boleh sinkron atau async —
 * dinormalkan ke Promise agar `toast.promise` bisa memantaunya. File terunduh di
 * dalam task, jadi toast sukses muncul tepat setelah unduhan dipicu.
 */
export function runExportToast<T>(kind: ExportKind, task: () => T | Promise<T>): Promise<T> {
  const p = Promise.resolve().then(task);
  const { loading, success, error } = LABELS[kind];
  toast.promise(p, {
    loading,
    success,
    error: (err) => (err instanceof Error && err.message ? err.message : error),
  });
  return p;
}
