'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBusinessContext } from '@/context/BusinessContext';
import { MemberList } from '@/components/business/MemberList';
import { InviteCodeManager } from '@/components/business/InviteCodeManager';
import { getBusinessMembers, type BusinessMember } from '@/lib/api/members';
import { ArrowLeft, UserPlus, Users, MapPin, Building2, Palette, Heart, Wheat, UtensilsCrossed, Coins, Home, Banknote } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { Business } from '@/types';

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  agribusiness: 'Agribusiness',
  personal_care: 'Personal Care',
  accommodation: 'Accommodation',
  creative_agency: 'Creative Agency',
  food_and_beverage: 'F&B',
  finance: 'Finance',
  short_term_rental: 'Short-term Rental',
  property_management: 'Property Management',
  real_estate: 'Real Estate',
};

const BUSINESS_TYPE_ICONS: Record<string, React.ReactNode> = {
  agribusiness: <Wheat className="w-6 h-6" />,
  personal_care: <Heart className="w-6 h-6" />,
  accommodation: <Building2 className="w-6 h-6" />,
  creative_agency: <Palette className="w-6 h-6" />,
  food_and_beverage: <UtensilsCrossed className="w-6 h-6" />,
  finance: <Coins className="w-6 h-6" />,
  short_term_rental: <Home className="w-6 h-6" />,
  property_management: <Building2 className="w-6 h-6" />,
  real_estate: <Building2 className="w-6 h-6" />,
};

function BusinessDetailCard({ business }: { business: Business }) {
  const icon = BUSINESS_TYPE_ICONS[business.business_type] || <Building2 className="w-6 h-6" />;
  const typeLabel = BUSINESS_TYPE_LABELS[business.business_type] || business.business_type;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 flex-1 self-stretch">
      {/* Business icon */}
      <div className="text-indigo-500 dark:text-indigo-400 mb-4">
        {icon}
      </div>

      {/* Business name */}
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
        {business.business_name}
      </h2>

      {/* Business type */}
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 mb-4">
        {typeLabel}
      </span>

      <div className="space-y-3 mt-2">
        {/* Capital */}
        <div className="flex items-start gap-3">
          <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Modal Bisnis</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {formatCurrency(business.capital_investment)}
            </p>
          </div>
        </div>

        {/* Address */}
        {business.property_address && (
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Alamat</p>
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">
                {business.property_address}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BusinessMembersPage() {
  const params = useParams();
  const router = useRouter();
  const businessId = params.id as string;

  const { user, userRole, businesses } = useBusinessContext();
  const isInvestor = userRole === 'investor';

  const business = businesses.find((b) => b.id === businessId);

  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteManager, setShowInviteManager] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const data = await getBusinessMembers(businessId);
      setMembers(data);
    } catch (err) {
      console.error('Failed to fetch members:', err);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return (
    <div className="p-8">
      {/* Back nav */}
      <button
        onClick={() => router.push('/businesses')}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke Business
      </button>

      {/* Header row */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              Anggota Bisnis
            </h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm ml-[52px]">
            {business?.business_name || '—'}
            {!loading && (
              <span className="ml-2 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-xs font-medium">
                {members.length} anggota
              </span>
            )}
          </p>
        </div>

        {!isInvestor && (
          <button
            onClick={() => setShowInviteManager(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors font-medium text-sm shadow-sm"
          >
            <UserPlus className="h-4 w-4" />
            Undang Anggota
          </button>
        )}
      </div>

      {/* Members List + Business Detail */}
      <div className="flex items-stretch gap-8">
        <div className="max-w-2xl w-full">
          <MemberList members={members} loading={loading} />
        </div>
        {business && <BusinessDetailCard business={business} />}
      </div>

      {/* Invite Code Manager Modal */}
      {showInviteManager && user && business && (
        <InviteCodeManager
          businessId={business.id}
          businessName={business.business_name}
          userId={user.id}
          onClose={() => setShowInviteManager(false)}
        />
      )}
    </div>
  );
}
