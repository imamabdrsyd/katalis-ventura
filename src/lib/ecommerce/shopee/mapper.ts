import type { ShopeeOrderDetail } from './types';

/**
 * Map satu Shopee order ke format insert transaksi Katalis.
 *
 * Pola double-entry:
 *   Dr Kas/Bank (1200/1100)  →  Cr Pendapatan (4100)
 *   Kategori: EARN
 */
export interface MappedTransaction {
  business_id: string;
  date: string;                   // YYYY-MM-DD
  name: string;                   // buyer_username
  description: string;            // ringkasan item
  amount: number;                 // total_amount
  category: 'EARN';
  debit_account_id: string;       // Kas/Bank account id
  credit_account_id: string;      // Pendapatan account id
  is_double_entry: boolean;
  notes: string;
  meta: Record<string, unknown>;
}

export interface AccountIds {
  /** ID akun Bank (1200) atau Kas (1100) — dipakai sebagai debit */
  cashOrBankAccountId: string;
  /** ID akun Pendapatan (4100) — dipakai sebagai credit */
  revenueAccountId: string;
}

/**
 * Buat ringkasan item dari list produk.
 */
function buildDescription(order: ShopeeOrderDetail): string {
  if (!order.item_list || order.item_list.length === 0) {
    return `Order Shopee #${order.order_sn}`;
  }

  const summary = order.item_list
    .map((item) => `${item.item_name}${item.variation_name ? ` (${item.variation_name})` : ''} x${item.quantity_purchased}`)
    .join(', ');

  // Potong jika terlalu panjang
  return summary.length > 200 ? summary.slice(0, 197) + '...' : summary;
}

/**
 * Map satu ShopeeOrderDetail → MappedTransaction.
 */
export function mapOrderToTransaction(
  order: ShopeeOrderDetail,
  businessId: string,
  accounts: AccountIds
): MappedTransaction {
  const date = new Date(order.create_time * 1000).toISOString().split('T')[0];

  return {
    business_id: businessId,
    date,
    name: order.buyer_username || 'Pembeli Shopee',
    description: buildDescription(order),
    amount: order.total_amount,
    category: 'EARN',
    debit_account_id: accounts.cashOrBankAccountId,
    credit_account_id: accounts.revenueAccountId,
    is_double_entry: true,
    notes: `Sinkronisasi otomatis dari Shopee. Order SN: ${order.order_sn}`,
    meta: {
      source: 'shopee',
      shopee_order_sn: order.order_sn,
      shopee_payment_method: order.payment_method,
      synced_at: new Date().toISOString(),
    },
  };
}

/**
 * Map banyak order sekaligus.
 */
export function mapOrdersToTransactions(
  orders: ShopeeOrderDetail[],
  businessId: string,
  accounts: AccountIds
): MappedTransaction[] {
  return orders.map((order) => mapOrderToTransaction(order, businessId, accounts));
}
