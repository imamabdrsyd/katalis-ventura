import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';

export interface PublicGalleryImage {
  url: string;
  sort_order: number;
}

export interface PublicLink {
  id: string;
  channel_type: string;
  label: string;
  url: string;
  sort_order: number;
}

export interface PublicWidgetLabels {
  date_label?: string;
  checkin_label?: string;
  checkout_label?: string;
  note_label?: string;
  note_placeholder?: string;
  cta_label?: string;
  action_label?: string;
}

export interface PublicBusiness {
  id: string;
  business_name: string;
  business_category: 'jasa' | 'produk' | 'dagang' | null;
  business_type: string | null;
  city: string | null;
  whatsapp_number: string | null;
  widget_action_label: string | null;
  logo_url: string | null;
  gallery: PublicGalleryImage[];
  links: PublicLink[];
  widget_date_mode?: 'single' | 'double';
  widget_labels?: PublicWidgetLabels;
}

interface RawOmniChannel {
  id: string;
  is_published: boolean;
  gallery_images: unknown;
  widget_date_mode: string | null;
  widget_labels: unknown;
  links: Array<{
    id: string;
    channel_type: string;
    label: string;
    url: string;
    is_active: boolean;
    sort_order: number;
  }> | null;
}

interface RawBusinessRow {
  id: string;
  business_name: string;
  business_category: 'jasa' | 'produk' | 'dagang' | null;
  business_type: string | null;
  city: string | null;
  whatsapp_number: string | null;
  widget_action_label: string | null;
  logo_url: string | null;
  omni_channel: RawOmniChannel | RawOmniChannel[] | null;
}

function normalizeGallery(raw: unknown): PublicGalleryImage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is { url: string; sort_order?: number } =>
      x != null && typeof x === 'object' && typeof (x as any).url === 'string'
    )
    .map((x, i) => ({
      url: x.url,
      sort_order: typeof x.sort_order === 'number' ? x.sort_order : i,
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * GET /api/public-businesses
 * Public endpoint — intentionally unauthenticated.
 * Returns bisnis yang opt-in tampil di landing page (is_public = true),
 * lengkap dengan gallery & links omni-channel (jika halaman publik di-publish).
 */
export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('businesses')
      .select(
        `
          id, business_name, business_category, business_type,
          city, whatsapp_number, widget_action_label, logo_url,
          omni_channel:business_omni_channels (
            id, is_published, gallery_images, widget_date_mode, widget_labels,
            links:business_omni_channel_links ( id, channel_type, label, url, is_active, sort_order )
          )
        `
      )
      .eq('is_public', true)
      .eq('is_archived', false)
      .order('business_name', { ascending: true });

    if (error) {
      console.error('Failed to fetch public businesses:', error);
      return NextResponse.json({ businesses: [] }, { status: 200 });
    }

    const businesses: PublicBusiness[] = (data as unknown as RawBusinessRow[] ?? []).map((row) => {
      // omni_channel bisa berupa object (1:1) atau array tergantung Supabase resolver — normalize ke object
      const oc = Array.isArray(row.omni_channel) ? row.omni_channel[0] : row.omni_channel;
      const isPublished = !!oc?.is_published;

      const gallery = isPublished ? normalizeGallery(oc?.gallery_images) : [];
      const links: PublicLink[] = isPublished
        ? (oc?.links ?? [])
            .filter((l) => l.is_active)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(({ id, channel_type, label, url, sort_order }) => ({
              id,
              channel_type,
              label,
              url,
              sort_order,
            }))
        : [];

      return {
        id: row.id,
        business_name: row.business_name,
        business_category: row.business_category,
        business_type: row.business_type,
        city: row.city,
        whatsapp_number: row.whatsapp_number,
        widget_action_label: row.widget_action_label,
        logo_url: row.logo_url,
        gallery,
        links,
        widget_date_mode: (oc?.widget_date_mode as 'single' | 'double') ?? 'double',
        widget_labels: (oc?.widget_labels ?? {}) as PublicWidgetLabels,
      };
    });

    return NextResponse.json({ businesses });
  } catch (err) {
    console.error('public-businesses route error:', err);
    return NextResponse.json({ businesses: [] }, { status: 200 });
  }
}
