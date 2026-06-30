// Core type definitions for Katalis Ventura

export type UserRole = 'business_manager' | 'investor' | 'superadmin';

export type TransactionCategory = 'EARN' | 'OPEX' | 'VAR' | 'CAPEX' | 'TAX' | 'FIN';

export type SalesChannel =
  | 'tiktok'
  | 'tokopedia'
  | 'shopee'
  | 'lazada'
  | 'blibli'
  | 'airbnb'
  | 'booking_com'
  | 'traveloka'
  | 'instagram'
  | 'whatsapp'
  | 'sinarmas'
  | 'website'
  | 'offline'
  | 'other';
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
  /** Cloudinary resource_type: 'image' untuk gambar, 'raw' untuk PDF. Default 'image' untuk attachment lama. */
  resource_type?: 'image' | 'raw' | 'video';
  /** Asal lampiran: 'manual' = diupload user, 'ocr' = hasil scan struk. Default 'manual' (lampiran lama). */
  source?: 'manual' | 'ocr';
  /**
   * TRANSIENT — tidak pernah dipersist ke DB. File mentah untuk lampiran yang
   * belum diupload (mode defer upload di form transaksi). uploadPendingAttachments()
   * mengganti entry pending dengan hasil upload + membuang field ini sebelum simpan.
   */
  pendingFile?: File;
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
  /** OCR scan payload captured when a transaction was filled from receipt OCR */
  ocr?: {
    provider: 'google_vision' | 'ocr_space';
    raw_text: string;
    cached: boolean;
    currency_code?: string;
  };
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
  is_stock: boolean;             // EQUITY: tandai akun modal disetor pemilik/investor
  is_dividend: boolean;          // EQUITY: tandai akun Dividen / Prive / Drawing
  is_dividend_payable: boolean;  // LIABILITY: tandai akun Hutang Dividen
  profit_share_pct?: number | null;        // EQUITY is_stock: hak atas laba (%). NULL = ikut % modal disetor
  owner_stock_account_id?: string | null;  // EQUITY is_dividend: akun stock pemiliknya (rekonsiliasi dividen)
  contact_id?: string | null;              // EQUITY is_stock: link pemilik ke business_contacts
  is_cash_equivalent: boolean;   // ASSET: tandai akun sebagai Kas/Setara Kas (Cash Flow basis)
  is_trade_receivable: boolean;  // ASSET: tandai akun sebagai Piutang Usaha (Cash Flow: Operating)
  is_operating_payable: boolean; // LIABILITY: tandai akun sebagai Hutang Operasional (Cash Flow: Operating)
  currency_code?: string;        // Currency tracked by this account, defaults to IDR
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
  contact?: Contact;             // Hydrated: kontak pemilik (untuk akun is_stock dgn contact_id)
}

export type CatalogItemType = 'product' | 'service';

// Katalog produk/jasa terpusat per bisnis. Dipakai sebagai master data saat
// entry transaksi EARN (picker di multi-line form & quick entry).
export interface CatalogItem {
  id: string;
  business_id: string;
  name: string;
  description?: string | null;
  item_type: CatalogItemType;
  default_price: number;
  unit?: string | null;                  // satuan: pcs, jam, malam, dll
  revenue_account_id?: string | null;    // akun pendapatan default (credit saat dijual)
  sku?: string | null;                   // disiapkan untuk fase matching import (belum dipakai)
  // Stok sederhana POS (opt-in). Hanya item track_stock=true yang dikurangi saat checkout.
  track_stock?: boolean;
  stock_qty?: number;
  // Rich display config — dipakai saat item difitur di omni-channel "Produk Unggulan"
  image_url?: string | null;
  image_fit?: 'cover' | 'contain' | null;
  image_position_x?: number | null;      // focal point % (mode cover)
  image_position_y?: number | null;
  link_url?: string | null;              // CTA opsional (Shopee/Tokopedia); kosong → fallback WA
  link_label?: string | null;
  is_active: boolean;
  sort_order: number;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  // Hydrated saat join dengan accounts
  revenue_account?: Account | null;
}

export interface AiKnowledgeImage {
  url: string;
  path: string;       // Cloudinary public_id
  title: string;      // judul gambar
}

/**
 * Field terstruktur fakta bisnis yang sering ditanya calon pelanggan. Diedit di
 * editor terpisah, ditampilkan sebagai ringkasan di atas catatan bebas. Semua opsional.
 */
export interface AiKnowledgeFields {
  hours?: string;     // jam buka
  location?: string;  // lokasi
  policies?: string;  // kebijakan
  faq?: string;       // FAQ
  images?: AiKnowledgeImage[]; // daftar gambar pendukung (maks 3)
}

/**
 * Pengetahuan bisnis level-bisnis yang dibaca AI saat membalas lead di semua
 * channel. Berisi FAKTA bisnis (jam buka, lokasi, kebijakan, FAQ) — melengkapi
 * channel_integrations.ai_persona yang per-channel & soal nada bicara. 1:1 dengan businesses.
 */
export interface BusinessAiKnowledge {
  id: string;
  business_id: string;
  content: string;
  fields: AiKnowledgeFields;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
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
  base_currency_code?: string | null;
  property_address?: string;
  property_details?: Record<string, any>;
  logo_url?: string;
  logo_fit?: 'cover' | 'contain' | null;
  qris_image_url?: string | null; // Foto QRIS statis untuk pembayaran POS (Cloudinary)
  invoice_settings?: InvoiceSettings | null;
  is_archived: boolean;
  // Omnichannel widget (landing page)
  city?: string | null;
  whatsapp_number?: string | null;
  widget_action_label?: string | null;
  is_public?: boolean | null;
  show_in_logo_slide?: boolean | null;
  closed_until_date?: string | null; // Period lock: transaksi <= tanggal ini tidak bisa diedit/dihapus
  operations_start_date?: string | null; // Tanggal mulai operasi. Jika di-set, periode ROI di dashboard dihitung dari tanggal ini.
  legal_name?: string | null; // Nama legal sesuai akta (mis. "PT Elvéa Indonesia")
  legal_entity_type?: string | null; // Bentuk badan usaha (PT, CV, UD, Perorangan, dll.)
  registered_address?: string | null; // Alamat terdaftar pada akta / izin usaha
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
  currency_code?: string | null;
  original_debit_amount?: number | null;
  original_credit_amount?: number | null;
  fx_rate?: number | null;
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
  currency_code?: string;
  original_debit_amount?: number | null;
  original_credit_amount?: number | null;
  fx_rate?: number | null;
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
  /** Original transaction amount in `currency_code`; `amount` stays functional IDR. */
  original_amount?: number | null;
  /** ISO-4217 currency code for the original transaction amount. */
  currency_code?: string | null;
  /** Functional currency conversion rate: IDR per 1 unit of `currency_code`. */
  fx_rate?: number | null;
  fx_rate_date?: string | null;
  /** Realized FX gain/loss in IDR. Positive = gain, negative = loss. */
  fx_gain_loss_amount?: number | null;
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

  // Sales channel (untuk EARN transactions)
  sales_channel?: SalesChannel | null;

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
  ebitda: number;
  ebitdaMargin: number;
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

// ==================== STATEMENT OF CHANGES IN EQUITY (SCE) ====================

/** Kolom modal per pemilik (akun is_stock) dalam SCE: saldo awal → mutasi → saldo akhir. */
export interface SCEOwnerColumn {
  stockAccountId: string;
  ownerName: string;            // account_name akun stock
  contactId: string | null;     // accounts.contact_id (link ke business_contacts)
  contactName: string | null;   // nama kontak ter-hidrasi (fallback ke ownerName bila null)
  capitalOpening: number;
  capitalAdditions: number;     // credit ke akun stock dalam periode
  capitalWithdrawals: number;   // debit ke akun stock dalam periode (rare)
  capitalClosing: number;
  capitalSharePct: number;      // % modal disetor (cap table) = capitalClosing / total modal
  profitSharePct: number;       // dari profit_share_pct, fallback ke % modal (cap table)
  profitShareIsExplicit: boolean; // true bila dari profit_share_pct, false bila fallback % modal
}

/** Rekonsiliasi hak dividen (entitled) vs dividen aktual yang sudah dibukukan, per pemilik. */
export interface SCEDividendReconRow {
  stockAccountId: string;
  ownerName: string;
  entitled: number;             // profitSharePct × netIncome
  actual: number;               // sum debit akun is_dividend yang owner_stock_account_id = stockAccountId, dalam periode
  declaredOutstanding: number;  // porsi actual yang masih menjadi Hutang Dividen
  variance: number;             // entitled - actual (positif = belum dibagikan penuh)
}

export interface SCEData {
  periodStart: string;
  periodEnd: string;
  owners: SCEOwnerColumn[];
  retainedOpening: number;
  netIncome: number;            // laba periode (revenue - expense periode berjalan)
  dividendsDeclared: number;    // total dividen periode (mengurangi RE)
  retainedClosing: number;
  dividendReconciliation: SCEDividendReconRow[];
  totalEquityOpening: number;
  totalEquityClosing: number;
  isReconciled: boolean;        // SCE closing == BS equity (dalam toleransi)
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
  subtitle?: string | null;
  url: string;
  is_active: boolean;
  is_primary: boolean;
  sort_order: number;
  custom_icon_url?: string | null;
  lucide_icon?: string | null;
  display_mode?: 'default' | 'icon_only';
  created_at: string;
  updated_at: string;
}

export interface OmniChannelGalleryImage {
  path: string; // Storage path (untuk delete)
  url: string;  // Public URL (untuk render)
  sort_order: number;
}

export interface OmniChannelShowcaseImage {
  path: string;
  url: string;
  sort_order: number;
}

export type OmniChannelLayoutMode = 'classic' | 'modern' | 'clean';

export interface OmniChannelWidgetLabels {
  date_label?: string;
  checkin_label?: string;
  checkout_label?: string;
  note_label?: string;
  note_placeholder?: string;
  cta_label?: string;
  action_label?: string;
  reservation_subtitle?: string;
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

/**
 * @deprecated Produk Unggulan kini wire dari katalog (lihat `featured_item_ids`).
 * Tipe ini & kolom JSONB `featured_product` dipertahankan hanya untuk back-compat
 * data lama; tidak ditulis/dibaca lagi oleh kode baru.
 */
export interface FeaturedProduct {
  show: boolean;
  name: string;
  description?: string;
  image_url?: string;
  image_fit?: 'cover' | 'contain';
  image_position_x?: number;
  image_position_y?: number;
  price_label?: string;
  link_url?: string;
  link_label?: string;
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
  banner_url?: string | null;
  gallery_images?: OmniChannelGalleryImage[];
  showcase_images?: OmniChannelShowcaseImage[];
  layout_mode?: OmniChannelLayoutMode;
  widget_date_mode?: 'single' | 'double';
  widget_labels?: OmniChannelWidgetLabels;
  show_pricing?: boolean;
  show_gallery?: boolean;
  show_showcase?: boolean;
  show_widget?: boolean;
  show_links?: boolean;
  default_price?: number | null;
  price_unit?: string | null;
  public_url_mode?: 'slug-only' | 'axion-only' | 'both';
  featured_product?: FeaturedProduct | null;
  /** Item katalog yang difitur di widget "Produk Unggulan" (urut sesuai array). */
  featured_item_ids?: string[];
  button_color?: string | null;
  banner_position?: string | null;
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
  tagline?: string | null;
  bio?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  layout_mode?: OmniChannelLayoutMode;
  widget_date_mode?: 'single' | 'double';
  widget_labels?: OmniChannelWidgetLabels;
  show_pricing?: boolean;
  show_gallery?: boolean;
  show_showcase?: boolean;
  show_widget?: boolean;
  show_links?: boolean;
  default_price?: number | null;
  price_unit?: string | null;
  public_url_mode?: 'slug-only' | 'axion-only' | 'both';
  featured_product?: FeaturedProduct | null;
  featured_item_ids?: string[];
  button_color?: string | null;
  banner_position?: string | null;
}

export interface UpsertOmniChannelLinkData {
  channel_type: OmniChannelType;
  label: string;
  subtitle?: string | null;
  url: string;
  is_active: boolean;
  is_primary: boolean;
  sort_order: number;
  custom_icon_url?: string | null;
  lucide_icon?: string | null;
  display_mode?: 'default' | 'icon_only';
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
  /** Transactions linked to this invoice (Migration 086). Hydrated by getInvoiceWithLinks(). */
  linked_transactions?: InvoiceTransactionLink[];
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

/**
 * Junction row linking an invoice to a transaction (Migration 086).
 * Many-to-many: 1 invoice can aggregate N transactions, 1 transaction
 * can only belong to 1 invoice (UNIQUE constraint on transaction_id).
 */
export interface InvoiceTransactionLink {
  id: string;
  invoice_id: string;
  transaction_id: string;
  /** Snapshot outstanding amount saat link dibuat (Rp). */
  linked_amount: number;
  created_at: string;
  created_by: string | null;
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
  /** Multi-line journal template. NULL untuk template single-line. */
  journal_lines: JournalLineInput[] | null;
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
  id_card_attachments: TransactionAttachment[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ==================== LEADS HUB ====================

export type LeadChannel =
  | 'whatsapp'
  | 'airbnb'
  | 'booking_com'
  | 'instagram'
  | 'shopee'
  | 'tokopedia'
  | 'tiktok_shop';

/** 'auto' = AI langsung kirim balasan (WhatsApp), 'draft' = simpan draft utk manual approve (OTA) */
export type AiMode = 'auto' | 'draft';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';

export type LeadMessageDirection = 'inbound' | 'outbound';

export type LeadMessageSender = 'customer' | 'ai' | 'human';

export interface ChannelIntegration {
  id: string;
  business_id: string;
  channel: LeadChannel;
  is_active: boolean;
  /** ID akun di platform eksternal (mis. WhatsApp phone_number_id) — dipakai webhook utk lookup bisnis */
  external_account_id?: string | null;
  config?: Record<string, unknown> | null;
  ai_enabled: boolean;
  ai_mode: AiMode;
  /** Instruksi tone/persona tambahan untuk system prompt AI */
  ai_persona?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface Lead {
  id: string;
  business_id: string;
  channel: LeadChannel;
  /** Identitas kontak di platform eksternal: no WA (wa_id) / thread id OTA */
  external_id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  status: LeadStatus;
  last_message_at?: string | null;
  /** Waktu pesan inbound (customer) terakhir — sinyal unread. */
  last_inbound_at?: string | null;
  /** Waktu thread terakhir dibuka tim; lead unread jika < last_inbound_at. */
  last_read_at?: string | null;
  assigned_to?: string | null;
  meta?: Record<string, unknown> | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  // Hydrated join
  messages?: LeadMessage[];
}

export interface LeadMessageMeta {
  /** true = draft balasan AI yang belum dikirim (tunggu approve manager) */
  is_draft?: boolean;
  [key: string]: unknown;
}

export interface LeadMessage {
  id: string;
  lead_id: string;
  business_id: string;
  direction: LeadMessageDirection;
  sender: LeadMessageSender;
  content: string;
  /** ID pesan di platform eksternal (mis. wamid WhatsApp) — dedup webhook retry */
  external_message_id?: string | null;
  meta?: LeadMessageMeta | null;
  created_by?: string | null;
  created_at: string;
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
