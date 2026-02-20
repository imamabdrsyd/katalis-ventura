'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Briefcase, TrendingUp, User, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<'business_manager' | 'investor'>(
    'business_manager'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  // Clear invalid session on mount to prevent refresh token errors
  useEffect(() => {
    const clearInvalidSession = async () => {
      try {
        const { error: sessionError } = await supabase.auth.getSession();

        // If there's a session error (like invalid refresh token), sign out
        if (sessionError) {
          await supabase.auth.signOut();
        }
      } catch (err) {
        // Silently handle any errors during session check
        console.error('Session check error:', err);
        // Sign out to clear any corrupted session data
        await supabase.auth.signOut();
      }
    };

    clearInvalidSession();
  }, [supabase]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            default_role: selectedRole,
          },
        },
      });

      if (signUpError) throw signUpError;

      // Profile is auto-created by database trigger
      // Wait a moment for the trigger to complete
      if (data.user) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Redirect based on role
      if (selectedRole === 'business_manager') {
        router.push('/setup-business');
      } else {
        router.push('/join-business');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8">
      <div className="text-center mb-8">
        <Image
          src="/images/logo-axion.png"
          alt="Katalis Ventura Logo"
          width={64}
          height={64}
          className="mx-auto mb-4 rounded-xl"
        />
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Create Account</h1>
        <p className="text-sm mt-2 text-gray-500 dark:text-gray-400">Join <span className="font-bold bg-gradient-to-r from-violet-600 via-blue-500 to-cyan-400 text-transparent bg-clip-text">KATALIS VENTURA</span></p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSignUp} className="space-y-4">
        <div>
          <label className="label">Full Name</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input pl-10"
              placeholder="John Doe"
              required
            />
          </div>
        </div>

        <div>
          <label className="label">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input pl-10"
              placeholder="you@example.com"
              required
            />
          </div>
        </div>

        <div>
          <label className="label">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input pl-10 pr-10"
              placeholder="••••••••"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="label mb-3">I want to register as:</label>
          <div className="space-y-2">
            <label className="flex items-center p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/30">
              <input
                type="radio"
                name="role"
                value="business_manager"
                checked={selectedRole === 'business_manager'}
                onChange={(e) =>
                  setSelectedRole(e.target.value as 'business_manager')
                }
                className="mr-3 w-4 h-4 text-indigo-500"
              />
              <div className="flex-1">
                <div className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Business Manager
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Setup and manage a new business
                </div>
              </div>
            </label>

            <label className="flex items-center p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/30">
              <input
                type="radio"
                name="role"
                value="investor"
                checked={selectedRole === 'investor'}
                onChange={(e) => setSelectedRole(e.target.value as 'investor')}
                className="mr-3 w-4 h-4 text-indigo-500"
              />
              <div className="flex-1">
                <div className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Investor
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Join and monitor existing business
                </div>
              </div>
            </label>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 font-semibold">
          Sign in
        </Link>
      </p>
    </div>
  );
}
