export const BASE_CURRENCY = 'IDR';

export const SUPPORTED_CURRENCIES = [
  'IDR',
  'USD',
  'SGD',
  'EUR',
  'AUD',
  'JPY',
  'CNY',
  'MYR',
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export interface CurrencyFieldsInput {
  amount: number;
  original_amount?: number | null;
  currency_code?: string | null;
  fx_rate?: number | null;
  fx_rate_date?: string | null;
}

export interface NormalizedCurrencyFields {
  amount: number;
  original_amount: number;
  currency_code: CurrencyCode;
  fx_rate: number;
  fx_rate_date: string | null;
}

export function normalizeCurrencyCode(value?: string | null): CurrencyCode {
  const normalized = (value ?? BASE_CURRENCY).trim().toUpperCase();
  if (SUPPORTED_CURRENCIES.includes(normalized as CurrencyCode)) {
    return normalized as CurrencyCode;
  }
  return BASE_CURRENCY;
}

export function roundMoney(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const multiplier = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

export function calculateBaseAmount(originalAmount: number, fxRate: number): number {
  return roundMoney(originalAmount * fxRate, 2);
}

export function normalizeCurrencyFields(input: CurrencyFieldsInput): NormalizedCurrencyFields {
  const currency_code = normalizeCurrencyCode(input.currency_code);
  const original_amount = roundMoney(input.original_amount ?? input.amount, 2);
  const fx_rate = currency_code === BASE_CURRENCY
    ? 1
    : roundMoney(input.fx_rate ?? 1, 8);
  const amount = currency_code === BASE_CURRENCY
    ? original_amount
    : calculateBaseAmount(original_amount, fx_rate);

  return {
    amount,
    original_amount,
    currency_code,
    fx_rate,
    fx_rate_date: input.fx_rate_date ?? null,
  };
}

export function isForeignCurrency(currencyCode?: string | null): boolean {
  return normalizeCurrencyCode(currencyCode) !== BASE_CURRENCY;
}

export function formatMoney(amount: number, currencyCode: string = BASE_CURRENCY): string {
  const currency = normalizeCurrencyCode(currencyCode);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'IDR' ? 0 : 2,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2,
  }).format(amount);
}
