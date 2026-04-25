'use client';

import { useState } from 'react';
import { DollarSign, Plus, Trash2, Loader2, Calendar } from 'lucide-react';
import type { BusinessOmniChannel, PricingRule } from '@/types';
import { upsertOmniChannel, createPricingRule, deletePricingRule } from '@/lib/api/omniChannel';

interface Props {
  businessId: string;
  userId: string;
  channel: BusinessOmniChannel | null;
  onChanged: () => void;
}

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value);
}

function parseRupiah(value: string): number {
  const cleaned = value.replace(/\D/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
}

function formatDateID(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function OmniChannelPricing({ businessId, userId, channel, onChanged }: Props) {
  const [showPricing, setShowPricing] = useState(channel?.show_pricing ?? false);
  const [defaultPrice, setDefaultPrice] = useState<number>(channel?.default_price ?? 0);
  const [priceUnit, setPriceUnit] = useState(channel?.price_unit ?? '');
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [error, setError] = useState('');

  // Override rule form
  const [ruleDateFrom, setRuleDateFrom] = useState('');
  const [ruleDateTo, setRuleDateTo] = useState('');
  const [rulePrice, setRulePrice] = useState<number>(0);
  const [ruleLabel, setRuleLabel] = useState('');
  const [addingRule, setAddingRule] = useState(false);
  const [ruleError, setRuleError] = useState('');

  const rules = channel?.pricing_rules ?? [];
  const sortedRules = [...rules].sort((a, b) => a.date_from.localeCompare(b.date_from));

  const hasDefaultsChanged =
    showPricing !== (channel?.show_pricing ?? false) ||
    defaultPrice !== (channel?.default_price ?? 0) ||
    priceUnit !== (channel?.price_unit ?? '');

  async function handleSaveDefaults() {
    if (!channel) {
      setError('Buat halaman publik dulu sebelum mengatur harga.');
      return;
    }
    setSavingDefaults(true);
    setError('');
    try {
      await upsertOmniChannel(
        businessId,
        {
          slug: channel.slug,
          title: channel.title,
          tagline: channel.tagline,
          bio: channel.bio,
          logo_url: channel.logo_url ?? null,
          is_published: channel.is_published,
          widget_date_mode: channel.widget_date_mode,
          widget_labels: channel.widget_labels,
          show_pricing: showPricing,
          default_price: defaultPrice > 0 ? defaultPrice : null,
          price_unit: priceUnit.trim() || null,
        },
        userId
      );
      onChanged();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan');
    } finally {
      setSavingDefaults(false);
    }
  }

  async function handleAddRule() {
    if (!ruleDateFrom || !ruleDateTo) {
      setRuleError('Pilih tanggal mulai dan selesai.');
      return;
    }
    if (ruleDateFrom > ruleDateTo) {
      setRuleError('Tanggal mulai harus lebih awal dari tanggal selesai.');
      return;
    }
    if (rulePrice <= 0) {
      setRuleError('Harga harus lebih dari 0.');
      return;
    }
    setAddingRule(true);
    setRuleError('');
    try {
      await createPricingRule(businessId, {
        date_from: ruleDateFrom,
        date_to: ruleDateTo,
        price: rulePrice,
        label: ruleLabel.trim() || null,
      });
      setRuleDateFrom('');
      setRuleDateTo('');
      setRulePrice(0);
      setRuleLabel('');
      onChanged();
    } catch (err: any) {
      setRuleError(err.message || 'Gagal menambah aturan');
    } finally {
      setAddingRule(false);
    }
  }

  async function handleDeleteRule(rule: PricingRule) {
    if (!confirm(`Hapus aturan harga ${formatDateID(rule.date_from)} – ${formatDateID(rule.date_to)}?`)) return;
    try {
      await deletePricingRule(businessId, rule.id);
      onChanged();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus aturan');
    }
  }

  if (!channel) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">Harga Layanan</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Buat halaman publik dulu untuk mengatur harga.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">Harga Layanan</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Tampilkan harga di widget setelah customer pilih tanggal.
            </p>
          </div>
        </div>
      </div>

      {/* Show pricing toggle */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Tampilkan harga di widget
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Calon customer akan melihat total harga sesuai tanggal yang dipilih.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={showPricing}
          onClick={() => setShowPricing(!showPricing)}
          className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            showPricing ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              showPricing ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Default price + unit */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Harga Default
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500">
              Rp
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={defaultPrice ? formatRupiah(defaultPrice) : ''}
              onChange={(e) => setDefaultPrice(parseRupiah(e.target.value))}
              placeholder="0"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Per
          </label>
          <input
            type="text"
            value={priceUnit}
            onChange={(e) => setPriceUnit(e.target.value)}
            placeholder="malam, kunjungan, konten, jam..."
            maxLength={50}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        onClick={handleSaveDefaults}
        disabled={savingDefaults || !hasDefaultsChanged}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {savingDefaults ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Menyimpan...
          </>
        ) : (
          'Simpan Harga Default'
        )}
      </button>

      {/* Override rules */}
      <div className="border-t border-gray-100 dark:border-gray-700 pt-5 space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Harga Khusus per Tanggal
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Override harga untuk rentang tanggal tertentu (misal: high season, weekend, libur).
            Jika tanggal tidak masuk rentang manapun, harga default yang dipakai.
          </p>
        </div>

        {/* Existing rules list */}
        {sortedRules.length > 0 && (
          <div className="space-y-2">
            {sortedRules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50"
              >
                <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {formatDateID(rule.date_from)} – {formatDateID(rule.date_to)}
                    </span>
                    {rule.label && (
                      <span className="px-2 py-0.5 text-[11px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">
                        {rule.label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Rp {formatRupiah(rule.price)}
                    {priceUnit && ` / ${priceUnit}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteRule(rule)}
                  className="shrink-0 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Hapus aturan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new rule */}
        <div className="p-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 space-y-3">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Tambah aturan baru
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">Dari</label>
              <input
                type="date"
                value={ruleDateFrom}
                onChange={(e) => setRuleDateFrom(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">Sampai</label>
              <input
                type="date"
                value={ruleDateTo}
                min={ruleDateFrom || undefined}
                onChange={(e) => setRuleDateTo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">Harga (Rp)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={rulePrice ? formatRupiah(rulePrice) : ''}
                  onChange={(e) => setRulePrice(parseRupiah(e.target.value))}
                  placeholder="0"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                Label <span className="text-gray-400 font-normal">(opsional)</span>
              </label>
              <input
                type="text"
                value={ruleLabel}
                onChange={(e) => setRuleLabel(e.target.value)}
                placeholder="High Season"
                maxLength={100}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          {ruleError && <p className="text-xs text-red-500">{ruleError}</p>}
          <button
            type="button"
            onClick={handleAddRule}
            disabled={addingRule || !ruleDateFrom || !ruleDateTo || rulePrice <= 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-500 dark:border-indigo-500 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {addingRule ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Menambah...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Tambah Aturan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
