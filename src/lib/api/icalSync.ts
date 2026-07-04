/**
 * Sinkronisasi impor iCal OTA → tabel `bookings` (server-only, admin client).
 *
 * Untuk tiap unit fisik (`business_units.ical_import_url`), fetch feed .ics OTA,
 * parse VEVENT, lalu upsert booking `is_external=true` sebagai blok ketersediaan.
 * Blok eksternal yang tak lagi ada di feed di-soft-delete (dedup via `ical_uid`).
 *
 * Idempoten & best-effort per unit: kegagalan satu unit tidak menghentikan lainnya.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { parseIcsEvents, detectChannelFromUrl } from '@/lib/ical';
import { BOOKING_CHANNEL_LABELS } from '@/lib/bookingStatus';

export interface IcalSyncResult {
  units: number;
  imported: number;
  updated: number;
  removed: number;
  errors: string[];
}

/**
 * Guard SSRF ringan untuk URL feed yang diisi user lalu di-fetch server-side:
 * wajib https, tolak host lokal/privat yang jelas (loopback, RFC1918, link-local,
 * .local/.internal, IP literal IPv6). Feed OTA resmi selalu https + domain publik.
 */
export function isSafeFeedUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  if (host.includes(':') || host.startsWith('[')) return false; // IP literal IPv6
  return true;
}

export async function syncBusinessIcalFeeds(
  admin: SupabaseClient,
  businessId: string
): Promise<IcalSyncResult> {
  const result: IcalSyncResult = { units: 0, imported: 0, updated: 0, removed: 0, errors: [] };

  const { data: units, error } = await admin
    .from('business_units')
    .select('id, name, ical_import_url')
    .eq('business_id', businessId)
    .not('ical_import_url', 'is', null)
    .is('deleted_at', null);

  if (error) {
    result.errors.push(`load units: ${error.message}`);
    return result;
  }

  for (const unit of units ?? []) {
    const url = (unit.ical_import_url as string | null)?.trim();
    if (!url) continue;
    result.units += 1;

    if (!isSafeFeedUrl(url)) {
      result.errors.push(`${unit.name}: URL feed tidak valid (wajib https & bukan alamat internal)`);
      continue;
    }

    let text: string;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'AXION-Calendar/1.0' },
        // Feed OTA di-refresh berkala; jangan cache di edge fetch.
        cache: 'no-store',
      });
      if (!res.ok) {
        result.errors.push(`${unit.name}: HTTP ${res.status}`);
        continue;
      }
      text = await res.text();
    } catch (e) {
      result.errors.push(`${unit.name}: ${e instanceof Error ? e.message : 'fetch gagal'}`);
      continue;
    }

    const channel = detectChannelFromUrl(url);
    const events = parseIcsEvents(text);
    const seenUids = new Set<string>();

    for (const ev of events) {
      if (!ev.start || !ev.end || ev.end <= ev.start) continue;
      seenUids.add(ev.uid);

      const { data: existing } = await admin
        .from('bookings')
        .select('id')
        .eq('business_id', businessId)
        .eq('unit_id', unit.id)
        .eq('ical_uid', ev.uid)
        .is('deleted_at', null)
        .maybeSingle();

      const payload = {
        check_in: ev.start,
        check_out: ev.end,
        channel,
        guest_name: ev.summary || `Blok ${BOOKING_CHANNEL_LABELS[channel]}`,
      };

      if (existing) {
        const { error: updErr } = await admin.from('bookings').update(payload).eq('id', existing.id);
        if (updErr) result.errors.push(`${unit.name}: update ${updErr.message}`);
        else result.updated += 1;
      } else {
        const { error: insErr } = await admin.from('bookings').insert({
          business_id: businessId,
          unit_id: unit.id,
          ical_uid: ev.uid,
          is_external: true,
          status: 'confirmed',
          payment_status: 'unpaid',
          price_per_night: 0,
          total_amount: 0,
          ...payload,
        });
        if (insErr) result.errors.push(`${unit.name}: insert ${insErr.message}`);
        else result.imported += 1;
      }
    }

    // Soft-delete blok eksternal yang sudah tak ada di feed.
    const { data: stale } = await admin
      .from('bookings')
      .select('id, ical_uid')
      .eq('business_id', businessId)
      .eq('unit_id', unit.id)
      .eq('is_external', true)
      .is('deleted_at', null);

    for (const b of stale ?? []) {
      const uid = b.ical_uid as string | null;
      if (uid && !seenUids.has(uid)) {
        await admin.from('bookings').update({ deleted_at: new Date().toISOString() }).eq('id', b.id);
        result.removed += 1;
      }
    }
  }

  return result;
}
