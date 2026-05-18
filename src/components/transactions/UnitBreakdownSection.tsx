'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { UnitBreakdown } from '@/types';

const UNIT_OPTIONS = ['pcs', 'gram', 'galon', 'ikat', 'orang', 'trip'] as const;

function formatNumberWithSeparator(num: number | string): string {
  if (!num && num !== 0) return '';
  const numStr = num.toString().replace(/\D/g, '');
  if (!numStr) return '';
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

interface UnitBreakdownSectionProps {
  unitBreakdown: UnitBreakdown | null;
  showBreakdown: boolean;
  onToggle: () => void;
  onPriceChange: (value: number) => void;
  onQuantityChange: (value: number) => void;
  onUnitChange: (value: string) => void;
  onRemove: () => void;
}

export function UnitBreakdownSection({
  unitBreakdown,
  showBreakdown,
  onToggle,
  onPriceChange,
  onQuantityChange,
  onUnitChange,
  onRemove,
}: UnitBreakdownSectionProps) {
  const [priceDisplay, setPriceDisplay] = useState(
    unitBreakdown?.price_per_unit ? formatNumberWithSeparator(unitBreakdown.price_per_unit) : ''
  );
  const [qtyDisplay, setQtyDisplay] = useState(
    unitBreakdown?.quantity ? formatNumberWithSeparator(unitBreakdown.quantity) : ''
  );
  const [showCustomUnit, setShowCustomUnit] = useState(
    unitBreakdown?.unit ? !UNIT_OPTIONS.includes(unitBreakdown.unit as typeof UNIT_OPTIONS[number]) : false
  );
  const [customUnitValue, setCustomUnitValue] = useState(
    unitBreakdown?.unit && !UNIT_OPTIONS.includes(unitBreakdown.unit as typeof UNIT_OPTIONS[number])
      ? unitBreakdown.unit
      : ''
  );

  // Sync displays when unitBreakdown changes externally (e.g. loading from saved data)
  useEffect(() => {
    if (unitBreakdown) {
      setPriceDisplay(unitBreakdown.price_per_unit ? formatNumberWithSeparator(unitBreakdown.price_per_unit) : '');
      setQtyDisplay(unitBreakdown.quantity ? formatNumberWithSeparator(unitBreakdown.quantity) : '');
    }
  }, [unitBreakdown?.price_per_unit, unitBreakdown?.quantity]);

  if (!showBreakdown) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
      >
        <span>Unit Breakdown</span>
        <ChevronDown className="w-3 h-3" />
      </button>
    );
  }

  const handlePriceInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\./g, '');
    const num = parseInt(raw) || 0;
    setPriceDisplay(num ? formatNumberWithSeparator(num) : '');
    onPriceChange(num);
  };

  const handleQtyInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\./g, '');
    const num = parseInt(raw) || 0;
    setQtyDisplay(num ? formatNumberWithSeparator(num) : '');
    onQuantityChange(num);
  };

  const handleUnitSelect = (value: string) => {
    if (value === '__custom__') {
      setShowCustomUnit(true);
      setCustomUnitValue('');
      onUnitChange('');
    } else {
      setShowCustomUnit(false);
      setCustomUnitValue('');
      onUnitChange(value);
    }
  };

  const handleCustomUnit = (value: string) => {
    setCustomUnitValue(value);
    onUnitChange(value);
  };

  const total = (unitBreakdown?.price_per_unit || 0) * (unitBreakdown?.quantity || 0);

  return (
    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500 dark:text-indigo-400"
          title="Close breakdown"
        >
          <span>Unit Breakdown</span>
          <ChevronUp className="w-3 h-3" />
        </button>
      </div>

      {/* Input fields */}
      <div className="grid grid-cols-3 gap-2">
        {/* Price per unit */}
        <div>
          <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Price/Unit
          </label>
          <input
            type="text"
            value={priceDisplay}
            onChange={handlePriceInput}
            placeholder="0"
            inputMode="numeric"
            className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-indigo-300 dark:border-indigo-500 rounded-md bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Quantity */}
        <div>
          <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Quantity
          </label>
          <input
            type="text"
            value={qtyDisplay}
            onChange={handleQtyInput}
            placeholder="0"
            inputMode="numeric"
            className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-indigo-300 dark:border-indigo-500 rounded-md bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Unit selector */}
        <div>
          <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Unit
          </label>
          {showCustomUnit ? (
            <input
              type="text"
              value={customUnitValue}
              onChange={(e) => handleCustomUnit(e.target.value)}
              placeholder="Custom unit..."
              className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-indigo-300 dark:border-indigo-500 rounded-md bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
          ) : (
            <div className="relative mt-0.5">
              <select
                value={unitBreakdown?.unit && UNIT_OPTIONS.includes(unitBreakdown.unit as typeof UNIT_OPTIONS[number]) ? unitBreakdown.unit : '__custom__'}
                onChange={(e) => handleUnitSelect(e.target.value)}
                className="w-full appearance-none pl-2.5 pr-8 py-1.5 text-sm border border-indigo-300 dark:border-indigo-500 rounded-md bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
                <option value="__custom__">Other...</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
            </div>
          )}
        </div>
      </div>

      {/* Total display */}
      {total > 0 && (
        <div className="text-xs text-right text-indigo-500 dark:text-indigo-400 font-medium">
          Total: {formatNumberWithSeparator(total)}
        </div>
      )}
    </div>
  );
}
