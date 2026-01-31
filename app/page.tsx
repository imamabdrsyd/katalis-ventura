'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Briefcase, TrendingUp, Shield } from 'lucide-react';

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
              for your Private Equity
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
            <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
              <Briefcase className="w-7 h-7 text-indigo-600" />
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
            <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
              <TrendingUp className="w-7 h-7 text-purple-600" />
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
            <div className="w-14 h-14 bg-pink-100 rounded-xl flex items-center justify-center mb-4">
              <Shield className="w-7 h-7 text-pink-600" />
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

        {/* Contact Developer Section */}
        <div className="mt-32 max-w-4xl mx-auto">
          <div className="bg-white rounded-3xl p-12 shadow-sm border border-gray-200">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Get in Touch</h2>
              <p className="text-gray-600">Have questions or want to collaborate? Reach out to the developer</p>
            </div>

            <div className="max-w-2xl mx-auto">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                {/* Developer Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-24 h-24 rounded-full overflow-hidden">
                    <Image
                      src="/images/Imam.jpeg"
                      alt="Imam Abdurasyid"
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {/* Developer Info */}
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">Imam Abdurasyid</h3>
                  <p className="text-indigo-600 font-medium mb-4">Software Developer, CEO Katalis Ventura</p>

                  <div className="space-y-3">
                    {/* Instagram */}
                    <a
                      href="https://instagram.com/imamabdrsyd"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center md:justify-start gap-3 text-gray-700 hover:text-indigo-600 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                      <span>@imamabdrsyd</span>
                    </a>

                    {/* Location */}
                    <div className="flex items-center justify-center md:justify-start gap-3 text-gray-700">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Bandung, Indonesia</span>
                    </div>

                    {/* Email */}
                    <a
                      href="mailto:imam.isyida@gmail.com"
                      className="flex items-center justify-center md:justify-start gap-3 text-gray-700 hover:text-indigo-600 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span>imam.isyida@gmail.com</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-12 mt-32 border-t border-gray-200">
        <div className="text-center text-gray-600">
          <p>&copy; 2025 Katalis Ventura. All rights reserved.</p>
          <p className="text-sm mt-2">Developed with ❤️ by Imam Abdurasyid</p>
        </div>
      </footer>
    </div>
  );
}
