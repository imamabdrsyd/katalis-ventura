'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { CheckCircle, XCircle, Clock, UserCheck } from 'lucide-react';
import { getBusinessJoinRequests, type JoinRequest } from '@/lib/api/joinRequests';

interface JoinRequestListProps {
  businessId: string;
  reviewerId?: string;
  onApproved?: () => void;
}

export function JoinRequestList({ businessId, reviewerId, onApproved }: JoinRequestListProps) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBusinessJoinRequests(businessId);
      setRequests(data);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleApprove = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const res = await fetch(`/api/business-join-requests/${requestId}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: 'approved' as const } : r));
        onApproved?.();
      }
    } catch {
      // silent
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const res = await fetch(`/api/business-join-requests/${requestId}/reject`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: 'rejected' as const } : r));
      }
    } catch {
      // silent
    } finally {
      setProcessingId(null);
    }
  };

  const pending = requests.filter((r) => r.status === 'pending');
  const reviewed = requests.filter((r) => r.status !== 'pending');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
        <UserCheck className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada permintaan bergabung</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending requests */}
      {pending.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Menunggu Persetujuan
              <span className="ml-2 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs rounded-full">
                {pending.length}
              </span>
            </h3>
          </div>
          <div className="space-y-3">
            {pending.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                processing={processingId === req.id}
                onApprove={() => handleApprove(req.id)}
                onReject={() => handleReject(req.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Reviewed requests */}
      {reviewed.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">Riwayat</h3>
          <div className="space-y-2">
            {reviewed.map((req) => (
              <RequestCard key={req.id} request={req} processing={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RequestCard({
  request,
  processing,
  onApprove,
  onReject,
}: {
  request: JoinRequest;
  processing: boolean;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const isPending = request.status === 'pending';
  const name = request.requester?.full_name || 'Pengguna';
  const avatar = request.requester?.avatar_url;
  const initials = name.charAt(0).toUpperCase();

  const date = new Date(request.created_at).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
      isPending
        ? 'bg-white dark:bg-gray-800 border-amber-200 dark:border-amber-800/50'
        : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
    }`}>
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 overflow-hidden">
        {avatar ? (
          <Image src={avatar} alt={name} width={40} height={40} className="w-full h-full object-cover" unoptimized />
        ) : initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{date}</p>
        {request.message && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic truncate">"{request.message}"</p>
        )}
      </div>

      {/* Status / Actions */}
      {isPending ? (
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onReject}
            disabled={processing}
            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
            title="Tolak"
          >
            <XCircle className="w-5 h-5" />
          </button>
          <button
            onClick={onApprove}
            disabled={processing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {processing ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle className="w-3.5 h-3.5" />
            )}
            Setujui
          </button>
        </div>
      ) : (
        <div className="flex-shrink-0">
          {request.status === 'approved' ? (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full">
              <CheckCircle className="w-3.5 h-3.5" /> Disetujui
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2.5 py-1 rounded-full">
              <XCircle className="w-3.5 h-3.5" /> Ditolak
            </span>
          )}
        </div>
      )}
    </div>
  );
}
