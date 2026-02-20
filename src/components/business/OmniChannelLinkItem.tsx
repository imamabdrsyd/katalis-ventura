'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, Pencil, Trash2, Loader2 } from 'lucide-react';
import type { OmniChannelLink } from '@/types';
import { updateOmniChannelLink, deleteOmniChannelLink } from '@/lib/api/omniChannel';
import { CHANNEL_META } from '@/lib/omniChannelMeta';

interface Props {
  link: OmniChannelLink;
  index: number;
  total: number;
  onMove: (index: number, direction: 'up' | 'down') => void;
  onEdit: () => void;
  onChanged: () => void;
}

export function OmniChannelLinkItem({ link, index, total, onMove, onEdit, onChanged }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const meta = CHANNEL_META[link.channel_type];

  const handleToggle = async () => {
    setToggling(true);
    try {
      await updateOmniChannelLink(link.id, { is_active: !link.is_active });
      onChanged();
    } catch (err) {
      console.error('Failed to toggle link:', err);
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Hapus link ini?')) return;
    setDeleting(true);
    try {
      await deleteOmniChannelLink(link.id);
      onChanged();
    } catch (err) {
      console.error('Failed to delete link:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
      link.is_active
        ? 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
        : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60'
    }`}>
      {/* Channel icon */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.bgColor} ${meta.textColor}`}
      >
        <span
          className="w-4 h-4"
          dangerouslySetInnerHTML={{ __html: meta.iconSvg }}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
          {link.label}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
          {link.url}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Reorder */}
        <button
          onClick={() => onMove(index, 'up')}
          disabled={index === 0}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
        >
          <ChevronUp className="w-4 h-4 text-gray-400" />
        </button>
        <button
          onClick={() => onMove(index, 'down')}
          disabled={index === total - 1}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
        >
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>

        {/* Toggle active */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`ml-1 relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            link.is_active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              link.is_active ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>

        {/* Edit */}
        <button
          onClick={onEdit}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ml-1"
        >
          <Pencil className="w-3.5 h-3.5 text-gray-400" />
        </button>

        {/* Delete */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
        >
          {deleting ? (
            <Loader2 className="w-3.5 h-3.5 text-red-400 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          )}
        </button>
      </div>
    </div>
  );
}
