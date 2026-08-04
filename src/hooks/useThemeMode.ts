'use client';

import { useTheme } from 'next-themes';
import { useEffect, useMemo, useState } from 'react';

/**
 * Tema yang tersedia. 'midnight' adalah tema gelap kedua (near-black ala terminal
 * trading) — secara komponen ia tetap "dark": semua varian `dark:` Tailwind ikut
 * menyala, yang berbeda hanya nilai skala netralnya (lihat .midnight di globals.css).
 */
export type ThemeMode = 'light' | 'dark' | 'midnight';

export const THEME_MODES: ThemeMode[] = ['light', 'dark', 'midnight'];

function normalize(theme: string | undefined): ThemeMode {
  return theme === 'dark' || theme === 'midnight' ? theme : 'light';
}

/**
 * Pembungkus useTheme() yang sadar tema midnight.
 *
 * Pakai ini — bukan `resolvedTheme === 'dark'` langsung — di mana pun logika JS
 * perlu tahu apakah latar sedang gelap, supaya midnight tidak salah terbaca terang.
 *
 * `mounted` false sampai hidrasi selesai; selama itu `mode` selalu 'light' agar
 * render server dan klien cocok.
 */
export function useThemeMode() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const mode = mounted ? normalize(resolvedTheme) : 'light';

  return {
    mode,
    /** true untuk 'dark' maupun 'midnight'. */
    isDark: mode !== 'light',
    /** Pilihan mentah user — bisa 'system', beda dengan `mode` yang sudah diresolusi. */
    theme,
    setTheme,
    mounted,
  };
}

export interface ChartPalette {
  /** Latar tooltip; juga warna border antar segmen donut. */
  surface: string;
  /** Judul & isi tooltip. */
  text: string;
  /** Label legenda. */
  muted: string;
  /** Label tick sumbu — sengaja terpisah dari `muted`, di light mode nilainya beda. */
  axis: string;
  /** Garis grid solid. */
  grid: string;
  /** Garis grid transparan (dipakai chart budget). */
  gridSoft: string;
  /** Border tooltip. */
  border: string;
}

/**
 * Nilainya sengaja dikunci di TS, bukan dibaca via getComputedStyle: Chart.js
 * butuh warna saat menyusun config, dan pembacaan CSS variable saat itu rawan
 * balapan dengan pergantian class tema. Angka di sini mirror .midnight/.dark
 * di globals.css — ubah keduanya bersamaan.
 */
export const CHART_PALETTES: Record<ThemeMode, ChartPalette> = {
  light: {
    surface: '#ffffff',
    text: '#1f2937',
    muted: '#6b7280',
    axis: '#9ca3af',
    grid: '#f3f4f6',
    gridSoft: 'rgba(229, 231, 235, 0.8)',
    border: '#e5e7eb',
  },
  dark: {
    surface: '#1f2937',
    text: '#f3f4f6',
    muted: '#9ca3af',
    axis: '#9ca3af',
    grid: '#374151',
    gridSoft: 'rgba(75, 85, 99, 0.3)',
    border: '#374151',
  },
  midnight: {
    surface: '#18181e',
    text: '#eeeef3',
    muted: '#9696a2',
    axis: '#9696a2',
    grid: '#282830',
    gridSoft: 'rgba(56, 56, 66, 0.55)',
    border: '#282830',
  },
};

/**
 * Warna chart yang mengikuti tema aktif. Hasilnya dimemoisasi per mode supaya
 * aman dipakai sebagai dependency useMemo di config Chart.js.
 */
export function useChartPalette(): ChartPalette & { isDark: boolean; mode: ThemeMode } {
  const { mode, isDark } = useThemeMode();
  return useMemo(() => ({ ...CHART_PALETTES[mode], isDark, mode }), [mode, isDark]);
}
