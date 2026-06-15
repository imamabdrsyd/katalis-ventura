'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBusinessContext } from '@/context/BusinessContext';
import { useLanguage } from '@/context/LanguageContext';
import { createClient } from '@/lib/supabase';
import { LOCALE_LABELS, LOCALE_FLAGS, type Locale } from '@/lib/i18n';
import { Camera, User, Mail, Briefcase, Save, Globe, CheckCircle2, XCircle, Copy, RefreshCw, FileEdit, CheckCheck, LayoutList, ClipboardCheck, HandCoins, FileText, Landmark, LineChart, GitBranch, Bot } from 'lucide-react';

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}
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

  const TOGGLEABLE_NAV_ITEMS = [
    { href: '/trial-balance', label: 'Trial Balance', icon: ClipboardCheck },
    { href: '/ar-ap', label: 'AR & AP', icon: HandCoins },
    { href: '/invoices', label: 'Invoicing', icon: FileText },
    { href: '/reconciliation', label: 'Bank Reconciliation', icon: Landmark },
    { href: '/market', label: 'Market Tracker', icon: LineChart },
    { href: '/statement-of-changes-in-equity', label: 'Changes in Equity', icon: GitBranch },
    { href: '/agent', label: 'Agentic Workflow', icon: Bot },
  ];

  const DEFAULT_HIDDEN = TOGGLEABLE_NAV_ITEMS.map(i => i.href);
  const [hiddenNavItems, setHiddenNavItems] = useState<string[]>(DEFAULT_HIDDEN);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('hidden_nav_items')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setHiddenNavItems(data.hidden_nav_items ?? DEFAULT_HIDDEN);
      });
  }, [user?.id]);

  const toggleNavItem = async (href: string) => {
    if (!user) return;
    const next = hiddenNavItems.includes(href)
      ? hiddenNavItems.filter(h => h !== href)
      : [...hiddenNavItems, href];
    setHiddenNavItems(next);
    await supabase
      .from('profiles')
      .update({ hidden_nav_items: next })
      .eq('id', user.id);
  };

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
                className="btn-primary-glow flex-1 flex items-center justify-center gap-2"
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
          {/* Telegram Bot */}
          {canUseTelegram ? (
            <div className="card">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                  <TelegramIcon className="w-5 h-5 text-sky-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t.settings.telegramTitle}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t.settings.telegramSubtitle}</p>
                </div>
              </div>

              {telegramLoading ? (
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  {t.settings.telegramLoadingStatus}
                </div>
              ) : telegramConn ? (
                <div>
                  <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl mb-4">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        {telegramConn.telegram_username
                          ? t.settings.telegramConnectedAs.replace('{name}', `@${telegramConn.telegram_username}`)
                          : telegramConn.telegram_first_name
                          ? t.settings.telegramConnectedAs.replace('{name}', telegramConn.telegram_first_name)
                          : t.settings.telegramConnected}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {t.settings.telegramSince.replace(
                          '{date}',
                          new Date(telegramConn.created_at).toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.settings.telegramHowToTitle}</p>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                      {([
                        [t.settings.telegramHowToEarn, 'jual kopi 150000'],
                        [t.settings.telegramHowToExpense, 'bayar gaji 2jt'],
                        [t.settings.telegramHowToBalance, '/saldo'],
                      ] as const).map(([tmpl, cmd]) => {
                        const [before, after] = tmpl.split('{cmd}');
                        return (
                          <li key={cmd}>
                            {before}
                            <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs">{cmd}</code>
                            {after}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.settings.telegramDefaultStatusTitle}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      {t.settings.telegramDefaultStatusDesc}
                    </p>
                    <SegmentedToggle
                      value={telegramConn.default_transaction_status}
                      onChange={handleUpdateTelegramStatus}
                      disabled={telegramStatusSaving}
                      ariaLabel={t.settings.telegramDefaultStatusTitle}
                      options={[
                        { value: 'draft', label: t.settings.telegramStatusDraft, icon: <FileEdit className="w-3.5 h-3.5" /> },
                        { value: 'posted', label: t.settings.telegramStatusPosted, icon: <CheckCheck className="w-3.5 h-3.5" /> },
                      ]}
                    />
                  </div>
                  <button
                    onClick={handleDisconnectTelegram}
                    disabled={telegramActionLoading}
                    className="inline-flex items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    {t.settings.telegramDisconnect}
                  </button>
                </div>
              ) : (
                <div>
                  {telegramToken ? (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                          {t.settings.telegramTokenValid.replace('{time}', formatCountdown(telegramCountdown))}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        {t.settings.telegramOpenHint}
                      </p>
                      <div className="flex gap-3 flex-wrap">
                        <a
                          href={`https://t.me/${telegramBotUsername}?start=${telegramToken}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-xl transition-all duration-150 bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 active:from-indigo-700 active:to-indigo-800 shadow-sm shadow-indigo-500/20 hover:shadow-md hover:shadow-indigo-500/30"
                        >
                          <TelegramIcon className="w-4 h-4" />
                          {t.settings.telegramOpen}
                        </a>
                        <button onClick={handleCopyTelegramLink} className="btn-ghost flex items-center gap-2">
                          <Copy className="w-4 h-4" />
                          {telegramCopied ? t.settings.telegramCopied : t.settings.telegramCopyLink}
                        </button>
                        <button
                          onClick={handleGenerateTelegramToken}
                          disabled={telegramActionLoading}
                          className="btn-ghost flex items-center gap-2"
                        >
                          <RefreshCw className="w-4 h-4" />
                          {t.settings.telegramRefreshToken}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        {t.settings.telegramConnectHint}
                      </p>
                      <button
                        onClick={handleGenerateTelegramToken}
                        disabled={telegramActionLoading}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors duration-150 bg-gray-100 dark:bg-gray-700/50 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {telegramActionLoading ? (
                          <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <TelegramIcon className="w-4 h-4 text-sky-500" />
                        )}
                        {t.settings.telegramConnect}
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
                  <TelegramIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t.settings.telegramTitle}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t.settings.telegramSubtitle}</p>
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t.settings.telegramInvestorOnly}
                </p>
              </div>
            </div>
          )}
          {/* Sidebar Menu Visibility */}
          <div className="card">
            <div className="flex items-center gap-3 mb-5">
              <LayoutList className="w-5 h-5 text-gray-900 dark:text-gray-100" />
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">{t.settings.sidebarMenuTitle}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t.settings.sidebarMenuDesc}</p>
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {TOGGLEABLE_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const isVisible = !hiddenNavItems.includes(href);
                return (
                  <div
                    key={href}
                    className="flex items-center justify-between py-3 px-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors first:pt-1 last:pb-1"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isVisible ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`} />
                      <span className={`text-sm font-medium ${isVisible ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>{label}</span>
                    </div>
                    <button
                      onClick={() => toggleNavItem(href)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isVisible ? 'bg-gray-900 dark:bg-gray-100' : 'bg-gray-300 dark:bg-gray-600'}`}
                      role="switch"
                      aria-checked={isVisible}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isVisible ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
