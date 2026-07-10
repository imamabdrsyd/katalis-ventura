'use client';

import { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import { EyeOff, AlertCircle, ChevronRight, ExternalLink } from 'lucide-react';
import type { BusinessOmniChannel, Business } from '@/types';
import type {
  PublicBusiness,
  PublicGalleryImage,
  PublicShowcaseImage,
  PublicLayoutMode,
  PublicLink,
  PublicPricingRule,
} from '@/components/omnichannel/types';
import { OmnichannelGalleryCarousel } from '@/components/omnichannel/OmnichannelGalleryCarousel';
import { OmnichannelWidget } from '@/components/omnichannel/OmnichannelWidget';
import { OmnichannelLinkCards } from '@/components/omnichannel/OmnichannelLinkCards';
import { BusinessInitialsAvatar } from '@/components/omnichannel/BusinessInitialsAvatar';
import {
  SURFACES,
  SURFACE_BY_ID,
  type Surface,
  type SurfaceFilter,
} from './omniChannelSurfaceMap';

interface Props {
  channel: BusinessOmniChannel | null;
  business: Business;
  activeFilter: SurfaceFilter;
  onFilterChange: (filter: SurfaceFilter) => void;
  onToggleIsPublic?: () => void;
  onToggleShowInLogoSlide?: () => void;
  togglingIsPublic?: boolean;
  togglingShowInLogoSlide?: boolean;
}

/** Mini toggle untuk dipasang inline di dalam tab pill */
function TabToggle({
  checked,
  onClick,
  disabled,
  label,
}: {
  checked: boolean;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <span
      role="switch"
      aria-checked={checked}
      aria-label={label}
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) onClick();
        }
      }}
      className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${disabled ? 'opacity-50' : ''} ${checked ? 'bg-gray-900 dark:bg-gray-100' : 'bg-gray-300 dark:bg-gray-600'}`}
      title={label}
    >
      <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-3' : 'translate-x-0.5'}`} />
    </span>
  );
}

function normalizeGallery(raw: unknown): PublicGalleryImage[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<{ url?: string; sort_order?: number }>)
    .filter((x) => x != null && typeof x.url === 'string')
    .map((x, i) => ({ url: x.url as string, sort_order: typeof x.sort_order === 'number' ? x.sort_order : i }))
    .sort((a, b) => a.sort_order - b.sort_order);
}

function normalizeShowcase(raw: unknown): PublicShowcaseImage[] {
  return normalizeGallery(raw);
}

function normalizeLayoutMode(raw: unknown): PublicLayoutMode {
  return raw === 'modern' || raw === 'clean' ? raw : 'classic';
}

function buildPublicBusiness(channel: BusinessOmniChannel | null, business: Business): PublicBusiness | null {
  if (!channel) return null;
  const links: PublicLink[] = (channel.links ?? [])
    .filter((l) => l.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((l) => ({
      id: l.id,
      channel_type: l.channel_type,
      label: l.label,
      subtitle: (l as any).subtitle ?? null,
      url: l.url,
      is_primary: !!l.is_primary,
      sort_order: l.sort_order,
      custom_icon_url: (l as any).custom_icon_url ?? null,
      lucide_icon: (l as any).lucide_icon ?? null,
      display_mode: (l as any).display_mode ?? 'default',
    }));

  const showPricing = !!channel.show_pricing;
  const pricingRules: PublicPricingRule[] = showPricing
    ? (channel.pricing_rules ?? []).map((r: any) => ({
        id: r.id,
        date_from: r.date_from,
        date_to: r.date_to,
        price: typeof r.price === 'string' ? parseFloat(r.price) : r.price,
        label: r.label,
      }))
    : [];

  return {
    id: business.id,
    business_name: business.business_name,
    slug: channel.slug,
    business_type: (business.business_type as 'jasa' | 'produk' | 'dagang' | undefined) ?? null,
    business_sector: business.business_sector ?? null,
    city: business.city ?? null,
    whatsapp_number: business.whatsapp_number ?? null,
    widget_action_label: business.widget_action_label ?? null,
    logo_url: channel.logo_url ?? business.logo_url ?? null,
    banner_url: channel.banner_url ?? null,
    gallery: normalizeGallery(channel.gallery_images),
    showcase: normalizeShowcase(channel.showcase_images),
    layout_mode: normalizeLayoutMode(channel.layout_mode),
    show_gallery: channel.show_gallery !== false,
    show_showcase: channel.show_showcase !== false,
    show_widget: channel.show_widget !== false,
    show_links: channel.show_links !== false,
    links,
    widget_date_mode: channel.widget_date_mode ?? 'double',
    widget_labels: channel.widget_labels ?? {},
    show_pricing: showPricing,
    default_price: showPricing && channel.default_price != null
      ? (typeof channel.default_price === 'string' ? parseFloat(channel.default_price as any) : channel.default_price)
      : null,
    price_unit: showPricing ? channel.price_unit ?? null : null,
    pricing_rules: pricingRules,
    button_color: channel.button_color ?? null,
    banner_position: channel.banner_position ?? 'center',
  };
}

/** Mini "device frame" untuk preview supaya kerasa visual context */
function PreviewFrame({
  surface,
  children,
  badge,
}: {
  surface: Surface;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  const meta = SURFACE_BY_ID[surface];
  return (
    <div className="rounded-2xl border border-transparent dark:border-gray-700 overflow-hidden shadow-card bg-white dark:bg-gray-800">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
        <div className="ml-2 flex-1 min-w-0">
          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate block">
            {meta.label}
          </span>
        </div>
        {badge}
      </div>
      <div className={`${meta.previewBgClass}`}>{children}</div>
    </div>
  );
}

function EmptyState({ message, icon: Icon = AlertCircle }: { message: string; icon?: typeof AlertCircle }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <Icon className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-3" />
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}

function PreviewSkeleton({ logoUrl, title }: { logoUrl?: string | null; title?: string | null }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center pt-20 px-8 bg-white dark:bg-gray-950">
      {/* Logo bisnis (atau placeholder gradient) */}
      <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center shadow-sm">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={title ?? 'Logo'} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 animate-pulse" />
        )}
      </div>

      {/* Title bar */}
      <div className="mt-6 h-5 w-40 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />

      {/* Tagline bar */}
      <div className="mt-3 h-3 w-56 rounded-md bg-gray-100 dark:bg-gray-800 animate-pulse" />
      <div className="mt-2 h-3 w-48 rounded-md bg-gray-100 dark:bg-gray-800 animate-pulse" />

      {/* Content blocks */}
      <div className="mt-10 w-full max-w-[260px] space-y-3">
        <div className="h-14 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <div className="h-14 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <div className="h-14 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
      </div>

      <p className="mt-8 text-[11px] text-gray-400 dark:text-gray-500">Memuat preview…</p>
    </div>
  );
}

function PublicPagePreview({ channel, publicBiz }: { channel: BusinessOmniChannel | null; publicBiz: PublicBusiness | null }) {
  const [iframeLoading, setIframeLoading] = useState(true);

  // Reset loading state setiap kali iframe key berubah (channel update / slug ganti)
  useEffect(() => {
    setIframeLoading(true);
  }, [channel?.updated_at, channel?.slug]);

  if (!channel || !publicBiz) {
    return <EmptyState message="Isi konfigurasi halaman publik untuk melihat preview." />;
  }
  if (!channel.is_published) {
    return (
      <EmptyState
        icon={EyeOff}
        message="Halaman publik belum diaktifkan. Toggle 'Halaman Publik (Aktif)' untuk mempublikasikan."
      />
    );
  }

  // Pakai iframe biar viewport benar-benar mobile width — Tailwind responsive
  // (sm:/md:/lg:) bereaksi ke viewport iframe, bukan viewport browser, jadi layout
  // natural collapse ke single-column kayak mobile.
  // Cache-buster pakai updated_at biar fresh setelah save di sub-komponen lain.
  const cacheBuster = encodeURIComponent(channel.updated_at ?? '');
  return (
    <div className="relative flex justify-center bg-gray-50 dark:bg-gray-900">
      <iframe
        key={channel.updated_at}
        src={`/${channel.slug}?preview=1&t=${cacheBuster}`}
        className="w-[380px] h-[820px] border-0 bg-white dark:bg-gray-950"
        title="Preview Halaman Publik"
        loading="lazy"
        onLoad={() => setIframeLoading(false)}
      />
      {iframeLoading && (
        <PreviewSkeleton logoUrl={channel.logo_url} title={channel.title} />
      )}
    </div>
  );
}

function StorefrontPreview({ publicBiz, isPublicInLanding }: { publicBiz: PublicBusiness | null; isPublicInLanding: boolean }) {
  if (!isPublicInLanding) {
    return (
      <EmptyState
        icon={EyeOff}
        message="Bisnis ini tidak ditampilkan di landing page. Aktifkan toggle 'Tampilkan di Landing Page' di atas."
      />
    );
  }
  if (!publicBiz) {
    return <EmptyState message="Isi konfigurasi omnichannel untuk melihat preview storefront." />;
  }

  const isJasa = (publicBiz.business_type ?? 'jasa') === 'jasa';

  return (
    <div className="p-4">
      {/* Header mini */}
      <div className="flex items-center gap-1 mb-3">
        <span className="text-base font-bold text-gray-800 dark:text-gray-100 tracking-tight">
          Storefront
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 mx-0.5" />
        <span className="text-base font-bold text-indigo-500 dark:text-indigo-400 truncate max-w-[160px]">
          {publicBiz.business_name}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3 items-start pointer-events-none">
        {publicBiz.gallery.length > 0 ? (
          <OmnichannelGalleryCarousel images={publicBiz.gallery} alt={publicBiz.business_name} />
        ) : (
          <div className="aspect-video rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
            Gallery kosong
          </div>
        )}

        <div className="scale-[0.85] origin-top-left">
          {isJasa ? (
            <OmnichannelWidget business={publicBiz} index={0} businesses={[publicBiz]} />
          ) : (
            <OmnichannelLinkCards business={publicBiz} index={0} businesses={[publicBiz]} />
          )}
        </div>
      </div>
    </div>
  );
}

function LogoSlidePreview({ business }: { business: Business }) {
  const showInSlide = business.show_in_logo_slide ?? true;

  if (!showInSlide) {
    return (
      <EmptyState
        icon={EyeOff}
        message="Bisnis ini tidak akan muncul di slide logo. Aktifkan toggle 'Tampil di Slide Logo Landing' di atas."
      />
    );
  }
  if (!business.logo_url) {
    return (
      <EmptyState
        message="Belum ada logo. Upload logo di section Halaman Publik agar bisa muncul di slide."
      />
    );
  }

  // Mock: tampilkan "slide" yang menonjolkan logo bisnis user di tengah 4 placeholder
  const others = ['A', 'B', 'C', 'D'];

  return (
    <div className="p-6">
      <p className="text-[11px] text-center text-gray-400 dark:text-gray-500 mb-4 italic">
        Posisi bisnis kamu di carousel logo landing page
      </p>
      <div className="flex items-center justify-center gap-3 overflow-hidden">
        {others.slice(0, 2).map((p) => (
          <div
            key={`l-${p}`}
            className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs font-bold flex-shrink-0 opacity-50"
          >
            {p}
          </div>
        ))}

        {/* User's business — highlight */}
        <div className="relative flex-shrink-0">
          <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-r from-indigo-400 to-violet-500 opacity-30 blur-sm" />
          <div className="relative w-16 h-16 rounded-2xl bg-white dark:bg-gray-800 border-2 border-indigo-500 dark:border-indigo-400 flex items-center justify-center overflow-hidden shadow-md">
            {business.logo_url ? (
              <Image
                src={business.logo_url}
                alt={business.business_name}
                width={64}
                height={64}
                className={`w-full h-full ${business.logo_fit === 'contain' ? 'object-contain p-1' : 'object-cover'}`}
                unoptimized
              />
            ) : (
              <BusinessInitialsAvatar name={business.business_name} index={0} size="sm" />
            )}
          </div>
        </div>

        {others.slice(2).map((p) => (
          <div
            key={`r-${p}`}
            className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs font-bold flex-shrink-0 opacity-50"
          >
            {p}
          </div>
        ))}
      </div>
      <p className="text-center text-xs font-semibold text-gray-800 dark:text-gray-100 mt-4 truncate">
        {business.business_name}
      </p>
      <p className="text-[11px] text-center text-gray-400 dark:text-gray-500 mt-3">
        Hanya logo & nama yang ditampilkan di slide ini.
      </p>
    </div>
  );
}

export function OmniChannelPreview({
  channel,
  business,
  activeFilter,
  onFilterChange,
  onToggleIsPublic,
  onToggleShowInLogoSlide,
  togglingIsPublic,
  togglingShowInLogoSlide,
}: Props) {
  const publicBiz = useMemo(() => buildPublicBusiness(channel, business), [channel, business]);
  const isPublicInLanding = !!business.is_public;
  const showInLogoSlide = business.show_in_logo_slide ?? true;

  // Surface yang dipreview di pane bawah.
  // Filter 'all' = tidak ada tab yang highlighted, tapi preview tetap default ke Halaman.
  const activeSurface: Surface =
    activeFilter === 'all' ? 'public-page' : (activeFilter as Surface);

  // Klik tab: toggle behavior — kalau tab sudah selected, klik lagi balik ke 'all'.
  const handleTabClick = (surfaceId: Surface) => {
    if (activeFilter === surfaceId) {
      onFilterChange('all');
    } else {
      onFilterChange(surfaceId);
    }
  };

  return (
    <div className="sticky top-4 space-y-3">
      {/* Tab switcher */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-1.5 flex gap-1">
        {SURFACES.map((s) => {
          const Icon = s.icon;
          // Highlight HANYA kalau tab ini explicitly dipilih sebagai filter,
          // bukan saat filter 'all' (walau preview defaultnya Halaman).
          const isActive = activeFilter === s.id;
          const hasToggle = s.id === 'storefront' || s.id === 'logo-slide';
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => handleTabClick(s.id)}
              title={isActive ? 'Klik lagi untuk reset filter' : `Fokus ke ${s.label}`}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{s.shortLabel}</span>
              {hasToggle && s.id === 'storefront' && onToggleIsPublic && (
                <TabToggle
                  checked={isPublicInLanding}
                  onClick={onToggleIsPublic}
                  disabled={togglingIsPublic}
                  label="Tampil di Storefront Landing"
                />
              )}
              {hasToggle && s.id === 'logo-slide' && onToggleShowInLogoSlide && (
                <TabToggle
                  checked={showInLogoSlide}
                  onClick={onToggleShowInLogoSlide}
                  disabled={togglingShowInLogoSlide}
                  label="Tampil di Slide Logo Landing"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Description for active surface + Lihat Halaman link (untuk Halaman tab kalau dipublish) */}
      <div className="px-1 flex items-center justify-between gap-2">
        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
          {SURFACE_BY_ID[activeSurface].description}
        </p>
        {activeSurface === 'public-page' && channel?.is_published && channel.slug && (
          <a
            href={`/${channel.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors flex-shrink-0"
            title="Buka halaman publik di tab baru"
          >
            <ExternalLink className="w-3 h-3" />
            Lihat Halaman
          </a>
        )}
      </div>

      {/* Preview pane */}
      <PreviewFrame surface={activeSurface}>
        {activeSurface === 'public-page' && (
          <PublicPagePreview channel={channel} publicBiz={publicBiz} />
        )}
        {activeSurface === 'storefront' && (
          <StorefrontPreview publicBiz={publicBiz} isPublicInLanding={isPublicInLanding} />
        )}
        {activeSurface === 'logo-slide' && (
          <LogoSlidePreview business={business} />
        )}
      </PreviewFrame>
    </div>
  );
}
