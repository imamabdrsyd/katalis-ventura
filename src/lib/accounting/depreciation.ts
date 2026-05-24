/**
 * Straight-Line Depreciation Calculator (PSAK 16 / IAS 16)
 *
 * Depreciation dihitung on-the-fly berdasarkan metadata akun aset tetap,
 * BUKAN sebagai jurnal manual. Ini lebih user-friendly untuk target user
 * non-accountant.
 *
 * Formula:
 *   monthlyDepreciation = (cost - residualValue) / usefulLifeMonths
 *   accumulatedDepreciation = monthlyDepreciation × monthsElapsed
 *   bookValue = cost - accumulatedDepreciation
 */

import type { Account } from '@/types';

export interface DepreciationResult {
  monthlyDepreciation: number;
  accumulatedDepreciation: number;
  bookValue: number;
  isFullyDepreciated: boolean;
}

export interface DepreciationSummary {
  totalAccumulatedDepreciation: number;  // For Balance Sheet (cumulative s/d reportDate)
  periodDepreciation: number;            // For Income Statement (within startDate–endDate)
}

/**
 * Calculate straight-line depreciation for a single fixed asset account.
 *
 * @param cost             Total harga perolehan (dari closing balance akun)
 * @param residualValue    Nilai residu
 * @param usefulLifeMonths Masa manfaat dalam bulan
 * @param acquisitionDate  Tanggal perolehan
 * @param reportDate       Tanggal akhir laporan (endDate)
 */
export function calculateStraightLineDepreciation(
  cost: number,
  residualValue: number,
  usefulLifeMonths: number,
  acquisitionDate: Date,
  reportDate: Date
): DepreciationResult {
  if (cost <= 0 || usefulLifeMonths <= 0) {
    return { monthlyDepreciation: 0, accumulatedDepreciation: 0, bookValue: cost, isFullyDepreciated: false };
  }

  const depreciableAmount = Math.max(0, cost - residualValue);
  const monthlyDepreciation = depreciableAmount / usefulLifeMonths;

  // Calculate months elapsed from acquisition to report date
  const monthsElapsed = getMonthsElapsed(acquisitionDate, reportDate);

  // Cap at useful life
  const effectiveMonths = Math.min(Math.max(0, monthsElapsed), usefulLifeMonths);

  const accumulatedDepreciation = monthlyDepreciation * effectiveMonths;
  const bookValue = Math.max(residualValue, cost - accumulatedDepreciation);
  const isFullyDepreciated = effectiveMonths >= usefulLifeMonths;

  return { monthlyDepreciation, accumulatedDepreciation, bookValue, isFullyDepreciated };
}

/**
 * Calculate total depreciation across all depreciable fixed asset accounts.
 *
 * @param accounts        All accounts for the business
 * @param getAccountCost  Function to get cost (closing balance) for an account ID
 * @param reportDate      End date of report period (for Balance Sheet accumulated)
 * @param startDate       Start date of report period (for Income Statement period expense)
 */
export function calculateDepreciationSummary(
  accounts: Account[],
  getAccountCost: (accountId: string) => number,
  reportDate: Date,
  startDate?: Date
): DepreciationSummary {
  let totalAccumulatedDepreciation = 0;
  let periodDepreciation = 0;

  const depreciableAccounts = accounts.filter(isDepreciableAccount);

  for (const account of depreciableAccounts) {
    const cost = getAccountCost(account.id);
    if (cost <= 0) continue;

    const acquisitionDate = new Date(account.acquisition_date!);
    const result = calculateStraightLineDepreciation(
      cost,
      account.residual_value ?? 0,
      account.useful_life_months!,
      acquisitionDate,
      reportDate
    );

    totalAccumulatedDepreciation += result.accumulatedDepreciation;

    // Period depreciation: only months within [startDate, reportDate]
    if (startDate) {
      // Count calendar months overlapping the period.
      // A month is counted if the asset was acquired before or during that month
      // and the month falls within [startDate, endDate].
      // We iterate from the first calendar month of startDate to the last of reportDate.
      const periodStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const periodEnd = new Date(reportDate.getFullYear(), reportDate.getMonth(), 1);
      let periodMonths = 0;
      const cursor = new Date(periodStart);
      while (cursor <= periodEnd) {
        // Month number since acquisition (1-indexed: first month = month 1)
        const monthNum = getMonthsElapsed(acquisitionDate, cursor) + 1;
        if (monthNum > 0 && monthNum <= account.useful_life_months!) {
          periodMonths++;
        }
        cursor.setMonth(cursor.getMonth() + 1);
      }
      periodDepreciation += result.monthlyDepreciation * periodMonths;
    } else {
      periodDepreciation += result.accumulatedDepreciation;
    }
  }

  return { totalAccumulatedDepreciation, periodDepreciation };
}

/**
 * Check if an account is eligible for depreciation.
 * Must be ASSET type with CAPEX default_category and have depreciation settings filled.
 */
export function isDepreciableAccount(account: Account): boolean {
  return (
    account.account_type === 'ASSET' &&
    account.default_category === 'CAPEX' &&
    account.is_active &&
    !!account.useful_life_months &&
    account.useful_life_months > 0 &&
    !!account.acquisition_date
  );
}

/**
 * Calculate whole months elapsed between two dates.
 * Uses year×12 + month difference, which is the standard approach for
 * monthly straight-line depreciation.
 */
function getMonthsElapsed(from: Date, to: Date): number {
  const yearDiff = to.getFullYear() - from.getFullYear();
  const monthDiff = to.getMonth() - from.getMonth();
  return yearDiff * 12 + monthDiff;
}
