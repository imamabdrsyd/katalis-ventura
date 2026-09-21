import type { Metadata } from 'next';
import { LegalPage, Section } from '@/components/legal/LegalPage';
import { ContentBlocks } from '@/components/legal/ContentBlocks';
import { getLegalContent } from '@/lib/site/server';

/**
 * Syarat & Ketentuan.
 *
 * Sama seperti /privacy: isinya dari Site CMS, dengan `TERMS_DEFAULTS` sebagai
 * fallback bila belum pernah dipublikasikan. URL tetap statis dan terindeks
 * karena ikut diverifikasi Google bersama Kebijakan Privasi saat consent screen
 * OAuth dipublish.
 */
const pageUrl = 'https://axionventura.com/terms';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const content = await getLegalContent('terms');

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

export default async function TermsOfServicePage() {
  const content = await getLegalContent('terms');

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
