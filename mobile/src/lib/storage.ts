import AsyncStorage from '@react-native-async-storage/async-storage';

export async function setStorageItem<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving to storage (${key}):`, error);
  }
}

export async function getStorageItem<T>(key: string): Promise<T | null> {
  try {
    const item = await AsyncStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error(`Error reading from storage (${key}):`, error);
    return null;
  }
}

export async function removeStorageItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing from storage (${key}):`, error);
  }
}

export async function clearStorage(): Promise<void> {
  try {
    await AsyncStorage.clear();
  } catch (error) {
    console.error('Error clearing storage:', error);
  }
}
