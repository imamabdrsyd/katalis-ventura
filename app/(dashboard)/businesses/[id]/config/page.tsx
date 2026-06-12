'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useBusinessContext } from '@/context/BusinessContext';
import { MemberList } from '@/components/business/MemberList';
import { InviteCodeManager } from '@/components/business/InviteCodeManager';
import { JoinRequestList } from '@/components/business/JoinRequestList';
import { getBusinessMembers, type BusinessMember } from '@/lib/api/members';
import Image from 'next/image';
import { ArrowLeft, UserPlus, Users, Globe, MapPin, Building2, Palette, Heart, Wheat, UtensilsCrossed, Coins, Home, Banknote, LogOut, Blocks, Contact, CalendarDays, Rocket, Pencil, Check, X, Info, FileText, Landmark, MapPinned, MoreVertical } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { OmniChannelManager } from '@/components/business/OmniChannelManager';
import * as businessesApi from '@/lib/api/businesses';
import { EcommerceIntegration } from '@/components/ecommerce/EcommerceIntegration';
import { ChannelIntegration } from '@/components/integrations/ChannelIntegration';
import { ContactList } from '@/components/business/ContactList';
import { useLanguage } from '@/context/LanguageContext';
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

const LEGAL_ENTITY_TYPES: { value: string; label: string }[] = [
  { value: 'PT', label: 'PT (Perseroan Terbatas)' },
  { value: 'PT Perorangan', label: 'PT Perorangan' },
  { value: 'CV', label: 'CV (Persekutuan Komanditer)' },
  { value: 'UD', label: 'UD (Usaha Dagang)' },
  { value: 'Firma', label: 'Firma' },
  { value: 'Koperasi', label: 'Koperasi' },
  { value: 'Yayasan', label: 'Yayasan' },
  { value: 'Perorangan', label: 'Perorangan / Individu' },
];

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

function InlineEditableField({
  icon,
  label,
  value,
  displayValue,
  emptyText = 'Belum di-set',
  canEdit,
  inputType = 'text',
  options,
  helper,
  allowClear = false,
  onSave,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  displayValue?: React.ReactNode;
  emptyText?: string;
  canEdit: boolean;
  inputType?: 'text' | 'textarea' | 'date' | 'select';
  options?: { value: string; label: string }[];
  helper?: React.ReactNode;
  allowClear?: boolean;
  onSave: (value: string | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-close editor saat parent keluar dari edit mode
  useEffect(() => {
    if (!canEdit && editing) {
      setEditing(false);
      setError(null);
    }
  }, [canEdit, editing]);

  // Sembunyikan field kosong saat view mode — tampil lagi di edit mode
  if (!value && !canEdit) {
    return null;
  }

  const startEdit = () => {
    setDraft(value ?? '');
    setError(null);
    setEditing(true);
  };

  const submit = async (val: string | null) => {
    setSaving(true);
    setError(null);
    try {
      await onSave(val);
      setEditing(false);
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-start gap-3">
      <div className="text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          {canEdit && !editing && (
            <button
              type="button"
              onClick={startEdit}
              className="text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
              title={value ? `Ubah ${label}` : `Isi ${label}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {editing ? (
          <div className="mt-1.5 space-y-2">
            {inputType === 'text' && (
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
                className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
            {inputType === 'date' && (
              <input
                type="date"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
            {inputType === 'textarea' && (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                autoFocus
                className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            )}
            {inputType === 'select' && (
              <select
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
                className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Pilih —</option>
                {options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
            {helper}
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => submit(draft.trim() ? draft.trim() : null)}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
              {allowClear && value && (
                <button
                  type="button"
                  onClick={() => submit(null)}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Hapus
                </button>
              )}
              <button
                type="button"
                onClick={() => { setEditing(false); setError(null); }}
                disabled={saving}
                className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="w-3.5 h-3.5" />
                Batal
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-800 dark:text-gray-200 leading-snug">
            {value ? (
              displayValue ?? value
            ) : (
              <span className="italic text-gray-400 dark:text-gray-500">{emptyText}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

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

  const [editMode, setEditMode] = useState(false);
  const [kebabOpen, setKebabOpen] = useState(false);
  const kebabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!kebabOpen) return;
    function handler(e: MouseEvent) {
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) {
        setKebabOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [kebabOpen]);

  const formatDateID = (iso: string) =>
    new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const saveField = async (patch: Partial<Business>) => {
    const updated = await businessesApi.updateBusiness(business.id, patch);
    onBusinessUpdated?.(updated);
  };

  const entityLabel = business.legal_entity_type
    ? LEGAL_ENTITY_TYPES.find((t) => t.value === business.legal_entity_type)?.label ?? business.legal_entity_type
    : null;

  const fieldEditable = editMode && canManage;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl border p-6 w-full lg:flex-1 self-start transition-colors ${
      editMode ? 'border-indigo-200 dark:border-indigo-800/60 ring-1 ring-inset ring-indigo-500/10' : 'border-gray-200 dark:border-gray-700'
    }`}>
      {/* Header row: business identity + logo/actions */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0 pt-0.5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight break-words">
            {business.business_name}
          </h2>
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
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
        </div>

        <div className="flex items-start gap-2 flex-shrink-0">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden ${business.logo_url ? 'bg-white' : 'text-indigo-500 dark:text-indigo-400'}`}>
            {business.logo_url ? (
              <Image src={business.logo_url} alt={business.business_name} width={48} height={48} className={`w-full h-full ${business.logo_fit === 'contain' ? 'object-contain p-0.5' : 'object-cover'}`} unoptimized />
            ) : (
              icon
            )}
          </div>

          {canManage && (editMode ? (
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Selesai
            </button>
          ) : (
            <div ref={kebabRef} className="relative">
              <button
                type="button"
                onClick={() => setKebabOpen((v) => !v)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Opsi"
                aria-label="Opsi card detail bisnis"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {kebabOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-30 py-1 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { setKebabOpen(false); setEditMode(true); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <Pencil className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    Edit informasi
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Section: Identitas Legal — hide entirely jika kosong di view mode */}
      {(fieldEditable || business.legal_name || business.legal_entity_type) && (
        <section className="mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
            Identitas Legal
          </p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-6 gap-y-4">
            <InlineEditableField
              icon={<FileText className="w-4 h-4" />}
              label="Nama Legal"
              value={business.legal_name}
              canEdit={fieldEditable}
              inputType="text"
              onSave={(v) => saveField({ legal_name: v })}
            />
            <InlineEditableField
              icon={<Landmark className="w-4 h-4" />}
              label="Bentuk Badan Usaha"
              value={business.legal_entity_type}
              displayValue={entityLabel}
              canEdit={fieldEditable}
              inputType="select"
              options={LEGAL_ENTITY_TYPES}
              onSave={(v) => saveField({ legal_entity_type: v })}
            />
          </div>
        </section>
      )}

      {/* Section: Keuangan & Lokasi */}
      <section className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
          Keuangan & Lokasi
        </p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-6 gap-y-4">
          <div className="flex items-start gap-3">
            <Banknote className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400">Modal Bisnis</p>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {formatCurrency(business.capital_investment)}
              </p>
            </div>
          </div>

          {(business.city || business.property_address) && (
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400">Lokasi Operasional</p>
                <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug truncate">
                  {business.city || business.property_address}
                </p>
              </div>
            </div>
          )}

          <div className="col-span-full">
            <InlineEditableField
              icon={<MapPinned className="w-4 h-4" />}
              label="Alamat Terdaftar"
              value={business.registered_address}
              canEdit={fieldEditable}
              inputType="textarea"
              onSave={(v) => saveField({ registered_address: v })}
            />
          </div>
        </div>
      </section>

      {/* Section: Timeline */}
      <section>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
          Timeline
        </p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-6 gap-y-4">
          {business.created_at && (
            <div className="flex items-start gap-3">
              <CalendarDays className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400">Dibuat</p>
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  {formatDateID(business.created_at)}
                </p>
              </div>
            </div>
          )}

          <InlineEditableField
            icon={<Rocket className="w-4 h-4" />}
            label="Mulai Beroperasi"
            value={business.operations_start_date}
            displayValue={business.operations_start_date ? formatDateID(business.operations_start_date) : undefined}
            canEdit={fieldEditable}
            inputType="date"
            allowClear
            helper={
              <p className="flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400 leading-snug">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>Jika di-set, ROI di dashboard dihitung sejak tanggal ini (operating ROI). Jika kosong, dihitung sejak transaksi pertama (holding period return).</span>
              </p>
            }
            onSave={(v) => saveField({ operations_start_date: v })}
          />
        </div>
      </section>

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

  const { t } = useLanguage();
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
      toast.error('Gagal keluar dari bisnis. Silakan coba lagi.');
    } finally {
      setLeaveLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8">
      {/* Header row: back + tabs + CTA */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push('/businesses')}
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
          title="Kembali ke Business"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <Tabs<'members' | 'contacts' | 'omni-channel' | 'integrations'>
          value={activeTab}
          onChange={setActiveTab}
          scrollable
          className="flex-1 min-w-0"
          tabs={[
            {
              value: 'members',
              label: t.businessConfig.tabMembers,
              icon: <Users className="w-4 h-4" />,
              badge: !loading ? (
                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300 rounded-full text-xs">
                  {members.length}
                </span>
              ) : undefined,
            },
            {
              value: 'contacts',
              label: t.businessConfig.tabContacts,
              icon: <Contact className="w-4 h-4" />,
            },
            {
              value: 'omni-channel',
              label: t.businessConfig.tabOmnichannel,
              icon: <Globe className="w-4 h-4" />,
              hidden: isInvestor,
            },
            {
              value: 'integrations',
              label: t.businessConfig.tabIntegrations,
              icon: <Blocks className="w-4 h-4" />,
              hidden: isInvestor,
            },
          ]}
        />

        {activeTab === 'members' && !isInvestor && (
          <button
            onClick={() => setShowInviteManager(true)}
            className="btn-primary-glow flex items-center justify-center gap-2 flex-shrink-0"
          >
            <UserPlus className="h-4 w-4" />
            {t.businessConfig.inviteMember}
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'members' && (
        <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-8">
          <div className="w-full lg:max-w-2xl min-w-0 space-y-8">
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
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-7 w-1 rounded-full bg-gradient-to-b from-indigo-400 to-indigo-600" />
                  <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                    Permintaan Bergabung
                  </h2>
                </div>
                <JoinRequestList
                  businessId={business.id}
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
        <div className="space-y-10">
          <ChannelIntegration
            businessId={business.id}
            canManage={canManage}
          />
          <EcommerceIntegration
            businessId={business.id}
            canManage={canManage}
          />
        </div>
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
