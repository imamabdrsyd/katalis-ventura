import React, { forwardRef, useCallback, useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Button } from '@/components/ui/Button';
import type { TransactionCategory } from '@shared/types';

interface FilterSheetProps {
  categoryFilter: TransactionCategory | '';
  statusFilter: 'all' | 'draft' | 'posted';
  onCategoryChange: (category: TransactionCategory | '') => void;
  onStatusChange: (status: 'all' | 'draft' | 'posted') => void;
  onReset: () => void;
  onClose: () => void;
}

const CATEGORIES: { value: TransactionCategory | ''; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'EARN', label: 'Revenue' },
  { value: 'OPEX', label: 'OPEX' },
  { value: 'VAR', label: 'HPP' },
  { value: 'CAPEX', label: 'CAPEX' },
  { value: 'TAX', label: 'Pajak' },
  { value: 'FIN', label: 'Financing' },
];

const STATUSES: { value: 'all' | 'draft' | 'posted'; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'draft', label: 'Draft' },
  { value: 'posted', label: 'Posted' },
];

export const FilterSheet = forwardRef<BottomSheet, FilterSheetProps>(
  ({ categoryFilter, statusFilter, onCategoryChange, onStatusChange, onReset, onClose }, ref) => {
    const snapPoints = useMemo(() => ['50%'], []);

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={onClose}
        backgroundStyle={{ backgroundColor: 'white' }}
        handleIndicatorStyle={{ backgroundColor: '#d1d5db' }}
      >
        <BottomSheetView className="flex-1 px-6 pt-2 pb-6">
          <Text className="text-lg font-bold text-gray-900 mb-6">Filter Transaksi</Text>

          {/* Category Filter */}
          <Text className="text-sm font-semibold text-gray-700 mb-3">Kategori</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
            <View className="flex-row gap-2">
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.value}
                  onPress={() => onCategoryChange(cat.value)}
                  className={`px-4 py-2 rounded-full border ${
                    categoryFilter === cat.value
                      ? 'bg-blue-500 border-blue-500'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      categoryFilter === cat.value ? 'text-white' : 'text-gray-700'
                    }`}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Status Filter */}
          <Text className="text-sm font-semibold text-gray-700 mb-3">Status</Text>
          <View className="flex-row gap-2 mb-8">
            {STATUSES.map((st) => (
              <Pressable
                key={st.value}
                onPress={() => onStatusChange(st.value)}
                className={`px-4 py-2 rounded-full border flex-1 items-center ${
                  statusFilter === st.value
                    ? 'bg-blue-500 border-blue-500'
                    : 'bg-white border-gray-300'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    statusFilter === st.value ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  {st.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Actions */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button variant="secondary" onPress={onReset}>
                Reset
              </Button>
            </View>
            <View className="flex-1">
              <Button onPress={onClose}>
                Terapkan
              </Button>
            </View>
          </View>
        </BottomSheetView>
      </BottomSheet>
    );
  }
);
