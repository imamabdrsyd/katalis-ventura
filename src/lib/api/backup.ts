import { generateSlugFromName } from '@/lib/utils/slugUtils';
import type { BackupEnvelope } from '@/lib/backup/types';

/** Klien sisi-browser untuk route /api/backup/[businessId]. */

export async function fetchBackupEnvelope(businessId: string): Promise<BackupEnvelope> {
  const res = await fetch(`/api/backup/${businessId}`, { cache: 'no-store' });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? 'Gagal mengambil data backup');
  }

  return (await res.json()) as BackupEnvelope;
}

/** `axion-backup-nama-bisnis-2026-08-28` — tanpa ekstensi. */
export function backupFileBaseName(envelope: BackupEnvelope): string {
  const slug = generateSlugFromName(envelope.business.business_name) || 'bisnis';
  const date = envelope.exported_at.slice(0, 10);
  return `axion-backup-${slug}-${date}`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadBackupJson(envelope: BackupEnvelope): void {
  const blob = new Blob([JSON.stringify(envelope, null, 2)], {
    type: 'application/json',
  });
  triggerDownload(blob, `${backupFileBaseName(envelope)}.json`);
}

/**
 * Konversi ke Excel di-import dinamis: `xlsx` berat, dan mayoritas kunjungan ke
 * tab Data tidak berakhir dengan klik unduh Excel.
 */
export async function downloadBackupExcel(envelope: BackupEnvelope): Promise<void> {
  const [{ envelopeToWorkbook }, XLSX] = await Promise.all([
    import('@/lib/backup/toWorkbook'),
    import('xlsx'),
  ]);

  XLSX.writeFile(envelopeToWorkbook(envelope), `${backupFileBaseName(envelope)}.xlsx`);
}

/** Total baris di seluruh tabel — dipakai UI untuk meringkas hasil backup. */
export function totalBackupRows(envelope: BackupEnvelope): number {
  return Object.values(envelope.counts).reduce((sum, n) => sum + n, 0);
}
