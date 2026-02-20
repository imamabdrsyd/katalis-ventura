'use client';

import type { BusinessOmniChannel, OmniChannelLink } from '@/types';
import { LinkButton } from './LinkButton';

interface Props {
  channel: BusinessOmniChannel;
  links: OmniChannelLink[];
}

export function PublicOmniChannelPage({ channel, links }: Props) {
  const initials = channel.title
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Avatar */}
        <div className="flex justify-center mb-4">
          {channel.logo_url ? (
            <img
              src={channel.logo_url}
              alt={channel.title}
              className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-gray-800 shadow-lg"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border-4 border-white dark:border-gray-800 shadow-lg">
              <span className="text-2xl font-bold text-white">{initials}</span>
            </div>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100">
          {channel.title}
        </h1>

        {/* Tagline */}
        {channel.tagline && (
          <p className="text-center text-gray-500 dark:text-gray-400 mt-1 text-sm">
            {channel.tagline}
          </p>
        )}

        {/* Bio */}
        {channel.bio && (
          <p className="text-center text-gray-600 dark:text-gray-300 mt-3 text-sm leading-relaxed max-w-sm mx-auto">
            {channel.bio}
          </p>
        )}

        {/* Links */}
        {links.length > 0 && (
          <div className="mt-8 space-y-3">
            {links.map((link) => (
              <LinkButton key={link.id} link={link} />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-600">
            Dibuat dengan Katalis Ventura
          </p>
        </div>
      </div>
    </main>
  );
}
