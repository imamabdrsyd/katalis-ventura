import { buildPublicUrl, getShopeeBaseUrl, generateSignature } from './signature';
import type { ShopeeTokenResponse, ShopeeShopInfo, ShopeeApiResponse } from './types';

/**
 * Buat URL redirect ke halaman otorisasi Shopee.
 * User akan di-redirect ke URL ini, lalu Shopee redirect balik ke callback URL kita.
 */
export function getShopeeAuthUrl(redirectUrl: string): string {
  const partnerId = Number(process.env.SHOPEE_PARTNER_ID!);
  const partnerKey = process.env.SHOPEE_PARTNER_KEY!;
  const timestamp = Math.floor(Date.now() / 1000);
  const apiPath = '/api/v2/shop/auth_partner';

  const sign = generateSignature({ partnerKey, partnerId, apiPath, timestamp });

  const params = new URLSearchParams({
    partner_id: String(partnerId),
    timestamp: String(timestamp),
    sign,
    redirect: redirectUrl,
  });

  return `${getShopeeBaseUrl()}${apiPath}?${params}`;
}

/**
 * Tukar authorization code (dari callback) menjadi access_token + refresh_token.
 */
export async function exchangeCodeForToken(
  code: string,
  shopId: number
): Promise<ShopeeTokenResponse> {
  const url = buildPublicUrl('/api/v2/auth/token/get');

  const body = {
    code,
    shop_id: shopId,
    partner_id: Number(process.env.SHOPEE_PARTNER_ID!),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Shopee token exchange failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Refresh access_token menggunakan refresh_token.
 * access_token valid 4 jam, refresh_token valid 30 hari.
 */
export async function refreshAccessToken(
  refreshToken: string,
  shopId: number
): Promise<ShopeeTokenResponse> {
  const url = buildPublicUrl('/api/v2/auth/access_token/get');

  const body = {
    refresh_token: refreshToken,
    shop_id: shopId,
    partner_id: Number(process.env.SHOPEE_PARTNER_ID!),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Shopee token refresh failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Ambil info toko dari Shopee.
 */
export async function getShopInfo(
  accessToken: string,
  shopId: number
): Promise<ShopeeShopInfo> {
  const { buildShopUrl } = await import('./signature');
  const url = buildShopUrl('/api/v2/shop/get_shop_info', accessToken, shopId);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Shopee get_shop_info failed: ${res.status}`);
  }

  const data: ShopeeApiResponse<ShopeeShopInfo> = await res.json();

  if (data.error && data.error !== '') {
    throw new Error(`Shopee API error: ${data.error} — ${data.message}`);
  }

  return data.response!;
}
