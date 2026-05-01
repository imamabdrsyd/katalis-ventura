'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import type { AuthUser } from '@supabase/supabase-js';
import type { Business, UserRole } from '@/types';

const ACTIVE_BUSINESS_KEY = 'katalis_active_business_id';
const ACTIVE_ROLE_KEY = 'katalis_active_role';

interface BusinessContextType {
  user: AuthUser | null;
  userRole: UserRole | null;
  isSuperadmin: boolean;
  businesses: Business[];
  activeBusiness: Business | null;
  activeBusinessId: string | null;
  setActiveBusiness: (businessId: string) => void;
  switchRole: (role: UserRole) => void;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const BusinessContext = createContext<BusinessContextType | null>(null);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
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

      // Batch profile + roles queries in parallel (saves ~200-300ms)
      const [profileResult, rolesResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('default_role')
          .eq('id', user.id)
          .single(),
        supabase
          .from('user_business_roles')
          .select('role, business_id, businesses(*)')
          .eq('user_id', user.id),
      ]);

      const { data: profile } = profileResult;
      const { data: rolesData, error: rolesError } = rolesResult;

      const userIsSuperadmin = profile?.default_role === 'superadmin';
      setIsSuperadmin(userIsSuperadmin);

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
        // Check profile first, then fallback to user metadata
        const defaultRole = profile?.default_role || user.user_metadata?.default_role;

        if (!defaultRole) {
          // User baru via Google OAuth — belum pilih role
          router.push('/select-role');
        } else if (defaultRole === 'investor') {
          router.push('/join-business');
        } else if (defaultRole === 'superadmin') {
          // Superadmin tanpa bisnis sendiri — fetch semua bisnis
        } else {
          router.push('/setup-business');
        }
        if (!userIsSuperadmin) return;
      }

      let businessList: Business[];
      let primaryRole: UserRole;

      if (userIsSuperadmin) {
        // Superadmin: fetch ALL businesses
        const { data: allBusinesses, error: allBizError } = await supabase
          .from('businesses')
          .select('*')
          .eq('is_archived', false)
          .order('created_at', { ascending: false });

        if (allBizError) {
          setError(allBizError.message);
          setLoading(false);
          return;
        }

        businessList = (allBusinesses || []) as Business[];
        // Superadmin: restore active role from localStorage or default to 'superadmin'
        const savedRole = typeof window !== 'undefined'
          ? localStorage.getItem(ACTIVE_ROLE_KEY) as UserRole | null
          : null;
        primaryRole = savedRole || 'superadmin';
        // isSuperadmin selalu true untuk superadmin sejati, tidak berubah saat switch role
        setIsSuperadmin(true);
      } else {
        // Extract businesses and determine user role
        businessList = (rolesData || [])
          .map((item) => item.businesses as unknown as Business)
          .filter((b): b is Business => b !== null && !b.is_archived);

        // Determine the user's primary role
        const roles = (rolesData || []).map((item) => item.role as UserRole);
        primaryRole = roles.includes('business_manager')
          ? 'business_manager'
          : roles.includes('both')
          ? 'both'
          : 'investor';
      }

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
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

  const switchRole = useCallback(
    (role: UserRole) => {
      setUserRole(role);
      // isSuperadmin selalu mencerminkan apakah user ini superadmin sejati,
      // tidak berubah saat switch role — superadmin tetap bisa akses semua
      if (typeof window !== 'undefined') {
        localStorage.setItem(ACTIVE_ROLE_KEY, role);
      }
    },
    []
  );

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const contextValue = useMemo(() => ({
    user,
    userRole,
    isSuperadmin,
    businesses,
    activeBusiness,
    activeBusinessId,
    setActiveBusiness,
    switchRole,
    loading,
    error,
    refetch,
  }), [user, userRole, isSuperadmin, businesses, activeBusiness, activeBusinessId, setActiveBusiness, switchRole, loading, error, refetch]);

  return (
    <BusinessContext.Provider value={contextValue}>
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
