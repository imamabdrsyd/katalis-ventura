'use client';

import { Lock, CheckCircle, FileEdit, Loader2 } from 'lucide-react';
import type { BudgetStatus } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  locked: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  approved: 'Disetujui',
  locked: 'Terkunci',
};

interface BudgetStatusActionsProps {
  status: BudgetStatus;
  canManage: boolean;
  saving: boolean;
  onUpdateStatus: (status: BudgetStatus) => void;
}

export function BudgetStatusActions({ status, canManage, saving, onUpdateStatus }: BudgetStatusActionsProps) {
  return (
    <div className="flex items-center gap-3">
      <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[status]}`}>
        {STATUS_LABELS[status]}
      </span>

      {canManage && !saving && (
        <>
          {status === 'draft' && (
            <button
              onClick={() => onUpdateStatus('approved')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Setujui
            </button>
          )}
          {status === 'approved' && (
            <>
              <button
                onClick={() => onUpdateStatus('locked')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                Kunci
              </button>
              <button
                onClick={() => onUpdateStatus('draft')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
              >
                <FileEdit className="w-3.5 h-3.5" />
                Kembali ke Draft
              </button>
            </>
          )}
        </>
      )}

      {saving && (
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
      )}
    </div>
  );
}
