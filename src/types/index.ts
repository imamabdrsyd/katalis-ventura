// Core type definitions for Katalis Ventura

export type UserRole = 'business_manager' | 'investor' | 'both';

export type TransactionCategory = 'EARN' | 'OPEX' | 'VAR' | 'CAPEX' | 'TAX' | 'FIN';

export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: Business;
        Insert: Omit<Business, 'id' | 'created_at' | 'updated_at' | 'is_archived'>;
        Update: Partial<Omit<Business, 'id' | 'created_at'>>;
      };
      transactions: {
        Row: Transaction;
        Insert: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Transaction, 'id' | 'created_at'>>;
      };
      user_business_roles: {
        Row: UserBusinessRole;
        Insert: Omit<UserBusinessRole, 'id' | 'joined_at'>;
        Update: Partial<Omit<UserBusinessRole, 'id'>>;
      };
      investor_metrics: {
        Row: InvestorMetric;
        Insert: Omit<InvestorMetric, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<InvestorMetric, 'id' | 'created_at'>>;
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
      };
    };
  };
}

export interface Business {
  id: string;
  business_name: string;
  business_type: string;
  capital_investment: number;
  property_address?: string;
  property_details?: Record<string, any>;
  is_archived: boolean;
  created_at: string;
  created_by: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  business_id: string;
  date: string;
  category: TransactionCategory;
  description: string;
  amount: number;
  account: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface UserBusinessRole {
  id: string;
  user_id: string;
  business_id: string;
  role: UserRole;
  joined_at: string;
  invited_by?: string;
  business?: Business;
}

export interface InvestorMetric {
  id: string;
  investor_id: string;
  business_id: string;
  metric_name: string;
  metric_formula: MetricFormula;
  target_value?: number;
  alert_threshold?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MetricFormula {
  type: 'roi' | 'margin' | 'ratio' | 'custom';
  period?: 'monthly' | 'quarterly' | 'yearly';
  numerator: string;
  denominator?: string;
  multiplier?: number;
}

export interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
  default_role?: UserRole;
  created_at: string;
  updated_at: string;
}

export interface InviteCode {
  id: string;
  business_id: string;
  code: string;
  role: 'business_manager' | 'investor';
  created_by: string;
  expires_at?: string;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  created_at: string;
}

// Financial calculation types
export interface FinancialSummary {
  totalEarn: number;
  totalOpex: number;
  totalVar: number;
  totalCapex: number;
  totalTax: number;
  totalFin: number;
  netProfit: number;
  grossProfit: number;
}

export interface MonthlyData {
  month: string;
  earn: number;
  opex: number;
  var: number;
  capex: number;
  tax: number;
  fin: number;
  netProfit: number;
}

export interface BalanceSheetData {
  assets: {
    cash: number;
    propertyValue: number;
    totalAssets: number;
  };
  liabilities: {
    loans: number;
    totalLiabilities: number;
  };
  equity: {
    capital: number;
    retainedEarnings: number;
    totalEquity: number;
  };
}

export interface CashFlowData {
  operating: number;
  investing: number;
  financing: number;
  netCashFlow: number;
  openingBalance: number;
  closingBalance: number;
}
