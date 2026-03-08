// Shopee Open API v2 — Type definitions

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface ShopeeTokenResponse {
  access_token: string;
  refresh_token: string;
  expire_in: number;        // seconds until access_token expires
  refresh_token_expire_in: number;
  request_id: string;
  error: string;
  message: string;
  shop_id_list?: number[];
  merchant_id_list?: number[];
}

export interface ShopeeShopInfo {
  shop_id: number;
  shop_name: string;
  logo: string;
  status: string;
  description: string;
}

// ─── Order ───────────────────────────────────────────────────────────────────

export type ShopeeOrderStatus =
  | 'UNPAID'
  | 'READY_TO_SHIP'
  | 'PROCESSED'
  | 'SHIPPED'
  | 'TO_CONFIRM_RECEIVE'
  | 'IN_CANCEL'
  | 'CANCELLED'
  | 'TO_RETURN'
  | 'COMPLETED';

export interface ShopeeOrderSummary {
  order_sn: string;
  order_status: ShopeeOrderStatus;
  create_time: number;   // unix timestamp
  update_time: number;
}

export interface ShopeeOrderListResponse {
  order_list: ShopeeOrderSummary[];
  more: boolean;
  next_cursor: string;
  request_id: string;
  error: string;
  message: string;
}

export interface ShopeeOrderItem {
  item_id: number;
  item_name: string;
  item_sku: string;
  variation_id: number;
  variation_name: string;
  variation_sku: string;
  order_item_id: number;
  quantity_purchased: number;
  original_price: number;
  sale_price: number;
  currency: string;
  weight: number;
  image: { image_url: string };
}

export interface ShopeeOrderDetail {
  order_sn: string;
  order_status: ShopeeOrderStatus;
  create_time: number;
  update_time: number;
  buyer_username: string;
  buyer_user_id: number;
  total_amount: number;
  currency: string;
  payment_method: string;
  estimated_shipping_fee: number;
  actual_shipping_fee: number;
  buyer_cpf_id?: string;
  note?: string;
  item_list: ShopeeOrderItem[];
  invoice_data?: {
    number: string;
    series_number: string;
    access_key: string;
    issue_date: number;
    total_value: number;
    products_total_value: number;
    tax_code: string;
  };
  message_to_seller?: string;
  region: string;
  ship_by_date: number;
}

export interface ShopeeOrderDetailResponse {
  order_list: ShopeeOrderDetail[];
  request_id: string;
  error: string;
  message: string;
}

// ─── Common API response wrapper ─────────────────────────────────────────────

export interface ShopeeApiResponse<T> {
  error: string;
  message: string;
  request_id: string;
  response?: T;
}
