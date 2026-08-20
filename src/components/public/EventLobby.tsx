'use client';

/**
 * Lobby publik "Book Your Spot" — halaman yang dibuka audience dari link bio.
 *
 * Alurnya dua langkah DRILL-DOWN, bukan dua daftar yang menumpuk di satu layar:
 * layar 1 memilih tanggal (di sinilah crowdtesting-nya — tiap tanggal punya
 * kuota sendiri), layar 2 menggantikannya dengan grid slot tim × player.
 *
 * Kenapa mengganti, bukan menambah: versi pertama menampilkan grid slot DI BAWAH
 * daftar tanggal, jadi di HP ketukan pada tanggal tidak menghasilkan perubahan
 * apa pun di layar — responsnya ada ratusan piksel di bawah lipatan dan terbaca
 * seperti tombol rusak. Sekarang satu ketukan = satu layar baru, dengan header
 * lengket berisi tanggal terpilih + jalan kembali.
 *
 * Slot yang sudah diambil menampilkan NAMA saja — kontak pendaftar tidak pernah
 * dikirim ke browser (lihat loadPublicSession).
 *
 * Isi grid di-refresh berkala selama halaman terbuka supaya slot yang baru
 * diambil orang lain terlihat terkunci sebelum ditekan. Kalau tetap bentrok,
 * DB yang jadi wasit (unique index) dan pesannya diarahkan balik ke sini.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Check, ChevronRight, Instagram, Loader2, MessageCircle, Trophy, UserPlus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import FloatingField from '@/components/ui/FloatingField';
import { contactFieldHint, contactFieldLabel, normalizeEventContact } from '@/lib/events/contact';
import { DEFAULT_BRAND_COLOR, brandGradient, readableTextColor, tint } from '@/lib/colorUtils';
import type { PublicEventDate, PublicEventSession } from '@/types';

interface Props {
  session: PublicEventSession;
  business: {
    name: string;
    slug: string;
    logoUrl: string | null;
    buttonColor: string | null;
  };
}

const POLL_INTERVAL_MS = 8000;

function formatFullDate(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${iso}T00:00:00`));
}

function formatDayName(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(new Date(`${iso}T00:00:00`));
}

function formatDayMonth(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long' }).format(
    new Date(`${iso}T00:00:00`)
  );
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function EventLobby({ session: initialSession, business }: Props) {
  const [session, setSession] = useState<PublicEventSession>(initialSession);
  const capacity = session.team_count * session.players_per_team;

  const visibleDates = useMemo(
    () => session.dates.filter((d) => (session.status === 'open' ? d.status === 'candidate' : d.status !== 'discarded')),
    [session]
  );

  const [selectedDateId, setSelectedDateId] = useState<string | null>(
    visibleDates.length === 1 ? visibleDates[0].id : null
  );
  const [formSlot, setFormSlot] = useState<{ team: number; player: number } | null>(null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mySlots, setMySlots] = useState<string[]>([]);
  /** Slot yang baru saja dikunci — dipakai untuk banner konfirmasi di layar slot. */
  const [justLocked, setJustLocked] = useState<{ team: number; player: number } | null>(null);
  /** Arah animasi layar: masuk lebih dalam (kanan→kiri) atau kembali. */
  const [navDirection, setNavDirection] = useState<'forward' | 'back'>('forward');

  const selectedDate: PublicEventDate | null =
    visibleDates.find((d) => d.id === selectedDateId) ?? null;

  // Satu-satunya sumber warna halaman ini: warna brand yang di-set owner. Tidak
  // ada indigo AXION yang tertinggal di permukaan publik — kalau owner memilih
  // hitam, label & bar ikut hitam.
  const accent = business.buttonColor ?? DEFAULT_BRAND_COLOR;
  const teamColorOf = (teamNumber: number) =>
    session.team_colors?.[String(teamNumber)]?.trim() || accent;
  const isOpen = session.status === 'open';
  const wonDate = session.dates.find((d) => d.status === 'won') ?? null;
  const isDateStep = selectedDate == null;
  // Ganti key <section> = elemennya remount, jadi animasi CSS-nya terputar ulang
  // tiap berpindah layar tanpa perlu state animasi apa pun.
  const screenAnimation =
    navDirection === 'forward' ? 'animate-screen-in-forward' : 'animate-screen-in-back';
  // Tanggal tunggal tidak punya "tanggal lain" untuk dituju — jangan tawarkan
  // jalan kembali ke daftar yang isinya cuma satu baris.
  const canChangeDate = visibleDates.length > 1;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/events/${session.id}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = (await res.json()) as { session?: PublicEventSession };
      if (json.session) setSession(json.session);
    } catch {
      /* jaringan putus sesaat — biarkan tampilan lama, percobaan berikutnya menyusul */
    }
  }, [session.id]);

  // Polling hanya selama pendaftaran masih dibuka; sesi tertutup tidak berubah lagi.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => refreshRef.current(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isOpen]);

  // Pindah layar = ganti konten seluruh halaman, jadi posisi scroll lama tidak
  // relevan lagi. Tanpa ini, membuka slot dari tanggal terakhir mendarat di
  // tengah-tengah daftar tim. Lewati saat render pertama (tanggal tunggal yang
  // terpilih otomatis) supaya halaman tidak "melompat" begitu dibuka.
  const firstRenderRef = useRef(true);
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedDateId]);

  const takenMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const slot of selectedDate?.slots ?? []) {
      map.set(`${slot.team_number}-${slot.player_number}`, slot.name);
    }
    return map;
  }, [selectedDate]);

  function backToDates() {
    setNavDirection('back');
    setSelectedDateId(null);
    setJustLocked(null);
  }

  function openDate(dateId: string) {
    setNavDirection('forward');
    setSelectedDateId(dateId);
  }

  function openForm(team: number, player: number) {
    setFormSlot({ team, player });
    setError('');
  }

  async function handleSubmit() {
    if (!formSlot || !selectedDate) return;

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError('Nama minimal 2 huruf');
      return;
    }
    const normalized = normalizeEventContact(session.contact_method, contact);
    if (!normalized.value) {
      setError(normalized.error ?? 'Kontak tidak valid');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/public/events/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionDateId: selectedDate.id,
          teamNumber: formSlot.team,
          playerNumber: formSlot.player,
          name: trimmedName,
          contact,
          website: honeypot,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; code?: string };

      if (!res.ok) {
        setError(json.error ?? 'Gagal menyimpan pendaftaran');
        // Slot keburu diambil orang lain → tarik data terbaru supaya grid jujur.
        if (json.code === 'slot_taken') {
          await refresh();
          setFormSlot(null);
        }
        return;
      }

      setMySlots((prev) => [...prev, `${selectedDate.id}-${formSlot.team}-${formSlot.player}`]);
      setJustLocked({ team: formSlot.team, player: formSlot.player });
      setFormSlot(null);
      setName('');
      setContact('');
      await refresh();
    } catch {
      setError('Jaringan bermasalah. Coba lagi ya.');
    } finally {
      setSubmitting(false);
    }
  }

  const ContactIcon = session.contact_method === 'whatsapp' ? MessageCircle : Instagram;

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 px-4 py-6 sm:py-10">
      <div className="w-full max-w-2xl mx-auto">
        {/* Identitas bisnis — sekaligus jalan balik ke halaman utamanya */}
        <Link href={`/${business.slug}`} className="flex items-center gap-3 mb-6 group w-fit">
          {business.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.logoUrl}
              alt={business.name}
              className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-700"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full grid place-items-center text-white text-sm font-bold"
              style={{ backgroundColor: accent }}
            >
              {initials(business.name)}
            </div>
          )}
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:underline">
            {business.name}
          </span>
        </Link>

        {/* Judul event. Di layar slot, deskripsi & rincian format disembunyikan —
            ruang layar HP dipakai untuk slotnya sendiri, bukan mengulang brief
            yang sudah dibaca di layar sebelumnya. */}
        <div className="mb-5">
          {isDateStep && (
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: accent }}>
              Book Your Spot
            </p>
          )}
          {/* Layar tanggal: nama event yang jadi judul. Layar slot: judulnya
              "Players Lobby" — di titik ini pengunjung sudah tahu event apa yang
              dia buka, yang perlu ditegaskan adalah dia sedang berada di mana. */}
          {isDateStep ? (
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {session.title}
            </h1>
          ) : (
            <>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Players Lobby</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{session.title}</p>
            </>
          )}
          {isDateStep && (
            <>
              {session.description && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
                  {session.description}
                </p>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                {session.team_count} tim × {session.players_per_team} player · {capacity} slot per tanggal
              </p>
            </>
          )}
        </div>

        {/* Pengumuman tanggal pemenang */}
        {wonDate && (
          <div
            className="rounded-2xl border px-5 py-4 mb-6 flex items-start gap-3"
            style={{ borderColor: tint(accent, 35), backgroundColor: tint(accent, 10) }}
          >
            <Trophy className="w-5 h-5 shrink-0 mt-0.5" style={{ color: accent }} />
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Tanggal terpilih</p>
              <p className="text-sm text-gray-700 dark:text-gray-200">{formatFullDate(wonDate.event_date)}</p>
            </div>
          </div>
        )}

        {!isOpen && !wonDate && (
          <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 px-5 py-4 mb-6">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Pendaftaran untuk event ini sudah ditutup.
            </p>
          </div>
        )}

        {/* Layar 1 — pilih tanggal. Barisnya sengaja ringkas (bukan kartu tinggi)
            supaya semua tanggal muat dalam satu layar HP: perbandingan "tanggal
            mana yang paling cepat penuh" itu inti fiturnya, dan perbandingan
            tidak terjadi kalau harus scroll. */}
        {isDateStep && visibleDates.length > 0 && (
          <section key="dates" className={screenAnimation}>
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">
                {isOpen ? 'Pilih tanggal yang kamu bisa' : 'Tanggal event'}
              </h2>
            </div>

            <div className="space-y-2">
              {visibleDates.map((date, index) => {
                const taken = date.slots.length;
                const isFull = taken >= capacity;
                const pct = capacity > 0 ? Math.min(100, (taken / capacity) * 100) : 0;

                return (
                  <button
                    key={date.id}
                    type="button"
                    onClick={() => openDate(date.id)}
                    className="group animate-rise-in w-full flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3.5 text-left transition-all hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm active:scale-[0.99] motion-reduce:transform-none"
                    style={{ animationDelay: `${index * 45}ms` }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        {formatDayName(date.event_date)}
                      </p>
                      <p className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">
                        {formatDayMonth(date.event_date)}
                      </p>
                      {/* Bar & hitungan disatukan dalam satu baris: tiap baris teks
                          tambahan di sini berarti satu tanggal terdorong ke bawah
                          lipatan, dan perbandingan antar tanggal jadi hilang. */}
                      <div className="mt-2 flex items-center gap-2.5">
                        <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                          <div
                            className="animate-bar-grow h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: isFull ? '#10b981' : accent,
                              animationDelay: `${index * 45 + 120}ms`,
                            }}
                          />
                        </div>
                        <span
                          className={`text-[11px] shrink-0 tabular-nums ${
                            isFull
                              ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {isFull ? 'Penuh' : `${taken}/${capacity} slot`}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 shrink-0 text-gray-300 dark:text-gray-600 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Layar 2 — grid slot untuk tanggal terpilih */}
        {selectedDate ? (
          <section key={`slots-${selectedDate.id}`} className={screenAnimation}>
            {/* Header lengket: tanggal yang sedang dilihat tetap terlihat sambil
                menggulir daftar tim, dan jalan kembali selalu terjangkau ibu jari.
                -mx-4 membuatnya menepi ke tepi layar seperti app bar. */}
            <div className="sticky top-0 z-10 -mx-4 px-4 py-3 mb-4 bg-gray-50/90 dark:bg-gray-950/90 backdrop-blur border-b border-gray-200 dark:border-gray-800">
              <div className="max-w-2xl mx-auto flex items-center gap-3">
                {canChangeDate && (
                  <button
                    type="button"
                    onClick={backToDates}
                    className="w-9 h-9 shrink-0 grid place-items-center rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 transition-transform active:scale-95 motion-reduce:transform-none"
                    aria-label="Kembali ke pilihan tanggal"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                    {formatFullDate(selectedDate.event_date)}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
                    {selectedDate.slots.length >= capacity
                      ? 'Semua slot penuh'
                      : `${selectedDate.slots.length}/${capacity} slot terisi`}
                  </p>
                </div>
                {canChangeDate && (
                  <button
                    type="button"
                    onClick={backToDates}
                    className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                  >
                    Ganti tanggal
                  </button>
                )}
              </div>
            </div>

            {/* Konfirmasi setelah slot terkunci — jawaban atas "terus, gue ngapain
                sekarang?" yang sebelumnya cuma dijawab modal yang menutup diri. */}
            {justLocked && (
              <div
                className="animate-pop-in rounded-2xl border px-4 py-3.5 mb-4 flex items-start gap-3"
                style={{ borderColor: tint(accent, 35), backgroundColor: tint(accent, 10) }}
              >
                <span
                  className="w-8 h-8 shrink-0 grid place-items-center rounded-full"
                  style={{ backgroundColor: accent, color: readableTextColor(accent) }}
                >
                  <Check className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Slot kamu terkunci</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200">
                    {session.team_labels?.[String(justLocked.team)]?.trim() || `Tim ${justLocked.team}`} · Player{' '}
                    {justLocked.player}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Panitia akan menghubungi kamu lewat{' '}
                    {session.contact_method === 'whatsapp' ? 'WhatsApp' : 'Instagram'} untuk detail acaranya.
                  </p>
                </div>
              </div>
            )}

            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-3">
              {isOpen ? 'Pilih slot kamu' : 'Daftar player'}
            </h2>

            <div className="space-y-3">
              {Array.from({ length: session.team_count }, (_, i) => i + 1).map((teamNumber, teamIndex) => {
                const label = session.team_labels?.[String(teamNumber)]?.trim() || `Tim ${teamNumber}`;
                const players = Array.from({ length: session.players_per_team }, (_, i) => i + 1);
                const takenCount = players.filter((p) => takenMap.has(`${teamNumber}-${p}`)).length;

                const teamColor = teamColorOf(teamNumber);

                return (
                  <div
                    key={teamNumber}
                    className="animate-rise-in rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
                    style={{ animationDelay: `${teamIndex * 55}ms` }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      {/* Nama tim tampil sebagai chip berwarna timnya — inilah
                          identitas yang dipakai owner di poster/story mereka. */}
                      <span
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold max-w-full truncate"
                        style={{ backgroundColor: teamColor, color: readableTextColor(teamColor) }}
                      >
                        {label}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums shrink-0">
                        {takenCount}/{players.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {players.map((playerNumber) => {
                        const takenName = takenMap.get(`${teamNumber}-${playerNumber}`);
                        const isMine = mySlots.includes(
                          `${selectedDate.id}-${teamNumber}-${playerNumber}`
                        );

                        if (takenName) {
                          return (
                            <div
                              key={playerNumber}
                              className={`flex items-center gap-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 px-3 py-2.5 ${
                                isMine ? 'animate-pop-in' : ''
                              }`}
                            >
                              <span
                                className="w-8 h-8 shrink-0 grid place-items-center rounded-full text-[11px] font-bold"
                                style={{
                                  backgroundColor: teamColor,
                                  color: readableTextColor(teamColor),
                                  boxShadow: isMine ? `0 0 0 2px ${accent}` : undefined,
                                }}
                              >
                                {initials(takenName)}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                                  {takenName}
                                </p>
                                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                                  {isMine ? 'Slot kamu' : `Player ${playerNumber}`}
                                </p>
                              </div>
                              {isMine && <Check className="w-4 h-4 ml-auto shrink-0" style={{ color: accent }} />}
                            </div>
                          );
                        }

                        if (!isOpen) {
                          return (
                            <div
                              key={playerNumber}
                              className="flex items-center gap-2.5 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 px-3 py-2.5 text-gray-400 dark:text-gray-500"
                            >
                              <span className="w-8 h-8 shrink-0 grid place-items-center rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-[11px] font-semibold">
                                {playerNumber}
                              </span>
                              <p className="text-sm">Kosong</p>
                            </div>
                          );
                        }

                        return (
                          <button
                            key={playerNumber}
                            type="button"
                            onClick={() => openForm(teamNumber, playerNumber)}
                            className="group flex items-center gap-2.5 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 px-3 py-2.5 text-left transition-colors hover:border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          >
                            <span
                              className="w-8 h-8 shrink-0 grid place-items-center rounded-full border border-dashed transition-colors"
                              style={{ borderColor: tint(teamColor, 55), color: teamColor }}
                            >
                              <UserPlus className="w-4 h-4" />
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                                Ambil slot ini
                              </p>
                              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                                Player {playerNumber}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <p className="text-xs text-center text-gray-400 dark:text-gray-600 mt-12">Made with AXION</p>
      </div>

      {/* Form isi slot */}
      <Modal
        isOpen={formSlot != null}
        onClose={() => setFormSlot(null)}
        title="Kunci slot kamu"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setFormSlot(null)} className="btn-ghost">
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 text-white text-sm font-semibold py-2.5 px-4 rounded-xl shadow-sm hover:shadow-md hover:brightness-110 active:scale-[0.98] motion-reduce:transform-none transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: brandGradient(accent), color: readableTextColor(accent) }}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Menyimpan...' : 'Kunci slot'}
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          {formSlot && selectedDate && (
            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/40 px-4 py-3">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2 flex-wrap">
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: teamColorOf(formSlot.team),
                    color: readableTextColor(teamColorOf(formSlot.team)),
                  }}
                >
                  {session.team_labels?.[String(formSlot.team)]?.trim() || `Tim ${formSlot.team}`}
                </span>
                Player {formSlot.player}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {formatFullDate(selectedDate.event_date)}
              </p>
            </div>
          )}

          <FloatingField
            label="Nama kamu"
            value={name}
            maxLength={80}
            autoComplete="name"
            onChange={(ev) => setName(ev.target.value)}
          />

          <FloatingField
            label={contactFieldLabel(session.contact_method)}
            placeholder={contactFieldHint(session.contact_method)}
            value={contact}
            maxLength={60}
            inputMode={session.contact_method === 'whatsapp' ? 'tel' : 'text'}
            icon={<ContactIcon className="w-4 h-4" />}
            onChange={(ev) => setContact(ev.target.value)}
          />

          {/* Honeypot: tak terlihat manusia, diisi bot. Server menolak diam-diam. */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={honeypot}
            onChange={(ev) => setHoneypot(ev.target.value)}
            className="hidden"
          />

          {error && (
            <p className="text-sm text-red-500 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          <p className="text-xs text-gray-400 dark:text-gray-500">
            Kontakmu cuma dipakai panitia untuk mengabari detail event.
          </p>
        </div>
      </Modal>
    </main>
  );
}
