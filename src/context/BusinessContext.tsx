'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import * as businessesApi from '@/lib/api/businesses';
import type { Business, UserRole } from '@/types';

const ACTIVE_BUSINESS_KEY = 'katalis_active_business_id';

interface BusinessContextType {
  user: any;
  userRole: UserRole | null;
  businesses: Business[];
  activeBusiness: Business | null;
  activeBusinessId: string | null;
  setActiveBusiness: (businessId: string) => void;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const BusinessContext = createContext<BusinessContextType | null>(null);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusiness, setActiveBusinessState] = useState<Business | null>(null);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push('/login');
        return;
      }

      setUser(user);

      // Get user's businesses with roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_business_roles')
        .select('role, business_id, businesses(*)')
        .eq('user_id', user.id);

      if (rolesError) {
        if (rolesError.code === 'PGRST116') {
          setError('Anda belum memiliki bisnis.');
        } else {
          setError(rolesError.message);
        }
        setLoading(false);
        return;
      }

      if (!rolesData || rolesData.length === 0) {
        // Check user's default role from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('default_role')
          .eq('id', user.id)
          .single();

        // Check profile first, then fallback to user metadata
        const defaultRole = profile?.default_role || user.user_metadata?.default_role;

        if (defaultRole === 'investor') {
          router.push('/join-business');
        } else {
          router.push('/setup-business');
        }
        return;
      }

      // Extract businesses and determine user role
      const businessList = rolesData
        .map((item) => item.businesses as unknown as Business)
        .filter((b): b is Business => b !== null && !b.is_archived);

      // Determine the user's primary role
      const roles = rolesData.map((item) => item.role as UserRole);
      const primaryRole = roles.includes('business_manager')
        ? 'business_manager'
        : roles.includes('both')
        ? 'both'
        : 'investor';

      setBusinesses(businessList);
      setUserRole(primaryRole);

      // Restore active business from localStorage or use first business
      const savedBusinessId =
        typeof window !== 'undefined'
          ? localStorage.getItem(ACTIVE_BUSINESS_KEY)
          : null;

      let selectedBusiness = businessList.find((b) => b.id === savedBusinessId);
      if (!selectedBusiness && businessList.length > 0) {
        selectedBusiness = businessList[0];
      }

      if (selectedBusiness) {
        setActiveBusinessState(selectedBusiness);
        setActiveBusinessId(selectedBusiness.id);
        if (typeof window !== 'undefined') {
          localStorage.setItem(ACTIVE_BUSINESS_KEY, selectedBusiness.id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setActiveBusiness = useCallback(
    (businessId: string) => {
      const business = businesses.find((b) => b.id === businessId);
      if (business) {
        setActiveBusinessState(business);
        setActiveBusinessId(businessId);
        if (typeof window !== 'undefined') {
          localStorage.setItem(ACTIVE_BUSINESS_KEY, businessId);
        }
      }
    },
    [businesses]
  );

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return (
    <BusinessContext.Provider
      value={{
        user,
        userRole,
        businesses,
        activeBusiness,
        activeBusinessId,
        setActiveBusiness,
        loading,
        error,
        refetch,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusinessContext() {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error('useBusinessContext must be used within a BusinessProvider');
  }
  return context;
}
