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

const BUSINESS_INFO_KEYWORDS = [
  'siapa pemilik',
  'pemilik bisnis',
  'pemilik usaha',
  'bisnis ini punya siapa',
  'usaha ini punya siapa',
  'yang punya bisnis',
  'owner bisnis',
  'business owner',
  'who owns',
  'kepemilikan',
  'ownership',
  'cap table',
  'siapa yang buat bisnis',
  'siapa yang membuat bisnis',
  'siapa yang create bisnis',
  'siapa yang mendaftarkan bisnis',
  'creator bisnis',
  'pembuat bisnis',
  'anggota bisnis',
  'member bisnis',
  'siapa saja anggota',
  'siapa anggotanya',
  'siapa yang mengelola bisnis',
  'manajer bisnis',
  'manager bisnis',
  'siapa investornya',
  'investor bisnis',
  'struktur modal',
  'modal disetor',
];

/**
 * True kalau pertanyaan terindikasi butuh reasoning mendalam (audit/proyeksi/analisis).
 * Memeriksa hanya pesan user TERAKHIR (intent percakapan terkini).
 */
export function needsReasoning(lastUserMessage: string): boolean {
  const text = lastUserMessage.toLowerCase();
  return REASONING_KEYWORDS.some(kw => text.includes(kw));
}

/**
 * True kalau provider chat non-agentic perlu diberi konteks creator, anggota,
 * dan cap table bisnis. Pertanyaan tentang produk AXION sendiri dikecualikan.
 */
export function needsBusinessInfo(lastUserMessage: string): boolean {
  const text = lastUserMessage.toLowerCase();
  if (text.includes('axion')) return false;
  return BUSINESS_INFO_KEYWORDS.some(keyword => text.includes(keyword));
}
