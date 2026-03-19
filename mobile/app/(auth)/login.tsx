import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginScreen() {
  const { signIn, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Email dan password harus diisi');
      return;
    }
    if (!email.includes('@')) {
      setError('Email tidak valid');
      return;
    }
    try {
      setError(null);
      await signIn(email, password);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Login gagal';
      setError(errorMsg);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top brand area */}
        <View className="bg-blue-600 px-8 pt-16 pb-12">
          <View className="mb-2">
            <Text className="text-white text-4xl font-bold tracking-tight">AXION</Text>
            <Text className="text-blue-200 text-sm font-medium tracking-widest mt-1">
              by Katalis Ventura
            </Text>
          </View>
          <Text className="text-blue-100 text-base mt-4 leading-relaxed">
            Platform akuntansi double-entry untuk UKM Indonesia
          </Text>
        </View>

        {/* Form area */}
        <View className="px-6 py-8 flex-1">
          <Text className="text-2xl font-bold text-gray-900 mb-1">Masuk</Text>
          <Text className="text-gray-500 text-sm mb-8">Gunakan akun web kamu untuk login</Text>

          {/* Error Message */}
          {error && (
            <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <Text className="text-red-700 text-sm">{error}</Text>
            </View>
          )}

          <Input
            label="Email"
            placeholder="nama@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            editable={!isLoading}
          />

          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isLoading}
          />

          <View className="mt-2">
            <Button
              onPress={handleLogin}
              disabled={!email || !password}
              loading={isLoading}
              size="lg"
            >
              Masuk
            </Button>
          </View>

          {/* Divider */}
          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px bg-gray-200" />
            <Text className="px-3 text-gray-400 text-sm">atau</Text>
            <View className="flex-1 h-px bg-gray-200" />
          </View>

          <Button
            variant="secondary"
            size="lg"
            disabled={isLoading}
            onPress={() =>
              Alert.alert(
                'Google Login',
                'Login Google belum tersedia di mobile. Gunakan email & password.'
              )
            }
          >
            Masuk dengan Google
          </Button>
        </View>

        {/* Footer */}
        <View className="px-6 pb-8 items-center">
          <Text className="text-center text-gray-500 text-sm">
            Belum punya akun?{' '}
            <Text className="text-blue-600 font-semibold">Daftar di web</Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
