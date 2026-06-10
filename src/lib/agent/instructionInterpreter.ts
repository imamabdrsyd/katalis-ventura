/**
 * Menerjemahkan instruksi natural-language user (opsional) di halaman /agent
 * menjadi KONFIGURASI impor yang terstruktur & aman.
 *
 * Prinsip kunci: instruksi HANYA boleh mengatur perilaku impor (filter, status,
 * pemilihan akun) — TIDAK PERNAH menyentuh perhitungan angka. Nominal transaksi
 * tetap deterministik dari parser CSV. Jadi LLM di sini cuma "router intent",
 * bukan kalkulator. Kalau LLM tidak tersedia/gagal, fallback rule-based jalan dan
 * impor tetap berjalan dengan default.
 */

import { generateTextGeminiVertex } from '@/lib/ai/provider';

export interface ImportInstructionConfig {
  /** Status transaksi hasil impor */
  status: 'posted' | 'draft';
  /**
   * Akun sisi debit:
   * - 'bank' (default): Dr Kas/Bank — asumsi dana sudah/langsung masuk rekening.
   * - 'receivable': Dr Piutang Usaha — dana order masih di saldo marketplace,
   *   belum cair ke bank. Dilunasi nanti saat impor laporan pencairan.
   */
  debitMode: 'bank' | 'receivable';
  /** Filter channel: hanya impor pesanan dari channel ini (case-insensitive) */
  channelFilter: 'tiktok' | 'tokopedia' | null;
  /** Filter tanggal mulai (inklusif), YYYY-MM-DD */
  dateFrom: string | null;
  /** Filter tanggal akhir (inklusif), YYYY-MM-DD */
  dateTo: string | null;
  /** Kata kunci nama akun Kas/Bank yang diminta user (mis. "bca", "mandiri") */
  bankAccountHint: string | null;
  /** Ringkasan singkat interpretasi untuk ditampilkan ke user di log SSE */
  summary: string;
}

export const DEFAULT_IMPORT_CONFIG: ImportInstructionConfig = {
  status: 'posted',
  debitMode: 'bank',
  channelFilter: null,
  dateFrom: null,
  dateTo: null,
  bankAccountHint: null,
  summary: '',
};

const SYSTEM_PROMPT = `Kamu adalah interpreter instruksi impor CSV untuk aplikasi akuntansi.
Tugasmu: ubah instruksi user menjadi OBJEK KONFIGURASI JSON. Kamu TIDAK menghitung
angka apa pun — hanya menentukan filter & setelan impor.

Output WAJIB JSON valid TANPA markdown, dengan skema persis:
{
  "status": "posted" | "draft",
  "debitMode": "bank" | "receivable",
  "channelFilter": "tiktok" | "tokopedia" | null,
  "dateFrom": "YYYY-MM-DD" | null,
  "dateTo": "YYYY-MM-DD" | null,
  "bankAccountHint": string | null,
  "summary": string
}

Aturan:
- Default status "posted". Pakai "draft" hanya bila user minta jangan langsung dibukukan/draft/review dulu.
- debitMode default "bank". Pakai "receivable" bila user menyebut dana belum cair / masih di
  saldo marketplace / catat sebagai piutang / belum masuk rekening / piutang usaha dulu.
- channelFilter hanya diisi bila user eksplisit menyebut salah satu channel saja (TikTok ATAU Tokopedia).
- dateFrom/dateTo diisi bila user menyebut periode/bulan. Tahun konteks: ${new Date().getFullYear()}.
- bankAccountHint = kata kunci nama akun bila user minta akun kas/bank tertentu (mis "pakai BCA" -> "bca").
- summary = 1 kalimat bahasa Indonesia menjelaskan konfigurasi yang kamu pilih.
- Jika instruksi kosong/tidak relevan, kembalikan default: status "posted", debitMode "bank", sisanya null, summary "".`;

function parseJsonLoose(text: string): Partial<ImportInstructionConfig> | null {
  // Buang pagar kode markdown bila ada.
  const cleaned = text.replace(/```json\s*|\s*```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Fallback rule-based bila LLM tidak tersedia — cukup tangani kasus paling umum. */
function ruleBasedInterpret(instruction: string): ImportInstructionConfig {
  const lower = instruction.toLowerCase();
  const config: ImportInstructionConfig = { ...DEFAULT_IMPORT_CONFIG };
  const notes: string[] = [];

  if (/\bdraft\b|jangan.*posting|jangan.*bukukan|review dulu/.test(lower)) {
    config.status = 'draft';
    notes.push('status draft');
  }

  // Piutang vs Bank — dana belum cair / masih di marketplace → piutang.
  if (/piutang|belum cair|belum masuk.*(bank|rekening)|saldo.*(marketplace|tiktok|tokopedia|penjual)|tahan.*dana/.test(lower)) {
    config.debitMode = 'receivable';
    notes.push('catat ke Piutang Usaha');
  }

  // Channel filter — hanya bila satu channel disebut tanpa yang lain.
  const hasTiktok = /tiktok|tik tok/.test(lower);
  const hasTokped = /tokopedia|tokped/.test(lower);
  if (hasTiktok && !hasTokped) { config.channelFilter = 'tiktok'; notes.push('hanya TikTok'); }
  else if (hasTokped && !hasTiktok) { config.channelFilter = 'tokopedia'; notes.push('hanya Tokopedia'); }

  // Akun bank/kas — bank tertentu yang disebut (BCA/Mandiri/BNI/BRI), atau kata
  // setelah "pakai/gunakan akun/rekening/bank ...".
  const namedBank = lower.match(/\b(bca|mandiri|bni|bri|cimb|permata|btn|jago)\b/);
  if (namedBank) {
    config.bankAccountHint = namedBank[1];
    notes.push(`akun ${namedBank[1].toUpperCase()}`);
  } else {
    const bankMatch = lower.match(/(?:pakai|gunakan|via|ke)\s+(?:akun\s+|rekening\s+|bank\s+)+([a-z]{2,})/);
    if (bankMatch && !['akun', 'rekening', 'bank'].includes(bankMatch[1])) {
      config.bankAccountHint = bankMatch[1];
      notes.push(`akun ${bankMatch[1]}`);
    }
  }

  config.summary = notes.length ? `Konfigurasi: ${notes.join(', ')}.` : '';
  return config;
}

/**
 * Interpretasi instruksi → config. Selalu mengembalikan config valid (tidak pernah
 * null) supaya impor deterministik tetap jalan walau LLM gagal.
 */
export async function interpretImportInstruction(
  instruction: string | null | undefined
): Promise<{ config: ImportInstructionConfig; usedLLM: boolean }> {
  const trimmed = (instruction ?? '').trim();
  if (!trimmed) return { config: { ...DEFAULT_IMPORT_CONFIG }, usedLLM: false };

  // Provider Vertex (sesuai standar AXION Agent). Vertex sudah set
  // responseMimeType JSON, jadi output rapi. Bila Vertex tak tersedia → rule-based.
  const result = await generateTextGeminiVertex(
    SYSTEM_PROMPT,
    [{ role: 'user', content: trimmed }],
    { temperature: 0, maxTokens: 300 }
  );

  if (result?.text) {
    const parsed = parseJsonLoose(result.text);
    if (parsed) {
      return {
        config: {
          status: parsed.status === 'draft' ? 'draft' : 'posted',
          debitMode: parsed.debitMode === 'receivable' ? 'receivable' : 'bank',
          channelFilter:
            parsed.channelFilter === 'tiktok' || parsed.channelFilter === 'tokopedia'
              ? parsed.channelFilter
              : null,
          dateFrom: typeof parsed.dateFrom === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.dateFrom) ? parsed.dateFrom : null,
          dateTo: typeof parsed.dateTo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.dateTo) ? parsed.dateTo : null,
          bankAccountHint: typeof parsed.bankAccountHint === 'string' && parsed.bankAccountHint.trim() ? parsed.bankAccountHint.trim().toLowerCase() : null,
          summary: typeof parsed.summary === 'string' ? parsed.summary : '',
        },
        usedLLM: true,
      };
    }
  }

  // LLM gagal/tak tersedia → rule-based, impor tetap jalan.
  return { config: ruleBasedInterpret(trimmed), usedLLM: false };
}
