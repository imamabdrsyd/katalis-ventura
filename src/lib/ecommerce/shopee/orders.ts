import { buildShopUrl } from './signature';
import { refreshAccessToken } from './auth';
import type {
  ShopeeOrderSummary,
  ShopeeOrderDetail,
  ShopeeOrderListResponse,
  ShopeeOrderDetailResponse,
  ShopeeApiResponse,
} from './types';

const ORDER_LIST_PATH = '/api/v2/order/get_order_list';
const ORDER_DETAIL_PATH = '/api/v2/order/get_order_detail';

export interface FetchOrdersOptions {
  accessToken: string;
  shopId: number;
  /** Unix timestamp — fetch order setelah waktu ini */
  fromTime: number;
  /** Unix timestamp — fetch order sebelum waktu ini (default: now) */
  toTime?: number;
  cursor?: string;
  pageSize?: number;
}

export interface FetchOrdersResult {
  orders: ShopeeOrderSummary[];
  nextCursor: string;
  hasMore: boolean;
}

/**
 * Ambil list order dari Shopee (hanya COMPLETED).
 */
export async function fetchOrderList(opts: FetchOrdersOptions): Promise<FetchOrdersResult> {
  const { accessToken, shopId, fromTime, cursor, pageSize = 50 } = opts;
  const toTime = opts.toTime ?? Math.floor(Date.now() / 1000);

  const extra: Record<string, string> = {
    time_range_field: 'create_time',
    time_from: String(fromTime),
    time_to: String(toTime),
    page_size: String(pageSize),
    order_status: 'COMPLETED',
  };

  if (cursor) extra.cursor = cursor;

  const url = buildShopUrl(ORDER_LIST_PATH, accessToken, shopId, extra);
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Shopee get_order_list failed: ${res.status}`);
  }

  const data: ShopeeApiResponse<ShopeeOrderListResponse> = await res.json();

  if (data.error && data.error !== '') {
    throw new Error(`Shopee API error: ${data.error} — ${data.message}`);
  }

  const response = data.response!;

  return {
    orders: response.order_list ?? [],
    nextCursor: response.next_cursor ?? '',
    hasMore: response.more ?? false,
  };
}

/**
 * Ambil detail order (max 50 per request).
 */
export async function fetchOrderDetails(
  orderSnList: string[],
  accessToken: string,
  shopId: number
): Promise<ShopeeOrderDetail[]> {
  if (orderSnList.length === 0) return [];

  // Shopee max 50 per request
  const chunks: string[][] = [];
  for (let i = 0; i < orderSnList.length; i += 50) {
    chunks.push(orderSnList.slice(i, i + 50));
  }

  const results: ShopeeOrderDetail[] = [];

  for (const chunk of chunks) {
    const extra: Record<string, string> = {
      order_sn_list: chunk.join(','),
      response_optional_fields: 'buyer_username,item_list,total_amount,payment_method,actual_shipping_fee',
    };

    const url = buildShopUrl(ORDER_DETAIL_PATH, accessToken, shopId, extra);
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Shopee get_order_detail failed: ${res.status}`);
    }

    const data: ShopeeApiResponse<ShopeeOrderDetailResponse> = await res.json();

    if (data.error && data.error !== '') {
      throw new Error(`Shopee API error: ${data.error} — ${data.message}`);
    }

    results.push(...(data.response?.order_list ?? []));
  }

  return results;
}

/**
 * Cek apakah access_token perlu di-refresh (< 30 menit tersisa).
 */
export function isTokenExpiringSoon(tokenExpiresAt: string): boolean {
  const expiresAt = new Date(tokenExpiresAt).getTime();
  const thirtyMinutes = 30 * 60 * 1000;
  return Date.now() + thirtyMinutes >= expiresAt;
}

/**
 * Refresh token jika hampir expired, return token yang valid.
 */
export async function getValidToken(connection: {
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  shop_id: number;
}): Promise<{ accessToken: string; refreshToken: string; tokenExpiresAt: string; refreshed: boolean }> {
  if (!isTokenExpiringSoon(connection.token_expires_at)) {
    return {
      accessToken: connection.access_token,
      refreshToken: connection.refresh_token,
      tokenExpiresAt: connection.token_expires_at,
      refreshed: false,
    };
  }

  const tokenData = await refreshAccessToken(connection.refresh_token, connection.shop_id);

  if (tokenData.error && tokenData.error !== '') {
    throw new Error(`Token refresh failed: ${tokenData.message}`);
  }

  const tokenExpiresAt = new Date(Date.now() + tokenData.expire_in * 1000).toISOString();

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    tokenExpiresAt,
    refreshed: true,
  };
}
