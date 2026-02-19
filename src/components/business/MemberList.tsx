'use client';

import type { BusinessMember } from '@/lib/api/members';
import { formatDate } from '@/lib/utils';

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  business_manager: {
    label: 'Business Manager',
    className: 'bg-purple-50 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400',
  },
  investor: {
    label: 'Investor',
    className: 'bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
  },
  both: {
    label: 'Manager & Investor',
    className: 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400',
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
}

export function MemberList({ members, loading }: MemberListProps) {
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
          <span className="text-3xl">👥</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Belum ada anggota</h3>
        <p className="text-gray-500 dark:text-gray-400">Undang anggota untuk bergabung ke bisnis ini</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {members.map((member) => {
        const name = member.profile?.full_name || 'Unknown User';
        const badge = ROLE_BADGE[member.role] || ROLE_BADGE.business_manager;

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
                <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
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
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400">
                  Creator
                </span>
              )}
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${badge.className}`}>
                {badge.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
