import { toast } from 'sonner';
import type { SheetRow } from '@/lib/reports/reportRows';
import { runExportToast } from '@/lib/exportToast';

/** Klien sisi-browser untuk route /api/integrations/google-sheets/*. */

const BASE = '/api/integrations/google-sheets';

export interface GoogleConnectionStatus {
  connected: boolean;
  email: string | null;
  connected_at: string | null;
  needs_reconnect: boolean;
}

export async function fetchGoogleConnectionStatus(): Promise<GoogleConnectionStatus> {
  const res = await fetch(`${BASE}/status`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Gagal membaca status koneksi Google');
  const json = await res.json();
  return json.data as GoogleConnectionStatus;
}

export async function disconnectGoogleSheets(): Promise<void> {
  const res = await fetch(`${BASE}/status`, { method: 'DELETE' });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? 'Gagal memutus koneksi Google');
  }
}

export interface ExportToSheetsInput {
  title: string;
  sheetTitle: string;
  rows: SheetRow[];
  businessId?: string;
}

export interface ExportToSheetsResult {
  spreadsheet_id: string;
  url: string;
}

/** Dilempar saat koneksi Google belum ada / perlu dihubungkan ulang (HTTP 409). */
export class GoogleNotConnectedError extends Error {
  constructor(
    message: string,
    readonly code: 'not_connected' | 'revoked' | 'refresh_failed'
  ) {
    super(message);
    this.name = 'GoogleNotConnectedError';
  }
}

export async function exportRowsToGoogleSheets(
  input: ExportToSheetsInput
): Promise<ExportToSheetsResult> {
  const res = await fetch(`${BASE}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: input.title,
      sheet_title: input.sheetTitle,
      rows: input.rows,
      business_id: input.businessId,
    }),
  });

  const json = await res.json().catch(() => ({}));

  if (res.status === 409) {
    throw new GoogleNotConnectedError(json.error ?? 'Akun Google belum terhubung.', json.code);
  }
  if (!res.ok) {
    throw new Error(json.error ?? 'Gagal membuat Google Sheets');
  }

  return json.data as ExportToSheetsResult;
}

/**
 * Bungkus export + toast, lalu tawarkan tautan lewat toast aksi.
 *
 * PENTING: jangan `window.open()` otomatis setelah promise selesai — karena
 * task-nya async, pop-up blocker akan memblokirnya dan user melihat toast
 * "berhasil" tanpa apa pun untuk diklik. Tombol aksi memberi klik user yang
 * sah sehingga tab baru selalu terbuka.
 */
export async function exportToGoogleSheetsWithToast(
  input: ExportToSheetsInput
): Promise<ExportToSheetsResult> {
  const result = await runExportToast('sheets', () => exportRowsToGoogleSheets(input));

  toast.success(input.title, {
    description: 'Spreadsheet dibuat di Google Drive kamu.',
    action: {
      label: 'Buka',
      onClick: () => window.open(result.url, '_blank', 'noopener,noreferrer'),
    },
    duration: 10000,
  });

  return result;
}
