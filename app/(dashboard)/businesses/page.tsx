'use client';

import { useState, useEffect, useCallback } from 'react';
import { useBusinessContext } from '@/context/BusinessContext';
import { Modal } from '@/components/ui/Modal';
import { BusinessCard } from '@/components/business/BusinessCard';
import { BusinessForm, type BusinessFormData } from '@/components/business/BusinessForm';
import { InviteCodeManager } from '@/components/business/InviteCodeManager';
import * as businessesApi from '@/lib/api/businesses';
import type { Business } from '@/types';

type TabType = 'active' | 'archived';

export default function BusinessesPage() {
  const { user, userRole, businesses: contextBusinesses, activeBusiness, setActiveBusiness, refetch } =
    useBusinessContext();
  const isInvestor = userRole === 'investor';

  // Get user's first name
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const firstName = userName.split(' ')[0];
  const [allBusinesses, setAllBusinesses] = useState<Business[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [archivingBusiness, setArchivingBusiness] = useState<Business | null>(null);
  const [managingInviteBusiness, setManagingInviteBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);

  const fetchBusinesses = useCallback(async () => {
    if (!user) return;
    setFetchLoading(true);
    try {
      const data = await businessesApi.getUserBusinesses(user.id, true);
      setAllBusinesses(data);
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

  const handleCreateBusiness = async (data: BusinessFormData) => {
    if (!user) return;
    setLoading(true);
    try {
      const newBusiness = await businessesApi.createBusiness(data, user.id);
      await fetchBusinesses();
      await refetch();
      setActiveBusiness(newBusiness.id);
      setIsFormOpen(false);
    } catch (err) {
      console.error('Failed to create business:', err);
      alert(`Gagal menambahkan bisnis: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBusiness = async (data: BusinessFormData) => {
    if (!editingBusiness) return;
    setLoading(true);
    try {
      await businessesApi.updateBusiness(editingBusiness.id, data);
      await fetchBusinesses();
      await refetch();
      setEditingBusiness(null);
    } catch (err) {
      console.error('Failed to update business:', err);
      alert(`Gagal mengupdate bisnis: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
            {isInvestor ? `Portfolio ${firstName}` : 'Manage Business'}
          </h1>
          {/* <p className="text-gray-500 mt-1">
            {isInvestor ? `Bisnis yang di invest ${firstName}` : `Bisnis yang dikelola ${firstName}`}
          </p> */}
        </div>
        {!isInvestor && (
          <button onClick={() => setIsFormOpen(true)} className="btn-primary">
            + Tambah Bisnis
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'active'
              ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          Aktif ({activeBusinesses.length})
        </button>
        <button
          onClick={() => setActiveTab('archived')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'archived'
              ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          Diarsipkan ({archivedBusinesses.length})
        </button>
      </div>

      {/* Business List */}
      {fetchLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">Memuat data bisnis...</p>
          </div>
        </div>
      ) : displayedBusinesses.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <div className="text-4xl mb-4">
            {activeTab === 'active' ? '🏢' : '📦'}
          </div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
            {activeTab === 'active' ? 'Belum ada bisnis aktif' : 'Tidak ada bisnis diarsipkan'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {activeTab === 'active'
              ? (isInvestor ? 'Anda belum bergabung dengan bisnis manapun' : 'Mulai dengan menambahkan bisnis pertama Anda')
              : 'Bisnis yang diarsipkan akan muncul di sini'}
          </p>
          {activeTab === 'active' && !isInvestor && (
            <button onClick={() => setIsFormOpen(true)} className="btn-primary">
              + Tambah Bisnis
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedBusinesses.map((business) => (
            <BusinessCard
              key={business.id}
              business={business}
              isActive={activeBusiness?.id === business.id}
              onSelect={() => {
                if (!business.is_archived) {
                  setActiveBusiness(business.id);
                }
              }}
              onEdit={isInvestor ? undefined : () => setEditingBusiness(business)}
              onArchive={isInvestor ? undefined : () => {
                setArchivingBusiness(business);
                setIsArchiveConfirmOpen(true);
              }}
              onRestore={isInvestor ? undefined : () => handleRestoreBusiness(business)}
              onInvite={isInvestor ? undefined : () => setManagingInviteBusiness(business)}
              showActions={!isInvestor}
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

      {/* Add Business Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Tambah Bisnis Baru"
      >
        <BusinessForm
          onSubmit={handleCreateBusiness}
          onCancel={() => setIsFormOpen(false)}
          loading={loading}
        />
      </Modal>

      {/* Edit Business Modal */}
      <Modal
        isOpen={!!editingBusiness}
        onClose={() => setEditingBusiness(null)}
        title="Edit Bisnis"
      >
        <BusinessForm
          business={editingBusiness}
          onSubmit={handleUpdateBusiness}
          onCancel={() => setEditingBusiness(null)}
          loading={loading}
        />
      </Modal>

      {/* Archive Confirm Modal */}
      <Modal
        isOpen={isArchiveConfirmOpen}
        onClose={() => {
          setIsArchiveConfirmOpen(false);
          setArchivingBusiness(null);
        }}
        title="Arsipkan Bisnis"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            Apakah Anda yakin ingin mengarsipkan bisnis{' '}
            <strong>{archivingBusiness?.business_name}</strong>?
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Bisnis yang diarsipkan masih dapat diakses dan di-restore kembali kapan saja. Data
            transaksi tidak akan dihapus.
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
              Batal
            </button>
            <button
              onClick={handleArchiveBusiness}
              className="btn-danger flex-1"
              disabled={loading}
            >
              {loading ? 'Mengarsipkan...' : 'Arsipkan'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
