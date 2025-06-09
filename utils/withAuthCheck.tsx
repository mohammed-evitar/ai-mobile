/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {useEffect, useState} from 'react';
import {View, Text, ActivityIndicator} from 'react-native';
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getuser} from './auth';
import tw from './tailwind';

// Define your navigation stack types
type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  NewsPreference: undefined;
  ManualSelectionPage: undefined;
  TalkWithAI: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface WithAuthCheckProps {
  navigation?: NavigationProp;
  route?: any;
  user?: any;
}

const withAuthCheck = <P extends WithAuthCheckProps>(
  WrappedComponent: React.ComponentType<P>,
) => {
  const WithAuthCheckComponent = (props: P) => {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute();
    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isChecking, setIsChecking] = useState(true);

    const checkAuthAndVersion = async () => {
      try {
        setIsChecking(true);
        const version = '267.0.0';
        const storedVersion = await AsyncStorage.getItem('app_version');

        // Version check - clear storage if version mismatch
        if (storedVersion !== version) {
          console.log('Version mismatch, clearing storage...');
          await AsyncStorage.clear();
          await AsyncStorage.setItem('app_version', version);

          // Navigate to login after clearing storage
          navigation.reset({
            index: 0,
            routes: [{name: 'Login'}],
          });
          return;
        }

        // Get user data
        const myuser = await getuser();
        console.log('myuser', myuser);
        setUser(myuser);

        if (!myuser) {
          // No user found, redirect to login
          navigation.reset({
            index: 0,
            routes: [{name: 'Login'}],
          });
          return;
        }

        // Check if user has news preferences (except when already on news-preference screen)
        if (
          route.name !== 'NewsPreference' &&
          (!myuser.newsPreferences ||
            !Object.keys(myuser.newsPreferences).length)
        ) {
          navigation.reset({
            index: 0,
            routes: [{name: 'NewsPreference'}],
          });
          return;
        }
      } catch (error) {
        console.error('Auth check error:', error);
        // On error, redirect to login
        navigation.reset({
          index: 0,
          routes: [{name: 'Login'}],
        });
      } finally {
        setIsLoading(false);
        setIsChecking(false);
      }
    };

    // Run auth check on component mount
    useEffect(() => {
      checkAuthAndVersion();
    }, []);

    // Re-run auth check when screen comes into focus
    useFocusEffect(
      React.useCallback(() => {
        if (!isLoading) {
          checkAuthAndVersion();
        }
      }, [isLoading]),
    );

    // Show loading while checking authentication
    if (isLoading || isChecking) {
      return (
        <View
          style={[
            tw`flex-1 justify-center items-center`,
            {backgroundColor: '#0A0710'},
          ]}>
          <ActivityIndicator size="large" color="#947EFB" />
          <Text style={tw`text-white mt-4 text-base`}>
            Checking authentication...
          </Text>
        </View>
      );
    }

    // Don't render component if no user
    if (!user) {
      return null;
    }

    // Render the wrapped component with user data
    return <WrappedComponent {...props} user={user} />;
  };

  WithAuthCheckComponent.displayName = `withAuthCheck(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`;

  return WithAuthCheckComponent;
};

export default withAuthCheck;
