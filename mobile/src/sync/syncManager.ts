import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { getDatabase } from '@/db';

const LAST_SYNC_KEY = 'katalis_last_sync_at';

interface SyncResult {
  success: boolean;
  syncedAt: Date;
  createdCount: number;
  updatedCount: number;
  deletedCount: number;
}

export class SyncManager {
  static async getLastSyncAt(): Promise<number> {
    const stored = await AsyncStorage.getItem(LAST_SYNC_KEY);
    return stored ? parseInt(stored, 10) : 0;
  }

  static async setLastSyncAt(timestamp: number): Promise<void> {
    await AsyncStorage.setItem(LAST_SYNC_KEY, String(timestamp));
  }

  /**
   * Sync directly with Supabase — no custom API endpoints needed.
   * Pull all transactions for the business and upsert into WatermelonDB.
   */
  static async sync(businessId: string, _authToken?: string): Promise<SyncResult> {
    const db = getDatabase();
    const startTime = Date.now();

    try {
      // Fetch all active transactions from Supabase
      const { data: remoteTransactions, error } = await supabase
        .from('transactions')
        .select(
          `*,
          debit_account:accounts!transactions_debit_account_id_fkey(id, account_code, account_name, account_type),
          credit_account:accounts!transactions_credit_account_id_fkey(id, account_code, account_name, account_type)`
        )
        .eq('business_id', businessId)
        .is('deleted_at', null)
        .order('date', { ascending: false });

      if (error) {
        throw new Error(`Supabase fetch failed: ${error.message}`);
      }

      const txCollection = db.collections.get('transactions');
      const localTxs: any[] = await txCollection.query().fetch();
      const localMap = new Map(localTxs.map((tx) => [tx.id, tx]));
      const remoteMap = new Map((remoteTransactions || []).map((tx) => [tx.id, tx]));

      let createdCount = 0;
      let updatedCount = 0;
      let deletedCount = 0;

      await db.write(async () => {
        // Create or update remote transactions locally
        for (const remoteTx of remoteTransactions || []) {
          const localTx = localMap.get(remoteTx.id);

          if (!localTx) {
            // Create new local record
            await txCollection.create((record: any) => {
              record._raw.id = remoteTx.id;
              record._raw._status = 'synced';
              record._raw._changed = '';
              record.businessId = remoteTx.business_id;
              record.date = new Date(remoteTx.date).getTime();
              record.name = remoteTx.name || '';
              record.description = remoteTx.description || '';
              record.amount = remoteTx.amount;
              record.category = remoteTx.category;
              record.debitAccountId = remoteTx.debit_account_id || '';
              record.creditAccountId = remoteTx.credit_account_id || '';
              record.isDoubleEntry = remoteTx.is_double_entry || false;
              record.status = remoteTx.status || 'posted';
              record.notes = remoteTx.notes || '';
              record.meta = remoteTx.meta ? JSON.stringify(remoteTx.meta) : '';
              record.createdAt = new Date(remoteTx.created_at).getTime();
              record.updatedAt = new Date(remoteTx.updated_at).getTime();
            });
            createdCount++;
          } else {
            // Update if remote is newer
            const remoteUpdated = new Date(remoteTx.updated_at).getTime();
            const localUpdated = localTx.updatedAt || 0;

            if (remoteUpdated > localUpdated) {
              await localTx.update((record: any) => {
                record._raw._status = 'synced';
                record._raw._changed = '';
                record.date = new Date(remoteTx.date).getTime();
                record.name = remoteTx.name || '';
                record.description = remoteTx.description || '';
                record.amount = remoteTx.amount;
                record.category = remoteTx.category;
                record.debitAccountId = remoteTx.debit_account_id || '';
                record.creditAccountId = remoteTx.credit_account_id || '';
                record.isDoubleEntry = remoteTx.is_double_entry || false;
                record.status = remoteTx.status || 'posted';
                record.notes = remoteTx.notes || '';
                record.meta = remoteTx.meta ? JSON.stringify(remoteTx.meta) : '';
                record.updatedAt = remoteUpdated;
              });
              updatedCount++;
            }
          }
        }

        // Remove local transactions that were deleted on server
        for (const [localId, localTx] of localMap) {
          if (!remoteMap.has(localId) && localTx._raw._status === 'synced') {
            await localTx.destroyPermanently();
            deletedCount++;
          }
        }
      });

      await this.setLastSyncAt(startTime);

      return {
        success: true,
        syncedAt: new Date(startTime),
        createdCount,
        updatedCount,
        deletedCount,
      };
    } catch (error) {
      console.error('Sync error:', error);
      throw error;
    }
  }
}
