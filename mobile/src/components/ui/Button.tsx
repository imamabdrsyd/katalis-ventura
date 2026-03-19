import React from 'react';
import { Pressable, Text, ActivityIndicator } from 'react-native';
import { clsx } from 'clsx';

interface ButtonProps {
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'md',
  children,
}: ButtonProps) {
  const variantClasses = {
    primary: 'bg-blue-500 active:bg-blue-600',
    secondary: 'bg-gray-200 active:bg-gray-300',
    danger: 'bg-red-500 active:bg-red-600',
    ghost: 'bg-transparent active:bg-gray-100',
  };

  const sizeClasses = {
    sm: 'px-3 py-2',
    md: 'px-4 py-3',
    lg: 'px-6 py-4',
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const textColorClasses = {
    primary: 'text-white',
    secondary: 'text-gray-900',
    danger: 'text-white',
    ghost: 'text-blue-500',
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={clsx(
        'rounded-lg flex-row items-center justify-center',
        variantClasses[variant],
        sizeClasses[size],
        (disabled || loading) && 'opacity-50'
      )}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? 'white' : 'black'}
          size="small"
        />
      ) : (
        <Text
          className={clsx(
            'font-semibold',
            textSizeClasses[size],
            textColorClasses[variant]
          )}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}
