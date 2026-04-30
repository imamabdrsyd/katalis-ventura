'use client';

import { Users, X } from 'lucide-react';
import { useState } from 'react';
import type { BusinessMember } from '@/lib/api/members';
import { formatDate } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  business_manager: {
    label: 'Business Manager',
    className: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 ring-1 ring-indigo-500/20',
  },
  investor: {
    label: 'Investor',
    className: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 ring-1 ring-indigo-500/20',
  },
  both: {
    label: 'Manager & Investor',
    className: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 ring-1 ring-indigo-500/20',
  },
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

interface MemberListProps {
  members: BusinessMember[];
  loading: boolean;
  businessId?: string;
  isCreator?: boolean;
  onMemberRemoved?: () => void;
}

export function MemberList({ members, loading, businessId, isCreator, onMemberRemoved }: MemberListProps) {
  const [removeConfirm, setRemoveConfirm] = useState<{ memberId: string; memberName: string } | null>(null);
  const [removing, setRemoving] = useState(false);

  const handleRemoveMember = async () => {
    if (!removeConfirm || !businessId) return;

    setRemoving(true);
    try {
      const response = await fetch(`/api/businesses/${businessId}/members/${removeConfirm.memberId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setRemoveConfirm(null);
        onMemberRemoved?.();
      }
    } catch (error) {
      console.error('Failed to remove member:', error);
    } finally {
      setRemoving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-gray-800 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Belum ada anggota</h3>
        <p className="text-gray-500 dark:text-gray-400">Undang anggota untuk bergabung ke bisnis ini</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {members.map((member) => {
          const name = member.profile?.full_name || 'Unknown User';
          const badge = ROLE_BADGE[member.role] || ROLE_BADGE.business_manager;
          const canRemove = isCreator && !member.is_creator;

          return (
            <div
              key={member.id}
              className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
            >
              {/* Avatar */}
              {member.profile?.avatar_url ? (
                <img
                  src={member.profile.avatar_url}
                  alt={name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                  <span className="text-sm font-semibold text-indigo-500 dark:text-indigo-400">
                    {getInitials(name)}
                  </span>
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Bergabung {formatDate(member.joined_at)}
                </p>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-1.5">
                {member.is_creator && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-900/50 text-amber-500 dark:text-amber-400">
                    Creator
                  </span>
                )}
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${badge.className}`}>
                  {badge.label}
                </span>
              </div>

              {/* Remove button */}
              {canRemove && (
                <button
                  onClick={() => setRemoveConfirm({ memberId: member.id, memberName: name })}
                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Keluarkan anggota"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Remove confirmation modal */}
      {removeConfirm && (
        <Modal
          isOpen={true}
          onClose={() => !removing && setRemoveConfirm(null)}
          title="Keluarkan Anggota"
        >
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-300">
              Apakah Anda yakin ingin mengeluarkan <span className="font-semibold">{removeConfirm.memberName}</span> dari bisnis ini?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRemoveConfirm(null)}
                disabled={removing}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleRemoveMember}
                disabled={removing}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {removing ? 'Menghapus...' : 'Keluarkan'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
