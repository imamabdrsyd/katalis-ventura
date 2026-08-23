/**
 * Halaman Lobby publik: /[slug]/events/[sessionId]
 *
 * Dirender server dengan admin client — pola sama dengan /[slug] — supaya
 * halaman ini tidak butuh akses anon ke Postgres sama sekali. Dari sini
 * komponen klien hanya berbicara ke /api/public/events/*.
 *
 * Sesi diverifikasi HARUS milik bisnis pemilik slug: tanpa itu, id sesi dari
 * bisnis lain bisa ditempelkan ke slug mana pun dan tampil seolah acaranya
 * milik mereka.
 */

import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase-server';
import { isReservedSlug } from '@/lib/utils/slugUtils';
import { loadPublicSession } from '@/lib/events/publicSession';
import { EventLobby } from '@/components/public/EventLobby';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string; sessionId: string }>;
}

interface ChannelRow {
  business_id: string;
  title: string;
  logo_url: string | null;
  button_color: string | null;
}

/**
 * Dibungkus React `cache()` dengan alasan yang sama seperti `loadPublicSession`:
 * `generateMetadata` dan komponen halaman sama-sama memanggilnya di request yang
 * sama. Tanpa dedup, tiap kali Lobby dibuka query ini jalan dua kali.
 */
const loadChannel = cache(async (slug: string): Promise<ChannelRow | null> => {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('business_omni_channels')
    .select('business_id, title, logo_url, button_color')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();
  return (data as ChannelRow | null) ?? null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, sessionId } = await params;
  if (isReservedSlug(slug)) return {};

  const [channel, result] = await Promise.all([loadChannel(slug), loadPublicSession(sessionId)]);
  if (!channel || !result || result.businessId !== channel.business_id) {
    return { title: 'Tidak Ditemukan' };
  }

  const title = `${result.session.title} — ${channel.title}`;
  // Meta description dirender satu baris oleh mesin pencari & preview link —
  // enter yang ditulis pemilik dipadatkan jadi spasi, bukan dibiarkan menganga.
  const description =
    result.session.description?.replace(/\s*\n+\s*/g, ' ').trim() ||
    `Pilih tanggal dan kunci slot kamu untuk ${result.session.title}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: channel.logo_url ? [{ url: channel.logo_url }] : [],
      type: 'website',
    },
    twitter: { card: 'summary', title, description },
    // Lobby ikut sesi yang datang & pergi — jangan diindeks, cukup dibagikan.
    robots: { index: false, follow: true },
  };
}

export default async function EventLobbyPage({ params }: Props) {
  const { slug, sessionId } = await params;
  if (isReservedSlug(slug)) notFound();

  const [channel, result] = await Promise.all([loadChannel(slug), loadPublicSession(sessionId)]);
  if (!channel || !result || result.businessId !== channel.business_id) notFound();

  return (
    <EventLobby
      session={result.session}
      business={{
        name: channel.title,
        slug,
        logoUrl: channel.logo_url,
        buttonColor: channel.button_color,
      }}
    />
  );
}
