'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { OmnichannelGalleryCarousel } from './OmnichannelGalleryCarousel';
import { OmnichannelWidget } from './OmnichannelWidget';
import { OmnichannelLinkCards } from './OmnichannelLinkCards';
import { PublicBusiness } from './types';

export function OmnichannelSection() {
  const [businesses, setBusinesses] = useState<PublicBusiness[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public-businesses')
      .then((res) => (res.ok ? res.json() : { businesses: [] }))
      .then((json) => {
        if (cancelled) return;
        const list: PublicBusiness[] = json.businesses ?? [];
        setBusinesses(list);
        const firstJasa = list.findIndex((b) => (b.business_type ?? 'jasa') === 'jasa');
        setActiveIndex(firstJasa >= 0 ? firstJasa : 0);
      })
      .catch((err) => {
        console.error('Failed to load public businesses:', err);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const active = useMemo(
    () => businesses[activeIndex] ?? null,
    [activeIndex, businesses]
  );

  if (!loaded || businesses.length === 0 || !active) return null;

  const isJasa = (active.business_type ?? 'jasa') === 'jasa';

  return (
    <section className="p-8 max-w-6xl mx-auto w-full">
      {/* Header: Storefront title */}
      <div className="flex items-center gap-3 mb-6">
        <Image
          src="/images/favicon.png"
          alt="Storefront"
          width={32}
          height={32}
          className="object-contain"
        />
        <span className="text-xl font-bold text-gray-800 dark:text-gray-100">
          Storefront
        </span>
      </div>

      {/* Gallery + Widget grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        <OmnichannelGalleryCarousel
          images={active.gallery}
          alt={active.business_name}
        />

        <div>
          {isJasa ? (
            <OmnichannelWidget
              business={active}
              index={activeIndex}
              businesses={businesses}
              onSelectBusiness={setActiveIndex}
            />
          ) : (
            <OmnichannelLinkCards
              business={active}
              index={activeIndex}
              businesses={businesses}
              onSelectBusiness={setActiveIndex}
            />
          )}
        </div>
      </div>
    </section>
  );
}
