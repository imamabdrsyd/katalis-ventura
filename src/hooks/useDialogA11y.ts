'use client';

import { useEffect, useRef } from 'react';

/**
 * Selector elemen yang bisa menerima fokus keyboard. Dipakai untuk mencari
 * batas awal & akhir siklus Tab di dalam panel dialog.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Body scroll lock dihitung, bukan di-set/unset langsung. Modal yang dibuka DARI
 * modal lain (mis. picker katalog di atas form jurnal) akan meng-unmount lebih
 * dulu; tanpa penghitung ini cleanup-nya membuka kunci scroll padahal modal
 * induknya masih terbuka, dan halaman di belakang ikut bergeser.
 */
let scrollLockCount = 0;

/** Elemen terlihat? `getClientRects` juga benar untuk elemen `position: fixed`. */
function isVisible(el: HTMLElement): boolean {
  return el.getClientRects().length > 0;
}

interface DialogA11yOptions {
  /** Escape ditekan. Dialog yang punya guard sendiri (mis. konfirmasi "buang
   *  perubahan?") memasang logikanya di sini, bukan memasang listener terpisah. */
  onEscape?: () => void;
  /** Setel false untuk dialog yang isinya sudah punya scroll sendiri dan tidak
   *  boleh mengunci body (belum dipakai — disediakan agar call site tak perlu
   *  meniru manual bila suatu saat perlu). */
  lockScroll?: boolean;
}

/**
 * Perilaku aksesibilitas dasar sebuah dialog modal:
 * fokus masuk ke panel saat dibuka, Tab terkurung di dalamnya, Escape ditangani,
 * body terkunci dari scroll, dan fokus kembali ke elemen pemicu saat ditutup.
 *
 * Mengembalikan ref yang HARUS dipasang di elemen panel (yang juga perlu
 * `tabIndex={-1}` agar bisa menerima fokus awal saat panel belum berisi kontrol
 * fokusable apa pun).
 */
export function useDialogA11y(isOpen: boolean, options: DialogA11yOptions = {}) {
  const { onEscape, lockScroll = true } = options;
  const panelRef = useRef<HTMLDivElement>(null);

  // Handler disimpan di ref supaya listener tidak perlu dipasang ulang tiap
  // render — closure-nya selalu yang terbaru saat event benar-benar terjadi.
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    if (lockScroll) {
      scrollLockCount += 1;
      document.body.style.overflow = 'hidden';
    }

    // Panel baru ada di DOM setelah render berikutnya, jadi fokus awal ditunda
    // satu frame.
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel || panel.contains(document.activeElement)) return;
      const first = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).find(isVisible);
      (first ?? panel).focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscapeRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(isVisible);

      // Panel tanpa kontrol fokusable: tahan fokus di panel itu sendiri.
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const insidePanel = !!active && panel.contains(active);

      if (e.shiftKey && (active === first || !insidePanel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !insidePanel)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown);

      if (lockScroll) {
        scrollLockCount = Math.max(0, scrollLockCount - 1);
        if (scrollLockCount === 0) document.body.style.overflow = '';
      }

      // Kembalikan fokus ke pemicu — tapi hanya bila elemennya masih ada di
      // dokumen (baris tabel yang dihapus lewat dialog ini sudah tidak ada).
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus?.();
      }
    };
  }, [isOpen, lockScroll]);

  return panelRef;
}
