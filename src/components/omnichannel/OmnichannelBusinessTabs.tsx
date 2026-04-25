'use client';

import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PublicBusiness } from './types';

interface Props {
  businesses: PublicBusiness[];
  activeIndex: number;
  onChange: (index: number) => void;
}

export function OmnichannelBusinessTabs({ businesses, activeIndex, onChange }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Scroll active tab into view setiap kali activeIndex berubah
  useEffect(() => {
    const node = tabRefs.current[activeIndex];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeIndex]);

  function scrollBy(delta: number) {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  }

  function go(direction: -1 | 1) {
    const next = (activeIndex + direction + businesses.length) % businesses.length;
    onChange(next);
  }

  if (businesses.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          go(-1);
          scrollBy(-200);
        }}
        className="shrink-0 w-9 h-9 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center transition"
        aria-label="Bisnis sebelumnya"
      >
        <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
      </button>

      <div
        ref={scrollRef}
        className="flex-1 flex overflow-x-auto scroll-smooth no-scrollbar border-b border-gray-200 dark:border-gray-700"
      >
        {businesses.map((biz, i) => {
          const isActive = i === activeIndex;
          return (
            <button
              key={biz.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              onClick={() => onChange(i)}
              className={`shrink-0 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition border-b-2 -mb-px ${
                isActive
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {biz.business_name}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          go(1);
          scrollBy(200);
        }}
        className="shrink-0 w-9 h-9 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center transition"
        aria-label="Bisnis berikutnya"
      >
        <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
      </button>
    </div>
  );
}
