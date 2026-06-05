import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ai/provider', () => ({
  generateText: vi.fn(),
}));

import { generateText } from '@/lib/ai/provider';
import { extractTransactionFromText, resolveTransactionDate } from '@/lib/ai/parseTransaction';

const mockedGenerateText = vi.mocked(generateText);

describe('extractTransactionFromText', () => {
  beforeEach(() => {
    mockedGenerateText.mockReset();
  });

  it('asks for an amount through the rule-based fallback when providers fail', async () => {
    mockedGenerateText.mockResolvedValue(null);

    await expect(extractTransactionFromText('bayar listrik')).resolves.toMatchObject({
      status: 'needs_amount',
      source: 'rule_based',
      extracted: {
        name: 'bayar listrik',
        amount: 0,
        category_hint: 'OPEX',
      },
    });
  });

  it('parses the combined follow-up through the rule-based fallback', async () => {
    mockedGenerateText.mockResolvedValue(null);

    await expect(extractTransactionFromText('bayar listrik 500rb')).resolves.toMatchObject({
      status: 'complete',
      source: 'rule_based',
      extracted: {
        name: 'bayar listrik',
        amount: 500_000,
        category_hint: 'OPEX',
      },
    });
  });

  it('keeps returning null for unrelated text when providers fail', async () => {
    mockedGenerateText.mockResolvedValue(null);

    await expect(extractTransactionFromText('halo apa kabar')).resolves.toBeNull();
  });
});

describe('resolveTransactionDate', () => {
  it('preserves the date captured before asking for the amount', () => {
    expect(resolveTransactionDate(null, '2026-05-05', '2026-06-06')).toBe('2026-05-05');
  });

  it('prefers a date extracted from the completed follow-up', () => {
    expect(resolveTransactionDate('2026-05-06', '2026-05-05', '2026-06-06')).toBe('2026-05-06');
  });

  it('falls back when no valid date is available', () => {
    expect(resolveTransactionDate(null, '5 mei', '2026-06-06')).toBe('2026-06-06');
  });
});
