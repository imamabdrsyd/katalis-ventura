import React from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Building2, ChevronRight } from 'lucide-react-native';

import { useBusiness } from '@/context/BusinessContext';
import { Card } from '@/components/ui/Card';

export default function SelectBusinessScreen() {
  const { businesses, setActiveBusiness, isLoading } = useBusiness();
  const router = useRouter();

  const handleSelect = async (businessId: string) => {
    await setActiveBusiness(businessId);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 py-8">
        <Text className="text-3xl font-bold text-gray-900 mb-2">Pilih Bisnis</Text>
        <Text className="text-gray-500">
          Pilih bisnis yang ingin kamu kelola
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-gray-500">Memuat bisnis...</Text>
        </View>
      ) : businesses.length === 0 ? (
        <View className="flex-1 justify-center items-center px-6">
          <Text className="text-gray-400 text-center">
            Belum ada bisnis. Buat bisnis baru di aplikasi web.
          </Text>
        </View>
      ) : (
        <FlatList
          data={businesses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 24 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => handleSelect(item.id)} className="mb-3">
              <Card className="p-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <View className="w-12 h-12 rounded-xl bg-blue-100 items-center justify-center">
                      <Building2 color="#2563eb" size={24} />
                    </View>
                    <View>
                      <Text className="font-bold text-gray-900 text-lg">
                        {item.business_name}
                      </Text>
                      <Text className="text-sm text-gray-500">{item.business_sector}</Text>
                    </View>
                  </View>
                  <ChevronRight color="#9ca3af" size={20} />
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
