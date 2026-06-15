'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link2, Loader2, Phone, Check, DollarSign } from 'lucide-react';
import type { BusinessOmniChannel, Business } from '@/types';
import { getOmniChannel, upsertOmniChannel } from '@/lib/api/omniChannel';
import * as businessesApi from '@/lib/api/businesses';
import { OmniChannelPageConfig } from './OmniChannelPageConfig';
import { OmniChannelLinkList } from './OmniChannelLinkList';
import { OmniChannelGallery } from './OmniChannelGallery';
import { OmniChannelShowcase } from './OmniChannelShowcase';
import { OmniChannelPricing } from './OmniChannelPricing';
import { OmniChannelFeaturedProductConfig } from './OmniChannelFeaturedProductConfig';
import { OmniChannelWidgetConfig } from './OmniChannelWidgetConfig';
import { ConfigSection } from './ConfigSection';
import { OmniChannelPreview } from './OmniChannelPreview';
import {
  type SurfaceFilter,
} from './omniChannelSurfaceMap';

interface Props {
  business: Business;
  userId: string;
  onBusinessUpdated?: (b: Business) => void;
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
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-gray-900 dark:bg-gray-100' : 'bg-gray-300 dark:bg-gray-600'}`}
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

export function OmniChannelManager({ business, userId, onBusinessUpdated }: Props) {
  const businessId = business.id;
  const businessName = business.business_name;

  const [channel, setChannel] = useState<BusinessOmniChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingWidget, setTogglingWidget] = useState(false);
  const [togglingLinks, setTogglingLinks] = useState(false);
  const [togglingLanding, setTogglingLanding] = useState(false);
  const [activeFilter, setActiveFilter] = useState<SurfaceFilter>('all');

  // Widget contact fields — disimpan di tabel businesses (bukan omni_channels)
  const [whatsappNumber, setWhatsappNumber] = useState(business.whatsapp_number ?? '');
  const [widgetActionLabel, setWidgetActionLabel] = useState(business.widget_action_label ?? '');
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [savingContact, setSavingContact] = useState<'whatsapp_number' | 'widget_action_label' | null>(null);
  const [contactSavedFlash, setContactSavedFlash] = useState<string | null>(null);
  const savedContactRef = useRef({
    whatsapp_number: business.whatsapp_number ?? '',
    widget_action_label: business.widget_action_label ?? '',
  });

  // Sync local state kalau business prop berubah dari luar
  useEffect(() => {
    setWhatsappNumber(business.whatsapp_number ?? '');
    setWidgetActionLabel(business.widget_action_label ?? '');
    savedContactRef.current = {
      whatsapp_number: business.whatsapp_number ?? '',
      widget_action_label: business.widget_action_label ?? '',
    };
  }, [business.whatsapp_number, business.widget_action_label]);

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
      setChannel((prev) => prev ? { ...prev, [field]: current } : prev);
    } finally {
      setSaving(false);
    }
  }

  async function saveContactField(field: 'whatsapp_number' | 'widget_action_label', value: string) {
    const trimmed = value.trim();
    const saved = savedContactRef.current[field];
    if (trimmed === saved) return; // no change

    // Validasi nomor WA
    if (field === 'whatsapp_number' && trimmed && !/^\d{10,}$/.test(trimmed)) {
      setWhatsappError('Hanya angka, minimal 10 digit (contoh: 6281234567890)');
      return;
    }
    if (field === 'whatsapp_number') setWhatsappError(null);

    setSavingContact(field);
    try {
      const updated = await businessesApi.updateBusiness(businessId, { [field]: trimmed || null } as any);
      onBusinessUpdated?.(updated);
      savedContactRef.current[field] = trimmed;
      setContactSavedFlash(field);
      setTimeout(() => setContactSavedFlash((curr) => (curr === field ? null : curr)), 1500);
    } catch (err: any) {
      if (field === 'whatsapp_number') setWhatsappError(err?.message || 'Gagal menyimpan');
    } finally {
      setSavingContact(null);
    }
  }

  async function toggleIsPublic() {
    const next = !business.is_public;
    setTogglingLanding(true);
    try {
      const updated = await businessesApi.updateBusiness(businessId, { is_public: next });
      onBusinessUpdated?.(updated);
    } catch (err) {
      console.error('Failed to toggle is_public:', err);
    } finally {
      setTogglingLanding(false);
    }
  }

  const [togglingLogoSlide, setTogglingLogoSlide] = useState(false);
  async function toggleShowInLogoSlide() {
    const next = !(business.show_in_logo_slide ?? true);
    setTogglingLogoSlide(true);
    try {
      const updated = await businessesApi.updateBusiness(businessId, { show_in_logo_slide: next });
      onBusinessUpdated?.(updated);
    } catch (err) {
      console.error('Failed to toggle show_in_logo_slide:', err);
    } finally {
      setTogglingLogoSlide(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  const isPublicInLanding = !!business.is_public;

  return (
    <div className="space-y-5">
      {/* 2-panel layout: config kiri, preview kanan
          (filter surface dikendalikan langsung dari tab preview di kanan) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(320px,440px)] gap-6 items-start">

        {/* Panel Kiri — Config sections */}
        <div className="space-y-5 min-w-0">

          {/* Section: Page Config (slug, title, tagline, bio, logo, banner, layout, color) */}
          <ConfigSection
            sectionId="page-config"
            activeFilter={activeFilter}
          >
            <OmniChannelPageConfig
              businessId={businessId}
              businessName={businessName}
              userId={userId}
              channel={channel}
              onSaved={fetchChannel}
            />
          </ConfigSection>

          {/* Section: Featured Product */}
          {channel && (
            <ConfigSection
              sectionId="featured-product"
              activeFilter={activeFilter}
            >
              <OmniChannelFeaturedProductConfig
                businessId={businessId}
                userId={userId}
                channel={channel}
                onChanged={fetchChannel}
              />
            </ConfigSection>
          )}

          {/* Section: Widget — gabungan Widget Utama, Konfigurasi Widget Reservasi, Harga Layanan
              karena ketiganya feed ke satu widget output yang sama */}
          {channel && (
            <ConfigSection
              sectionId="widget"
              activeFilter={activeFilter}
            >
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-5">

                {/* Sub-section 1: Widget Utama */}
                <div>
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
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    {business.business_type === 'jasa'
                      ? 'Widget reservasi yang akan mengarahkan pengunjung ke WhatsApp dengan pesan otomatis.'
                      : 'Kartu link/checkout untuk bisnis produk & dagang.'}
                  </p>

                  {/* Kontak Widget — hanya untuk bisnis Jasa */}
                  {business.business_type === 'jasa' && (
                    <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <Phone className="w-3.5 h-3.5" />
                          Nomor WhatsApp
                          {savingContact === 'whatsapp_number' && (
                            <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                          )}
                          {contactSavedFlash === 'whatsapp_number' && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              <Check className="w-3 h-3" /> Tersimpan
                            </span>
                          )}
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={whatsappNumber}
                          onChange={(e) => setWhatsappNumber(e.target.value)}
                          onBlur={() => saveContactField('whatsapp_number', whatsappNumber)}
                          placeholder="6281234567890 (tanpa +)"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                          Format internasional tanpa tanda +. Hanya angka.
                        </p>
                        {whatsappError && (
                          <p className="text-[11px] text-red-500 mt-1">{whatsappError}</p>
                        )}
                      </div>

                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Label Aksi Widget
                          {savingContact === 'widget_action_label' && (
                            <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                          )}
                          {contactSavedFlash === 'widget_action_label' && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              <Check className="w-3 h-3" /> Tersimpan
                            </span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={widgetActionLabel}
                          onChange={(e) => setWidgetActionLabel(e.target.value)}
                          onBlur={() => saveContactField('widget_action_label', widgetActionLabel)}
                          placeholder="cth: menginap, konsultasi, booking"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                          Kata kerja yang akan tampil di pesan WhatsApp pre-filled.
                        </p>
                      </div>

                      {isPublicInLanding && !business.whatsapp_number && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1.5 rounded-lg">
                          ⚠ Nomor WhatsApp wajib diisi agar widget dapat aktif di Storefront landing page.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Sub-section 2: Konfigurasi Widget Reservasi — hanya Jasa */}
                {business.business_type === 'jasa' && (
                  <div className="pt-5 border-t border-gray-100 dark:border-gray-700">
                    <div className="mb-3">
                      <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
                        Konfigurasi Widget Reservasi
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Atur mode tanggal & label-label di widget reservasi.
                      </p>
                    </div>
                    <OmniChannelWidgetConfig
                      businessId={businessId}
                      userId={userId}
                      channel={channel}
                      onSaved={fetchChannel}
                      bare
                    />
                  </div>
                )}

                {/* Sub-section 3: Harga Layanan */}
                <div className="pt-5 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <DollarSign className="w-4.5 h-4.5 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
                        Harga Layanan
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Tampilkan harga di widget setelah customer pilih tanggal.
                      </p>
                    </div>
                  </div>
                  <OmniChannelPricing
                    businessId={businessId}
                    userId={userId}
                    channel={channel}
                    onChanged={fetchChannel}
                    bare
                  />
                </div>

              </div>
            </ConfigSection>
          )}

          {/* Section: Daftar Link */}
          {channel && (
            <ConfigSection
              sectionId="links"
              activeFilter={activeFilter}
            >
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
                  businessId={businessId}
                  links={channel.links ?? []}
                  onChanged={fetchChannel}
                />
              </div>
            </ConfigSection>
          )}

          {/* Section: Gallery */}
          <ConfigSection
            sectionId="gallery"
            activeFilter={activeFilter}
          >
            <OmniChannelGallery
              businessId={businessId}
              userId={userId}
              channel={channel}
              initialGallery={channel?.gallery_images ?? []}
              hasOmniChannel={!!channel}
              onChanged={fetchChannel}
            />
          </ConfigSection>

          {/* Section: Showcase */}
          <ConfigSection
            sectionId="showcase"
            activeFilter={activeFilter}
          >
            <OmniChannelShowcase
              businessId={businessId}
              userId={userId}
              channel={channel}
              initialShowcase={channel?.showcase_images ?? []}
              hasOmniChannel={!!channel}
              onChanged={fetchChannel}
            />
          </ConfigSection>
        </div>

        {/* Panel Kanan — Live Preview (sticky) */}
        <div>
          <OmniChannelPreview
            channel={channel}
            business={business}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            onToggleIsPublic={toggleIsPublic}
            onToggleShowInLogoSlide={toggleShowInLogoSlide}
            togglingIsPublic={togglingLanding}
            togglingShowInLogoSlide={togglingLogoSlide}
          />
        </div>
      </div>
    </div>
  );
}
