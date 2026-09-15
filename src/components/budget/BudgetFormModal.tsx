'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import type { Budget, BudgetFormData } from '@/types';
import { useLanguage } from '@/context/LanguageContext';

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
  const { t } = useLanguage();
  const tb = t.budget;
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
    <Modal isOpen={isOpen} onClose={onClose} title={editBudget ? tb.formTitleEdit : tb.formTitleCreate}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {tb.nameLabel}
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
            placeholder={tb.namePlaceholder}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {tb.startLabel}
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
              {tb.endLabel}
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
            {`${t.common.notes} (${t.common.optional})`}
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className={`${inputClass} resize-none`}
            rows={3}
            placeholder={tb.notesPlaceholder}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            {t.common.cancel}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
          >
            {saving ? t.common.saving : editBudget ? tb.update : tb.createBudget}
          </button>
        </div>
      </form>
    </Modal>
  );
}
