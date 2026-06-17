import {
  Wheat,
  Heart,
  Building2,
  Palette,
  UtensilsCrossed,
  Coins,
  Home,
  Briefcase,
  type LucideIcon,
} from 'lucide-react';

/**
 * Mapping sektor bisnis → ikon Lucide (komponen, bukan elemen) sehukuran apa pun.
 * Sumber tunggal — sebelumnya di-duplikasi di BusinessCard & BusinessSwitcher.
 * Caller atur ukuran sendiri lewat className, mis. <Icon className="w-4 h-4" />.
 */
const SECTOR_ICONS: Record<string, LucideIcon> = {
  agribusiness: Wheat,
  personal_care: Heart,
  accommodation: Building2,
  creative_agency: Palette,
  food_and_beverage: UtensilsCrossed,
  finance: Coins,
  // Legacy sektor lama (kompatibilitas mundur)
  short_term_rental: Home,
  property_management: Building2,
  real_estate: Building2,
};

/**
 * Ikon untuk sektor bisnis. Fallback ke Briefcase untuk 'other'/custom/tak dikenal.
 */
export function getSectorIcon(sector?: string | null): LucideIcon {
  if (sector && SECTOR_ICONS[sector]) return SECTOR_ICONS[sector];
  return Briefcase;
}
