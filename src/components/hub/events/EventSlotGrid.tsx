'use client';

/**
 * Grid slot satu tanggal kandidat (sisi manager): baris = tim, sel = player.
 *
 * Ini satu-satunya permukaan yang menampilkan `contact_value` pendaftar —
 * halaman publik hanya pernah melihat nama. Kontaknya sekaligus jadi tautan
 * chat langsung supaya follow-up manual tidak perlu salin-tempel nomor.
 */

import { Instagram, MessageCircle, X } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { DEFAULT_BRAND_COLOR, resolveTeamTextColor } from '@/lib/colorUtils';
import { resolveEventAvatarSrc } from '@/lib/events/avatars';
import type { EventContactMethod, EventRegistration, EventSession } from '@/types';

interface Props {
  session: EventSession;
  registrations: EventRegistration[];
  canManage: boolean;
  /** Warna brand halaman publik — dipakai tim yang belum punya warna sendiri. */
  brandColor?: string;
  onCancelSlot: (registration: EventRegistration) => void;
}

function contactHref(method: EventContactMethod, value: string): string {
  return method === 'whatsapp' ? `https://wa.me/${value}` : `https://instagram.com/${value}`;
}

function contactDisplay(method: EventContactMethod, value: string): string {
  return method === 'whatsapp' ? `+${value}` : `@${value}`;
}

export function EventSlotGrid({
  session,
  registrations,
  canManage,
  brandColor = DEFAULT_BRAND_COLOR,
  onCancelSlot,
}: Props) {
  const { t } = useLanguage();
  const e = t.events;

  // Peta "tim-player" → pendaftar aktif. Yang dibatalkan sengaja dianggap slot
  // kosong: index unik parsial di DB juga membebaskan slotnya.
  const bySlot = new Map<string, EventRegistration>();
  for (const reg of registrations) {
    if (reg.status === 'cancelled') continue;
    bySlot.set(`${reg.team_number}-${reg.player_number}`, reg);
  }

  const ContactIcon = session.contact_method === 'whatsapp' ? MessageCircle : Instagram;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {Array.from({ length: session.team_count }, (_, i) => i + 1).map((teamNumber) => {
        const label =
          session.team_labels?.[String(teamNumber)]?.trim() ||
          e.teamLabel.replace('{n}', String(teamNumber));
        // Warna tim = identitas yang sama persis dengan yang dilihat pendaftar
        // di Lobby, supaya manager tidak perlu menerjemahkan "Tim 2 itu yang mana".
        const teamColor = session.team_colors?.[String(teamNumber)]?.trim() || brandColor;
        const teamTextColor = resolveTeamTextColor(teamColor, session.team_text_colors?.[String(teamNumber)]);
        const players = Array.from({ length: session.players_per_team }, (_, i) => i + 1);
        const taken = players.filter((p) => bySlot.has(`${teamNumber}-${p}`)).length;
        const isFull = taken === players.length;

        return (
          <div
            key={teamNumber}
            className="rounded-xl border border-gray-200 dark:border-gray-700 p-3"
          >
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: teamColor }}
                  aria-hidden="true"
                />
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{label}</p>
              </div>
              <span
                className={`text-xs font-semibold tabular-nums ${
                  isFull
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {taken}/{players.length}
              </span>
            </div>

            <div className="space-y-2">
              {players.map((playerNumber) => {
                const reg = bySlot.get(`${teamNumber}-${playerNumber}`);

                if (!reg) {
                  return (
                    <div
                      key={playerNumber}
                      className="flex items-center gap-2.5 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 px-3 py-2"
                    >
                      <span className="w-6 h-6 shrink-0 grid place-items-center rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-[11px] font-semibold text-gray-400 dark:text-gray-500">
                        {playerNumber}
                      </span>
                      <p className="text-sm text-gray-400 dark:text-gray-500">{e.emptySlot}</p>
                    </div>
                  );
                }

                const avatarSrc = resolveEventAvatarSrc(reg.avatar_key);

                return (
                  <div
                    key={playerNumber}
                    className="group flex items-center gap-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2"
                  >
                    {avatarSrc ? (
                      // Avatar pilihan pendaftar (migr 140) — persis yang tampil di Lobby
                      // publik. Nomor player tetap ditandai lewat chip kecil di pojok,
                      // supaya info itu tidak hilang begitu avatar menggantikan lingkaran
                      // bernomor (satu-satunya penanda nomor player di baris ini).
                      <span className="relative w-6 h-6 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={avatarSrc} alt="" className="w-full h-full rounded-full object-cover" />
                        <span
                          className="absolute -bottom-1 -right-1 w-3.5 h-3.5 grid place-items-center rounded-full text-[8px] font-bold ring-2 ring-white dark:ring-gray-800"
                          style={{ backgroundColor: teamColor, color: teamTextColor }}
                        >
                          {playerNumber}
                        </span>
                      </span>
                    ) : (
                      <span
                        className="w-6 h-6 shrink-0 grid place-items-center rounded-full text-[11px] font-bold"
                        style={{ backgroundColor: teamColor, color: teamTextColor }}
                      >
                        {playerNumber}
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                        {reg.name}
                      </p>
                      <a
                        href={contactHref(session.contact_method, reg.contact_value)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                      >
                        <ContactIcon className="w-3 h-3" />
                        <span className="truncate">
                          {contactDisplay(session.contact_method, reg.contact_value)}
                        </span>
                      </a>
                    </div>

                    {canManage && (
                      <button
                        type="button"
                        onClick={() => onCancelSlot(reg)}
                        className="btn-icon opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                        title={e.cancelSlot}
                        aria-label={e.cancelSlot}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
