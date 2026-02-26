'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Briefcase, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase';

export default function SelectRolePage() {
  const [selectedRole, setSelectedRole] = useState<'business_manager' | 'investor'>('business_manager');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  // Cek apakah user sudah punya role — jika sudah, redirect ke dashboard
  useEffect(() => {
    const checkExistingRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: roles } = await supabase
        .from('user_business_roles')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (roles && roles.length > 0) {
        router.push('/dashboard');
        return;
      }

      setChecking(false);
    };

    checkExistingRole();
  }, [supabase, router]);

  const handleSelectRole = async () => {
    setError(null);
    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { default_role: selectedRole },
      });

      if (updateError) throw updateError;

      if (selectedRole === 'business_manager') {
        router.push('/setup-business');
      } else {
        router.push('/join-business');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Image src="/images/favicon.png" alt="AXION" width={60} height={60} className="object-contain dark:hidden" />
      <Image src="/images/favicon-dark.png" alt="AXION" width={60} height={60} className="object-contain hidden dark:block" />
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Pilih Peran Anda</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Bagaimana Anda ingin menggunakan AXION?</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="space-y-3 mb-6">
          <label className="flex items-center p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/30">
            <input
              type="radio"
              name="role"
              value="business_manager"
              checked={selectedRole === 'business_manager'}
              onChange={() => setSelectedRole('business_manager')}
              className="mr-3 w-4 h-4 text-indigo-500"
            />
            <div className="flex-1">
              <div className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Business Manager
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Setup dan kelola bisnis baru
              </div>
            </div>
          </label>

          <label className="flex items-center p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/30">
            <input
              type="radio"
              name="role"
              value="investor"
              checked={selectedRole === 'investor'}
              onChange={() => setSelectedRole('investor')}
              className="mr-3 w-4 h-4 text-indigo-500"
            />
            <div className="flex-1">
              <div className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Investor
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Bergabung dan pantau bisnis yang sudah ada
              </div>
            </div>
          </label>
        </div>

        <button
          onClick={handleSelectRole}
          disabled={loading}
          className="btn-primary w-full py-3"
        >
          {loading ? 'Menyimpan...' : 'Lanjutkan'}
        </button>
      </div>
    </>
  );
}
