/**
 * Deteksi apakah pertanyaan analitik butuh model reasoning (DeepSeek R1).
 *
 * Pertanyaan biasa ("kategori beban terbesar apa?") cukup Gemini — cepat & murah.
 * Pertanyaan audit/proyeksi/analisis sebab-akibat butuh nalar berlapis → R1 dulu.
 *
 * Keyword-based by design: ringan (tanpa LLM call), dijalankan tiap request chat.
 * Lebih baik false-negative (pakai Gemini) daripada false-positive yang bikin
 * semua pertanyaan jadi lambat. Daftar bisa diperluas sesuai temuan.
 */

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

/**
 * True kalau pertanyaan terindikasi butuh reasoning mendalam (audit/proyeksi/analisis).
 * Memeriksa hanya pesan user TERAKHIR (intent percakapan terkini).
 */
export function needsReasoning(lastUserMessage: string): boolean {
  const text = lastUserMessage.toLowerCase();
  return REASONING_KEYWORDS.some(kw => text.includes(kw));
}
