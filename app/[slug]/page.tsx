import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase-server';
import { isReservedSlug } from '@/lib/utils/slugUtils';
import { PublicOmniChannelPage } from '@/components/public/PublicOmniChannelPage';
import type { BusinessOmniChannel, OmniChannelLink } from '@/types';
import type {
  PublicBusiness,
  PublicGalleryImage,
  PublicShowcaseImage,
  PublicLayoutMode,
  PublicLink,
  PublicPricingRule,
} from '@/components/omnichannel/types';

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (isReservedSlug(slug)) return {};

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('business_omni_channels')
    .select('title, bio, logo_url')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!data) return { title: 'Tidak Ditemukan' };

  return {
    title: data.title,
    description: data.bio ?? undefined,
    openGraph: {
      title: data.title,
      description: data.bio ?? undefined,
      images: data.logo_url ? [{ url: data.logo_url }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: data.title,
      description: data.bio ?? undefined,
      images: data.logo_url ? [data.logo_url] : [],
    },
  };
}

function normalizeGallery(raw: unknown): PublicGalleryImage[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<{ url?: string; sort_order?: number }>)
    .filter((x) => x != null && typeof x.url === 'string')
    .map((x, i) => ({ url: x.url as string, sort_order: typeof x.sort_order === 'number' ? x.sort_order : i }))
    .sort((a, b) => a.sort_order - b.sort_order);
}

function normalizeShowcase(raw: unknown): PublicShowcaseImage[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<{ url?: string; sort_order?: number }>)
    .filter((x) => x != null && typeof x.url === 'string')
    .map((x, i) => ({ url: x.url as string, sort_order: typeof x.sort_order === 'number' ? x.sort_order : i }))
    .sort((a, b) => a.sort_order - b.sort_order);
}

function normalizeLayoutMode(raw: unknown): PublicLayoutMode {
  return raw === 'modern' || raw === 'clean' ? raw : 'classic';
}

export default async function PublicSlugPage({ params }: Props) {
  const { slug } = await params;

  if (isReservedSlug(slug)) notFound();

  const supabase = createAdminClient();

  // Fetch omni-channel config lengkap
  const { data: ocData, error: ocError } = await supabase
    .from('business_omni_channels')
    .select(`
      id, business_id, slug, is_published, title, tagline, bio, logo_url, banner_url,
      gallery_images, showcase_images, layout_mode, button_color, banner_position,
      show_gallery, show_showcase, show_widget, show_links,
      widget_date_mode, widget_labels,
      show_pricing, default_price, price_unit, featured_product,
      links:business_omni_channel_links ( id, channel_type, label, subtitle, url, is_active, is_primary, sort_order, custom_icon_url, lucide_icon, display_mode ),
      pricing_rules:business_pricing_rules ( id, date_from, date_to, price, label )
    `)
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (ocError || !ocData) notFound();

  // Fetch bisnis untuk data widget (business_type, city, dll)
  const { data: bizData } = await supabase
    .from('businesses')
    .select('id, business_name, business_type, business_sector, city, whatsapp_number, widget_action_label, logo_url')
    .eq('id', (ocData as any).business_id)
    .single();

  const oc = ocData as any;
  const biz = bizData as any;

  const channel = ocData as unknown as BusinessOmniChannel;
  const activeLinks = ((oc.links ?? []) as OmniChannelLink[])
    .filter((l) => l.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const showPricing = !!oc.show_pricing;

  const publicLinks: PublicLink[] = activeLinks.map((l) => ({
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

  const pricingRules: PublicPricingRule[] = showPricing
    ? ((oc.pricing_rules ?? []) as Array<{ id: string; date_from: string; date_to: string; price: number | string; label: string | null }>).map((r) => ({
        id: r.id,
        date_from: r.date_from,
        date_to: r.date_to,
        price: typeof r.price === 'string' ? parseFloat(r.price) : r.price,
        label: r.label,
      }))
    : [];

  const publicBusiness: PublicBusiness = {
    id: biz?.id ?? '',
    business_name: biz?.business_name ?? oc.title,
    slug: oc.slug,
    business_type: biz?.business_type ?? null,
    business_sector: biz?.business_sector ?? null,
    city: biz?.city ?? null,
    whatsapp_number: biz?.whatsapp_number ?? null,
    widget_action_label: biz?.widget_action_label ?? null,
    logo_url: oc.logo_url ?? biz?.logo_url ?? null,
    gallery: normalizeGallery(oc.gallery_images),
    showcase: normalizeShowcase(oc.showcase_images),
    layout_mode: normalizeLayoutMode(oc.layout_mode),
    show_gallery: oc.show_gallery !== false,
    show_showcase: oc.show_showcase !== false,
    show_widget: oc.show_widget !== false,
    show_links: oc.show_links !== false,
    links: publicLinks,
    widget_date_mode: (oc.widget_date_mode as 'single' | 'double') ?? 'double',
    widget_labels: (oc.widget_labels ?? {}) as PublicBusiness['widget_labels'],
    show_pricing: showPricing,
    default_price: showPricing && oc.default_price != null
      ? (typeof oc.default_price === 'string' ? parseFloat(oc.default_price) : oc.default_price)
      : null,
    price_unit: showPricing ? oc.price_unit ?? null : null,
    pricing_rules: pricingRules,
    banner_url: oc.banner_url ?? null,
    featured_product: oc.featured_product ?? null,
    button_color: oc.button_color ?? null,
    banner_position: oc.banner_position ?? 'center',
  };

  return (
    <PublicOmniChannelPage
      channel={channel}
      business={publicBusiness}
    />
  );
}
