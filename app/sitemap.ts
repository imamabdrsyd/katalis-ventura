import type { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/supabase-server';

const baseUrl = 'https://axionventura.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  // Dynamic omni-channel public pages
  try {
    const supabase = createAdminClient();
    const { data: channels } = await supabase
      .from('business_omni_channels')
      .select('slug, updated_at')
      .eq('is_published', true)
      .order('updated_at', { ascending: false });

    const dynamicRoutes: MetadataRoute.Sitemap = (channels ?? []).map((channel) => ({
      url: `${baseUrl}/${channel.slug}`,
      lastModified: channel.updated_at ? new Date(channel.updated_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));

    return [...staticRoutes, ...dynamicRoutes];
  } catch {
    return staticRoutes;
  }
}
