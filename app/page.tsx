'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Briefcase, TrendingUp, Shield } from 'lucide-react';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

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
    <div className={`${inter.className} min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col`}>
      {/* Header */}
      <header className="container mx-auto px-6 py-5">
        <nav className="flex items-center justify-between">
          <Image
            src="/images/axion.png"
            alt="Axion Logo"
            width={110}
            height={36}
            className="object-contain"
          />
          <Link
            href="/signup"
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-600 transition-colors text-sm"
          >
            Get Started
          </Link>
        </nav>
      </header>

      {/* Hero + Features combined */}
      <main className="flex-1 container mx-auto px-6 py-10 flex flex-col justify-center">
        {/* Hero */}
        <div className="max-w-3xl mx-auto text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold mb-5">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
            Accounting Engine
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
            Make Data-driven Decisions
            <br />
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              for your Asset & Business
            </span>
          </h1>

          <p className="text-base text-gray-600 mb-8 max-w-xl mx-auto">
            Acquire stakes in profitable small businesses.
            Track transactions, analyze performance, and make data-driven decisions.
          </p>

          <Link
            href="/login"
            className="group relative inline-block px-10 py-3.5 text-white rounded-xl font-semibold text-lg overflow-hidden bg-[length:200%_100%] bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 bg-left hover:bg-right transition-[background-position] duration-500 ease-in-out"
          >
            Enter AXION
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto mb-12">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <Briefcase className="w-6 h-6 text-indigo-500 mb-3" />
            <h3 className="text-base font-bold text-gray-900 mb-2">
              For Business Managers
            </h3>
            <p className="text-sm text-gray-600">
              Full control over transaction management, financial reporting, and team collaboration.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <TrendingUp className="w-6 h-6 text-blue-500 mb-3" />
            <h3 className="text-base font-bold text-gray-900 mb-2">
              For Investors
            </h3>
            <p className="text-sm text-gray-600">
              Monitor portfolio performance with custom metrics, real-time reports, and detailed analytics.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <Shield className="w-6 h-6 text-pink-500 mb-3" />
            <h3 className="text-base font-bold text-gray-900 mb-2">
              Secure & Private
            </h3>
            <p className="text-sm text-gray-600">
              Enterprise-grade security with role-based access control and industry-standard encryption.
            </p>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="max-w-5xl mx-auto w-full">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl px-8 py-6 text-white">
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold">100%</div>
                <div className="text-indigo-100 text-sm">Data Privacy</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">
                  {loading ? '...' : stats.users}
                </div>
                <div className="text-indigo-100 text-sm">Users Joined</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">
                  {loading ? '...' : stats.businesses}
                </div>
                <div className="text-indigo-100 text-sm">Businesses</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-6 border-t border-gray-200">
        <div className="flex flex-col md:flex-row items-center justify-between text-sm text-gray-500 gap-2">
          <p>&copy; 2026 AXION. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a
              href="https://instagram.com/imamabdrsyd"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-600 transition-colors"
            >
              @imamabdrsyd
            </a>
            <a
              href="mailto:imam.isyida@gmail.com"
              className="hover:text-indigo-600 transition-colors"
            >
              imam.isyida@gmail.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
