import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Platform, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';

import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { AccountPicker } from './AccountPicker';
import { formatDateInput } from '@/lib/formatters';
import type { Account, TransactionCategory } from '@shared/types';

interface TransactionFormData {
  date: string;
  category: TransactionCategory;
  name: string;
  description: string;
  amount: number;
  debit_account_id: string;
  credit_account_id: string;
  is_double_entry: boolean;
  status: 'draft' | 'posted';
  notes: string;
}

interface TransactionFormProps {
  accounts: Account[];
  initialData?: Partial<TransactionFormData>;
  onSubmit: (data: TransactionFormData) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
  saving?: boolean;
}

const CATEGORIES: { value: TransactionCategory; label: string; desc: string; color: string }[] = [
  { value: 'EARN', label: 'Revenue', desc: 'Penjualan, sewa', color: 'bg-emerald-500' },
  { value: 'OPEX', label: 'OPEX', desc: 'Gaji, listrik, sewa', color: 'bg-red-500' },
  { value: 'VAR', label: 'HPP', desc: 'Bahan baku, persediaan', color: 'bg-amber-500' },
  { value: 'CAPEX', label: 'CAPEX', desc: 'Peralatan, properti', color: 'bg-blue-500' },
  { value: 'TAX', label: 'Pajak', desc: 'Pajak pemerintah', color: 'bg-purple-500' },
  { value: 'FIN', label: 'Financing', desc: 'Pinjaman, modal', color: 'bg-pink-500' },
];

export function TransactionForm({
  accounts,
  initialData,
  onSubmit,
  onCancel,
  isEditing = false,
  saving = false,
}: TransactionFormProps) {
  const [formData, setFormData] = useState<TransactionFormData>({
    date: initialData?.date || formatDateInput(new Date()),
    category: initialData?.category || 'EARN',
    name: initialData?.name || '',
    description: initialData?.description || '',
    amount: initialData?.amount || 0,
    debit_account_id: initialData?.debit_account_id || '',
    credit_account_id: initialData?.credit_account_id || '',
    is_double_entry: initialData?.is_double_entry ?? true,
    status: initialData?.status || 'draft',
    notes: initialData?.notes || '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof TransactionFormData, string>>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);

  const updateField = <K extends keyof TransactionFormData>(
    key: K,
    value: TransactionFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    // Clear error on change
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof TransactionFormData, string>> = {};

    if (!formData.date) newErrors.date = 'Tanggal harus diisi';
    if (!formData.name.trim()) newErrors.name = 'Nama harus diisi';
    if (formData.amount <= 0) newErrors.amount = 'Jumlah harus lebih dari 0';
    if (formData.is_double_entry) {
      if (!formData.debit_account_id) newErrors.debit_account_id = 'Pilih akun debit';
      if (!formData.credit_account_id) newErrors.credit_account_id = 'Pilih akun kredit';
      if (
        formData.debit_account_id &&
        formData.debit_account_id === formData.credit_account_id
      ) {
        newErrors.credit_account_id = 'Akun debit dan kredit tidak boleh sama';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      await onSubmit(formData);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Gagal menyimpan transaksi');
    }
  };

  // Context-sensitive name label
  const nameLabel =
    formData.category === 'EARN'
      ? 'Nama Customer'
      : formData.category === 'TAX'
        ? 'Instansi Pajak'
        : formData.category === 'FIN'
          ? 'Pihak Terkait'
          : 'Nama Vendor';

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="px-6 py-6">
        {/* Category Selection */}
        <Text className="text-sm font-semibold text-gray-900 mb-3">Kategori Transaksi</Text>
        <View className="flex-row flex-wrap gap-2 mb-6">
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.value}
              onPress={() => updateField('category', cat.value)}
              className={`px-4 py-3 rounded-xl border-2 ${
                formData.category === cat.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white'
              }`}
              style={{ width: '48%' }}
            >
              <View className="flex-row items-center gap-2 mb-1">
                <View className={`w-3 h-3 rounded-full ${cat.color}`} />
                <Text
                  className={`font-bold text-sm ${
                    formData.category === cat.value ? 'text-blue-700' : 'text-gray-900'
                  }`}
                >
                  {cat.label}
                </Text>
              </View>
              <Text className="text-xs text-gray-500">{cat.desc}</Text>
            </Pressable>
          ))}
        </View>

        {/* Date Picker */}
        <Text className="text-sm font-semibold text-gray-900 mb-2">Tanggal</Text>
        <Pressable
          onPress={() => setShowDatePicker(true)}
          className={`flex-row items-center px-3 py-3 border rounded-lg mb-4 ${
            errors.date ? 'border-red-300' : 'border-gray-300'
          }`}
        >
          <Calendar color="#6b7280" size={18} />
          <Text className="ml-2 text-base text-gray-900">{formData.date}</Text>
        </Pressable>
        {errors.date && <Text className="text-xs text-red-600 -mt-3 mb-4">{errors.date}</Text>}

        {showDatePicker && (
          <DateTimePicker
            value={new Date(formData.date)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, selectedDate) => {
              setShowDatePicker(Platform.OS !== 'ios');
              if (selectedDate) {
                updateField('date', formatDateInput(selectedDate));
              }
            }}
          />
        )}

        {/* Name */}
        <Input
          label={nameLabel}
          placeholder={nameLabel}
          value={formData.name}
          onChangeText={(text) => updateField('name', text)}
          error={errors.name}
        />

        {/* Description */}
        <Input
          label="Deskripsi"
          placeholder="Deskripsi transaksi"
          value={formData.description}
          onChangeText={(text) => updateField('description', text)}
          multiline
          numberOfLines={2}
        />

        {/* Amount */}
        <CurrencyInput
          label="Jumlah"
          value={formData.amount}
          onChangeValue={(val) => updateField('amount', val)}
          error={errors.amount}
        />

        {/* Double Entry Toggle */}
        <Pressable
          onPress={() => updateField('is_double_entry', !formData.is_double_entry)}
          className="flex-row items-center justify-between py-3 mb-4"
        >
          <View>
            <Text className="text-sm font-semibold text-gray-900">Mode Double-Entry</Text>
            <Text className="text-xs text-gray-500">Pilih akun debit dan kredit</Text>
          </View>
          <View
            className={`w-12 h-7 rounded-full justify-center ${
              formData.is_double_entry ? 'bg-blue-500 items-end' : 'bg-gray-300 items-start'
            }`}
          >
            <View className="w-5 h-5 bg-white rounded-full mx-1 shadow" />
          </View>
        </Pressable>

        {/* Debit & Credit Account Pickers */}
        {formData.is_double_entry && (
          <>
            <AccountPicker
              label="Akun Debit (Dr)"
              accounts={accounts}
              value={formData.debit_account_id}
              onChange={(id, code) => updateField('debit_account_id', id)}
              error={errors.debit_account_id}
            />

            <AccountPicker
              label="Akun Kredit (Cr)"
              accounts={accounts}
              value={formData.credit_account_id}
              onChange={(id, code) => updateField('credit_account_id', id)}
              error={errors.credit_account_id}
            />
          </>
        )}

        {/* Notes */}
        <Input
          label="Catatan"
          placeholder="Catatan tambahan (opsional)"
          value={formData.notes}
          onChangeText={(text) => updateField('notes', text)}
          multiline
          numberOfLines={3}
        />

        {/* Status Toggle */}
        <Pressable
          onPress={() =>
            updateField('status', formData.status === 'draft' ? 'posted' : 'draft')
          }
          className="flex-row items-center justify-between py-3 mb-6"
        >
          <View>
            <Text className="text-sm font-semibold text-gray-900">Langsung Posting</Text>
            <Text className="text-xs text-gray-500">
              {formData.status === 'posted'
                ? 'Transaksi langsung tercatat'
                : 'Simpan sebagai draft dulu'}
            </Text>
          </View>
          <View
            className={`w-12 h-7 rounded-full justify-center ${
              formData.status === 'posted'
                ? 'bg-emerald-500 items-end'
                : 'bg-gray-300 items-start'
            }`}
          >
            <View className="w-5 h-5 bg-white rounded-full mx-1 shadow" />
          </View>
        </Pressable>

        {/* Action Buttons */}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button variant="secondary" onPress={onCancel} disabled={saving}>
              Batal
            </Button>
          </View>
          <View className="flex-1">
            <Button onPress={handleSubmit} loading={saving}>
              {isEditing ? 'Simpan Perubahan' : 'Tambah Transaksi'}
            </Button>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

export type { TransactionFormData };
