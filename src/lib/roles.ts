import type { UserRole } from '@/types';

export type LegacyUserRole = UserRole | 'both';

export function normalizeRole(role?: string | null): UserRole | null {
  if (role === 'business_manager' || role === 'investor' || role === 'superadmin') {
    return role;
  }

  if (role === 'both') return 'superadmin';

  return null;
}

export function isManagerRole(role?: string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'business_manager' || normalized === 'superadmin';
}

export function isInvestorRole(role?: string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'investor' || normalized === 'superadmin';
}

export function isSuperadminRole(role?: string | null): boolean {
  return normalizeRole(role) === 'superadmin';
}

export function pickHighestRole(roles: Array<string | null | undefined>): UserRole {
  const normalized = roles.map(normalizeRole);
  if (normalized.includes('superadmin')) return 'superadmin';
  if (normalized.includes('business_manager')) return 'business_manager';
  return 'investor';
}
