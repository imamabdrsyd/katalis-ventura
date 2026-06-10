import { NextRequest, NextResponse } from 'next/server';
import { canManageBusiness, createServerClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { bulkDeleteTransactionsSchema } from '@/lib/validations';
import { badRequest, forbidden, serverError, unauthorized, validationError } from '@/lib/api/server/responses';

interface BulkDeleteSSEEvent {
  type: 'progress' | 'result' | 'error' | 'done';
  message?: string;
  current?: number;
  total?: number;
  deleted?: number;
  failed?: number;
  errors?: string[];
}

function encodeSSE(event: BulkDeleteSSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * POST /api/transactions/bulk-delete
 * Body: { ids: string[] }
 * Soft-delete selected transactions and stream per-item progress over SSE.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const parsed = bulkDeleteTransactionsSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const ids = [...new Set(parsed.data.ids)];
    const supabase = await createServerClient();

    const { data: transactions, error: fetchError } = await supabase
      .from('transactions')
      .select('id, business_id, date')
      .in('id', ids)
      .is('deleted_at', null);

    if (fetchError) return serverError(fetchError);
    if (!transactions || transactions.length !== ids.length) {
      return badRequest('Satu atau lebih transaksi tidak ditemukan atau sudah dihapus');
    }

    const businessIds = new Set(transactions.map((transaction) => transaction.business_id));
    if (businessIds.size !== 1) {
      return badRequest('Semua transaksi harus dalam bisnis yang sama');
    }

    const businessId = transactions[0].business_id;
    if (!(await canManageBusiness(supabase, user.id, businessId))) {
      return forbidden('Hanya manager bisnis yang dapat menghapus transaksi');
    }

    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('closed_until_date')
      .eq('id', businessId)
      .single();

    if (businessError) return serverError(businessError);
    if (
      business?.closed_until_date
      && transactions.some((transaction) => transaction.date <= business.closed_until_date)
    ) {
      return NextResponse.json(
        { error: `Periode hingga ${business.closed_until_date} sudah dikunci. Beberapa transaksi tidak dapat dihapus.` },
        { status: 423 }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: BulkDeleteSSEEvent) => {
          controller.enqueue(encoder.encode(encodeSSE(event)));
        };

        let deleted = 0;
        let failed = 0;
        const errors: string[] = [];

        try {
          send({
            type: 'progress',
            message: `Menyiapkan penghapusan ${ids.length} transaksi...`,
            current: 0,
            total: ids.length,
            deleted,
            failed,
          });

          for (let index = 0; index < ids.length; index++) {
            const id = ids[index];
            const { error } = await supabase.rpc('soft_delete_transaction', {
              transaction_id: id,
            });

            if (error) {
              failed++;
              errors.push(`Transaksi ${index + 1}: ${error.message}`);
            } else {
              deleted++;
            }

            send({
              type: 'progress',
              message: `Menghapus transaksi ${index + 1} dari ${ids.length}`,
              current: index + 1,
              total: ids.length,
              deleted,
              failed,
            });
          }

          send({
            type: 'result',
            message: failed > 0
              ? `${deleted} transaksi dihapus, ${failed} gagal.`
              : `${deleted} transaksi berhasil dihapus.`,
            current: ids.length,
            total: ids.length,
            deleted,
            failed,
            errors,
          });
          send({ type: 'done' });
        } catch (error) {
          send({
            type: 'error',
            message: error instanceof Error ? error.message : 'Gagal menghapus transaksi',
            current: deleted + failed,
            total: ids.length,
            deleted,
            failed,
          });
          send({ type: 'done' });
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
