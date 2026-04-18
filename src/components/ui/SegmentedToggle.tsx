'use client';

import { ReactNode } from 'react';

export interface SegmentedToggleOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

interface SegmentedToggleProps<T extends string> {
  options: SegmentedToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  fullWidth?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  fullWidth = false,
  disabled = false,
  ariaLabel,
  className = '',
}: SegmentedToggleProps<T>) {
  const containerClass = [
    fullWidth ? 'flex' : 'inline-flex',
    'p-1 bg-gray-100 dark:bg-gray-700 rounded-full',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClass} role="tablist" aria-label={ariaLabel}>
      {options.map((option) => {
        const isActive = option.value === value;
        const isDisabled = disabled || option.disabled;
        const buttonClass = [
          fullWidth ? 'flex-1' : '',
          'flex items-center justify-center gap-1.5 px-4 py-1.5 text-sm rounded-full transition-all disabled:cursor-default',
          isActive
            ? 'bg-white dark:bg-gray-600 text-indigo-500 dark:text-indigo-400 font-semibold shadow-sm'
            : 'bg-transparent text-gray-500 dark:text-gray-400 font-normal hover:text-gray-700 dark:hover:text-gray-200',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={isDisabled}
            onClick={() => !isActive && onChange(option.value)}
            className={buttonClass}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
