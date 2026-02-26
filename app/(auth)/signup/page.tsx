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

  const handleGoogleSignUp = async () => {
    setError(null);
    setLoading(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (oauthError) throw oauthError;
    } catch (err: any) {
      setError(err.message || 'An error occurred during Google sign up');
      setLoading(false);
    }
  };

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
    <>
      <Image src="/images/favicon.png" alt="AXION" width={60} height={60} className="object-contain dark:hidden" />
      <Image src="/images/favicon-dark.png" alt="AXION" width={60} height={60} className="object-contain hidden dark:block" />
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Create Account</h1>
        <p className="text-sm mt-2 text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
          Enter
          <Image src="/images/axion.png" alt="AXION" width={60} height={20} className="object-contain dark:hidden" />
          <Image src="/images/axion-dark.png" alt="AXION" width={60} height={20} className="object-contain hidden dark:block" />
        </p>
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

      <div className="flex items-center my-5">
        <div className="flex-1 border-t border-gray-200 dark:border-gray-600" />
        <span className="px-3 text-sm text-gray-400 dark:text-gray-500">or</span>
        <div className="flex-1 border-t border-gray-200 dark:border-gray-600" />
      </div>

      <button
        type="button"
        onClick={handleGoogleSignUp}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign up with Google
      </button>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 font-semibold">
          Sign in
        </Link>
      </p>
    </div>
    </>
  );
}
