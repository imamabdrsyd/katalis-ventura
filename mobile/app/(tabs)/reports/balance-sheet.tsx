import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, CheckCircle2, AlertTriangle } from 'lucide-react-native';

import { useBusiness } from '@/context/BusinessContext';
import { useReports } from '@/hooks/useReports';
import { ReportTable } from '@/components/reports/ReportTable';
import { SummaryCard } from '@/components/reports/SummaryCard';
import { formatDateInput } from '@/lib/formatters';

export default function BalanceSheetScreen() {
  const { activeBusiness, activeBusinessId } = useBusiness();
  const router = useRouter();

  const endDate = formatDateInput(new Date());
  const startDate = '2000-01-01'; // All time for balance sheet

  const { balanceSheet, isLoading } = useReports(activeBusinessId || '', startDate, endDate);

  const assetRows = useMemo(() => {
    if (!balanceSheet) return [];
    return [
      { label: 'Kas & Bank', value: balanceSheet.cashAndBank || 0, indent: true },
      { label: 'Piutang', value: balanceSheet.receivables || 0, indent: true },
      { label: 'Persediaan', value: balanceSheet.inventory || 0, indent: true },
      { label: 'Aset Tetap', value: balanceSheet.fixedAssets || 0, indent: true },
      { label: 'Aset Lainnya', value: balanceSheet.otherAssets || 0, indent: true },
      { label: 'Total Aset', value: balanceSheet.totalAssets, isTotal: true, isBold: true },
    ];
  }, [balanceSheet]);

  const liabilityEquityRows = useMemo(() => {
    if (!balanceSheet) return [];
    return [
      { label: 'Hutang Usaha', value: balanceSheet.accountsPayable || 0, indent: true },
      { label: 'Hutang Lainnya', value: balanceSheet.otherLiabilities || 0, indent: true },
      { label: 'Total Liabilitas', value: balanceSheet.totalLiabilities, isBold: true },
      { label: 'Modal Disetor', value: balanceSheet.paidInCapital || 0, indent: true },
      { label: 'Laba Ditahan', value: balanceSheet.retainedEarnings || 0, indent: true },
      { label: 'Total Ekuitas', value: balanceSheet.totalEquity, isBold: true },
      {
        label: 'Liabilitas + Ekuitas',
        value: balanceSheet.totalLiabilities + balanceSheet.totalEquity,
        isTotal: true,
        isBold: true,
      },
    ];
  }, [balanceSheet]);

  const isBalanced = balanceSheet
    ? Math.abs(balanceSheet.totalAssets - (balanceSheet.totalLiabilities + balanceSheet.totalEquity)) < 0.01
    : false;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white flex-row items-center px-4 py-4 border-b border-gray-100">
        <Pressable onPress={() => router.back()} className="p-2 mr-2">
          <ChevronLeft color="#374151" size={24} />
        </Pressable>
        <View>
          <Text className="text-lg font-bold text-gray-900">Neraca</Text>
          <Text className="text-xs text-gray-500">
            {activeBusiness?.business_name} | per {endDate}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-gray-500">Memuat neraca...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Balance Status */}
          {balanceSheet && (
            <View className="px-6 py-4">
              <View
                className={`flex-row items-center gap-2 px-4 py-3 rounded-lg ${
                  isBalanced ? 'bg-emerald-50' : 'bg-amber-50'
                }`}
              >
                {isBalanced ? (
                  <CheckCircle2 color="#059669" size={20} />
                ) : (
                  <AlertTriangle color="#d97706" size={20} />
                )}
                <Text
                  className={`text-sm font-medium ${
                    isBalanced ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {isBalanced
                    ? 'Neraca seimbang (Aset = Liabilitas + Ekuitas)'
                    : 'Neraca tidak seimbang'}
                </Text>
              </View>
            </View>
          )}

          {/* Summary Cards */}
          {balanceSheet && (
            <View className="px-6 pb-4">
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <SummaryCard label="Total Aset" value={balanceSheet.totalAssets} color="blue" />
                </View>
                <View className="flex-1">
                  <SummaryCard label="Total Ekuitas" value={balanceSheet.totalEquity} color="green" />
                </View>
              </View>
            </View>
          )}

          {/* Tables */}
          <View className="px-6">
            <ReportTable title="Aset" rows={assetRows} />
            <ReportTable title="Liabilitas & Ekuitas" rows={liabilityEquityRows} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
