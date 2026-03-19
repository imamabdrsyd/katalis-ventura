import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { Plus, ChevronRight } from 'lucide-react-native';

import { useBusiness } from '@/context/BusinessContext';
import { useDashboard } from '@/hooks/useDashboard';
import { Card } from '@/components/ui/Card';
import { KPICard } from '@/components/dashboard/KPICard';
import { SyncStatusBanner } from '@/components/ui/SyncStatusBanner';
import { CategoryBadge } from '@/components/transactions/CategoryBadge';
import { formatCurrency, formatDate } from '@/lib/formatters';

export default function DashboardScreen() {
  const { activeBusiness, activeBusinessId } = useBusiness();
  const router = useRouter();
  const [selectedYear] = useState(new Date().getFullYear());
  const [selectedMonth] = useState<number | undefined>(undefined);

  const { summary, roi, transactions, isLoading, error } = useDashboard(
    activeBusinessId || '',
    selectedYear,
    selectedMonth
  );

  if (!activeBusiness) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center px-6">
        <Text className="text-gray-400 text-base text-center">Pilih bisnis untuk memulai</Text>
      </SafeAreaView>
    );
  }

  const netProfit = summary?.netProfit || 0;
  const totalExpenses = (summary?.totalOpex || 0) + (summary?.totalVar || 0) + (summary?.totalTax || 0);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <SyncStatusBanner />

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="bg-white px-6 pt-5 pb-6 border-b border-gray-100">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Bisnis Aktif
          </Text>
          <Text className="text-2xl font-bold text-gray-900">
            {activeBusiness.business_name}
          </Text>
          <Text className="text-sm text-gray-500 mt-1">{selectedYear}</Text>
        </View>

        {/* Error State */}
        {error && (
          <View className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
            <Text className="text-red-700 text-sm">{error.message}</Text>
          </View>
        )}

        {/* KPI Cards */}
        <View className="px-4 pt-5 pb-2">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Ringkasan {selectedYear}
          </Text>
          {isLoading ? (
            <View className="h-40 items-center justify-center">
              <ActivityIndicator color="#3b82f6" />
            </View>
          ) : (
            <View className="gap-3">
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <KPICard
                    label="Pendapatan"
                    value={summary?.totalEarn || 0}
                    format="currency"
                    trend="up"
                  />
                </View>
                <View className="flex-1">
                  <KPICard
                    label="Net Profit"
                    value={netProfit}
                    format="currency"
                    trend={netProfit > 0 ? 'up' : netProfit < 0 ? 'down' : 'neutral'}
                  />
                </View>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <KPICard
                    label="Total Beban"
                    value={totalExpenses}
                    format="currency"
                    trend="down"
                  />
                </View>
                <View className="flex-1">
                  <KPICard
                    label="ROI"
                    value={roi}
                    format="percentage"
                    trend={roi > 0 ? 'up' : roi < 0 ? 'down' : 'neutral'}
                  />
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Recent Transactions */}
        <View className="px-4 pt-5">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Transaksi Terbaru
            </Text>
            <Link href="/(tabs)/transactions" asChild>
              <Pressable className="flex-row items-center gap-1">
                <Text className="text-blue-600 text-sm font-semibold">Lihat Semua</Text>
                <ChevronRight color="#2563eb" size={14} />
              </Pressable>
            </Link>
          </View>

          {isLoading ? (
            <Card className="p-6 items-center">
              <ActivityIndicator color="#9ca3af" />
            </Card>
          ) : transactions && transactions.length > 0 ? (
            <FlatList
              data={transactions.slice(0, 5)}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => {
                const isInflow = item.category === 'EARN';
                return (
                  <Pressable onPress={() => router.push(`/(tabs)/transactions/${item.id}`)}>
                    <Card className="p-4 mb-2">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1 mr-3">
                          <View className="flex-row items-center gap-2 mb-1">
                            <CategoryBadge category={item.category} />
                          </View>
                          <Text className="font-semibold text-gray-900 text-sm" numberOfLines={1}>
                            {item.name || item.description || '-'}
                          </Text>
                          <Text className="text-xs text-gray-400 mt-0.5">
                            {formatDate(new Date(item.date))}
                          </Text>
                        </View>
                        <Text
                          className={`font-bold text-base ${isInflow ? 'text-emerald-600' : 'text-red-600'}`}
                        >
                          {isInflow ? '+' : '-'}{formatCurrency(item.amount)}
                        </Text>
                      </View>
                    </Card>
                  </Pressable>
                );
              }}
            />
          ) : (
            <Card className="p-8 items-center">
              <Text className="text-gray-400 text-sm text-center">
                Belum ada transaksi
              </Text>
              <Text className="text-gray-400 text-xs text-center mt-1">
                Tekan + untuk menambah transaksi pertama
              </Text>
            </Card>
          )}
        </View>
      </ScrollView>

      {/* FAB - Add Transaction */}
      <Link href="/(tabs)/transactions/add" asChild>
        <Pressable className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full shadow-lg items-center justify-center">
          <Plus color="white" size={24} />
        </Pressable>
      </Link>
    </SafeAreaView>
  );
}
