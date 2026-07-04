'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Copy, Check, RefreshCw, Link2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { BusinessUnit } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase';

interface IcalSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  units: BusinessUnit[];
  onSynced: () => void; // reload units + calendar
}

/**
 * Sinkronisasi iCal per unit fisik:
 *  - IMPOR (blok tanggal terisi OTA): atur URL feed di "Kelola Unit"
 *    (business_units.ical_import_url) — modal ini hanya memicu sync-nya.
 *  - EKSPOR: salin URL feed .ics AXION per unit → pasang di Airbnb/Booking.com
 *    agar OTA memblokir tanggal yang kamu booking langsung.
 */
export function IcalSyncModal({ isOpen, onClose, businessId, units, onSynced }: IcalSyncModalProps) {
  const [feedToken, setFeedToken] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('businesses')
        .select('ical_feed_token')
        .eq('id', businessId)
        .maybeSingle();
      setFeedToken((data?.ical_feed_token as string | null) ?? null);
    })();
  }, [isOpen, businessId]);

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
            Hubungkan tiap unit dengan Airbnb & Booking.com lewat iCal. URL <b>impor</b> (memblokir
            tanggal terisi OTA) diatur di <b>Kelola Unit</b>. Salin URL <b>ekspor</b> di bawah ke
            OTA agar mereka memblokir tanggal yang kamu booking langsung. Sinkronisasi otomatis
            berjalan harian — atau tekan <b>Sync sekarang</b>.
          </p>
        </div>

        {units.map((unit) => (
          <div
            key={unit.id}
            className="border border-gray-100 dark:border-gray-700 rounded-xl p-4 space-y-3"
          >
            <p className="font-semibold text-gray-900 dark:text-gray-100">{unit.name}</p>

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
