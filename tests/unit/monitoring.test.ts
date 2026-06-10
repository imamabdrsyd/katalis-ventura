import { beforeEach, describe, expect, it } from 'vitest';
import { buildMonitoringDataPoints, buildMonthlyProfitAndLossSeries } from '@/lib/monitoring';
import { ACC, doubleEntryTxn, legacyTxn, multiLineTxn, resetSeq } from './fixtures';

beforeEach(resetSeq);

describe('monitoring data aggregation', () => {
  it('uses journal-line revenue for multi-line entries and excludes settlements', () => {
    const transactions = [
      legacyTxn({ date: '2026-04-01', category: 'EARN', amount: 1_373_000 }),
      multiLineTxn({
        date: '2026-04-05',
        category: 'EARN',
        amount: 1_987_000,
        lines: [
          { account: ACC.kas, debit: 1_987_000 },
          { account: ACC.revenue, credit: 1_987_000 },
        ],
      }),
      doubleEntryTxn({
        date: '2026-04-10',
        category: 'EARN',
        amount: 900_000,
        debit: ACC.kas,
        credit: ACC.piutang,
      }),
    ];

    const points = buildMonitoringDataPoints({
      transactions,
      period: 'monthly',
      interval: '1m',
      selectedYear: 2026,
      now: new Date('2026-06-10T12:00:00Z'),
    });

    expect(points).toEqual([
      { label: 'Apr', earning: 3_360_000, expense: 0 },
    ]);
  });

  it('uses Income Statement expense classification, including tax and interest', () => {
    const transactions = [
      multiLineTxn({
        date: '2026-05-01',
        category: 'VAR',
        amount: 400_000,
        lines: [
          { account: ACC.cogs, debit: 400_000 },
          { account: ACC.kas, credit: 400_000 },
        ],
      }),
      doubleEntryTxn({
        date: '2026-05-02',
        category: 'TAX',
        amount: 25_000,
        debit: ACC.tax,
        credit: ACC.kas,
      }),
      doubleEntryTxn({
        date: '2026-05-03',
        category: 'FIN',
        amount: 75_000,
        debit: ACC.interest,
        credit: ACC.kas,
      }),
    ];

    const [point] = buildMonitoringDataPoints({
      transactions,
      period: 'monthly',
      interval: '1m',
      selectedYear: 2026,
      now: new Date('2026-06-10T12:00:00Z'),
    });

    expect(point.expense).toBe(500_000);
  });

  it('keeps dashboard monthly sparklines consistent with multi-line revenue', () => {
    const transactions = [
      legacyTxn({ date: '2026-05-01', category: 'EARN', amount: 700_000 }),
      multiLineTxn({
        date: '2026-05-02',
        category: 'EARN',
        amount: 4_759_000,
        lines: [
          { account: ACC.kas, debit: 4_759_000 },
          { account: ACC.revenue, credit: 4_759_000 },
        ],
      }),
    ];

    const series = buildMonthlyProfitAndLossSeries(transactions, 2026);

    expect(series.revenue[4]).toBe(5_459_000);
    expect(series.netProfit[4]).toBe(5_459_000);
  });
});
