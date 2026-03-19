import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { useBusiness } from '@/context/BusinessContext';
import { useReports } from '@/hooks/useReports';
import { ReportTable } from '@/components/reports/ReportTable';
import { SummaryCard } from '@/components/reports/SummaryCard';
import { formatDateInput } from '@/lib/formatters';

export default function IncomeStatementScreen() {
  const { activeBusiness, activeBusinessId } = useBusiness();
  const router = useRouter();

  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month] = useState(now.getMonth());

  const startDate = formatDateInput(new Date(year, month, 1));
  const endDate = formatDateInput(new Date(year, month + 1, 0));

  const { incomeStatement, isLoading } = useReports(activeBusinessId || '', startDate, endDate);
  const metrics = incomeStatement.metrics;

  const rows = useMemo(() => {
    if (!metrics) return [];
    return [
      { label: 'Pendapatan (Revenue)', value: metrics.revenue, isBold: true },
      { label: 'Harga Pokok Penjualan (HPP)', value: -(metrics.costOfGoodsSold || 0), indent: true },
      { label: 'Laba Kotor', value: metrics.grossProfit, isTotal: true, isBold: true },
      { label: 'Beban Operasional', value: -(metrics.operatingExpenses || 0), indent: true },
      { label: 'Laba Operasional', value: metrics.operatingIncome, isTotal: true, isBold: true },
      { label: 'Beban Bunga', value: -(metrics.interestExpense || 0), indent: true },
      { label: 'Laba Sebelum Pajak (EBT)', value: metrics.earningsBeforeTax, isBold: true },
      { label: 'Pajak', value: -(metrics.taxExpense || 0), indent: true },
      { label: 'Laba Bersih', value: metrics.netIncome, isTotal: true, isBold: true },
    ];
  }, [metrics]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white flex-row items-center px-4 py-4 border-b border-gray-100">
        <Pressable onPress={() => router.back()} className="p-2 mr-2">
          <ChevronLeft color="#374151" size={24} />
        </Pressable>
        <View>
          <Text className="text-lg font-bold text-gray-900">Laporan Laba Rugi</Text>
          <Text className="text-xs text-gray-500">
            {activeBusiness?.business_name} | {startDate} - {endDate}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-gray-500">Memuat laporan...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Summary Cards */}
          {metrics && (
            <View className="px-6 py-4">
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <SummaryCard
                    label="Revenue"
                    value={metrics.revenue}
                    color="green"
                  />
                </View>
                <View className="flex-1">
                  <SummaryCard
                    label="Net Profit"
                    value={metrics.netIncome}
                    percentage={metrics.netProfitMargin}
                    color={metrics.netIncome >= 0 ? 'green' : 'red'}
                  />
                </View>
              </View>

              <View className="flex-row gap-3 mb-6">
                <View className="flex-1">
                  <SummaryCard
                    label="Gross Margin"
                    value={metrics.grossProfit}
                    percentage={metrics.grossProfitMargin}
                    color="blue"
                  />
                </View>
                <View className="flex-1">
                  <SummaryCard
                    label="Operating Income"
                    value={metrics.operatingIncome}
                    percentage={metrics.operatingMargin}
                    color="blue"
                  />
                </View>
              </View>
            </View>
          )}

          {/* Income Statement Table */}
          <View className="px-6">
            <ReportTable title="Laporan Laba Rugi" rows={rows} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
