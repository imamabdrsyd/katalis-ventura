/**
 * Parser subset markup inline untuk teks panjang yang dikelola Site CMS
 * (halaman legal, artikel blog).
 *
 * Yang didukung — dan HANYA ini:
 *   **tebal**          → strong
 *   *miring*           → em
 *   `kode`             → code
 *   [teks](url)        → link
 *
 * Kenapa subset sendiri, bukan markdown penuh atau HTML mentah:
 *
 *   - HTML mentah dari form admin berarti jalur stored XSS ke setiap pengunjung
 *     halaman publik. Hasil parser ini adalah data terstruktur yang dirender
 *     jadi elemen React; tidak ada `dangerouslySetInnerHTML` di mana pun.
 *   - Markdown penuh berarti dependensi baru plus parser jauh lebih besar dari
 *     kebutuhan. Empat bentuk di atas persis yang dipakai dokumen legal yang
 *     sudah ada (penekanan, nama OAuth scope sebagai kode, tautan ke kebijakan
 *     Google) — tidak lebih.
 *
 * Logika parsing sengaja dipisah dari komponen React supaya bisa diuji di
 * lingkungan node (lihat tests/unit/inlineMarkup.test.ts) — penyaringan href di
 * sini menyangkut keamanan, jadi harus ada testnya.
 */

export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'em'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; label: string; href: string; external: boolean }
  /** Tautan dengan URL yang tidak lolos saringan — dirender sebagai teks biasa. */
  | { type: 'unsafe-link'; label: string };

/**
 * Aturan href yang sama dengan skema Zod di `validation.ts`.
 *
 * Divalidasi ULANG saat render, bukan hanya saat tulis: dokumen yang tersimpan
 * sebelum aturan ini ada tidak pernah lewat validasi tulis, dan sisi render
 * adalah titik terakhir sebelum nilainya masuk ke atribut `href`.
 */
const SAFE_HREF = /^(?:\/(?!\/)[^\s]*|#[^\s]*|https?:\/\/[^\s]+|mailto:[^\s@]+@[^\s@]+)$/;

export function isSafeHref(href: string): boolean {
  return SAFE_HREF.test(href);
}

/**
 * Satu regex dengan empat alternatif ber-capture group. Urutannya penting:
 * `**tebal**` harus dicoba sebelum `*miring*`, kalau tidak `**x**` akan terbaca
 * sebagai em berisi `*x*`.
 */
const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

/**
 * URL berhenti di tanda tutup kurung pertama — batasan yang sama dengan
 * markdown, jadi URL ber-tanda kurung tidak didukung. Sifat yang dijaga: URL
 * yang terpotong pun tetap melewati `isSafeHref`, sehingga potongan tak utuh
 * gagal saringan alih-alih diloloskan ke atribut href.
 */
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

export function parseInlineMarkup(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];

  for (const part of text.split(TOKEN)) {
    if (!part) continue;

    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
      nodes.push({ type: 'strong', value: part.slice(2, -2) });
      continue;
    }

    if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
      nodes.push({ type: 'code', value: part.slice(1, -1) });
      continue;
    }

    if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
      nodes.push({ type: 'em', value: part.slice(1, -1) });
      continue;
    }

    const link = LINK.exec(part);
    if (link) {
      const [, label, href] = link;
      if (isSafeHref(href)) {
        nodes.push({ type: 'link', label, href, external: href.startsWith('http') });
      } else {
        // Dirender sebagai teks, bukan dibuang: isi dokumen tetap terbaca dan
        // kesalahannya kelihatan sehingga bisa diperbaiki — bukan hilang diam-diam.
        nodes.push({ type: 'unsafe-link', label });
      }
      continue;
    }

    nodes.push({ type: 'text', value: part });
  }

  return nodes;
}
