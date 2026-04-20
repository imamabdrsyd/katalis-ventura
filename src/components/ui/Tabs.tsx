'use client';

import React from 'react';

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
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                value === tab.value
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`${wrapperCls} ${className ?? ''}`}>
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {visibleTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              value === tab.value
                ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.icon && <span className="flex-shrink-0 w-4 h-4 flex items-center">{tab.icon}</span>}
            {tab.label}
            {tab.badge}
          </button>
        ))}
      </div>
    </div>
  );
}
