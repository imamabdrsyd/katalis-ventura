import { Globe, Store, Images, type LucideIcon } from 'lucide-react';

export type Surface = 'public-page' | 'storefront' | 'logo-slide';

export type SurfaceFilter = 'all' | Surface;

export interface SurfaceMeta {
  id: Surface;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind classes untuk chip warna */
  chipClass: string;
  /** Background panel preview */
  previewBgClass: string;
}

export const SURFACES: SurfaceMeta[] = [
  {
    id: 'public-page',
    label: 'Halaman Publik',
    shortLabel: 'Halaman',
    description: 'Halaman link-in-bio di axionventura.com/[slug]',
    icon: Globe,
    chipClass:
      'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-400/30',
    previewBgClass: 'bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900',
  },
  {
    id: 'storefront',
    label: 'Storefront Landing',
    shortLabel: 'Storefront',
    description: 'Section "One stock, every channel" di landing page Axion',
    icon: Store,
    chipClass:
      'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300 border-violet-200/60 dark:border-violet-400/30',
    previewBgClass: 'bg-white dark:bg-gray-950',
  },
  {
    id: 'logo-slide',
    label: 'Slide Logo Landing',
    shortLabel: 'Slide Logo',
    description: 'Carousel logo bisnis di bagian stats landing page Axion',
    icon: Images,
    chipClass:
      'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300 border-amber-200/60 dark:border-amber-400/30',
    previewBgClass: 'bg-gray-50 dark:bg-gray-950',
  },
];

export const SURFACE_BY_ID: Record<Surface, SurfaceMeta> = SURFACES.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<Surface, SurfaceMeta>,
);

export type SectionId =
  | 'page-config'
  | 'featured-product'
  | 'widget'
  | 'links'
  | 'gallery'
  | 'showcase';

export interface SectionMeta {
  id: SectionId;
  surfaces: Surface[];
}

export const SECTION_SURFACES: Record<SectionId, Surface[]> = {
  'page-config': ['public-page'],
  'featured-product': ['public-page'],
  // 'widget' menggabungkan: Widget Utama (kontak), Konfigurasi Widget Reservasi,
  // dan Harga Layanan — semuanya feed ke satu widget output yang sama.
  'widget': ['public-page', 'storefront'],
  'links': ['public-page', 'storefront'],
  'gallery': ['public-page', 'storefront'],
  'showcase': ['public-page'],
};

export function sectionMatchesFilter(sectionId: SectionId, filter: SurfaceFilter): boolean {
  if (filter === 'all') return true;
  return SECTION_SURFACES[sectionId].includes(filter);
}
