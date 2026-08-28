'use client';

import { useState } from 'react';
import { DatabaseBackup, Download, FileJson, Info, Sheet } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { runExportToast } from '@/lib/exportToast';
import {
  fetchBackupEnvelope,
  downloadBackupExcel,
  downloadBackupJson,
  totalBackupRows,
} from '@/lib/api/backup';

/**
 * Kartu backup data di tab "Data" pada konfigurasi bisnis.
 *
 * Tempatnya di konfigurasi bisnis — bukan di Pengaturan — karena backup ini
 * PER-BISNIS. Konvensi yang sama dipakai Instagram/WhatsApp, sedangkan yang
 * per-user (Telegram, Google Sheets) tinggal di Pengaturan.
 */
export function BackupCard({
  businessId,
  canManage,
}: {
  businessId: string;
  canManage: boolean;
}) {
  const { t } = useLanguage();
  const tb = t.backup;

  const [busy, setBusy] = useState<'json' | 'excel' | null>(null);
  const [summary, setSummary] = useState<{ rows: number; tables: number } | null>(null);

  const run = async (format: 'json' | 'excel') => {
    setBusy(format);
    try {
      await runExportToast('backup', async () => {
        const envelope = await fetchBackupEnvelope(businessId);

        if (format === 'json') {
          downloadBackupJson(envelope);
        } else {
          await downloadBackupExcel(envelope);
        }

        setSummary({
          rows: totalBackupRows(envelope),
          tables: Object.keys(envelope.counts).length,
        });
      });
    } catch {
      // runExportToast sudah menampilkan pesan errornya.
    } finally {
      setBusy(null);
    }
  };

  const header = (
    <div className="flex items-center gap-3 mb-5">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          canManage ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-gray-100 dark:bg-gray-700'
        }`}
      >
        <DatabaseBackup
          className={`w-5 h-5 ${
            canManage
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-gray-400 dark:text-gray-500'
          }`}
        />
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{tb.title}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{tb.subtitle}</p>
      </div>
    </div>
  );

  if (!canManage) {
    return (
      <div className="card">
        {header}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-sm text-gray-500 dark:text-gray-400">{tb.investorOnly}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {header}

      <div className="space-y-4">
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-300">{tb.description}</p>
          <p className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden />
            {tb.credentialNote}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => run('json')}
            disabled={busy !== null}
            className="btn-primary flex-1 justify-center inline-flex items-center gap-2 disabled:opacity-60"
          >
            {busy === 'json' ? (
              <>
                <Download className="w-4 h-4 animate-pulse" aria-hidden />
                {tb.preparing}
              </>
            ) : (
              <>
                <FileJson className="w-4 h-4" aria-hidden />
                {tb.downloadJson}
              </>
            )}
          </button>

          <button
            onClick={() => run('excel')}
            disabled={busy !== null}
            className="btn-secondary flex-1 justify-center inline-flex items-center gap-2 disabled:opacity-60"
          >
            {busy === 'excel' ? (
              <>
                <Download className="w-4 h-4 animate-pulse" aria-hidden />
                {tb.preparing}
              </>
            ) : (
              <>
                <Sheet className="w-4 h-4" aria-hidden />
                {tb.downloadExcel}
              </>
            )}
          </button>
        </div>

        {summary && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {tb.lastResult
              .replace('{rows}', summary.rows.toLocaleString('id-ID'))
              .replace('{tables}', String(summary.tables))}
          </p>
        )}
      </div>
    </div>
  );
}
