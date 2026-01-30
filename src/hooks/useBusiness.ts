'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import type { Business } from '@/types';

interface UseBusinessReturn {
  user: any;
  business: Business | null;
  businessId: string | null;
  loading: boolean;
  error: string | null;
}

export function useBusiness(): UseBusinessReturn {
  const [user, setUser] = useState<any>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchUserAndBusiness = async () => {
      try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          router.push('/login');
          return;
        }

        setUser(user);

        // Get user's business role
        const { data: roleData, error: roleError } = await supabase
          .from('user_business_roles')
          .select('business_id, businesses(*)')
          .eq('user_id', user.id)
          .single();

        if (roleError) {
          // User might not have a business yet
          if (roleError.code === 'PGRST116') {
            setError('Anda belum memiliki bisnis. Silakan setup bisnis terlebih dahulu.');
          } else {
            setError(roleError.message);
          }
          setLoading(false);
          return;
        }

        if (roleData) {
          setBusinessId(roleData.business_id);
          if (roleData.businesses) {
            setBusiness(roleData.businesses as unknown as Business);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Terjadi kesalahan');
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndBusiness();
  }, [router, supabase]);

  return {
    user,
    business,
    businessId,
    loading,
    error,
  };
}
