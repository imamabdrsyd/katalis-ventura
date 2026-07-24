'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Copy, Check, RefreshCw, Link2, Upload, Download } from 'lucide-react';
import { toast } from 'sonner';
import type { BusinessUnit } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase';
import { updateUnit } from '@/lib/api/units';
import { useLanguage } from '@/context/LanguageContext';

interface IcalSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  units: BusinessUnit[];
  onSynced: () => void; // reload units + calendar
}

/**
 * Sinkronisasi iCal per unit fisik ("Connect to another website"):
 *  - IMPOR (blok tanggal terisi OTA): atur URL feed Airbnb/Booking.com per unit
 *    di sini (business_units.ical_import_url).
 *  - EKSPOR: salin URL feed .ics AXION per unit → pasang di Airbnb/Booking.com
 *    agar OTA memblokir tanggal yang kamu booking langsung.
 * Sync otomatis harian, atau tekan "Sync sekarang".
 */
export function IcalSyncModal({ isOpen, onClose, businessId, units, onSynced }: IcalSyncModalProps) {
  const { t } = useLanguage();
  const c = t.calendar;
  const [feedToken, setFeedToken] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  // Draft URL impor per unit (disimpan on-blur ke business_units.ical_import_url).
  const [importDrafts, setImportDrafts] = useState<Record<string, string>>({});
  const [savingImport, setSavingImport] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setImportDrafts(Object.fromEntries(units.map((u) => [u.id, u.ical_import_url ?? ''])));
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('businesses')
        .select('ical_feed_token')
        .eq('id', businessId)
        .maybeSingle();
      setFeedToken((data?.ical_feed_token as string | null) ?? null);
    })();
  }, [isOpen, businessId, units]);

  const handleImportBlur = useCallback(
    async (unit: BusinessUnit) => {
      const draft = (importDrafts[unit.id] ?? '').trim();
      if (draft === (unit.ical_import_url ?? '')) return;
      setSavingImport(unit.id);
      try {
        await updateUnit(unit.id, { ical_import_url: draft || null });
        onSynced();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : c.icToastSaveFailed);
      } finally {
        setSavingImport(null);
      }
    },
    [importDrafts, onSynced, c]
  );

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const exportUrl = useCallback(
    (unitId: string) =>
      feedToken ? `${origin}/api/calendar/feed/${feedToken}?unit=${unitId}` : '',
    [feedToken, origin]
  );

  const handleCopy = async (key: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error(c.icToastCopyFailed);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/calendar/ical/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ businessId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? c.icToastSyncFailed);
      toast.success(
        c.icToastSyncDone
          .replace('{blocks}', String(data.imported + data.updated))
          .replace('{removed}', String(data.removed))
      );
      onSynced();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : c.icToastSyncFailed);
    } finally {
      setSyncing(false);
    }
  };

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <button type="button" onClick={onClose} className="btn-ghost">
        {c.icClose}
      </button>
      <button
        type="button"
        onClick={handleSyncNow}
        disabled={syncing}
        className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
      >
        {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        {c.icSyncNow}
      </button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={c.icTitle} size="2xl" footer={footer}>
      <div className="space-y-5">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 flex items-start gap-3">
          <Link2 className="w-4 h-4 text-primary-500 mt-0.5 shrink-0" />
          <p className="text-sm text-gray-600 dark:text-gray-400">{c.icIntro}</p>
        </div>

        {units.map((unit) => (
          <div
            key={unit.id}
            className="border border-gray-100 dark:border-gray-700 rounded-xl p-4 space-y-3"
          >
            <p className="font-semibold text-gray-900 dark:text-gray-100">{unit.name}</p>

            {/* IMPOR: URL feed OTA yang kita baca (blok tanggal terisi di Airbnb/Booking) */}
            <div>
              <label className="label flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 text-gray-400" /> {c.icImportLabel}
              </label>
              <div className="relative">
                <input
                  type="url"
                  className="input pr-8"
                  placeholder="https://www.airbnb.com/calendar/ical/...ics"
                  value={importDrafts[unit.id] ?? ''}
                  onChange={(e) => setImportDrafts((p) => ({ ...p, [unit.id]: e.target.value }))}
                  onBlur={() => handleImportBlur(unit)}
                />
                {savingImport === unit.id && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                )}
              </div>
            </div>

            {/* EKSPOR: URL feed AXION yang dipasang di OTA */}
            <div>
              <label className="label flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-gray-400" /> {c.icExportLabel}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  className="input flex-1 text-xs text-gray-500 dark:text-gray-400"
                  value={exportUrl(unit.id) || c.icLoading}
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  onClick={() => handleCopy(unit.id, exportUrl(unit.id))}
                  disabled={!feedToken}
                  className="btn-ghost shrink-0 inline-flex items-center gap-1.5"
                >
                  {copied === unit.id ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  {c.icCopy}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
