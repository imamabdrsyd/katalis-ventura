'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface Stats {
  users: number;
  businesses: number;
}

export default function LandingPage() {
  const [stats, setStats] = useState<Stats>({ users: 0, businesses: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="container mx-auto px-6 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/images/KV.png"
              alt="Katalis Ventura Logo"
              width={48}
              height={48}
              className="rounded-xl"
            />
            <span className="text-xl font-bold bg-gradient-to-r from-violet-600 via-blue-500 to-cyan-400 text-transparent bg-clip-text">KATALIS VENTURA</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="px-5 py-2 text-gray-700 font-semibold hover:text-indigo-600 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 bg-indigo-500 text-white rounded-xl font-semibold hover:bg-indigo-600 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold mb-6">
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
            Private Equity Manager
          </div>

          <h1 className="text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Make Data-driven Decisions 
            <br />
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              for your Assets & Businesses
            </span>
          </h1>

          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Multi-role finance platform build by Imam Abdurasyid for Business Managers and Investors.
            Track transactions, analyze performance, and make data-driven decisions.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="px-8 py-4 bg-indigo-500 text-white rounded-xl font-semibold hover:bg-indigo-600 transition-colors text-lg"
            >
              Start Free Trial
            </Link>
            <Link
              href="#features"
              className="px-8 py-4 bg-white text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors text-lg border border-gray-200"
            >
              Learn More
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-32 max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center text-3xl mb-4">
              👔
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              For Business Managers
            </h3>
            <p className="text-gray-600">
              Full control over transaction management, financial reporting, and team collaboration.
              Setup businesses and invite investors seamlessly.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center text-3xl mb-4">
              📊
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              For Investors
            </h3>
            <p className="text-gray-600">
              Monitor portfolio performance with custom metrics, real-time reports, and detailed
              analytics without operational burden.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <div className="w-14 h-14 bg-pink-100 rounded-xl flex items-center justify-center text-3xl mb-4">
              🔐
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Secure & Private
            </h3>
            <p className="text-gray-600">
              Enterprise-grade security with role-based access control. Your data is isolated and
              protected with industry-standard encryption.
            </p>
          </div>
        </div>

        {/* Stats Section */}
        <div className="mt-32 max-w-6xl mx-auto">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl p-12 text-white">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="text-center">
                <div className="text-5xl font-bold mb-2">100%</div>
                <div className="text-indigo-100">Data Privacy</div>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold mb-2">
                  {loading ? '...' : stats.users}
                </div>
                <div className="text-indigo-100">Users has Joined</div>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold mb-2">
                  {loading ? '...' : stats.businesses}
                </div>
                <div className="text-indigo-100">Businesses</div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-32 max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Ready to get started?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Create your account today and start managing your business finances like a pro.
          </p>
          <Link
            href="/signup"
            className="inline-block px-8 py-4 bg-indigo-500 text-white rounded-xl font-semibold hover:bg-indigo-600 transition-colors text-lg"
          >
            Create Free Account
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-12 mt-32 border-t border-gray-200">
        <div className="text-center text-gray-600">
          <p>&copy; 2025 Katalis Ventura. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
