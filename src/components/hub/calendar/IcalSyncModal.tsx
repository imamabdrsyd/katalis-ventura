'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Copy, Check, RefreshCw, Link2, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { CatalogItem } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase';
import { updateCatalogItem } from '@/lib/api/catalog';

interface IcalSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  units: CatalogItem[];
  onSynced: () => void; // reload units + calendar
}

/**
 * Kelola sinkronisasi iCal per unit:
 *  - IMPOR: tempel URL feed .ics OTA (Airbnb/Booking.com) → blok tanggal terisi.
 *  - EKSPOR: salin URL feed .ics AXION → dipasang di OTA agar OTA blokir tanggal
 *    yang dibooking langsung.
 */
export function IcalSyncModal({ isOpen, onClose, businessId, units, onSynced }: IcalSyncModalProps) {
  const [feedToken, setFeedToken] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setUrls(Object.fromEntries(units.map((u) => [u.id, u.ical_import_url ?? ''])));
    // Ambil token feed ekspor bisnis
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

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const exportUrl = useCallback(
    (unitId: string) =>
      feedToken ? `${origin}/api/calendar/feed/${feedToken}?unit=${unitId}` : '',
    [feedToken, origin]
  );

  const handleSaveUrl = async (unit: CatalogItem) => {
    setSavingId(unit.id);
    try {
      await updateCatalogItem(unit.id, { ical_import_url: urls[unit.id]?.trim() || null });
      toast.success(`URL impor "${unit.name}" disimpan`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan URL');
    } finally {
      setSavingId(null);
    }
  };

  const handleCopy = async (key: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error('Gagal menyalin');
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
      if (!res.ok) throw new Error(data?.error ?? 'Sync gagal');
      toast.success(
        `Sinkronisasi selesai: ${data.imported + data.updated} blok, ${data.removed} dihapus`
      );
      onSynced();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync gagal');
    } finally {
      setSyncing(false);
    }
  };

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <button type="button" onClick={onClose} className="btn-ghost">
        Tutup
      </button>
      <button
        type="button"
        onClick={handleSyncNow}
        disabled={syncing}
        className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
      >
        {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        Sync sekarang
      </button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sinkronisasi kalender OTA (iCal)" size="2xl" footer={footer}>
      <div className="space-y-5">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 flex items-start gap-3">
          <Link2 className="w-4 h-4 text-primary-500 mt-0.5 shrink-0" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Hubungkan tiap unit dengan Airbnb & Booking.com lewat iCal. <b>Impor</b> memblokir
            tanggal yang terisi di OTA; <b>Ekspor</b> memberi tahu OTA tanggal yang kamu booking
            langsung. Sinkronisasi otomatis berjalan harian — atau tekan <b>Sync sekarang</b>.
          </p>
        </div>

        {units.map((unit) => (
          <div
            key={unit.id}
            className="border border-gray-100 dark:border-gray-700 rounded-xl p-4 space-y-3"
          >
            <p className="font-semibold text-gray-900 dark:text-gray-100">{unit.name}</p>

            {/* Impor */}
            <div>
              <label className="label flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 text-gray-400" /> URL impor dari OTA
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  className="input flex-1"
                  placeholder="https://www.airbnb.com/calendar/ical/...ics"
                  value={urls[unit.id] ?? ''}
                  onChange={(e) => setUrls((p) => ({ ...p, [unit.id]: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => handleSaveUrl(unit)}
                  disabled={savingId === unit.id}
                  className="btn-ghost shrink-0"
                >
                  {savingId === unit.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan'}
                </button>
              </div>
            </div>

            {/* Ekspor */}
            <div>
              <label className="label flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-gray-400" /> URL ekspor AXION (pasang di OTA)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  className="input flex-1 text-xs text-gray-500 dark:text-gray-400"
                  value={exportUrl(unit.id) || 'Memuat…'}
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
                  Salin
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
