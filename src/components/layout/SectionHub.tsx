'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useNavData, type NavSectionKey } from '@/lib/navigation';
import { useBusinessContext } from '@/context/BusinessContext';
import { isManagerRole } from '@/lib/roles';

/**
 * Halaman hub untuk section sidebar (Akuntansi / Laporan Keuangan / Analitik).
 * Menggantikan drill-down accordion lama: klik section di sidebar → halaman ini,
 * yang menampilkan seluruh sub-menu sebagai kartu-kartu.
 */
export function SectionHub({ sectionKey }: { sectionKey: NavSectionKey }) {
  const { navSections } = useNavData();
  const { userRole } = useBusinessContext();
  const section = navSections.find((s) => s.key === sectionKey);

  if (!section) return null;

  const HeaderIcon = section.icon;
  // CTA = aksi mencatat, bukan halaman lihat-lihat — investor read-only tidak
  // perlu melihatnya (kartu sub-menu di bawah tetap tampil untuk semua role).
  const cta = section.cta && isManagerRole(userRole) ? section.cta : null;
  const CtaIcon = cta?.icon;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <HeaderIcon className="w-8 h-8 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{section.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{section.subtitle}</p>
        </div>
        {cta && CtaIcon && (
          <Link
            href={cta.href}
            className="ml-auto flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all text-sm font-semibold"
          >
            <CtaIcon className="w-4 h-4" />
            {cta.label}
          </Link>
        )}
      </div>

      {/* Kartu-kartu sub-menu */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {section.items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="card group flex flex-col gap-3 !p-5"
            >
              <div className="flex items-start justify-between">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50">
                  <Icon className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                </div>
                <ArrowUpRight className="w-5 h-5 text-gray-300 dark:text-gray-600 transition-colors group-hover:text-indigo-500 dark:group-hover:text-indigo-400" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-800 dark:text-gray-100 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                  {item.label}
                </h2>
                {item.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                    {item.description}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
