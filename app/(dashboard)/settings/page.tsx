'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBusinessContext } from '@/context/BusinessContext';
import { useLanguage } from '@/context/LanguageContext';
import { createClient } from '@/lib/supabase';
import { LOCALE_LABELS, LOCALE_FLAGS, type Locale } from '@/lib/i18n';
import { Camera, User, Mail, Briefcase, Save, Globe } from 'lucide-react';
import Image from 'next/image';

export default function SettingsPage() {
  const { user, userRole, isSuperadmin, switchRole, refetch } = useBusinessContext();
  const { locale, setLocale, t } = useLanguage();
  const router = useRouter();
  const supabase = createClient();

  const roleLabels: Record<string, string> = {
    business_manager: t.roles.businessManager,
    investor: t.roles.investor,
    both: t.roles.managerInvestor,
    superadmin: t.roles.superAdmin,
  };

  const switchableRoles = [
    { value: 'business_manager', label: t.roles.businessManager },
    { value: 'investor', label: t.roles.investor },
    { value: 'superadmin', label: t.roles.superAdmin },
  ];

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>(userRole || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || '');
      setEmail(user.email || '');
      setAvatarUrl(user.user_metadata?.avatar_url || null);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (userRole) setSelectedRole(userRole);
  }, [userRole]);

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

      // Superadmin: switch active role via context
      if (isSuperadmin && selectedRole !== userRole) {
        switchRole(selectedRole as any);
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

      <div className="card">
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
              <>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="input"
                >
                  {switchableRoles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t.settings.superadminRoleHint}
                </p>
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={userRole ? roleLabels[userRole] : '-'}
                  disabled
                  className="input bg-gray-50 dark:bg-gray-700 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t.settings.roleReadonly}
                </p>
              </>
            )}
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
