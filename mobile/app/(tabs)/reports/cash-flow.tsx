import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { useBusiness } from '@/context/BusinessContext';
import { useReports } from '@/hooks/useReports';
import { ReportTable } from '@/components/reports/ReportTable';
import { SummaryCard } from '@/components/reports/SummaryCard';
import { formatDateInput } from '@/lib/formatters';

export default function CashFlowScreen() {
  const { activeBusiness, activeBusinessId } = useBusiness();
  const router = useRouter();

  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month] = useState(now.getMonth());

  const startDate = formatDateInput(new Date(year, month, 1));
  const endDate = formatDateInput(new Date(year, month + 1, 0));

  const { cashFlow, isLoading } = useReports(activeBusinessId || '', startDate, endDate);

  const operatingRows = useMemo(() => {
    if (!cashFlow) return [];
    return [
      ...(cashFlow.operatingActivities || []).map((tx: any) => ({
        label: tx.description || tx.name || '-',
        value: tx.amount,
        indent: true,
      })),
      {
        label: 'Total Arus Kas Operasional',
        value: cashFlow.totalOperating || 0,
        isTotal: true,
        isBold: true,
      },
    ];
  }, [cashFlow]);

  const investingRows = useMemo(() => {
    if (!cashFlow) return [];
    return [
      ...(cashFlow.investingActivities || []).map((tx: any) => ({
        label: tx.description || tx.name || '-',
        value: tx.amount,
        indent: true,
      })),
      {
        label: 'Total Arus Kas Investasi',
        value: cashFlow.totalInvesting || 0,
        isTotal: true,
        isBold: true,
      },
    ];
  }, [cashFlow]);

  const financingRows = useMemo(() => {
    if (!cashFlow) return [];
    return [
      ...(cashFlow.financingActivities || []).map((tx: any) => ({
        label: tx.description || tx.name || '-',
        value: tx.amount,
        indent: true,
      })),
      {
        label: 'Total Arus Kas Pembiayaan',
        value: cashFlow.totalFinancing || 0,
        isTotal: true,
        isBold: true,
      },
    ];
  }, [cashFlow]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white flex-row items-center px-4 py-4 border-b border-gray-100">
        <Pressable onPress={() => router.back()} className="p-2 mr-2">
          <ChevronLeft color="#374151" size={24} />
        </Pressable>
        <View>
          <Text className="text-lg font-bold text-gray-900">Arus Kas</Text>
          <Text className="text-xs text-gray-500">
            {activeBusiness?.business_name} | {startDate} - {endDate}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-gray-500">Memuat arus kas...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Summary */}
          {cashFlow && (
            <View className="px-6 py-4">
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <SummaryCard
                    label="Saldo Awal"
                    value={cashFlow.openingBalance || 0}
                    color="gray"
                  />
                </View>
                <View className="flex-1">
                  <SummaryCard
                    label="Saldo Akhir"
                    value={cashFlow.closingBalance || 0}
                    color="blue"
                  />
                </View>
              </View>
              <SummaryCard
                label="Perubahan Kas Bersih"
                value={cashFlow.netCashChange || 0}
                color={(cashFlow.netCashChange || 0) >= 0 ? 'green' : 'red'}
              />
            </View>
          )}

          {/* Tables */}
          <View className="px-6">
            <ReportTable title="Aktivitas Operasional" rows={operatingRows} />
            <ReportTable title="Aktivitas Investasi" rows={investingRows} />
            <ReportTable title="Aktivitas Pembiayaan" rows={financingRows} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
