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
    className: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 ring-1 ring-inset ring-indigo-500/20',
  },
  investor: {
    label: 'Investor',
    className: 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 ring-1 ring-inset ring-sky-500/20',
  },
  superadmin: {
    label: 'Super Admin',
    className: 'bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 ring-1 ring-inset ring-gray-500/20',
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
  onOpenChange,
}: {
  member: BusinessMember;
  businessId: string;
  onRemove: () => void;
  onContactResult: (msg: string, isError?: boolean) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const name = member.profile?.full_name || 'Unknown User';

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

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
        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-30 py-1 overflow-hidden">
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 animate-pulse">
            <div className="w-11 h-11 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-36 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="h-2.5 w-24 bg-gray-200 dark:bg-gray-700 rounded-full" />
            </div>
            <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-14 rounded-2xl bg-white dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 to-indigo-50 dark:from-indigo-900/40 dark:to-indigo-900/10 rounded-full" />
          <div className="relative w-full h-full flex items-center justify-center">
            <Users className="w-7 h-7 text-indigo-400 dark:text-indigo-300" />
          </div>
        </div>
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1">Belum ada anggota</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Undang anggota untuk bergabung ke bisnis ini</p>
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
          const normalizedRole = normalizeRole(member.role) ?? member.role;
          const badge = ROLE_BADGE[normalizedRole] || ROLE_BADGE.business_manager;
          const canRemove = isCreator && !member.is_creator;
          const isSuperadmin = normalizedRole === 'superadmin';
          const highlight = member.is_creator || isSuperadmin;
          const isMenuOpen = openMenuId === member.id;

          return (
            <div
              key={member.id}
              className={`group relative flex items-center gap-3.5 p-4 rounded-2xl bg-white dark:bg-gray-800 border transition-all duration-200 ${
                isMenuOpen ? 'z-20 shadow-sm' : 'hover:shadow-sm hover:-translate-y-px'
              } ${
                highlight
                  ? 'border-indigo-200/70 dark:border-indigo-800/50'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {highlight && (
                  <div className="absolute -inset-0.5 rounded-full bg-gradient-to-br from-indigo-400/40 via-violet-400/30 to-indigo-500/40 blur-[2px]" />
                )}
                {member.profile?.avatar_url ? (
                  <img
                    src={member.profile.avatar_url}
                    alt={name}
                    className={`relative w-11 h-11 rounded-full object-cover ${highlight ? 'ring-2 ring-white dark:ring-gray-800' : ''}`}
                  />
                ) : (
                  <div className={`relative w-11 h-11 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-700/60 ${
                    highlight ? 'ring-2 ring-white dark:ring-gray-800' : ''
                  }`}>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {getInitials(name)}
                    </span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {name}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {member.is_creator && (
                    <>
                      <span className="font-medium text-gray-600 dark:text-gray-300">Creator</span>
                      <span className="text-gray-300 dark:text-gray-600">•</span>
                    </>
                  )}
                  <span className="truncate">Bergabung {formatDate(member.joined_at)}</span>
                </div>
              </div>

              {/* Badge */}
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${badge.className}`}>
                {badge.label}
              </span>

              {/* Kebab menu */}
              {canRemove && businessId && (
                <KebabMenu
                  member={member}
                  businessId={businessId}
                  onRemove={() => setRemoveConfirm({ memberId: member.id, memberName: name })}
                  onContactResult={showToast}
                  onOpenChange={(open) => {
                    if (open) {
                      setOpenMenuId(member.id);
                    } else {
                      setOpenMenuId((prev) => (prev === member.id ? null : prev));
                    }
                  }}
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
