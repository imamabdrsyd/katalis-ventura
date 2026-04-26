'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useBusinessContext } from '@/context/BusinessContext';
import { MemberList } from '@/components/business/MemberList';
import { InviteCodeManager } from '@/components/business/InviteCodeManager';
import { getBusinessMembers, type BusinessMember } from '@/lib/api/members';
import Image from 'next/image';
import { ArrowLeft, UserPlus, Users, Globe, MapPin, Building2, Palette, Heart, Wheat, UtensilsCrossed, Coins, Home, Banknote, LogOut, ShoppingBag, Contact } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { OmniChannelManager } from '@/components/business/OmniChannelManager';
import * as businessesApi from '@/lib/api/businesses';
import { EcommerceIntegration } from '@/components/ecommerce/EcommerceIntegration';
import { ContactList } from '@/components/business/ContactList';
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

function BusinessDetailCard({ business, onLeave }: { business: Business; onLeave?: () => void }) {
  const icon = BUSINESS_TYPE_ICONS[business.business_sector ?? ''] || <Building2 className="w-6 h-6" />;
  const typeLabel = BUSINESS_TYPE_LABELS[business.business_sector ?? ''] || business.business_sector;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 flex-1 self-stretch">
      {/* Business icon/logo */}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden mb-4 ${business.logo_url ? 'bg-white' : 'text-indigo-500 dark:text-indigo-400'}`}>
        {business.logo_url ? (
          <Image src={business.logo_url} alt={business.business_name} width={48} height={48} className="w-full h-full object-cover" unoptimized />
        ) : (
          icon
        )}
      </div>

      {/* Business name */}
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
        {business.business_name}
      </h2>

      {/* Business type */}
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 mb-4">
        {typeLabel}
      </span>

      <div className="space-y-3 mt-2">
        {/* Capital */}
        <div className="flex items-start gap-3">
          <Banknote className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
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
            <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Alamat</p>
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">
                {business.property_address}
              </p>
            </div>
          </div>
        )}
      </div>

      {onLeave && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onLeave}
            className="w-full px-4 py-2.5 text-sm font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Keluar dari Bisnis
          </button>
        </div>
      )}
    </div>
  );
}

export default function BusinessMembersPage() {
  const params = useParams();
  const router = useRouter();
  const businessId = params.id as string;

  const { user, userRole, isSuperadmin, businesses, activeBusiness, setActiveBusiness, refetch } = useBusinessContext();
  const isInvestor = userRole === 'investor';
  const canManage = userRole === 'business_manager' || userRole === 'both' || userRole === 'superadmin';

  const business = businesses.find((b) => b.id === businessId);
  const isCreator = business?.created_by === user?.id || isSuperadmin;

  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as 'members' | 'contacts' | 'omni-channel' | 'integrations') || 'members';
  const [activeTab, setActiveTab] = useState<'members' | 'contacts' | 'omni-channel' | 'integrations'>(initialTab);
  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteManager, setShowInviteManager] = useState(false);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);

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

  // Saat user switch bisnis via BusinessSwitcher, redirect ke detail bisnis yang baru
  useEffect(() => {
    if (activeBusiness && activeBusiness.id !== businessId) {
      router.replace(`/businesses/${activeBusiness.id}/members`);
    }
  }, [activeBusiness, businessId, router]);

  const handleLeaveBusiness = async () => {
    if (!user || !business) return;
    setLeaveLoading(true);
    try {
      await businessesApi.leaveBusiness(user.id, business.id);
      await refetch();
      // Switch active business if leaving the active one
      if (activeBusiness?.id === business.id) {
        const remaining = businesses.filter((b) => b.id !== business.id && !b.is_archived);
        if (remaining.length > 0) {
          setActiveBusiness(remaining[0].id);
        }
      }
      router.push('/businesses');
    } catch (err) {
      console.error('Failed to leave business:', err);
      alert('Gagal keluar dari bisnis. Silakan coba lagi.');
    } finally {
      setLeaveLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4 min-w-0">
          {/* Back button */}
          <button
            onClick={() => router.push('/businesses')}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
            title="Kembali ke Business"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          {business?.logo_url ? (
            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-white border border-gray-200 dark:border-gray-700">
              <Image src={business.logo_url} alt={business.business_name} width={48} height={48} className="w-full h-full object-cover" unoptimized />
            </div>
          ) : business ? (
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400">
              {BUSINESS_TYPE_ICONS[business.business_sector ?? ''] || <Building2 className="w-6 h-6" />}
            </div>
          ) : null}
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1 truncate">
              {business?.business_name || '—'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Kelola anggota dan halaman publik bisnis
            </p>
          </div>
        </div>

        {activeTab === 'members' && !isInvestor && (
          <button
            onClick={() => setShowInviteManager(true)}
            className="btn-primary flex items-center justify-center gap-2 flex-shrink-0 w-full sm:w-auto"
          >
            <UserPlus className="h-4 w-4" />
            Undang Anggota
          </button>
        )}
      </div>

      {/* Tab Switcher */}
      <Tabs<'members' | 'contacts' | 'omni-channel' | 'integrations'>
        value={activeTab}
        onChange={setActiveTab}
        scrollable
        className="mb-6"
        tabs={[
          {
            value: 'members',
            label: 'Anggota',
            icon: <Users className="w-4 h-4" />,
            badge: !loading ? (
              <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300 rounded-full text-xs">
                {members.length}
              </span>
            ) : undefined,
          },
          {
            value: 'contacts',
            label: 'Kontak',
            icon: <Contact className="w-4 h-4" />,
          },
          {
            value: 'omni-channel',
            label: 'Halaman Publik',
            icon: <Globe className="w-4 h-4" />,
            hidden: isInvestor,
          },
          {
            value: 'integrations',
            label: 'Integrasi',
            icon: <ShoppingBag className="w-4 h-4" />,
            hidden: isInvestor,
          },
        ]}
      />

      {/* Tab Content */}
      {activeTab === 'members' && (
        <div className="flex flex-col lg:flex-row items-stretch gap-6 lg:gap-8">
          <div className="max-w-2xl w-full">
            <MemberList members={members} loading={loading} />
          </div>
          {business && (
            <BusinessDetailCard
              business={business}
              onLeave={!isCreator ? () => setIsLeaveConfirmOpen(true) : undefined}
            />
          )}
        </div>
      )}
      {activeTab === 'contacts' && user && business && (
        <ContactList
          businessId={business.id}
          userId={user.id}
          canManage={canManage}
        />
      )}
      {activeTab === 'omni-channel' && user && business && (
        <OmniChannelManager
          businessId={business.id}
          businessName={business.business_name}
          userId={user.id}
        />
      )}
      {activeTab === 'integrations' && business && (
        <EcommerceIntegration
          businessId={business.id}
          canManage={canManage}
        />
      )}

      {/* Invite Code Manager Modal */}
      {showInviteManager && user && business && (
        <InviteCodeManager
          businessId={business.id}
          businessName={business.business_name}
          userId={user.id}
          onClose={() => setShowInviteManager(false)}
        />
      )}

      {/* Leave Business Confirm Modal */}
      <Modal
        isOpen={isLeaveConfirmOpen}
        onClose={() => setIsLeaveConfirmOpen(false)}
        title="Keluar dari Bisnis"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            Apakah Anda yakin ingin keluar dari bisnis{' '}
            <strong>{business?.business_name}</strong>?
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Anda tidak akan bisa mengakses data bisnis ini lagi. Untuk bergabung kembali, Anda memerlukan undangan baru dari pemilik bisnis.
          </p>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setIsLeaveConfirmOpen(false)}
              className="btn-secondary flex-1"
              disabled={leaveLoading}
            >
              Batal
            </button>
            <button
              onClick={handleLeaveBusiness}
              className="btn-danger flex-1"
              disabled={leaveLoading}
            >
              {leaveLoading ? 'Keluar...' : 'Keluar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
