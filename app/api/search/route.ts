import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { businessIdSchema } from '@/lib/validations';
import { withRouteTiming } from '@/lib/api/server/timing';
import { getVertexTokenAndProject } from '@/lib/ai/vertexAuth';
import { searchKnowledgeBase } from '@/lib/ai/knowledge';

type SearchSource =
  | 'business'
  | 'transaction'
  | 'account'
  | 'contact'
  | 'invoice'
  | 'budget'
  | 'recurring'
  | 'template'
  | 'import_batch'
  | 'knowledge';

type SearchResult = {
  id: string;
  source: SearchSource;
  title: string;
  subtitle?: string;
  href: string;
  badge?: string;
  amount?: number;
  date?: string;
  score: number;
};

type AnyRow = Record<string, any>;

const MAX_TERMS = 6;
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 50;

const TRANSACTION_SELECT = `
  id,
  business_id,
  transaction_number,
  date,
  category,
  name,
  description,
  amount,
  account,
  status,
  notes,
  meta,
  created_at,
  debit_account:accounts!transactions_debit_account_id_fkey(account_code, account_name),
  credit_account:accounts!transactions_credit_account_id_fkey(account_code, account_name),
  journal_lines(description, debit_amount, credit_amount, account:accounts(account_code, account_name))
`;

function cleanSearchValue(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\\,%()*{}[\]"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function getTerms(query: string): string[] {
  const normalized = query.replace(/\s+/g, ' ').trim();
  const words = normalized
    .split(' ')
    .map(cleanSearchValue)
    .filter((term) => term.length >= 2 || /\d/.test(term));

  return unique([cleanSearchValue(normalized), ...words]).slice(0, MAX_TERMS);
}

function buildOrFilter(columns: string[], terms: string[]): string {
  return terms
    .flatMap((term) => columns.map((column) => `${column}.ilike.*${term}*`))
    .join(',');
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.toLowerCase();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).toLowerCase();
  try {
    return JSON.stringify(value).toLowerCase();
  } catch {
    return '';
  }
}

function scoreText(parts: unknown[], query: string, terms: string[]): number {
  const haystack = parts.map(normalizeText).filter(Boolean).join(' ');
  if (!haystack) return 0;

  const phrase = query.toLowerCase();
  let score = haystack.includes(phrase) ? 20 : 0;
  const matchedTerms = terms.filter((term) => haystack.includes(term.toLowerCase()));

  score += matchedTerms.length * 8;
  if (matchedTerms.length >= Math.min(terms.length, MAX_TERMS)) score += 12;
  return score;
}

function compact(parts: Array<unknown>): string | undefined {
  const value = parts
    .map((part) => (part === null || part === undefined ? '' : String(part).trim()))
    .filter(Boolean)
    .join(' • ');

  return value || undefined;
}

function accountLabel(account?: AnyRow | null): string {
  if (!account) return '';
  return compact([account.account_code, account.account_name]) ?? '';
}

function transactionTextParts(row: AnyRow): unknown[] {
  const journalLines = Array.isArray(row.journal_lines) ? row.journal_lines : [];
  return [
    row.transaction_number,
    row.name,
    row.description,
    row.account,
    row.category,
    row.status,
    row.notes,
    row.date,
    row.amount,
    row.meta?.tags,
    accountLabel(row.debit_account),
    accountLabel(row.credit_account),
    ...journalLines.flatMap((line: AnyRow) => [
      line.description,
      line.debit_amount,
      line.credit_amount,
      accountLabel(line.account),
    ]),
  ];
}

function transactionToResult(row: AnyRow, query: string, terms: string[]): SearchResult {
  const score = scoreText(transactionTextParts(row), query, terms);
  const accountSide = compact([accountLabel(row.debit_account), accountLabel(row.credit_account)]);
  const href = row.date
    ? `/transactions?highlight=${encodeURIComponent(row.id)}&start=${encodeURIComponent(row.date)}&end=${encodeURIComponent(row.date)}`
    : `/transactions?highlight=${encodeURIComponent(row.id)}`;

  return {
    id: row.id,
    source: 'transaction',
    title: row.name || row.description || row.transaction_number || 'Transaksi',
    subtitle: compact([row.transaction_number, row.description, accountSide, row.status]),
    href,
    badge: row.category,
    amount: Number(row.amount) || undefined,
    date: row.date,
    score,
  };
}

async function safeRows<T>(
  label: string,
  query: PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    console.error(`[search] ${label}:`, error.message ?? error);
    return [];
  }
  return data ?? [];
}

function parseExactNumber(query: string): number | null {
  const compacted = query.replace(/[.\s,_]/g, '');
  if (!/^\d{2,}$/.test(compacted)) return null;
  const value = Number(compacted);
  return Number.isFinite(value) ? value : null;
}

function dedupeAndSort(results: SearchResult[], limit: number): SearchResult[] {
  const byKey = new Map<string, SearchResult>();

  for (const result of results) {
    if (result.score <= 0) continue;
    const key = `${result.source}:${result.id}`;
    const existing = byKey.get(key);
    if (!existing || result.score > existing.score) {
      byKey.set(key, result);
    }
  }

  return Array.from(byKey.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.date ?? '').localeCompare(a.date ?? '');
    })
    .slice(0, limit);
}

export async function GET(request: NextRequest) {
  return withRouteTiming(request, '/api/search', async () => {
    try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawQuery = request.nextUrl.searchParams.get('q')?.trim() ?? '';
    if (rawQuery.length < 2) {
      return NextResponse.json({ data: [] });
    }

    const businessId = request.nextUrl.searchParams.get('businessId');
    if (businessId) {
      const parsedBusinessId = businessIdSchema.safeParse(businessId);
      if (!parsedBusinessId.success) {
        return NextResponse.json({ error: 'Invalid business ID format' }, { status: 400 });
      }
    }

    const limitParam = Number(request.nextUrl.searchParams.get('limit') ?? DEFAULT_LIMIT);
    const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : DEFAULT_LIMIT, 1), MAX_LIMIT);
    const perSourceLimit = Math.max(6, Math.ceil(limit / 2));
    const terms = getTerms(rawQuery);

    if (terms.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const businessFilter = buildOrFilter(
      ['business_name', 'business_sector', 'business_type', 'property_address', 'city', 'whatsapp_number'],
      terms
    );
    let businessesQuery = supabase
      .from('businesses')
      .select('id, business_name, business_sector, business_type, property_address, city, whatsapp_number, created_at')
      .or(businessFilter)
      .limit(perSourceLimit);
    if (businessId) businessesQuery = businessesQuery.eq('id', businessId);

    const accountFilter = buildOrFilter(
      ['account_code', 'account_name', 'account_type', 'normal_balance', 'description', 'default_category', 'income_statement_section'],
      terms
    );
    let accountsQuery = supabase
      .from('accounts')
      .select('id, business_id, account_code, account_name, account_type, normal_balance, description, default_category, is_active, sort_order')
      .or(accountFilter)
      .order('sort_order', { ascending: true })
      .limit(perSourceLimit);
    if (businessId) accountsQuery = accountsQuery.eq('business_id', businessId);

    const contactFilter = buildOrFilter(['name', 'type', 'phone', 'email', 'address', 'notes'], terms);
    let contactsQuery = supabase
      .from('business_contacts')
      .select('id, business_id, name, type, phone, email, address, notes, updated_at')
      .or(contactFilter)
      .order('name', { ascending: true })
      .limit(perSourceLimit);
    if (businessId) contactsQuery = contactsQuery.eq('business_id', businessId);

    const transactionFilter = buildOrFilter(
      ['transaction_number', 'name', 'description', 'account', 'category', 'status', 'notes'],
      terms
    );
    let transactionsQuery = supabase
      .from('transactions')
      .select(TRANSACTION_SELECT)
      .is('deleted_at', null)
      .or(transactionFilter)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(perSourceLimit);
    if (businessId) transactionsQuery = transactionsQuery.eq('business_id', businessId);

    const invoiceFilter = buildOrFilter(
      ['invoice_number', 'customer_name', 'customer_phone', 'customer_id_label', 'description', 'item_label', 'payment_status', 'notes'],
      terms
    );
    let invoicesQuery = supabase
      .from('invoices')
      .select('id, business_id, invoice_number, invoice_date, due_date, customer_name, customer_phone, description, item_label, total_amount, payment_status, notes, deleted_at')
      .is('deleted_at', null)
      .or(invoiceFilter)
      .order('invoice_date', { ascending: false })
      .limit(perSourceLimit);
    if (businessId) invoicesQuery = invoicesQuery.eq('business_id', businessId);

    const invoiceLineFilter = buildOrFilter(['item_name'], terms);
    let invoiceLinesQuery = supabase
      .from('invoice_line_items')
      .select(`
        id,
        item_name,
        amount,
        invoice:invoices(id, business_id, invoice_number, invoice_date, due_date, customer_name, total_amount, payment_status, deleted_at)
      `)
      .or(invoiceLineFilter)
      .limit(perSourceLimit);
    if (businessId) invoiceLinesQuery = invoiceLinesQuery.eq('invoice.business_id', businessId);

    const budgetFilter = buildOrFilter(['name', 'status', 'notes'], terms);
    let budgetsQuery = supabase
      .from('budgets')
      .select('id, business_id, name, start_date, end_date, status, notes, updated_at')
      .or(budgetFilter)
      .order('start_date', { ascending: false })
      .limit(perSourceLimit);
    if (businessId) budgetsQuery = budgetsQuery.eq('business_id', businessId);

    const budgetLineFilter = buildOrFilter(['notes'], terms);
    let budgetLinesQuery = supabase
      .from('budget_lines')
      .select(`
        id,
        month,
        amount,
        notes,
        account:accounts(account_code, account_name),
        budget:budgets(id, business_id, name, start_date, end_date, status)
      `)
      .or(budgetLineFilter)
      .limit(perSourceLimit);
    if (businessId) budgetLinesQuery = budgetLinesQuery.eq('budget.business_id', businessId);

    const recurringFilter = buildOrFilter(
      ['name', 'description', 'account', 'category', 'notes', 'frequency', 'status'],
      terms
    );
    let recurringQuery = supabase
      .from('recurring_transactions')
      .select('id, business_id, name, description, amount, category, frequency, interval_value, next_due_date, end_date, status, notes')
      .or(recurringFilter)
      .order('next_due_date', { ascending: true })
      .limit(perSourceLimit);
    if (businessId) recurringQuery = recurringQuery.eq('business_id', businessId);

    const templateFilter = buildOrFilter(['name', 'category', 'description'], terms);
    let templatesQuery = supabase
      .from('transaction_templates')
      .select('id, business_id, name, category, description, default_amount, created_at')
      .or(templateFilter)
      .order('created_at', { ascending: false })
      .limit(perSourceLimit);
    if (businessId) templatesQuery = templatesQuery.eq('business_id', businessId);

    const importFilter = buildOrFilter(['file_name', 'mime_type', 'import_mode', 'status', 'notes'], terms);
    let importsQuery = supabase
      .from('import_batches')
      .select('id, business_id, file_name, import_mode, total_rows, inserted_count, failed_count, status, notes, imported_at')
      .or(importFilter)
      .order('imported_at', { ascending: false })
      .limit(perSourceLimit);
    if (businessId) importsQuery = importsQuery.eq('business_id', businessId);

    const [
      businesses,
      accounts,
      contacts,
      transactions,
      invoices,
      invoiceLines,
      budgets,
      budgetLines,
      recurring,
      templates,
      imports,
    ] = await Promise.all([
      safeRows<AnyRow>('businesses', businessesQuery),
      safeRows<AnyRow>('accounts', accountsQuery),
      safeRows<AnyRow>('contacts', contactsQuery),
      safeRows<AnyRow>('transactions', transactionsQuery),
      safeRows<AnyRow>('invoices', invoicesQuery),
      safeRows<AnyRow>('invoice_line_items', invoiceLinesQuery),
      safeRows<AnyRow>('budgets', budgetsQuery),
      safeRows<AnyRow>('budget_lines', budgetLinesQuery),
      safeRows<AnyRow>('recurring_transactions', recurringQuery),
      safeRows<AnyRow>('transaction_templates', templatesQuery),
      safeRows<AnyRow>('import_batches', importsQuery),
    ]);

    const accountIds = accounts.map((account) => account.id).filter(Boolean).slice(0, perSourceLimit);
    const journalTransactionIds = new Set<string>();

    if (accountIds.length > 0) {
      const accountJournalLines = await safeRows<AnyRow>(
        'journal_lines_by_account',
        supabase
          .from('journal_lines')
          .select('transaction_id')
          .in('account_id', accountIds)
          .limit(perSourceLimit)
      );
      accountJournalLines.forEach((line) => {
        if (line.transaction_id) journalTransactionIds.add(line.transaction_id);
      });
    }

    const journalLineFilter = buildOrFilter(['description'], terms);
    const journalLineHits = await safeRows<AnyRow>(
      'journal_lines',
      supabase
        .from('journal_lines')
        .select('transaction_id, description')
        .or(journalLineFilter)
        .limit(perSourceLimit)
    );
    journalLineHits.forEach((line) => {
      if (line.transaction_id) journalTransactionIds.add(line.transaction_id);
    });

    const extraTransactionIds = Array.from(journalTransactionIds).slice(0, perSourceLimit);
    let extraTransactions: AnyRow[] = [];

    if (accountIds.length > 0 || extraTransactionIds.length > 0) {
      const transactionIdFilter = extraTransactionIds.length > 0
        ? `id.in.(${extraTransactionIds.join(',')})`
        : '';
      const accountTransactionFilter = accountIds.length > 0
        ? `debit_account_id.in.(${accountIds.join(',')}),credit_account_id.in.(${accountIds.join(',')})`
        : '';
      const relatedTransactionFilter = [transactionIdFilter, accountTransactionFilter].filter(Boolean).join(',');

      let relatedTransactionsQuery = supabase
        .from('transactions')
        .select(TRANSACTION_SELECT)
        .is('deleted_at', null)
        .or(relatedTransactionFilter)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(perSourceLimit);
      if (businessId) relatedTransactionsQuery = relatedTransactionsQuery.eq('business_id', businessId);
      extraTransactions = await safeRows<AnyRow>('related_transactions', relatedTransactionsQuery);
    }

    const exactNumber = parseExactNumber(rawQuery);
    let numericTransactions: AnyRow[] = [];
    let numericInvoices: AnyRow[] = [];
    if (exactNumber !== null) {
      let numericTransactionsQuery = supabase
        .from('transactions')
        .select(TRANSACTION_SELECT)
        .is('deleted_at', null)
        .eq('amount', exactNumber)
        .order('date', { ascending: false })
        .limit(perSourceLimit);
      if (businessId) numericTransactionsQuery = numericTransactionsQuery.eq('business_id', businessId);

      let numericInvoicesQuery = supabase
        .from('invoices')
        .select('id, business_id, invoice_number, invoice_date, due_date, customer_name, customer_phone, description, item_label, total_amount, payment_status, notes, deleted_at')
        .is('deleted_at', null)
        .eq('total_amount', exactNumber)
        .order('invoice_date', { ascending: false })
        .limit(perSourceLimit);
      if (businessId) numericInvoicesQuery = numericInvoicesQuery.eq('business_id', businessId);

      [numericTransactions, numericInvoices] = await Promise.all([
        safeRows<AnyRow>('numeric_transactions', numericTransactionsQuery),
        safeRows<AnyRow>('numeric_invoices', numericInvoicesQuery),
      ]);
    }

    // Semantic Vector Search for Knowledge Documents
    let knowledgeResults: SearchResult[] = [];
    if (businessId && rawQuery.length > 3) {
      try {
        const auth = await getVertexTokenAndProject();
        if (auth) {
          const endpoint = `https://aiplatform.googleapis.com/v1/projects/${auth.projectId}/locations/global/publishers/google/models/text-embedding-004:predict`;
          const payload = { instances: [{ content: rawQuery }] };
          const embedRes = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${auth.token}`
            },
            body: JSON.stringify(payload)
          });
          if (embedRes.ok) {
            const embedData = await embedRes.json();
            const queryEmbedding = embedData.predictions[0].embeddings.values;
            const vectorHits = await searchKnowledgeBase(businessId, queryEmbedding, 3, 0.6);
            
            knowledgeResults = vectorHits.map((row: any) => ({
              id: row.id,
              source: 'knowledge' as const,
              title: row.source_type || 'Dokumen Pengetahuan',
              subtitle: row.chunk_content ? (row.chunk_content.substring(0, 100) + '...') : '',
              href: '/agent',
              badge: 'Knowledge',
              score: 50 + (row.similarity * 50) // Scale score to ensure it ranks high if similarity is good
            }));
          }
        }
      } catch (err) {
        console.error('[search] Vector search error:', err);
      }
    }

    const results: SearchResult[] = [
      ...businesses.map((row) => ({
        id: row.id,
        source: 'business' as const,
        title: row.business_name || 'Business',
        subtitle: compact([row.business_sector, row.business_type, row.city, row.property_address]),
        href: `/businesses/${row.id}/config`,
        badge: 'Business',
        score: scoreText([row.business_name, row.business_sector, row.business_type, row.city, row.property_address, row.whatsapp_number], rawQuery, terms),
      })),
      ...accounts.map((row) => ({
        id: row.id,
        source: 'account' as const,
        title: compact([row.account_code, row.account_name]) || 'Akun',
        subtitle: compact([row.account_type, row.normal_balance, row.description, row.is_active ? 'Aktif' : 'Nonaktif']),
        href: '/accounts',
        badge: row.account_type,
        score: scoreText([row.account_code, row.account_name, row.account_type, row.normal_balance, row.description, row.default_category, row.income_statement_section], rawQuery, terms),
      })),
      ...contacts.map((row) => ({
        id: row.id,
        source: 'contact' as const,
        title: row.name || 'Kontak',
        subtitle: compact([row.type, row.phone, row.email, row.address, row.notes]),
        href: `/businesses/${row.business_id}/config?tab=contacts`,
        badge: row.type,
        score: scoreText([row.name, row.type, row.phone, row.email, row.address, row.notes], rawQuery, terms),
      })),
      ...[...transactions, ...extraTransactions, ...numericTransactions].map((row) =>
        transactionToResult(row, rawQuery, terms)
      ),
      ...[...invoices, ...numericInvoices].map((row) => ({
        id: row.id,
        source: 'invoice' as const,
        title: compact([row.invoice_number, row.customer_name]) || 'Invoice',
        subtitle: compact([row.description, row.item_label, row.payment_status, row.due_date ? `Due ${row.due_date}` : null, row.notes]),
        href: '/invoices',
        badge: row.payment_status,
        amount: Number(row.total_amount) || undefined,
        date: row.invoice_date,
        score: scoreText([row.invoice_number, row.customer_name, row.customer_phone, row.description, row.item_label, row.payment_status, row.notes, row.total_amount], rawQuery, terms),
      })),
      ...invoiceLines
        .filter((row) => row.invoice && !row.invoice.deleted_at)
        .map((row) => ({
          id: row.invoice.id,
          source: 'invoice' as const,
          title: compact([row.invoice.invoice_number, row.invoice.customer_name]) || row.item_name || 'Invoice',
          subtitle: compact([row.item_name, row.invoice.payment_status]),
          href: '/invoices',
          badge: row.invoice.payment_status,
          amount: Number(row.invoice.total_amount) || Number(row.amount) || undefined,
          date: row.invoice.invoice_date,
          score: scoreText([row.item_name, row.amount, row.invoice.invoice_number, row.invoice.customer_name], rawQuery, terms),
        })),
      ...budgets.map((row) => ({
        id: row.id,
        source: 'budget' as const,
        title: row.name || 'Budget',
        subtitle: compact([`${row.start_date} - ${row.end_date}`, row.status, row.notes]),
        href: '/roi-forecast',
        badge: row.status,
        date: row.start_date,
        score: scoreText([row.name, row.status, row.notes, row.start_date, row.end_date], rawQuery, terms),
      })),
      ...budgetLines
        .filter((row) => row.budget)
        .map((row) => ({
          id: row.budget.id,
          source: 'budget' as const,
          title: row.budget.name || 'Budget',
          subtitle: compact([row.month, accountLabel(row.account), row.notes]),
          href: '/roi-forecast',
          badge: row.budget.status,
          amount: Number(row.amount) || undefined,
          date: row.month,
          score: scoreText([row.notes, row.month, row.amount, accountLabel(row.account), row.budget.name], rawQuery, terms),
        })),
      ...recurring.map((row) => ({
        id: row.id,
        source: 'recurring' as const,
        title: row.name || 'Recurring Transaction',
        subtitle: compact([row.description, row.frequency, row.status, row.next_due_date, row.notes]),
        href: '/transactions?view=recurring',
        badge: row.category,
        amount: Number(row.amount) || undefined,
        date: row.next_due_date,
        score: scoreText([row.name, row.description, row.amount, row.category, row.frequency, row.status, row.notes], rawQuery, terms),
      })),
      ...templates.map((row) => ({
        id: row.id,
        source: 'template' as const,
        title: row.name || 'Template',
        subtitle: compact([row.description, row.category]),
        href: '/transactions/journal-entry',
        badge: row.category,
        amount: Number(row.default_amount) || undefined,
        date: row.created_at,
        score: scoreText([row.name, row.description, row.category, row.default_amount], rawQuery, terms),
      })),
      ...imports.map((row) => ({
        id: row.id,
        source: 'import_batch' as const,
        title: row.file_name || 'Import',
        subtitle: compact([row.import_mode, `${row.inserted_count}/${row.total_rows} rows`, row.failed_count ? `${row.failed_count} failed` : null, row.notes]),
        href: '/transactions',
        badge: row.status,
        date: row.imported_at,
        score: scoreText([row.file_name, row.mime_type, row.import_mode, row.status, row.notes], rawQuery, terms),
      })),
      ...knowledgeResults,
    ];

      return NextResponse.json({ data: dedupeAndSort(results, limit) });
    } catch (error) {
      console.error('Search GET error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
