import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from './apiService';
import {NavigationProp} from '@react-navigation/native';

interface UserInfo {
  name?: string;
  email?: string;
  photo?: string;
  givenName?: string;
  familyName?: string;
}

interface ApiResponse {
  result: {
    user: {
      name: string;
      newsPreferences: Record<string, any>;
    };
    token: string;
  };
}

export const handleAuthentication = async (
  navigation: NavigationProp<any>,
  userInfo: UserInfo,
) => {
  try {
    console.log('userInfo', userInfo);
    const payload = {
      name: userInfo.name || '',
      email: userInfo.email || '',
      email_verified: true, // Google Sign-In emails are verified
      picture: userInfo.photo || '',
      newsPreferences: [],
      firstName: userInfo.givenName || '',
      lastName: userInfo.familyName || '',
    };

    const res = await apiService.post<ApiResponse>('/user', payload);

    // Store user data
    await AsyncStorage.setItem('user', JSON.stringify(res.result.user));
    console.log('res', res);
    // Store the JWT token
    if (res.result.token) {
      await AsyncStorage.setItem('token', res.result.token);
      await apiService.setToken(res.result.token);
    }

    // Check if user has news preferences
    const user = res.result.user;
    const hasNewsPreferences =
      user.newsPreferences &&
      typeof user.newsPreferences === 'object' &&
      Object.keys(user.newsPreferences).length > 0;

    // Navigate based on preferences
    if (hasNewsPreferences) {
      navigation.navigate('Home');
    } else {
      navigation.navigate('NewsPreference', {user});
    }
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
};
