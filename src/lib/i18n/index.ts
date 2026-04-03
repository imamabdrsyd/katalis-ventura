export type { Locale, Translations } from './types';
export { id } from './id';
export { en } from './en';

import { id } from './id';
import { en } from './en';
import type { Locale, Translations } from './types';

export const translations: Record<Locale, Translations> = { id, en };

export const LOCALE_LABELS: Record<Locale, string> = {
  id: 'Bahasa Indonesia',
  en: 'English',
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  id: '🇮🇩',
  en: '🇺🇸',
};

export const DEFAULT_LOCALE: Locale = 'id';
export const LOCALE_STORAGE_KEY = 'katalis_locale';
