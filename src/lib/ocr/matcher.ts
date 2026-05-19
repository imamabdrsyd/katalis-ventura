import type { Account, Contact } from '@/types';

/**
 * Bobot skor matching akun:
 * - exact word match di account_name = 10
 * - substring match di account_name = 6
 * - exact word match di description = 5
 * - substring match di description = 3
 * - match di account_code = 1
 */
const WEIGHT_NAME_EXACT = 10;
const WEIGHT_NAME_SUBSTR = 6;
const WEIGHT_DESC_EXACT = 5;
const WEIGHT_DESC_SUBSTR = 3;
const WEIGHT_CODE = 1;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordRegex(keyword: string): RegExp {
  return new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i');
}

function scoreAccount(account: Account, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const name = (account.account_name || '').toLowerCase();
  const desc = (account.description || '').toLowerCase();
  const code = (account.account_code || '').toLowerCase();

  let score = 0;
  for (const kRaw of keywords) {
    const k = kRaw.toLowerCase();
    if (!k) continue;
    const wr = wordRegex(k);

    if (wr.test(name)) score += WEIGHT_NAME_EXACT;
    else if (name.includes(k)) score += WEIGHT_NAME_SUBSTR;

    if (wr.test(desc)) score += WEIGHT_DESC_EXACT;
    else if (desc.includes(k)) score += WEIGHT_DESC_SUBSTR;

    if (code.includes(k)) score += WEIGHT_CODE;
  }
  return score;
}

/**
 * Cari satu akun terbaik berdasarkan keyword dari OCR.
 * Kembali undefined kalau tidak ada akun dengan skor > 0.
 *
 * Prioritas tie-break: skor lebih tinggi menang. Pada skor sama, akun dengan
 * account_name lebih pendek (lebih spesifik) menang — mis. "Internet" mengalahkan
 * "Beban Internet & Telepon" dalam kasus exact match karena lebih ringkas.
 */
export function matchAccountByKeywords(
  accounts: Account[],
  keywords: string[] | undefined
): Account | undefined {
  if (!keywords || keywords.length === 0) return undefined;
  let best: { account: Account; score: number } | null = null;
  for (const acc of accounts) {
    const s = scoreAccount(acc, keywords);
    if (s <= 0) continue;
    if (
      !best ||
      s > best.score ||
      (s === best.score && acc.account_name.length < best.account.account_name.length)
    ) {
      best = { account: acc, score: s };
    }
  }
  return best?.account;
}

/**
 * Tokenisasi nama vendor → kata-kata yang signifikan (panjang ≥ 3, exclude stopwords).
 * "Indihome - Telkom" → ["indihome","telkom"]
 * "PT Finnet Indonesia" → ["finnet","indonesia"]
 */
const VENDOR_STOPWORDS = new Set([
  'pt', 'cv', 'tbk', 'persero', 'indonesia', 'group', 'co', 'inc', 'ltd',
  'the', 'and', 'dan', 'atau', 'or',
]);

function tokenizeVendor(vendor: string): string[] {
  return vendor
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !VENDOR_STOPWORDS.has(t));
}

/**
 * Cari satu kontak yang paling cocok dengan nama vendor OCR.
 * Strategi:
 *  1. Exact match (case-insensitive) → menang absolut
 *  2. Vendor name muncul utuh di nama kontak → skor tinggi
 *  3. Hitung jumlah token vendor yang muncul di nama kontak → skor proporsional
 *
 * Contoh:
 *  vendor "Telkomsel" + contacts ["Indihome - Telkom","Telkomsel Prabayar"]
 *  → "Telkomsel Prabayar" menang (token "telkomsel" cocok penuh)
 *
 *  vendor "Telkomsel" tanpa keyword "telkom" → kalau cuma ada "Indihome - Telkom"
 *  matcher TIDAK akan match (token berbeda) — itu kasus untuk matcher dengan keywords.
 */
export function matchContactByVendor(
  contacts: Contact[],
  vendor: string | undefined,
  extraKeywords: string[] = []
): Contact | undefined {
  if (!vendor || vendor.trim().length === 0) return undefined;
  const vendorLower = vendor.trim().toLowerCase();
  const vendorTokens = tokenizeVendor(vendor);
  const extraTokens = extraKeywords
    .map((k) => k.toLowerCase())
    .filter((k) => k.length >= 3 && !VENDOR_STOPWORDS.has(k));
  const allTokens = Array.from(new Set([...vendorTokens, ...extraTokens]));

  if (allTokens.length === 0) return undefined;

  let best: { contact: Contact; score: number } | null = null;

  for (const contact of contacts) {
    const nameLower = (contact.name || '').toLowerCase();
    if (!nameLower) continue;

    let score = 0;

    // 1. Exact match
    if (nameLower === vendorLower) {
      score += 100;
    }

    // 2. Vendor utuh muncul di nama kontak
    if (nameLower.includes(vendorLower)) {
      score += 50;
    }

    // 3. Token-level overlap (vendor tokens lebih berbobot dari extra keyword)
    const contactTokens = tokenizeVendor(contact.name);
    for (const vt of vendorTokens) {
      if (contactTokens.includes(vt)) score += 10;
      else if (nameLower.includes(vt)) score += 5;
    }
    for (const et of extraTokens) {
      if (vendorTokens.includes(et)) continue; // hindari double-count
      if (contactTokens.includes(et)) score += 6;
      else if (nameLower.includes(et)) score += 3;
    }

    if (score <= 0) continue;
    if (!best || score > best.score || (score === best.score && contact.name.length < best.contact.name.length)) {
      best = { contact, score };
    }
  }

  return best?.contact;
}
