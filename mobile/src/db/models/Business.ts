import { Model } from '@nozbe/watermelondb';
import { field, readonly } from '@nozbe/watermelondb/decorators';
import type { Business as BusinessType } from '@shared/types';

export class Business extends Model implements Omit<BusinessType, 'created_by' | 'updated_by'> {
  static table = 'businesses';

  @field('business_name') business_name!: string;
  @field('business_type') business_type!: string;
  @field('capital_investment') capital_investment!: number;
  @field('_status') _status?: string;
  @field('_changed') _changed?: string;

  @readonly @field('created_at') created_at!: number;
  @readonly @field('updated_at') updated_at!: number;
  @readonly @field('id') id!: string;
}
