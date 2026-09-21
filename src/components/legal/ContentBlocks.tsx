import Image from 'next/image';
import { InlineMarkup } from '@/components/ui/InlineMarkup';
import { Callout, List } from './LegalPage';
import type { ContentBlock } from '@/lib/site/types';

/**
 * Render `ContentBlock[]` dari Site CMS.
 *
 * Tiap tipe blok memetakan ke komponen desain yang sudah ada (`List`, `Callout`)
 * atau ke tipografi yang sama dengan halaman legal, sehingga isi yang dikelola
 * admin tidak bisa tampil beda dari yang di kode.
 *
 * Teks selalu lewat `InlineMarkup` — bukan `dangerouslySetInnerHTML`. Itu yang
 * menjaga form admin tidak jadi jalur injeksi HTML ke halaman publik.
 */
export function ContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return (
              <h3
                key={index}
                className="pt-2 text-lg font-semibold text-gray-800 dark:text-gray-100"
              >
                <InlineMarkup text={block.text} />
              </h3>
            );

          case 'paragraph':
            return (
              <p key={index}>
                <InlineMarkup text={block.text} />
              </p>
            );

          case 'list':
            // `List` merender <ul>. Varian bernomor dirender di sini karena
            // butuh elemen <ol> yang berbeda, bukan sekadar kelas lain.
            if (block.ordered) {
              return (
                <ol
                  key={index}
                  className="space-y-2 pl-5 list-decimal marker:text-gray-400 dark:marker:text-gray-500"
                >
                  {block.items.map((item, i) => (
                    <li key={i}>
                      <InlineMarkup text={item} />
                    </li>
                  ))}
                </ol>
              );
            }
            return (
              <List
                key={index}
                items={block.items.map((item, i) => <InlineMarkup key={i} text={item} />)}
              />
            );

          case 'callout':
            return (
              <Callout key={index} tone={block.tone}>
                <InlineMarkup text={block.text} />
              </Callout>
            );

          case 'table':
            return (
              // Tabel bisa lebih lebar dari kolom teks di layar sempit — dibungkus
              // scroller sendiri supaya yang bergeser hanya tabelnya, bukan
              // seluruh halaman.
              <div key={index} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[32rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      {block.headers.map((header, i) => (
                        <th
                          key={i}
                          className="px-3 py-2 text-left font-semibold text-gray-800 dark:text-gray-100"
                        >
                          <InlineMarkup text={header} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                      >
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="px-3 py-2 align-top text-gray-600 dark:text-gray-300"
                          >
                            <InlineMarkup text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'image':
            return (
              <figure key={index} className="space-y-2">
                <Image
                  src={block.src}
                  alt={block.alt}
                  width={1200}
                  height={675}
                  className="h-auto w-full rounded-xl border border-gray-200 dark:border-gray-700"
                />
                {block.caption && (
                  <figcaption className="text-sm text-gray-500 dark:text-gray-400">
                    <InlineMarkup text={block.caption} />
                  </figcaption>
                )}
              </figure>
            );

          default:
            // Tipe blok yang tidak dikenal (dokumen lebih baru dari kode yang
            // merender) dilewati, bukan bikin halaman gagal render.
            return null;
        }
      })}
    </>
  );
}
