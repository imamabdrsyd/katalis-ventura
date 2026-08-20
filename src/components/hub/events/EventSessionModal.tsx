'use client';

/**
 * Form buat/edit satu sesi event ("Book Your Spot", migr 136).
 *
 * Format tim (team_count × players_per_team) menentukan KAPASITAS TIAP TANGGAL
 * kandidat, bukan kapasitas event keseluruhan — itu yang bikin "tanggal mana
 * yang duluan penuh" jadi sinyal yang bisa dibandingkan antar tanggal.
 */

import { useEffect, useMemo, useState } from 'react';
import { Instagram, MessageCircle, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { NumberStepperField } from '@/components/ui/NumberStepperField';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import FloatingField from '@/components/ui/FloatingField';
import { ColorPickerField } from '@/components/ui/ColorPickerField';
import {
  DEFAULT_BRAND_COLOR,
  resolveTeamTextColor,
  toggleTextColorOverride,
  type TextColorOverride,
} from '@/lib/colorUtils';
import { useLanguage } from '@/context/LanguageContext';
import { createEventSession, updateEventSession } from '@/lib/api/events';
import type { EventContactMethod, EventSession } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  userId: string;
  /** null = buat baru. */
  session: EventSession | null;
  /** Warna brand halaman publik — dipakai tim yang belum diberi warna sendiri. */
  brandColor: string;
  onSaved: (session: EventSession) => void;
}

const MAX_TEAMS = 20;
const MAX_PLAYERS = 20;

export function EventSessionModal({ isOpen, onClose, businessId, userId, session, brandColor, onSaved }: Props) {
  const { t } = useLanguage();
  const e = t.events;
  const isEdit = session != null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [teamCount, setTeamCount] = useState(2);
  const [playersPerTeam, setPlayersPerTeam] = useState(2);
  const [contactMethod, setContactMethod] = useState<EventContactMethod>('whatsapp');
  const [teamLabels, setTeamLabels] = useState<Record<string, string>>({});
  // Kosong = tim ikut warna brand. Nilai hanya masuk map saat owner benar-benar
  // memilih warna, jadi "belum diatur" tetap bisa dibedakan dari "kebetulan indigo".
  const [teamColors, setTeamColors] = useState<Record<string, string>>({});
  // Kosong = teks chip dihitung otomatis dari kontras. Klik chip pratinjau
  // men-toggle-nya jadi eksplisit 'light'/'dark' — lihat resolveTeamTextColor.
  const [teamTextColors, setTeamTextColors] = useState<Record<string, TextColorOverride>>({});
  const [saving, setSaving] = useState(false);

  // Muat ulang isian tiap modal dibuka supaya sisa ketikan sesi sebelumnya
  // tidak bocor ke form berikutnya.
  useEffect(() => {
    if (!isOpen) return;
    setTitle(session?.title ?? '');
    setDescription(session?.description ?? '');
    setTeamCount(session?.team_count ?? 2);
    setPlayersPerTeam(session?.players_per_team ?? 2);
    setContactMethod(session?.contact_method ?? 'whatsapp');
    setTeamLabels(session?.team_labels ?? {});
    setTeamColors(session?.team_colors ?? {});
    setTeamTextColors(session?.team_text_colors ?? {});
  }, [isOpen, session]);

  const capacity = teamCount * playersPerTeam;
  const teamNumbers = useMemo(
    () => Array.from({ length: teamCount }, (_, i) => i + 1),
    [teamCount]
  );

  const canSave = title.trim().length >= 2 && teamCount > 0 && playersPerTeam > 0 && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      // Buang label tim yang kosong / di luar jumlah tim sekarang — kalau tidak,
      // mengecilkan jumlah tim meninggalkan nama tim hantu di JSONB.
      const labels: Record<string, string> = {};
      const colors: Record<string, string> = {};
      const textColors: Record<string, TextColorOverride> = {};
      for (const n of teamNumbers) {
        const key = String(n);
        const label = (teamLabels[key] ?? '').trim();
        if (label) labels[key] = label;
        const color = teamColors[key];
        if (color) colors[key] = color;
        const textColor = teamTextColors[key];
        if (textColor) textColors[key] = textColor;
      }

      const saved = isEdit
        ? await updateEventSession(session.id, {
            title: title.trim(),
            description: description.trim() || null,
            team_count: teamCount,
            players_per_team: playersPerTeam,
            team_labels: labels,
            team_colors: colors,
            team_text_colors: textColors,
            contact_method: contactMethod,
          })
        : await createEventSession({
            business_id: businessId,
            title: title.trim(),
            description: description.trim() || null,
            team_count: teamCount,
            players_per_team: playersPerTeam,
            team_labels: labels,
            team_colors: colors,
            team_text_colors: textColors,
            contact_method: contactMethod,
            status: 'draft',
            created_by: userId,
          });

      toast.success(isEdit ? e.toastUpdated : e.toastCreated);
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : e.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? e.formEditTitle : e.formCreateTitle}
      size="lg"
      confirmOnClose
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            {t.common.cancel}
          </button>
          <button type="button" onClick={handleSave} disabled={!canSave} className="btn-primary disabled:opacity-50">
            {saving ? t.common.saving : t.common.save}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <FloatingField
          label={e.fieldTitle}
          placeholder={e.fieldTitlePlaceholder}
          value={title}
          maxLength={120}
          onChange={(ev) => setTitle(ev.target.value)}
        />

        <div>
          <label className="label" htmlFor="event-description">
            {e.fieldDescription} <span className="font-normal text-gray-400">({t.common.optional})</span>
          </label>
          <textarea
            id="event-description"
            rows={2}
            value={description}
            maxLength={500}
            placeholder={e.fieldDescriptionPlaceholder}
            onChange={(ev) => setDescription(ev.target.value)}
            className="input resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberStepperField
            label={e.fieldTeamCount}
            value={teamCount}
            onValueChange={setTeamCount}
            min={1}
            max={MAX_TEAMS}
          />
          <NumberStepperField
            label={e.fieldPlayersPerTeam}
            value={playersPerTeam}
            onValueChange={setPlayersPerTeam}
            min={1}
            max={MAX_PLAYERS}
          />
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-gray-700/40 px-4 py-3">
          <Users className="w-4 h-4 text-primary-500 dark:text-primary-400 shrink-0" />
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {e.capacityHint
              .replace('{teams}', String(teamCount))
              .replace('{players}', String(playersPerTeam))
              .replace('{total}', String(capacity))}
          </p>
        </div>

        <div>
          <span className="label">{e.fieldContactMethod}</span>
          <SegmentedToggle<EventContactMethod>
            value={contactMethod}
            onChange={setContactMethod}
            ariaLabel={e.fieldContactMethod}
            options={[
              { value: 'whatsapp', label: e.contactWhatsapp, icon: <MessageCircle className="w-3.5 h-3.5" /> },
              { value: 'instagram', label: e.contactInstagram, icon: <Instagram className="w-3.5 h-3.5" /> },
            ]}
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{e.contactMethodHint}</p>
        </div>

        <div>
          <span className="label">
            {e.fieldTeams} <span className="font-normal text-gray-400">({t.common.optional})</span>
          </span>
          <div className="space-y-4">
            {teamNumbers.map((n) => {
              const key = String(n);
              const custom = teamColors[key];
              const color = custom ?? brandColor ?? DEFAULT_BRAND_COLOR;
              const name = (teamLabels[key] ?? '').trim() || e.teamLabel.replace('{n}', key);
              const textColor = resolveTeamTextColor(color, teamTextColors[key]);

              return (
                <div key={n} className="flex items-end gap-3">
                  <ColorPickerField
                    value={color}
                    onChange={(hex) => setTeamColors((prev) => ({ ...prev, [key]: hex }))}
                    size="sm"
                    showPresets={false}
                    trailing={
                      custom ? (
                        <button
                          type="button"
                          onClick={() =>
                            setTeamColors((prev) => {
                              const next = { ...prev };
                              delete next[key];
                              return next;
                            })
                          }
                          className="btn-icon p-1.5"
                          title={e.teamColorReset}
                          aria-label={e.teamColorReset}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      ) : null
                    }
                  />
                  <FloatingField
                    wrapperClassName="flex-1 min-w-0"
                    label={e.teamLabel.replace('{n}', key)}
                    value={teamLabels[key] ?? ''}
                    maxLength={40}
                    onChange={(ev) => setTeamLabels((prev) => ({ ...prev, [key]: ev.target.value }))}
                  />
                  {/* Pratinjau chip tim persis seperti yang dilihat pendaftar. Klik
                      untuk memaksa teksnya hitam/putih — kontras otomatis kadang
                      "benar secara angka" tapi tidak sesuai selera owner. */}
                  <button
                    type="button"
                    onClick={() =>
                      setTeamTextColors((prev) => ({ ...prev, [key]: toggleTextColorOverride(textColor) }))
                    }
                    title={e.teamTextColorToggle}
                    className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold shrink-0 max-w-[140px] transition-transform active:scale-95 motion-reduce:transform-none"
                    style={{ backgroundColor: color, color: textColor }}
                  >
                    <span className="truncate">{name}</span>
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{e.teamsHint}</p>
        </div>
      </div>
    </Modal>
  );
}
