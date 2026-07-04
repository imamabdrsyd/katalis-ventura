import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase-server';
import { isReservedSlug } from '@/lib/utils/slugUtils';
import { groupIntoRanges } from '@/lib/rates';
import { PublicOmniChannelPage } from '@/components/public/PublicOmniChannelPage';
import type { BusinessOmniChannel, OmniChannelLink } from '@/types';
import type {
  PublicBusiness,
  PublicGalleryImage,
  PublicShowcaseImage,
  PublicLayoutMode,
  PublicLink,
  PublicPricingRule,
  PublicFeaturedProduct,
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
      show_pricing, default_price, price_unit, featured_item_ids,
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

  // Produk Unggulan = item katalog yang dipilih (urut sesuai featured_item_ids).
  const featuredIds: string[] = Array.isArray(oc.featured_item_ids) ? oc.featured_item_ids : [];
  let featuredProducts: PublicFeaturedProduct[] = [];
  if (featuredIds.length > 0) {
    const { data: catData } = await supabase
      .from('catalog_items')
      .select('id, name, description, default_price, unit, image_url, image_fit, image_position_x, image_position_y, link_url, link_label')
      .in('id', featuredIds)
      .eq('business_id', oc.business_id)
      .eq('is_active', true)
      .is('deleted_at', null);

    const byId = new Map<string, any>((catData ?? []).map((c: any) => [c.id, c]));
    featuredProducts = featuredIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description ?? null,
        price: typeof c.default_price === 'string' ? parseFloat(c.default_price) : (c.default_price ?? 0),
        unit: c.unit ?? null,
        image_url: c.image_url ?? null,
        image_fit: c.image_fit ?? null,
        image_position_x: c.image_position_x ?? null,
        image_position_y: c.image_position_y ?? null,
        link_url: c.link_url ?? null,
        link_label: c.link_label ?? null,
      }));
  }

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

  let pricingRules: PublicPricingRule[] = showPricing
    ? ((oc.pricing_rules ?? []) as Array<{ id: string; date_from: string; date_to: string; price: number | string; label: string | null }>).map((r) => ({
        id: r.id,
        date_from: r.date_from,
        date_to: r.date_to,
        price: typeof r.price === 'string' ? parseFloat(r.price) : r.price,
        label: r.label,
      }))
    : [];

  // Kalender harga (migr 117): bila salah satu unit fisik bisnis punya sumber
  // harga terpasang, halaman publik memakai harga yang SAMA dengan kalender
  // operasional — default_price item + override per tanggal (dikonversi ke
  // pricing rules, menang atas rules manual karena priceForDate ambil match
  // pertama). Set harga sekali di kalender unit → widget publik ikut.
  // MVP: multi-unit hanya menampilkan headline harga dari unit pertama
  // (widget publik cuma dukung satu default_price/price_unit).
  let calendarDefaultPrice: number | null = null;
  let calendarPriceUnit: string | null = null;
  if (showPricing) {
    const { data: rateUnit } = await supabase
      .from('business_units')
      .select('id, rate_item:catalog_items!business_units_rate_item_id_fkey(default_price, unit)')
      .eq('business_id', oc.business_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .not('rate_item_id', 'is', null)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    const rateItem = rateUnit
      ? (Array.isArray((rateUnit as any).rate_item) ? (rateUnit as any).rate_item[0] : (rateUnit as any).rate_item)
      : null;

    if (rateUnit && rateItem) {
      const today = new Date().toISOString().slice(0, 10);
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 365);
      const { data: rateRows } = await supabase
        .from('unit_daily_rates')
        .select('date, price')
        .eq('unit_id', (rateUnit as any).id)
        .gte('date', today)
        .lte('date', horizon.toISOString().slice(0, 10))
        .order('date', { ascending: true });

      calendarDefaultPrice =
        typeof rateItem.default_price === 'string'
          ? parseFloat(rateItem.default_price)
          : (rateItem.default_price ?? null);
      calendarPriceUnit = (rateItem.unit as string | null) ?? 'malam';

      const rateRanges = groupIntoRanges(
        ((rateRows ?? []) as Array<{ date: string; price: number | string }>).map((r) => ({
          date: r.date,
          price: typeof r.price === 'string' ? parseFloat(r.price) : r.price,
          overridden: true,
        }))
      ).map((r, i) => ({
        id: `calendar-rate-${i}`,
        date_from: r.start,
        date_to: r.end,
        price: r.price,
        label: 'Harga khusus',
      }));

      pricingRules = [...rateRanges, ...pricingRules];
    }
  }

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
    // Harga default & satuan: kalender harga (bila dikonfigurasi) menang atas
    // setting manual omni-channel — satu sumber kebenaran dengan kalender.
    default_price: showPricing
      ? calendarDefaultPrice ??
        (oc.default_price != null
          ? (typeof oc.default_price === 'string' ? parseFloat(oc.default_price) : oc.default_price)
          : null)
      : null,
    price_unit: showPricing ? calendarPriceUnit ?? oc.price_unit ?? null : null,
    pricing_rules: pricingRules,
    banner_url: oc.banner_url ?? null,
    featured_products: featuredProducts,
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
