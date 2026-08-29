import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { translations } from '@/lib/i18n';

/**
 * `omniLink.icons` diketik `Record<string, string>`, jadi TypeScript TIDAK
 * menangkap kunci yang hilang seperti pada namespace lain. Kunci yang hilang
 * gagal diam-diam: picker jatuh ke nama Lucide mentah ("BarChart2") dan icon itu
 * hilang dari hasil pencarian bahasa tersebut. Tes ini menutup celah itu.
 */
describe('label icon omni-channel', () => {
  const source = readFileSync(
    resolve(__dirname, '../../src/components/business/AddOmniChannelLinkModal.tsx'),
    'utf-8'
  );
  const iconNames = [...source.matchAll(/\{ name: '([^']+)', Icon: /g)].map((m) => m[1]);

  it('menemukan daftar icon di komponen', () => {
    expect(iconNames.length).toBeGreaterThan(50);
  });

  for (const locale of ['id', 'en'] as const) {
    it(`kamus ${locale} punya label untuk tiap icon`, () => {
      const icons = translations[locale].omniLink.icons;
      expect(iconNames.filter((name) => !icons[name])).toEqual([]);
    });

    it(`kamus ${locale} tidak menyimpan label icon yatim`, () => {
      const orphans = Object.keys(translations[locale].omniLink.icons).filter(
        (name) => !iconNames.includes(name)
      );
      expect(orphans).toEqual([]);
    });
  }
});
