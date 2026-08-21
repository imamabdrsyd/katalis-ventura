import { notFound } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase-server';
import { isReservedSlug } from '@/lib/utils/slugUtils';
import { publicSlugCacheTag } from '@/lib/publicPageCache';
import { supportsEventRegistration } from '@/lib/businessSectors';
import { loadOpenSessions } from '@/lib/events/publicSession';
import {
  groupIntoRanges,
  buildUnitBaseRates,
  resolveNightPriceV2,
  buildOverrideMap,
  listDatesInRange,
  type NightRate,
  type RateOverride,
} from '@/lib/rates';
import type { CatalogItem } from '@/types';
import { PublicOmniChannelPage } from '@/components/public/PublicOmniChannelPage';
import type { BusinessOmniChannel, OmniChannelLink } from '@/types';
import type {
  PublicEventSummary,
  PublicBusiness,
  PublicGalleryImage,
  PublicShowcaseImage,
  PublicLayoutMode,
  PublicLink,
  PublicPricingRule,
  PublicFeaturedProduct,
} from '@/components/omnichannel/types';

/**
 * Route ini SENGAJA tetap dinamis; yang di-cache adalah DATA-nya, bukan HTML
 * halamannya (lihat `loadPublicPageData` di bawah).
 *
 * Masalah yang diperbaiki: TTFB produksi 2,3–4,0 detik yang tak pernah membaik
 * antar-request (`x-vercel-cache: MISS`, `cache-control: no-store`). Biang
 * keroknya 6–8 round trip berurutan ke Supabase di tiap request. `export const
 * revalidate = 300` yang dulu terpasang di sini TIDAK PERNAH BERLAKU — pada
 * route dengan segment dinamis tanpa `generateStaticParams`, nilai itu tidak
 * berefek sama sekali; terlihat seperti caching padahal tidak.
 *
 * Kenapa men-cache data, bukan ISR penuh lewat `generateStaticParams`:
 * biang keroknya adalah query DB-nya, dan itu hilang sepenuhnya dengan
 * `unstable_cache`. Membiarkan route tetap dinamis berarti perilaku status HTTP
 * (termasuk 404 untuk slug tak dikenal) sama persis dengan yang sudah terbukti
 * benar di produksi — tidak ada variabel baru yang perlu dibuktikan ulang di
 * lingkungan yang tidak bisa direplikasi lokal. Selisih kecepatannya jauh lebih
 * kecil daripada selisih antara "sebelum" dan "sesudah" perbaikan ini.
 *
 * `export const revalidate` sengaja tidak dipasang lagi supaya tidak ada yang
 * mengira caching-nya datang dari situ.
 */

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

interface UnitRateData {
  defaultPrice: number | null;
  monthlyPrice: number | null;
  priceUnit: string;
  rateRanges: PublicPricingRule[];
}

/**
 * Kalender harga (migr 124): base price berasal dari item main-service unit per
 * kategori hari (weekday Sen–Jum / weekend Sab+Min), di-override per tanggal
 * (unit_daily_rates). Harga tiap tanggal diekspansi untuk 365 hari ke depan lalu
 * diringkas jadi rentang, sehingga widget publik (first-match-wins) mencerminkan
 * weekday/weekend + override tanpa perlu logika hari sendiri. Headline
 * default_price = base weekday. Rate MONTHLY diteruskan agar widget bisa memakai
 * harga bulanan saat calon tamu memilih rentang > 27 malam.
 *
 * Dua query-nya sengaja PARALEL: `unit_daily_rates` cuma butuh `unitId`, tidak
 * menunggu `catalog_items`. Versi lama menunggu item dulu untuk mengecek
 * `hasBase` sebelum mengambil override — menghemat satu query di kasus jarang
 * (unit tanpa tarif) dengan ongkos satu round trip ekstra di kasus normal.
 * Balikan null berarti unit ini belum punya tarif sama sekali.
 */
async function loadUnitRateData(
  supabase: ReturnType<typeof createAdminClient>,
  businessId: string,
  unitId: string
): Promise<UnitRateData | null> {
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 365);
  const horizonStr = horizon.toISOString().slice(0, 10);

  const [itemResult, rateResult] = await Promise.all([
    supabase
      .from('catalog_items')
      .select('id, default_price, unit, is_active, service_role, rate_kind')
      .eq('business_id', businessId)
      .eq('unit_id', unitId)
      .eq('is_active', true)
      .is('deleted_at', null),
    supabase
      .from('unit_daily_rates')
      .select('date, price')
      .eq('unit_id', unitId)
      .gte('date', today)
      .lte('date', horizonStr)
      .order('date', { ascending: true }),
  ]);

  const itemRows = itemResult.data ?? [];
  const base = buildUnitBaseRates(itemRows as unknown as CatalogItem[]);
  if (base.weekday == null && base.weekend == null) return null;

  const overrides: RateOverride[] = ((rateResult.data ?? []) as Array<{ date: string; price: number | string }>).map(
    (r) => ({ date: r.date, price: typeof r.price === 'string' ? parseFloat(r.price) : r.price })
  );
  const overrideMap = buildOverrideMap(overrides);

  const nights: NightRate[] = listDatesInRange(today, horizonStr).map((d) =>
    resolveNightPriceV2(d, base, overrideMap)
  );

  return {
    defaultPrice: base.weekday ?? base.weekend ?? null,
    monthlyPrice: base.monthly,
    priceUnit: (itemRows[0] as any)?.unit ?? 'malam',
    rateRanges: groupIntoRanges(nights).map((r, i) => ({
      id: `calendar-rate-${i}`,
      date_from: r.start,
      date_to: r.end,
      price: r.price,
      label: r.overridden ? 'Harga khusus' : null,
    })),
  };
}

interface PublicPageData {
  oc: any;
  biz: any;
  featuredProducts: PublicFeaturedProduct[];
  events: PublicEventSummary[];
  rateData: UnitRateData | null;
}

/**
 * Seluruh pengambilan data halaman publik, DI-CACHE per slug selama 60 detik.
 *
 * Inilah pengganti ISR yang ditolak di atas: HTML-nya tetap dirender per
 * request (jadi `notFound()` tetap 404 betulan), tapi 6–8 round trip ke
 * Supabase — penyebab TTFB 2,3–4,0 detik — cuma terjadi sekali per menit per
 * slug. Sisanya dilayani dari cache dalam memori/​disk Next.
 *
 * 60 detik dipilih (bukan lebih panjang) karena kartu event menampilkan
 * hitungan slot terisi — sinyal crowdtesting yang jadi inti fitur (§29.1 docs).
 * Ditambah `revalidateTag` on-demand saat owner menyimpan konfigurasi halaman
 * publik dan saat ada pendaftar baru, 60 detik itu batas atas kebasian, bukan
 * jeda normal.
 *
 * Balikan `null` = slug tidak ada / belum published. notFound() sengaja
 * dipanggil DI LUAR fungsi ini: melempar dari dalam `unstable_cache` membuat
 * hasil "tidak ketemu" ikut ter-cache sebagai error, bukan sebagai data.
 */
const loadPublicPageData = (slug: string) =>
  unstable_cache(
    async (): Promise<PublicPageData | null> => {
      const supabase = createAdminClient();
      return fetchPublicPageData(supabase, slug);
    },
    ['public-slug-page', slug],
    { revalidate: 60, tags: [publicSlugCacheTag(slug)] }
  )();

async function fetchPublicPageData(
  supabase: ReturnType<typeof createAdminClient>,
  slug: string
): Promise<PublicPageData | null> {
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

  if (ocError || !ocData) return null;

  const oc = ocData as any;

  // Produk Unggulan = item katalog yang dipilih (urut sesuai featured_item_ids).
  const featuredIds: string[] = Array.isArray(oc.featured_item_ids) ? oc.featured_item_ids : [];
  const showPricingRaw = !!oc.show_pricing;

  // ── Gelombang 2: tiga query yang sama-sama cuma butuh business_id ──────────
  // Dulu dijalankan berurutan (bizData → catData → business_units), padahal
  // tidak ada yang bergantung pada hasil yang lain. Di jalur cache-miss, tiap
  // round trip Vercel→Supabase itu puluhan-ratusan ms yang menumpuk langsung
  // jadi layar putih di HP audience.
  const [bizResult, catResult, rateUnitResult] = await Promise.all([
    supabase
      .from('businesses')
      .select('id, business_name, business_type, business_sector, city, whatsapp_number, widget_action_label, logo_url')
      .eq('id', oc.business_id)
      .single(),
    featuredIds.length > 0
      ? supabase
          .from('catalog_items')
          .select('id, name, description, default_price, unit, image_url, image_fit, image_position_x, image_position_y, link_url, link_label')
          .in('id', featuredIds)
          .eq('business_id', oc.business_id)
          .eq('is_active', true)
          .is('deleted_at', null)
      : Promise.resolve({ data: null }),
    showPricingRaw
      ? supabase
          .from('business_units')
          .select('id')
          .eq('business_id', oc.business_id)
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('sort_order', { ascending: true })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const biz = bizResult.data as any;
  const rateUnitId = (rateUnitResult.data as any)?.id as string | undefined;

  const byId = new Map<string, any>(((catResult.data ?? []) as any[]).map((c: any) => [c.id, c]));
  const featuredProducts: PublicFeaturedProduct[] = featuredIds
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

  // ── Gelombang 3: dua cabang yang baru bisa jalan setelah gelombang 2 ───────
  // events butuh business_type/sector (gating §2), rate butuh unit_id. Saling
  // lepas satu sama lain, jadi jalan bareng.
  //
  // Angka slot di kartu event ikut masa cache 60 detik + revalidasi on-demand
  // saat ada pendaftar baru; Lobby-nya sendiri force-dynamic + polling, jadi
  // keputusan "ambil slot" selalu pakai data segar.
  const [events, rateData] = await Promise.all([
    supportsEventRegistration(biz?.business_type, biz?.business_sector)
      ? loadOpenSessions(oc.business_id)
      : Promise.resolve([] as PublicEventSummary[]),
    rateUnitId ? loadUnitRateData(supabase, oc.business_id, rateUnitId) : Promise.resolve(null),
  ]);

  return { oc, biz, featuredProducts, events, rateData };
}

export default async function PublicSlugPage({ params }: Props) {
  const { slug } = await params;

  if (isReservedSlug(slug)) notFound();

  const pageData = await loadPublicPageData(slug);
  if (!pageData) notFound();

  const { oc, biz, featuredProducts, events, rateData } = pageData;

  const channel = oc as unknown as BusinessOmniChannel;
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

  // Kalender harga (migr 124) — dihitung di gelombang 3 di atas, lihat
  // loadUnitRateData(). Hasilnya null bila show_pricing mati, unit tak ada,
  // atau unitnya belum punya item tarif.
  const calendarDefaultPrice: number | null = rateData?.defaultPrice ?? null;
  const calendarPriceUnit: string | null = rateData?.priceUnit ?? null;
  const calendarMonthlyPrice: number | null = rateData?.monthlyPrice ?? null;
  if (rateData) {
    pricingRules = [...rateData.rateRanges, ...pricingRules];
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
    monthly_price: showPricing ? calendarMonthlyPrice : null,
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
      events={events}
    />
  );
}
