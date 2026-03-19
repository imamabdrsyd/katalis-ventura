import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';

interface CurrencyInputProps {
  label?: string;
  value: number;
  onChangeValue: (value: number) => void;
  error?: string;
  editable?: boolean;
}

function formatDisplay(value: number): string {
  if (value === 0) return '';
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseDisplay(text: string): number {
  const cleaned = text.replace(/\./g, '').replace(/[^0-9]/g, '');
  return parseInt(cleaned, 10) || 0;
}

export function CurrencyInput({
  label,
  value,
  onChangeValue,
  error,
  editable = true,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState(formatDisplay(value));

  const handleChangeText = (text: string) => {
    const numericValue = parseDisplay(text);
    setDisplayValue(formatDisplay(numericValue));
    onChangeValue(numericValue);
  };

  return (
    <View className="mb-4">
      {label && <Text className="text-sm font-semibold text-gray-900 mb-2">{label}</Text>}
      <View
        className={`flex-row items-center border rounded-lg px-3 py-2 ${
          error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
        }`}
      >
        <Text className="text-base text-gray-500 mr-2">Rp</Text>
        <TextInput
          className="flex-1 text-base text-gray-900"
          placeholder="0"
          value={displayValue}
          onChangeText={handleChangeText}
          keyboardType="numeric"
          editable={editable}
          placeholderTextColor="#9ca3af"
        />
      </View>
      {error && <Text className="text-xs text-red-600 mt-1">{error}</Text>}
    </View>
  );
}
