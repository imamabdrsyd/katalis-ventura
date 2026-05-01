'use client';

import type { BusinessOmniChannel } from '@/types';
import type { PublicBusiness } from '@/components/omnichannel/types';
import { OmnichannelGalleryCarousel } from '@/components/omnichannel/OmnichannelGalleryCarousel';
import { OmnichannelWidget } from '@/components/omnichannel/OmnichannelWidget';
import { OmnichannelLinkCards } from '@/components/omnichannel/OmnichannelLinkCards';

interface Props {
  channel: BusinessOmniChannel;
  business: PublicBusiness;
}

export function PublicOmniChannelPage({ channel, business }: Props) {
  const isJasa = (business.business_type ?? 'jasa') === 'jasa';
  const hasGallery = business.gallery.length > 0;

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-3xl">
        {/* Avatar + Identity */}
        <div className="flex flex-col items-center mb-8">
          {channel.logo_url ? (
            <img
              src={channel.logo_url}
              alt={channel.title}
              className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-gray-800 shadow-lg mb-4"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center border-4 border-white dark:border-gray-800 shadow-lg mb-4">
              <span className="text-2xl font-bold text-white">
                {channel.title.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
              </span>
            </div>
          )}

          <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100">
            {channel.title}
          </h1>

          {channel.tagline && (
            <p className="text-center text-gray-500 dark:text-gray-400 mt-1 text-sm">
              {channel.tagline}
            </p>
          )}

          {channel.bio && (
            <p className="text-center text-gray-600 dark:text-gray-300 mt-3 text-sm leading-relaxed max-w-sm">
              {channel.bio}
            </p>
          )}
        </div>

        {/* Gallery + Widget — layout dua kolom di desktop, stack di mobile */}
        <div className={`grid gap-6 items-start ${hasGallery ? 'grid-cols-1 lg:grid-cols-[1fr_360px]' : 'grid-cols-1 max-w-md mx-auto w-full'}`}>
          {hasGallery && (
            <OmnichannelGalleryCarousel
              images={business.gallery}
              alt={channel.title}
            />
          )}

          <div>
            {isJasa ? (
              <OmnichannelWidget
                business={business}
                index={0}
              />
            ) : (
              <OmnichannelLinkCards
                business={business}
                index={0}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-600">
            Made by AXION
          </p>
        </div>
      </div>
    </main>
  );
}
