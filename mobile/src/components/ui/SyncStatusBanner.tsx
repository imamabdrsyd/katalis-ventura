import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { AlertCircle, CheckCircle2, WifiOff, Loader } from 'lucide-react-native';
import { useSync } from '@/context/SyncContext';
import { formatLastSync } from '@/lib/formatters';

export function SyncStatusBanner() {
  const { isSyncing, isOffline, pendingCount, lastSyncAt, syncError, triggerSync } = useSync();

  // Don't show if synced and online
  if (!isSyncing && !isOffline && pendingCount === 0 && !syncError) {
    return null;
  }

  let backgroundColor = 'bg-blue-50';
  let borderColor = 'border-blue-200';
  let textColor = 'text-blue-900';
  let iconColor = '#0369a1';
  let icon = null;
  let message = '';

  if (syncError) {
    backgroundColor = 'bg-red-50';
    borderColor = 'border-red-200';
    textColor = 'text-red-900';
    iconColor = '#991b1b';
    icon = <AlertCircle color={iconColor} size={20} />;
    message = `Sync error: ${syncError}`;
  } else if (isSyncing) {
    backgroundColor = 'bg-blue-50';
    borderColor = 'border-blue-200';
    textColor = 'text-blue-900';
    iconColor = '#0369a1';
    icon = <Loader color={iconColor} size={20} />;
    message = 'Sinkronisasi...';
  } else if (isOffline) {
    backgroundColor = 'bg-amber-50';
    borderColor = 'border-amber-200';
    textColor = 'text-amber-900';
    iconColor = '#92400e';
    icon = <WifiOff color={iconColor} size={20} />;
    message = pendingCount > 0
      ? `Offline • ${pendingCount} perubahan tertunda`
      : 'Offline mode';
  } else if (pendingCount > 0) {
    backgroundColor = 'bg-amber-50';
    borderColor = 'border-amber-200';
    textColor = 'text-amber-900';
    iconColor = '#92400e';
    icon = <AlertCircle color={iconColor} size={20} />;
    message = `${pendingCount} perubahan belum tersinkron`;
  } else if (lastSyncAt) {
    backgroundColor = 'bg-green-50';
    borderColor = 'border-green-200';
    textColor = 'text-green-900';
    iconColor = '#166534';
    icon = <CheckCircle2 color={iconColor} size={20} />;
    message = `Tersinkron • ${formatLastSync(lastSyncAt)}`;
  }

  return (
    <Pressable onPress={triggerSync} disabled={isSyncing || !message}>
      <View className={`${backgroundColor} border-b ${borderColor} px-4 py-3 flex-row items-center justify-between`}>
        <View className="flex-row items-center flex-1 gap-2">
          {isSyncing ? <ActivityIndicator size="small" color={iconColor} /> : icon}
          <Text className={`${textColor} text-sm font-medium flex-1`}>
            {message}
          </Text>
        </View>
        {(isOffline || pendingCount > 0) && !isSyncing && (
          <Text className={`${textColor} text-xs px-2 py-1 bg-white/50 rounded`}>
            Sinkron
          </Text>
        )}
      </View>
    </Pressable>
  );
}
