import React from 'react';
import { View, Text } from 'react-native';
import { formatCurrency } from '@/lib/formatters';

interface ReportRow {
  label: string;
  value: number;
  isBold?: boolean;
  isTotal?: boolean;
  indent?: boolean;
}

interface ReportTableProps {
  title: string;
  rows: ReportRow[];
}

export function ReportTable({ title, rows }: ReportTableProps) {
  return (
    <View className="bg-white rounded-lg border border-gray-100 overflow-hidden mb-4">
      {/* Table Header */}
      <View className="bg-gray-50 px-4 py-3 border-b border-gray-100">
        <Text className="text-sm font-bold text-gray-700 uppercase">{title}</Text>
      </View>

      {/* Rows */}
      {rows.map((row, index) => (
        <View
          key={`${row.label}-${index}`}
          className={`flex-row items-center justify-between px-4 py-3 ${
            row.isTotal ? 'bg-gray-50 border-t border-gray-200' : ''
          } ${index < rows.length - 1 && !row.isTotal ? 'border-b border-gray-50' : ''}`}
        >
          <Text
            className={`flex-1 ${row.indent ? 'pl-4' : ''} ${
              row.isBold || row.isTotal ? 'font-bold' : 'font-normal'
            } ${row.isTotal ? 'text-gray-900' : 'text-gray-700'} text-sm`}
          >
            {row.label}
          </Text>
          <Text
            className={`text-right ${
              row.isBold || row.isTotal ? 'font-bold' : 'font-normal'
            } ${
              row.value === 0
                ? 'text-gray-500'
                : row.value < 0
                  ? 'text-red-600'
                  : row.isTotal
                    ? 'text-gray-900'
                    : 'text-gray-700'
            } text-sm`}
          >
            {formatCurrency(row.value)}
          </Text>
        </View>
      ))}
    </View>
  );
}
