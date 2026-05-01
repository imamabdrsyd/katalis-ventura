'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Clock, CheckCircle, XCircle, X } from 'lucide-react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase';
import * as businessesApi from '@/lib/api/businesses';
import * as inviteCodesApi from '@/lib/api/inviteCodes';
import * as joinRequestsApi from '@/lib/api/joinRequests';
import { formatCurrency } from '@/lib/utils';
import type { Business } from '@/types';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';

type RequestStatus = 'pending' | 'approved' | 'rejected' | null;

interface BusinessWithRequest extends Business {
  requestId?: string;
  requestStatus?: RequestStatus;
}

export default function JoinBusinessPage() {
  const [joinMode, setJoinMode] = useState<'list' | 'code'>('code');
  const [businesses, setBusinesses] = useState<BusinessWithRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessWithRequest | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/login'); return; }
        setUserId(user.id);
        setIsCheckingAuth(false);
      } catch {
        router.push('/login');
      }
    };
    checkAuth();
  }, [router, supabase]);

  const fetchBusinesses = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [data, myRequests] = await Promise.all([
        businessesApi.getAvailableBusinesses(userId),
        joinRequestsApi.getMyJoinRequests(),
      ]);

      const requestMap = new Map(myRequests.map((r) => [r.business_id, r]));
      const enriched: BusinessWithRequest[] = data.map((b) => {
        const req = requestMap.get(b.id);
        return { ...b, requestId: req?.id, requestStatus: req?.status ?? null };
      });
      setBusinesses(enriched);
    } catch {
      setError('Gagal memuat daftar bisnis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isCheckingAuth && userId) fetchBusinesses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCheckingAuth, userId]);

  // Realtime: dengarkan perubahan status request user → update badge / redirect saat approved
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`my-join-requests-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'business_join_requests',
          filter: `requester_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as { business_id: string; status: 'pending' | 'approved' | 'rejected' };
          if (updated.status === 'approved') {
            setSuccess('Permintaan Anda telah disetujui! Mengarahkan ke dashboard...');
            setTimeout(() => router.push('/dashboard'), 1500);
            return;
          }
          setBusinesses((prev) =>
            prev.map((b) =>
              b.id === updated.business_id ? { ...b, requestStatus: updated.status } : b
            )
          );
          if (updated.status === 'rejected') {
            setError('Permintaan bergabung Anda ditolak oleh pemilik bisnis.');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, router]);

  const filteredBusinesses = businesses.filter((b) =>
    b.business_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRequestJoin = async () => {
    if (!selectedBusiness || !userId) return;
    setJoining(true);
    setError(null);

    try {
      const newRequest = await joinRequestsApi.submitJoinRequest(selectedBusiness.id, userId);
      setBusinesses((prev) =>
        prev.map((b) =>
          b.id === selectedBusiness.id ? { ...b, requestId: newRequest.id, requestStatus: 'pending' } : b
        )
      );
      setSuccess(`Permintaan bergabung ke "${selectedBusiness.business_name}" telah dikirim. Tunggu persetujuan dari pemilik bisnis.`);
      setSelectedBusiness(null);
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim permintaan bergabung');
    } finally {
      setJoining(false);
    }
  };

  const handleCancelRequest = async (business: BusinessWithRequest) => {
    if (!business.requestId) return;
    try {
      await joinRequestsApi.cancelJoinRequest(business.requestId);
      setBusinesses((prev) =>
        prev.map((b) =>
          b.id === business.id ? { ...b, requestId: undefined, requestStatus: null } : b
        )
      );
      if (selectedBusiness?.id === business.id) setSelectedBusiness(null);
    } catch {
      setError('Gagal membatalkan permintaan');
    }
  };

  const handleJoinWithCode = async () => {
    if (!inviteCode.trim() || !userId) return;
    setJoining(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await inviteCodesApi.useInviteCode(inviteCode.toUpperCase(), userId);
      if (result.success) {
        setSuccess('Berhasil bergabung dengan bisnis!');
        setTimeout(() => router.push('/dashboard'), 1500);
      } else {
        setError(result.message || 'Gagal menggunakan kode undangan');
      }
    } catch (err: any) {
      setError(err.message || 'Gagal menggunakan kode undangan');
    } finally {
      setJoining(false);
    }
  };

  const getRequestBadge = (status: RequestStatus) => {
    if (status === 'pending') return (
      <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
        <Clock className="w-3 h-3" /> Menunggu
      </span>
    );
    if (status === 'approved') return (
      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
        <CheckCircle className="w-3 h-3" /> Disetujui
      </span>
    );
    if (status === 'rejected') return (
      <span className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
        <XCircle className="w-3 h-3" /> Ditolak
      </span>
    );
    return null;
  };

  const canRequest = selectedBusiness && !selectedBusiness.requestStatus;

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Memeriksa autentikasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl mx-auto mb-4 flex items-center justify-center text-white">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Bergabung dengan Bisnis</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
            Gunakan kode undangan atau pilih dari daftar bisnis
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="mb-6">
          <SegmentedToggle
            value={joinMode}
            onChange={(mode) => { setJoinMode(mode); setError(null); setSuccess(null); setSelectedBusiness(null); }}
            fullWidth
            ariaLabel="Metode bergabung"
            options={[
              { value: 'code', label: 'Gunakan Kode' },
              { value: 'list', label: 'Pilih dari Daftar' },
            ]}
          />
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl">
            <p className="text-sm text-green-700 dark:text-green-400">{success}</p>
          </div>
        )}

        {/* Invite Code Mode */}
        {joinMode === 'code' && (
          <div>
            <div className="mb-6">
              <label className="label">Masukkan Kode Undangan</label>
              <input
                type="text"
                placeholder="Contoh: ABC12345"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="input text-center text-lg tracking-widest font-mono"
                maxLength={8}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                Masukkan kode 8 karakter yang Anda terima dari business manager
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => router.back()} className="btn-secondary flex-1 py-3" disabled={joining}>
                Kembali
              </button>
              <button
                onClick={handleJoinWithCode}
                className="btn-primary flex-1 py-3"
                disabled={!inviteCode.trim() || inviteCode.length !== 8 || joining}
              >
                {joining ? 'Bergabung...' : 'Bergabung'}
              </button>
            </div>
          </div>
        )}

        {/* Business List Mode */}
        {joinMode === 'list' && (
          <>
            {/* Search */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Cari bisnis..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input"
              />
            </div>

            {/* Business List */}
            {loading ? (
              <div className="text-center py-8">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">Memuat daftar bisnis...</p>
              </div>
            ) : filteredBusinesses.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className="flex justify-center mb-3"><Building2 className="w-10 h-10 text-gray-400" /></div>
                <p className="text-gray-600 dark:text-gray-400">
                  {searchQuery ? 'Tidak ada bisnis yang cocok' : 'Belum ada bisnis tersedia'}
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto mb-6">
                {filteredBusinesses.map((business) => {
                  const isSelected = selectedBusiness?.id === business.id;
                  const hasRequest = !!business.requestStatus;

                  return (
                    <div
                      key={business.id}
                      role={hasRequest ? undefined : 'button'}
                      tabIndex={hasRequest ? -1 : 0}
                      onClick={() => !hasRequest && setSelectedBusiness(isSelected ? null : business)}
                      onKeyDown={(e) => {
                        if (!hasRequest && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          setSelectedBusiness(isSelected ? null : business);
                        }
                      }}
                      className={`w-full p-4 border-2 rounded-xl text-left transition-all ${
                        hasRequest
                          ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-80'
                          : isSelected
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 cursor-pointer'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden ${
                          business.logo_url ? '' : isSelected ? 'bg-indigo-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        }`}>
                          {business.logo_url ? (
                            <Image
                              src={business.logo_url}
                              alt={business.business_name}
                              width={40}
                              height={40}
                              className="w-full h-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <Building2 className="w-5 h-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-800 dark:text-gray-100 truncate">
                            {business.business_name}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Modal: {formatCurrency(business.capital_investment)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {getRequestBadge(business.requestStatus ?? null)}
                          {business.requestStatus === 'pending' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCancelRequest(business); }}
                              className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                              title="Batalkan permintaan"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isSelected && !hasRequest && (
                            <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={() => router.back()} className="btn-secondary flex-1 py-3" disabled={joining}>
                Kembali
              </button>
              <button
                onClick={handleRequestJoin}
                className="btn-primary flex-1 py-3"
                disabled={!canRequest || joining}
              >
                {joining ? 'Mengirim...' : 'Kirim Permintaan'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
