'use client';

import Image from 'next/image';
import { ExternalLink } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { CHANNEL_META } from '@/lib/omniChannelMeta';
import type { OmniChannelType } from '@/types';
import type { PublicLink } from './types';

const CHANNEL_PNG: Partial<Record<string, string>> = {
  shopee: '/images/ecommerce/Shopee.png',
  tiktok: '/images/ecommerce/Tiktokshop.png',
  tokopedia: '/images/ecommerce/Tokopedia.png',
};

function ChannelIcon({ type, customIconUrl, lucideIcon }: { type: string; customIconUrl?: string | null; lucideIcon?: string | null }) {
  const meta = CHANNEL_META[type as OmniChannelType] ?? CHANNEL_META.custom;

  // Custom uploaded image — highest priority
  if (customIconUrl) {
    return (
      <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
        <Image src={customIconUrl} alt={meta.label} width={36} height={36} className="object-contain w-full h-full" unoptimized />
      </div>
    );
  }

  // Lucide icon picked by user
  if (lucideIcon) {
    const Icon = (LucideIcons as any)[lucideIcon] as React.ElementType | undefined;
    if (Icon) {
      return (
        <div className="w-9 h-9 rounded-lg flex-shrink-0 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <Icon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </div>
      );
    }
  }

  // Platform PNG (Shopee, TikTok, Tokopedia)
  const pngUrl = CHANNEL_PNG[type];
  if (pngUrl) {
    return (
      <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-white border border-gray-100">
        <Image src={pngUrl} alt={meta.label} width={36} height={36} className="object-contain w-full h-full" />
      </div>
    );
  }

  // Default platform SVG icon
  return (
    <div
      className={`w-9 h-9 rounded-lg flex items-center justify-center ${meta.bgColor} ${meta.textColor} flex-shrink-0`}
      dangerouslySetInnerHTML={{
        __html: meta.iconSvg.replace('<svg ', '<svg class="w-5 h-5" '),
      }}
    />
  );
}

// Icon khusus untuk primary button — tanpa wrapper kotak, selalu putih
function ButtonIcon({ type, customIconUrl, lucideIcon }: { type: string; customIconUrl?: string | null; lucideIcon?: string | null }) {
  const meta = CHANNEL_META[type as OmniChannelType] ?? CHANNEL_META.custom;

  if (customIconUrl) {
    return <Image src={customIconUrl} alt={meta.label} width={20} height={20} className="w-5 h-5 object-contain brightness-0 invert" unoptimized />;
  }

  if (lucideIcon) {
    const Icon = (LucideIcons as any)[lucideIcon] as React.ElementType | undefined;
    if (Icon) return <Icon className="w-5 h-5 text-white" />;
  }

  // Platform SVG — inline tanpa wrapper, paksa putih
  return (
    <span
      className="w-5 h-5 flex items-center justify-center [&_svg]:w-5 [&_svg]:h-5 [&_path]:fill-white [&_circle]:fill-white [&_rect]:fill-white"
      dangerouslySetInnerHTML={{ __html: meta.iconSvg }}
    />
  );
}

interface Props {
  links: PublicLink[];
  buttonColor?: string | null;
}

export function OmnichannelLinks({ links, buttonColor }: Props) {
  if (links.length === 0) return null;

  const primaryBg = buttonColor ?? '#6366f1';

  // Group consecutive icon_only links into horizontal chunks
  type Chunk =
    | { kind: 'icons'; items: PublicLink[] }
    | { kind: 'single'; item: PublicLink };

  const chunks: Chunk[] = [];
  for (const link of links) {
    if (link.display_mode === 'icon_only') {
      const last = chunks[chunks.length - 1];
      if (last?.kind === 'icons') {
        last.items.push(link);
      } else {
        chunks.push({ kind: 'icons', items: [link] });
      }
    } else {
      chunks.push({ kind: 'single', item: link });
    }
  }

  return (
    <div className="space-y-2">
      {chunks.map((chunk, ci) => {
        if (chunk.kind === 'icons') {
          return (
            <div key={`icons-${ci}`} className="flex flex-wrap gap-3 justify-center py-1">
              {chunk.items.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link.label}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition"
                >
                  <ChannelIcon type={link.channel_type} customIconUrl={link.custom_icon_url} lucideIcon={link.lucide_icon} />
                </a>
              ))}
            </div>
          );
        }

        const link = chunk.item;
        const meta = CHANNEL_META[link.channel_type as OmniChannelType] ?? CHANNEL_META.custom;

        if (link.is_primary) {
          return (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 w-full py-3.5 px-4 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: primaryBg }}
            >
              <ButtonIcon type={link.channel_type} customIconUrl={link.custom_icon_url} lucideIcon={link.lucide_icon} />
              {link.label || meta.defaultLabel}
            </a>
          );
        }

        const subtitleText = link.subtitle || (link.label !== meta.label ? meta.label : null);
        return (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            <ChannelIcon type={link.channel_type} customIconUrl={link.custom_icon_url} lucideIcon={link.lucide_icon} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {link.label || meta.label}
              </p>
              {subtitleText && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {subtitleText}
                </p>
              )}
            </div>
            <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-primary-500 transition" />
          </a>
        );
      })}
    </div>
  );
}
