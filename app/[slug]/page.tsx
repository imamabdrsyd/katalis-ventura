import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase-server';
import { isReservedSlug } from '@/lib/utils/slugUtils';
import { PublicOmniChannelPage } from '@/components/public/PublicOmniChannelPage';
import type { BusinessOmniChannel, OmniChannelLink } from '@/types';

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

export default async function PublicSlugPage({ params }: Props) {
  const { slug } = await params;

  if (isReservedSlug(slug)) notFound();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('business_omni_channels')
    .select('*, links:business_omni_channel_links(*)')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (error || !data) notFound();

  const channel = data as BusinessOmniChannel;
  const activeLinks = (channel.links ?? [])
    .filter((l: OmniChannelLink) => l.is_active)
    .sort((a: OmniChannelLink, b: OmniChannelLink) => a.sort_order - b.sort_order);

  return <PublicOmniChannelPage channel={channel} links={activeLinks} />;
}
