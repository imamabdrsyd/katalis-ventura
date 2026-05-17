'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useBusinessContext } from '@/context/BusinessContext';
import { MemberList } from '@/components/business/MemberList';
import { InviteCodeManager } from '@/components/business/InviteCodeManager';
import { JoinRequestList } from '@/components/business/JoinRequestList';
import { getBusinessMembers, type BusinessMember } from '@/lib/api/members';
import Image from 'next/image';
import { ArrowLeft, UserPlus, Users, Globe, MapPin, Building2, Palette, Heart, Wheat, UtensilsCrossed, Coins, Home, Banknote, LogOut, ShoppingBag, Contact, CalendarDays, Rocket, Pencil, Check, X, Info } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { OmniChannelManager } from '@/components/business/OmniChannelManager';
import * as businessesApi from '@/lib/api/businesses';
import { EcommerceIntegration } from '@/components/ecommerce/EcommerceIntegration';
import { ContactList } from '@/components/business/ContactList';
import { isManagerRole } from '@/lib/roles';
import type { Business } from '@/types';

const BUSINESS_SECTOR_LABELS: Record<string, string> = {
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

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  jasa: 'Jasa',
  produk: 'Produk',
  dagang: 'Dagang',
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

function BusinessDetailCard({
  business,
  canManage,
  onLeave,
  onBusinessUpdated,
}: {
  business: Business;
  canManage: boolean;
  onLeave?: () => void;
  onBusinessUpdated?: (updated: Business) => void;
}) {
  const icon = BUSINESS_TYPE_ICONS[business.business_sector ?? ''] || <Building2 className="w-6 h-6" />;
  const sectorLabel = BUSINESS_SECTOR_LABELS[business.business_sector ?? ''] || business.business_sector;
  const typeLabel = business.business_type ? BUSINESS_TYPE_LABELS[business.business_type] : null;

  const [isEditingOpStart, setIsEditingOpStart] = useState(false);
  const [opStartDraft, setOpStartDraft] = useState(business.operations_start_date ?? '');
  const [savingOpStart, setSavingOpStart] = useState(false);
  const [opStartError, setOpStartError] = useState<string | null>(null);

  const opStartDate = business.operations_start_date;

  const formatDateID = (iso: string) =>
    new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const saveOpStart = async (value: string | null) => {
    setSavingOpStart(true);
    setOpStartError(null);
    try {
      const updated = await businessesApi.updateBusiness(business.id, {
        operations_start_date: value,
      });
      onBusinessUpdated?.(updated);
      setIsEditingOpStart(false);
    } catch (err: any) {
      setOpStartError(err?.message || 'Gagal menyimpan');
    } finally {
      setSavingOpStart(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 flex-1 self-stretch">
      {/* Business icon/logo */}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden mb-4 ${business.logo_url ? 'bg-white' : 'text-indigo-500 dark:text-indigo-400'}`}>
        {business.logo_url ? (
          <Image src={business.logo_url} alt={business.business_name} width={48} height={48} className={`w-full h-full ${business.logo_fit === 'contain' ? 'object-contain p-0.5' : 'object-cover'}`} unoptimized />
        ) : (
          icon
        )}
      </div>

      {/* Business name */}
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
        {business.business_name}
      </h2>

      {/* Badges: sector + type */}
      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        {sectorLabel && (
          <span className="badge bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {sectorLabel}
          </span>
        )}
        {typeLabel && (
          <span className="badge bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {typeLabel}
          </span>
        )}
      </div>

      <div className="space-y-3">
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
        {(business.city || business.property_address) && (
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Lokasi</p>
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">
                {business.city || business.property_address}
              </p>
            </div>
          </div>
        )}

        {/* Created at */}
        {business.created_at && (
          <div className="flex items-start gap-3">
            <CalendarDays className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Dibuat</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">
                {formatDateID(business.created_at)}
              </p>
            </div>
          </div>
        )}

        {/* Operations start date */}
        <div className="flex items-start gap-3">
          <Rocket className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Mulai Beroperasi</p>
              {canManage && !isEditingOpStart && (
                <button
                  type="button"
                  onClick={() => {
                    setOpStartDraft(opStartDate ?? '');
                    setOpStartError(null);
                    setIsEditingOpStart(true);
                  }}
                  className="text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                  title={opStartDate ? 'Ubah tanggal mulai operasi' : 'Set tanggal mulai operasi'}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {isEditingOpStart ? (
              <div className="mt-1.5 space-y-2">
                <input
                  type="date"
                  value={opStartDraft}
                  onChange={(e) => setOpStartDraft(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400 leading-snug">
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>Jika di-set, ROI di dashboard dihitung sejak tanggal ini (operating ROI). Jika kosong, dihitung sejak transaksi pertama (holding period return).</span>
                </p>
                {opStartError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{opStartError}</p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => saveOpStart(opStartDraft || null)}
                    disabled={savingOpStart}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {savingOpStart ? 'Menyimpan...' : 'Simpan'}
                  </button>
                  {opStartDate && (
                    <button
                      type="button"
                      onClick={() => saveOpStart(null)}
                      disabled={savingOpStart}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      Hapus
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingOpStart(false);
                      setOpStartError(null);
                    }}
                    disabled={savingOpStart}
                    className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <X className="w-3.5 h-3.5" />
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-800 dark:text-gray-200">
                {opStartDate ? (
                  formatDateID(opStartDate)
                ) : (
                  <span className="italic text-gray-400 dark:text-gray-500">
                    Belum di-set
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
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
  const canManage = isManagerRole(userRole);

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
      router.replace(`/businesses/${activeBusiness.id}/config`);
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
              <Image src={business.logo_url} alt={business.business_name} width={48} height={48} className={`w-full h-full ${business.logo_fit === 'contain' ? 'object-contain p-0.5' : 'object-cover'}`} unoptimized />
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
              Kelola dan konfigurasi bisnis kamu
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
            label: 'Omnichannel',
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
          <div className="max-w-2xl w-full space-y-8">
            <MemberList 
              members={members} 
              loading={loading}
              businessId={business?.id}
              isCreator={isCreator}
              onMemberRemoved={fetchMembers}
            />

            {/* Join Requests — hanya tampil untuk creator/superadmin */}
            {isCreator && user && business && (
              <div>
                <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
                  Permintaan Bergabung
                </h2>
                <JoinRequestList
                  businessId={business.id}
                  reviewerId={user.id}
                  onApproved={fetchMembers}
                />
              </div>
            )}
          </div>
          {business && (
            <BusinessDetailCard
              business={business}
              canManage={canManage}
              onLeave={!isCreator ? () => setIsLeaveConfirmOpen(true) : undefined}
              onBusinessUpdated={() => { refetch(); }}
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
          business={business}
          userId={user.id}
          onBusinessUpdated={() => { refetch(); }}
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
