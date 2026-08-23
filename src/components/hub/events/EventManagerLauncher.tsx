'use client';

/**
 * Isi tab operasional hub /calendar untuk bisnis jasa sektor creative_agency:
 * Event Manager modul "Book Your Spot" (migr 136).
 *
 * Model mentalnya beda dari kalender booking akomodasi: bukan mengisi tanggal
 * yang sudah pasti, tapi MEMBUKA BEBERAPA TANGGAL KANDIDAT sekaligus lalu
 * membaca tanggal mana yang duluan penuh. Badge "Penuh" cuma sinyal — tanggal
 * lain baru ditutup saat manager menekan "Jadikan pemenang".
 *
 * Tiap pendaftar publik otomatis jadi lead + pesan masuk di inbox /leads
 * (dikerjakan RPC register_event_slot), jadi tidak ada pipeline follow-up
 * terpisah yang perlu dijaga di sini.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarDays,
  CalendarPlus,
  Check,
  Copy,
  Link2,
  Loader2,
  Lock,
  Palette,
  PartyPopper,
  Pencil,
  Plus,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBusinessContext } from '@/context/BusinessContext';
import { useLanguage } from '@/context/LanguageContext';
import { isManagerRole } from '@/lib/roles';
import { EmptyState } from '@/components/ui/EmptyState';
import { ColorPickerField } from '@/components/ui/ColorPickerField';
import { DEFAULT_BRAND_COLOR } from '@/lib/colorUtils';
import { getOmniChannel, upsertOmniChannel } from '@/lib/api/omniChannel';
import {
  addEventDate,
  deleteEventDate,
  deleteEventSession,
  getEventRegistrations,
  getEventSessions,
  markEventDateWinner,
  updateEventSession,
  updateRegistrationStatus,
} from '@/lib/api/events';
import type {
  BusinessOmniChannel,
  EventRegistration,
  EventSession,
  EventSessionDate,
  EventSessionStatus,
} from '@/types';
import { EventSessionModal } from './EventSessionModal';
import { EventSlotGrid } from './EventSlotGrid';

interface Props {
  /** Node header HubPage — tombol "Buat event" di-portal ke sini agar sejajar
   *  dengan judul & tab, bukan jadi baris tersendiri (pola sama dgn kalender). */
  headerSlot?: HTMLDivElement | null;
}

// Ghost chip (DESIGN_SYSTEM §3.4): border + teks berwarna, tanpa fill —
// status sesi bukan aksi yang perlu menonjol berat, cukup sinyal ringan
// di samping judul.
const STATUS_BADGE: Record<EventSessionStatus, string> = {
  draft: 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400',
  open: 'border-emerald-200 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400',
  closed: 'border-primary-200 dark:border-primary-800/60 text-primary-600 dark:text-primary-400',
  cancelled: 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500',
};
const STATUS_BADGE_GHOST_BASE = 'px-2 py-0.5 rounded-full text-xs font-semibold border';

function formatDayName(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(new Date(`${iso}T00:00:00`));
}

function formatDayMonth(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(
    new Date(`${iso}T00:00:00`)
  );
}

function formatFullDate(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${iso}T00:00:00`));
}

export function EventManagerLauncher({ headerSlot }: Props) {
  const { activeBusinessId, user, userRole } = useBusinessContext();
  const { t } = useLanguage();
  const e = t.events;
  const canManage = isManagerRole(userRole);

  const statusLabel = useCallback(
    (status: EventSessionStatus): string =>
      ({ draft: e.statusDraft, open: e.statusOpen, closed: e.statusClosed, cancelled: e.statusCancelled })[status],
    [e]
  );

  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedDateId, setSelectedDateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EventSession | null>(null);
  const [newDate, setNewDate] = useState('');
  const [copied, setCopied] = useState(false);
  // Konfigurasi halaman publik: sumber slug (untuk link) sekaligus tempat warna
  // brand disimpan (`button_color`) — satu field yang sama dengan pengaturan di
  // Bisnis → Halaman Publik, bukan salinan khusus event.
  const [channel, setChannel] = useState<BusinessOmniChannel | null>(null);
  const [brandColor, setBrandColor] = useState(DEFAULT_BRAND_COLOR);
  const [savedBrandColor, setSavedBrandColor] = useState(DEFAULT_BRAND_COLOR);
  const [savingBrand, setSavingBrand] = useState(false);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  );

  const loadRegistrations = useCallback(async (session: EventSession | null) => {
    const dateIds = (session?.dates ?? []).map((d) => d.id);
    if (dateIds.length === 0) {
      setRegistrations([]);
      return;
    }
    try {
      setRegistrations(await getEventRegistrations(dateIds));
    } catch {
      setRegistrations([]);
    }
  }, []);

  const load = useCallback(
    async (preferSessionId?: string) => {
      if (!activeBusinessId) return;
      setLoading(true);
      try {
        const list = await getEventSessions(activeBusinessId);
        setSessions(list);
        const next =
          list.find((s) => s.id === preferSessionId) ??
          list.find((s) => s.id === selectedSessionId) ??
          list[0] ??
          null;
        setSelectedSessionId(next?.id ?? null);
        setSelectedDateId((prev) =>
          next?.dates?.some((d) => d.id === prev) ? prev : next?.dates?.[0]?.id ?? null
        );
        await loadRegistrations(next);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : e.loadFailed);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeBusinessId, loadRegistrations]
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId]);

  // Halaman publik bisnis — slug untuk link pendaftaran + warna brand.
  useEffect(() => {
    let cancelled = false;
    if (!activeBusinessId) return;
    getOmniChannel(activeBusinessId)
      .then((oc) => {
        if (cancelled) return;
        setChannel(oc);
        const color = oc?.button_color ?? DEFAULT_BRAND_COLOR;
        setBrandColor(color);
        setSavedBrandColor(color);
      })
      .catch(() => {
        if (!cancelled) setChannel(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeBusinessId]);

  const capacity = selectedSession ? selectedSession.team_count * selectedSession.players_per_team : 0;

  const takenByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const reg of registrations) {
      if (reg.status === 'cancelled') continue;
      map.set(reg.session_date_id, (map.get(reg.session_date_id) ?? 0) + 1);
    }
    return map;
  }, [registrations]);

  const publicLink = useMemo(() => {
    if (!channel?.is_published || !channel.slug || !selectedSession) return null;
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    return `${origin}/${channel.slug}/events/${selectedSession.id}`;
  }, [channel, selectedSession]);

  const selectSession = useCallback(
    async (session: EventSession) => {
      setSelectedSessionId(session.id);
      setSelectedDateId(session.dates?.[0]?.id ?? null);
      await loadRegistrations(session);
    },
    [loadRegistrations]
  );

  async function handleSaved(saved: EventSession) {
    await load(saved.id);
  }

  async function handleStatusChange(status: EventSessionStatus) {
    if (!selectedSession) return;
    setBusy(true);
    try {
      await updateEventSession(selectedSession.id, { status });
      toast.success(e.toastUpdated);
      await load(selectedSession.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : e.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSession() {
    if (!selectedSession) return;
    if (!confirm(e.deleteConfirm)) return;
    setBusy(true);
    try {
      await deleteEventSession(selectedSession.id);
      toast.success(e.toastDeleted);
      setSelectedSessionId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : e.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddDate() {
    if (!selectedSession || !activeBusinessId || !newDate) return;
    setBusy(true);
    try {
      const sortOrder = (selectedSession.dates?.length ?? 0);
      const created = await addEventDate(selectedSession.id, activeBusinessId, newDate, sortOrder);
      setNewDate('');
      toast.success(e.toastDateAdded);
      await load(selectedSession.id);
      setSelectedDateId(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : e.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveDate(date: EventSessionDate) {
    const taken = takenByDate.get(date.id) ?? 0;
    if (!confirm(e.removeDateConfirm.replace('{n}', String(taken)))) return;
    setBusy(true);
    try {
      await deleteEventDate(date.id);
      toast.success(e.toastDateRemoved);
      await load(selectedSession?.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : e.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkWinner(date: EventSessionDate) {
    if (!confirm(e.markWinnerConfirm.replace('{date}', formatFullDate(date.event_date)))) return;
    setBusy(true);
    try {
      await markEventDateWinner(date.id);
      toast.success(e.toastWinner);
      await load(selectedSession?.id);
      setSelectedDateId(date.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : e.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelSlot(reg: EventRegistration) {
    if (!confirm(e.cancelSlotConfirm.replace('{name}', reg.name))) return;
    setBusy(true);
    try {
      await updateRegistrationStatus(reg.id, 'cancelled');
      toast.success(e.toastSlotCancelled);
      setRegistrations((prev) =>
        prev.map((r) => (r.id === reg.id ? { ...r, status: 'cancelled' as const } : r))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : e.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Simpan warna brand ke `business_omni_channels.button_color`. Payload sengaja
   * hanya 4 kolom: upsert Supabase cuma menyentuh kolom yang dikirim, jadi
   * setelan halaman publik lainnya (galeri, harga, link) tidak ikut tertimpa —
   * tapi slug/title/is_published wajib ikut karena schema-nya mewajibkan.
   */
  async function handleSaveBrandColor() {
    if (!activeBusinessId || !channel?.slug) return;
    setSavingBrand(true);
    try {
      const updated = await upsertOmniChannel(
        activeBusinessId,
        {
          slug: channel.slug,
          title: channel.title,
          is_published: channel.is_published,
          button_color: brandColor,
        },
        user?.id ?? ''
      );
      setChannel((prev) => (prev ? { ...prev, button_color: brandColor } : updated));
      setSavedBrandColor(brandColor);
      toast.success(e.toastBrandSaved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : e.saveFailed);
    } finally {
      setSavingBrand(false);
    }
  }

  function handleCopyLink() {
    if (!publicLink) return;
    navigator.clipboard
      .writeText(publicLink)
      .then(() => {
        setCopied(true);
        toast.success(e.linkCopied);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error(e.saveFailed));
  }

  if (!canManage) {
    return (
      <EmptyState icon={Lock} title={t.calendar.accessRestricted} description={t.calendar.accessRestrictedDesc} />
    );
  }

  const createButton = (
    <button
      type="button"
      onClick={() => {
        setEditing(null);
        setModalOpen(true);
      }}
      className="btn-primary inline-flex items-center gap-2"
    >
      <Plus className="w-4 h-4" />
      {e.newEvent}
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400 dark:text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const selectedDate = selectedSession?.dates?.find((d) => d.id === selectedDateId) ?? null;
  const dateRegistrations = registrations.filter((r) => r.session_date_id === selectedDateId);
  const hasWinner = (selectedSession?.dates ?? []).some((d) => d.status === 'won');

  return (
    <div className="space-y-4">
      {headerSlot && sessions.length > 0 ? createPortal(createButton, headerSlot) : null}

      {sessions.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          variant="accent"
          title={e.emptyTitle}
          description={e.emptyDesc}
          action={
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="btn-primary-glow inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {e.emptyCta}
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] gap-4 items-start">
          {/* Daftar event */}
          <div className="card-static p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">
              {e.listTitle}
            </p>
            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {sessions.map((s) => {
                const isActive = s.id === selectedSessionId;
                const dateCount = s.dates?.length ?? 0;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selectSession(s)}
                    className={`w-full text-left rounded-xl px-3 py-2.5 border transition-colors ${
                      isActive
                        ? 'border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-transparent bg-gray-50 dark:bg-gray-700/40 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                        {s.title}
                      </p>
                      <span className={`${STATUS_BADGE_GHOST_BASE} shrink-0 ${STATUS_BADGE[s.status]}`}>{statusLabel(s.status)}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {s.team_count} × {s.players_per_team} ·{' '}
                      {dateCount > 0 ? `${dateCount} ${e.datesTitle.toLowerCase()}` : e.noDates.toLowerCase()}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail event terpilih */}
          {selectedSession && (
            <div className="space-y-4">
              <div className="card-static p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                        {selectedSession.title}
                      </h2>
                      <span className={`${STATUS_BADGE_GHOST_BASE} ${STATUS_BADGE[selectedSession.status]}`}>
                        {statusLabel(selectedSession.status)}
                      </span>
                    </div>
                    {selectedSession.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 whitespace-pre-line">
                        {selectedSession.description}
                      </p>
                    )}
                    <p className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-2">
                      <Users className="w-3.5 h-3.5" />
                      {e.capacityHint
                        .replace('{teams}', String(selectedSession.team_count))
                        .replace('{players}', String(selectedSession.players_per_team))
                        .replace('{total}', String(capacity))}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {selectedSession.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange('open')}
                        disabled={busy || (selectedSession.dates?.length ?? 0) === 0}
                        title={(selectedSession.dates?.length ?? 0) === 0 ? e.noDatesDesc : undefined}
                        className="btn-primary disabled:opacity-50"
                      >
                        {e.publish}
                      </button>
                    )}
                    {selectedSession.status === 'open' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange('closed')}
                        disabled={busy}
                        className="btn-ghost disabled:opacity-50"
                      >
                        {e.closeRegistration}
                      </button>
                    )}
                    {selectedSession.status === 'closed' && !hasWinner && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange('open')}
                        disabled={busy}
                        className="btn-ghost disabled:opacity-50"
                      >
                        {e.reopen}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(selectedSession);
                        setModalOpen(true);
                      }}
                      className="btn-icon"
                      title={t.common.edit}
                      aria-label={t.common.edit}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteSession}
                      disabled={busy}
                      className="btn-icon hover:text-red-500 dark:hover:text-red-400"
                      title={t.common.delete}
                      aria-label={t.common.delete}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Halaman publik: link pendaftaran + warna brand yang menyetirnya */}
                <div className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-700/40 px-4 py-3 space-y-3">
                  {!channel?.is_published ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{e.noPublicPage}</p>
                  ) : selectedSession.status === 'draft' ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{e.linkAfterPublish}</p>
                  ) : (
                    publicLink && (
                      <div className="flex items-center gap-3">
                        <Link2 className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                            {e.publicLink}
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-200 truncate">{publicLink}</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyLink}
                          className="btn-ghost inline-flex items-center gap-1.5 shrink-0"
                        >
                          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          <span className="hidden sm:inline">{e.copyLink}</span>
                        </button>
                      </div>
                    )
                  )}

                  {channel?.is_published && (
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
                      <div className="flex items-center gap-2 mb-2">
                        <Palette className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                        <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                          {e.brandColorTitle}
                        </p>
                      </div>
                      <ColorPickerField
                        value={brandColor}
                        onChange={setBrandColor}
                        trailing={
                          brandColor !== savedBrandColor ? (
                            <button
                              type="button"
                              onClick={handleSaveBrandColor}
                              disabled={savingBrand}
                              className="btn-primary disabled:opacity-50"
                            >
                              {savingBrand ? t.common.saving : e.brandColorSave}
                            </button>
                          ) : null
                        }
                      />
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{e.brandColorHint}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tanggal kandidat */}
              <div className="card-static p-5">
                <div className="mb-3">
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">{e.datesTitle}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{e.datesHint}</p>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                  {(selectedSession.dates ?? []).map((date) => {
                    const taken = takenByDate.get(date.id) ?? 0;
                    const isFull = capacity > 0 && taken >= capacity;
                    const isSelected = date.id === selectedDateId;
                    const pct = capacity > 0 ? Math.min(100, (taken / capacity) * 100) : 0;

                    return (
                      <div
                        key={date.id}
                        className={`shrink-0 w-[168px] rounded-xl border p-3 transition-colors ${
                          isSelected
                            ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        } ${date.status === 'discarded' ? 'opacity-60' : ''}`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedDateId(date.id)}
                          className="w-full text-left"
                        >
                          <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                            {formatDayName(date.event_date)}
                          </p>
                          <p className="text-base font-bold text-gray-900 dark:text-gray-100">
                            {formatDayMonth(date.event_date)}
                          </p>

                          <div className="mt-2 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isFull ? 'bg-emerald-500' : 'bg-primary-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 tabular-nums">
                            {e.slotsTaken.replace('{taken}', String(taken)).replace('{total}', String(capacity))}
                          </p>
                        </button>

                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          {date.status === 'won' && (
                            <span className="badge bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 inline-flex items-center gap-1">
                              <Trophy className="w-3 h-3" /> {e.dateWinner}
                            </span>
                          )}
                          {date.status === 'discarded' && (
                            <span className="badge bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                              {e.dateDiscarded}
                            </span>
                          )}
                          {date.status === 'candidate' && isFull && (
                            <span className="badge bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                              {e.dateFull}
                            </span>
                          )}
                        </div>

                        {date.status === 'candidate' && (
                          <div className="mt-2 flex items-center gap-1">
                            {selectedSession.status === 'open' && (
                              <button
                                type="button"
                                onClick={() => handleMarkWinner(date)}
                                disabled={busy}
                                className="flex-1 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline text-left disabled:opacity-50"
                              >
                                {e.markWinner}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveDate(date)}
                              disabled={busy}
                              className="btn-icon p-1.5 hover:text-red-500 dark:hover:text-red-400"
                              title={e.removeDate}
                              aria-label={e.removeDate}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Tambah tanggal — kartu terakhir, sejajar dengan kandidat lain */}
                  {selectedSession.status !== 'closed' && selectedSession.status !== 'cancelled' && (
                    <div className="shrink-0 w-[190px] rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-3">
                      <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        <CalendarPlus className="w-3.5 h-3.5" />
                        {e.addDate}
                      </p>
                      <input
                        type="date"
                        value={newDate}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(ev) => setNewDate(ev.target.value)}
                        className="input mt-2 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={handleAddDate}
                        disabled={!newDate || busy}
                        className="btn-primary w-full mt-2 disabled:opacity-50"
                      >
                        {t.common.add}
                      </button>
                    </div>
                  )}
                </div>

                {(selectedSession.dates?.length ?? 0) === 0 && (
                  <EmptyState icon={CalendarDays} size="sm" title={e.noDates} description={e.noDatesDesc} />
                )}
              </div>

              {/* Grid slot tanggal terpilih */}
              {selectedDate && (
                <div className="card-static p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">{e.gridTitle}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatFullDate(selectedDate.event_date)}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums shrink-0">
                      {e.slotsTaken
                        .replace('{taken}', String(takenByDate.get(selectedDate.id) ?? 0))
                        .replace('{total}', String(capacity))}
                    </span>
                  </div>

                  <EventSlotGrid
                    session={selectedSession}
                    registrations={dateRegistrations}
                    canManage={canManage}
                    brandColor={brandColor}
                    onCancelSlot={handleCancelSlot}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <EventSessionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        businessId={activeBusinessId ?? ''}
        userId={user?.id ?? ''}
        session={editing}
        brandColor={brandColor}
        onSaved={handleSaved}
      />
    </div>
  );
}
