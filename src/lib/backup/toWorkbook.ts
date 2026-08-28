import * as XLSX from 'xlsx';
import type { BackupEnvelope, BackupRow } from './types';

/**
 * Konversi envelope backup menjadi workbook Excel multi-sheet.
 *
 * Dikerjakan di browser, bukan di server: route backup cukup mengirim JSON, dan
 * fungsi Vercel tetap ringan. Modul ini di-import dinamis oleh pemanggilnya —
 * mengikuti pola `src/lib/export.ts`.
 *
 * XLSX di sini memang LOSSY (kolom JSONB jadi teks). Itulah sebabnya JSON tetap
 * jadi format kanonik; Excel murni untuk dibaca manusia.
 */

/** Excel menolak nama sheet di atas 31 karakter. */
const MAX_SHEET_NAME = 31;

/**
 * Karakter yang membuat Excel/Sheets memperlakukan sel sebagai formula.
 * Data backup berisi input dari user dan pihak luar (nama kontak, isi pesan
 * lead), jadi nilainya tidak boleh sampai tereksekusi saat file dibuka.
 */
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

function sanitizeCell(value: string): string {
  return FORMULA_TRIGGERS.some((c) => value.startsWith(c)) ? `'${value}` : value;
}

/** Ratakan satu baris jadi nilai yang layak ditaruh di sel Excel. */
function flattenRow(row: BackupRow): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      out[key] = null;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    } else if (typeof value === 'string') {
      out[key] = sanitizeCell(value);
    } else {
      // JSONB (meta, property_details, unit_breakdown) dan array.
      out[key] = sanitizeCell(JSON.stringify(value));
    }
  }

  return out;
}

/**
 * Pastikan nama sheet unik dan muat di batas Excel. Nama tabel terpanjang saat
 * ini 30 karakter, tapi guard tetap dipasang supaya tabel baru tidak diam-diam
 * menghasilkan file rusak.
 */
function uniqueSheetName(raw: string, used: Set<string>): string {
  let name = raw.slice(0, MAX_SHEET_NAME);

  if (used.has(name)) {
    for (let i = 2; ; i++) {
      const suffix = `~${i}`;
      const candidate = `${raw.slice(0, MAX_SHEET_NAME - suffix.length)}${suffix}`;
      if (!used.has(candidate)) {
        name = candidate;
        break;
      }
    }
  }

  used.add(name);
  return name;
}

export function envelopeToWorkbook(envelope: BackupEnvelope): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();

  // Sheet ringkasan lebih dulu — pembaca file harus bisa langsung tahu isinya
  // apa, dan apa yang sengaja tidak ada.
  const metaRows: Record<string, string | number>[] = [
    { Info: 'Bisnis', Nilai: envelope.business.business_name },
    { Info: 'ID Bisnis', Nilai: envelope.business.id },
    { Info: 'Diekspor pada', Nilai: envelope.exported_at },
    { Info: 'Diekspor oleh', Nilai: envelope.exported_by.name ?? envelope.exported_by.id },
    { Info: 'Versi skema', Nilai: envelope.schema_version },
    { Info: '', Nilai: '' },
    { Info: '— Jumlah baris —', Nilai: '' },
    ...Object.entries(envelope.counts).map(([table, count]) => ({ Info: table, Nilai: count })),
    { Info: '', Nilai: '' },
    { Info: '— Sengaja tidak disertakan —', Nilai: '' },
    ...envelope.excluded.map(({ table, reason }) => ({ Info: table, Nilai: reason })),
  ];

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(metaRows),
    uniqueSheetName('_ringkasan', used)
  );

  for (const [table, rows] of Object.entries(envelope.data)) {
    // Tabel kosong tetap dapat sheet: ketiadaan data itu sendiri informasi, dan
    // sheet yang hilang bikin orang mengira backup-nya bolong.
    const sheet = rows.length
      ? XLSX.utils.json_to_sheet(rows.map(flattenRow))
      : XLSX.utils.aoa_to_sheet([['(tidak ada data)']]);

    XLSX.utils.book_append_sheet(wb, sheet, uniqueSheetName(table, used));
  }

  return wb;
}
