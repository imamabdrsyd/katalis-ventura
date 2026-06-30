import { describe, expect, it } from 'vitest';
import { buildAgentSystemPrompt } from '@/lib/ai/financialPersonas';

describe('buildAgentSystemPrompt', () => {
  it('persona null → base prompt (nol regresi), tetap punya tool-calling', () => {
    const base = buildAgentSystemPrompt(null);
    expect(base).toContain('KEMAMPUAN TAMBAHAN (Tool Calling)');
    expect(base).toContain('query_transactions');
    // Tidak ada overlay persona
    expect(base).not.toContain('PERAN AKTIF');
  });

  it('pajak → overlay pajak + disclaimer + tetap punya tool-calling & ACCOUNTING_DOMAIN', () => {
    const p = buildAgentSystemPrompt('pajak');
    expect(p).toContain('Agent Sri Mulyani');
    expect(p).toContain('INDIKATIF');
    expect(p).toContain('KEMAMPUAN TAMBAHAN (Tool Calling)'); // base tetap ada
    expect(p).toContain('SISTEM 6 KATEGORI TRANSAKSI'); // ACCOUNTING_DOMAIN ter-compose
  });

  it('pembukuan → overlay pembukuan', () => {
    const p = buildAgentSystemPrompt('pembukuan');
    expect(p).toContain('Agent Bianca');
  });

  it('analis_fpna → overlay analis', () => {
    const p = buildAgentSystemPrompt('analis_fpna');
    expect(p).toContain('Agent Stanley');
  });

  it('overlay menambah, bukan mengganti — prompt persona lebih panjang dari base', () => {
    const base = buildAgentSystemPrompt(null);
    expect(buildAgentSystemPrompt('pajak').length).toBeGreaterThan(base.length);
  });
});
