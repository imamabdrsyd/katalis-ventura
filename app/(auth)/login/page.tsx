'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Welcome Back</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Sign in to manage, structure, and scale.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
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

        <div className="flex items-center justify-between">
          <label className="flex items-center">
            <input type="checkbox" className="mr-2 w-4 h-4 text-indigo-500 rounded" />
            <span className="text-sm text-gray-600 dark:text-gray-300">Remember me</span>
          </label>
          <Link
            href="/forgot-password"
            className="text-sm text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 font-semibold"
          >
            Forgot password?
          </Link>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
        Don't have an account?{' '}
        <Link href="/signup" className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 font-semibold">
          Create account
        </Link>
      </p>
    </div>
  );
}
