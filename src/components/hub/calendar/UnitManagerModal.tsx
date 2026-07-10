'use client';

import { useState, useEffect, useCallback } from 'react';
import { Home, Plus, Loader2, Trash2, Tag, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import type { BusinessUnit, CatalogItem } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { createUnit, updateUnit, deleteUnit } from '@/lib/api/units';

interface UnitManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  userId: string;
  units: BusinessUnit[];
  rateItems: CatalogItem[]; // catalog items yang bisa jadi sumber harga (dropdown per unit)
  onChanged: () => void; // reload units di parent
}

/**
 * Kelola unit fisik (properti/kamar/villa) — tambah/ganti nama/hapus, set
 * item sumber harga & URL impor iCal per unit. Tiap unit adalah kalender
 * booking & occupancy yang terpisah ("kalau ada unit lain, kalendarnya juga
 * beda"). Terpisah dari tab Katalog (yang murni layanan/rate plan).
 */
export function UnitManagerModal({
  isOpen,
  onClose,
  businessId,
  userId,
  units,
  rateItems,
  onChanged,
}: UnitManagerModalProps) {
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [localDrafts, setLocalDrafts] = useState<Record<string, { name: string; icalUrl: string }>>({});

  useEffect(() => {
    if (!isOpen) return;
    setLocalDrafts(
      Object.fromEntries(units.map((u) => [u.id, { name: u.name, icalUrl: u.ical_import_url ?? '' }]))
    );
    setNewName('');
  }, [isOpen, units]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return toast.error('Nama unit wajib diisi.');
    setCreating(true);
    try {
      await createUnit({ business_id: businessId, name: newName.trim(), created_by: userId });
      toast.success(`Unit "${newName.trim()}" dibuat`);
      setNewName('');
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat unit');
    } finally {
      setCreating(false);
    }
  }, [newName, businessId, userId, onChanged]);

  const handleRenameBlur = useCallback(
    async (unit: BusinessUnit) => {
      const draft = localDrafts[unit.id];
      if (!draft || draft.name.trim() === unit.name || !draft.name.trim()) return;
      setBusyId(unit.id);
      try {
        await updateUnit(unit.id, { name: draft.name.trim() });
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal mengubah nama unit');
      } finally {
        setBusyId(null);
      }
    },
    [localDrafts, onChanged]
  );

  const handleRateItemChange = useCallback(
    async (unit: BusinessUnit, rateItemId: string) => {
      setBusyId(unit.id);
      try {
        await updateUnit(unit.id, { rate_item_id: rateItemId || null });
        toast.success('Sumber harga unit diperbarui');
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal mengubah sumber harga');
      } finally {
        setBusyId(null);
      }
    },
    [onChanged]
  );

  const handleIcalBlur = useCallback(
    async (unit: BusinessUnit) => {
      const draft = localDrafts[unit.id];
      if (!draft || draft.icalUrl === (unit.ical_import_url ?? '')) return;
      setBusyId(unit.id);
      try {
        await updateUnit(unit.id, { ical_import_url: draft.icalUrl.trim() || null });
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal menyimpan URL iCal');
      } finally {
        setBusyId(null);
      }
    },
    [localDrafts, onChanged]
  );

  const handleToggleActive = useCallback(
    async (unit: BusinessUnit) => {
      setBusyId(unit.id);
      try {
        await updateUnit(unit.id, { is_active: !unit.is_active });
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal mengubah status unit');
      } finally {
        setBusyId(null);
      }
    },
    [onChanged]
  );

  const handleDelete = useCallback(
    async (unit: BusinessUnit) => {
      if (units.length <= 1) {
        toast.error('Tidak bisa menghapus unit terakhir — minimal 1 unit diperlukan untuk kalender.');
        return;
      }
      setBusyId(unit.id);
      try {
        await deleteUnit(unit.id);
        toast.success(`Unit "${unit.name}" dihapus`);
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal menghapus unit');
      } finally {
        setBusyId(null);
      }
    },
    [units.length, onChanged]
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Kelola unit" size="2xl">
      <div className="space-y-5">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 flex items-start gap-3">
          <Home className="w-4 h-4 text-primary-500 dark:text-primary-400 mt-0.5 shrink-0" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Unit = properti/kamar/villa fisik yang bisa dibooking. Tiap unit punya kalender,
            occupancy, dan kalender harga sendiri — terpisah dari layanan/rate plan di tab Katalog.
          </p>
        </div>

        {/* Tambah unit baru */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            className="input flex-1"
            placeholder="Nama unit baru, mis. Villa B"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Tambah unit
          </button>
        </div>

        {/* Daftar unit */}
        <div className="space-y-3">
          {units.map((unit) => {
            const draft = localDrafts[unit.id] ?? { name: unit.name, icalUrl: unit.ical_import_url ?? '' };
            const busy = busyId === unit.id;
            return (
              <div
                key={unit.id}
                className={`border border-gray-100 dark:border-gray-700 rounded-xl p-4 space-y-3 ${
                  !unit.is_active ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    className="input flex-1 font-semibold bg-gray-50 dark:bg-gray-700"
                    value={draft.name}
                    onChange={(e) =>
                      setLocalDrafts((p) => ({ ...p, [unit.id]: { ...draft, name: e.target.value } }))
                    }
                    onBlur={() => handleRenameBlur(unit)}
                    disabled={busy}
                  />
                  <label className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 shrink-0">
                    <input
                      type="checkbox"
                      checked={unit.is_active}
                      onChange={() => handleToggleActive(unit)}
                      disabled={busy}
                      className="w-3.5 h-3.5 rounded text-primary-600 focus:ring-primary-500"
                    />
                    Aktif
                  </label>
                  <button
                    type="button"
                    onClick={() => handleDelete(unit)}
                    disabled={busy}
                    className="btn-icon shrink-0"
                    aria-label={`Hapus unit ${unit.name}`}
                    title="Hapus unit"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>

                <div>
                  <label className="label flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-gray-400" /> Sumber harga (kalender Harga)
                  </label>
                  <select
                    className="input bg-gray-50 dark:bg-gray-700"
                    value={unit.rate_item_id ?? ''}
                    onChange={(e) => handleRateItemChange(unit, e.target.value)}
                    disabled={busy}
                  >
                    <option value="">— belum dipilih —</option>
                    {rateItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-gray-400" /> URL impor iCal OTA
                  </label>
                  <input
                    type="url"
                    className="input bg-gray-50 dark:bg-gray-700"
                    placeholder="https://www.airbnb.com/calendar/ical/...ics"
                    value={draft.icalUrl}
                    onChange={(e) =>
                      setLocalDrafts((p) => ({ ...p, [unit.id]: { ...draft, icalUrl: e.target.value } }))
                    }
                    onBlur={() => handleIcalBlur(unit)}
                    disabled={busy}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
