/**
 * Katalog avatar opsional untuk pendaftar event (migr 140) — galeri TETAP,
 * bukan upload bebas. Dipakai dua arah: picker di form Lobby publik, dan
 * render ulang avatar terpilih di grid slot admin & publik.
 *
 * File sumbernya `public/persona/*.png` — SAMA PERSIS dengan avatar karakter
 * AXION Agent (Bianca, Sri Mulyani, Stanley, Concierge, agent) yang dipakai
 * di fitur Agent. Dipilih sengaja oleh user (bukan bikin aset baru) meski itu
 * berarti pemain event bisa memilih wajah yang di fitur lain merepresentasikan
 * persona AI — kalau nanti user berubah pikiran, cukup ganti daftar di sini +
 * migrasi baru untuk CHECK constraint-nya (lihat migr 140).
 *
 * `key` adalah SATU-SATUNYA nilai yang boleh disimpan ke
 * `event_registrations.avatar_key` — divalidasi di server (route publik) DAN
 * di DB (CHECK constraint), dua lapis, karena field ini datang dari input
 * publik tanpa auth.
 */

export interface EventAvatarOption {
  key: string;
  /** Nama tampilan singkat — bukan identitas resmi, cuma label buat picker. */
  label: string;
  src: string;
}

export const EVENT_AVATAR_OPTIONS: EventAvatarOption[] = [
  { key: 'persona-1', label: 'Avatar 1', src: '/persona/persona-1.png' },
  { key: 'persona-2', label: 'Avatar 2', src: '/persona/persona-2.png' },
  { key: 'bianca', label: 'Bianca', src: '/persona/bianca.png' },
  { key: 'sri-mulyani', label: 'Sri Mulyani', src: '/persona/sri-mulyani.png' },
  { key: 'stanley', label: 'Stanley', src: '/persona/stanley.png' },
  { key: 'concierge', label: 'Concierge', src: '/persona/concierge.png' },
  { key: 'agent', label: 'Agent', src: '/persona/agent.png' },
];

const EVENT_AVATAR_KEYS = new Set(EVENT_AVATAR_OPTIONS.map((o) => o.key));

export function isValidEventAvatarKey(key: string): boolean {
  return EVENT_AVATAR_KEYS.has(key);
}

export function resolveEventAvatarSrc(key: string | null | undefined): string | null {
  if (!key) return null;
  return EVENT_AVATAR_OPTIONS.find((o) => o.key === key)?.src ?? null;
}
