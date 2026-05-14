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

      // Update profiles table (keep default_role as-is for superadmin)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: fullName,
          avatar_url: avatarUrl,
          default_role: isSuperadmin ? 'superadmin' : userRole,
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
    <div className="p-8 max-w-4xl mx-auto">
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

      {/* Telegram Bot Section */}
      {canUseTelegram && (
      <div className="card mt-6">
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
          /* Connected state */
          <div>
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl mb-4">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  Terhubung{telegramConn.telegram_username ? ` sebagai @${telegramConn.telegram_username}` : telegramConn.telegram_first_name ? ` sebagai ${telegramConn.telegram_first_name}` : ''}
                </p>
                <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">
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

            {/* Default status transaksi dari bot */}
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
              className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Putuskan Koneksi Telegram
            </button>
          </div>
        ) : (
          /* Not connected state */
          <div>
            {telegramToken ? (
              /* Token generated — show deep link */
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
                  <button
                    onClick={handleCopyTelegramLink}
                    className="btn-ghost flex items-center gap-2"
                  >
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
              /* Initial state — no token yet */
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
      )}

      <div className="card mt-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">{t.settings.profileInfo}</h2>

        {/* Avatar Upload */}
        <div className="flex items-center gap-6 mb-8">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-3xl font-bold">
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
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
              <Camera className="w-6 h-6 text-white" />
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
          <div>
            <p className="font-medium text-gray-800 dark:text-gray-100">{t.settings.profilePhoto}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t.settings.clickToChange}
            </p>
            {uploading && (
              <p className="text-sm text-indigo-500 dark:text-indigo-400 mt-2">{t.settings.uploading}</p>
            )}
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-6">
          {/* Full Name */}
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

          {/* Email (Read-only) */}
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t.settings.emailReadonly}
            </p>
          </div>

          {/* Role */}
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

          {/* Language Switcher */}
          <div>
            <label className="label flex items-center gap-2">
              <Globe className="w-4 h-4" />
              {t.settings.language}
            </label>
            <div className="flex gap-3">
              {(Object.keys(LOCALE_LABELS) as Locale[]).map((loc) => (
                <button
                  key={loc}
                  onClick={() => setLocale(loc)}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 transition-all text-sm font-medium ${
                    locale === loc
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/20'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="text-lg">{LOCALE_FLAGS[loc]}</span>
                  <span>{LOCALE_LABELS[loc]}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t.settings.languageHint}
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => router.back()}
            className="btn-secondary flex-1"
            disabled={saving}
          >
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
  );
}
