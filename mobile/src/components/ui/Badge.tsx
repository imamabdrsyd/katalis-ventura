import React from 'react';
import { View, Text } from 'react-native';

interface BadgeProps {
  label: string;
  color?: 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'pink' | 'gray';
}

const colorMap = {
  green: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  red: { bg: 'bg-red-100', text: 'text-red-700' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-700' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-700' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-700' },
  gray: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

export function Badge({ label, color = 'gray' }: BadgeProps) {
  const { bg, text } = colorMap[color];
  return (
    <View className={`${bg} px-2 py-0.5 rounded-full`}>
      <Text className={`${text} text-xs font-semibold`}>{label}</Text>
    </View>
  );
}
