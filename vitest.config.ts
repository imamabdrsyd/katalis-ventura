import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/calculations.ts'],
      // Current coverage from 5 target functions (calculateFinancialSummary,
      // calculateBalanceSheet, calculateCashFlow, classifyLegacyFin, classifyCashFlow).
      // Audit target: 80% — raise as we add tests for the remaining helpers.
      thresholds: {
        lines: 40,
        functions: 25,
        branches: 35,
        statements: 40,
      },
    },
  },
});
