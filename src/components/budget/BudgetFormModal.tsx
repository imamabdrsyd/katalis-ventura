'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import type { Budget, BudgetFormData } from '@/types';

interface BudgetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BudgetFormData) => void;
  saving: boolean;
  editBudget?: Budget | null;
}

const inputClass =
  'w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors';

export function BudgetFormModal({ isOpen, onClose, onSubmit, saving, editBudget }: BudgetFormModalProps) {
  const currentYear = new Date().getFullYear();

  const [form, setForm] = useState<BudgetFormData>({
    name: `Budget ${currentYear}`,
    start_date: `${currentYear}-01-01`,
    end_date: `${currentYear}-12-31`,
    notes: '',
  });

  useEffect(() => {
    if (editBudget) {
      setForm({
        name: editBudget.name,
        start_date: editBudget.start_date,
        end_date: editBudget.end_date,
        notes: editBudget.notes || '',
      });
    } else {
      setForm({
        name: `Budget ${currentYear}`,
        start_date: `${currentYear}-01-01`,
        end_date: `${currentYear}-12-31`,
        notes: '',
      });
    }
  }, [editBudget, currentYear, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.start_date || !form.end_date) return;
    onSubmit(form);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editBudget ? 'Edit Budget' : 'Buat Budget Baru'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nama Budget
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
            placeholder="Budget 2026"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Mulai
            </label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Selesai
            </label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              className={inputClass}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Catatan (opsional)
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className={`${inputClass} resize-none`}
            rows={3}
            placeholder="Catatan tentang budget ini..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : editBudget ? 'Update' : 'Buat Budget'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
