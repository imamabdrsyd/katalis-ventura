import React, { useState, useEffect } from 'react';
import { View, Text, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useBusiness } from '@/context/BusinessContext';
import { supabase } from '@/lib/supabase';
import { TransactionForm, type TransactionFormData } from '@/components/transactions/TransactionForm';
import { createTransaction } from '@/hooks/useTransactions';
import type { Account } from '@shared/types';

export default function AddTransactionScreen() {
  const { activeBusinessId } = useBusiness();
  const router = useRouter();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Fetch accounts from Supabase (or local DB)
  useEffect(() => {
    if (!activeBusinessId) return;

    const fetchAccounts = async () => {
      try {
        const { data, error } = await supabase
          .from('accounts')
          .select('*')
          .eq('business_id', activeBusinessId)
          .eq('is_active', true)
          .order('account_code', { ascending: true });

        if (error) throw error;
        setAccounts(data || []);
      } catch (err) {
        console.error('Error fetching accounts:', err);
      } finally {
        setLoadingAccounts(false);
      }
    };

    fetchAccounts();
  }, [activeBusinessId]);

  const handleSubmit = async (data: TransactionFormData) => {
    if (!activeBusinessId) return;

    setSaving(true);
    try {
      await createTransaction(activeBusinessId, {
        ...data,
        date: new Date(data.date).getTime(),
      } as any);

      Alert.alert('Berhasil', 'Transaksi berhasil ditambahkan', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  if (loadingAccounts) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <Text className="text-gray-500">Memuat data akun...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-6 pt-4 pb-3 border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-900">Tambah Transaksi</Text>
      </View>

      <TransactionForm
        accounts={accounts}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        saving={saving}
      />
    </SafeAreaView>
  );
}
