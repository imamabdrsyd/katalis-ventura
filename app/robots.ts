import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://axionventura.com';

  return {
    rules: [
      {
        // Allow all crawlers including AI bots (GEO)
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/api/',
          '/setup-business',
          '/join-business',
          '/auth/',
          '/select-role',
          '/settings',
          '/transactions',
          '/accounts',
          '/general-ledger',
          '/trial-balance',
          '/income-statement',
          '/balance-sheet',
          '/cash-flow',
          '/scenario-modeling',
          '/reports',
          '/businesses',
          '/roi-forecast',
        ],
      },
      // Explicitly allow major AI crawlers for GEO
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'ChatGPT-User', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'anthropic-ai', allow: '/' },
      { userAgent: 'Claude-Web', allow: '/' },
      { userAgent: 'Applebot', allow: '/' },
      { userAgent: 'Googlebot', allow: '/' },
      { userAgent: 'bingbot', allow: '/' },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
