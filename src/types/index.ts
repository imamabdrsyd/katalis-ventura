// Core type definitions for Katalis Ventura

export type UserRole = 'business_manager' | 'investor' | 'both';

export type TransactionCategory = 'EARN' | 'OPEX' | 'VAR' | 'CAPEX' | 'TAX' | 'FIN';

// Double-entry bookkeeping types
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type NormalBalance = 'DEBIT' | 'CREDIT';

export interface Account {
  id: string;
  business_id: string;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  parent_account_id?: string;
  normal_balance: NormalBalance;
  is_active: boolean;
  is_system: boolean;
  sort_order: number;
  description?: string;
  default_category?: TransactionCategory; // Optional: Auto-detected category for transactions
  created_at: string;
  updated_at: string;
  updated_by?: string;
}

export interface CategoryAccountSuggestion {
  category: TransactionCategory;
  defaultDebitCode: string;
  defaultCreditCode: string;
  description: string;
}

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
  updated_by?: string;
}

export interface Transaction {
  id: string;
  business_id: string;
  date: string;
  category: TransactionCategory;
  name: string;
  description: string;
  amount: number;
  account: string; // Legacy field for backward compatibility
  created_by: string;
  created_at: string;
  updated_at: string;

  // Optional double-entry fields
  debit_account_id?: string;
  credit_account_id?: string;
  is_double_entry?: boolean;
  notes?: string;

  // Audit trail fields
  updated_by?: string;
  deleted_at?: string | null;
  deleted_by?: string | null;

  // Populated when joining with accounts table
  debit_account?: Account;
  credit_account?: Account;
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
  updated_by?: string;
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

// Derived income statement metrics (single source of truth)
export interface IncomeStatementMetrics {
  operatingIncome: number;
  ebt: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
}

// Financial calculation types
export interface FinancialSummary {
  totalEarn: number;
  totalOpex: number;
  totalVar: number;
  totalCapex: number;
  totalTax: number;
  totalFin: number; // All FIN transactions (for cash flow, includes equity/liability movements)
  totalInterest: number; // Only FIN transactions that are EXPENSE type (interest/financing costs for income statement)
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
  fin: number; // All FIN transactions (for display/tracking)
  interest: number; // Only interest expense (for net profit calculation)
  netProfit: number;
}

export interface BalanceSheetData {
  assets: {
    cash: number;
    inventory: number;
    receivables: number;
    otherCurrentAssets: number;
    totalCurrentAssets: number;
    fixedAssets: number;
    totalFixedAssets: number;
    totalAssets: number;
  };
  liabilities: {
    loans: number;
    totalLiabilities: number;
  };
  equity: {
    capital: number;          // Credit movements to EQUITY accounts (suntik modal)
    drawings: number;         // Debit movements from EQUITY accounts (prive/dividen) — positive value, subtracted
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

// Audit trail types
export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  changed_by: string | null;
  changed_at: string;
  metadata: Record<string, any>;
  // Populated when joining with profiles table (from audit_trail_with_users view)
  changed_by_name?: string;
  changed_by_avatar?: string;
}
