import { Model } from '@nozbe/watermelondb';
import { field, readonly } from '@nozbe/watermelondb/decorators';
import type { Transaction as TransactionType } from '@shared/types';

export class Transaction extends Model implements Omit<TransactionType, 'created_by' | 'updated_by' | 'deleted_by'> {
  static table = 'transactions';

  @field('business_id') business_id!: string;
  @field('date') date!: number;
  @field('name') name!: string;
  @field('description') description?: string;
  @field('amount') amount!: number;
  @field('category') category!: TransactionType['category'];
  @field('debit_account_id') debit_account_id!: string;
  @field('credit_account_id') credit_account_id!: string;
  @field('is_double_entry') is_double_entry!: boolean;
  @field('status') status!: 'draft' | 'posted';
  @field('notes') notes?: string;
  @field('meta') meta?: string;
  @field('deleted_at') deleted_at?: number;
  @field('_status') _status?: string;
  @field('_changed') _changed?: string;

  @readonly @field('created_at') created_at!: number;
  @readonly @field('updated_at') updated_at!: number;
  @readonly @field('id') id!: string;

  get isDeleted(): boolean {
    return !!this.deleted_at;
  }

  get metaData() {
    return this.meta ? JSON.parse(this.meta) : {};
  }
}
