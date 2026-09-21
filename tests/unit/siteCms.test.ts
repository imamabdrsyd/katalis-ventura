import { describe, expect, it } from 'vitest';
import { isSafeHref, parseInlineMarkup } from '@/lib/site/inlineMarkup';
import { isSameContent, mergeSiteContent } from '@/lib/site/merge';

/**
 * Dua bagian Site CMS yang paling berisiko kalau salah, jadi dua-duanya diuji:
 *
 *   1. parseInlineMarkup — nilainya berakhir di atribut `href` halaman publik.
 *      Bocor di sini = stored XSS bagi setiap pengunjung.
 *   2. mergeSiteContent — jaring pengaman yang mencegah landing page blank.
 *      Salah aturan merge = item yang dihapus admin muncul kembali, atau
 *      halaman kehilangan field yang tidak ada di dokumen DB.
 */

describe('isSafeHref', () => {
  it('menerima path relatif, anchor, http(s), dan mailto', () => {
    expect(isSafeHref('/login')).toBe(true);
    expect(isSafeHref('#section-ssot')).toBe(true);
    expect(isSafeHref('https://instagram.com/imamabdrsyd')).toBe(true);
    expect(isSafeHref('http://example.com')).toBe(true);
    expect(isSafeHref('mailto:imam.isyida@gmail.com')).toBe(true);
  });

  it('menolak skema yang bisa mengeksekusi kode', () => {
    expect(isSafeHref('javascript:alert(1)')).toBe(false);
    expect(isSafeHref('JaVaScRiPt:alert(1)')).toBe(false);
    expect(isSafeHref('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
    expect(isSafeHref('vbscript:msgbox(1)')).toBe(false);
  });

  it('menolak protocol-relative URL', () => {
    // `//evil.com` mewarisi skema halaman dan keluar dari domain sendiri —
    // terlihat seperti path relatif padahal bukan.
    expect(isSafeHref('//evil.com')).toBe(false);
  });
});

describe('parseInlineMarkup', () => {
  it('mengurai teks biasa jadi satu node', () => {
    expect(parseInlineMarkup('Halo dunia')).toEqual([{ type: 'text', value: 'Halo dunia' }]);
  });

  it('mengurai tebal, miring, dan kode', () => {
    expect(parseInlineMarkup('**Data akun.** Nama dan *email* lewat `openid`')).toEqual([
      { type: 'strong', value: 'Data akun.' },
      { type: 'text', value: ' Nama dan ' },
      { type: 'em', value: 'email' },
      { type: 'text', value: ' lewat ' },
      { type: 'code', value: 'openid' },
    ]);
  });

  it('mendahulukan tebal atas miring', () => {
    // Kalau urutan alternatif regex salah, `**x**` terbaca sebagai em berisi `*x*`.
    expect(parseInlineMarkup('**x**')).toEqual([{ type: 'strong', value: 'x' }]);
  });

  it('menandai tautan luar supaya dapat target=_blank', () => {
    expect(parseInlineMarkup('[Google API](https://developers.google.com/terms)')).toEqual([
      {
        type: 'link',
        label: 'Google API',
        href: 'https://developers.google.com/terms',
        external: true,
      },
    ]);
  });

  it('tidak menandai tautan internal sebagai luar', () => {
    expect(parseInlineMarkup('[Pengaturan](/settings)')).toEqual([
      { type: 'link', label: 'Pengaturan', href: '/settings', external: false },
    ]);
  });

  it('menurunkan tautan berbahaya jadi teks, bukan membuangnya', () => {
    // Labelnya harus tetap terbaca — isi dokumen legal tidak boleh hilang
    // diam-diam hanya karena URL-nya salah.
    expect(parseInlineMarkup('lihat [di sini](javascript:alert) ya')).toEqual([
      { type: 'text', value: 'lihat ' },
      { type: 'unsafe-link', label: 'di sini' },
      { type: 'text', value: ' ya' },
    ]);
  });

  it('memotong URL di tanda tutup kurung pertama', () => {
    // Batasan yang sama dengan markdown: URL ber-tanda kurung tidak didukung.
    // Diuji secara eksplisit supaya perilakunya disengaja, bukan kejutan —
    // dan untuk menegaskan sifat yang penting: URL yang terpotong pun tetap
    // gagal saringan, jadi tidak ada yang lolos ke atribut href.
    expect(parseInlineMarkup('[x](javascript:alert(1))')).toEqual([
      { type: 'unsafe-link', label: 'x' },
      { type: 'text', value: ')' },
    ]);
  });

  it('membiarkan markup yang tidak lengkap sebagai teks', () => {
    expect(parseInlineMarkup('2 * 3 = 6')).toEqual([{ type: 'text', value: '2 * 3 = 6' }]);
    expect(parseInlineMarkup('[tanpa url]')).toEqual([{ type: 'text', value: '[tanpa url]' }]);
  });
});

describe('mergeSiteContent', () => {
  const defaults = {
    hero: { title: { id: 'Judul', en: 'Title' }, visible: true },
    items: [{ n: '01' }, { n: '02' }],
    order: ['a', 'b', 'c'],
  };

  it('mengembalikan default utuh saat isi DB kosong', () => {
    expect(mergeSiteContent(defaults, null)).toEqual(defaults);
    expect(mergeSiteContent(defaults, undefined)).toEqual(defaults);
    expect(mergeSiteContent(defaults, {})).toEqual(defaults);
  });

  it('merge object secara rekursif dan menyisakan key yang tidak disebut', () => {
    const merged = mergeSiteContent(defaults, { hero: { title: { id: 'Baru' } } });
    expect(merged.hero.title).toEqual({ id: 'Baru', en: 'Title' });
    expect(merged.hero.visible).toBe(true);
  });

  it('MENGGANTI array, tidak merge per elemen', () => {
    // Inti dari aturan ini: kalau array ikut di-merge, item yang dihapus admin
    // akan muncul kembali dari default dan mustahil benar-benar dihapus.
    const merged = mergeSiteContent(defaults, { items: [{ n: '99' }] });
    expect(merged.items).toEqual([{ n: '99' }]);
  });

  it('membuat array kosong benar-benar kosong', () => {
    expect(mergeSiteContent(defaults, { items: [] }).items).toEqual([]);
  });

  it('menghormati urutan baru sepenuhnya', () => {
    expect(mergeSiteContent(defaults, { order: ['c', 'a'] }).order).toEqual(['c', 'a']);
  });

  it('mengabaikan key yang tidak dikenal default', () => {
    // Menjaga dokumen lama tidak menyelundupkan field yang sudah dihapus dari skema.
    const merged = mergeSiteContent(defaults, { tidakDikenal: 'x' } as never);
    expect(merged).not.toHaveProperty('tidakDikenal');
  });

  it('mempertahankan default saat tipe dari DB tidak cocok', () => {
    // Dokumen usang bisa menyimpan string di tempat object; renderer tidak boleh
    // meledak karenanya.
    expect(mergeSiteContent(defaults, { hero: 'rusak' }).hero).toEqual(defaults.hero);
    expect(mergeSiteContent(defaults, { items: 'rusak' }).items).toEqual(defaults.items);
  });

  it('menerima nilai palsu yang memang disengaja', () => {
    // false & string kosong harus menang atas default — kalau tidak, section
    // mustahil disembunyikan dan teks mustahil dikosongkan.
    const merged = mergeSiteContent(defaults, { hero: { visible: false } });
    expect(merged.hero.visible).toBe(false);
  });
});

describe('isSameContent', () => {
  it('tidak terpengaruh urutan key', () => {
    expect(isSameContent({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it('peka terhadap urutan elemen array', () => {
    // Urutan section adalah perubahan nyata yang harus memicu badge "belum tayang".
    expect(isSameContent(['a', 'b'], ['b', 'a'])).toBe(false);
  });

  it('membedakan isi yang benar-benar berbeda', () => {
    expect(isSameContent({ a: 1 }, { a: 2 })).toBe(false);
  });
});
