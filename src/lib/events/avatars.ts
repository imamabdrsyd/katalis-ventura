/**
 * Katalog avatar opsional untuk pendaftar event (migr 140) — galeri TETAP,
 * bukan upload bebas. Dipakai dua arah: picker di form Lobby publik, dan
 * render ulang avatar terpilih di grid slot admin & publik.
 *
 * File sumbernya `public/persona/*.png` — sebagian SAMA PERSIS dengan avatar
 * karakter AXION Agent (Bianca, Sri Mulyani, Stanley, Concierge) yang dipakai
 * di fitur Agent (keputusan eksplisit user, bukan aset baru dibuat khusus),
 * plus `persona-1..7` yang generik/khusus avatar. `agent.png` (orchestrator
 * AXION Agent) SENGAJA TIDAK dipakai di sini — user menolaknya (21 Agt 2026):
 * ikon orchestrator tidak cocok jadi wajah pemain event.
 *
 * Kalau nanti user berubah pikiran soal daftar ini, cukup ganti di sini +
 * migrasi baru untuk CHECK constraint-nya (lihat migr 140 & 142).
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
  { key: 'persona-3', label: 'Avatar 3', src: '/persona/persona-3.png' },
  { key: 'persona-4', label: 'Avatar 4', src: '/persona/persona-4.png' },
  { key: 'persona-5', label: 'Avatar 5', src: '/persona/persona-5.png' },
  { key: 'persona-6', label: 'Avatar 6', src: '/persona/persona-6.png' },
  { key: 'persona-7', label: 'Avatar 7', src: '/persona/persona-7.png' },
  { key: 'bianca', label: 'Bianca', src: '/persona/bianca.png' },
  { key: 'sri-mulyani', label: 'Sri Mulyani', src: '/persona/sri-mulyani.png' },
  { key: 'stanley', label: 'Stanley', src: '/persona/stanley.png' },
  { key: 'concierge', label: 'Concierge', src: '/persona/concierge.png' },
];

const EVENT_AVATAR_KEYS = new Set(EVENT_AVATAR_OPTIONS.map((o) => o.key));

export function isValidEventAvatarKey(key: string): boolean {
  return EVENT_AVATAR_KEYS.has(key);
}

export function resolveEventAvatarSrc(key: string | null | undefined): string | null {
  if (!key) return null;
  return EVENT_AVATAR_OPTIONS.find((o) => o.key === key)?.src ?? null;
}
