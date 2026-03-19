import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, FlatList, TextInput, Modal } from 'react-native';
import { Search, X, ChevronRight } from 'lucide-react-native';
import type { Account } from '@shared/types';

interface AccountPickerProps {
  label: string;
  accounts: Account[];
  value: string | undefined;
  onChange: (accountId: string, accountCode: string) => void;
  suggestedCode?: string;
  error?: string;
}

export function AccountPicker({
  label,
  accounts,
  value,
  onChange,
  suggestedCode,
  error,
}: AccountPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedAccount = accounts.find((a) => a.id === value);

  const filteredAccounts = useMemo(() => {
    if (!search) return accounts;
    const q = search.toLowerCase();
    return accounts.filter(
      (a) =>
        a.account_name.toLowerCase().includes(q) ||
        a.account_code.toLowerCase().includes(q)
    );
  }, [accounts, search]);

  // Group accounts by type
  const groupedAccounts = useMemo(() => {
    const groups: Record<string, Account[]> = {};
    for (const account of filteredAccounts) {
      const type = account.account_type;
      if (!groups[type]) groups[type] = [];
      groups[type].push(account);
    }
    return groups;
  }, [filteredAccounts]);

  const typeLabels: Record<string, string> = {
    ASSET: 'Aset',
    LIABILITY: 'Liabilitas',
    EQUITY: 'Ekuitas',
    REVENUE: 'Pendapatan',
    EXPENSE: 'Beban',
  };

  const handleSelect = (account: Account) => {
    onChange(account.id, account.account_code);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <View className="mb-4">
      <Text className="text-sm font-semibold text-gray-900 mb-2">{label}</Text>

      {/* Selected Account Display / Trigger */}
      <Pressable
        onPress={() => setIsOpen(true)}
        className={`flex-row items-center justify-between px-3 py-3 border rounded-lg ${
          error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
        }`}
      >
        {selectedAccount ? (
          <View className="flex-row items-center flex-1">
            <Text className="text-sm text-gray-500 mr-2">
              {selectedAccount.account_code}
            </Text>
            <Text className="text-base text-gray-900 flex-1" numberOfLines={1}>
              {selectedAccount.account_name}
            </Text>
          </View>
        ) : (
          <Text className="text-base text-gray-400">Pilih akun...</Text>
        )}
        <ChevronRight color="#9ca3af" size={18} />
      </Pressable>
      {error && <Text className="text-xs text-red-600 mt-1">{error}</Text>}

      {/* Account Picker Modal */}
      <Modal visible={isOpen} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-white">
          {/* Modal Header */}
          <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
            <Text className="text-lg font-bold text-gray-900">{label}</Text>
            <Pressable onPress={() => { setIsOpen(false); setSearch(''); }}>
              <X color="#6b7280" size={24} />
            </Pressable>
          </View>

          {/* Search */}
          <View className="px-6 py-3">
            <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
              <Search color="#9ca3af" size={18} />
              <TextInput
                className="flex-1 ml-2 text-base text-gray-900"
                placeholder="Cari akun..."
                placeholderTextColor="#9ca3af"
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
            </View>
          </View>

          {/* Account List */}
          <FlatList
            data={Object.entries(groupedAccounts)}
            keyExtractor={([type]) => type}
            renderItem={({ item: [type, accts] }) => (
              <View className="mb-2">
                <Text className="px-6 py-2 text-xs font-bold text-gray-500 uppercase bg-gray-50">
                  {typeLabels[type] || type}
                </Text>
                {accts.map((account) => {
                  const isSelected = account.id === value;
                  const isSuggested = account.account_code === suggestedCode;
                  return (
                    <Pressable
                      key={account.id}
                      onPress={() => handleSelect(account)}
                      className={`flex-row items-center px-6 py-3 border-b border-gray-50 ${
                        isSelected ? 'bg-blue-50' : isSuggested ? 'bg-amber-50' : ''
                      }`}
                    >
                      <Text className="text-sm text-gray-500 w-14">
                        {account.account_code}
                      </Text>
                      <Text
                        className={`flex-1 text-base ${
                          isSelected ? 'text-blue-700 font-semibold' : 'text-gray-900'
                        }`}
                      >
                        {account.account_name}
                      </Text>
                      {isSuggested && !isSelected && (
                        <Text className="text-xs text-amber-600 font-medium">Saran</Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
            ListEmptyComponent={
              <View className="py-12 items-center">
                <Text className="text-gray-400">Tidak ada akun yang cocok</Text>
              </View>
            }
          />
        </View>
      </Modal>
    </View>
  );
}
