import React from 'react';
import { TextInput, View, Text } from 'react-native';

interface InputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'decimal-pad' | 'phone-pad';
  secureTextEntry?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  editable?: boolean;
  error?: string;
}

export function Input({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = 'default',
  secureTextEntry = false,
  multiline = false,
  numberOfLines = 1,
  editable = true,
  error,
}: InputProps) {
  return (
    <View className="mb-4">
      {label && <Text className="text-sm font-semibold text-gray-900 mb-2">{label}</Text>}
      <TextInput
        className={`px-3 py-2 border rounded-lg text-base ${
          error
            ? 'border-red-300 bg-red-50'
            : 'border-gray-300 bg-white'
        } ${!editable ? 'bg-gray-100 text-gray-500' : ''}`}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        numberOfLines={numberOfLines}
        editable={editable}
        placeholderTextColor="#9ca3af"
      />
      {error && <Text className="text-xs text-red-600 mt-1">{error}</Text>}
    </View>
  );
}
