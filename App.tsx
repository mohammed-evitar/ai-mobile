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

// Enable hot reloading
if (__DEV__) {
  LogBox.ignoreLogs(['Warning: ...']); // Ignore specific warnings if needed
}

export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  NewsPreference: {user: {name: string}};
  ManualSelectionPage: {user: {name: string}};
  Profile: undefined;
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
