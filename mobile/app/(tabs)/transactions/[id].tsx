import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CategoryBadge } from '@/components/transactions/CategoryBadge';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { deleteTransaction } from '@/hooks/useTransactions';
import type { Transaction } from '@shared/types';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchTransaction = async () => {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select(
            `*,
            debit_account:accounts!transactions_debit_account_id_fkey(id, account_code, account_name, account_type),
            credit_account:accounts!transactions_credit_account_id_fkey(id, account_code, account_name, account_type)`
          )
          .eq('id', id)
          .single();

        if (error) throw error;
        setTransaction(data as Transaction);
      } catch (err) {
        console.error('Error fetching transaction:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransaction();
  }, [id]);

  const handleDelete = () => {
    Alert.alert(
      'Hapus Transaksi',
      'Yakin ingin menghapus transaksi ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTransaction(id!);
              router.back();
            } catch (err) {
              Alert.alert('Error', 'Gagal menghapus transaksi');
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <Text className="text-gray-500">Memuat...</Text>
      </SafeAreaView>
    );
  }

  if (!transaction) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <Text className="text-gray-500">Transaksi tidak ditemukan</Text>
        <Button variant="ghost" onPress={() => router.back()}>
          Kembali
        </Button>
      </SafeAreaView>
    );
  }

  const isInflow = transaction.category === 'EARN';

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header Card */}
        <View className="bg-white px-6 py-6 border-b border-gray-100">
          <View className="flex-row items-center gap-2 mb-4">
            <CategoryBadge category={transaction.category} />
            <Badge
              label={transaction.status === 'posted' ? 'POSTED' : 'DRAFT'}
              color={transaction.status === 'posted' ? 'green' : 'gray'}
            />
          </View>

          <Text
            className={`text-3xl font-bold ${isInflow ? 'text-emerald-600' : 'text-red-600'}`}
          >
            {isInflow ? '+' : '-'}{formatCurrency(transaction.amount)}
          </Text>
        </View>

        {/* Details */}
        <View className="px-6 py-6">
          {/* Name */}
          <Card className="p-4 mb-3">
            <Text className="text-xs font-semibold text-gray-500 uppercase mb-1">
              {transaction.category === 'EARN' ? 'Customer' : 'Vendor'}
            </Text>
            <Text className="text-base text-gray-900">{transaction.name || '-'}</Text>
          </Card>

          {/* Description */}
          {transaction.description && (
            <Card className="p-4 mb-3">
              <Text className="text-xs font-semibold text-gray-500 uppercase mb-1">
                Deskripsi
              </Text>
              <Text className="text-base text-gray-900">{transaction.description}</Text>
            </Card>
          )}

          {/* Date */}
          <Card className="p-4 mb-3">
            <Text className="text-xs font-semibold text-gray-500 uppercase mb-1">Tanggal</Text>
            <Text className="text-base text-gray-900">
              {formatDate(new Date(transaction.date))}
            </Text>
          </Card>

          {/* Accounts (Double Entry) */}
          {transaction.is_double_entry && (
            <Card className="p-4 mb-3">
              <Text className="text-xs font-semibold text-gray-500 uppercase mb-3">
                Chart of Accounts
              </Text>
              <View className="flex-row gap-4">
                {/* Debit */}
                <View className="flex-1 bg-blue-50 rounded-lg p-3">
                  <View className="flex-row items-center gap-1 mb-1">
                    <ArrowDownLeft color="#2563eb" size={14} />
                    <Text className="text-xs font-bold text-blue-700">DEBIT</Text>
                  </View>
                  <Text className="text-sm text-gray-900">
                    {transaction.debit_account?.account_name || '-'}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {transaction.debit_account?.account_code || ''}
                  </Text>
                </View>
                {/* Credit */}
                <View className="flex-1 bg-emerald-50 rounded-lg p-3">
                  <View className="flex-row items-center gap-1 mb-1">
                    <ArrowUpRight color="#059669" size={14} />
                    <Text className="text-xs font-bold text-emerald-700">KREDIT</Text>
                  </View>
                  <Text className="text-sm text-gray-900">
                    {transaction.credit_account?.account_name || '-'}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {transaction.credit_account?.account_code || ''}
                  </Text>
                </View>
              </View>
            </Card>
          )}

          {/* Notes */}
          {transaction.notes && (
            <Card className="p-4 mb-3">
              <Text className="text-xs font-semibold text-gray-500 uppercase mb-1">Catatan</Text>
              <Text className="text-base text-gray-700">{transaction.notes}</Text>
            </Card>
          )}
        </View>
      </ScrollView>

      {/* Action Footer */}
      <View className="bg-white border-t border-gray-200 px-6 py-4">
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button variant="secondary" onPress={() => router.back()}>
              Kembali
            </Button>
          </View>
          <View className="flex-1">
            <Button variant="danger" onPress={handleDelete}>
              Hapus
            </Button>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
