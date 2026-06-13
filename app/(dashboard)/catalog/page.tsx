'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBusinessContext } from '@/context/BusinessContext';

/**
 * Route lama /catalog — sekarang di-redirect ke hub sesuai tipe bisnis:
 * jasa → /calendar, produk/dagang (atau tipe kosong) → /point-of-sales.
 * Mencegah bookmark/link lama mati. UI katalog kini hidup di src/components/hub/.
 */
export default function CatalogRedirectPage() {
  const router = useRouter();
  const { activeBusiness, loading } = useBusinessContext();

  useEffect(() => {
    if (loading || !activeBusiness) return;

    const target = activeBusiness?.business_type === 'jasa' ? '/calendar' : '/point-of-sales';
    router.replace(target);
  }, [activeBusiness, loading, router]);

  return (
    <div className="p-6 text-center text-gray-400 dark:text-gray-500 text-sm">…</div>
  );
}
