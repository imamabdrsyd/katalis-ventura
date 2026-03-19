import React from 'react';
import { View } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <View
      className={`bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden ${className}`}
    >
      {children}
    </View>
  );
}
