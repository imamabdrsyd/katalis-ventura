'use client';

/**
 * Mengunci seluruh halaman publik (`/[slug]` dan turunannya) ke tema TERANG,
 * apa pun setelan gelap di HP pengunjung.
 *
 * Kenapa dikunci: halaman publik itu materi promosi milik bisnis — warnanya
 * dipilih owner (logo, warna brand, poster) dengan asumsi latar terang. Ketika
 * pengunjung membukanya dari in-app browser Instagram yang ikut dark mode HP,
 * hasilnya jadi versi gelap yang tidak pernah mereka rancang.
 *
 * Kenapa bukan `forcedTheme` bertingkat dari next-themes: provider-nya dipasang
 * di root layout untuk seluruh aplikasi, dan efek komponen ANAK berjalan lebih
 * dulu daripada efek induknya di React. Provider bertingkat akan menetapkan
 * 'light' lalu langsung ditimpa provider root yang menetapkan 'dark' — jadi
 * penguncian harus bertahan setelah provider root selesai bekerja, bukan sekadar
 * menetapkan sekali. MutationObserver di bawah yang menjamin itu.
 *
 * Kelas asli dikembalikan saat komponen dilepas, supaya owner yang menengok
 * halaman publiknya dari dashboard (navigasi client-side) tidak menemukan
 * dashboard-nya ikut jadi terang saat menekan tombol back.
 */

import { useEffect } from 'react';

export function PublicThemeLock() {
  useEffect(() => {
    const root = document.documentElement;
    const originalClass = root.className;
    const originalColorScheme = root.style.colorScheme;

    const enforceLight = () => {
      if (root.classList.contains('dark') || root.classList.contains('midnight')) {
        root.classList.remove('dark', 'midnight');
      }
      if (!root.classList.contains('light')) root.classList.add('light');
      // Tanpa ini, kontrol bawaan browser (scrollbar, date picker, autofill)
      // tetap dirender versi gelap dan terlihat asing di halaman terang.
      if (root.style.colorScheme !== 'light') root.style.colorScheme = 'light';
    };

    enforceLight();

    const observer = new MutationObserver(enforceLight);
    observer.observe(root, { attributes: true, attributeFilter: ['class', 'style'] });

    return () => {
      observer.disconnect();
      root.className = originalClass;
      root.style.colorScheme = originalColorScheme;
    };
  }, []);

  return null;
}
