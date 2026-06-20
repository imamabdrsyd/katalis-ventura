/**
 * Deteksi intent, persona, dan keperluan reasoning secara deterministik (keyword-based).
 *
 * Menggabungkan semua routing logic dalam satu panggilan cepat (tanpa LLM call).
 * Dipakai oleh Agentic Workspace & AIChatPanel untuk menentukan:
 * 1. Persona mana yang cocok menjawab pertanyaan (Sri Mulyani / Bianca / Stanley)
 * 2. Apakah pertanyaan butuh fetch data keuangan bisnis (isFinancial)
 * 3. Apakah butuh model reasoning (DeepSeek R1 / Gemini Pro)
 * 4. Apakah butuh fetch info kepemilikan bisnis
 */

import type { FinancialPersona } from '@/lib/ai/financialPersonas';

const REASONING_KEYWORDS = [
  // Audit & konsistensi
  'audit', 'periksa', 'cek laporan', 'cek neraca', 'tidak balance', 'gak balance',
  'nggak balance', 'tidak seimbang', 'selisih', 'janggal', 'anomali', 'mencurigakan',
  'kenapa beda', 'kok beda', 'inkonsisten', 'salah catat', 'double',
  // Proyeksi & skenario
  'proyeksi', 'proyeksikan', 'forecast', 'prediksi', 'prediksikan', 'perkiraan',
  'skenario', 'simulasi', 'what if', 'bagaimana jika', 'kalau misal', 'andai',
  'bulan depan', 'tahun depan', 'ke depan', 'estimasi',
  // Analisis sebab-akibat mendalam
  'analisis mendalam', 'analisa mendalam', 'akar masalah', 'root cause',
  'mengapa', 'jelaskan kenapa', 'breakdown lengkap',
];

const BUSINESS_INFO_KEYWORDS = [
  'siapa pemilik', 'pemilik bisnis', 'pemilik usaha', 'bisnis ini punya siapa',
  'usaha ini punya siapa', 'yang punya bisnis', 'owner bisnis', 'business owner',
  'who owns', 'kepemilikan', 'ownership', 'cap table', 'siapa yang buat bisnis',
  'siapa yang membuat bisnis', 'siapa yang create bisnis', 'siapa yang mendaftarkan bisnis',
  'creator bisnis', 'pembuat bisnis', 'anggota bisnis', 'member bisnis',
  'siapa saja anggota', 'siapa anggotanya', 'siapa yang mengelola bisnis',
  'manajer bisnis', 'manager bisnis', 'siapa investornya', 'investor bisnis',
  'struktur modal', 'modal disetor',
];

// Keywords Spesifik per Persona
const PAJAK_KEYWORDS = [
  'pajak', 'pph', 'ppn', 'pbb', 'djp', 'npwp', 'spt', 'tarif pajak', 
  'kewajiban pajak', 'lapor pajak', 'estimasi pajak', 'sri mulyani', 'sri'
];

const PEMBUKUAN_KEYWORDS = [
  'audit', 'periksa', 'cek laporan', 'cek neraca', 'selisih', 'janggal', 
  'anomali', 'salah catat', 'jurnal', 'klasifikasi', 'kode akun', 
  'double entry', 'pembukuan', 'buku besar', 'transaksi yang salah', 'bianca'
];

const FPNA_KEYWORDS = [
  'revenue', 'pendapatan', 'laba', 'rugi', 'margin', 'roi', 'burn rate', 
  'runway', 'proyeksi', 'forecast', 'cash flow', 'arus kas', 'omzet', 'omset', 
  'pengeluaran', 'pemasukan', 'biaya', 'beban', 'capex', 'opex', 'hpp', 
  'modal', 'piutang', 'hutang', 'kas', 'bank', 'saldo', 'stanley', 'analis'
];

export interface RouteDecision {
  /** Persona yang cocok untuk pertanyaan ini. null = generalis. */
  persona: FinancialPersona | null;
  /** Apakah pertanyaan butuh reasoning model (R1/Pro). */
  needsReasoning: boolean;
  /** Apakah pertanyaan butuh fetch konteks kepemilikan bisnis. */
  needsBusinessInfo: boolean;
  /** Apakah pertanyaan terkait dengan keuangan/bisnis (perlu fetch data). */
  isFinancial: boolean;
}

export function routeIntent(lastUserMessage: string): RouteDecision {
  const text = lastUserMessage.toLowerCase();
  
  const needsReasoning = REASONING_KEYWORDS.some(kw => text.includes(kw));
  const needsBusinessInfo = !text.includes('axion') && BUSINESS_INFO_KEYWORDS.some(kw => text.includes(kw));
  
  let persona: FinancialPersona | null = null;
  let isFinancial = false;
  
  // Deteksi persona (prioritas: pajak -> pembukuan -> fpna)
  if (PAJAK_KEYWORDS.some(kw => text.includes(kw))) {
    persona = 'pajak';
    isFinancial = true;
  } else if (PEMBUKUAN_KEYWORDS.some(kw => text.includes(kw))) {
    persona = 'pembukuan';
    isFinancial = true;
  } else if (FPNA_KEYWORDS.some(kw => text.includes(kw))) {
    persona = 'analis_fpna';
    isFinancial = true;
  }
  
  // Jika butuh reasoning atau business info, berarti ini domain keuangan/bisnis
  if (needsReasoning || needsBusinessInfo) {
    isFinancial = true;
    if (!persona) persona = 'analis_fpna'; // Default fallback analis jika tidak ada keyword spesifik
  }

  return {
    persona,
    needsReasoning,
    needsBusinessInfo,
    isFinancial
  };
}

// Backward compatibility wrappers for older callers
export function needsReasoning(lastUserMessage: string): boolean {
  return routeIntent(lastUserMessage).needsReasoning;
}

export function needsBusinessInfo(lastUserMessage: string): boolean {
  return routeIntent(lastUserMessage).needsBusinessInfo;
}
