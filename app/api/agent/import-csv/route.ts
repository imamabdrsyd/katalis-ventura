/**
 * POST /api/agent/import-csv
 *
 * Import CSV channel (Airbnb, dst) → insert transaksi multi-line langsung posted.
 * Response: Server-Sent Events (SSE) untuk streaming progress ke UI.
 *
 * Body: multipart/form-data
 *   - file: File (CSV)
 *   - businessId: string (UUID)
 *   - channel: 'airbnb' | 'shopee' | 'tokopedia' (default: 'airbnb')
 *   - accountOverrides: JSON string (opsional) { revenueAccountId, commissionAccountId, bankAccountId }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getAuthenticatedUser, getBusinessRoleForUser } from '@/lib/supabase-server';
import { parseAirbnbCSV } from '@/lib/agent/airbnbParser';
import { resolveAirbnbAccounts, describeResolvedAccounts } from '@/lib/agent/accountResolver';
import type { Account } from '@/types';

interface SSEEvent {
  type: 'thinking' | 'progress' | 'result' | 'error' | 'done';
  message?: string;
  current?: number;
  total?: number;
  data?: Record<string, unknown>;
}

function encodeSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const businessId = formData.get('businessId') as string | null;
  const channel = (formData.get('channel') as string | null) ?? 'airbnb';
  const accountOverridesRaw = formData.get('accountOverrides') as string | null;

  if (!file || !businessId) {
    return NextResponse.json({ error: 'file dan businessId wajib diisi' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const role = await getBusinessRoleForUser(supabase, user.id, businessId);
  if (!role || role === 'investor') {
    return NextResponse.json({ error: 'Hanya business manager yang dapat mengimpor transaksi' }, { status: 403 });
  }

  // Parse file menjadi text di server (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File terlalu besar (maks 5MB)' }, { status: 400 });
  }
  const csvText = await file.text();

  // Parse account overrides jika ada
  let accountOverrides: Record<string, string> | null = null;
  if (accountOverridesRaw) {
    try {
      accountOverrides = JSON.parse(accountOverridesRaw);
    } catch {
      // abaikan jika tidak valid JSON
    }
  }

  // SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SSEEvent) => {
        controller.enqueue(encoder.encode(encodeSSE(event)));
      };

      try {
        // Step 1: Fetch akun
        send({ type: 'thinking', message: 'Mengambil data Chart of Accounts...' });

        const { data: accounts, error: accountsError } = await supabase
          .from('accounts')
          .select('*')
          .eq('business_id', businessId)
          .eq('is_active', true);

        if (accountsError || !accounts) {
          send({ type: 'error', message: 'Gagal mengambil data akun dari database' });
          send({ type: 'done' });
          controller.close();
          return;
        }

        // Step 2: Parse CSV
        send({ type: 'thinking', message: `Membaca dan mem-parsing file CSV ${channel.toUpperCase()}...` });

        let parseResult;
        if (channel === 'airbnb') {
          parseResult = parseAirbnbCSV(csvText);
        } else {
          send({ type: 'error', message: `Channel "${channel}" belum didukung. Saat ini hanya Airbnb.` });
          send({ type: 'done' });
          controller.close();
          return;
        }

        if (parseResult.errors.length > 0 && parseResult.bookings.length === 0) {
          send({ type: 'error', message: parseResult.errors.join('; ') });
          send({ type: 'done' });
          controller.close();
          return;
        }

        send({
          type: 'progress',
          message: `Ditemukan ${parseResult.bookings.length} booking${parseResult.skipped > 0 ? `, ${parseResult.skipped} dilewati` : ''}`,
          current: 0,
          total: parseResult.bookings.length,
        });

        // Step 3: Resolve akun
        send({ type: 'thinking', message: 'Mencocokkan akun dengan Chart of Accounts bisnis...' });

        let accountConfig;
        if (accountOverrides?.revenueAccountId && accountOverrides?.bankAccountId) {
          // User sudah konfirmasi akun manual
          accountConfig = {
            revenueAccountId: accountOverrides.revenueAccountId,
            commissionAccountId: accountOverrides.commissionAccountId ?? null,
            bankAccountId: accountOverrides.bankAccountId,
          };
        } else {
          const resolveResult = resolveAirbnbAccounts(accounts as Account[]);

          if (!resolveResult.confident || !resolveResult.config) {
            // Tidak yakin — minta konfirmasi user
            send({
              type: 'result',
              message: 'Perlu konfirmasi akun',
              data: {
                needsAccountConfirmation: true,
                missingAccounts: resolveResult.missingAccounts,
                availableAccounts: (accounts as Account[]).map(a => ({
                  id: a.id,
                  code: a.account_code,
                  name: a.account_name,
                  type: a.account_type,
                })),
              },
            });
            send({ type: 'done' });
            controller.close();
            return;
          }

          accountConfig = resolveResult.config;
        }

        // Describe akun untuk log
        const accountSummary = describeResolvedAccounts(accounts as Account[], accountConfig);
        if (accountSummary) {
          send({
            type: 'thinking',
            message: `Akun ditemukan: ${accountSummary.revenueAccount.account_name} (Kredit), ${accountSummary.bankAccount.account_name} (Debit)${accountSummary.commissionAccount ? `, ${accountSummary.commissionAccount.account_name} (Debit)` : ''}`,
          });
        }

        // Step 4: Insert transaksi
        let inserted = 0;
        let failed = 0;
        const insertErrors: string[] = [];

        for (let i = 0; i < parseResult.bookings.length; i++) {
          const booking = parseResult.bookings[i];

          send({
            type: 'progress',
            message: `Menyimpan transaksi ${i + 1}/${parseResult.bookings.length}: ${booking.guest}...`,
            current: i + 1,
            total: parseResult.bookings.length,
          });

          // Build journal lines
          const nightsLabel = booking.nights > 0 ? `${booking.nights} malam` : '';
          const dateRange = booking.startDate !== booking.endDate
            ? ` (${booking.startDate} → ${booking.endDate})`
            : '';
          const description = `${nightsLabel ? nightsLabel + ' via ' : ''}Airbnb${dateRange}`.trim();

          const journalLines = [];

          // Dr Bank (paidOut / net)
          journalLines.push({
            account_id: accountConfig.bankAccountId,
            debit_amount: booking.paidOut,
            credit_amount: 0,
            description: `Terima pembayaran Airbnb - ${booking.guest}`,
            sort_order: 0,
            currency_code: 'IDR',
            original_debit_amount: booking.paidOut,
            original_credit_amount: 0,
            fx_rate: 1,
          });

          // Dr Komisi Platform (service fee) — hanya jika ada commission account dan service fee > 0
          if (accountConfig.commissionAccountId && booking.serviceFee > 0) {
            journalLines.push({
              account_id: accountConfig.commissionAccountId,
              debit_amount: booking.serviceFee,
              credit_amount: 0,
              description: `Komisi Airbnb - ${booking.guest}`,
              sort_order: 1,
              currency_code: 'IDR',
              original_debit_amount: booking.serviceFee,
              original_credit_amount: 0,
              fx_rate: 1,
            });
          }

          // Cr Revenue (gross earnings)
          const grossForCredit = accountConfig.commissionAccountId
            ? booking.grossEarnings
            : booking.paidOut; // tanpa commission account: kredit net saja

          journalLines.push({
            account_id: accountConfig.revenueAccountId,
            debit_amount: 0,
            credit_amount: grossForCredit,
            description: `Pendapatan sewa Airbnb - ${booking.guest}${description ? ' - ' + description : ''}`,
            sort_order: journalLines.length,
            currency_code: 'IDR',
            original_debit_amount: 0,
            original_credit_amount: grossForCredit,
            fx_rate: 1,
          });

          // Validate balance
          const totalDebit = journalLines.reduce((s, l) => s + l.debit_amount, 0);
          const totalCredit = journalLines.reduce((s, l) => s + l.credit_amount, 0);
          if (Math.abs(totalDebit - totalCredit) > 1) {
            insertErrors.push(`Booking ${booking.guest}: jurnal tidak seimbang (debit ${totalDebit} ≠ kredit ${totalCredit})`);
            failed++;
            continue;
          }

          // Insert via Supabase directly (server-side, no API fetch loop)
          const { data: txHeader, error: txError } = await supabase
            .from('transactions')
            .insert({
              business_id: businessId,
              date: booking.date,
              category: 'EARN',
              name: booking.guest,
              description: description || `Pendapatan Airbnb`,
              amount: booking.grossEarnings,
              account: 'Airbnb',
              created_by: user.id,
              status: 'posted',
              is_double_entry: true,
              debit_account_id: accountConfig.bankAccountId,
              credit_account_id: accountConfig.revenueAccountId,
              notes: `Import CSV Airbnb — ${channel}`,
              meta: { import_source: 'airbnb_csv', import_date: new Date().toISOString() },
            })
            .select('id')
            .single();

          if (txError || !txHeader) {
            insertErrors.push(`Booking ${booking.guest}: ${txError?.message ?? 'Gagal insert header'}`);
            failed++;
            continue;
          }

          // Insert journal lines
          const journalInserts = journalLines.map(l => ({
            transaction_id: txHeader.id,
            account_id: l.account_id,
            debit_amount: l.debit_amount,
            credit_amount: l.credit_amount,
            description: l.description,
            sort_order: l.sort_order,
            currency_code: l.currency_code,
            original_debit_amount: l.original_debit_amount,
            original_credit_amount: l.original_credit_amount,
            fx_rate: l.fx_rate,
          }));

          const { error: linesError } = await supabase
            .from('journal_lines')
            .insert(journalInserts);

          if (linesError) {
            // Rollback: hapus header
            await supabase.from('transactions').delete().eq('id', txHeader.id);
            insertErrors.push(`Booking ${booking.guest}: gagal insert journal lines — ${linesError.message}`);
            failed++;
            continue;
          }

          inserted++;
        }

        // Step 5: Selesai
        send({
          type: 'result',
          message: `Selesai! ${inserted} transaksi berhasil diimpor${failed > 0 ? `, ${failed} gagal` : ''}.`,
          data: {
            inserted,
            failed,
            errors: insertErrors,
            skipped: parseResult.skipped,
          },
        });
        send({ type: 'done' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Terjadi kesalahan tidak terduga';
        send({ type: 'error', message: msg });
        send({ type: 'done' });
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
