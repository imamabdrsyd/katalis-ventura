'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { OmniChannelLink } from '@/types';
import { reorderOmniChannelLinks } from '@/lib/api/omniChannel';
import { OmniChannelLinkItem } from './OmniChannelLinkItem';
import { AddOmniChannelLinkModal } from './AddOmniChannelLinkModal';

interface Props {
  omniChannelId: string;
  businessId: string;
  links: OmniChannelLink[];
  onChanged: () => void;
}

export function OmniChannelLinkList({ omniChannelId, businessId, links, onChanged }: Props) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLink, setEditingLink] = useState<OmniChannelLink | null>(null);

  const sorted = [...links].sort((a, b) => a.sort_order - b.sort_order);

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sorted.length) return;

    const updates = [
      { id: sorted[index].id, sort_order: sorted[swapIndex].sort_order },
      { id: sorted[swapIndex].id, sort_order: sorted[index].sort_order },
    ];

    try {
      await reorderOmniChannelLinks(updates);
      onChanged();
    } catch (err) {
      console.error('Failed to reorder:', err);
    }
  };

  return (
    <div>
      {sorted.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
          Belum ada link. Tambahkan link pertama kamu.
        </p>
      ) : (
        <div className="space-y-2 mb-4">
          {sorted.map((link, idx) => (
            <OmniChannelLinkItem
              key={link.id}
              link={link}
              index={idx}
              total={sorted.length}
              onMove={handleMove}
              onEdit={() => setEditingLink(link)}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}

      <button
        onClick={() => setShowAddModal(true)}
        className="w-full px-4 py-2.5 border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-xl hover:border-indigo-400 hover:text-indigo-500 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition-colors text-sm font-medium flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Tambah Link
      </button>

      {/* Add Modal */}
      {showAddModal && (
        <AddOmniChannelLinkModal
          businessId={businessId}
          nextSortOrder={sorted.length}
          onClose={() => setShowAddModal(false)}
          onSaved={onChanged}
        />
      )}

      {/* Edit Modal */}
      {editingLink && (
        <AddOmniChannelLinkModal
          businessId={businessId}
          nextSortOrder={editingLink.sort_order}
          editingLink={editingLink}
          onClose={() => setEditingLink(null)}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}
