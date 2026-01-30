'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import * as businessesApi from '@/lib/api/businesses';
import { formatCurrency } from '@/lib/utils';
import type { Business } from '@/types';

export default function JoinBusinessPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl mx-auto mb-4 flex items-center justify-center text-white text-2xl">
            📊
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Bergabung dengan Bisnis</h1>
          <p className="text-gray-500 text-sm mt-2">
            Pilih bisnis yang ingin Anda pantau sebagai investor
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

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
            <p className="text-gray-500">Memuat daftar bisnis...</p>
          </div>
        ) : filteredBusinesses.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-xl">
            <div className="text-4xl mb-3">🏢</div>
            <p className="text-gray-600">
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
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                      selectedBusiness?.id === business.id
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    🏢
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 truncate">
                      {business.business_name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Modal: {formatCurrency(business.capital_investment)}
                    </p>
                  </div>
                  {selectedBusiness?.id === business.id && (
                    <svg
                      className="w-5 h-5 text-indigo-600 flex-shrink-0"
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
      </div>
    </div>
  );
}
