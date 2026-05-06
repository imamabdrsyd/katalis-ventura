'use client';

import Image from 'next/image';
import type { BusinessOmniChannel } from '@/types';
import type { PublicBusiness } from '@/components/omnichannel/types';
import { OmnichannelGalleryCarousel } from '@/components/omnichannel/OmnichannelGalleryCarousel';
import { OmnichannelShowcase } from '@/components/omnichannel/OmnichannelShowcase';
import { OmnichannelWidget } from '@/components/omnichannel/OmnichannelWidget';
import { OmnichannelLinks } from '@/components/omnichannel/OmnichannelLinks';
import { OmnichannelFeaturedProduct } from '@/components/omnichannel/OmnichannelFeaturedProduct';

interface Props {
  channel: BusinessOmniChannel;
  business: PublicBusiness;
}

export function PublicOmniChannelPage({ channel, business }: Props) {
  const isJasa = (business.business_type ?? 'jasa') === 'jasa';
  const hasGallery = business.show_gallery && business.gallery.length > 0;
  const hasShowcase = business.show_showcase && business.showcase.length > 0;
  const hasFeaturedProduct = !!(business.featured_product?.show && business.featured_product?.name);
  const showWidget = business.show_widget;
  const showLinks = business.show_links && business.links.length > 0;
  const layout = business.layout_mode;
  const showLogo = layout !== 'clean';

  // Identity block: title + tagline + bio
  const identity = (
    <>
      <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100">
        {channel.title}
      </h1>
      {channel.tagline && (
        <p className="text-center text-gray-500 dark:text-gray-400 mt-1 text-sm">
          {channel.tagline}
        </p>
      )}
      {channel.bio && (
        <p className="text-center text-gray-600 dark:text-gray-300 mt-3 text-sm leading-relaxed max-w-sm mx-auto">
          {channel.bio}
        </p>
      )}
    </>
  );

  const logoBlock = showLogo && (
    channel.logo_url ? (
      <img
        src={channel.logo_url}
        alt={channel.title}
        className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-gray-800 shadow-lg"
      />
    ) : (
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center border-4 border-white dark:border-gray-800 shadow-lg">
        <span className="text-2xl font-bold text-white">
          {channel.title.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
        </span>
      </div>
    )
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-3xl">

        {/* HEADER — varian per layout_mode */}
        {layout === 'classic' && (
          <>
            <div className="flex flex-col items-center mb-6">
              {logoBlock && <div className="mb-4">{logoBlock}</div>}
              {identity}
            </div>
            {business.banner_url && (
              <div className="relative w-full aspect-[3/1] rounded-2xl overflow-hidden mb-6 shadow-sm">
                <Image src={business.banner_url} alt={`${channel.title} banner`} fill className="object-cover" unoptimized priority />
              </div>
            )}
          </>
        )}

        {layout === 'modern' && (
          <>
            {business.banner_url ? (
              <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden shadow-sm">
                <Image src={business.banner_url} alt={`${channel.title} banner`} fill className="object-cover" unoptimized priority />
              </div>
            ) : (
              <div className="w-full aspect-[16/9] rounded-2xl bg-gradient-to-br from-primary-500 to-purple-500" />
            )}
            <div className="flex flex-col items-center -mt-12 mb-6">
              {logoBlock}
              <div className="mt-4">{identity}</div>
            </div>
          </>
        )}

        {layout === 'clean' && (
          <>
            {business.banner_url && (
              <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden mb-6 shadow-sm">
                <Image src={business.banner_url} alt={`${channel.title} banner`} fill className="object-cover" unoptimized priority />
              </div>
            )}
            <div className="flex flex-col items-center mb-6">
              {identity}
            </div>
          </>
        )}

        {/* BODY — Gallery + Widget (jasa: reservation, produk/dagang: dikosongkan, link berdiri sendiri) */}
        <div className={`grid gap-6 items-start ${hasGallery ? 'grid-cols-1 lg:grid-cols-[1fr_360px]' : 'grid-cols-1 max-w-md mx-auto w-full'}`}>
          {hasGallery && (
            <div>
              <OmnichannelGalleryCarousel images={business.gallery} alt={channel.title} />
              {hasFeaturedProduct && (
                <OmnichannelFeaturedProduct product={business.featured_product!} />
              )}
            </div>
          )}

          {/* Widget reservasi hanya untuk bisnis jasa */}
          {showWidget && isJasa && (
            <div>
              <OmnichannelWidget business={business} index={0} />
            </div>
          )}
        </div>

        {/* Featured product — full width jika tidak ada gallery */}
        {hasFeaturedProduct && !hasGallery && (
          <div className="max-w-md mx-auto w-full mt-0">
            <OmnichannelFeaturedProduct product={business.featured_product!} />
          </div>
        )}

        {/* LINKS — berdiri sendiri, untuk semua tipe bisnis */}
        {showLinks && (
          <div className="max-w-md mx-auto w-full mt-6">
            <OmnichannelLinks links={business.links} />
          </div>
        )}

        {/* Showcase Image — full width, natural ratio */}
        {hasShowcase && (
          <div className="mt-8">
            <OmnichannelShowcase images={business.showcase} alt={channel.title} />
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-600">
            Made with AXION
          </p>
        </div>
      </div>
    </main>
  );
}
