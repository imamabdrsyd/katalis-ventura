import gcpSql from './gcp';

export async function initGcpSchema() {
  console.log('Initializing GCP SQL Schema...');
  
  // Enable vector extension
  await gcpSql`CREATE EXTENSION IF NOT EXISTS vector;`;

  // 1. Agent Memories
  await gcpSql`
    CREATE TABLE IF NOT EXISTS agent_memories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id UUID NOT NULL,
      user_id UUID,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      embedding vector(768),
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
  
  await gcpSql`CREATE INDEX IF NOT EXISTS idx_agent_memories_business ON agent_memories(business_id);`;
  await gcpSql`CREATE INDEX IF NOT EXISTS idx_agent_memories_session ON agent_memories(session_id);`;

  // 2. Business Knowledge Embeddings
  await gcpSql`
    CREATE TABLE IF NOT EXISTS business_knowledge_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id UUID NOT NULL,
      source_type TEXT,
      chunk_content TEXT NOT NULL,
      embedding vector(768),
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  await gcpSql`CREATE INDEX IF NOT EXISTS idx_knowledge_business ON business_knowledge_embeddings(business_id);`;

  // 3. OLAP Businesses
  await gcpSql`
    CREATE TABLE IF NOT EXISTS olap_businesses (
      id UUID PRIMARY KEY,
      business_name TEXT NOT NULL,
      business_sector TEXT,
      business_type TEXT,
      capital_investment NUMERIC,
      created_at TIMESTAMP WITH TIME ZONE,
      updated_at TIMESTAMP WITH TIME ZONE,
      synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  // 4. OLAP Accounts
  await gcpSql`
    CREATE TABLE IF NOT EXISTS olap_accounts (
      id UUID PRIMARY KEY,
      business_id UUID NOT NULL,
      account_code TEXT,
      account_name TEXT NOT NULL,
      account_type TEXT,
      normal_balance TEXT,
      is_active BOOLEAN,
      is_system BOOLEAN,
      created_at TIMESTAMP WITH TIME ZONE,
      updated_at TIMESTAMP WITH TIME ZONE,
      synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  await gcpSql`CREATE INDEX IF NOT EXISTS idx_olap_accounts_business ON olap_accounts(business_id);`;

  // 5. OLAP Transactions
  await gcpSql`
    CREATE TABLE IF NOT EXISTS olap_transactions (
      id UUID PRIMARY KEY,
      business_id UUID NOT NULL,
      date DATE NOT NULL,
      category TEXT,
      name TEXT,
      description TEXT,
      amount NUMERIC,
      account TEXT,
      status TEXT,
      sales_channel TEXT,
      is_double_entry BOOLEAN,
      is_multi_line BOOLEAN,
      debit_account_id UUID,
      credit_account_id UUID,
      contact_id UUID,
      notes TEXT,
      meta JSONB,
      created_at TIMESTAMP WITH TIME ZONE,
      updated_at TIMESTAMP WITH TIME ZONE,
      deleted_at TIMESTAMP WITH TIME ZONE,
      synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  await gcpSql`CREATE INDEX IF NOT EXISTS idx_olap_tx_business_date ON olap_transactions(business_id, date DESC);`;

  // 6. OLAP Journal Lines
  await gcpSql`
    CREATE TABLE IF NOT EXISTS olap_journal_lines (
      id UUID PRIMARY KEY,
      transaction_id UUID NOT NULL,
      account_id UUID NOT NULL,
      debit_amount NUMERIC NOT NULL,
      credit_amount NUMERIC NOT NULL,
      description TEXT,
      sort_order INTEGER,
      created_at TIMESTAMP WITH TIME ZONE,
      synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  await gcpSql`CREATE INDEX IF NOT EXISTS idx_olap_journal_tx ON olap_journal_lines(transaction_id);`;

  console.log('GCP SQL Schema initialization complete.');
  return { success: true };
}
