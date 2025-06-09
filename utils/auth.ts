import AsyncStorage from '@react-native-async-storage/async-storage';

export const getuser = async () => {
  try {
    const userData = await AsyncStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

export const setUser = async (userData: any) => {
  try {
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    return true;
  } catch (error) {
    console.error('Error setting user:', error);
    return false;
  }
};

export const clearUser = async () => {
  try {
    await AsyncStorage.removeItem('user');
    return true;
  } catch (error) {
    console.error('Error clearing user:', error);
    return false;
  }
};

export const isAuthenticated = async () => {
  const user = await getuser();
  return !!user;
};
