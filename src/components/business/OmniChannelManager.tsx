'use client';

import { useState, useEffect, useCallback } from 'react';
import { Globe, ExternalLink, Link2 } from 'lucide-react';
import type { BusinessOmniChannel, OmniChannelLink } from '@/types';
import { getOmniChannel, upsertOmniChannel } from '@/lib/api/omniChannel';
import { OmniChannelPageConfig } from './OmniChannelPageConfig';
import { OmniChannelLinkList } from './OmniChannelLinkList';
import { OmniChannelGallery } from './OmniChannelGallery';
import { OmniChannelShowcase } from './OmniChannelShowcase';
import { OmniChannelPricing } from './OmniChannelPricing';
import { OmniChannelFeaturedProductConfig } from './OmniChannelFeaturedProductConfig';

interface Props {
  businessId: string;
  businessName: string;
  userId: string;
}

/** Toggle kecil yang konsisten dipakai di tiap section header */
function VisibilityToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        disabled={disabled}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
        title={checked ? 'Tampil di halaman publik' : 'Disembunyikan dari halaman publik'}
      >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
      <span className="text-xs text-gray-400 dark:text-gray-500">
        {checked ? 'Tampil' : 'Disembunyikan'}
      </span>
    </div>
  );
}

export function OmniChannelManager({ businessId, businessName, userId }: Props) {
  const [channel, setChannel] = useState<BusinessOmniChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingWidget, setTogglingWidget] = useState(false);
  const [togglingLinks, setTogglingLinks] = useState(false);

  const fetchChannel = useCallback(async () => {
    try {
      const data = await getOmniChannel(businessId);
      setChannel(data);
    } catch (err) {
      console.error('Failed to fetch omni-channel:', err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchChannel();
  }, [fetchChannel]);

  async function toggleField(
    field: 'show_widget' | 'show_links',
    current: boolean,
    setSaving: (v: boolean) => void
  ) {
    if (!channel) return;
    setSaving(true);
    // optimistic update
    setChannel((prev) => prev ? { ...prev, [field]: !current } : prev);
    try {
      await upsertOmniChannel(businessId, {
        slug: channel.slug,
        title: channel.title,
        tagline: channel.tagline,
        bio: channel.bio,
        logo_url: channel.logo_url ?? null,
        is_published: channel.is_published,
        widget_date_mode: channel.widget_date_mode,
        widget_labels: channel.widget_labels,
        show_pricing: channel.show_pricing,
        show_gallery: channel.show_gallery,
        show_showcase: channel.show_showcase,
        show_widget: field === 'show_widget' ? !current : channel.show_widget,
        show_links: field === 'show_links' ? !current : channel.show_links,
      }, userId);
      fetchChannel();
    } catch {
      // revert
      setChannel((prev) => prev ? { ...prev, [field]: current } : prev);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
              Halaman Publik
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Konfigurasi tampilan halaman publik bisnis kamu
            </p>
          </div>
        </div>

        {channel?.is_published && channel.slug && (
          <a
            href={`/${channel.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Lihat Halaman
          </a>
        )}
      </div>

      {/* 2-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Panel Kiri — Pengaturan & Konten */}
        <div className="space-y-5">
          {/* Page Config */}
          <OmniChannelPageConfig
            businessId={businessId}
            businessName={businessName}
            userId={userId}
            channel={channel}
            onSaved={fetchChannel}
          />

          {/* Pricing */}
          <OmniChannelPricing
            businessId={businessId}
            userId={userId}
            channel={channel}
            onChanged={fetchChannel}
          />

          {/* Featured Product */}
          {channel && (
            <OmniChannelFeaturedProductConfig
              businessId={businessId}
              userId={userId}
              channel={channel}
              onChanged={fetchChannel}
            />
          )}

          {/* Widget Utama toggle */}
          {channel && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
                  Widget Utama
                </h3>
                <VisibilityToggle
                  checked={channel.show_widget ?? true}
                  onChange={() => toggleField('show_widget', channel.show_widget ?? true, setTogglingWidget)}
                  disabled={togglingWidget}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Widget reservasi (bisnis jasa) atau kartu link (bisnis produk/dagang).
              </p>
            </div>
          )}

          {/* Daftar Link */}
          {channel && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
                    Daftar Link
                  </h3>
                </div>
                <VisibilityToggle
                  checked={channel.show_links ?? true}
                  onChange={() => toggleField('show_links', channel.show_links ?? true, setTogglingLinks)}
                  disabled={togglingLinks}
                />
              </div>
              <OmniChannelLinkList
                omniChannelId={channel.id}
                businessId={businessId}
                links={channel.links ?? []}
                onChanged={fetchChannel}
              />
            </div>
          )}
        </div>

        {/* Panel Kanan — Media Visual */}
        <div className="space-y-5">
          <OmniChannelGallery
            businessId={businessId}
            userId={userId}
            channel={channel}
            initialGallery={channel?.gallery_images ?? []}
            hasOmniChannel={!!channel}
            onChanged={fetchChannel}
          />

          <OmniChannelShowcase
            businessId={businessId}
            userId={userId}
            channel={channel}
            initialShowcase={channel?.showcase_images ?? []}
            hasOmniChannel={!!channel}
            onChanged={fetchChannel}
          />
        </div>

      </div>
    </div>
  );
}
