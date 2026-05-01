export interface PublicGalleryImage {
  url: string;
  sort_order: number;
}

export interface PublicLink {
  id: string;
  channel_type: string;
  label: string;
  url: string;
  is_primary: boolean;
  sort_order: number;
}

export interface PublicWidgetLabels {
  date_label?: string;
  checkin_label?: string;
  checkout_label?: string;
  note_label?: string;
  note_placeholder?: string;
  cta_label?: string;
  action_label?: string;
  reservation_subtitle?: string;
}

export interface PublicPricingRule {
  id: string;
  date_from: string;
  date_to: string;
  price: number;
  label: string | null;
}

export interface PublicBusiness {
  id: string;
  business_name: string;
  slug: string | null;
  business_type: 'jasa' | 'produk' | 'dagang' | null;
  business_sector: string | null;
  city: string | null;
  whatsapp_number: string | null;
  widget_action_label: string | null;
  logo_url: string | null;
  gallery: PublicGalleryImage[];
  links: PublicLink[];
  widget_date_mode?: 'single' | 'double';
  widget_labels?: PublicWidgetLabels;
  show_pricing?: boolean;
  default_price?: number | null;
  price_unit?: string | null;
  pricing_rules?: PublicPricingRule[];
}

const SECTOR_LABELS: Record<string, string> = {
  agribusiness: 'Agribusiness',
  personal_care: 'Personal Care',
  accommodation: 'Akomodasi',
  creative_agency: 'Creative Agency',
  food_and_beverage: 'F&B',
  finance: 'Finance',
  short_term_rental: 'Short-Term Rental',
  real_estate: 'Real Estate',
  property_management: 'Property Management',
};

export function formatSector(sector: string | null | undefined): string {
  if (!sector) return '';
  return SECTOR_LABELS[sector] ?? sector;
}

export function formatCategory(
  category: 'jasa' | 'produk' | 'dagang' | null | undefined
): string {
  if (!category) return 'Jasa';
  return category.charAt(0).toUpperCase() + category.slice(1);
}
