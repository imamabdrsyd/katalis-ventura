// Reserved top-level route segments that cannot be used as omni-channel slugs
export const RESERVED_SLUGS = new Set([
  '',
  'login',
  'signup',
  'join-business',
  'setup-business',
  'dashboard',
  'businesses',
  'accounts',
  'transactions',
  'general-ledger',
  'trial-balance',
  'income-statement',
  'balance-sheet',
  'cash-flow',
  'reports',
  'scenario-modeling',
  'roi-forecast',
  'settings',
  'api',
]);

/**
 * Converts a business name into a URL-safe slug.
 * "Katalis Ventura Cafe!" => "katalis-ventura-cafe"
 */
export function generateSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

export function isValidSlugFormat(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/.test(slug) || /^[a-z0-9]{2,3}$/.test(slug);
}

/**
 * Generate a list of candidate alternative slugs when the original is taken.
 * e.g. "warung-kopi" => ["warung-kopi-2", "warung-kopi-id", "warung-kopi-official", ...]
 */
export function generateSlugSuggestions(base: string): string[] {
  const year = new Date().getFullYear();
  const suffixes = ['2', 'id', 'official', 'store', year.toString(), `${year}`, 'biz', 'co'];
  return suffixes
    .map((s) => `${base}-${s}`)
    .filter((s) => isValidSlugFormat(s) && !isReservedSlug(s));
}
