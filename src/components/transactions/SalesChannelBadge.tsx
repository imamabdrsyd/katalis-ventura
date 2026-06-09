'use client';

import type { SalesChannel } from '@/types';
import { SALES_CHANNEL_CONFIG } from '@/lib/salesChannels';

interface Props {
  channel: SalesChannel;
  size?: 'sm' | 'md';
}

export function SalesChannelBadge({ channel, size = 'sm' }: Props) {
  const cfg = SALES_CHANNEL_CONFIG[channel];
  if (!cfg) return null;

  const iconSize = size === 'md' ? 16 : 14;
  const padding = size === 'md' ? 'px-2 py-1 gap-1.5' : 'px-1.5 py-0.5 gap-1';
  const textSize = size === 'md' ? 'text-xs' : 'text-[10px]';

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${cfg.bgColor} ${cfg.textColor} ${padding} ${textSize}`}
      title={cfg.label}
    >
      {cfg.svgPath ? (
        <svg
          viewBox="0 0 24 24"
          width={iconSize}
          height={iconSize}
          fill={cfg.svgFill}
          className="flex-shrink-0"
          aria-hidden="true"
        >
          <path d={cfg.svgPath} />
        </svg>
      ) : null}
      <span>{cfg.label}</span>
    </span>
  );
}
