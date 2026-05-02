'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileQuestion, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
            <FileQuestion className="w-8 h-8 text-indigo-500" />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-6xl font-black text-indigo-600 dark:text-indigo-400">404</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Halaman Tidak Ditemukan</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Halaman yang kamu cari tidak ada atau sudah dipindahkan.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            Ke Dashboard
          </Link>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </button>
        </div>
      </div>
    </div>
  );
}
