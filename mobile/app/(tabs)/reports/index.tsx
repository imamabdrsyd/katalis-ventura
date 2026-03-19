import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { TrendingUp, Scale, ArrowRightLeft, ChevronRight } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';

const REPORTS = [
  {
    title: 'Laporan Laba Rugi',
    description: 'Pendapatan, beban, dan laba bersih bisnis Anda',
    icon: TrendingUp,
    color: '#10b981',
    href: '/(tabs)/reports/income-statement' as const,
  },
  {
    title: 'Neraca',
    description: 'Posisi aset, liabilitas, dan ekuitas',
    icon: Scale,
    color: '#3b82f6',
    href: '/(tabs)/reports/balance-sheet' as const,
  },
  {
    title: 'Arus Kas',
    description: 'Aliran kas operasional, investasi, dan pembiayaan',
    icon: ArrowRightLeft,
    color: '#8b5cf6',
    href: '/(tabs)/reports/cash-flow' as const,
  },
];

export default function ReportsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="bg-white px-6 py-6 border-b border-gray-100">
          <Text className="text-2xl font-bold text-gray-900">Laporan Keuangan</Text>
          <Text className="text-sm text-gray-500 mt-1">
            Pilih laporan untuk melihat detail
          </Text>
        </View>

        {/* Report Cards */}
        <View className="px-6 py-6 gap-4">
          {REPORTS.map((report) => {
            const Icon = report.icon;
            return (
              <Link key={report.title} href={report.href} asChild>
                <Pressable>
                  <Card className="p-5">
                    <View className="flex-row items-start gap-4">
                      <View
                        className="w-12 h-12 rounded-xl items-center justify-center"
                        style={{ backgroundColor: `${report.color}15` }}
                      >
                        <Icon color={report.color} size={24} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-base font-bold text-gray-900 mb-0.5">
                          {report.title}
                        </Text>
                        <Text className="text-sm text-gray-500">{report.description}</Text>
                      </View>
                      <ChevronRight color="#d1d5db" size={20} />
                    </View>
                  </Card>
                </Pressable>
              </Link>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
