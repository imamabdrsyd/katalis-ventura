'use client';

import { Sun, Moon, MoonStar } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { SegmentedToggle, type SegmentedToggleOption } from '@/components/ui/SegmentedToggle';
import { useThemeMode, THEME_MODES, type ThemeMode } from '@/hooks/useThemeMode';

interface ThemeToggleProps {
  /** Varian bertumpuk untuk dropdown profil (lebar terbatas ~176px). */
  inDropdown?: boolean;
}

const ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  midnight: MoonStar,
};

export function ThemeToggle({ inDropdown = false }: ThemeToggleProps) {
  const { t } = useLanguage();
  const { mode, setTheme, mounted } = useThemeMode();

  const labelFor = (m: ThemeMode) =>
    m === 'light' ? t.settings.themeLight : m === 'dark' ? t.settings.themeDark : t.settings.themeMidnight;

  // Placeholder sampai hidrasi selesai — tema sebenarnya baru diketahui di klien,
  // merender kontrol lebih awal bikin flicker pilihan aktif.
  if (!mounted) {
    return inDropdown ? (
      <div className="w-full">
        <div className="mb-1.5 h-4 w-16 rounded bg-gray-100 dark:bg-gray-700" />
        <div className="h-8 w-full rounded-full bg-gray-100 dark:bg-gray-700" />
      </div>
    ) : (
      <div className="p-2 rounded-xl bg-white dark:bg-gray-800">
        <div className="w-5 h-5" />
      </div>
    );
  }

  if (inDropdown) {
    const options: SegmentedToggleOption<ThemeMode>[] = THEME_MODES.map((m) => {
      const Icon = ICONS[m];
      return { value: m, label: <Icon className="w-4 h-4" />, ariaLabel: labelFor(m) };
    });

    return (
      <div className="w-full">
        <div className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
          {t.settings.appearance}
        </div>
        <SegmentedToggle
          options={options}
          value={mode}
          onChange={setTheme}
          fullWidth
          ariaLabel={t.settings.appearance}
        />
      </div>
    );
  }

  // Varian tombol ikon (landing, blog, market-insights): satu tombol, jadi
  // temanya dirotasi. Ikon menampilkan tema tujuan — sama seperti perilaku lama
  // saat masih dua tema.
  const next = THEME_MODES[(THEME_MODES.indexOf(mode) + 1) % THEME_MODES.length];
  const NextIcon = ICONS[next];

  return (
    <button
      onClick={() => setTheme(next)}
      className="p-2 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      aria-label={labelFor(next)}
      title={labelFor(next)}
    >
      <NextIcon
        className={`w-5 h-5 ${next === 'light' ? 'text-amber-500' : 'text-gray-700 dark:text-gray-300'}`}
      />
    </button>
  );
}
