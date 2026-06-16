import { describe, expect, it } from 'vitest';
import { getAiTier } from '@/lib/ai/concierge/tier';
import type { ChannelIntegration } from '@/types';

function makeIntegration(config: Record<string, unknown> | null): ChannelIntegration {
  return {
    id: 'i1',
    business_id: 'b1',
    channel: 'instagram',
    is_active: true,
    config,
    ai_enabled: true,
    ai_mode: 'auto',
    created_at: '',
    updated_at: '',
  } as ChannelIntegration;
}

describe('getAiTier', () => {
  it('config.ai_tier = "pro" → pro', () => {
    expect(getAiTier(makeIntegration({ ai_tier: 'pro' }))).toBe('pro');
  });

  it('config.ai_tier = "free" → free', () => {
    expect(getAiTier(makeIntegration({ ai_tier: 'free' }))).toBe('free');
  });

  it('config null / kosong → free (default aman)', () => {
    expect(getAiTier(makeIntegration(null))).toBe('free');
    expect(getAiTier(makeIntegration({}))).toBe('free');
  });

  it('nilai sampah / tak dikenal → free', () => {
    expect(getAiTier(makeIntegration({ ai_tier: 'premium' }))).toBe('free');
    expect(getAiTier(makeIntegration({ ai_tier: 123 }))).toBe('free');
    expect(getAiTier(makeIntegration({ lain: 'x' }))).toBe('free');
  });
});
