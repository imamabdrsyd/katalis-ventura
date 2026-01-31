'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import * as businessesApi from '@/lib/api/businesses';
import * as inviteCodesApi from '@/lib/api/inviteCodes';
import { formatCurrency } from '@/lib/utils';
import type { Business } from '@/types';

export default function JoinBusinessPage() {
  const [joinMode, setJoinMode] = useState<'list' | 'code'>('code');
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login');
          return;
        }

        setUserId(user.id);
        setIsCheckingAuth(false);
      } catch (err) {
        console.error('Auth check error:', err);
        router.push('/login');
      }
    };

    checkAuth();
  }, [router, supabase]);

  // Fetch available businesses
  useEffect(() => {
    const fetchBusinesses = async () => {
      if (!userId) return;

      setLoading(true);
      try {
        const data = await businessesApi.getAvailableBusinesses(userId);
        setBusinesses(data);
      } catch (err) {
        console.error('Failed to fetch businesses:', err);
        setError('Gagal memuat daftar bisnis');
      } finally {
        setLoading(false);
      }
    };

    if (!isCheckingAuth && userId) {
      fetchBusinesses();
    }
  }, [isCheckingAuth, userId]);

  const filteredBusinesses = businesses.filter((b) =>
    b.business_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleJoinBusiness = async () => {
    if (!selectedBusiness || !userId) return;

    setJoining(true);
    setError(null);

    try {
      await businessesApi.joinBusiness(userId, selectedBusiness.id);
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Failed to join business:', err);
      setError(err.message || 'Gagal bergabung dengan bisnis');
    } finally {
      setJoining(false);
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
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      } else {
        setError(result.message || 'Gagal menggunakan kode undangan');
      }
    } catch (err: any) {
      console.error('Failed to use invite code:', err);
      setError(err.message || 'Gagal menggunakan kode undangan');
    } finally {
      setJoining(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
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
        <div className="flex gap-2 mb-6 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <button
            onClick={() => {
              setJoinMode('code');
              setError(null);
              setSuccess(null);
            }}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              joinMode === 'code'
                ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Gunakan Kode
          </button>
          <button
            onClick={() => {
              setJoinMode('list');
              setError(null);
              setSuccess(null);
            }}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              joinMode === 'list'
                ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Pilih dari Daftar
          </button>
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
              <button
                onClick={() => router.back()}
                className="btn-secondary flex-1 py-3"
                disabled={joining}
              >
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
            <div className="mb-6">
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
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-gray-500 dark:text-gray-400">Memuat daftar bisnis...</p>
              </div>
            ) : filteredBusinesses.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className="text-4xl mb-3">🏢</div>
                <p className="text-gray-600 dark:text-gray-400">
                  {searchQuery ? 'Tidak ada bisnis yang cocok' : 'Belum ada bisnis tersedia'}
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto mb-6">
                {filteredBusinesses.map((business) => (
                  <button
                    key={business.id}
                    onClick={() => setSelectedBusiness(business)}
                    className={`w-full p-4 border-2 rounded-xl text-left transition-all ${
                      selectedBusiness?.id === business.id
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                          selectedBusiness?.id === business.id
                            ? 'bg-indigo-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        🏢
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-100 truncate">
                          {business.business_name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Modal: {formatCurrency(business.capital_investment)}
                        </p>
                      </div>
                      {selectedBusiness?.id === business.id && (
                        <svg
                          className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => router.back()}
                className="btn-secondary flex-1 py-3"
                disabled={joining}
              >
                Kembali
              </button>
              <button
                onClick={handleJoinBusiness}
                className="btn-primary flex-1 py-3"
                disabled={!selectedBusiness || joining}
              >
                {joining ? 'Bergabung...' : 'Bergabung'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
