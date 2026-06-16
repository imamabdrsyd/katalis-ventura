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
import { normalizeRole, pickHighestRole, isManagerRole } from '@/lib/roles';
import { useLeadCounts, type LeadCounts } from '@/hooks/useLeadCounts';
import type { AuthUser } from '@supabase/supabase-js';
import type { Business, UserRole } from '@/types';

const ACTIVE_BUSINESS_KEY = 'katalis_active_business_id';
const DISPLAY_ROLE_KEY = 'katalis_superadmin_display_role';

interface BusinessContextType {
  user: AuthUser | null;
  userRole: UserRole | null;
  displayRole: UserRole | null;
  isSuperadmin: boolean;
  businesses: Business[];
  activeBusiness: Business | null;
  activeBusinessId: string | null;
  setActiveBusiness: (businessId: string) => void;
  switchRole: (role: UserRole) => void;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Jumlah lead baru (status='new') per bisnis + total — untuk badge notifikasi. */
  leadCounts: LeadCounts;
  refreshLeadCounts: () => Promise<void>;
}

const BusinessContext = createContext<BusinessContextType | null>(null);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [displayRole, setDisplayRole] = useState<UserRole | null>(null);
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

      // Batch profile + membership queries in parallel
      const [profileResult, rolesResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('default_role')
          .eq('id', user.id)
          .single(),
        supabase
          .from('user_business_roles')
          .select('role, business_id')
          .eq('user_id', user.id),
      ]);

      const { data: profile } = profileResult;
      const { data: rolesData, error: rolesError } = rolesResult;

      // Collect all business IDs the user is linked to (member or creator)
      const memberBusinessIds = (rolesData || []).map((r) => r.business_id);

      // Fetch all businesses in one query with select('*') so every column
      // (including business_type) is always present — avoids join stripping columns
      const { data: createdBusinessesData } = await supabase
        .from('businesses')
        .select('*')
        .eq('created_by', user.id);

      const allBusinessIds = Array.from(
        new Set([...memberBusinessIds, ...(createdBusinessesData || []).map((b) => b.id)])
      );

      const { data: allBusinessesData } = allBusinessIds.length > 0
        ? await supabase.from('businesses').select('*').in('id', allBusinessIds)
        : { data: [] };

      const userIsSuperadmin = normalizeRole(profile?.default_role) === 'superadmin';
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

      if ((!rolesData || rolesData.length === 0) && (!createdBusinessesData || createdBusinessesData.length === 0)) {
        // Check profile first, then fallback to user metadata
        const defaultRole = normalizeRole(profile?.default_role || user.user_metadata?.default_role);

        if (!defaultRole) {
          // User baru via Google OAuth — belum pilih role
          router.push('/select-role');
        } else if (defaultRole === 'investor') {
          router.push('/join-business');
        } else if (defaultRole === 'superadmin') {
          router.push('/join-business');
        } else {
          router.push('/setup-business');
        }
        return;
      }

      let businessList: Business[];
      let primaryRole: UserRole;

      // Build business list from the full select('*') fetch — ensures all columns
      // (including business_type) are always present regardless of join behaviour.
      businessList = (allBusinessesData || []).filter((b): b is Business => !b.is_archived);

      const roles = (rolesData || []).map((item) => item.role);
      const hasCreatedBusiness = (createdBusinessesData || []).length > 0;
      primaryRole = userIsSuperadmin ? 'superadmin' : pickHighestRole(
        hasCreatedBusiness ? [...roles, 'business_manager'] : roles
      );

      setBusinesses(businessList);
      setUserRole(primaryRole);
      setIsSuperadmin(primaryRole === 'superadmin');
      const savedDisplayRole = typeof window !== 'undefined'
        ? normalizeRole(localStorage.getItem(DISPLAY_ROLE_KEY))
        : null;
      setDisplayRole(primaryRole === 'superadmin' ? savedDisplayRole || 'superadmin' : primaryRole);

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

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  // Lead baru per bisnis untuk badge — hanya manager yang menindaklanjuti lead.
  const businessIds = useMemo(() => businesses.map((b) => b.id), [businesses]);
  const { leadCounts, refreshLeadCounts } = useLeadCounts(
    businessIds,
    isManagerRole(userRole)
  );

  const switchRole = useCallback(
    (role: UserRole) => {
      if (!isSuperadmin) {
        setDisplayRole(userRole);
        return;
      }

      setDisplayRole(role);
      if (typeof window !== 'undefined') {
        localStorage.setItem(DISPLAY_ROLE_KEY, role);
      }
    },
    [isSuperadmin, userRole]
  );

  const contextValue = useMemo(() => ({
    user,
    userRole,
    displayRole,
    isSuperadmin,
    businesses,
    activeBusiness,
    activeBusinessId,
    setActiveBusiness,
    switchRole,
    loading,
    error,
    refetch,
    leadCounts,
    refreshLeadCounts,
  }), [user, userRole, displayRole, isSuperadmin, businesses, activeBusiness, activeBusinessId, setActiveBusiness, switchRole, loading, error, refetch, leadCounts, refreshLeadCounts]);

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
