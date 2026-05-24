'use client';

import { Bell, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase';

interface JoinRequest {
  id: string;
  business_id: string;
  requester_id: string;
  status: string;
  message?: string | null;
  created_at: string;
  requester: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
  business: {
    id: string;
    business_name: string;
  };
}

interface NotificationBellProps {
  count: number;
  href: string;
  userId: string;
  onChange?: () => void;
}

export function NotificationBell({ count, userId, onChange }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabaseRef = useRef(createClient());

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/notifications/pending-requests', {
        credentials: 'include',
      });
      const data = await response.json();
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchRequests();
      setActionError(null);
    }
  }, [isOpen, fetchRequests]);

  // Realtime refresh saat dropdown terbuka
  useEffect(() => {
    if (!isOpen || !userId) return;
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`bell-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'business_join_requests' },
        () => fetchRequests()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, userId, fetchRequests]);

  const handleApprove = async (requestId: string) => {
    setProcessingId(requestId);
    setActionError(null);
    try {
      const response = await fetch(`/api/business-join-requests/${requestId}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
        onChange?.();
      } else {
        const data = await response.json().catch(() => ({}));
        setActionError(data.error || 'Gagal menyetujui permintaan');
      }
    } catch (error) {
      console.error('Failed to approve request:', error);
      setActionError('Gagal menyetujui permintaan. Coba lagi.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingId(requestId);
    setActionError(null);
    try {
      const response = await fetch(`/api/business-join-requests/${requestId}/reject`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
        onChange?.();
      } else {
        const data = await response.json().catch(() => ({}));
        setActionError(data.error || 'Gagal menolak permintaan');
      }
    } catch (error) {
      console.error('Failed to reject request:', error);
      setActionError('Gagal menolak permintaan. Coba lagi.');
    } finally {
      setProcessingId(null);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        title={count > 0 ? `${count} permintaan bergabung menunggu` : 'Notifikasi'}
      >
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 leading-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Permintaan Bergabung</h3>
          </div>

          {actionError && (
            <div className="mx-4 mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-400">{actionError}</p>
            </div>
          )}

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className="w-6 h-6 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : requests.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {requests.map((req) => (
                  <div key={req.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 overflow-hidden">
                        {req.requester.avatar_url ? (
                          <Image
                            src={req.requester.avatar_url}
                            alt={req.requester.full_name}
                            width={36}
                            height={36}
                            className="w-full h-full object-cover"
                            unoptimized
                          />
                        ) : (
                          (req.requester.full_name || '?').charAt(0).toUpperCase()
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {req.requester.full_name || 'Pengguna'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          ingin bergabung dengan <span className="font-medium">{req.business.business_name}</span>
                        </p>
                        {req.message && (
                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 italic">
                            &ldquo;{req.message}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleReject(req.id)}
                        disabled={processingId === req.id}
                        className="flex-1 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-indigo-500 dark:hover:bg-indigo-500 hover:text-white dark:hover:text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        {processingId === req.id ? 'Memproses...' : 'Tolak'}
                      </button>
                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={processingId === req.id}
                        className="flex-1 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-indigo-500 dark:hover:bg-indigo-500 hover:text-white dark:hover:text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {processingId === req.id ? 'Memproses...' : 'Setuju'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">Tidak ada permintaan bergabung</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
