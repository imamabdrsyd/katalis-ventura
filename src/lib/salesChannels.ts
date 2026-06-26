import type { SalesChannel } from '@/types';

/** Tipe bisnis yang relevan untuk sebuah sales channel. */
export type BusinessTypeKey = 'jasa' | 'produk' | 'dagang';

export interface SalesChannelConfig {
  label: string;
  /** Label ringkas untuk badge ukuran kecil (list baris). Default: pakai `label`. */
  labelShort?: string;
  bgColor: string;       // Tailwind bg class for badge background
  textColor: string;     // Tailwind text class for badge text
  /** Inline SVG string (viewBox="0 0 24 24") OR null to use a text fallback */
  svgPath: string | null;
  /** Hex fill color for the SVG path */
  svgFill: string;
  /** Path to image in /public (takes priority over svgPath) */
  imagePath?: string;
  /** Alternate image for larger/modal contexts (size='md') */
  imagePathLarge?: string;
  /**
   * Tipe bisnis tempat channel ini relevan. `undefined` = berlaku untuk semua
   * tipe (channel umum seperti WhatsApp, Instagram, Website, Offline).
   * - Marketplace produk (Tokopedia, Shopee, dll) → produk & dagang
   * - Akomodasi/travel (Airbnb, Booking.com, Traveloka) → jasa
   */
  businessTypes?: BusinessTypeKey[];
}

export const SALES_CHANNEL_CONFIG: Record<SalesChannel, SalesChannelConfig> = {
  tiktok: {
    label: 'TikTok',
    bgColor: 'bg-black',
    textColor: 'text-white',
    svgFill: '#ffffff',
    svgPath: null,
    imagePath: '/sales channel/tiktok.svg',
    // Channel sosial/konten — relevan untuk semua tipe bisnis (jasa juga jualan
    // via TikTok), sama seperti Instagram. Jangan dibatasi produk/dagang saja.
  },
  tokopedia: {
    label: 'Tokopedia',
    bgColor: 'bg-[#42b549]',
    textColor: 'text-white',
    svgFill: '#ffffff',
    svgPath: null,
    imagePath: '/sales channel/mascot.png',
    businessTypes: ['produk', 'dagang'],
  },
  shopee: {
    label: 'Shopee',
    bgColor: 'bg-[#ee4d2d]',
    textColor: 'text-white',
    svgFill: '#ffffff',
    svgPath: null,
    imagePath: '/sales channel/shopee-white.webp',
    businessTypes: ['produk', 'dagang'],
  },
  lazada: {
    label: 'Lazada',
    bgColor: 'bg-[#0F146D]',
    textColor: 'text-white',
    svgFill: '#ffffff',
    svgPath: null,
    businessTypes: ['produk', 'dagang'],
  },
  blibli: {
    label: 'Blibli',
    bgColor: 'bg-[#0070cc]',
    textColor: 'text-white',
    svgFill: '#ffffff',
    svgPath: null,
    businessTypes: ['produk', 'dagang'],
  },
  airbnb: {
    label: 'Airbnb',
    bgColor: 'bg-[#FF5A5F]',
    textColor: 'text-white',
    svgFill: '#ffffff',
    svgPath: null,
    imagePath: '/sales channel/airbnb.png',
    businessTypes: ['jasa'],
  },
  booking_com: {
    label: 'Booking.com',
    bgColor: 'bg-[#003580]',
    textColor: 'text-white',
    svgFill: '#ffffff',
    svgPath: null,
    imagePath: '/sales channel/booking.png',
    businessTypes: ['jasa'],
  },
  traveloka: {
    label: 'Traveloka',
    bgColor: 'bg-[#0064D2]',
    textColor: 'text-white',
    svgFill: '#ffffff',
    svgPath:
      'M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z',
    businessTypes: ['jasa'],
  },
  instagram: {
    label: 'Instagram',
    // Solid magenta khas Instagram — konsisten dengan badge channel lain yang 1 warna solid
    bgColor: 'bg-[#E1306C]',
    textColor: 'text-white',
    svgFill: '#ffffff',
    svgPath: null,
    imagePath: '/sales channel/ig.png',
  },
  whatsapp: {
    label: 'WhatsApp',
    bgColor: 'bg-[#25D366]',
    textColor: 'text-white',
    svgFill: '#ffffff',
    svgPath:
      'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z M12 0C5.373 0 0 5.373 0 12c0 2.124.554 4.118 1.528 5.845L0 24l6.335-1.507A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z',
    imagePath: '/sales channel/wa.webp',
  },
  sinarmas: {
    label: 'Sinarmas Sekuritas',
    labelShort: 'Sinarmas',
    bgColor: 'bg-[#d92d27]',
    textColor: 'text-white',
    svgFill: '#ffffff',
    svgPath: null,
    imagePath: '/sales channel/sinarmas-icon.png',
    businessTypes: ['dagang'],
  },
  website: {
    label: 'Website',
    bgColor: 'bg-[#6366f1]',
    textColor: 'text-white',
    svgFill: '#ffffff',
    svgPath:
      'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm-1 17.93V18a1 1 0 0 0-1-1H8a2 2 0 0 1-2-2v-1l-2.72-2.72A8.01 8.01 0 0 1 3 12a9 9 0 0 1 8-8.94V6a2 2 0 0 0 2 2h2a2 2 0 0 1 2 2v1a2 2 0 0 0 2 2 2 2 0 0 0 2-2 8.01 8.01 0 0 1-7 7.93z',
  },
  offline: {
    label: 'Offline / Toko',
    bgColor: 'bg-[#78716c]',
    textColor: 'text-white',
    svgFill: '#ffffff',
    svgPath:
      'M20 4H4v2l8 5 8-5V4zm0 4.236-8 5-8-5V20h16V8.236z',
  },
  other: {
    label: 'Lainnya',
    bgColor: 'bg-gray-500',
    textColor: 'text-white',
    svgFill: '#ffffff',
    svgPath: null,
  },
};

export const SALES_CHANNEL_OPTIONS: { value: SalesChannel; label: string }[] =
  (Object.entries(SALES_CHANNEL_CONFIG) as [SalesChannel, SalesChannelConfig][]).map(
    ([value, cfg]) => ({ value, label: cfg.label })
  );

/**
 * Apakah channel relevan untuk tipe bisnis tertentu.
 * Channel tanpa `businessTypes` (umum) selalu relevan untuk semua tipe.
 * `businessType` yang kosong/tak dikenal → tampilkan semua (jangan menyembunyikan).
 */
export function isChannelForBusinessType(
  channel: SalesChannel,
  businessType?: string | null
): boolean {
  const allowed = SALES_CHANNEL_CONFIG[channel]?.businessTypes;
  if (!allowed) return true; // channel umum
  if (!businessType) return true; // tipe belum diset → jangan sembunyikan apa pun
  return allowed.includes(businessType as BusinessTypeKey);
}

/**
 * Opsi sales channel yang sudah difilter sesuai tipe bisnis aktif.
 * Dipakai dropdown pemilihan channel di form transaksi & import.
 */
export function getSalesChannelOptions(
  businessType?: string | null
): { value: SalesChannel; label: string }[] {
  return SALES_CHANNEL_OPTIONS.filter((opt) =>
    isChannelForBusinessType(opt.value, businessType)
  );
}
