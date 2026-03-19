import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { initDatabase } from '@/db';
import type { Business, UserBusinessRole } from '@shared/types';

interface BusinessContextType {
  businesses: Business[];
  activeBusiness: Business | null;
  activeBusinessId: string | null;
  isLoading: boolean;
  setActiveBusiness: (businessId: string) => Promise<void>;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

const STORAGE_KEY = 'katalis_active_business_id';

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch businesses when user logs in
  useEffect(() => {
    if (!user || authLoading) return;

    const fetchBusinesses = async () => {
      try {
        setIsLoading(true);

        // Initialize WatermelonDB
        initDatabase();

        // Fetch user_business_roles with joined businesses
        const { data: roles, error } = await supabase
          .from('user_business_roles')
          .select('business_id, role, businesses(id, business_name, business_type, capital_investment)')
          .eq('user_id', user.id);

        if (error) throw error;

        const businessList = roles?.map((role: any) => role.businesses).filter(Boolean) as Business[] || [];
        setBusinesses(businessList);

        // Try to restore last active business
        const savedBusinessId = await AsyncStorage.getItem(STORAGE_KEY);
        const businessToSelect = businessList.find((b) => b.id === savedBusinessId) || businessList[0];

        if (businessToSelect) {
          setActiveBusinessId(businessToSelect.id);
          setActiveBusiness(businessToSelect);
        }
      } catch (error) {
        console.error('Error fetching businesses:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBusinesses();
  }, [user, authLoading]);

  const switchBusiness = async (businessId: string) => {
    const business = businesses.find((b) => b.id === businessId);
    if (!business) return;

    setActiveBusinessId(businessId);
    setActiveBusiness(business);
    await AsyncStorage.setItem(STORAGE_KEY, businessId);
  };

  return (
    <BusinessContext.Provider
      value={{
        businesses,
        activeBusiness,
        activeBusinessId,
        isLoading,
        setActiveBusiness: switchBusiness,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (context === undefined) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
}
