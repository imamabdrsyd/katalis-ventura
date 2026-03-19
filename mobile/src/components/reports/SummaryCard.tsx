import React from 'react';
import { View, Text } from 'react-native';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/formatters';

interface SummaryCardProps {
  label: string;
  value: number;
  percentage?: number;
  color?: 'green' | 'red' | 'blue' | 'gray';
}

const colorMap = {
  green: 'text-emerald-600',
  red: 'text-red-600',
  blue: 'text-blue-600',
  gray: 'text-gray-900',
};

export function SummaryCard({ label, value, percentage, color = 'gray' }: SummaryCardProps) {
  return (
    <Card className="p-4">
      <Text className="text-xs font-semibold text-gray-500 uppercase mb-1">{label}</Text>
      <Text className={`text-xl font-bold ${colorMap[color]}`}>{formatCurrency(value)}</Text>
      {percentage !== undefined && (
        <Text className="text-xs text-gray-500 mt-1">{percentage.toFixed(1)}%</Text>
      )}
    </Card>
  );
}
