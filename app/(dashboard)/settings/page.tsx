'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBusinessContext } from '@/context/BusinessContext';
import { useLanguage } from '@/context/LanguageContext';
import { createClient } from '@/lib/supabase';
import { LOCALE_LABELS, LOCALE_FLAGS, type Locale } from '@/lib/i18n';
import { Camera, User, Mail, Briefcase, Save, Globe, Send, CheckCircle2, XCircle, Copy, RefreshCw, FileEdit, CheckCheck } from 'lucide-react';
import Image from 'next/image';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { isManagerRole } from '@/lib/roles';
import type { UserRole } from '@/types';

export default function SettingsPage() {
  const { user, userRole, displayRole, isSuperadmin, switchRole, refetch } = useBusinessContext();
  const { locale, setLocale, t } = useLanguage();
  const router = useRouter();
  const supabase = createClient();

  const roleLabels: Record<string, string> = {
    business_manager: t.roles.businessManager,
    investor: t.roles.investor,
    superadmin: t.roles.superAdmin,
  };
  const canUseTelegram = isManagerRole(userRole);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDisplayRole, setSelectedDisplayRole] = useState<UserRole>('superadmin');

  // Telegram state
  const [telegramConn, setTelegramConn] = useState<{
    telegram_username: string | null;
    telegram_first_name: string | null;
    default_transaction_status: 'draft' | 'posted';
    created_at: string;
  } | null>(null);
  const [telegramStatusSaving, setTelegramStatusSaving] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(true);
  const [telegramToken, setTelegramToken] = useState<string | null>(null);
  const [telegramTokenExpiry, setTelegramTokenExpiry] = useState<Date | null>(null);
  const [telegramBotUsername, setTelegramBotUsername] = useState('');
  const [telegramActionLoading, setTelegramActionLoading] = useState(false);
  const [telegramCopied, setTelegramCopied] = useState(false);
  const [telegramCountdown, setTelegramCountdown] = useState(0);

  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || '');
      setEmail(user.email || '');
      setAvatarUrl(user.user_metadata?.avatar_url || null);
      setLoading(false);
      if (canUseTelegram) {
        fetchTelegramStatus();
      } else {
        setTelegramConn(null);
        setTelegramLoading(false);
      }
    }
  }, [user, canUseTelegram]);

  useEffect(() => {
    if (displayRole) {
      setSelectedDisplayRole(displayRole);
    }
  }, [displayRole]);

  // Countdown timer untuk link token
  useEffect(() => {
    if (!telegramTokenExpiry) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((telegramTokenExpiry.getTime() - Date.now()) / 1000));
      setTelegramCountdown(remaining);
      if (remaining === 0) {
        setTelegramToken(null);
        setTelegramTokenExpiry(null);
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [telegramTokenExpiry]);

  const fetchTelegramStatus = async () => {
    setTelegramLoading(true);
    try {
      const res = await fetch('/api/telegram/link');
      const data = await res.json();
      setTelegramConn(data.connection ?? null);
    } catch {
      // silent
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleGenerateTelegramToken = async () => {
    setTelegramActionLoading(true);
    try {
      const res = await fetch('/api/telegram/link', { method: 'POST' });
      const data = await res.json();
      setTelegramToken(data.token);
      setTelegramTokenExpiry(new Date(data.expires_at));
      setTelegramBotUsername(data.bot_username || '');
    } catch {
      setError('Gagal membuat token Telegram.');
    } finally {
      setTelegramActionLoading(false);
    }
  };

  const handleDisconnectTelegram = async () => {
    if (!confirm('Putuskan koneksi Telegram?')) return;
    setTelegramActionLoading(true);
    try {
      await fetch('/api/telegram/link', { method: 'DELETE' });
      setTelegramConn(null);
      setTelegramToken(null);
    } catch {
      setError('Gagal memutuskan koneksi Telegram.');
    } finally {
      setTelegramActionLoading(false);
    }
  };

  const handleUpdateTelegramStatus = async (newStatus: 'draft' | 'posted') => {
    setTelegramStatusSaving(true);
    try {
      const res = await fetch('/api/telegram/link', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_transaction_status: newStatus }),
      });
      if (!res.ok) throw new Error('fail');
      setTelegramConn((prev) => (prev ? { ...prev, default_transaction_status: newStatus } : prev));
    } catch {
      setError('Gagal menyimpan preferensi Telegram.');
    } finally {
      setTelegramStatusSaving(false);
    }
  };

  const handleCopyTelegramLink = () => {
    if (!telegramToken || !telegramBotUsername) return;
    const link = `https://t.me/${telegramBotUsername}?start=${telegramToken}`;
    navigator.clipboard.writeText(link);
    setTelegramCopied(true);
    setTimeout(() => setTelegramCopied(false), 2000);
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setError(null);

      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage.from('profiles').getPublicUrl(filePath);

      setAvatarUrl(data.publicUrl);
      setSuccess(t.settings.photoUploaded);
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      setError(error.message || t.settings.photoUploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      if (!user) return;

      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          avatar_url: avatarUrl,
        },
      });

      if (updateError) throw updateError;

      // Update profiles table — default_role TIDAK ikut dikirim dari klien.
      // Field role itu privileged dan hanya boleh diubah oleh superadmin asli;
      // trigger prevent_profile_role_escalation di DB juga sudah menjaga.
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: fullName,
          avatar_url: avatarUrl,
        });

      if (profileError) throw profileError;

      if (isSuperadmin) {
        switchRole(selectedDisplayRole);
      }

      setSuccess(t.settings.profileUpdated);
      await refetch();

      // Refresh after 1.5s
      setTimeout(() => {
        router.refresh();
      }, 1500);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setError(error.message || t.settings.profileUpdateFailed);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">{t.settings.title}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t.settings.subtitle}</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl">
          <p className="text-sm text-green-700 dark:text-green-400">{success}</p>
        </div>
      )}

      {/* 2-panel layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* LEFT PANEL — Profile */}
        <div className="w-full lg:w-[380px] flex-shrink-0">
          <div className="card">
            {/* Avatar — centered, prominent */}
            <div className="flex flex-col items-center text-center pb-6 mb-6 border-b border-gray-200 dark:border-gray-700">
              <div className="relative group mb-4">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center text-white text-3xl font-bold ring-4 ring-white dark:ring-gray-800 shadow-md">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt="Profile"
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{fullName.charAt(0).toUpperCase() || 'U'}</span>
                  )}
                </div>
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity duration-200">
                  <Camera className="w-5 h-5 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="font-semibold text-gray-800 dark:text-gray-100">{fullName || '—'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{email}</p>
              {uploading && (
                <p className="text-xs text-primary-500 dark:text-primary-400 mt-1">{t.settings.uploading}</p>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t.settings.clickToChange}</p>
            </div>

            {/* Form Fields */}
            <div className="space-y-5">
              <div>
                <label className="label flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {t.settings.fullName}
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input"
                  placeholder={t.settings.fullNamePlaceholder}
                />
              </div>

              <div>
                <label className="label flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {t.settings.email}
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="input bg-gray-50 dark:bg-gray-700 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t.settings.emailReadonly}</p>
              </div>

              <div>
                <label className="label flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  {t.settings.role}
                </label>
                {isSuperadmin ? (
                  <select
                    value={selectedDisplayRole}
                    onChange={(event) => setSelectedDisplayRole(event.target.value as UserRole)}
                    className="input"
                  >
                    <option value="business_manager">{roleLabels.business_manager}</option>
                    <option value="investor">{roleLabels.investor}</option>
                    <option value="superadmin">{roleLabels.superadmin}</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={userRole ? roleLabels[userRole] : '-'}
                    disabled
                    className="input bg-gray-50 dark:bg-gray-700 cursor-not-allowed"
                  />
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {isSuperadmin ? t.settings.superadminRoleHint : t.settings.roleReadonly}
                </p>
              </div>

              <div>
                <label className="label flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  {t.settings.language}
                </label>
                <div
                  className="inline-flex max-w-full items-center gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-gray-800"
                  role="tablist"
                  aria-label={t.settings.language}
                >
                  {(Object.keys(LOCALE_LABELS) as Locale[]).map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      role="tab"
                      aria-selected={locale === loc}
                      onClick={() => setLocale(loc)}
                      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-all ${
                        locale === loc
                          ? 'bg-white text-primary-500 shadow-sm ring-1 ring-black/5 dark:bg-gray-900 dark:text-primary-400 dark:ring-white/10'
                          : 'text-gray-500 hover:bg-white/60 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700/70 dark:hover:text-gray-200'
                      }`}
                    >
                      <span className="text-base">{LOCALE_FLAGS[loc]}</span>
                      <span>{LOCALE_LABELS[loc]}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t.settings.languageHint}</p>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => router.back()} className="btn-secondary flex-1" disabled={saving}>
                {t.common.cancel}
              </button>
              <button
                onClick={handleSaveProfile}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
                disabled={saving || uploading}
              >
                <Save className="w-4 h-4" />
                {saving ? t.common.saving : t.settings.saveChanges}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — Integrations */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Section label */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Integrasi</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Hubungkan tools eksternal untuk mempercepat pencatatan</p>
          </div>

          {/* Telegram Bot */}
          {canUseTelegram ? (
            <div className="card">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                  <Send className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Telegram Bot</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Input transaksi langsung dari Telegram</p>
                </div>
              </div>

              {telegramLoading ? (
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  Memuat status koneksi...
                </div>
              ) : telegramConn ? (
                <div>
                  <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl mb-4">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        Terhubung{telegramConn.telegram_username ? ` sebagai @${telegramConn.telegram_username}` : telegramConn.telegram_first_name ? ` sebagai ${telegramConn.telegram_first_name}` : ''}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Sejak {new Date(telegramConn.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cara pakai:</p>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                      <li>Ketik <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs">jual kopi 150000</code> untuk catat pendapatan</li>
                      <li>Ketik <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs">bayar gaji 2jt</code> untuk catat beban</li>
                      <li>Gunakan <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs">/saldo</code> untuk lihat ringkasan</li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status default transaksi dari bot</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      Pilih apakah transaksi yang masuk via Telegram disimpan sebagai <strong>Draft</strong> (perlu review dulu) atau <strong>Posted</strong> (langsung final).
                    </p>
                    <SegmentedToggle
                      value={telegramConn.default_transaction_status}
                      onChange={handleUpdateTelegramStatus}
                      disabled={telegramStatusSaving}
                      ariaLabel="Status default transaksi dari bot"
                      options={[
                        { value: 'draft', label: 'Draft', icon: <FileEdit className="w-3.5 h-3.5" /> },
                        { value: 'posted', label: 'Posted', icon: <CheckCheck className="w-3.5 h-3.5" /> },
                      ]}
                    />
                  </div>
                  <button
                    onClick={handleDisconnectTelegram}
                    disabled={telegramActionLoading}
                    className="inline-flex items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Putuskan Koneksi Telegram
                  </button>
                </div>
              ) : (
                <div>
                  {telegramToken ? (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                          Token berlaku {formatCountdown(telegramCountdown)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Tap tombol di bawah untuk membuka Telegram dan menghubungkan akun secara otomatis.
                      </p>
                      <div className="flex gap-3 flex-wrap">
                        <a
                          href={`https://t.me/${telegramBotUsername}?start=${telegramToken}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-xl transition-colors"
                        >
                          <Send className="w-4 h-4" />
                          Buka di Telegram
                        </a>
                        <button onClick={handleCopyTelegramLink} className="btn-ghost flex items-center gap-2">
                          <Copy className="w-4 h-4" />
                          {telegramCopied ? 'Tersalin!' : 'Salin Link'}
                        </button>
                        <button
                          onClick={handleGenerateTelegramToken}
                          disabled={telegramActionLoading}
                          className="btn-ghost flex items-center gap-2"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Perbarui Token
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Hubungkan akun Telegram kamu untuk bisa input transaksi langsung dari chat, tanpa buka aplikasi.
                      </p>
                      <button
                        onClick={handleGenerateTelegramToken}
                        disabled={telegramActionLoading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                      >
                        {telegramActionLoading ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Hubungkan Telegram
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Investor — no Telegram integration */
            <div className="card">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <Send className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Telegram Bot</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Input transaksi langsung dari Telegram</p>
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Integrasi Telegram hanya tersedia untuk Business Manager.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
