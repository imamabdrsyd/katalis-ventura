import 'react-native-gesture-handler';
import '../global.css';

import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';

import { AuthProvider } from '@/context/AuthContext';
import { BusinessProvider } from '@/context/BusinessContext';
import { SyncProvider } from '@/context/SyncContext';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <BusinessProvider>
            <SyncProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                }}
              >
                {/* Auth screens */}
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />

                {/* Main app screens with tabs */}
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              </Stack>
            </SyncProvider>
          </BusinessProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
