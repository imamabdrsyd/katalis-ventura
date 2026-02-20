import type { OmniChannelType } from '@/types';

export interface ChannelMeta {
  label: string;
  category: 'social' | 'ecommerce' | 'messaging' | 'custom';
  defaultLabel: string;
  placeholder: string;
  bgColor: string;
  textColor: string;
  iconSvg: string;
}

export const CHANNEL_META: Record<OmniChannelType, ChannelMeta> = {
  // Social Media
  instagram: {
    label: 'Instagram',
    category: 'social',
    defaultLabel: 'Follow kami di Instagram',
    placeholder: 'https://instagram.com/username',
    bgColor: 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400',
    textColor: 'text-white',
    iconSvg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>',
  },
  facebook: {
    label: 'Facebook',
    category: 'social',
    defaultLabel: 'Like kami di Facebook',
    placeholder: 'https://facebook.com/pagename',
    bgColor: 'bg-[#1877F2]',
    textColor: 'text-white',
    iconSvg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
  },
  tiktok: {
    label: 'TikTok',
    category: 'social',
    defaultLabel: 'Follow kami di TikTok',
    placeholder: 'https://tiktok.com/@username',
    bgColor: 'bg-black',
    textColor: 'text-white',
    iconSvg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>',
  },
  twitter: {
    label: 'X (Twitter)',
    category: 'social',
    defaultLabel: 'Follow kami di X',
    placeholder: 'https://x.com/username',
    bgColor: 'bg-black',
    textColor: 'text-white',
    iconSvg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  },
  youtube: {
    label: 'YouTube',
    category: 'social',
    defaultLabel: 'Subscribe channel YouTube kami',
    placeholder: 'https://youtube.com/@channel',
    bgColor: 'bg-[#FF0000]',
    textColor: 'text-white',
    iconSvg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
  },
  linkedin: {
    label: 'LinkedIn',
    category: 'social',
    defaultLabel: 'Connect di LinkedIn',
    placeholder: 'https://linkedin.com/company/name',
    bgColor: 'bg-[#0A66C2]',
    textColor: 'text-white',
    iconSvg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
  },

  // E-commerce
  shopee: {
    label: 'Shopee',
    category: 'ecommerce',
    defaultLabel: 'Belanja di Shopee kami',
    placeholder: 'https://shopee.co.id/shop/username',
    bgColor: 'bg-[#EE4D2D]',
    textColor: 'text-white',
    iconSvg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2.4a9.6 9.6 0 110 19.2 9.6 9.6 0 010-19.2zm-.12 3.6c-1.82 0-3.3 1.34-3.3 2.988 0 .18.024.348.06.516h-.06v.096c0 1.56 2.1 3.48 3.3 4.44 1.2-.96 3.3-2.88 3.3-4.44v-.096h-.06c.036-.168.06-.336.06-.516 0-1.648-1.48-2.988-3.3-2.988zm0 1.2c1.16 0 2.1.8 2.1 1.788s-.94 1.788-2.1 1.788-2.1-.8-2.1-1.788.94-1.788 2.1-1.788zm-4.08 6h8.16c.48 1.44.72 2.28.72 3.6 0 .6-.24 1.08-.72 1.44-.48.36-1.08.36-1.68.36H9.72c-.6 0-1.2 0-1.68-.36-.48-.36-.72-.84-.72-1.44 0-1.32.24-2.16.48-3.6z"/></svg>',
  },
  tokopedia: {
    label: 'Tokopedia',
    category: 'ecommerce',
    defaultLabel: 'Belanja di Tokopedia kami',
    placeholder: 'https://tokopedia.com/storename',
    bgColor: 'bg-[#42B549]',
    textColor: 'text-white',
    iconSvg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4.8a2.4 2.4 0 011.697.703L15.6 7.2h1.2A2.4 2.4 0 0119.2 9.6v7.2a2.4 2.4 0 01-2.4 2.4H7.2a2.4 2.4 0 01-2.4-2.4V9.6a2.4 2.4 0 012.4-2.4h1.2l1.903-1.697A2.4 2.4 0 0112 4.8zm0 4.8a3.6 3.6 0 100 7.2 3.6 3.6 0 000-7.2zm0 1.2a2.4 2.4 0 110 4.8 2.4 2.4 0 010-4.8z"/></svg>',
  },
  lazada: {
    label: 'Lazada',
    category: 'ecommerce',
    defaultLabel: 'Belanja di Lazada kami',
    placeholder: 'https://lazada.co.id/shop/name',
    bgColor: 'bg-[#0F146D]',
    textColor: 'text-white',
    iconSvg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-2.4 7.2h4.8L12 14.4l-2.4-7.2zm-3.6 3.6h3.6L12 18 6 10.8zm12 0L15.6 18 12 10.8h3.6z"/></svg>',
  },
  bukalapak: {
    label: 'Bukalapak',
    category: 'ecommerce',
    defaultLabel: 'Belanja di Bukalapak kami',
    placeholder: 'https://bukalapak.com/u/username',
    bgColor: 'bg-[#E31E52]',
    textColor: 'text-white',
    iconSvg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4.8c1.32 0 2.4 1.08 2.4 2.4v1.2h-4.8V7.2c0-1.32 1.08-2.4 2.4-2.4zm-4.8 4.8h9.6c.66 0 1.2.54 1.2 1.2v6c0 .66-.54 1.2-1.2 1.2H7.2c-.66 0-1.2-.54-1.2-1.2v-6c0-.66.54-1.2 1.2-1.2z"/></svg>',
  },
  blibli: {
    label: 'Blibli',
    category: 'ecommerce',
    defaultLabel: 'Belanja di Blibli kami',
    placeholder: 'https://blibli.com/merchant/name',
    bgColor: 'bg-[#0095DA]',
    textColor: 'text-white',
    iconSvg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1.2 6h2.4v3.6h-2.4V6zm-4.8 4.8h12v7.2H6v-7.2zm2.4 1.2v4.8h7.2v-4.8H8.4z"/></svg>',
  },

  // Messaging
  whatsapp: {
    label: 'WhatsApp',
    category: 'messaging',
    defaultLabel: 'Chat via WhatsApp',
    placeholder: 'https://wa.me/628123456789',
    bgColor: 'bg-[#25D366]',
    textColor: 'text-white',
    iconSvg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
  },
  telegram: {
    label: 'Telegram',
    category: 'messaging',
    defaultLabel: 'Chat via Telegram',
    placeholder: 'https://t.me/username',
    bgColor: 'bg-[#26A5E4]',
    textColor: 'text-white',
    iconSvg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>',
  },
  line: {
    label: 'LINE',
    category: 'messaging',
    defaultLabel: 'Add kami di LINE',
    placeholder: 'https://line.me/ti/p/@username',
    bgColor: 'bg-[#00B900]',
    textColor: 'text-white',
    iconSvg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>',
  },

  // Custom
  custom: {
    label: 'Tautan Kustom',
    category: 'custom',
    defaultLabel: 'Kunjungi link kami',
    placeholder: 'https://example.com',
    bgColor: 'bg-gray-800 dark:bg-gray-700',
    textColor: 'text-white',
    iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  },
};

export const CHANNEL_CATEGORIES = [
  { key: 'social' as const, label: 'Media Sosial' },
  { key: 'ecommerce' as const, label: 'E-Commerce' },
  { key: 'messaging' as const, label: 'Messaging' },
  { key: 'custom' as const, label: 'Kustom' },
];

export function getChannelsByCategory(category: ChannelMeta['category']): { type: OmniChannelType; meta: ChannelMeta }[] {
  return (Object.entries(CHANNEL_META) as [OmniChannelType, ChannelMeta][])
    .filter(([, meta]) => meta.category === category)
    .map(([type, meta]) => ({ type, meta }));
}
