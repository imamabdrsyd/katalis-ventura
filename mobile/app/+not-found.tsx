import { View, Text } from 'react-native';
import { Link } from 'expo-router';

export default function NotFoundScreen() {
  return (
    <View className="flex-1 bg-white justify-center items-center px-6">
      <Text className="text-2xl font-bold text-gray-900 mb-2">404</Text>
      <Text className="text-gray-500 mb-6">Halaman tidak ditemukan</Text>
      <Link href="/(tabs)" className="text-blue-600 font-semibold">
        Kembali ke Dashboard
      </Link>
    </View>
  );
}
