'use client';

/**
 * Dialog pembayaran POS (pakai <Modal> standar — bukan full-screen).
 *
 * - Tunai: input jumlah uang diterima → tampilkan kembalian → Konfirmasi.
 * - QRIS : tampilkan foto QRIS statis bisnis untuk discan. Bila belum ada,
 *          manager bisa upload sekali (Cloudinary, disimpan ke businesses.qris_image_url).
 *
 * onConfirm men-trigger checkout di parent (useCashier). Modal hanya UI bayar.
 */

import { useEffect, useState } from 'react';
import { QrCode, Banknote, Loader2, Upload, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { CurrencyInputWithCalculator } from '@/components/ui/CurrencyInputWithCalculator';
import { updateBusiness } from '@/lib/api/businesses';
import type { PaymentMethod } from '@/hooks/useCashier';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  method: PaymentMethod;
  total: number;
  qrisImageUrl: string | null;
  businessId: string;
  submitting: boolean;
  onConfirm: () => void | Promise<void>;
}

export function PaymentModal({
  isOpen,
  onClose,
  method,
  total,
  qrisImageUrl,
  businessId,
  submitting,
  onConfirm,
}: PaymentModalProps) {
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [cashDisplay, setCashDisplay] = useState<string>('');
  const [localQris, setLocalQris] = useState<string | null>(qrisImageUrl);
  const [uploading, setUploading] = useState(false);

  useEffect(() => setLocalQris(qrisImageUrl), [qrisImageUrl]);
  // Reset uang diterima setiap modal dibuka
  useEffect(() => {
    if (isOpen) {
      setCashReceived(0);
      setCashDisplay('');
    }
  }, [isOpen]);

  function pickCash(amount: number) {
    setCashReceived(amount);
    setCashDisplay(amount > 0 ? amount.toLocaleString('id-ID') : '');
  }

  const change = cashReceived - total;
  const cashEnough = cashReceived >= total;

  async function handleUploadQris(file: File) {
    setUploading(true);
    try {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);
      formData.append('folder', `axion/qris/${businessId}`);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Gagal upload ke Cloudinary');
      }
      const { secure_url } = await res.json();
      const displayUrl = secure_url.replace(/\/upload\//, '/upload/f_jpg/');
      await updateBusiness(businessId, { qris_image_url: displayUrl });
      setLocalQris(displayUrl);
      toast.success('QRIS tersimpan');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal upload QRIS');
    } finally {
      setUploading(false);
    }
  }

  const canConfirm = method === 'qris' ? !!localQris : cashEnough;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      // Dibuka dari overlay Mode Kasir (`z-[80]`) — default z-50 akan tertimbun.
      zIndexClassName="z-[90]"
      title={
        <span className="flex items-center gap-2">
          {method === 'qris' ? (
            <QrCode className="w-5 h-5 text-primary-500 dark:text-primary-400" />
          ) : (
            <Banknote className="w-5 h-5 text-primary-500 dark:text-primary-400" />
          )}
          {method === 'qris' ? 'Pembayaran QRIS' : 'Pembayaran Tunai'}
        </span>
      }
      footer={
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary px-4">
            Batal
          </button>
          <button
            type="button"
            onClick={() => onConfirm()}
            disabled={!canConfirm || submitting}
            className="btn-primary-glow px-5 flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Konfirmasi Bayar
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Total */}
        <div className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">Total tagihan</span>
          <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(total)}
          </span>
        </div>

        {method === 'qris' ? (
          <div>
            {localQris ? (
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Minta pelanggan scan kode di bawah:
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={localQris}
                  alt="QRIS"
                  className="w-56 h-56 object-contain rounded-xl border border-gray-200 dark:border-gray-700 bg-white"
                />
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 text-center">
                <QrCode className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Belum ada foto QRIS. Upload sekali untuk dipakai di semua transaksi.
                </p>
                <label className="btn-secondary inline-flex items-center gap-2 cursor-pointer">
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Upload QRIS
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadQris(f);
                    }}
                  />
                </label>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <CurrencyInputWithCalculator
                label="Uang diterima"
                displayValue={cashDisplay}
                onChange={(numeric, display) => {
                  setCashReceived(numeric);
                  setCashDisplay(display);
                }}
                placeholder="0"
                autoFocus
              />
            </div>
            {/* Tombol nominal cepat */}
            <div className="flex flex-wrap gap-2">
              <QuickAmount label="Uang pas" amount={total} onPick={pickCash} />
              {[50000, 100000, 150000, 200000]
                .filter((n) => n > total)
                .slice(0, 3)
                .map((n) => (
                  <QuickAmount key={n} label={formatCurrency(n)} amount={n} onPick={pickCash} />
                ))}
            </div>
            <div className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">Kembalian</span>
              <span
                className={[
                  'text-lg font-bold',
                  change < 0
                    ? 'text-red-500 dark:text-red-400'
                    : 'text-emerald-600 dark:text-emerald-400',
                ].join(' ')}
              >
                {formatCurrency(Math.max(0, change))}
              </span>
            </div>
            {!cashEnough && cashReceived > 0 && (
              <p className="text-sm text-red-500 dark:text-red-400">
                Uang diterima kurang dari total.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function QuickAmount({
  label,
  amount,
  onPick,
}: {
  label: string;
  amount: number;
  onPick: (n: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(amount)}
      className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
    >
      {label}
    </button>
  );
}
