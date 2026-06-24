import { createAdminClient } from './supabase-server';
import gcpSql from './gcp';
import { Database } from '@/types';

/**
 * Performs a synchronization of core business data from Supabase to GCP SQL.
 * Specifically copies:
 * - businesses -> olap_businesses
 * - accounts -> olap_accounts
 * - transactions -> olap_transactions
 * - journal_lines -> olap_journal_lines
 *
 * Membaca data sumber via admin client (bypass RLS). Otorisasi siapa yang boleh
 * memicu sync di-gate di level route/caller (route manual cek role manager; cron
 * cek CRON_SECRET). Ini juga membuat sync bisa jalan di konteks cron yang tidak
 * punya cookie user — di mana createServerClient akan terkena RLS dan balik kosong.
 */
export async function syncBusinessDataToGCP(businessId: string) {
  console.log(`Starting GCP sync for business_id: ${businessId}`);

  const supabase = createAdminClient();

  // 1. Fetch data from Supabase
  const [{ data: businesses }, { data: accounts }, { data: transactions }, { data: journalLines }] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', businessId),
    supabase.from('accounts').select('*').eq('business_id', businessId),
    supabase.from('transactions').select('*').eq('business_id', businessId),
    // For journal lines, we fetch where transaction_id is in our fetched transactions
    // Since we can't easily do an IN query if there are too many, we'll fetch them after getting transactions,
    // or just fetch all journal lines joined to the business's transactions.
    supabase
      .from('journal_lines')
      .select('*, transactions!inner(business_id)')
      .eq('transactions.business_id', businessId)
  ]);

  if (!businesses || !accounts || !transactions) {
    throw new Error('Failed to fetch data from Supabase');
  }

  // 2. Write to GCP SQL inside a transaction
  await gcpSql.begin(async (sql) => {
    // Clear existing OLAP data for this business
    await sql`DELETE FROM olap_journal_lines WHERE transaction_id IN (SELECT id FROM olap_transactions WHERE business_id = ${businessId})`;
    await sql`DELETE FROM olap_transactions WHERE business_id = ${businessId}`;
    await sql`DELETE FROM olap_accounts WHERE business_id = ${businessId}`;
    await sql`DELETE FROM olap_businesses WHERE id = ${businessId}`;

    // Insert Businesses
    if (businesses.length > 0) {
      const bRows = businesses.map(b => ({
        id: b.id,
        business_name: b.business_name,
        business_sector: b.business_sector,
        business_type: b.business_type,
        capital_investment: b.capital_investment,
        created_at: b.created_at,
        updated_at: b.updated_at
      }));
      await sql`INSERT INTO olap_businesses ${sql(bRows)}`;
    }

    // Insert Accounts
    if (accounts.length > 0) {
      const aRows = accounts.map(a => ({
        id: a.id,
        business_id: a.business_id,
        account_code: a.account_code,
        account_name: a.account_name,
        account_type: a.account_type,
        normal_balance: a.normal_balance,
        is_active: a.is_active,
        is_system: a.is_system,
        created_at: a.created_at,
        updated_at: a.updated_at
      }));
      await sql`INSERT INTO olap_accounts ${sql(aRows)}`;
    }

    // Insert Transactions
    if (transactions.length > 0) {
      const txRows = transactions.map(tx => ({
        id: tx.id,
        business_id: tx.business_id,
        date: tx.date,
        category: tx.category,
        name: tx.name,
        description: tx.description,
        amount: tx.amount,
        account: tx.account,
        status: tx.status,
        sales_channel: tx.sales_channel,
        is_double_entry: tx.is_double_entry,
        is_multi_line: tx.is_multi_line,
        debit_account_id: tx.debit_account_id,
        credit_account_id: tx.credit_account_id,
        contact_id: tx.contact_id,
        notes: tx.notes,
        meta: tx.meta,
        created_at: tx.created_at,
        updated_at: tx.updated_at,
        deleted_at: tx.deleted_at
      }));
      
      // postgres.js bulk insert max columns/rows might have limits, but for typical use cases < 10000 rows it's fine.
      // If transactions > 5000, we might need chunking. Let's do chunking just in case.
      const CHUNK_SIZE = 1000;
      for (let i = 0; i < txRows.length; i += CHUNK_SIZE) {
        const chunk = txRows.slice(i, i + CHUNK_SIZE);
        await sql`INSERT INTO olap_transactions ${sql(chunk)}`;
      }
    }

    // Insert Journal Lines
    const jLines = journalLines || [];
    if (jLines.length > 0) {
      const jlRows = jLines.map((jl: any) => ({
        id: jl.id,
        transaction_id: jl.transaction_id,
        account_id: jl.account_id,
        debit_amount: jl.debit_amount,
        credit_amount: jl.credit_amount,
        description: jl.description,
        sort_order: jl.sort_order,
        created_at: jl.created_at
      }));

      const CHUNK_SIZE = 1000;
      for (let i = 0; i < jlRows.length; i += CHUNK_SIZE) {
        const chunk = jlRows.slice(i, i + CHUNK_SIZE);
        await sql`INSERT INTO olap_journal_lines ${sql(chunk)}`;
      }
    }
  });

  console.log(`GCP sync for business_id: ${businessId} completed successfully.`);
  return {
    businesses: businesses.length,
    accounts: accounts.length,
    transactions: transactions.length,
    journalLines: journalLines?.length || 0
  };
}
