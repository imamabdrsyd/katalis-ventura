import React from 'react';
import { parseInlineMarkup } from '@/lib/site/inlineMarkup';

/**
 * Render hasil `parseInlineMarkup` jadi elemen React.
 *
 * Lapisan ini sengaja tipis — semua keputusan parsing dan penyaringan href ada
 * di `src/lib/site/inlineMarkup.ts` yang punya unit test. Di sini hanya pemetaan
 * node → elemen, dan teks selalu masuk sebagai children (di-escape React),
 * tidak pernah lewat `dangerouslySetInnerHTML`.
 */

const LINK_CLASS =
  'underline decoration-gray-300 dark:decoration-gray-600 hover:text-gray-900 dark:hover:text-gray-100 transition-colors';
const CODE_CLASS = 'text-sm px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800';
const STRONG_CLASS = 'font-semibold text-gray-800 dark:text-gray-100';

export function InlineMarkup({ text }: { text: string }) {
  return (
    <>
      {parseInlineMarkup(text).map((node, index) => {
        switch (node.type) {
          case 'strong':
            return (
              <strong key={index} className={STRONG_CLASS}>
                {node.value}
              </strong>
            );
          case 'em':
            return <em key={index}>{node.value}</em>;
          case 'code':
            return (
              <code key={index} className={CODE_CLASS}>
                {node.value}
              </code>
            );
          case 'link':
            return (
              <a
                key={index}
                href={node.href}
                className={LINK_CLASS}
                {...(node.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {node.label}
              </a>
            );
          case 'unsafe-link':
            return <React.Fragment key={index}>{node.label}</React.Fragment>;
          default:
            return <React.Fragment key={index}>{node.value}</React.Fragment>;
        }
      })}
    </>
  );
}
