'use client';

import { useEffect, useMemo, useState } from 'react';
import { OmnichannelBusinessTabs } from './OmnichannelBusinessTabs';
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
        const firstJasa = list.findIndex((b) => (b.business_category ?? 'jasa') === 'jasa');
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

  const isJasa = (active.business_category ?? 'jasa') === 'jasa';

  return (
    <section className="pt-6 pb-8 px-6 max-w-6xl mx-auto w-full">
      {/* Tab navigation */}
      <div className="mb-6">
        <OmnichannelBusinessTabs
          businesses={businesses}
          activeIndex={activeIndex}
          onChange={setActiveIndex}
        />
      </div>

      {/* Gallery + Widget grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        <OmnichannelGalleryCarousel
          images={active.gallery}
          alt={active.business_name}
        />

        <div className="lg:sticky lg:top-24">
          {isJasa ? (
            <OmnichannelWidget business={active} index={activeIndex} />
          ) : (
            <OmnichannelLinkCards business={active} index={activeIndex} />
          )}
        </div>
      </div>
    </section>
  );
}
