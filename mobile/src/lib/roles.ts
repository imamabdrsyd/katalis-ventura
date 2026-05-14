import type { UserRole } from '@shared/types';

export function normalizeRole(role?: string | null): UserRole | null {
  if (role === 'business_manager' || role === 'investor' || role === 'superadmin') {
    return role;
  }

  if (role === 'both') return 'superadmin';

  return null;
}

export function pickHighestRole(roles: Array<string | null | undefined>): UserRole {
  const normalized = roles.map(normalizeRole);
  if (normalized.includes('superadmin')) return 'superadmin';
  if (normalized.includes('business_manager')) return 'business_manager';
  return 'investor';
}
