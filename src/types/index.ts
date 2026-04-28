// Core type definitions for Katalis Ventura

export type UserRole = 'business_manager' | 'investor' | 'both' | 'superadmin';

export type TransactionCategory = 'EARN' | 'OPEX' | 'VAR' | 'CAPEX' | 'TAX' | 'FIN';
export type TransactionStatus = 'draft' | 'posted';

// Double-entry bookkeeping types
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type NormalBalance = 'DEBIT' | 'CREDIT';

// Transaction metadata (stored as jsonb in DB)
export interface UnitBreakdown {
  price_per_unit: number;
  quantity: number;
  unit: string; // e.g. 'pcs', 'gram', 'galon', 'ikat', 'orang', 'trip', or custom
}

export interface TransactionAttachment {
  /** Storage path for deletion */
  path: string;
  /** Public URL of the file */
  url: string;
  /** Original filename */
  filename: string;
  /** File size in bytes */
  size: number;
  /** MIME type (e.g. image/jpeg, application/pdf) */
  mime_type: string;
  /** ISO timestamp of upload */
  uploaded_at: string;
}

export interface TransactionMeta {
  /** IDs of stock transactions that were sold/converted to COGS alongside this sale */
  sold_stock_ids?: string[];
  /** Unit breakdown when amount is calculated via multiplication */
  unit_breakdown?: UnitBreakdown;
  /** Journal entry type selected when creating the transaction */
  entry_type?: {
    id: string;
    label: string;
    description: string;
  };
  /** Free-text tags for categorization and filtering */
  tags?: string[];
  /** ID transaksi pelunasan penuh yang menyelesaikan piutang ini */
  settled_by_transaction_id?: string;
  /** ID transaksi piutang asli yang di-settle oleh entry ini */
  settlement_of_transaction_id?: string;
  /** Daftar ID transaksi pelunasan sebagian (partial payment) */
  partial_settlements?: string[];
  /** Sisa piutang yang belum terbayar setelah pelunasan sebagian (Rp) */
  remaining_amount?: number;
  /** Jumlah yang dilunasi pada transaksi settlement ini (untuk partial) */
  settlement_amount?: number;
  /** Dokumen sumber / bukti transaksi (faktur, nota, kuitansi) — legacy single */
  attachment?: TransactionAttachment;
  /** Dokumen sumber multi-file (maks 3) — menggantikan attachment */
  attachments?: TransactionAttachment[];
  /** ID recurring template yang men-generate transaksi ini */
  recurring_template_id?: string;
}

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
  is_retained_earnings: boolean;
  sort_order: number;
  description?: string;
  default_category?: TransactionCategory; // Optional: Auto-detected category for transactions
  income_statement_section?: 'cost_of_revenue' | 'operating_expense' | null; // Override klasifikasi Income Statement
  // Depreciation fields (PSAK 16 / IAS 16) — only for ASSET + CAPEX accounts
  useful_life_months?: number;        // Masa manfaat dalam bulan
  residual_value?: number;            // Nilai residu
  depreciation_method?: string;       // 'straight_line' (default)
  acquisition_date?: string;          // Tanggal perolehan (ISO date string)
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
  business_sector: string;
  business_type?: string;
  capital_investment: number;
  property_address?: string;
  property_details?: Record<string, any>;
  logo_url?: string;
  invoice_settings?: InvoiceSettings | null;
  is_archived: boolean;
  // Omnichannel widget (landing page)
  city?: string | null;
  whatsapp_number?: string | null;
  widget_action_label?: string | null;
  is_public?: boolean | null;
  closed_until_date?: string | null; // Period lock: transaksi <= tanggal ini tidak bisa diedit/dihapus
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by?: string;
}

// One line in a multi-line journal entry
export interface JournalLine {
  id: string;
  transaction_id: string;
  account_id: string;
  debit_amount: number;   // > 0 for debit lines, 0 for credit lines
  credit_amount: number;  // > 0 for credit lines, 0 for debit lines
  description?: string | null;
  sort_order: number;
  created_at: string;
  // Populated when joining with accounts table
  account?: Account;
}

// Input type for creating/updating journal lines
export interface JournalLineInput {
  account_id: string;
  debit_amount: number;
  credit_amount: number;
  description?: string;
  sort_order: number;
}

export interface Transaction {
  id: string;
  transaction_number?: string | null;
  business_id: string;
  date: string;
  category: TransactionCategory;
  name: string;
  description: string;
  amount: number;
  account: string; // Legacy field for backward compatibility
  status: TransactionStatus;
  posted_at?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;

  // Contact linkage (AR/AP tracking)
  contact_id?: string | null;
  contact?: Contact;

  // Optional double-entry fields (simple 1-debit / 1-credit)
  debit_account_id?: string;
  credit_account_id?: string;
  is_double_entry?: boolean;

  // Multi-line journal entry (N-debit / M-credit, balanced)
  is_multi_line?: boolean;
  journal_lines?: JournalLine[];

  notes?: string;
  meta?: TransactionMeta | null;

  // Bank reconciliation
  is_reconciled?: boolean;
  reconciled_at?: string | null;
  reconciled_by?: string | null;

  // Import batch (diisi saat dibuat via bulk import)
  import_batch_id?: string | null;

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
  totalDepreciation: number; // Beban penyusutan periode (PSAK 16 straight-line, calculated on-the-fly)
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
    fixedAssets: number;               // Nilai perolehan (cost)
    accumulatedDepreciation: number;   // Akumulasi penyusutan (positive value, displayed as contra-asset)
    netFixedAssets: number;            // fixedAssets - accumulatedDepreciation
    totalFixedAssets: number;          // = netFixedAssets
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

export interface CashFlowTransaction {
  id: string;
  date: string;
  name: string;
  description: string;
  amount: number; // positive = cash in, negative = cash out
  category: TransactionCategory;
  debitAccount?: string;
  creditAccount?: string;
}

export interface CashFlowData {
  operating: number;
  investing: number;
  financing: number;
  netCashFlow: number;
  openingBalance: number;
  closingBalance: number;
  operatingTransactions: CashFlowTransaction[];
  investingTransactions: CashFlowTransaction[];
  financingTransactions: CashFlowTransaction[];
}

// Omni-Channel types
export type OmniChannelType =
  | 'instagram' | 'facebook' | 'tiktok' | 'twitter' | 'youtube' | 'linkedin'
  | 'shopee' | 'tokopedia' | 'lazada' | 'bukalapak' | 'blibli'
  | 'whatsapp' | 'telegram' | 'line'
  | 'custom';

export interface OmniChannelLink {
  id: string;
  omni_channel_id: string;
  channel_type: OmniChannelType;
  label: string;
  url: string;
  is_active: boolean;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OmniChannelGalleryImage {
  path: string; // Storage path (untuk delete)
  url: string;  // Public URL (untuk render)
  sort_order: number;
}

export interface OmniChannelWidgetLabels {
  date_label?: string;
  checkin_label?: string;
  checkout_label?: string;
  note_label?: string;
  note_placeholder?: string;
  cta_label?: string;
  action_label?: string;
}

export interface PricingRule {
  id: string;
  omni_channel_id: string;
  date_from: string; // YYYY-MM-DD
  date_to: string;   // YYYY-MM-DD
  price: number;
  label?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertPricingRuleData {
  date_from: string;
  date_to: string;
  price: number;
  label?: string | null;
}

export interface BusinessOmniChannel {
  id: string;
  business_id: string;
  slug: string;
  is_published: boolean;
  title: string;
  tagline?: string;
  bio?: string;
  logo_url?: string;
  gallery_images?: OmniChannelGalleryImage[];
  widget_date_mode?: 'single' | 'double';
  widget_labels?: OmniChannelWidgetLabels;
  show_pricing?: boolean;
  default_price?: number | null;
  price_unit?: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by?: string;
  links?: OmniChannelLink[];
  pricing_rules?: PricingRule[];
}

export interface UpsertOmniChannelData {
  slug: string;
  is_published: boolean;
  title: string;
  tagline?: string;
  bio?: string;
  logo_url?: string | null;
  widget_date_mode?: 'single' | 'double';
  widget_labels?: OmniChannelWidgetLabels;
  show_pricing?: boolean;
  default_price?: number | null;
  price_unit?: string | null;
}

export interface UpsertOmniChannelLinkData {
  channel_type: OmniChannelType;
  label: string;
  url: string;
  is_active: boolean;
  is_primary: boolean;
  sort_order: number;
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

// ==================== INVOICE ====================

export type InvoicePaymentStatus = 'draft' | 'unpaid' | 'paid' | 'overdue';
export type InvoiceTaxType = 'included' | 'excluded' | 'none';

export interface Invoice {
  id: string;
  business_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_id_label: string | null;
  description: string | null;
  item_label: string | null; // custom column header for line items table
  subtotal: number;
  tax_type: InvoiceTaxType;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  payment_status: InvoicePaymentStatus;
  notes: string | null;
  meta: Record<string, unknown> | null;
  transaction_id: string | null;
  contact_id: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  line_items?: InvoiceLineItem[];
  contact?: Contact;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface InvoiceFormData {
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  customer_name: string;
  customer_phone: string;
  customer_id_label: string;
  description: string;
  item_label: string;
  line_items: {
    item_name: string;
    quantity: number;
    unit_price: number;
  }[];
  tax_type: InvoiceTaxType;
  tax_rate: number;
  notes: string;
}

export interface InvoiceSettings {
  prefix: string;
  default_due_days: number;
  default_tax_rate: number;
  default_tax_type: InvoiceTaxType;
  bank_name: string;
  bank_account_number: string;
  bank_account_holder: string;
  contact_number: string;
}

// ==================== BUDGET & FORECAST ====================

export type BudgetStatus = 'draft' | 'approved' | 'locked';

export interface Budget {
  id: string;
  business_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: BudgetStatus;
  notes: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  lines?: BudgetLine[];
}

export interface BudgetLine {
  id: string;
  budget_id: string;
  account_id: string;
  month: string;
  amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  account?: Account;
}

export interface BudgetFormData {
  name: string;
  start_date: string;
  end_date: string;
  notes: string;
}

export interface BudgetLineInput {
  account_id: string;
  month: string;
  amount: number;
  notes?: string;
}

export interface BudgetVsActualRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  month: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
}

export interface BudgetSummaryKPI {
  totalBudgetedRevenue: number;
  totalActualRevenue: number;
  totalBudgetedExpense: number;
  totalActualExpense: number;
  revenueVariance: number;
  expenseVariance: number;
  revenueVariancePercent: number;
  expenseVariancePercent: number;
  burnRate: number;
  monthsRemaining: number;
  budgetUtilization: number;
}

export interface ProjectedMonth {
  month: string;
  budgeted: number;
  actual: number;
  projected: number;
}

// ==================== TRANSACTION TEMPLATES ====================

export interface TransactionTemplate {
  id: string;
  business_id: string;
  name: string;
  category: TransactionCategory;
  description: string | null;
  default_amount: number | null;
  debit_account_id: string | null;
  credit_account_id: string | null;
  is_double_entry: boolean;
  created_by: string | null;
  created_at: string;
}

// ==================== RECURRING TRANSACTIONS ====================

export type RecurringFrequency = 'weekly' | 'monthly' | 'yearly';
export type RecurringStatus = 'active' | 'paused' | 'stopped';

export interface RecurringTransaction {
  id: string;
  business_id: string;

  // Template fields
  name: string;
  description: string;
  amount: number;
  category: TransactionCategory;
  account: string;
  debit_account_id?: string;
  credit_account_id?: string;
  is_double_entry?: boolean;
  notes?: string;
  meta?: TransactionMeta | null;

  // Schedule
  frequency: RecurringFrequency;
  interval_value: number;
  next_due_date: string;
  end_date?: string | null;

  // State
  status: RecurringStatus;
  last_generated_date?: string | null;
  total_generated: number;

  // Audit
  created_by: string;
  created_at: string;
  updated_at: string;

  // Populated via join
  debit_account?: Account;
  credit_account?: Account;
}

// ==================== CONTACTS ====================

export type ContactType = 'customer' | 'vendor' | 'partner' | 'staff' | 'investor' | 'other';

export interface Contact {
  id: string;
  business_id: string;
  name: string;
  type: ContactType;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ==================== AR/AP AGING ====================

export type AgingBucket = 'current' | '31-60' | '61-90' | '91-120' | '120+';

export interface AgingRow {
  contactId: string | null;
  contactName: string;
  contactType: ContactType | null;
  current: number;    // current (0-30 hari)
  bucket30: number;   // 31-60 hari
  bucket60: number;   // 61-90 hari
  bucket90: number;   // 91-120 hari
  bucketOver90: number; // >90 hari
  total: number;
  oldestDate: string | null;
}

export interface ArApSummary {
  totalCurrent: number;
  total30: number;
  total60: number;
  total90: number;
  totalOver90: number;
  grandTotal: number;
  rows: AgingRow[];
}

export interface RepaymentRow {
  id: string;
  date: string;
  contactName: string;
  contactId: string | null;
  contactType: ContactType | null;
  description: string;
  amount: number;
  /** 'ap' = bisnis bayar hutang, 'ar' = pihak lain bayar piutang ke bisnis */
  type: 'ap' | 'ar';
}

export interface RepaymentSummary {
  rows: RepaymentRow[];
  totalApRepaid: number;
  totalArCollected: number;
  totalApRepaidNonSettlement: number;
  totalArCollectedNonSettlement: number;
}
