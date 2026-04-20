'use client';

import { useState } from 'react';
import { Lock, LockOpen, AlertTriangle } from 'lucide-react';
import type { Business } from '@/types';

interface PeriodLockManagerProps {
  business: Business;
  onClose: () => void;
  onUpdated: (updatedBusiness: Business) => void;
}

export function PeriodLockManager({ business, onClose, onUpdated }: PeriodLockManagerProps) {
  const [date, setDate] = useState(business.closed_until_date ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmUnlock, setConfirmUnlock] = useState(false);

  const isLocked = !!business.closed_until_date;

  const handleSave = async () => {
    if (!date) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${business.id}/period-lock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closed_until_date: date }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan');
      onUpdated({ ...business, closed_until_date: json.data.closed_until_date });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUnlock = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${business.id}/period-lock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closed_until_date: null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal membuka kunci');
      onUpdated({ ...business, closed_until_date: null });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
      setConfirmUnlock(false);
    }
  };

  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Transaksi dengan tanggal pada atau sebelum periode terkunci tidak dapat diedit atau dihapus.
      </p>

      {isLocked && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400 text-sm">
          <Lock className="w-4 h-4 flex-shrink-0" />
          <span>Periode terkunci hingga <strong>{business.closed_until_date}</strong></span>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Kunci hingga tanggal
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!date || saving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Lock className="w-4 h-4" />
          {saving ? 'Menyimpan...' : 'Kunci Periode'}
        </button>

        {isLocked && !confirmUnlock && (
          <button
            onClick={() => setConfirmUnlock(true)}
            className="btn-ghost flex items-center gap-2"
          >
            <LockOpen className="w-4 h-4" />
            Buka Kunci
          </button>
        )}
      </div>

      {confirmUnlock && (
        <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">
              Membuka kunci akan mengizinkan pengeditan transaksi di periode lama. Lanjutkan?
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleUnlock}
              disabled={saving}
              className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? 'Memproses...' : 'Ya, Buka Kunci'}
            </button>
            <button
              onClick={() => setConfirmUnlock(false)}
              className="btn-ghost flex-1"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
