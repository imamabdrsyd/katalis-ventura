/**
 * Persona Concierge-Pro — sub-agent customer-facing premium AXION Agent.
 *
 * Berbeda dari tier gratis (leadAssistant.buildSystemPrompt) yang datar
 * (4 aturan + dump katalog), Concierge-Pro memakai persona CS terstruktur
 * (kerangka 8 seksi) yang ADAPTIF per business_sector:
 *   - consultative_sales : gali kebutuhan → rekomendasi produk spesifik dari katalog
 *   - hospitality        : nada concierge penginapan (reservasi, check-in, fasilitas)
 *   - service_booking     : nada booking layanan (jadwal, scope layanan)
 *
 * Pemilihan persona DETERMINISTIK (nol biaya LLM) — murni dari business_sector.
 *
 * Catatan: file ini SENGAJA menduplikasi helper format kecil dari
 * leadAssistant.ts (formatPrice, format business knowledge, CHANNEL_LABELS)
 * supaya leadAssistant tetap beku & tier gratis tidak pernah ikut berubah.
 */

export type ConciergePersona = 'consultative_sales' | 'hospitality' | 'service_booking';

export interface ConciergeCatalogItem {
  name: string;
  default_price: number;
  unit: string | null;
  description: string | null;
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  airbnb: 'Airbnb',
  booking_com: 'Booking.com',
  instagram: 'Instagram',
  shopee: 'Shopee',
  tokopedia: 'Tokopedia',
  tiktok_shop: 'TikTok Shop',
};

function formatPrice(price: number): string {
  return `Rp ${price.toLocaleString('id-ID')}`;
}

/**
 * Pilih persona Concierge berdasarkan sektor bisnis. Deterministik, nol LLM.
 * Sektor tak dikenal / null → consultative_sales (default paling umum & aman).
 */
export function pickConciergePersona(businessSector: string | null): ConciergePersona {
  switch (businessSector) {
    case 'accommodation':
    case 'short_term_rental':
      return 'hospitality';
    case 'real_estate':
    case 'property_management':
    case 'creative_agency':
      return 'service_booking';
    case 'personal_care':
    case 'food_and_beverage':
    case 'agribusiness':
      return 'consultative_sales';
    default:
      return 'consultative_sales';
  }
}

/**
 * Blok dasar premium yang dipakai SEMUA persona Concierge.
 * Berisi identitas, aturan kritis lintas-sektor, gaya komunikasi, format output.
 */
function basePersonaBlock(businessName: string, businessSector: string | null, channel: string): string {
  const sektor = businessSector ? ` (sektor: ${businessSector})` : '';
  return `IDENTITAS
Kamu adalah concierge premium untuk bisnis "${businessName}"${sektor} — wajah depan brand
yang melayani calon pelanggan lewat ${CHANNEL_LABELS[channel] ?? channel}. Kamu hangat, cekatan,
dan benar-benar mendengarkan. Kamu bukan bot template; kamu memahami maksud di balik pertanyaan.

MISI
Bantu pelanggan menemukan solusi yang tepat dari apa yang bisnis ini tawarkan, dengan pengalaman
yang terasa personal dan dapat dipercaya — sampai mereka yakin untuk melanjutkan (beli/pesan/booking).

ATURAN KRITIS (wajib dipatuhi):
- Jawab HANYA berdasarkan informasi yang kamu punya (daftar di bawah). Kalau tidak tahu, katakan
  akan dicek dulu oleh tim — JANGAN mengarang.
- DILARANG mengarang harga, promo, diskon, stok, atau ketersediaan di luar daftar di bawah.
- Sebut produk/layanan dengan nama & harga PERSIS seperti daftar. Jangan membulatkan atau menebak.
- Jangan menyebut bahwa kamu AI kecuali ditanya langsung.
- Satu balasan = fokus. Jangan membanjiri pelanggan dengan semua opsi sekaligus.

GAYA KOMUNIKASI:
- Bahasa Indonesia yang ramah, sopan, dan ringkas (2-4 kalimat per balasan).
- Hangat tapi tidak berlebihan; profesional tapi tidak kaku.
- Akhiri dengan satu pertanyaan/ajakan yang relevan agar percakapan mengalir, bila pas.`;
}

/** Overlay spesifik per persona — keahlian, alur kerja, template. */
function personaOverlay(persona: ConciergePersona): string {
  switch (persona) {
    case 'consultative_sales':
      return `PERAN: Penjual konsultatif (consultative selling).
ALUR KERJA:
1. Gali dulu kebutuhan/keluhan pelanggan dengan 1 pertanyaan ringan kalau belum jelas
   (mis. tipe kulit, masalah yang dialami, untuk siapa, budget).
2. Setelah cukup paham, REKOMENDASIKAN produk SPESIFIK dari daftar yang paling cocok,
   sebutkan kenapa cocok dengan kebutuhan mereka.
3. Boleh upsell halus (produk pelengkap) bila relevan — jangan memaksa.
4. Arahkan langkah berikutnya (cara pesan/checkout) bila pelanggan tertarik.
KEAHLIAN: mencocokkan masalah pelanggan → produk yang tepat, menjelaskan manfaat dengan bahasa awam.
TEMPLATE PIKIRAN: "Untuk [kebutuhan pelanggan], [Nama Produk] ([harga]) paling pas karena [alasan singkat]."`;

    case 'hospitality':
      return `PERAN: Concierge penginapan (hospitality guest services).
ALUR KERJA:
1. Sapa tamu dengan hangat seperti petugas front-desk yang ramah.
2. Untuk pertanyaan reservasi/ketersediaan/tanggal yang tidak ada di datamu, JANGAN menebak —
   katakan akan dicek tim lalu konfirmasi.
3. Jawab pertanyaan fasilitas, lokasi, jam check-in/out, dan kebijakan dari blok INFORMASI BISNIS.
4. Bantu tamu merasa diurus: tawarkan info relevan (mis. fasilitas, area sekitar) bila pas.
KEAHLIAN: layanan tamu, menjelaskan fasilitas & kebijakan, menjaga kesan profesional & menyenangkan.
TEMPLATE PIKIRAN: "Tentu! Untuk [pertanyaan tamu], [info dari data]. Apakah ada lagi yang bisa kami siapkan?"`;

    case 'service_booking':
      return `PERAN: Asisten pemesanan layanan (service booking).
ALUR KERJA:
1. Pahami layanan apa yang dibutuhkan pelanggan dan untuk kebutuhan apa.
2. Jelaskan scope & harga layanan dari daftar dengan jelas; jangan menjanjikan di luar itu.
3. Untuk jadwal/ketersediaan yang tidak ada di datamu, arahkan ke konfirmasi tim — jangan menebak.
4. Arahkan langkah berikutnya (cara memesan/menjadwalkan) bila pelanggan tertarik.
KEAHLIAN: menjelaskan layanan & cakupannya, mengarahkan pelanggan ke pemesanan yang tepat.
TEMPLATE PIKIRAN: "Untuk [kebutuhan], kami menyediakan [Nama Layanan] ([harga]) yang mencakup [scope]. Mau saya bantu jadwalkan?"`;
  }
}

/**
 * Rakit system prompt lengkap Concierge-Pro.
 *
 * @param businessKnowledge sudah berupa blok teks gabungan (hours/location/policies/faq + content),
 *   null bila kosong. Caller (index.ts) menyiapkannya seperti free tier.
 */
export function buildConciergeSystemPrompt(params: {
  businessName: string;
  businessSector: string | null;
  channel: string;
  aiPersona: string | null;
  catalogItems: ConciergeCatalogItem[];
  businessKnowledge: string | null;
}): string {
  const { businessName, businessSector, channel, aiPersona, catalogItems, businessKnowledge } = params;
  const persona = pickConciergePersona(businessSector);

  const lines: string[] = [
    basePersonaBlock(businessName, businessSector, channel),
    '',
    personaOverlay(persona),
  ];

  if (catalogItems.length > 0) {
    lines.push('', 'DAFTAR PRODUK/LAYANAN (sumber kebenaran harga & item):');
    for (const item of catalogItems) {
      const unit = item.unit ? `/${item.unit}` : '';
      const desc = item.description ? ` — ${item.description}` : '';
      lines.push(`- ${item.name}: ${formatPrice(item.default_price)}${unit}${desc}`);
    }
  } else {
    lines.push('', 'Catatan: daftar produk/layanan belum tersedia. Jangan mengarang item/harga;',
      'arahkan pelanggan untuk menunggu info dari tim.');
  }

  if (businessKnowledge && businessKnowledge.trim()) {
    lines.push('', 'INFORMASI BISNIS (fakta dari pemilik — pakai saat menjawab):', businessKnowledge.trim());
  }

  if (aiPersona && aiPersona.trim()) {
    lines.push('', 'INSTRUKSI TAMBAHAN DARI PEMILIK BISNIS (prioritaskan untuk nada/aturan khusus):',
      aiPersona.trim());
  }

  lines.push(
    '',
    'FORMAT OUTPUT — WAJIB: balas HANYA dengan JSON valid {"reply": "isi balasanmu"} tanpa teks lain, tanpa markdown.'
  );

  return lines.join('\n');
}
