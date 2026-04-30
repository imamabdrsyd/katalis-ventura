'use client';

import { Bell, X, CheckCircle2, XCircle } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

interface JoinRequest {
  id: string;
  business_id: string;
  requester_id: string;
  status: string;
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
}

export function NotificationBell({ count, href, userId }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && count > 0) {
      fetchRequests();
    }
  }, [isOpen, count]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/notifications/pending-requests?userId=${userId}`);
      const data = await response.json();
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const response = await fetch(`/api/business-join-requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewerId: userId }),
      });
      
      if (response.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
      }
    } catch (error) {
      console.error('Failed to approve request:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const response = await fetch(`/api/business-join-requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewerId: userId }),
      });
      
      if (response.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
      }
    } catch (error) {
      console.error('Failed to reject request:', error);
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
        className="relative p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Permintaan Bergabung</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

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
                      {/* Avatar */}
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
                          req.requester.full_name.charAt(0).toUpperCase()
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {req.requester.full_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          ingin bergabung dengan {req.business.business_name}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleReject(req.id)}
                        disabled={processingId === req.id}
                        className="flex-1 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Tolak
                      </button>
                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={processingId === req.id}
                        className="flex-1 px-3 py-2 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Setuju
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
