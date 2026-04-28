'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">
            Storefront
          </span>
          {active && (
            <>
              <Image
                src="/images/favicon.png"
                alt="AXION"
                width={20}
                height={20}
                className="object-contain dark:hidden opacity-40"
              />
              <Image
                src="/images/favicon-dark.png"
                alt="AXION"
                width={20}
                height={20}
                className="object-contain hidden dark:block opacity-40"
              />
              <span className="text-base font-semibold text-indigo-600 dark:text-indigo-400 truncate max-w-[180px]">
                {active.business_name}
              </span>
              {businesses.length > 1 && (
                <button
                  type="button"
                  onClick={() => setActiveIndex((i) => (i + 1) % businesses.length)}
                  className="flex items-center justify-center w-5 h-5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Bisnis berikutnya"
                >
                  <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                </button>
              )}
            </>
          )}
        </div>
        <div className="flex items-center">
          <Image
            src="/images/favicon.png"
            alt="AXION"
            width={28}
            height={28}
            className="object-contain dark:hidden"
          />
          <Image
            src="/images/favicon-dark.png"
            alt="AXION"
            width={28}
            height={28}
            className="object-contain hidden dark:block"
          />
        </div>
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
