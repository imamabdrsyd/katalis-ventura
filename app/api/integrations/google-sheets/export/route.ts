import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createAdminClient } from '@/lib/supabase-server';
import { getValidGoogleAccessToken } from '@/lib/google/connection';
import {
  createSpreadsheet,
  writeSheetValues,
  formatReportSheet,
  quoteSheetName,
  SheetsApiError,
} from '@/lib/google/sheetsApi';
import { googleSheetsExportSchema } from '@/lib/validations';

/**
 * POST /api/integrations/google-sheets/export
 *
 * Buat spreadsheet BARU di Drive user lalu tulis baris laporan ke dalamnya.
 *
 * Tidak butuh Google Picker: scope `drive.file` mengizinkan app mengakses file
 * yang ia buat sendiri tanpa syarat tambahan. Itu sebabnya jalur export bisa
 * dirilis lebih dulu (M1) daripada jalur import yang butuh Picker (M2).
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 });
  }

  const parsed = googleSheetsExportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Data export tidak valid', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { title, sheet_title, rows, business_id } = parsed.data;

  const tokenResult = await getValidGoogleAccessToken(user.id);
  if (!tokenResult.ok) {
    // 409 (bukan 401): user-nya sah, hanya koneksi Google-nya yang belum ada
    // atau sudah dicabut. UI memakai `code` untuk menawarkan "Hubungkan Google".
    return NextResponse.json(
      {
        error:
          tokenResult.reason === 'not_connected'
            ? 'Akun Google belum terhubung.'
            : 'Koneksi Google perlu dihubungkan ulang.',
        code: tokenResult.reason,
      },
      { status: 409 }
    );
  }

  try {
    const created = await createSpreadsheet(tokenResult.accessToken, title, sheet_title);

    await writeSheetValues(
      tokenResult.accessToken,
      created.spreadsheetId,
      `${quoteSheetName(sheet_title)}!A1`,
      rows
    );

    // Best-effort, tidak menggagalkan export bila gagal.
    const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 1);
    await formatReportSheet(tokenResult.accessToken, created.spreadsheetId, 0, columnCount);

    // Catat agar muncul di daftar "file terakhir" pada workspace Sheets (M2).
    // Best-effort: kegagalan mencatat tidak boleh membatalkan export yang sukses.
    try {
      const supabase = createAdminClient();
      await supabase.from('google_sheets_recent_files').upsert(
        {
          user_id: user.id,
          business_id: business_id ?? null,
          spreadsheet_id: created.spreadsheetId,
          title,
          url: created.spreadsheetUrl,
          last_sheet_name: sheet_title,
          origin: 'created',
          last_opened_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,spreadsheet_id' }
      );
    } catch (e) {
      console.error('[google-sheets] gagal mencatat recent file', e);
    }

    return NextResponse.json({
      data: { spreadsheet_id: created.spreadsheetId, url: created.spreadsheetUrl },
    });
  } catch (error) {
    if (error instanceof SheetsApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[google-sheets] export gagal', error);
    return NextResponse.json({ error: 'Gagal membuat Google Sheets' }, { status: 500 });
  }
}
