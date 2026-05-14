'use client';

import { Users, MoreVertical, UserPlus, UserMinus } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { BusinessMember } from '@/lib/api/members';
import { formatDate } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase';
import { saveContactFromTransaction } from '@/lib/api/contacts';
import { normalizeRole } from '@/lib/roles';
import type { ContactType } from '@/types';

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  business_manager: {
    label: 'Business Manager',
    className: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 ring-1 ring-indigo-500/20',
  },
  investor: {
    label: 'Investor',
    className: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 ring-1 ring-indigo-500/20',
  },
  superadmin: {
    label: 'Super Admin',
    className: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20',
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

function KebabMenu({
  member,
  businessId,
  onRemove,
  onContactResult,
}: {
  member: BusinessMember;
  businessId: string;
  onRemove: () => void;
  onContactResult: (msg: string, isError?: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const name = member.profile?.full_name || 'Unknown User';

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleAddToContact = async () => {
    setOpen(false);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Tidak terautentikasi');

      const contactType: ContactType =
        normalizeRole(member.role) === 'investor' ? 'investor'
        : normalizeRole(member.role) === 'business_manager' ? 'partner'
        : 'partner';

      const result = await saveContactFromTransaction(businessId, name, contactType, user.id);
      if (result === null) {
        onContactResult(`${name} sudah ada di daftar kontak`);
      } else {
        onContactResult(`${name} berhasil ditambahkan ke kontak`);
      }
    } catch {
      onContactResult('Gagal menambahkan kontak. Coba lagi.', true);
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        title="Opsi anggota"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-10 py-1 overflow-hidden">
          <button
            onClick={handleAddToContact}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <UserPlus className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            Tambah ke Kontak
          </button>
          <button
            onClick={() => { setOpen(false); onRemove(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <UserMinus className="w-4 h-4" />
            Keluarkan Anggota
          </button>
        </div>
      )}
    </div>
  );
}

export function MemberList({ members, loading, businessId, isCreator, onMemberRemoved }: MemberListProps) {
  const [removeConfirm, setRemoveConfirm] = useState<{ memberId: string; memberName: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; isError: boolean } | null>(null);

  const showToast = (msg: string, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3000);
  };

  const handleRemoveMember = async () => {
    if (!removeConfirm || !businessId) return;

    setRemoving(true);
    setRemoveError(null);
    try {
      const response = await fetch(`/api/businesses/${businessId}/members/${removeConfirm.memberId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setRemoveConfirm(null);
        onMemberRemoved?.();
      } else {
        const data = await response.json().catch(() => ({}));
        setRemoveError(data.error || 'Gagal mengeluarkan anggota');
      }
    } catch (error) {
      console.error('Failed to remove member:', error);
      setRemoveError('Gagal mengeluarkan anggota. Coba lagi.');
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
      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.isError
            ? 'bg-red-500 text-white'
            : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
        }`}>
          {toast.msg}
        </div>
      )}
      <div className="space-y-3">
        {members.map((member) => {
          const name = member.profile?.full_name || 'Unknown User';
          const badge = ROLE_BADGE[normalizeRole(member.role) ?? member.role] || ROLE_BADGE.business_manager;
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
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                    Creator
                  </span>
                )}
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${badge.className}`}>
                  {badge.label}
                </span>
              </div>

              {/* Kebab menu */}
              {canRemove && businessId && (
                <KebabMenu
                  member={member}
                  businessId={businessId}
                  onRemove={() => setRemoveConfirm({ memberId: member.id, memberName: name })}
                  onContactResult={showToast}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Remove confirmation modal */}
      {removeConfirm && (
        <Modal
          isOpen={true}
          onClose={() => { if (!removing) { setRemoveConfirm(null); setRemoveError(null); } }}
          title="Keluarkan Anggota"
        >
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-300">
              Apakah Anda yakin ingin mengeluarkan <span className="font-semibold">{removeConfirm.memberName}</span> dari bisnis ini?
            </p>
            {removeError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-400">{removeError}</p>
              </div>
            )}
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
