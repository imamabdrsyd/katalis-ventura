'use client';

import { Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface LineItemInput {
  item_name: string;
  quantity: number;
  unit_price: number;
}

interface InvoiceLineItemEditorProps {
  items: LineItemInput[];
  onChange: (items: LineItemInput[]) => void;
  itemLabel?: string;
}

function getPlaceholder(itemLabel?: string): string {
  const label = (itemLabel || 'item').toLowerCase();
  return `Nama ${label}...`;
}

export function InvoiceLineItemEditor({
  items,
  onChange,
  itemLabel = 'Item',
}: InvoiceLineItemEditorProps) {
  const handleItemChange = (
    index: number,
    field: keyof LineItemInput,
    value: string | number
  ) => {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      return { ...item, [field]: value };
    });
    onChange(updated);
  };

  const handleAddItem = () => {
    onChange([...items, { item_name: '', quantity: 1, unit_price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div>
      {/* Header */}
      <div className="hidden sm:grid sm:grid-cols-[1fr_80px_140px_120px_40px] gap-2 mb-2 px-1">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {itemLabel}
        </span>
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Qty
        </span>
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Harga Satuan
        </span>
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 text-right">
          Total
        </span>
        <span />
      </div>

      {/* Rows */}
      <div className="space-y-2">
        {items.map((item, index) => {
          const rowTotal = item.quantity * item.unit_price;
          return (
            <div
              key={index}
              className="grid grid-cols-1 sm:grid-cols-[1fr_80px_140px_120px_40px] gap-2 items-start bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 sm:p-2 sm:bg-transparent sm:dark:bg-transparent sm:rounded-none"
            >
              {/* Item name */}
              <div>
                <label className="sm:hidden text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                  {itemLabel}
                </label>
                <input
                  type="text"
                  value={item.item_name}
                  onChange={(e) =>
                    handleItemChange(index, 'item_name', e.target.value)
                  }
                  placeholder={getPlaceholder(itemLabel)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Quantity */}
              <div>
                <label className="sm:hidden text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                  Qty
                </label>
                <input
                  type="number"
                  min={1}
                  value={item.quantity || ''}
                  onChange={(e) =>
                    handleItemChange(
                      index,
                      'quantity',
                      parseInt(e.target.value) || 0
                    )
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors text-center"
                />
              </div>

              {/* Unit price */}
              <div>
                <label className="sm:hidden text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                  Harga Satuan
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={item.unit_price ? item.unit_price.toLocaleString('id-ID') : ''}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, '');
                    handleItemChange(
                      index,
                      'unit_price',
                      parseInt(cleaned) || 0
                    );
                  }}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors text-right"
                />
              </div>

              {/* Row total */}
              <div className="flex items-center sm:justify-end">
                <span className="sm:hidden text-xs font-medium text-gray-500 dark:text-gray-400 mr-2">
                  Total:
                </span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-100 py-2">
                  {formatCurrency(rowTotal)}
                </span>
              </div>

              {/* Delete */}
              <div className="flex items-center justify-end sm:justify-center">
                {items.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    title="Hapus item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="w-7" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add item button */}
      <button
        type="button"
        onClick={handleAddItem}
        className="mt-3 flex items-center gap-1.5 text-sm font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors px-1"
      >
        <Plus className="w-4 h-4" />
        Tambah Item
      </button>
    </div>
  );
}
