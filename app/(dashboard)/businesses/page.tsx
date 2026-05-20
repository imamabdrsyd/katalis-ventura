'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useBusinessContext } from '@/context/BusinessContext';
import { Modal } from '@/components/ui/Modal';
import { AnimatedDialog } from '@/components/ui/AnimatedDialog';
import { BusinessCard } from '@/components/business/BusinessCard';
import { BusinessForm, type BusinessFormData } from '@/components/business/BusinessForm';
import { InviteCodeManager } from '@/components/business/InviteCodeManager';
import { PeriodLockManager } from '@/components/business/PeriodLockManager';
import { Building2, Archive, Lock } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { Tabs } from '@/components/ui/Tabs';
import * as businessesApi from '@/lib/api/businesses';
import { createClient } from '@/lib/supabase';
import { isManagerRole } from '@/lib/roles';
import type { Business } from '@/types';

type TabType = 'active' | 'archived';

export default function BusinessesPage() {
  const { user, userRole, isSuperadmin, activeBusiness, setActiveBusiness, refetch } =
    useBusinessContext();
  const { t } = useLanguage();
  const isInvestor = userRole === 'investor';
  const canManage = isManagerRole(userRole);

  // Get user's first name
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const firstName = userName.split(' ')[0];
  const [allBusinesses, setAllBusinesses] = useState<Business[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [archivingBusiness, setArchivingBusiness] = useState<Business | null>(null);
  const [hardDeletingBusiness, setHardDeletingBusiness] = useState<Business | null>(null);
  const [isHardDeleteConfirmOpen, setIsHardDeleteConfirmOpen] = useState(false);
  const [managingInviteBusiness, setManagingInviteBusiness] = useState<Business | null>(null);
  const [periodLockBusiness, setPeriodLockBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [capexByBusiness, setCapexByBusiness] = useState<Map<string, number>>(new Map());
  const [creatorNames, setCreatorNames] = useState<Map<string, string>>(new Map());

  const fetchBusinesses = useCallback(async () => {
    if (!user) return;
    setFetchLoading(true);
    try {
      const data = await businessesApi.getUserBusinesses(user.id, true);
      setAllBusinesses(data);

      // Business Capital di tiap card = capital_investment + total CAPEX.
      // Agregasi dilakukan via RPC supaya hanya 1 baris per bisnis yang dikirim,
      // bukan seluruh transaksi (sebelumnya bikin halaman lambat saat data banyak).
      // Sekalian batch ambil nama creator untuk semua bisnis — sebelumnya tiap
      // BusinessCard hit /api/users/profile sendiri (N+1).
      if (data.length > 0) {
        const supabase = createClient();
        const creatorIds = Array.from(
          new Set(data.map(b => b.created_by).filter((v): v is string => !!v))
        );

        const [capexResult, profilesResult] = await Promise.all([
          supabase.rpc('get_capex_by_business'),
          creatorIds.length > 0
            ? supabase.from('profiles').select('id, full_name').in('id', creatorIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (capexResult.error) throw capexResult.error;

        const totalCapexByBusiness = new Map<string, number>(
          (capexResult.data ?? []).map((row: { business_id: string; total_capex: number | string }) => [
            row.business_id,
            Number(row.total_capex) || 0,
          ])
        );
        const capexMap = new Map<string, number>();
        data.forEach(b => {
          capexMap.set(b.id, (b.capital_investment || 0) + (totalCapexByBusiness.get(b.id) || 0));
        });
        setCapexByBusiness(capexMap);

        const namesMap = new Map<string, string>();
        (profilesResult.data ?? []).forEach((p: { id: string; full_name: string | null }) => {
          namesMap.set(p.id, p.full_name || 'Unknown');
        });
        setCreatorNames(namesMap);
      }
    } catch (err) {
      console.error('Failed to fetch businesses:', err);
    } finally {
      setFetchLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  const activeBusinesses = allBusinesses.filter((b) => !b.is_archived);
  const archivedBusinesses = allBusinesses.filter((b) => b.is_archived);
  const displayedBusinesses = activeTab === 'active' ? activeBusinesses : archivedBusinesses;

  const uploadLogoFile = async (businessId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`/api/businesses/${businessId}/logo`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const json = await res.json();
      console.warn('Failed to upload logo:', json.error);
    }
  };

  const handleCreateBusiness = async (data: BusinessFormData) => {
    if (!user) return;
    setLoading(true);
    try {
      const { _logoFile, ...businessData } = data;
      const newBusiness = await businessesApi.createBusiness(businessData, user.id);

      // Upload logo if a file was selected
      if (_logoFile) {
        await uploadLogoFile(newBusiness.id, _logoFile);
      }

      await fetchBusinesses();
      await refetch();
      setActiveBusiness(newBusiness.id);
      setIsFormOpen(false);
    } catch (err: any) {
      console.error('Failed to create business:', err);
      const errorMessage = err?.message || err?.error?.message || JSON.stringify(err) || 'Unknown error';
      toast.error(`Gagal menambahkan bisnis: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBusiness = async (data: BusinessFormData) => {
    if (!editingBusiness || !user) return;
    setLoading(true);
    try {
      const { _logoFile, ...businessData } = data;
      await businessesApi.updateBusiness(editingBusiness.id, businessData, user.id);

      // Upload logo if a file was selected
      if (_logoFile) {
        await uploadLogoFile(editingBusiness.id, _logoFile);
      }

      await fetchBusinesses();
      await refetch();
      setEditingBusiness(null);
    } catch (err: any) {
      console.error('Failed to update business:', err);
      const errorMessage = err?.message || err?.error?.message || JSON.stringify(err) || 'Unknown error';
      toast.error(`Gagal mengupdate bisnis: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveBusiness = async () => {
    if (!archivingBusiness) return;
    setLoading(true);
    try {
      await businessesApi.archiveBusiness(archivingBusiness.id);
      await fetchBusinesses();
      await refetch();
      // If archived the active business, switch to another one
      if (activeBusiness?.id === archivingBusiness.id && activeBusinesses.length > 1) {
        const nextBusiness = activeBusinesses.find((b) => b.id !== archivingBusiness.id);
        if (nextBusiness) {
          setActiveBusiness(nextBusiness.id);
        }
      }
      setArchivingBusiness(null);
      setIsArchiveConfirmOpen(false);
    } catch (err) {
      console.error('Failed to archive business:', err);
    } finally {
      setLoading(false);
    }
  };

  const router = useRouter();

  const handleHardDeleteBusiness = async () => {
    if (!hardDeletingBusiness) return;
    setLoading(true);
    try {
      await businessesApi.hardDeleteBusiness(hardDeletingBusiness.id);
      if (activeBusiness?.id === hardDeletingBusiness.id) {
        const nextBusiness = activeBusinesses.find((b) => b.id !== hardDeletingBusiness.id);
        if (nextBusiness) {
          setActiveBusiness(nextBusiness.id);
        }
      }
      await fetchBusinesses();
      await refetch();
      setHardDeletingBusiness(null);
      setIsHardDeleteConfirmOpen(false);
    } catch (err: any) {
      console.error('Failed to hard delete business:', err);
      const errorMessage = err?.message || err?.error?.message || JSON.stringify(err) || 'Unknown error';
      toast.error(`Gagal menghapus bisnis: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBusiness = async (business: Business) => {
    setLoading(true);
    try {
      await businessesApi.restoreBusiness(business.id);
      await fetchBusinesses();
      await refetch();
    } catch (err) {
      console.error('Failed to restore business:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
            {isInvestor ? `${t.businesses.portfolio} ${firstName}` : t.businesses.manageBusiness}
          </h1>
          {/* <p className="text-gray-500 mt-1">
            {isInvestor ? `Bisnis yang di invest ${firstName}` : `Bisnis yang dikelola ${firstName}`}
          </p> */}
        </div>
        {canManage && (
          <button onClick={() => setIsFormOpen(true)} className="btn-primary">
            + {t.businesses.addBusiness}
          </button>
        )}
      </div>

      {/* Tabs */}
      <Tabs<TabType>
        variant="underline"
        className="mb-6"
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { value: 'active', label: `${t.businesses.activeBusiness} (${activeBusinesses.length})` },
          { value: 'archived', label: `${t.businesses.archivedBusiness} (${archivedBusinesses.length})` },
        ]}
      />

      {/* Business List */}
      {fetchLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">{t.businesses.loadingBusinesses}</p>
          </div>
        </div>
      ) : displayedBusinesses.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <div className="flex justify-center mb-4">
            {activeTab === 'active' ? <Building2 className="w-10 h-10 text-gray-400" /> : <Archive className="w-10 h-10 text-gray-400" />}
          </div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
            {activeTab === 'active' ? t.businesses.noActiveBusiness : t.businesses.noArchivedBusiness}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {activeTab === 'active'
              ? (isInvestor ? t.businesses.noBusinessJoined : t.businesses.startByAdding)
              : t.businesses.archivedAppearHere}
          </p>
          {activeTab === 'active' && canManage && (
            <button onClick={() => setIsFormOpen(true)} className="btn-primary">
              + {t.businesses.addBusiness}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedBusinesses.map((business) => (
            <BusinessCard
              key={business.id}
              business={business}
              totalCapex={capexByBusiness.get(business.id) || 0}
              creatorName={business.created_by ? creatorNames.get(business.created_by) : undefined}
              isActive={activeBusiness?.id === business.id}
              onSelect={() => {
                if (!business.is_archived) {
                  setActiveBusiness(business.id);
                }
              }}
              onDoubleClick={() => {
                if (!business.is_archived) {
                  router.push(`/businesses/${business.id}/config`);
                }
              }}
              onEdit={(canManage && (isSuperadmin || business.created_by === user?.id)) ? () => setEditingBusiness(business) : undefined}
              onArchive={(canManage && (isSuperadmin || business.created_by === user?.id)) ? () => {
                setArchivingBusiness(business);
                setIsArchiveConfirmOpen(true);
              } : undefined}
              onRestore={(canManage && (isSuperadmin || business.created_by === user?.id)) ? () => handleRestoreBusiness(business) : undefined}
              onHardDelete={(isSuperadmin && business.is_archived) ? () => {
                setHardDeletingBusiness(business);
                setIsHardDeleteConfirmOpen(true);
              } : undefined}
              onInvite={canManage ? () => setManagingInviteBusiness(business) : undefined}
              onPeriodLock={(canManage && (isSuperadmin || business.created_by === user?.id)) ? () => setPeriodLockBusiness(business) : undefined}
              showActions={canManage}
            />
          ))}
        </div>
      )}

      {/* Invite Code Manager Modal */}
      {managingInviteBusiness && user && (
        <InviteCodeManager
          businessId={managingInviteBusiness.id}
          businessName={managingInviteBusiness.business_name}
          userId={user.id}
          onClose={() => setManagingInviteBusiness(null)}
        />
      )}

      {/* Period Lock Manager Modal */}
      {periodLockBusiness && (
        <Modal
          isOpen={!!periodLockBusiness}
          onClose={() => setPeriodLockBusiness(null)}
          title={<span className="flex items-center gap-2"><Lock className="w-5 h-5 text-amber-500" />{t.businesses.periodLock}</span>}
        >
          <PeriodLockManager
            business={periodLockBusiness}
            onClose={() => setPeriodLockBusiness(null)}
            onUpdated={(updated) => {
              setAllBusinesses((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
              setPeriodLockBusiness(null);
            }}
          />
        </Modal>
      )}

      {/* Add Business Modal */}
      <AnimatedDialog isOpen={isFormOpen} onClose={() => setIsFormOpen(false)}>
        <BusinessForm
          onSubmit={handleCreateBusiness}
          onCancel={() => setIsFormOpen(false)}
          loading={loading}
        />
      </AnimatedDialog>

      {/* Edit Business Modal */}
      <AnimatedDialog isOpen={!!editingBusiness} onClose={() => setEditingBusiness(null)}>
        {editingBusiness && (
          <BusinessForm
            business={editingBusiness}
            onSubmit={handleUpdateBusiness}
            onCancel={() => setEditingBusiness(null)}
            loading={loading}
          />
        )}
      </AnimatedDialog>

      {/* Archive Confirm Modal */}
      <Modal
        isOpen={isArchiveConfirmOpen}
        onClose={() => {
          setIsArchiveConfirmOpen(false);
          setArchivingBusiness(null);
        }}
        title={t.businesses.archiveBusiness}
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            {t.businesses.archiveConfirm.replace('{name}', archivingBusiness?.business_name || '')}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t.businesses.archiveHint}
          </p>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setIsArchiveConfirmOpen(false);
                setArchivingBusiness(null);
              }}
              className="btn-secondary flex-1"
              disabled={loading}
            >
              {t.common.cancel}
            </button>
            <button
              onClick={handleArchiveBusiness}
              className="btn-danger flex-1"
              disabled={loading}
            >
              {loading ? t.businesses.archiving : t.businesses.archive}
            </button>
          </div>
        </div>
      </Modal>

      {/* Hard Delete Confirm Modal (superadmin only) */}
      <Modal
        isOpen={isHardDeleteConfirmOpen}
        onClose={() => {
          setIsHardDeleteConfirmOpen(false);
          setHardDeletingBusiness(null);
        }}
        title={t.businesses.hardDeleteBusiness}
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            {t.businesses.hardDeleteConfirm.replace('{name}', hardDeletingBusiness?.business_name || '')}
          </p>
          <p className="text-sm text-red-600 dark:text-red-400">
            {t.businesses.hardDeleteHint}
          </p>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setIsHardDeleteConfirmOpen(false);
                setHardDeletingBusiness(null);
              }}
              className="btn-secondary flex-1"
              disabled={loading}
            >
              {t.common.cancel}
            </button>
            <button
              onClick={handleHardDeleteBusiness}
              className="btn-danger flex-1"
              disabled={loading}
            >
              {loading ? t.businesses.hardDeleting : t.businesses.hardDelete}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
