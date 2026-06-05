import { describe, expect, it } from 'vitest';
import {
  isTransactionCancellation,
  parseIncompleteTransactionMessage,
  parseTransactionMessage,
} from '@/lib/telegram/parser';

describe('transaction message parser', () => {
  it('parses a complete transaction', () => {
    expect(parseTransactionMessage('bayar listrik 500rb')).toMatchObject({
      name: 'bayar listrik',
      amount: 500_000,
      category: 'OPEX',
    });
  });

  it('recognizes a transaction description that is only missing its amount', () => {
    expect(parseIncompleteTransactionMessage('bayar listrik')).toMatchObject({
      name: 'bayar listrik',
      amount: 0,
      category: 'OPEX',
    });
  });

  it('does not treat arbitrary chat as an incomplete transaction', () => {
    expect(parseIncompleteTransactionMessage('halo apa kabar')).toBeNull();
  });

  it('does not treat a complete transaction as incomplete', () => {
    expect(parseIncompleteTransactionMessage('jual kopi 150rb')).toBeNull();
  });

  it('recognizes cancellation replies while waiting for an amount', () => {
    expect(isTransactionCancellation('Batal')).toBe(true);
    expect(isTransactionCancellation('cancel')).toBe(true);
    expect(isTransactionCancellation('500rb')).toBe(false);
  });
});
