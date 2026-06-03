'use client';

import { ReactNode, useId } from 'react';
import { motion } from 'framer-motion';

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
  const layoutId = useId();

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

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={isDisabled}
            onClick={() => !isActive && onChange(option.value)}
            className={[
              fullWidth ? 'flex-1' : '',
              'relative flex items-center justify-center gap-1.5 px-4 py-1.5 text-sm rounded-full disabled:cursor-default',
              isActive
                ? 'text-primary-500 dark:text-primary-400 font-bold'
                : 'text-gray-500 dark:text-gray-400 font-normal hover:text-gray-700 dark:hover:text-gray-200',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {isActive && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-white dark:bg-gray-600 shadow-sm"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {option.icon}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
