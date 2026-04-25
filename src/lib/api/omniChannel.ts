import { createClient } from '@/lib/supabase';
import type {
  BusinessOmniChannel,
  OmniChannelGalleryImage,
  OmniChannelLink,
  PricingRule,
  UpsertOmniChannelData,
  UpsertOmniChannelLinkData,
  UpsertPricingRuleData,
} from '@/types';

// ─── READ (direct Supabase, SELECT RLS is permissive for members) ─────────────

export async function getOmniChannel(businessId: string): Promise<BusinessOmniChannel | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('business_omni_channels')
    .select('*, links:business_omni_channel_links(*), pricing_rules:business_pricing_rules(*)')
    .eq('business_id', businessId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as BusinessOmniChannel;
}

// ─── WRITE (via API routes — server-side session resolves auth reliably) ──────

export async function upsertOmniChannel(
  businessId: string,
  payload: UpsertOmniChannelData,
  _userId: string  // kept for API compat, server resolves user from session
): Promise<BusinessOmniChannel> {
  const res = await fetch(`/api/omni-channel/${businessId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) {
    let msg = json.error || 'Gagal menyimpan halaman publik';
    if (json.debug) {
      msg += ` (role: ${json.debug.roleValue}, isCreator: ${json.debug.isCreator})`;
    }
    throw new Error(msg);
  }
  return json.data;
}

export async function addOmniChannelLink(
  _omniChannelId: string,
  payload: UpsertOmniChannelLinkData & { businessId: string }
): Promise<OmniChannelLink> {
  const { businessId, ...linkData } = payload;
  const res = await fetch(`/api/omni-channel/${businessId}/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(linkData),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Gagal menambah link');
  return json.data;
}

export async function updateOmniChannelLink(
  linkId: string,
  payload: Partial<UpsertOmniChannelLinkData>
): Promise<OmniChannelLink> {
  const res = await fetch(`/api/omni-channel/links/${linkId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Gagal mengupdate link');
  return json.data;
}

export async function deleteOmniChannelLink(linkId: string): Promise<void> {
  const res = await fetch(`/api/omni-channel/links/${linkId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.error || 'Gagal menghapus link');
  }
}

export async function reorderOmniChannelLinks(
  updates: { id: string; sort_order: number }[]
): Promise<void> {
  await Promise.all(
    updates.map(({ id, sort_order }) =>
      fetch(`/api/omni-channel/links/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order }),
      })
    )
  );
}

// ─── GALLERY ──────────────────────────────────────────────────────────────────

export async function uploadGalleryImage(
  businessId: string,
  url: string,
  public_id: string
): Promise<{ image: OmniChannelGalleryImage; gallery: OmniChannelGalleryImage[] }> {
  const res = await fetch(`/api/omni-channel/${businessId}/gallery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, public_id }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Gagal upload gambar gallery');
  return { image: json.image, gallery: json.gallery };
}

export async function deleteGalleryImage(
  businessId: string,
  path: string
): Promise<OmniChannelGalleryImage[]> {
  const res = await fetch(
    `/api/omni-channel/${businessId}/gallery?path=${encodeURIComponent(path)}`,
    { method: 'DELETE' }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Gagal menghapus gambar');
  return json.gallery;
}

export async function reorderGalleryImages(
  businessId: string,
  paths: string[]
): Promise<OmniChannelGalleryImage[]> {
  const res = await fetch(`/api/omni-channel/${businessId}/gallery`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Gagal reorder gallery');
  return json.gallery;
}

// ─── PRICING RULES ────────────────────────────────────────────────────────────

export async function createPricingRule(
  businessId: string,
  payload: UpsertPricingRuleData
): Promise<PricingRule> {
  const res = await fetch(`/api/omni-channel/${businessId}/pricing-rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Gagal menambah aturan harga');
  return json.data;
}

export async function updatePricingRule(
  businessId: string,
  ruleId: string,
  payload: Partial<UpsertPricingRuleData>
): Promise<PricingRule> {
  const res = await fetch(`/api/omni-channel/${businessId}/pricing-rules/${ruleId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Gagal mengupdate aturan harga');
  return json.data;
}

export async function deletePricingRule(
  businessId: string,
  ruleId: string
): Promise<void> {
  const res = await fetch(`/api/omni-channel/${businessId}/pricing-rules/${ruleId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.error || 'Gagal menghapus aturan harga');
  }
}

// ─── SLUG CHECK ───────────────────────────────────────────────────────────────

export async function checkSlugAvailability(
  slug: string,
  businessId?: string
): Promise<{ available: boolean; reason?: string }> {
  const params = new URLSearchParams({ slug });
  if (businessId) params.set('businessId', businessId);

  const res = await fetch(`/api/omni-channel/check-slug?${params}`);
  return res.json();
}

/**
 * Bulk-check multiple slug candidates and return which ones are available (max 3).
 */
export async function fetchAvailableSlugSuggestions(
  candidates: string[],
  businessId?: string
): Promise<string[]> {
  const res = await fetch('/api/omni-channel/check-slug', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slugs: candidates, businessId }),
  });
  const { results } = await res.json();
  return candidates.filter((s) => results[s] === true).slice(0, 3);
}
