'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AuthError]', error);
  }, [error]);

  return (
    <div className="w-full max-w-sm text-center space-y-5">
      <div className="flex justify-center">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Terjadi Kesalahan</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Gagal memuat halaman autentikasi. Coba lagi.
        </p>
      </div>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Coba Lagi
      </button>
    </div>
  );
}
