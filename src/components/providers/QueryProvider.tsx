'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,  // data dianggap "fresh" selama 5 menit
        gcTime: 30 * 60 * 1000,    // cache di-keep di memory 30 menit
      },
    },
  }));

  // Global handler untuk event `transaction-saved` yang dispatch oleh
  // FloatingQuickAdd, EcommerceIntegration, dll. Sebelumnya effect ini
  // didaftar 4× di hook berbeda — sekarang terpusat di sini dan invalidate
  // semua query key yang terkait via prefix match.
  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-paginated'] });
      // financial-cache TanStack entry juga ikut invalid — DB-nya sudah di-mark
      // stale oleh trigger, tapi client cache bisa serve stale value sampai
      // staleTime habis kalau tidak di-invalidate.
      queryClient.invalidateQueries({ queryKey: ['financial-cache'] });
    };
    window.addEventListener('transaction-saved', handler);
    return () => window.removeEventListener('transaction-saved', handler);
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
