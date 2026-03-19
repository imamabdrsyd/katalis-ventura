import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { Business } from './models/Business';
import { Account } from './models/Account';
import { Transaction } from './models/Transaction';

let dbInstance: Database | null = null;

export function initDatabase(): Database {
  if (dbInstance) return dbInstance;

  const adapter = new SQLiteAdapter({
    schema,
  });

  dbInstance = new Database({
    adapter,
    modelClasses: [Business, Account, Transaction],
  });

  return dbInstance;
}

export function getDatabase(): Database {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

export { Business, Account, Transaction };
