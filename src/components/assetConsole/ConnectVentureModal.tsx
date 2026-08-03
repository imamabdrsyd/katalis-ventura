'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Info } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { FloatingSelect } from '@/components/ui/FloatingField';
import { useLanguage } from '@/context/LanguageContext';
import { useBusinessContext } from '@/context/BusinessContext';
import { connectVenture, getVentureStockAccounts, type VentureStockAccountOption } from '@/lib/api/venture';

interface ConnectVentureModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Bisnis pemantau — tempat baris venture disimpan. */
  businessId: string;
  /** Akun ekuitas yang SUDAH ditautkan, supaya tidak bisa dipilih dua kali. */
  linkedAccountIds: string[];
  onConnected: () => Promise<void> | void;
}

/**
 * Tautkan kepemilikan di bisnis lain ke Asset Console.
 *
 * Dua dropdown berurutan (bisnis → akun ekuitas), bukan form item katalog:
 * venture bukan barang yang dijual, jadi tidak ada nama/SKU/harga yang perlu
 * diketik. Yang dipilih user hanyalah "posisi mana", sisanya dihitung dari buku
 * besar bisnis target.
 */
export function ConnectVentureModal({
  isOpen,
  onClose,
  businessId,
  linkedAccountIds,
  onConnected,
}: ConnectVentureModalProps) {
  const { t } = useLanguage();
  const ta = t.assetConsole;
  const { businesses } = useBusinessContext();

  const [targetId, setTargetId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState<VentureStockAccountOption[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [saving, setSaving] = useState(false);

  // Bisnis pemantau tidak masuk daftar: kepemilikan di dirinya sendiri sudah
  // tampil di Neraca/SCE-nya, menautkannya ke sini hanya menghitung ganda.
  const candidates = businesses.filter((b) => b.id !== businessId && !b.is_archived);

  useEffect(() => {
    if (!isOpen) {
      setTargetId('');
      setAccountId('');
      setAccounts([]);
    }
  }, [isOpen]);

  useEffect(() => {
    setAccountId('');
    setAccounts([]);
    if (!targetId) return;

    let cancelled = false;
    setLoadingAccounts(true);
    getVentureStockAccounts(targetId, linkedAccountIds)
      .then((rows) => {
        if (!cancelled) setAccounts(rows);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : ta.ventureNoAccounts);
      })
      .finally(() => {
        if (!cancelled) setLoadingAccounts(false);
      });

    return () => {
      cancelled = true;
    };
    // linkedAccountIds sengaja tidak jadi dependency: array baru tiap render
    // induk akan memicu fetch berulang tanpa ada perubahan nyata.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  const selectable = accounts.filter((a) => !a.alreadyLinked);
  const canSubmit = !!targetId && !!accountId && !saving;

  async function handleSubmit() {
    const target = candidates.find((b) => b.id === targetId);
    if (!target || !accountId) return;

    setSaving(true);
    try {
      await connectVenture({
        businessId,
        targetBusinessId: target.id,
        targetBusinessName: target.business_name,
        stockAccountId: accountId,
      });
      await onConnected();
      toast.success(ta.connectVentureTitle);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ta.connectVentureTitle);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={ta.connectVentureTitle}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-ghost flex-1" disabled={saving}>
            {t.common.cancel}
          </button>
          <button type="button" onClick={handleSubmit} className="btn-primary flex-1" disabled={!canSubmit}>
            {saving ? t.common.saving : ta.ventureSubmit}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-gray-500 dark:text-gray-400">{ta.connectVentureDesc}</p>

        {candidates.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{ta.ventureNoBusiness}</p>
        ) : (
          <>
            <FloatingSelect
              label={ta.ventureBusinessLabel}
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              <option value="" />
              {candidates.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.business_name}
                </option>
              ))}
            </FloatingSelect>

            {/* Dropdown kedua baru bermakna setelah bisnis dipilih — akun
                ekuitas milik siapa pun hanya ada dalam konteks satu bisnis. */}
            {targetId && (
              <div>
                <FloatingSelect
                  label={ta.ventureAccountLabel}
                  value={accountId}
                  disabled={loadingAccounts || selectable.length === 0}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  <option value="" />
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id} disabled={a.alreadyLinked}>
                      {a.account_code} — {a.account_name}
                      {a.alreadyLinked ? ` (${ta.ventureAccountLinked})` : ''}
                    </option>
                  ))}
                </FloatingSelect>

                <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                  {loadingAccounts
                    ? t.common.loading
                    : accounts.length === 0
                      ? ta.ventureNoAccounts
                      : ta.ventureAccountHint}
                </p>
              </div>
            )}
          </>
        )}

        <p className="flex items-start gap-2 text-xs text-gray-400 dark:text-gray-500">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden />
          {ta.ventureSourceNote}
        </p>
      </div>
    </Modal>
  );
}
