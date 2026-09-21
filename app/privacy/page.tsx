import type { Metadata } from 'next';
import { LegalPage, Section } from '@/components/legal/LegalPage';
import { ContentBlocks } from '@/components/legal/ContentBlocks';
import { getLegalContent } from '@/lib/site/server';

/**
 * Kebijakan Privasi.
 *
 * Isinya sekarang datang dari Site CMS (`site_pages.page_key = 'privacy'`) dan
 * bisa disunting platform admin dari /admin tanpa deploy. Selama belum pernah
 * dipublikasikan, yang tampil adalah `PRIVACY_DEFAULTS` — transkripsi persis
 * dari versi yang dulu hardcode di file ini.
 *
 * URL-nya SENGAJA tetap statis di /privacy dan tetap `index: true`: Google
 * memverifikasi URL ini saat consent screen OAuth dipublish ke production.
 * Jangan jadikan route dinamis dan jangan tambahkan noindex.
 */
const pageUrl = 'https://axionventura.com/privacy';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const content = await getLegalContent('privacy');

  return {
    title: content.seo.title,
    description: content.seo.description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title: `${content.seo.title} — AXION`,
      description: content.seo.description,
      url: pageUrl,
      type: 'website',
      siteName: 'AXION',
      locale: 'id_ID',
    },
    robots: { index: true, follow: true },
  };
}

export default async function PrivacyPolicyPage() {
  const content = await getLegalContent('privacy');

  return (
    <LegalPage
      title={content.title}
      effectiveDate={content.effectiveDate}
      intro={content.intro}
    >
      {content.sections.map((section, index) => (
        <Section key={index} heading={section.heading}>
          <ContentBlocks blocks={section.blocks} />
        </Section>
      ))}
    </LegalPage>
  );
}
