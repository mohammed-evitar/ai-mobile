/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import {StatusBar, LogBox} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import LoginScreen from './screens/LoginScreen';
import NewsPreference from './screens/NewsPreference';
import ManualSelectionPage from './screens/ManualSelectionPage';
import HomeScreen from './screens/HomeScreen';
import TalkWithAIScreen from './screens/TalkWithAIScreen';
import NewsDetailsScreen from './screens/NewsDetailsScreen';
import CategoryScreen from './screens/CategoryScreen';

// Enable hot reloading
if (__DEV__) {
  LogBox.ignoreLogs(['Warning: ...']); // Ignore specific warnings if needed
}

export type RootStackParamList = {
  Home: {user: any};
  Login: undefined;
  NewsPreference: {user: any};
  ManualSelectionPage: {user: any};
  Profile: undefined;
  TalkWithAI: {firstName: string; email: string};
  NewsDetails: {news: any[]; newsId: string};
  Category: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function App(): React.JSX.Element {
  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor="#0A0710" />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="NewsPreference" component={NewsPreference} />
        <Stack.Screen
          name="ManualSelectionPage"
          component={ManualSelectionPage}
        />
        <Stack.Screen name="TalkWithAI" component={TalkWithAIScreen} />
        <Stack.Screen name="NewsDetails" component={NewsDetailsScreen} />
        <Stack.Screen name="Category" component={CategoryScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
