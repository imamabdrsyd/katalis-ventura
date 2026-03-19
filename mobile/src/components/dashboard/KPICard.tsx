import React from 'react';
import { View, Text } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/formatters';

interface KPICardProps {
  label: string;
  value: number;
  format?: 'currency' | 'percentage' | 'number';
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
}

export function KPICard({
  label,
  value,
  format = 'currency',
  trend = 'neutral',
  subtitle,
}: KPICardProps) {
  let displayValue = '';
  if (format === 'currency') {
    displayValue = formatCurrency(value);
  } else if (format === 'percentage') {
    displayValue = `${value.toFixed(2)}%`;
  } else {
    displayValue = value.toLocaleString('id-ID');
  }

  const trendConfig = {
    up: { color: '#059669', textClass: 'text-emerald-600', Icon: TrendingUp },
    down: { color: '#dc2626', textClass: 'text-red-600', Icon: TrendingDown },
    neutral: { color: '#9ca3af', textClass: 'text-gray-500', Icon: Minus },
  }[trend];

  const valueClass =
    trend === 'up' ? 'text-emerald-700' : trend === 'down' ? 'text-red-700' : 'text-gray-900';

  return (
    <Card className="p-4">
      <View className="flex-row items-start justify-between mb-2">
        <Text className="text-xs font-medium text-gray-500 flex-1 mr-2" numberOfLines={1}>
          {label}
        </Text>
        <trendConfig.Icon color={trendConfig.color} size={16} />
      </View>
      <Text className={`text-xl font-bold ${valueClass}`} numberOfLines={1} adjustsFontSizeToFit>
        {displayValue}
      </Text>
      {subtitle && (
        <Text className={`text-xs mt-1 ${trendConfig.textClass}`}>{subtitle}</Text>
      )}
    </Card>
  );
}
