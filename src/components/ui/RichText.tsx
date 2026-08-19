import React from 'react';

/**
 * Render kalimat i18n yang punya bagian ber-penekanan (`<strong>` / `<em>`).
 *
 * Konvensi i18n repo: kalimat disimpan UTUH di kamus dengan placeholder
 * `{nama}`, bukan dipotong jadi beberapa kunci. Memotong kalimat membuat
 * penerjemah kehilangan konteks dan mengunci urutan kata bahasa Indonesia ke
 * bahasa lain yang urutannya berbeda.
 *
 * ```tsx
 * // id: 'Pelunasan masuk Cash Flow sebagai aktivitas {strong}, bukan Investing.'
 * {renderWithStrong(t.foo.hint, { strong: 'Operasional' })}
 * ```
 */
export function renderWithStrong(
  template: string,
  values: Record<string, string>,
  tag: 'strong' | 'em' = 'strong'
): React.ReactNode {
  const Tag = tag;
  // Split menyisakan nama placeholder di indeks ganjil karena grupnya di-capture.
  const parts = template.split(/\{(\w+)\}/g);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part;
        const value = values[part];
        // Placeholder tak dikenal dibiarkan apa adanya supaya kesalahan kunci
        // terlihat saat dites, bukan hilang diam-diam.
        return value === undefined ? `{${part}}` : <Tag key={i}>{value}</Tag>;
      })}
    </>
  );
}
