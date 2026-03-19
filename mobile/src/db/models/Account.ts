import { Model } from '@nozbe/watermelondb';
import { field, readonly } from '@nozbe/watermelondb/decorators';
import type { Account as AccountType } from '@shared/types';

export class Account extends Model implements Omit<AccountType, 'created_by' | 'updated_by'> {
  static table = 'accounts';

  @field('business_id') business_id!: string;
  @field('account_code') account_code!: string;
  @field('account_name') account_name!: string;
  @field('account_type') account_type!: AccountType['account_type'];
  @field('parent_account_id') parent_account_id?: string;
  @field('normal_balance') normal_balance!: 'DEBIT' | 'CREDIT';
  @field('is_active') is_active!: boolean;
  @field('is_system') is_system!: boolean;
  @field('sort_order') sort_order!: number;
  @field('description') description?: string;
  @field('_status') _status?: string;
  @field('_changed') _changed?: string;

  @readonly @field('created_at') created_at!: number;
  @readonly @field('updated_at') updated_at!: number;
  @readonly @field('id') id!: string;
}
