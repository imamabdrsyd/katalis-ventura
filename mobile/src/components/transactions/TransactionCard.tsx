import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CategoryBadge } from './CategoryBadge';
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { Transaction } from '@shared/types';

interface TransactionCardProps {
  transaction: Transaction;
  onPress?: () => void;
}

export function TransactionCard({ transaction, onPress }: TransactionCardProps) {
  const isInflow = transaction.category === 'EARN';
  const isDraft = transaction.status === 'draft';

  // Determine display name
  const displayName = transaction.name || transaction.description || '-';

  // Determine amount color
  const amountColor = isInflow ? 'text-emerald-600' : 'text-red-600';

  return (
    <Pressable onPress={onPress}>
      <Card className="p-4 mb-2">
        <View className="flex-row items-start justify-between">
          {/* Left side: Info */}
          <View className="flex-1 mr-3">
            {/* Category + Status badges */}
            <View className="flex-row items-center gap-2 mb-2">
              <CategoryBadge category={transaction.category} />
              {isDraft && <Badge label="DRAFT" color="gray" />}
            </View>

            {/* Name */}
            <Text className="font-semibold text-gray-900 text-base" numberOfLines={1}>
              {displayName}
            </Text>

            {/* Description */}
            {transaction.description && transaction.description !== displayName && (
              <Text className="text-sm text-gray-500 mt-0.5" numberOfLines={1}>
                {transaction.description}
              </Text>
            )}

            {/* Date + Cash flow indicator */}
            <View className="flex-row items-center mt-2 gap-2">
              <Text className="text-xs text-gray-400">
                {formatDate(new Date(transaction.date))}
              </Text>
              {transaction.is_double_entry && (
                <View className="flex-row items-center gap-1">
                  {isInflow ? (
                    <ArrowDownLeft color="#10b981" size={12} />
                  ) : (
                    <ArrowUpRight color="#ef4444" size={12} />
                  )}
                  <Text className="text-xs text-gray-400" numberOfLines={1}>
                    {isInflow
                      ? transaction.debit_account?.account_name
                      : transaction.credit_account?.account_name}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Right side: Amount */}
          <View className="items-end">
            <Text className={`text-lg font-bold ${amountColor}`}>
              {isInflow ? '+' : '-'}{formatCurrency(transaction.amount)}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
