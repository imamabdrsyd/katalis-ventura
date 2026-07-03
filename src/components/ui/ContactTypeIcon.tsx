import { User, Building, Handshake, UserCog, TrendingUp, Users2, type LucideIcon } from 'lucide-react';
import type { ContactType } from '@/types';

// Source of truth icon per tipe kontak — netral (tidak berwarna per tipe)
const CONTACT_TYPE_ICON_CONFIG: Record<ContactType, { Icon: LucideIcon }> = {
  customer: { Icon: User },
  vendor: { Icon: Building },
  partner: { Icon: Handshake },
  staff: { Icon: UserCog },
  investor: { Icon: TrendingUp },
  other: { Icon: Users2 },
};

const NEUTRAL_COLOR_CLASS = 'text-gray-400 dark:text-gray-500';

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  customer: 'Customer',
  vendor: 'Vendor',
  partner: 'Partner',
  staff: 'Staff',
  investor: 'Investor',
  other: 'Lainnya',
};

export function ContactTypeIcon({
  type,
  sizeClassName = 'w-3.5 h-3.5',
}: {
  type: ContactType;
  sizeClassName?: string;
}) {
  const { Icon } = CONTACT_TYPE_ICON_CONFIG[type];
  return <Icon className={`${sizeClassName} ${NEUTRAL_COLOR_CLASS} flex-shrink-0`} />;
}
