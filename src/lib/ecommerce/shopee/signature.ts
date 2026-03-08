import crypto from 'crypto';

const SHOPEE_BASE_URL = 'https://partner.shopeemobile.com';
const SHOPEE_SANDBOX_URL = 'https://partner.test-stable.shopeemobile.com';

export function getShopeeBaseUrl(): string {
  return process.env.SHOPEE_ENV === 'production' ? SHOPEE_BASE_URL : SHOPEE_SANDBOX_URL;
}

/**
 * Generate HMAC-SHA256 signature untuk Shopee API v2.
 *
 * Format:
 *  - Public API (tanpa shop/merchant):  partner_id + api_path + timestamp
 *  - Shop-level API (dengan access_token + shop_id):
 *      partner_id + api_path + timestamp + access_token + shop_id
 */
export function generateSignature(params: {
  partnerKey: string;
  partnerId: number;
  apiPath: string;
  timestamp: number;
  accessToken?: string;
  shopId?: number;
}): string {
  const { partnerKey, partnerId, apiPath, timestamp, accessToken, shopId } = params;

  let base = `${partnerId}${apiPath}${timestamp}`;

  if (accessToken && shopId) {
    base += `${accessToken}${shopId}`;
  }

  return crypto.createHmac('sha256', partnerKey).update(base).digest('hex');
}

/**
 * Buat URL lengkap untuk endpoint Shopee (public, tanpa shop context).
 * Dipakai untuk auth endpoints: get_access_token, refresh_access_token.
 */
export function buildPublicUrl(apiPath: string): string {
  const partnerId = Number(process.env.SHOPEE_PARTNER_ID!);
  const partnerKey = process.env.SHOPEE_PARTNER_KEY!;
  const timestamp = Math.floor(Date.now() / 1000);

  const sign = generateSignature({ partnerKey, partnerId, apiPath, timestamp });

  const params = new URLSearchParams({
    partner_id: String(partnerId),
    timestamp: String(timestamp),
    sign,
  });

  return `${getShopeeBaseUrl()}${apiPath}?${params}`;
}

/**
 * Buat URL lengkap untuk shop-level API (butuh access_token + shop_id).
 */
export function buildShopUrl(
  apiPath: string,
  accessToken: string,
  shopId: number,
  extra?: Record<string, string>
): string {
  const partnerId = Number(process.env.SHOPEE_PARTNER_ID!);
  const partnerKey = process.env.SHOPEE_PARTNER_KEY!;
  const timestamp = Math.floor(Date.now() / 1000);

  const sign = generateSignature({ partnerKey, partnerId, apiPath, timestamp, accessToken, shopId });

  const params = new URLSearchParams({
    partner_id: String(partnerId),
    timestamp: String(timestamp),
    sign,
    access_token: accessToken,
    shop_id: String(shopId),
    ...extra,
  });

  return `${getShopeeBaseUrl()}${apiPath}?${params}`;
}
