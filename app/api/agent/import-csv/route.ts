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
        // Pakai RPC create_multi_line_transaction (migrasi 082) — atomik:
        // insert header + journal_lines dalam satu transaksi DB, set is_multi_line=TRUE,
        // balance check + RLS + period-lock + account-ownership semua di server.
        // Tidak ada risiko orphan header (yang ada di insert manual sebelumnya).
        const hasCommission = !!accountConfig.commissionAccountId; // empty string → false
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

          // Build description
          const nightsLabel = booking.nights > 0 ? `${booking.nights} malam` : '';
          const dateRange = booking.startDate !== booking.endDate
            ? ` (${booking.startDate} → ${booking.endDate})`
            : '';
          const description = `${nightsLabel ? nightsLabel + ' via ' : ''}Airbnb${dateRange}`.trim();

          // Build journal lines. Tergantung net payout (= paidOut):
          //  - net > 0 (normal): Dr Bank(net) [+ Dr Komisi(fee)] / Cr Revenue(gross)
          //  - net = 0 (gross==fee): Dr Komisi(fee) / Cr Revenue(gross) — tanpa Bank
          //  - net < 0 (fee>gross): Dr Komisi(fee) / Cr Revenue(gross) + Cr Bank(|net|)
          // RPC menolak baris dengan debit & kredit dua-duanya 0 atau dua-duanya >0,
          // dan menolak nilai negatif — maka tiap baris harus satu sisi & positif.
          const journalLines: Array<{
            account_id: string;
            debit_amount: number;
            credit_amount: number;
            description: string;
            sort_order: number;
          }> = [];
          const fee = hasCommission ? booking.serviceFee : 0;
          const net = booking.paidOut;

          // Tanpa commission account, net ≤ 0 tidak bisa dibuat jurnal yang benar
          // (Bank jadi 0/negatif, dan tidak ada akun beban untuk menyerap fee).
          if (!hasCommission && net <= 0) {
            insertErrors.push(`Booking ${booking.guest}: net payout ≤ 0 tapi tidak ada akun Komisi Platform untuk mencatat fee. Lewati.`);
            failed++;
            continue;
          }

          // Dr Bank — hanya bila ada kas masuk (net > 0)
          if (net > 0) {
            journalLines.push({
              account_id: accountConfig.bankAccountId,
              debit_amount: net,
              credit_amount: 0,
              description: `Terima pembayaran Airbnb - ${booking.guest}`,
              sort_order: journalLines.length,
            });
          }

          // Dr Komisi Platform (service fee) — hanya bila ada commission account & fee > 0
          if (fee > 0) {
            journalLines.push({
              account_id: accountConfig.commissionAccountId!,
              debit_amount: fee,
              credit_amount: 0,
              description: `Komisi Airbnb - ${booking.guest}`,
              sort_order: journalLines.length,
            });
          }

          // Cr Bank — bila net negatif (fee > gross): kas berkurang sebesar |net|
          if (net < 0) {
            journalLines.push({
              account_id: accountConfig.bankAccountId,
              debit_amount: 0,
              credit_amount: -net,
              description: `Potongan Airbnb (fee > pendapatan) - ${booking.guest}`,
              sort_order: journalLines.length,
            });
          }

          // Cr Revenue (gross) — total kredit harus = total debit.
          // Dengan komisi: gross = net + fee (bila net>0) atau fee - |net| (bila net<0) → konsisten.
          // Tanpa komisi (net>0): gross = net.
          const totalDebit = journalLines.reduce((s, l) => s + l.debit_amount, 0);
          const totalCreditSoFar = journalLines.reduce((s, l) => s + l.credit_amount, 0);
          const revenueCredit = totalDebit - totalCreditSoFar;

          // Pertahanan: revenue harus > 0 agar baris valid (debit XOR credit, positif).
          if (revenueCredit <= 0) {
            insertErrors.push(`Booking ${booking.guest}: pendapatan terhitung ≤ 0 (gross ${booking.grossEarnings}, fee ${booking.serviceFee}). Lewati.`);
            failed++;
            continue;
          }

          journalLines.push({
            account_id: accountConfig.revenueAccountId,
            debit_amount: 0,
            credit_amount: revenueCredit,
            description: `Pendapatan sewa Airbnb - ${booking.guest}${description ? ' - ' + description : ''}`,
            sort_order: journalLines.length,
          });

          // RPC butuh minimal 2 baris. Kasus paling sedikit: net=0 → Komisi + Revenue = 2. OK.
          if (journalLines.length < 2) {
            insertErrors.push(`Booking ${booking.guest}: jurnal kurang dari 2 baris, dilewati.`);
            failed++;
            continue;
          }

          const { error: rpcErr } = await supabase.rpc('create_multi_line_transaction', {
            p_header: {
              business_id: businessId,
              date: booking.date,
              category: 'EARN',
              name: booking.guest,
              description: description || 'Pendapatan Airbnb',
              notes: `Import CSV Airbnb — ${channel}`,
              status: 'posted',
              meta: { import_source: 'airbnb_csv', import_date: new Date().toISOString() },
            },
            p_lines: journalLines,
          });

          if (rpcErr) {
            insertErrors.push(`Booking ${booking.guest}: ${rpcErr.message}`);
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
