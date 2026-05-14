import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, getAuthenticatedUser, createServerClient } from '@/lib/supabase-server';
import { businessIdSchema } from '@/lib/validations';
import { getValidToken } from '@/lib/ecommerce/shopee/orders';
import { fetchOrderList, fetchOrderDetails } from '@/lib/ecommerce/shopee/orders';
import { mapOrdersToTransactions } from '@/lib/ecommerce/shopee/mapper';
import { encryptToken, decryptToken, isEncrypted } from '@/lib/utils/tokenCrypto';

/**
 * POST /api/ecommerce/sync
 * Body: { businessId: string, platform: 'shopee' }
 *
 * Trigger manual sync: ambil order dari Shopee, insert sebagai transaksi.
 * Deduplikasi via meta->>'shopee_order_sn'.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { businessId, platform = 'shopee' } = body;

  if (!businessId) {
    return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
  }

  const parsed = businessIdSchema.safeParse(businessId);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid business ID' }, { status: 400 });
  }

  const supabase = await createServerClient();

  // Verifikasi role
  if (!(await canManageBusiness(supabase, user.id, businessId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Ambil koneksi aktif
  const { data: connection, error: connError } = await supabase
    .from('business_ecommerce_connections')
    .select('*')
    .eq('business_id', businessId)
    .eq('platform', platform)
    .eq('is_active', true)
    .single();

  if (connError || !connection) {
    return NextResponse.json({ error: 'Koneksi Shopee tidak ditemukan' }, { status: 404 });
  }

  // Buat sync log
  const { data: syncLog } = await supabase
    .from('ecommerce_sync_logs')
    .insert({
      connection_id: connection.id,
      sync_type: 'manual',
      status: 'running',
    })
    .select('id')
    .single();

  const syncLogId = syncLog?.id;

  try {
    // Decrypt tokens before use (support rows written before encryption was added)
    const plainAccessToken = isEncrypted(connection.access_token)
      ? decryptToken(connection.access_token)
      : connection.access_token;
    const plainRefreshToken = isEncrypted(connection.refresh_token)
      ? decryptToken(connection.refresh_token)
      : connection.refresh_token;

    // Refresh token jika perlu
    const tokenInfo = await getValidToken({
      access_token: plainAccessToken,
      refresh_token: plainRefreshToken,
      token_expires_at: connection.token_expires_at,
      shop_id: connection.shop_id,
    });

    // Update token di DB jika di-refresh (simpan terenkripsi)
    if (tokenInfo.refreshed) {
      await supabase
        .from('business_ecommerce_connections')
        .update({
          access_token: encryptToken(tokenInfo.accessToken),
          refresh_token: encryptToken(tokenInfo.refreshToken),
          token_expires_at: tokenInfo.tokenExpiresAt,
        })
        .eq('id', connection.id);
    }

    // Tentukan dari-kapan sync: pakai sync_cursor atau 30 hari lalu
    const fromTime = connection.sync_cursor
      ? Number(connection.sync_cursor)
      : Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

    // Ambil semua order (loop pagination)
    const allOrderSns: string[] = [];
    let cursor = '';
    let hasMore = true;

    while (hasMore) {
      const result = await fetchOrderList({
        accessToken: tokenInfo.accessToken,
        shopId: connection.shop_id,
        fromTime,
        cursor: cursor || undefined,
      });

      allOrderSns.push(...result.orders.map((o) => o.order_sn));
      cursor = result.nextCursor;
      hasMore = result.hasMore;
    }

    if (allOrderSns.length === 0) {
      await supabase
        .from('ecommerce_sync_logs')
        .update({ status: 'success', orders_fetched: 0, transactions_created: 0, completed_at: new Date().toISOString() })
        .eq('id', syncLogId);

      await supabase
        .from('business_ecommerce_connections')
        .update({ last_synced_at: new Date().toISOString(), sync_cursor: String(Math.floor(Date.now() / 1000)) })
        .eq('id', connection.id);

      return NextResponse.json({ success: true, ordersFound: 0, transactionsCreated: 0 });
    }

    // Ambil detail order
    const orderDetails = await fetchOrderDetails(allOrderSns, tokenInfo.accessToken, connection.shop_id);

    // Cek order yang sudah pernah di-sync (deduplikasi)
    const orderSnsToCheck = orderDetails.map((o) => o.order_sn);
    const { data: existingTxns } = await supabase
      .from('transactions')
      .select('meta')
      .eq('business_id', businessId)
      .in('meta->>shopee_order_sn', orderSnsToCheck);

    const alreadySynced = new Set(
      (existingTxns ?? []).map((t) => (t.meta as Record<string, string>)?.shopee_order_sn)
    );

    const newOrders = orderDetails.filter((o) => !alreadySynced.has(o.order_sn));

    if (newOrders.length === 0) {
      await supabase
        .from('ecommerce_sync_logs')
        .update({ status: 'success', orders_fetched: orderDetails.length, transactions_created: 0, completed_at: new Date().toISOString() })
        .eq('id', syncLogId);

      await supabase
        .from('business_ecommerce_connections')
        .update({ last_synced_at: new Date().toISOString(), sync_cursor: String(Math.floor(Date.now() / 1000)) })
        .eq('id', connection.id);

      return NextResponse.json({ success: true, ordersFound: orderDetails.length, transactionsCreated: 0, message: 'Semua order sudah pernah di-sync' });
    }

    // Cari akun Bank (1200) dan Pendapatan (4100) untuk bisnis ini
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, account_code')
      .eq('business_id', businessId)
      .in('account_code', ['1200', '1100', '4100'])
      .eq('is_active', true);

    const bankAccount = accounts?.find((a) => a.account_code === '1200') ?? accounts?.find((a) => a.account_code === '1100');
    const revenueAccount = accounts?.find((a) => a.account_code === '4100');

    if (!bankAccount || !revenueAccount) {
      throw new Error('Akun Bank (1200/1100) atau Pendapatan (4100) tidak ditemukan di Chart of Accounts');
    }

    // Map order → transaksi
    const mapped = mapOrdersToTransactions(newOrders, businessId, {
      cashOrBankAccountId: bankAccount.id,
      revenueAccountId: revenueAccount.id,
    });

    // Bulk insert transaksi (batch 100)
    let totalCreated = 0;
    const errors: string[] = [];

    for (let i = 0; i < mapped.length; i += 100) {
      const batch = mapped.slice(i, i + 100);
      const { error: insertError, count } = await supabase
        .from('transactions')
        .insert(batch.map((t) => ({ ...t, created_by: user.id })));

      if (insertError) {
        errors.push(insertError.message);
      } else {
        totalCreated += batch.length;
      }
    }

    // Update sync log & cursor
    const newCursor = String(Math.floor(Date.now() / 1000));

    await supabase
      .from('ecommerce_sync_logs')
      .update({
        status: errors.length > 0 ? 'partial' : 'success',
        orders_fetched: orderDetails.length,
        transactions_created: totalCreated,
        errors: errors.length > 0 ? errors : [],
        completed_at: new Date().toISOString(),
      })
      .eq('id', syncLogId);

    await supabase
      .from('business_ecommerce_connections')
      .update({ last_synced_at: new Date().toISOString(), sync_cursor: newCursor })
      .eq('id', connection.id);

    return NextResponse.json({
      success: true,
      ordersFound: orderDetails.length,
      newOrders: newOrders.length,
      transactionsCreated: totalCreated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Shopee sync error:', err);

    await supabase
      .from('ecommerce_sync_logs')
      .update({
        status: 'failed',
        errors: [message],
        completed_at: new Date().toISOString(),
      })
      .eq('id', syncLogId);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/ecommerce/sync?businessId=<uuid>
 * Ambil riwayat sync logs untuk bisnis ini.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const businessId = request.nextUrl.searchParams.get('businessId');
  if (!businessId) {
    return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
  }

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('ecommerce_sync_logs')
    .select(`
      id, sync_type, status, orders_fetched, transactions_created, errors, started_at, completed_at,
      business_ecommerce_connections!inner(business_id, platform, shop_name)
    `)
    .eq('business_ecommerce_connections.business_id', businessId)
    .order('started_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
