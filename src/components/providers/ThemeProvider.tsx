'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ThemeProviderProps } from 'next-themes';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // 'midnight' adalah tema gelap kedua (near-black), opt-in eksplisit —
      // `system` tetap hanya memilih antara light/dark seperti sebelumnya.
      themes={['light', 'dark', 'midnight']}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
