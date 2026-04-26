import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Building2,
  RefreshCw,
  LogOut,
  ChevronRight,
  CheckCircle2,
  WifiOff,
  Clock,
} from 'lucide-react-native';

import { useAuth } from '@/context/AuthContext';
import { useBusiness } from '@/context/BusinessContext';
import { useSync } from '@/context/SyncContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatLastSync } from '@/lib/formatters';

export default function SettingsScreen() {
  const { user, signOut, isLoading: authLoading } = useAuth();
  const { businesses, activeBusiness, setActiveBusiness } = useBusiness();
  const { isSyncing, isOffline, pendingCount, lastSyncAt, syncError, triggerSync } = useSync();

  const [showBusinessPicker, setShowBusinessPicker] = useState(false);

  const handleLogout = () => {
    Alert.alert('Logout', 'Yakin ingin keluar?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (err) {
            Alert.alert('Error', 'Gagal logout');
          }
        },
      },
    ]);
  };

  const handleSwitchBusiness = async (businessId: string) => {
    await setActiveBusiness(businessId);
    setShowBusinessPicker(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="bg-white px-6 py-6 border-b border-gray-100">
          <Text className="text-2xl font-bold text-gray-900">Pengaturan</Text>
        </View>

        {/* Profile Section */}
        <View className="px-6 pt-6 pb-2">
          <Text className="text-xs font-bold text-gray-500 uppercase mb-3">Profil</Text>
          <Card className="p-4">
            <View className="flex-row items-center gap-4">
              <View className="w-14 h-14 rounded-full bg-blue-100 items-center justify-center">
                <User color="#2563eb" size={28} />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-bold text-gray-900">
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                </Text>
                <Text className="text-sm text-gray-500">{user?.email}</Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Business Section */}
        <View className="px-6 pt-6 pb-2">
          <Text className="text-xs font-bold text-gray-500 uppercase mb-3">Bisnis Aktif</Text>
          <Pressable onPress={() => setShowBusinessPicker(!showBusinessPicker)}>
            <Card className="p-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-lg bg-emerald-100 items-center justify-center">
                    <Building2 color="#059669" size={20} />
                  </View>
                  <View>
                    <Text className="font-bold text-gray-900">
                      {activeBusiness?.business_name || 'Belum dipilih'}
                    </Text>
                    <Text className="text-xs text-gray-500">
                      {activeBusiness?.business_sector || ''}
                    </Text>
                  </View>
                </View>
                <ChevronRight color="#9ca3af" size={20} />
              </View>
            </Card>
          </Pressable>

          {/* Business Picker */}
          {showBusinessPicker && businesses.length > 1 && (
            <View className="mt-2">
              {businesses.map((biz) => (
                <Pressable
                  key={biz.id}
                  onPress={() => handleSwitchBusiness(biz.id)}
                  className={`flex-row items-center justify-between px-4 py-3 border-b border-gray-100 ${
                    biz.id === activeBusiness?.id ? 'bg-blue-50' : 'bg-white'
                  }`}
                >
                  <View>
                    <Text
                      className={`font-medium ${
                        biz.id === activeBusiness?.id ? 'text-blue-700' : 'text-gray-900'
                      }`}
                    >
                      {biz.business_name}
                    </Text>
                    <Text className="text-xs text-gray-500">{biz.business_sector}</Text>
                  </View>
                  {biz.id === activeBusiness?.id && (
                    <CheckCircle2 color="#2563eb" size={20} />
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Sync Section */}
        <View className="px-6 pt-6 pb-2">
          <Text className="text-xs font-bold text-gray-500 uppercase mb-3">Sinkronisasi</Text>
          <Card className="p-4">
            {/* Sync Status */}
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center gap-2">
                {isOffline ? (
                  <WifiOff color="#d97706" size={18} />
                ) : isSyncing ? (
                  <ActivityIndicator size="small" color="#2563eb" />
                ) : (
                  <CheckCircle2 color="#059669" size={18} />
                )}
                <Text className="text-sm text-gray-700">
                  {isOffline
                    ? 'Offline'
                    : isSyncing
                      ? 'Menyinkronkan...'
                      : 'Online'}
                </Text>
              </View>
              {lastSyncAt && (
                <View className="flex-row items-center gap-1">
                  <Clock color="#9ca3af" size={14} />
                  <Text className="text-xs text-gray-500">
                    {formatLastSync(lastSyncAt)}
                  </Text>
                </View>
              )}
            </View>

            {/* Pending Changes */}
            {pendingCount > 0 && (
              <View className="bg-amber-50 rounded-lg px-3 py-2 mb-4">
                <Text className="text-sm text-amber-700">
                  {pendingCount} perubahan menunggu sinkronisasi
                </Text>
              </View>
            )}

            {/* Sync Error */}
            {syncError && (
              <View className="bg-red-50 rounded-lg px-3 py-2 mb-4">
                <Text className="text-sm text-red-700">{syncError}</Text>
              </View>
            )}

            {/* Sync Button */}
            <Button
              onPress={triggerSync}
              disabled={isSyncing || isOffline}
              loading={isSyncing}
              variant="secondary"
            >
              Sinkronkan Sekarang
            </Button>
          </Card>
        </View>

        {/* Logout */}
        <View className="px-6 pt-6">
          <Button variant="danger" onPress={handleLogout} loading={authLoading}>
            Logout
          </Button>
        </View>

        {/* App Info */}
        <View className="px-6 pt-8 items-center">
          <Text className="text-xs text-gray-400">Katalis Ventura Mobile v1.0.0</Text>
          <Text className="text-xs text-gray-400 mt-1">Powered by AXION</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
