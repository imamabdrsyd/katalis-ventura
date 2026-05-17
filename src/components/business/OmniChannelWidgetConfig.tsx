'use client';

import { useState, useEffect, useRef } from 'react';
import { CalendarDays, Calendar, Loader2, Check } from 'lucide-react';
import type { BusinessOmniChannel, OmniChannelWidgetLabels } from '@/types';
import { upsertOmniChannel } from '@/lib/api/omniChannel';

interface Props {
  businessId: string;
  userId: string;
  channel: BusinessOmniChannel;
  onSaved: () => void;
  /** Skip outer card chrome — untuk dipasang di dalam card parent */
  bare?: boolean;
}

/**
 * Konfigurasi label & mode tanggal widget reservasi.
 * Diekstrak dari OmniChannelPageConfig agar tidak menggumpal di satu card besar.
 */
export function OmniChannelWidgetConfig({ businessId, userId, channel, onSaved, bare = false }: Props) {
  const [widgetDateMode, setWidgetDateMode] = useState<'single' | 'double'>(channel.widget_date_mode ?? 'double');
  const [widgetLabels, setWidgetLabels] = useState<OmniChannelWidgetLabels>(channel.widget_labels ?? {});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  const savedRef = useRef({
    widgetDateMode: channel.widget_date_mode ?? 'double',
    widgetLabels: JSON.stringify(channel.widget_labels ?? {}),
  });

  // Sync local state ketika channel berubah dari luar (mis. setelah fetch)
  useEffect(() => {
    const nextMode = channel.widget_date_mode ?? 'double';
    const nextLabels = channel.widget_labels ?? {};
    setWidgetDateMode(nextMode);
    setWidgetLabels(nextLabels);
    savedRef.current = {
      widgetDateMode: nextMode,
      widgetLabels: JSON.stringify(nextLabels),
    };
  }, [channel.widget_date_mode, channel.widget_labels]);

  const hasChanges =
    widgetDateMode !== savedRef.current.widgetDateMode ||
    JSON.stringify(widgetLabels) !== savedRef.current.widgetLabels;

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    try {
      await upsertOmniChannel(
        businessId,
        {
          slug: channel.slug,
          title: channel.title,
          tagline: channel.tagline,
          bio: channel.bio,
          logo_url: channel.logo_url ?? null,
          banner_url: channel.banner_url ?? null,
          is_published: channel.is_published,
          layout_mode: channel.layout_mode,
          widget_date_mode: widgetDateMode,
          widget_labels: widgetLabels,
          show_pricing: channel.show_pricing,
          show_gallery: channel.show_gallery,
          show_showcase: channel.show_showcase,
          show_widget: channel.show_widget,
          show_links: channel.show_links,
          button_color: channel.button_color ?? null,
          banner_position: channel.banner_position ?? null,
        },
        userId,
      );
      savedRef.current = {
        widgetDateMode,
        widgetLabels: JSON.stringify(widgetLabels),
      };
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      onSaved();
    } catch (err: any) {
      setSaveError(err?.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  const containerClass = bare
    ? 'space-y-4'
    : 'bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4';

  return (
    <div className={containerClass}>
      {!bare && (
        <div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
            Konfigurasi Widget Reservasi
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Atur mode tanggal & label-label di widget reservasi.
          </p>
        </div>
      )}

      {/* Date mode toggle */}
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
          Mode Tanggal
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setWidgetDateMode('double')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
              widgetDateMode === 'double'
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Check-in & Check-out
          </button>
          <button
            type="button"
            onClick={() => setWidgetDateMode('single')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
              widgetDateMode === 'single'
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Satu Tanggal
          </button>
        </div>
      </div>

      {/* Label fields */}
      <div className="grid grid-cols-1 gap-3">
        {widgetDateMode === 'single' ? (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Label Tanggal
            </label>
            <input
              type="text"
              value={widgetLabels.date_label ?? ''}
              onChange={(e) => setWidgetLabels((l) => ({ ...l, date_label: e.target.value }))}
              placeholder="Tanggal Kunjungan"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Label Check-in
              </label>
              <input
                type="text"
                value={widgetLabels.checkin_label ?? ''}
                onChange={(e) => setWidgetLabels((l) => ({ ...l, checkin_label: e.target.value }))}
                placeholder="Check-in"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Label Check-out
              </label>
              <input
                type="text"
                value={widgetLabels.checkout_label ?? ''}
                onChange={(e) => setWidgetLabels((l) => ({ ...l, checkout_label: e.target.value }))}
                placeholder="Check-out"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Label Catatan
            </label>
            <input
              type="text"
              value={widgetLabels.note_label ?? ''}
              onChange={(e) => setWidgetLabels((l) => ({ ...l, note_label: e.target.value }))}
              placeholder="Catatan (opsional)"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Placeholder Catatan
            </label>
            <input
              type="text"
              value={widgetLabels.note_placeholder ?? ''}
              onChange={(e) => setWidgetLabels((l) => ({ ...l, note_placeholder: e.target.value }))}
              placeholder="misal: 2 tamu, butuh parkir"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Label Tombol WA
            </label>
            <input
              type="text"
              value={widgetLabels.cta_label ?? ''}
              onChange={(e) => setWidgetLabels((l) => ({ ...l, cta_label: e.target.value }))}
              placeholder="Kirim rencana via WhatsApp"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Kata Aksi (di pesan WA)
            </label>
            <input
              type="text"
              value={widgetLabels.action_label ?? ''}
              onChange={(e) => setWidgetLabels((l) => ({ ...l, action_label: e.target.value }))}
              placeholder="kunjungan"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Label Dibawah Tombol Reservasi
          </label>
          <input
            type="text"
            value={widgetLabels.reservation_subtitle ?? ''}
            onChange={(e) => setWidgetLabels((l) => ({ ...l, reservation_subtitle: e.target.value }))}
            placeholder="Tidak ada komitmen — pemilik akan konfirmasi ketersediaan"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {saveError && (
        <p className="text-sm text-red-500">{saveError}</p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !hasChanges}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Menyimpan...
          </>
        ) : savedFlash ? (
          <>
            <Check className="w-4 h-4" />
            Tersimpan
          </>
        ) : (
          'Simpan Perubahan Widget'
        )}
      </button>
    </div>
  );
}
