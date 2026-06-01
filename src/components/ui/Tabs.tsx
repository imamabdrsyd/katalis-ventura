'use client';

import React from 'react';
import { motion } from 'framer-motion';

export interface TabItem<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  hidden?: boolean;
}

interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: 'pill' | 'underline';
  scrollable?: boolean;
  className?: string;
}

export function Tabs<T extends string = string>({
  tabs,
  value,
  onChange,
  variant = 'pill',
  scrollable = false,
  className,
}: TabsProps<T>) {
  const visibleTabs = tabs.filter((t) => !t.hidden);
  const layoutId = React.useId();

  const wrapperCls = scrollable
    ? 'overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide'
    : '';

  if (variant === 'underline') {
    return (
      <div className={`${wrapperCls} ${className ?? ''}`}>
        <div className="flex gap-2">
          {visibleTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => onChange(tab.value)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                value === tab.value
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge}
              {value === tab.value && (
                <motion.span
                  layoutId={`${layoutId}-underline`}
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 dark:bg-indigo-400 rounded-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`${wrapperCls} ${className ?? ''}`}>
      <div className="flex gap-1 bg-[#EEF0F2] dark:bg-gray-800 rounded-xl p-1 w-fit">
        {visibleTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={`relative flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              value === tab.value
                ? 'text-gray-800 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {value === tab.value && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 bg-white dark:bg-gray-700 rounded-lg shadow-sm"
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              />
            )}
            {tab.icon && <span className="relative flex-shrink-0 w-4 h-4 flex items-center">{tab.icon}</span>}
            <span className="relative">{tab.label}</span>
            {tab.badge && <span className="relative">{tab.badge}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
