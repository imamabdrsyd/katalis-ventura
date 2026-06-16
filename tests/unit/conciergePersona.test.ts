import { describe, expect, it } from 'vitest';
import { pickConciergePersona, buildConciergeSystemPrompt } from '@/lib/ai/concierge/personas';

describe('pickConciergePersona', () => {
  it('sektor produk/retail/F&B/agri → consultative_sales', () => {
    expect(pickConciergePersona('personal_care')).toBe('consultative_sales');
    expect(pickConciergePersona('food_and_beverage')).toBe('consultative_sales');
    expect(pickConciergePersona('agribusiness')).toBe('consultative_sales');
  });

  it('sektor penginapan → hospitality', () => {
    expect(pickConciergePersona('accommodation')).toBe('hospitality');
    expect(pickConciergePersona('short_term_rental')).toBe('hospitality');
  });

  it('sektor layanan/properti/agensi → service_booking', () => {
    expect(pickConciergePersona('real_estate')).toBe('service_booking');
    expect(pickConciergePersona('property_management')).toBe('service_booking');
    expect(pickConciergePersona('creative_agency')).toBe('service_booking');
  });

  it('sektor tidak dikenal / null → default consultative_sales', () => {
    expect(pickConciergePersona(null)).toBe('consultative_sales');
    expect(pickConciergePersona('sektor_aneh')).toBe('consultative_sales');
    expect(pickConciergePersona('')).toBe('consultative_sales');
  });
});

describe('buildConciergeSystemPrompt', () => {
  const base = {
    businessName: 'elvéa Indonesia',
    businessSector: 'personal_care',
    channel: 'instagram',
    aiPersona: null,
    catalogItems: [
      { name: 'Serum Anti Rontok', default_price: 150000, unit: 'botol', description: 'untuk rambut rontok' },
    ],
    businessKnowledge: null,
  };

  it('memuat nama bisnis, item katalog dengan harga, dan kontrak JSON output', () => {
    const prompt = buildConciergeSystemPrompt(base);
    expect(prompt).toContain('elvéa Indonesia');
    expect(prompt).toContain('Serum Anti Rontok');
    expect(prompt).toContain('Rp 150.000');
    expect(prompt).toContain('{"reply":');
  });

  it('persona consultative_sales muncul untuk sektor personal_care', () => {
    const prompt = buildConciergeSystemPrompt(base);
    expect(prompt).toContain('consultative selling');
  });

  it('persona hospitality untuk sektor accommodation', () => {
    const prompt = buildConciergeSystemPrompt({ ...base, businessSector: 'accommodation' });
    expect(prompt.toLowerCase()).toContain('hospitality');
  });

  it('larangan mengarang harga selalu hadir', () => {
    const prompt = buildConciergeSystemPrompt(base);
    expect(prompt).toContain('DILARANG mengarang harga');
  });

  it('katalog kosong → instruksi jangan mengarang item/harga', () => {
    const prompt = buildConciergeSystemPrompt({ ...base, catalogItems: [] });
    expect(prompt).toContain('belum tersedia');
  });

  it('aiPersona pemilik disisipkan bila ada', () => {
    const prompt = buildConciergeSystemPrompt({ ...base, aiPersona: 'pakai gaya bahasa gaul' });
    expect(prompt).toContain('pakai gaya bahasa gaul');
  });
});
