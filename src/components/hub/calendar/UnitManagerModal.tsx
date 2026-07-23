'use client';

import { useState, useEffect, useCallback } from 'react';
import { Home, Plus, Loader2, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { BusinessUnit } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { createUnit, updateUnit, deleteUnit } from '@/lib/api/units';
import { useCalendarUnit } from './CalendarUnitContext';

interface UnitManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  userId: string;
  onChanged: () => void; // reload units di context
}

/**
 * Kelola unit fisik (properti/kamar/villa) — SWITCH unit aktif + tambah/rename/
 * hapus. Unit = level teratas: memilih unit di sini mengganti kalender DAN daftar
 * layanan (tab Services) yang tampil. Harga TIDAK lagi dikonfigurasi di sini —
 * itu diatur per item layanan (rate_kind weekday/weekend/monthly, migr 124).
 */
export function UnitManagerModal({ isOpen, onClose, businessId, userId, onChanged }: UnitManagerModalProps) {
  const { units, selectedUnit, setSelectedUnitId } = useCalendarUnit();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setNameDrafts(Object.fromEntries(units.map((u) => [u.id, u.name])));
    setNewName('');
  }, [isOpen, units]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return toast.error('Nama unit wajib diisi.');
    setCreating(true);
    try {
      const created = await createUnit({ business_id: businessId, name: newName.trim(), created_by: userId });
      toast.success(`Unit "${newName.trim()}" dibuat`);
      setNewName('');
      onChanged();
      // Otomatis pindah ke unit yang baru dibuat (kalender & layanan ikut).
      setSelectedUnitId(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat unit');
    } finally {
      setCreating(false);
    }
  }, [newName, businessId, userId, onChanged, setSelectedUnitId]);

  const handleRenameBlur = useCallback(
    async (unit: BusinessUnit) => {
      const draft = nameDrafts[unit.id];
      if (!draft || draft.trim() === unit.name || !draft.trim()) return;
      setBusyId(unit.id);
      try {
        await updateUnit(unit.id, { name: draft.trim() });
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal mengubah nama unit');
      } finally {
        setBusyId(null);
      }
    },
    [nameDrafts, onChanged]
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
      if (units.filter((u) => !u.deleted_at).length <= 1) {
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
    [units, onChanged]
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Kelola unit" size="2xl">
      <div className="space-y-5">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 flex items-start gap-3">
          <Home className="w-4 h-4 text-primary-500 dark:text-primary-400 mt-0.5 shrink-0" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Unit = properti/kamar/villa fisik yang bisa dibooking. Pilih unit untuk melihat kalender &amp;
            layanannya. Tiap unit punya kalender, occupancy, dan daftar layanan (harga) sendiri. Harga
            diatur di tiap item layanan (Weekday/Weekend/Bulanan), bukan di sini.
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

        {/* Daftar unit — klik untuk memilih (switch kalender & layanan) */}
        <div className="space-y-2">
          {(() => {
            const liveUnits = units.filter((u) => !u.deleted_at);
            const singleUnit = liveUnits.length <= 1;
            return liveUnits.map((unit) => {
            const busy = busyId === unit.id;
            const isSelected = selectedUnit?.id === unit.id;
            return (
              <div
                key={unit.id}
                className={`flex items-center gap-2 border rounded-xl p-3 transition-colors ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20'
                    : 'border-gray-100 dark:border-gray-700'
                } ${!unit.is_active ? 'opacity-60' : ''}`}
              >
                {/* Radio pilih unit */}
                <button
                  type="button"
                  onClick={() => setSelectedUnitId(unit.id)}
                  className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'border-primary-500 bg-primary-500 text-white'
                      : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
                  }`}
                  aria-label={`Pilih ${unit.name}`}
                  title={`Pilih ${unit.name}`}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                </button>

                <input
                  type="text"
                  className="input flex-1 font-semibold bg-transparent"
                  value={nameDrafts[unit.id] ?? unit.name}
                  onChange={(e) => setNameDrafts((p) => ({ ...p, [unit.id]: e.target.value }))}
                  onBlur={() => handleRenameBlur(unit)}
                  disabled={busy}
                />
                {/* "Aktif" hanya relevan bila >1 unit — menonaktifkan unit tunggal
                    bikin kalender & layanan kosong (empty-state). Disembunyikan. */}
                {!singleUnit && (
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
                )}
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
            );
          });
          })()}
        </div>
      </div>
    </Modal>
  );
}
