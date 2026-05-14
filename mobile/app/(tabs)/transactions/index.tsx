import React, { useState, useRef, useCallback } from 'react';
import { View, Text, FlatList, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { Plus, Search, SlidersHorizontal, X } from 'lucide-react-native';
import BottomSheet from '@gorhom/bottom-sheet';

import { useBusiness } from '@/context/BusinessContext';
import { useTransactions } from '@/hooks/useTransactions';
import { TransactionCard } from '@/components/transactions/TransactionCard';
import { FilterSheet } from '@/components/transactions/FilterSheet';
import { SyncStatusBanner } from '@/components/ui/SyncStatusBanner';
import type { Transaction, TransactionCategory } from '@shared/types';

export default function TransactionsScreen() {
  const { activeBusinessId, userRole } = useBusiness();
  const { transactions, isLoading, error } = useTransactions(activeBusinessId || '');
  const router = useRouter();
  const canManageTransactions = userRole === 'business_manager' || userRole === 'superadmin';

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TransactionCategory | ''>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'posted'>('all');

  // Bottom sheet ref
  const filterSheetRef = useRef<BottomSheet>(null);

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = tx.name?.toLowerCase().includes(query);
      const matchesDesc = tx.description?.toLowerCase().includes(query);
      if (!matchesName && !matchesDesc) return false;
    }

    // Category filter
    if (categoryFilter && tx.category !== categoryFilter) return false;

    // Status filter
    if (statusFilter !== 'all' && tx.status !== statusFilter) return false;

    return true;
  });

  const handleOpenFilter = useCallback(() => {
    filterSheetRef.current?.snapToIndex(0);
  }, []);

  const handleCloseFilter = useCallback(() => {
    filterSheetRef.current?.close();
  }, []);

  const handleResetFilter = useCallback(() => {
    setCategoryFilter('');
    setStatusFilter('all');
  }, []);

  const hasActiveFilters = categoryFilter !== '' || statusFilter !== 'all';

  const renderTransaction = useCallback(
    ({ item }: { item: Transaction }) => (
      <TransactionCard
        transaction={item}
        onPress={() => router.push(`/(tabs)/transactions/${item.id}`)}
      />
    ),
    [router]
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <SyncStatusBanner />

      {/* Header */}
      <View className="bg-white px-6 pt-4 pb-3 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900 mb-4">Transaksi</Text>

        {/* Search Bar */}
        <View className="flex-row items-center gap-2">
          <View className="flex-1 flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
            <Search color="#9ca3af" size={18} />
            <TextInput
              className="flex-1 ml-2 text-base text-gray-900"
              placeholder="Cari transaksi..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery !== '' && (
              <Pressable onPress={() => setSearchQuery('')}>
                <X color="#9ca3af" size={18} />
              </Pressable>
            )}
          </View>

          {/* Filter Button */}
          <Pressable
            onPress={handleOpenFilter}
            className={`p-3 rounded-lg border ${
              hasActiveFilters
                ? 'bg-blue-50 border-blue-300'
                : 'bg-white border-gray-300'
            }`}
          >
            <SlidersHorizontal
              color={hasActiveFilters ? '#0284c7' : '#6b7280'}
              size={20}
            />
          </Pressable>
        </View>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <View className="flex-row items-center gap-2 mt-3">
            {categoryFilter && (
              <Pressable
                onPress={() => setCategoryFilter('')}
                className="flex-row items-center bg-blue-100 px-3 py-1 rounded-full"
              >
                <Text className="text-blue-700 text-xs font-medium mr-1">
                  {categoryFilter}
                </Text>
                <X color="#1d4ed8" size={12} />
              </Pressable>
            )}
            {statusFilter !== 'all' && (
              <Pressable
                onPress={() => setStatusFilter('all')}
                className="flex-row items-center bg-blue-100 px-3 py-1 rounded-full"
              >
                <Text className="text-blue-700 text-xs font-medium mr-1">
                  {statusFilter}
                </Text>
                <X color="#1d4ed8" size={12} />
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Transaction Count */}
      <View className="px-6 py-3">
        <Text className="text-sm text-gray-500">
          {filteredTransactions.length} transaksi
          {searchQuery && ` untuk "${searchQuery}"`}
        </Text>
      </View>

      {/* Transaction List */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-gray-500">Memuat transaksi...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center px-6">
          <Text className="text-red-600 text-center">{error.message}</Text>
        </View>
      ) : filteredTransactions.length === 0 ? (
        <View className="flex-1 justify-center items-center px-6">
          <Text className="text-gray-400 text-lg mb-2">
            {searchQuery || hasActiveFilters
              ? 'Tidak ada transaksi yang cocok'
              : 'Belum ada transaksi'}
          </Text>
          {!searchQuery && !hasActiveFilters && (
            <Text className="text-gray-400 text-sm text-center">
              Tekan tombol + untuk menambah transaksi pertama
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => item.id}
          renderItem={renderTransaction}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB - Add Transaction */}
      {canManageTransactions && (
        <Link href="/(tabs)/transactions/add" asChild>
          <Pressable className="absolute bottom-6 right-6 w-14 h-14 bg-blue-500 rounded-full shadow-lg items-center justify-center">
            <Plus color="white" size={24} />
          </Pressable>
        </Link>
      )}

      {/* Filter Bottom Sheet */}
      <FilterSheet
        ref={filterSheetRef}
        categoryFilter={categoryFilter}
        statusFilter={statusFilter}
        onCategoryChange={setCategoryFilter}
        onStatusChange={setStatusFilter}
        onReset={handleResetFilter}
        onClose={handleCloseFilter}
      />
    </SafeAreaView>
  );
}
