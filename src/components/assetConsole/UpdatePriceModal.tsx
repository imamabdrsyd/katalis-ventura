'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { CurrencyInputWithCalculator } from '@/components/ui/CurrencyInputWithCalculator';
import { useLanguage } from '@/context/LanguageContext';
import type { AssetHolding } from '@/lib/assetConsole';

interface UpdatePriceModalProps {
  holding: AssetHolding | null;
  onClose: () => void;
  onSave: (itemId: string, price: number) => Promise<void>;
}

export function UpdatePriceModal({ holding, onClose, onSave }: UpdatePriceModalProps) {
  const { t } = useLanguage();
  const ta = t.assetConsole;
  const [price, setPrice] = useState(0);
  const [display, setDisplay] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPrice(holding?.lastPrice ?? 0);
    setDisplay(holding?.lastPrice ? holding.lastPrice.toLocaleString('id-ID') : '');
  }, [holding]);

  async function handleSave() {
    if (!holding) return;
    setSaving(true);
    try {
      await onSave(holding.itemId, price);
      toast.success(ta.updatePriceTitle);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ta.updatePriceTitle);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={!!holding}
      onClose={onClose}
      title={`${ta.updatePriceTitle}${holding ? ` — ${holding.symbol}` : ''}`}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-ghost flex-1" disabled={saving}>
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn-primary flex-1"
            disabled={saving}
          >
            {saving ? t.common.saving : ta.updatePriceSave}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <CurrencyInputWithCalculator
          label={`${ta.updatePriceLabel}${holding?.priceUnit ? ` / ${holding.priceUnit}` : ''}`}
          displayValue={display}
          onChange={(val, disp) => {
            setPrice(val);
            setDisplay(disp);
          }}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">{ta.updatePriceHint}</p>
      </div>
    </Modal>
  );
}
