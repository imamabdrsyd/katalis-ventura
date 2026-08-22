import { describe, it, expect } from 'vitest';
import { formatEventTime, formatEventTimeRange, formatEventSchedule } from '@/lib/events/schedule';

describe('formatEventTime', () => {
  it('memotong detik dari TIME Postgres', () => {
    expect(formatEventTime('19:00:00')).toBe('19:00');
  });

  it('menormalkan jam satu digit', () => {
    expect(formatEventTime('9:30:00')).toBe('09:30');
  });

  it('kosong untuk null/undefined/spasi', () => {
    expect(formatEventTime(null)).toBe('');
    expect(formatEventTime(undefined)).toBe('');
    expect(formatEventTime('   ')).toBe('');
  });
});

describe('formatEventTimeRange', () => {
  it('menggabungkan mulai & selesai dengan en dash', () => {
    expect(formatEventTimeRange('19:00:00', '21:00:00')).toBe('19:00–21:00');
  });

  it('tanpa jam selesai → jam mulai saja, tanpa dash menggantung', () => {
    expect(formatEventTimeRange('19:00:00', null)).toBe('19:00');
  });

  it('tanpa jam mulai → kosong, walau jam selesai terisi', () => {
    expect(formatEventTimeRange(null, '21:00:00')).toBe('');
  });
});

describe('formatEventSchedule', () => {
  it('lokasi lebih dulu, dipisah middot', () => {
    expect(formatEventSchedule('GOR Sukapura', '19:00:00', '21:00:00')).toBe('GOR Sukapura · 19:00–21:00');
  });

  it('hanya lokasi → tanpa pemisah menggantung', () => {
    expect(formatEventSchedule('GOR Sukapura', null, null)).toBe('GOR Sukapura');
  });

  it('hanya jam → tanpa pemisah menggantung', () => {
    expect(formatEventSchedule(null, '19:00:00', null)).toBe('19:00');
  });

  it('dua-duanya kosong → string kosong (pemanggil pakai teks cadangan)', () => {
    expect(formatEventSchedule(null, null, null)).toBe('');
    expect(formatEventSchedule('  ', '', '')).toBe('');
  });
});
