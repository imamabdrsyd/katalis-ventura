'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { CheckCircle, XCircle, Clock, UserCheck } from 'lucide-react';
import { getBusinessJoinRequests, type JoinRequest } from '@/lib/api/joinRequests';

interface JoinRequestListProps {
  businessId: string;
  onApproved?: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function JoinRequestList({ businessId, onApproved }: JoinRequestListProps) {
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
      <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
        <UserCheck className="w-9 h-9 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
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
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40">
              <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            </span>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Menunggu Persetujuan
            </h3>
            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-semibold rounded-full">
              {pending.length}
            </span>
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
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Riwayat</h3>
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
  const initials = getInitials(name);

  const timestamp = request.status === 'pending'
    ? request.created_at
    : request.reviewed_at || request.updated_at || request.created_at;
  const dateTime = new Date(timestamp).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className={`relative flex items-center gap-3.5 p-4 rounded-2xl border transition-all duration-200 ${
      isPending
        ? 'bg-white dark:bg-gray-800 border-amber-200 dark:border-amber-800/50 hover:shadow-card hover:-translate-y-px'
        : 'bg-gray-50/60 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700'
    }`}>
      {isPending && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-0.5 rounded-r-full bg-gradient-to-b from-amber-300 to-amber-500" />
      )}

      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="relative w-11 h-11 rounded-full bg-gray-100 dark:bg-gray-700/60 flex items-center justify-center text-gray-700 dark:text-gray-300 font-semibold text-sm overflow-hidden ring-2 ring-white dark:ring-gray-800">
          {avatar ? (
            <Image src={avatar} alt={name} width={44} height={44} className="w-full h-full object-cover" unoptimized />
          ) : initials}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{dateTime}</p>
        {request.message && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic truncate">&ldquo;{request.message}&rdquo;</p>
        )}
      </div>

      {/* Status / Actions */}
      {isPending ? (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onReject}
            disabled={processing}
            className="p-2 rounded-lg text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            title="Tolak"
          >
            <XCircle className="w-5 h-5" />
          </button>
          <button
            onClick={onApprove}
            disabled={processing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg
                       bg-gradient-to-b from-indigo-500 to-indigo-600
                       hover:from-indigo-600 hover:to-indigo-700
                       active:from-indigo-700 active:to-indigo-800
                       shadow-sm shadow-indigo-500/20 hover:shadow-md hover:shadow-indigo-500/30
                       transition-all duration-150
                       disabled:opacity-50 disabled:shadow-none"
          >
            {processing ? (
              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle className="w-3.5 h-3.5" />
            )}
            Setujui
          </button>
        </div>
      ) : (
        <div className="flex-shrink-0">
          {request.status === 'approved' ? (
            <span className="inline-flex items-center gap-1 text-xs font-normal text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/60 px-2.5 py-1 rounded-full">
              <CheckCircle className="w-3.5 h-3.5" /> Disetujui
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-normal text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/60 px-2.5 py-1 rounded-full">
              <XCircle className="w-3.5 h-3.5" /> Ditolak
            </span>
          )}
        </div>
      )}
    </div>
  );
}
