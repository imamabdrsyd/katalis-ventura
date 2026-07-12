'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, X, UserPlus, Clock, Users, Ban, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { InviteCode } from '@/types';
import * as inviteCodesApi from '@/lib/api/inviteCodes';
import FloatingField, { FloatingSelect } from '@/components/ui/FloatingField';

interface InviteCodeManagerProps {
  businessId: string;
  businessName: string;
  userId: string;
  onClose: () => void;
}

export function InviteCodeManager({
  businessId,
  businessName,
  userId,
  onClose,
}: InviteCodeManagerProps) {
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Form state for new invite code
  const [role, setRole] = useState<'business_manager' | 'investor'>('investor');
  const [maxUses, setMaxUses] = useState<number>(10);
  const [expiresIn, setExpiresIn] = useState<number>(30); // days

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const getErrorMessage = (error: unknown): string => {
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
    return 'Terjadi kesalahan. Silakan coba lagi.';
  };

  useEffect(() => {
    fetchInviteCodes();
  }, [businessId]);

  const fetchInviteCodes = async () => {
    setLoading(true);
    try {
      const codes = await inviteCodesApi.getBusinessInviteCodes(businessId);
      setInviteCodes(codes);
    } catch (error) {
      console.error('Failed to fetch invite codes:', error);
      showFeedback('error', `Gagal memuat kode undangan: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    if (!Number.isFinite(maxUses) || maxUses < 1) {
      showFeedback('error', 'Maks penggunaan harus minimal 1');
      return;
    }
    if (!Number.isFinite(expiresIn) || expiresIn < 1) {
      showFeedback('error', 'Masa berlaku harus minimal 1 hari');
      return;
    }

    setGenerating(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresIn);

      await inviteCodesApi.createInviteCode(
        {
          business_id: businessId,
          role,
          expires_at: expiresAt.toISOString(),
          max_uses: maxUses,
        },
        userId
      );

      await fetchInviteCodes();
      showFeedback('success', 'Kode undangan berhasil dibuat');
    } catch (error) {
      console.error('Failed to generate invite code:', error);
      showFeedback('error', `Gagal membuat kode undangan: ${getErrorMessage(error)}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showFeedback('success', `Kode ${code} disalin ke clipboard`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDeactivate = async (codeId: string) => {
    try {
      await inviteCodesApi.deactivateInviteCode(codeId);
      await fetchInviteCodes();
      showFeedback('success', 'Kode undangan dinonaktifkan');
    } catch (error) {
      console.error('Failed to deactivate code:', error);
      showFeedback('error', `Gagal menonaktifkan kode: ${getErrorMessage(error)}`);
    }
  };

  const handleDelete = async (codeId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus kode undangan ini?')) return;

    try {
      await inviteCodesApi.deleteInviteCode(codeId);
      await fetchInviteCodes();
      showFeedback('success', 'Kode undangan dihapus');
    } catch (error) {
      console.error('Failed to delete code:', error);
      showFeedback('error', `Gagal menghapus kode: ${getErrorMessage(error)}`);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isExpired = (dateString?: string) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date();
  };

  return (
    <div
      className={`fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-opacity duration-200 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      <div
        className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-[calc(100vw-2rem)] sm:max-w-lg lg:max-w-2xl max-h-modal overflow-y-auto transition-all duration-200 ease-out ${isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                Kelola Kode Undangan
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {businessName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          {/* Feedback banner */}
          {feedback && (
            <div
              role="status"
              aria-live="polite"
              className={`mb-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <span className="flex-1">{feedback.message}</span>
              <button
                onClick={() => setFeedback(null)}
                className="opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Tutup notifikasi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Generate New Code Form */}
          <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Generate Kode Undangan Baru
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <FloatingSelect
                label="Role"
                value={role}
                onChange={(e) => setRole(e.target.value as 'business_manager' | 'investor')}
              >
                <option value="investor">Investor</option>
                <option value="business_manager">Business Manager</option>
              </FloatingSelect>

              <FloatingField
                label="Maks Penggunaan"
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(Number(e.target.value))}
                min="1"
                max="100"
              />

              <FloatingField
                label="Berlaku (hari)"
                type="number"
                value={expiresIn}
                onChange={(e) => setExpiresIn(Number(e.target.value))}
                min="1"
                max="365"
              />
            </div>

            <button
              onClick={handleGenerateCode}
              disabled={generating}
              className="btn-primary-glow w-full"
            >
              {generating ? 'Generating...' : 'Generate Kode'}
            </button>
          </div>

          {/* Invite Codes List */}
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
              Riwayat Kode Undangan
            </h3>

            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading...</p>
              </div>
            ) : inviteCodes.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Belum ada kode undangan. Buat kode baru di atas untuk mengundang anggota.
              </div>
            ) : (
              <div className="space-y-3">
                {inviteCodes.map((code) => (
                  <div
                    key={code.id}
                    className={`border rounded-xl p-4 ${
                      !code.is_active || isExpired(code.expires_at)
                        ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <code className="text-lg font-mono font-bold text-indigo-500 dark:text-indigo-400">
                            {code.code}
                          </code>
                          <button
                            onClick={() => handleCopyCode(code.code)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                            title="Copy code"
                          >
                            {copiedCode === code.code ? (
                              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full font-medium ${
                              code.role === 'investor'
                                ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400'
                                : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400'
                            }`}
                          >
                            {code.role === 'investor' ? 'Investor' : 'Business Manager'}
                          </span>

                          <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400">
                            <Users className="w-3 h-3" />
                            {code.current_uses}/{code.max_uses}
                          </span>

                          {code.expires_at && (
                            <span className={`inline-flex items-center gap-1 ${
                              isExpired(code.expires_at)
                                ? 'text-red-500 dark:text-red-400'
                                : 'text-gray-600 dark:text-gray-400'
                            }`}>
                              <Clock className="w-3 h-3" />
                              {isExpired(code.expires_at) ? 'Expired' : formatDate(code.expires_at)}
                            </span>
                          )}

                          {!code.is_active && (
                            <span className="text-gray-500 dark:text-gray-400">Nonaktif</span>
                          )}
                        </div>
                      </div>

                      {code.is_active && !isExpired(code.expires_at) && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDeactivate(code.id)}
                            className="p-1.5 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded transition-colors"
                            title="Nonaktifkan"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(code.id)}
                            className="p-1.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Dibuat: {formatDate(code.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
