'use client';

import { useState } from 'react';
import { Table2, CheckCircle2, AlertTriangle, Unlink, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/context/LanguageContext';
import { useGoogleSheetsConnection } from '@/hooks/useGoogleSheetsConnection';
import { disconnectGoogleSheets } from '@/lib/api/googleSheets';

/**
 * Kartu koneksi Google Sheets di halaman Pengaturan.
 *
 * Integrasi ini PER-USER (bukan per-bisnis), jadi tempatnya di Pengaturan —
 * sejajar dengan kartu Telegram — bukan di konfigurasi bisnis seperti
 * Instagram/WhatsApp.
 */
export function GoogleSheetsCard({ canManage }: { canManage: boolean }) {
  const { t } = useLanguage();
  const ts = t.settings;
  const { status, isConnected, needsReconnect, loading, refresh } = useGoogleSheetsConnection();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Navigasi penuh, bukan fetch: route auth membalas 302 ke Google.
  const startConnect = () => {
    window.location.href = '/api/integrations/google-sheets/auth?returnTo=/settings';
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectGoogleSheets();
      await refresh();
      setConfirmOpen(false);
      toast.success(ts.googleSheetsDisconnect);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memutus koneksi');
    } finally {
      setDisconnecting(false);
    }
  };

  const header = (
    <div className="flex items-center gap-3 mb-5">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          canManage
            ? 'bg-green-100 dark:bg-green-900/30'
            : 'bg-gray-100 dark:bg-gray-700'
        }`}
      >
        <Table2
          className={`w-5 h-5 ${
            canManage
              ? 'text-green-600 dark:text-green-400'
              : 'text-gray-400 dark:text-gray-500'
          }`}
        />
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          {ts.googleSheetsTitle}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{ts.googleSheetsSubtitle}</p>
      </div>
    </div>
  );

  if (!canManage) {
    return (
      <div className="card">
        {header}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-sm text-gray-500 dark:text-gray-400">{ts.googleSheetsInvestorOnly}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {header}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{ts.googleSheetsLoadingStatus}</p>
      ) : needsReconnect ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 px-4 py-3">
            <AlertTriangle
              className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
              aria-hidden
            />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {ts.googleSheetsRevokedHint}
            </p>
          </div>
          <button onClick={startConnect} className="btn-primary w-full justify-center">
            {ts.googleSheetsReconnect}
          </button>
        </div>
      ) : isConnected ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <CheckCircle2
              className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                {status.email || ts.googleSheetsConnected}
              </p>
              {status.connected_at && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {ts.googleSheetsSince}{' '}
                  {new Intl.DateTimeFormat('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }).format(new Date(status.connected_at))}
                </p>
              )}
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {ts.googleSheetsPlaygroundNote}
            </p>
            <p className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden />
              {ts.googleSheetsScopeNote}
            </p>
          </div>

          <button
            onClick={() => setConfirmOpen(true)}
            className="inline-flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
          >
            <Unlink className="w-4 h-4" aria-hidden />
            {ts.googleSheetsDisconnect}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{ts.googleSheetsConnectHint}</p>
          <button onClick={startConnect} className="btn-primary w-full justify-center">
            {ts.googleSheetsConnect}
          </button>
        </div>
      )}

      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={ts.googleSheetsDisconnectTitle}
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmOpen(false)}
              className="btn-secondary flex-1"
              disabled={disconnecting}
            >
              {t.common.cancel}
            </button>
            <button onClick={handleDisconnect} className="btn-danger flex-1" disabled={disconnecting}>
              {disconnecting ? ts.googleSheetsDisconnecting : ts.googleSheetsDisconnect}
            </button>
          </div>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {ts.googleSheetsDisconnectConfirm}
        </p>
      </Modal>
    </div>
  );
}
