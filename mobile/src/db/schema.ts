import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'businesses',
      columns: [
        { name: 'business_name', type: 'string' },
        { name: 'business_type', type: 'string' },
        { name: 'capital_investment', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'accounts',
      columns: [
        { name: 'business_id', type: 'string' },
        { name: 'account_code', type: 'string' },
        { name: 'account_name', type: 'string' },
        { name: 'account_type', type: 'string' },
        { name: 'parent_account_id', type: 'string', isOptional: true },
        { name: 'normal_balance', type: 'string' },
        { name: 'is_active', type: 'boolean' },
        { name: 'is_system', type: 'boolean' },
        { name: 'sort_order', type: 'number' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'transactions',
      columns: [
        { name: 'business_id', type: 'string' },
        { name: 'date', type: 'number' },
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'amount', type: 'number' },
        { name: 'category', type: 'string' },
        { name: 'debit_account_id', type: 'string' },
        { name: 'credit_account_id', type: 'string' },
        { name: 'is_double_entry', type: 'boolean' },
        { name: 'status', type: 'string' },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'meta', type: 'string', isOptional: true },
        { name: 'deleted_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
