'use client';

import type { OmniChannelLink } from '@/types';
import { CHANNEL_META } from '@/lib/omniChannelMeta';

interface Props {
  link: OmniChannelLink;
}

export function LinkButton({ link }: Props) {
  const meta = CHANNEL_META[link.channel_type];

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 w-full px-5 py-3.5 rounded-xl ${meta.bgColor} ${meta.textColor} font-medium text-sm transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] shadow-md`}
    >
      <span
        className="w-5 h-5 flex-shrink-0"
        dangerouslySetInnerHTML={{ __html: meta.iconSvg }}
      />
      <span className="flex-1 text-center pr-5">{link.label}</span>
    </a>
  );
}
